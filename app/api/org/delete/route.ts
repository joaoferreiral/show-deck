import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { orgId } = await req.json()
  if (!orgId) return NextResponse.json({ error: 'orgId é obrigatório' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  // Only the owner can delete the organization
  const { data: member } = await sb
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.role !== 'owner') {
    return NextResponse.json({ error: 'Apenas o proprietário pode excluir a organização' }, { status: 403 })
  }

  // Delete child records first (in case cascades aren't set)
  await sb.from('org_invites').delete().eq('org_id', orgId)
  await sb.from('activity_log').delete().eq('org_id', orgId)
  await sb.from('organization_members').delete().eq('org_id', orgId)

  const { error } = await sb.from('organizations').delete().eq('id', orgId)

  if (error) {
    console.error('[org/delete] error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
