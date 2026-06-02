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

// ─── GET /api/fixed-cost-payments?year=YYYY&month=M ──────────────────────────
// Returns all monthly payment records for the org (optionally filtered by year/month)

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ payments: [] })

  const { searchParams } = new URL(req.url)
  const year  = searchParams.get('year')
  const month = searchParams.get('month')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  let query = sb
    .from('fixed_cost_payments')
    .select('id, org_id, fixed_cost_id, year, month, paid_at, created_at')
    .eq('org_id', orgId)

  if (year)  query = query.eq('year',  parseInt(year,  10))
  if (month) query = query.eq('month', parseInt(month, 10))

  const { data, error } = await query
  if (error) {
    console.error('[api/fixed-cost-payments GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ payments: data ?? [] })
}

// ─── POST /api/fixed-cost-payments ───────────────────────────────────────────
// Body: { fixed_cost_id, year, month, paid_at? }
// Upserts a payment record (marks as paid for that month)

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const body = await req.json()
  const { fixed_cost_id, year, month, paid_at } = body as {
    fixed_cost_id: string
    year: number
    month: number
    paid_at?: string
  }

  if (!fixed_cost_id) return NextResponse.json({ error: 'fixed_cost_id obrigatório' }, { status: 400 })
  if (!year || !month) return NextResponse.json({ error: 'year e month obrigatórios' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  // Verify the fixed cost belongs to this org
  const { data: cost } = await sb
    .from('fixed_costs')
    .select('id')
    .eq('id', fixed_cost_id)
    .eq('org_id', orgId)
    .single()
  if (!cost) return NextResponse.json({ error: 'Custo fixo não encontrado' }, { status: 404 })

  const { data: payment, error } = await sb
    .from('fixed_cost_payments')
    .upsert({
      org_id: orgId,
      fixed_cost_id,
      year,
      month,
      paid_at: paid_at ?? new Date().toISOString(),
    }, { onConflict: 'fixed_cost_id,year,month' })
    .select()
    .single()

  if (error) {
    console.error('[api/fixed-cost-payments POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ payment })
}

// ─── DELETE /api/fixed-cost-payments ─────────────────────────────────────────
// Body: { fixed_cost_id, year, month }
// Removes a monthly payment (marks as unpaid)

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const body = await req.json()
  const { fixed_cost_id, year, month } = body as {
    fixed_cost_id: string
    year: number
    month: number
  }

  if (!fixed_cost_id || !year || !month) {
    return NextResponse.json({ error: 'fixed_cost_id, year e month obrigatórios' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const { error } = await sb
    .from('fixed_cost_payments')
    .delete()
    .eq('org_id', orgId)
    .eq('fixed_cost_id', fixed_cost_id)
    .eq('year', year)
    .eq('month', month)

  if (error) {
    console.error('[api/fixed-cost-payments DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
