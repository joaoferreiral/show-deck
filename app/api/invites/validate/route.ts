import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const service = createServiceClient() as any

  const { data: invite } = await service
    .from('org_invites')
    .select('*, organizations(name)')
    .eq('token', token)
    .single()

  if (!invite) return NextResponse.json({ error: 'Convite não encontrado' }, { status: 404 })

  if (invite.used_at) {
    return NextResponse.json(
      { error: 'Este link já foi utilizado', orgName: invite.organizations?.name },
      { status: 410 }
    )
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json(
      { error: 'Este link expirou', orgName: invite.organizations?.name },
      { status: 410 }
    )
  }

  return NextResponse.json({
    orgName: invite.organizations?.name,
    orgId: invite.org_id,
    role: invite.role,
  })
}
