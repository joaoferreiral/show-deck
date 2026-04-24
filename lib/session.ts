import { cache } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use service client to bypass RLS on organization_members
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const { data: memberships, error: membershipsError } = await sb
    .from('organization_members')
    .select('org_id, role, organizations(id, name)')
    .eq('user_id', user.id)

  if (membershipsError) {
    console.error('[session] memberships query error:', membershipsError.message)
  }

  if (!memberships || memberships.length === 0) redirect('/onboarding')

  // Pick current org from cookie, fall back to first
  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get('showdeck_org')?.value
  const current = memberships.find((m: any) => m.org_id === savedOrgId) ?? memberships[0]
  const currentOrg = current.organizations as { id: string; name: string } | null

  const allOrgs = memberships.map((m: any) => ({
    id: m.org_id as string,
    name: (m.organizations?.name as string) ?? 'Organização',
    role: (m.role ?? 'member') as 'owner' | 'admin' | 'member',
  }))

  return {
    user,
    userId: user.id,
    orgId: current.org_id as string,
    userRole: (current.role ?? 'member') as 'owner' | 'admin' | 'member',
    orgName: currentOrg?.name ?? 'Minha Organização',
    userName: (user.user_metadata?.full_name as string) ?? '',
    userEmail: user.email ?? '',
    userAvatar: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    allOrgs,
  }
})
