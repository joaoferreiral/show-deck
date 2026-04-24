import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100)

  const service = createServiceClient() as any

  const { data: myMember } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!myMember) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const { data: logs, error } = await service
    .from('activity_logs')
    .select('*')
    .eq('org_id', myMember.org_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with user info
  const userCache: Record<string, { email: string; name: string | null }> = {}

  const enriched = await Promise.all(
    (logs ?? []).map(async (log: any) => {
      if (!log.user_id) return { ...log, userEmail: null, userName: null }
      if (!userCache[log.user_id]) {
        const { data: { user: u } } = await service.auth.admin.getUserById(log.user_id)
        userCache[log.user_id] = {
          email: u?.email ?? log.user_id,
          name: u?.user_metadata?.full_name ?? null,
        }
      }
      return { ...log, ...userCache[log.user_id] }
    })
  )

  return NextResponse.json({ logs: enriched })
}
