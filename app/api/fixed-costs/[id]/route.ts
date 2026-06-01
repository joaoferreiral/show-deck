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

// ─── PATCH /api/fixed-costs/[id] ─────────────────────────────────────────────
// Body: { description?, amount?, category?, active?, notes? }

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
    .from('fixed_costs')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .single()
  if (!existing) return NextResponse.json({ error: 'Custo não encontrado' }, { status: 404 })

  const body = await req.json()
  const { description, amount, category, active, notes } = body as {
    description?: string
    amount?: number
    category?: string
    active?: boolean
    notes?: string | null
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('description' in body) updates.description = description
  if ('amount'      in body) updates.amount      = amount
  if ('category'    in body) updates.category    = category
  if ('active'      in body) updates.active      = active
  if ('notes'       in body) updates.notes       = notes

  const { data: updated, error } = await sb
    .from('fixed_costs')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    console.error('[api/fixed-costs/[id] PATCH]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fixedCost: updated })
}

// ─── DELETE /api/fixed-costs/[id] ────────────────────────────────────────────

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

  const { error } = await sb
    .from('fixed_costs')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) {
    console.error('[api/fixed-costs/[id] DELETE]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
