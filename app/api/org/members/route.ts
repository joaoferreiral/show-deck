import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  // Determine active org (respects org switcher cookie)
  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get('showdeck_org')?.value

  const { data: memberships } = await sb
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)

  if (!memberships?.length) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const match = memberships.find((m: any) => m.org_id === savedOrgId)
  const orgId = (match ?? memberships[0]).org_id as string

  // Verify caller is a member
  const { data: callerMember } = await sb
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!callerMember) return NextResponse.json({ error: 'Sem acesso' }, { status: 403 })

  const { data: members, error } = await sb
    .from('organization_members')
    .select('user_id, role, created_at, permissions')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const enriched = await Promise.all(
    (members ?? []).map(async (m: any) => {
      const { data: { user: u } } = await sb.auth.admin.getUserById(m.user_id)
      return {
        userId: m.user_id,
        role: m.role,
        createdAt: m.created_at,
        email: u?.email ?? m.user_id,
        name: u?.user_metadata?.full_name ?? null,
        isMe: m.user_id === user.id,
        disabled: !!(m.permissions as Record<string, unknown>)?.disabled,
      }
    })
  )

  return NextResponse.json({ members: enriched })
}
