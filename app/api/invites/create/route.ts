import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'
import crypto from 'crypto'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { orgId, role = 'member' } = await req.json()
  if (!orgId) return NextResponse.json({ error: 'orgId obrigatório' }, { status: 400 })

  const service = createServiceClient() as any

  // Verify caller belongs to this org
  const { data: member } = await service
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Proibido' }, { status: 403 })

  const token = crypto.randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invite, error } = await service
    .from('org_invites')
    .insert({ org_id: orgId, created_by: user.id, token, role, expires_at: expiresAt })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const link = `${baseUrl}/join?token=${invite.token}`

  await logActivity({ orgId, userId: user.id, action: 'invite.created' })

  return NextResponse.json({ token: invite.token, link })
}
