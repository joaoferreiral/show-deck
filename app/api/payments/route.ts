import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── GET /api/payments ────────────────────────────────────────────────────────
// Query params: from?, to?, artist_id?
// Returns: shows with nested show_payments

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ shows: [] })

  const { searchParams } = new URL(req.url)
  const from       = searchParams.get('from')
  const to         = searchParams.get('to')
  const artistId   = searchParams.get('artist_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  // Fetch shows for this org + filters
  let showsQuery = sb
    .from('shows')
    .select('id, title, status, start_at, city, state, cache_value, artist_id, artists(id, name, color, photo_url)')
    .eq('org_id', orgId)
    .neq('status', 'cancelado')
    .order('start_at', { ascending: false })

  if (from)      showsQuery = showsQuery.gte('start_at', from)
  if (to)        showsQuery = showsQuery.lte('start_at', to)
  if (artistId)  showsQuery = showsQuery.eq('artist_id', artistId)

  const { data: shows, error: showsError } = await showsQuery

  if (showsError) {
    console.error('[api/payments GET] shows error:', showsError.message)
    return NextResponse.json({ error: showsError.message }, { status: 500 })
  }

  if (!shows?.length) return NextResponse.json({ shows: [] })

  const showIds = (shows as { id: string }[]).map(s => s.id)

  // Fetch payments + expenses in parallel
  const [paymentsRes, expensesRes] = await Promise.all([
    sb
      .from('show_payments')
      .select('id, show_id, amount, due_date, paid_at, description, created_at')
      .in('show_id', showIds)
      .order('due_date', { ascending: true }),
    sb
      .from('expenses')
      .select('id, show_id, category, description, amount, paid, paid_at, notes, created_at')
      .in('show_id', showIds)
      .order('created_at', { ascending: true }),
  ])

  if (paymentsRes.error) {
    console.error('[api/payments GET] payments error:', paymentsRes.error.message)
    return NextResponse.json({ error: paymentsRes.error.message }, { status: 500 })
  }
  if (expensesRes.error) {
    console.error('[api/payments GET] expenses error:', expensesRes.error.message)
    return NextResponse.json({ error: expensesRes.error.message }, { status: 500 })
  }

  // Group by show_id
  type RawPayment = { id: string; show_id: string; amount: number; due_date: string; paid_at: string | null; description: string | null; created_at: string }
  type RawExpense = { id: string; show_id: string; category: string; description: string | null; amount: number; paid: boolean; paid_at: string | null; notes: string | null; created_at: string }

  const paymentsByShow = ((paymentsRes.data ?? []) as RawPayment[]).reduce<Record<string, RawPayment[]>>((acc, p) => {
    ;(acc[p.show_id] ??= []).push(p)
    return acc
  }, {})

  const expensesByShow = ((expensesRes.data ?? []) as RawExpense[]).reduce<Record<string, RawExpense[]>>((acc, e) => {
    ;(acc[e.show_id] ??= []).push(e)
    return acc
  }, {})

  // Merge into shows
  const result = (shows as {
    id: string
    title: string
    status: string
    start_at: string
    city: string | null
    state: string | null
    cache_value: number
    artist_id: string
    artists: { id: string; name: string; color: string; photo_url: string | null } | null
  }[]).map(show => ({
    ...show,
    payments: paymentsByShow[show.id] ?? [],
    expenses: expensesByShow[show.id] ?? [],
  }))

  return NextResponse.json({ shows: result })
}

// ─── POST /api/payments ───────────────────────────────────────────────────────
// Body: { show_id, installments: [{ amount, due_date, description? }] }
// Creates one or more payment installments

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const body = await req.json()
  const { show_id, installments } = body as {
    show_id: string
    installments: { amount: number; due_date: string; description?: string }[]
  }

  if (!show_id) return NextResponse.json({ error: 'show_id é obrigatório' }, { status: 400 })
  if (!installments?.length) return NextResponse.json({ error: 'Nenhuma parcela informada' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  // Verify show belongs to org
  const { data: show } = await sb
    .from('shows')
    .select('id, title')
    .eq('id', show_id)
    .eq('org_id', orgId)
    .single()

  if (!show) return NextResponse.json({ error: 'Show não encontrado' }, { status: 404 })

  const rows = installments.map(inst => ({
    org_id:      orgId,
    show_id,
    amount:      inst.amount,
    due_date:    inst.due_date,
    description: inst.description ?? null,
    paid_at:     null,
  }))

  const { data: created, error } = await sb
    .from('show_payments')
    .insert(rows)
    .select()

  if (error) {
    console.error('[api/payments POST] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logActivity({
    orgId,
    userId: user.id,
    action: 'payment.created',
    entityType: 'show',
    entityId: show_id,
    entityName: show.title,
  })

  return NextResponse.json({ payments: created })
}
