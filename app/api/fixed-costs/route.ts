import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

async function resolveOrgId(userId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get('showdeck_org')?.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any
  const { data: memberships } = await sb
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
  if (!memberships?.length) return null
  const match = (memberships as { org_id: string }[]).find(m => m.org_id === savedOrgId)
  return (match ?? memberships[0]).org_id as string
}

// ─── GET /api/fixed-costs?artist_id= ─────────────────────────────────────────

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ fixedCosts: [] })

  const { searchParams } = new URL(req.url)
  const artistId = searchParams.get('artist_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  let query = sb
    .from('fixed_costs')
    .select('id, org_id, artist_id, description, amount, category, active, notes, created_at, updated_at, artists(id, name, color, photo_url)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  if (artistId) query = query.eq('artist_id', artistId)

  const { data, error } = await query
  if (error) {
    console.error('[api/fixed-costs GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fixedCosts: data ?? [] })
}

// ─── POST /api/fixed-costs ────────────────────────────────────────────────────
// Body: { artist_id, description, amount, category?, notes? }

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const body = await req.json()
  const { artist_id, description, amount, category, notes } = body as {
    artist_id: string
    description: string
    amount: number
    category?: string
    notes?: string
  }

  if (!artist_id)      return NextResponse.json({ error: 'artist_id é obrigatório' }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 })
  if (!amount || amount <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const { data: artist } = await sb
    .from('artists')
    .select('id')
    .eq('id', artist_id)
    .eq('org_id', orgId)
    .single()
  if (!artist) return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 })

  const { data: fixedCost, error } = await sb
    .from('fixed_costs')
    .insert({
      org_id:      orgId,
      artist_id,
      description: description.trim(),
      amount,
      category:    category ?? 'outros',
      active:      true,
      notes:       notes ?? null,
    })
    .select('id, org_id, artist_id, description, amount, category, active, notes, created_at, updated_at')
    .single()

  if (error) {
    console.error('[api/fixed-costs POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fixedCost })
}
