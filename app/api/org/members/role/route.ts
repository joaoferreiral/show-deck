import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { targetUserId, newRole } = await req.json()
  if (!targetUserId || !newRole) {
    return NextResponse.json({ error: 'targetUserId e newRole são obrigatórios' }, { status: 400 })
  }
  if (!['admin', 'member'].includes(newRole)) {
    return NextResponse.json({ error: 'Perfil inválido (admin | member)' }, { status: 400 })
  }

  const service = createServiceClient() as any

  // Only owners can change roles
  const { data: callerMember } = await service
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single()

  if (!callerMember) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })
  if (callerMember.role !== 'owner') {
    return NextResponse.json({ error: 'Apenas o proprietário pode alterar perfis' }, { status: 403 })
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'Você não pode alterar seu próprio perfil' }, { status: 400 })
  }

  // Get target info
  const { data: targetMember } = await service
    .from('organization_members')
    .select('role')
    .eq('org_id', callerMember.org_id)
    .eq('user_id', targetUserId)
    .single()

  if (!targetMember) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })
  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Não é possível alterar o perfil do proprietário' }, { status: 400 })
  }

  const { data: { user: targetUser } } = await service.auth.admin.getUserById(targetUserId)

  const { error } = await service
    .from('organization_members')
    .update({ role: newRole })
    .eq('org_id', callerMember.org_id)
    .eq('user_id', targetUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logActivity({
    orgId: callerMember.org_id,
    userId: user.id,
    action: 'member.role_changed',
    entityType: 'member',
    entityId: targetUserId,
    entityName: targetUser?.email ?? targetUserId,
    metadata: { from: targetMember.role, to: newRole },
  })

  return NextResponse.json({ success: true })
}
