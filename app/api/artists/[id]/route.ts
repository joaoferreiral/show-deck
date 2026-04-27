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
  const match = (memberships as any[]).find(m => m.org_id === savedOrgId)
  return (match ?? memberships[0]).org_id as string
}

type Params = { params: Promise<{ id: string }> }

// GET — fetch single artist + shows
export async function GET(_req: Request, { params }: Params) {
  const { id: artistId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const [artistRes, showsRes] = await Promise.all([
    sb
      .from('artists')
      .select('id, name, slug, photo_url, bio, color, base_city, base_state, active, social_links, created_at')
      .eq('id', artistId)
      .eq('org_id', orgId)
      .single(),
    sb
      .from('shows')
      .select('id, title, status, start_at, city, state, venue_name, cache_value')
      .eq('artist_id', artistId)
      .eq('org_id', orgId)
      .order('start_at', { ascending: false })
      .limit(30),
  ])

  if (!artistRes.data) return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 })

  return NextResponse.json({
    artist: artistRes.data,
    shows: showsRes.data ?? [],
  })
}

// PATCH — update artist
export async function PATCH(req: Request, { params }: Params) {
  const { id: artistId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const body = await req.json()
  const { name, slug, bio, base_city, base_state, color, active, photo_url } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const { data: artist, error } = await sb
    .from('artists')
    .update({
      name: name.trim(),
      slug,
      bio: bio || null,
      base_city: base_city || null,
      base_state: base_state || null,
      color,
      active,
      photo_url: photo_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', artistId)
    .eq('org_id', orgId)
    .select()
    .single()

  if (error) {
    console.error('[api/artists/[id]] update error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logActivity({
    orgId,
    userId: user.id,
    action: 'artist.updated',
    entityType: 'artist',
    entityId: artistId,
    entityName: artist.name,
  })

  return NextResponse.json({ artist })
}

// DELETE — remove artist
export async function DELETE(_req: Request, { params }: Params) {
  const { id: artistId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const orgId = await resolveOrgId(user.id)
  if (!orgId) return NextResponse.json({ error: 'Sem organização' }, { status: 403 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  // Fetch name for activity log before deleting
  const { data: artist } = await sb
    .from('artists')
    .select('name')
    .eq('id', artistId)
    .eq('org_id', orgId)
    .single()

  if (!artist) return NextResponse.json({ error: 'Artista não encontrado' }, { status: 404 })

  const { error } = await sb
    .from('artists')
    .delete()
    .eq('id', artistId)
    .eq('org_id', orgId)

  if (error) {
    console.error('[api/artists/[id]] delete error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logActivity({
    orgId,
    userId: user.id,
    action: 'artist.deleted',
    entityType: 'artist',
    entityId: artistId,
    entityName: artist.name,
  })

  return NextResponse.json({ ok: true })
}
