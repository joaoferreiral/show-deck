import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'

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

// ─── PATCH /api/payments/[id] ─────────────────────────────────────────────────
// Mark as paid, update amount/due_date/description, or unmark payment
// Body: { paid_at?, amount?, due_date?, description? }

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

  // Verify this payment belongs to org
  const { data: existing } = await sb
    .from('show_payments')
    .select('id, show_id, shows(title)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })

  const body = await req.json()
  const { paid_at, amount, due_date, description } = body as {
    paid_at?: string | null
    amount?: number
    due_date?: string
    description?: string | null
  }

  // Build update object with only provided fields
  const updates: Record<string, unknown> = {}
  if ('paid_at' in body)     updates.paid_at     = paid_at
  if ('amount' in body)      updates.amount      = amount
  if ('due_date' in body)    updates.due_date    = due_date
  if ('description' in body) updates.description = description

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { data: updated, error } = await sb
    .from('show_payments')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    console.error('[api/payments/[id] PATCH] error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const showTitle = (existing.shows as { title: string } | null)?.title ?? 'show'
  await logActivity({
    orgId,
    userId: user.id,
    action: paid_at !== undefined ? (paid_at ? 'payment.paid' : 'payment.unpaid') : 'payment.updated',
    entityType: 'show',
    entityId: existing.show_id,
    entityName: showTitle,
  })

  return NextResponse.json({ payment: updated })
}

// ─── DELETE /api/payments/[id] ────────────────────────────────────────────────

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
    .from('show_payments')
    .select('id, show_id, shows(title)')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()

  if (!existing) return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 })

  const { error } = await sb
    .from('show_payments')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) {
    console.error('[api/payments/[id] DELETE] error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const showTitle = (existing.shows as { title: string } | null)?.title ?? 'show'
  await logActivity({
    orgId,
    userId: user.id,
    action: 'payment.deleted',
    entityType: 'show',
    entityId: existing.show_id,
    entityName: showTitle,
  })

  return NextResponse.json({ ok: true })
}
