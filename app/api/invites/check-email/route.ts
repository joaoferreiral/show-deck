import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ invite: null })

  const service = createServiceClient() as any

  const { data: invite } = await service
    .from('org_invites')
    .select('token, role, org_id, organizations(name)')
    .eq('invited_email', user.email.toLowerCase())
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!invite) return NextResponse.json({ invite: null })

  return NextResponse.json({
    invite: {
      token: invite.token,
      role: invite.role,
      orgId: invite.org_id,
      orgName: invite.organizations?.name ?? 'Organização',
    },
  })
}
