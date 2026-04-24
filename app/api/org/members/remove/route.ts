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

  const service = createServiceClient() as any

  // Get caller's membership + role
  const { data: callerMember } = await service
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!callerMember) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })
  if (callerMember.role !== 'owner' && callerMember.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas proprietários e administradores podem remover membros' }, { status: 403 })
  }

  // Can't remove yourself
  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'Você não pode remover a si mesmo' }, { status: 400 })
  }

  // Get target's role — owners cannot be removed
  const { data: targetMember } = await service
    .from('organization_members')
    .select('role')
    .eq('org_id', callerMember.org_id)
    .eq('user_id', targetUserId)
    .single()

  if (!targetMember) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'O proprietário não pode ser removido' }, { status: 400 })
  }
  // Admin can only remove regular members
  if (callerMember.role === 'admin' && targetMember.role === 'admin') {
    return NextResponse.json({ error: 'Administradores não podem remover outros administradores' }, { status: 403 })
  }

  // Get target email for log
  const { data: { user: targetUser } } = await service.auth.admin.getUserById(targetUserId)

  const { error } = await service
    .from('organization_members')
    .delete()
    .eq('org_id', callerMember.org_id)
    .eq('user_id', targetUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity({
    orgId: callerMember.org_id,
    userId: user.id,
    action: 'member.removed',
    entityType: 'member',
    entityId: targetUserId,
    entityName: targetUser?.email ?? targetUserId,
  })

  return NextResponse.json({ success: true })
}
