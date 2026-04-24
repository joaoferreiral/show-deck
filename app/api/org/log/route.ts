import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity, type ActivityAction } from '@/lib/activity'

const ALLOWED_ACTIONS: ActivityAction[] = [
  'show.created', 'show.updated', 'show.deleted',
  'artist.created', 'contractor.created',
]

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { action, entityType, entityId, entityName, metadata } = body

  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }

  const service = createServiceClient() as any
  const { data: member } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  await logActivity({
    orgId: member.org_id,
    userId: user.id,
    action,
    entityType,
    entityId,
    entityName,
    metadata,
  })

  return NextResponse.json({ ok: true })
}
