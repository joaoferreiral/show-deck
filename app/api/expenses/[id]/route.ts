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

// ─── PATCH /api/expenses/[id] ─────────────────────────────────────────────────
// Body: { category?, description?, amount?, paid?, notes? }

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const { data: existing } = await sb
    .from('expenses')
    .select('id, show_id, shows(title)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })

  const body = await req.json()
  const { category, description, amount, paid, notes } = body as {
    category?: ExpenseCategory
    description?: string | null
    amount?: number
    paid?: boolean
    notes?: string | null
  }

  const updates: Record<string, unknown> = {}
  if ('category' in body)    updates.category    = category
  if ('description' in body) updates.description = description
  if ('amount' in body)      updates.amount      = amount
  if ('notes' in body)       updates.notes       = notes
  if ('paid' in body) {
    updates.paid    = paid
    updates.paid_at = paid ? new Date().toISOString() : null
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { data: updated, error } = await sb
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    console.error('[api/expenses/[id] PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const showTitle = (existing.shows as { title: string } | null)?.title ?? 'show'
  await logActivity({
    orgId,
    userId: user.id,
    action: 'expense.updated',
    entityType: 'show',
    entityId: existing.show_id,
    entityName: showTitle,
  })

  return NextResponse.json({ expense: updated })
}

// ─── DELETE /api/expenses/[id] ────────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const { data: existing } = await sb
    .from('expenses')
    .select('id, show_id, shows(title)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Despesa não encontrada' }, { status: 404 })

  const { error } = await sb
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) {
    console.error('[api/expenses/[id] DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const showTitle = (existing.shows as { title: string } | null)?.title ?? 'show'
  await logActivity({
    orgId,
    userId: user.id,
    action: 'expense.deleted',
    entityType: 'show',
    entityId: existing.show_id,
    entityName: showTitle,
  })

  return NextResponse.json({ ok: true })
}
