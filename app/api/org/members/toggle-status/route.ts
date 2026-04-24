import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { targetUserId } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'targetUserId obrigatório' }, { status: 400 })
  if (targetUserId === user.id) return NextResponse.json({ error: 'Você não pode desativar a si mesmo' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const { data: callerMember } = await sb
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!callerMember) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })
  if (callerMember.role !== 'owner' && callerMember.role !== 'admin') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  const { data: target } = await sb
    .from('organization_members')
    .select('role, permissions')
    .eq('org_id', callerMember.org_id)
    .eq('user_id', targetUserId)
    .single()

  if (!target) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'O proprietário não pode ser desativado' }, { status: 400 })
  if (callerMember.role === 'admin' && target.role === 'admin') {
    return NextResponse.json({ error: 'Administradores não podem desativar outros administradores' }, { status: 403 })
  }

  const currentDisabled = !!(target.permissions as Record<string, unknown>)?.disabled
  const newDisabled = !currentDisabled

  const { error } = await sb
    .from('organization_members')
    .update({ permissions: { ...(target.permissions ?? {}), disabled: newDisabled } })
    .eq('org_id', callerMember.org_id)
    .eq('user_id', targetUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { user: targetUser } } = await sb.auth.admin.getUserById(targetUserId)

  await logActivity({
    orgId: callerMember.org_id,
    userId: user.id,
    action: newDisabled ? 'member.disabled' : 'member.enabled',
    entityType: 'member',
    entityId: targetUserId,
    entityName: targetUser?.email ?? targetUserId,
  })

  return NextResponse.json({ ok: true, disabled: newDisabled })
}
