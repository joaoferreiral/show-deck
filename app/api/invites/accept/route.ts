import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const service = createServiceClient() as any

  // Validate invite
  const { data: invite } = await service
    .from('org_invites')
    .select('*')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })
  if (invite.used_at) return NextResponse.json({ error: 'Convite já utilizado' }, { status: 410 })
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Convite expirado' }, { status: 410 })
  }

  // Check if user is already a member of this org
  const { data: existing } = await service
    .from('organization_members')
    .select('id')
    .eq('org_id', invite.org_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!existing) {
    // Validate role against known enum values; fall back to 'member'
    const VALID_ROLES = ['owner', 'admin', 'member']
    const safeRole = VALID_ROLES.includes(invite.role) ? invite.role : 'member'

    const { error: memberError } = await service
      .from('organization_members')
      .insert({
        org_id: invite.org_id,
        user_id: user.id,
        role: safeRole,
        permissions: {},
      })

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }
  }

  // Mark invite as used
  await service
    .from('org_invites')
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq('id', invite.id)

  await logActivity({
    orgId: invite.org_id,
    userId: user.id,
    action: 'member.joined',
    entityType: 'member',
    entityId: user.id,
    entityName: user.email ?? user.id,
  })

  return NextResponse.json({ success: true, orgId: invite.org_id })
}
