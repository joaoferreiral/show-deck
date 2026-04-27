import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logActivity } from '@/lib/activity'

// Helper: resolve active org for the current user
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
  const match = (memberships as any[]).find(m => m.org_id === savedOrgId)
  return (match ?? memberships[0]).org_id as string
}

// GET — list artists for the active org
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ artists: [], shows: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const [artistsRes, showsRes] = await Promise.all([
    sb
      .from('artists')
      .select('id, name, photo_url, bio, color, base_city, base_state, active')
      .eq('org_id', orgId)
      .order('name'),
    sb
      .from('shows')
      .select('artist_id')
      .eq('org_id', orgId)
      .in('status', ['confirmado', 'contrato_enviado', 'contrato_assinado']),
  ])

  return NextResponse.json({
    artists: artistsRes.data ?? [],
    shows: showsRes.data ?? [],
  })
}

// POST — create artist
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const body = await req.json()
  const { name, slug, bio, base_city, base_state, color, photo_url, social_links, contact } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const { data: artist, error } = await sb
    .from('artists')
    .insert({
      org_id: orgId,
      name: name.trim(),
      slug,
      bio: bio || null,
      base_city: base_city || null,
      base_state: base_state || null,
      color: color ?? '#7c3aed',
      photo_url: photo_url ?? null,
      active: true,
      social_links: social_links ?? {},
      contact: contact ?? {},
    })
    .select()
    .single()

  if (error) {
    console.error('[api/artists] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logActivity({
    orgId,
    userId: user.id,
    action: 'artist.created',
    entityType: 'artist',
    entityId: artist.id,
    entityName: artist.name,
  })

  return NextResponse.json({ artist })
}
