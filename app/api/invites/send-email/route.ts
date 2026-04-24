import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'
import crypto from 'crypto'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { email, orgId, role = 'member' } = await req.json()
  if (!email || !orgId) return NextResponse.json({ error: 'email e orgId são obrigatórios' }, { status: 400 })

  const service = createServiceClient() as any

  // Verify caller belongs to org
  const { data: callerMember } = await service
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!callerMember) return NextResponse.json({ error: 'Sem acesso a esta organização' }, { status: 403 })

  const token = crypto.randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin
  const joinUrl = `${origin}/join?token=${token}`

  // Save invite
  const { error: insertError } = await service
    .from('org_invites')
    .insert({ org_id: orgId, created_by: user.id, token, role, expires_at: expiresAt, invited_email: email.toLowerCase() })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Try to send invite email via Supabase auth
  let emailSent = false
  try {
    const { error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo: joinUrl,
    })
    emailSent = !inviteError
  } catch {
    // If user already exists, inviteUserByEmail fails — we just return the link
  }

  await logActivity({ orgId, userId: user.id, action: 'invite.created', metadata: { invited_email: email } })

  return NextResponse.json({ token, link: joinUrl, emailSent })
}
