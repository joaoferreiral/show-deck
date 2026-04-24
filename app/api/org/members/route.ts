import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const service = createServiceClient() as any

  // Get the org for this user
  const { data: myMember } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!myMember) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  // Get all members of this org
  const { data: members, error } = await service
    .from('organization_members')
    .select('user_id, role, created_at')
    .eq('org_id', myMember.org_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with user info from auth
  const enriched = await Promise.all(
    (members ?? []).map(async (m: any) => {
      const { data: { user: u } } = await service.auth.admin.getUserById(m.user_id)
      return {
        userId: m.user_id,
        role: m.role,
        createdAt: m.created_at,
        email: u?.email ?? m.user_id,
        name: u?.user_metadata?.full_name ?? null,
        isMe: m.user_id === user.id,
      }
    })
  )

  return NextResponse.json({ members: enriched })
}
