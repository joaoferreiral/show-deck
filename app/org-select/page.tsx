import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { OrgSelectClient } from './client'

export default async function OrgSelectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const [{ data: memberships }, { data: inviteRows }] = await Promise.all([
    sb
      .from('organization_members')
      .select('org_id, role, organizations(id, name)')
      .eq('user_id', user.id),
    sb
      .from('org_invites')
      .select('token, role, org_id, organizations(name)')
      .eq('invited_email', (user.email ?? '').toLowerCase())
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString()),
  ])

  const orgs: { id: string; name: string; role: 'owner' | 'admin' | 'member' }[] =
    (memberships ?? []).map((m: any) => ({
      id: m.org_id as string,
      name: (m.organizations?.name as string) ?? 'Organização',
      role: (m.role ?? 'member') as 'owner' | 'admin' | 'member',
    }))

  const invites: { token: string; role: string; orgId: string; orgName: string }[] =
    (inviteRows ?? [])
      // Filter out invites for orgs the user is already in
      .filter((i: any) => !orgs.find(o => o.id === i.org_id))
      .map((i: any) => ({
        token: i.token as string,
        role: i.role as string,
        orgId: i.org_id as string,
        orgName: (i.organizations?.name as string) ?? 'Organização',
      }))

  // Auto-redirect: single org and no pending invites
  if (orgs.length === 1 && invites.length === 0) {
    // Set the org cookie server-side via the redirect destination;
    // session.ts falls back to first membership so no cookie needed.
    redirect('/dashboard')
  }

  // No orgs at all and no invites → create first org
  if (orgs.length === 0 && invites.length === 0) {
    redirect('/onboarding')
  }

  return (
    <OrgSelectClient
      orgs={orgs}
      invites={invites}
      user={{
        name: (user.user_metadata?.full_name as string) ?? '',
        email: user.email ?? '',
        avatar: (user.user_metadata?.avatar_url as string) ?? null,
      }}
    />
  )
}
