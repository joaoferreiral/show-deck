import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function resolveOrgId(userId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get('showdeck_org')?.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any
  const { data: memberships } = await sb
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
  if (!memberships?.length) return null
  const match = (memberships as { org_id: string }[]).find(m => m.org_id === savedOrgId)
  return (match ?? memberships[0]).org_id as string
}

// ─── POST /api/org/transfer ───────────────────────────────────────────────────
// Body: { new_owner_id: string }
// Only the current owner can call this.

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  // Confirm caller is current owner
  const { data: org } = await sb
    .from('organizations')
    .select('owner_id')
    .eq('id', orgId)
    .single()

  if (!org || org.owner_id !== user.id) {
    return NextResponse.json({ error: 'Apenas o proprietário pode transferir a organização' }, { status: 403 })
  }

  const body = await req.json()
  const { new_owner_id } = body as { new_owner_id: string }

  if (!new_owner_id) return NextResponse.json({ error: 'new_owner_id é obrigatório' }, { status: 400 })
  if (new_owner_id === user.id) return NextResponse.json({ error: 'Você já é o proprietário' }, { status: 400 })

  // Verify the new owner is a member
  const { data: newMember } = await sb
    .from('organization_members')
    .select('id, user_id')
    .eq('org_id', orgId)
    .eq('user_id', new_owner_id)
    .single()

  if (!newMember) {
    return NextResponse.json({ error: 'O usuário selecionado não é membro desta organização' }, { status: 404 })
  }

  // Transfer: update org owner + flip member roles
  const [orgUpdate, newOwnerRole, prevOwnerRole] = await Promise.all([
    sb.from('organizations')
      .update({ owner_id: new_owner_id, updated_at: new Date().toISOString() })
      .eq('id', orgId),
    sb.from('organization_members')
      .update({ role: 'owner' })
      .eq('org_id', orgId)
      .eq('user_id', new_owner_id),
    sb.from('organization_members')
      .update({ role: 'empresario' })
      .eq('org_id', orgId)
      .eq('user_id', user.id),
  ])

  if (orgUpdate.error || newOwnerRole.error || prevOwnerRole.error) {
    console.error('[api/org/transfer]', orgUpdate.error?.message ?? newOwnerRole.error?.message ?? prevOwnerRole.error?.message)
    return NextResponse.json({ error: 'Erro ao transferir organização' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
