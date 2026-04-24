import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function getOrgId(userId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get('showdeck_org')?.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any
  const { data: memberships } = await sb
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
  if (!memberships?.length) return null
  const match = memberships.find((m: any) => m.org_id === savedOrgId)
  return (match ?? memberships[0]).org_id as string
}

// GET — list pending (not used, not expired) invites for the org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await getOrgId(user.id)
  if (!orgId) return NextResponse.json({ invites: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const { data: invites } = await sb
    .from('org_invites')
    .select('id, token, invited_email, role, expires_at, created_at')
    .eq('org_id', orgId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  return NextResponse.json({ invites: invites ?? [] })
}

// DELETE — cancel a pending invite
export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token obrigatório' }, { status: 400 })

  const orgId = await getOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  // Verify invite belongs to this org before cancelling
  const { data: invite } = await sb
    .from('org_invites')
    .select('id, org_id')
    .eq('token', token)
    .maybeSingle()

  if (!invite || invite.org_id !== orgId) {
    return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  }

  await sb
    .from('org_invites')
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq('token', token)

  return NextResponse.json({ ok: true })
}
