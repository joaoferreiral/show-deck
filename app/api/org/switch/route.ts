import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { orgId } = await req.json()
  if (!orgId) return NextResponse.json({ error: 'orgId obrigatório' }, { status: 400 })

  // Verify membership
  const service = createServiceClient() as any
  const { data: member } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!member) return NextResponse.json({ error: 'Sem acesso a esta organização' }, { status: 403 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('showdeck_org', orgId, { path: '/', maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: 'lax' })
  return res
}
