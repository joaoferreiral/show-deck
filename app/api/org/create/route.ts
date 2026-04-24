import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { slugify } from '@/lib/utils'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name, city, state } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  // Use service client to bypass RLS for both inserts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const slug = slugify(name)

  const { data: org, error: orgError } = await sb
    .from('organizations')
    .insert({
      name: name.trim(),
      slug: `${slug}-${Date.now()}`,
      owner_id: user.id,
      base_city: city || null,
      base_state: state || null,
      plan: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      settings: {},
    })
    .select()
    .single()

  if (orgError) {
    console.error('[org/create] org insert error:', orgError.message)
    return NextResponse.json({ error: orgError.message }, { status: 500 })
  }

  const { error: memberError } = await sb
    .from('organization_members')
    .insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner',
      permissions: {},
    })

  if (memberError) {
    console.error('[org/create] member insert error:', memberError.message)
    // Rollback org if member insert fails
    await sb.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ orgId: org.id, orgName: org.name })
}
