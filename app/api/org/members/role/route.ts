import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'

async function getCallerMember(userId: string) {
  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get('showdeck_org')?.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any
  const { data: memberships } = await sb
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', userId)
  if (!memberships?.length) return null
  const match = (memberships as any[]).find(m => m.org_id === savedOrgId)
  return (match ?? memberships[0]) as { org_id: string; role: string }
}

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
  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'Você não pode alterar seu próprio perfil' }, { status: 400 })
  }

  const callerMember = await getCallerMember(user.id)
  if (!callerMember) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })
  if (callerMember.role !== 'owner') {
    return NextResponse.json({ error: 'Apenas o proprietário pode alterar perfis' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any

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

  const { error } = await service
    .from('organization_members')
    .update({ role: newRole })
    .eq('org_id', callerMember.org_id)
    .eq('user_id', targetUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { user: targetUser } } = await service.auth.admin.getUserById(targetUserId)

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
