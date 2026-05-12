import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'
import type { ExpenseCategory } from '@/types/supabase'

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

// ─── GET /api/expenses?show_id= ───────────────────────────────────────────────
// Returns expenses for a specific show

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ expenses: [] })

  const { searchParams } = new URL(req.url)
  const showId = searchParams.get('show_id')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  let query = sb
    .from('expenses')
    .select('id, show_id, category, description, amount, paid, paid_at, notes, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  if (showId) query = query.eq('show_id', showId)

  const { data, error } = await query
  if (error) {
    console.error('[api/expenses GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ expenses: data ?? [] })
}

// ─── POST /api/expenses ───────────────────────────────────────────────────────
// Body: { show_id, category, description?, amount, paid?, notes? }

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  const body = await req.json()
  const { show_id, category, description, amount, paid, notes } = body as {
    show_id: string
    category: ExpenseCategory
    description?: string
    amount: number
    paid?: boolean
    notes?: string
  }

  if (!show_id)  return NextResponse.json({ error: 'show_id é obrigatório' }, { status: 400 })
  if (!amount || amount <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

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

  const { data: expense, error } = await sb
    .from('expenses')
    .insert({
      org_id:      orgId,
      show_id,
      category:    category ?? 'outros',
      description: description ?? null,
      amount,
      paid:        paid ?? false,
      paid_at:     paid ? new Date().toISOString() : null,
      notes:       notes ?? null,
    })
    .select()
    .single()

  if (error) {
    console.error('[api/expenses POST]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logActivity({
    orgId,
    userId: user.id,
    action: 'expense.created',
    entityType: 'show',
    entityId: show_id,
    entityName: show.title,
  })

  return NextResponse.json({ expense })
}
