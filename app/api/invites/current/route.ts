import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ token: null })

  const service = createServiceClient() as any

  const { data: member } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ token: null })

  // Most recent invite that is not expired and not used
  const { data: invite } = await service
    .from('org_invites')
    .select('token, expires_at')
    .eq('org_id', member.org_id)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!invite) return NextResponse.json({ token: null, link: null })

  const origin = new URL(req.url).origin
  const link = `${origin}/join?token=${invite.token}`

  return NextResponse.json({ token: invite.token, link })
}
