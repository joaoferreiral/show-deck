import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Cached per-request: retorna usuário + org sem repetir chamadas ao Supabase
 * dentro do mesmo ciclo de renderização (layout + páginas filhas).
 */
export const getSession = cache(async () => {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any
  const { data: member } = await sb
    .from('organization_members')
    .select('org_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .single()

  if (!member) redirect('/onboarding')

  const org = member.organizations as { id: string; name: string } | null

  return {
    user,
    orgId: member.org_id,
    userRole: (member.role ?? 'member') as 'owner' | 'admin' | 'member',
    orgName: org?.name ?? 'Minha Organização',
    userName: user.user_metadata?.full_name ?? '',
    userEmail: user.email ?? '',
    userAvatar: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    userId: user.id,
  }
})
