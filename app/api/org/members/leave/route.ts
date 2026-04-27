import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = createServiceClient() as any

  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get('showdeck_org')?.value

  const { data: memberships } = await service
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)

  if (!memberships?.length) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const match = (memberships as any[]).find(m => m.org_id === savedOrgId)
  const current = (match ?? memberships[0]) as { org_id: string; role: string }

  if (current.role === 'owner') {
    return NextResponse.json({
      error: 'O proprietário não pode sair da organização. Exclua a organização ou transfira a propriedade.',
    }, { status: 400 })
  }

  const { error } = await service
    .from('organization_members')
    .delete()
    .eq('org_id', current.org_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Clear the org cookie so the user picks another org on next load
  const res = NextResponse.json({ ok: true })
  res.cookies.set('showdeck_org', '', { path: '/', maxAge: 0 })
  return res
}
