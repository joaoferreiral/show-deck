import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Dashboard Analytics ──────────────────────────────────────────────────────

export type DashboardShow = {
  id: string
  title: string
  status: string
  start_at: string
  cache_value: number
  state: string | null
  city: string | null
  artist_id: string
  contractor_id: string | null
  artists: { id: string; name: string; color: string } | null
}

export function useDashboardAnalytics(orgId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['dashboard-analytics', orgId, from, to],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient() as any
      const { data, error } = await supabase
        .from('shows')
        .select('id, title, status, start_at, cache_value, state, city, artist_id, contractor_id, artists(id, name, color)')
        .eq('org_id', orgId)
        .gte('start_at', from)
        .lte('start_at', to)
        .order('start_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as DashboardShow[]
    },
    staleTime: 30 * 1000,
  })
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useDashboardStats(orgId: string) {
  return useQuery({
    queryKey: ['dashboard-stats', orgId],
    queryFn: async () => {
      const supabase = createClient() as any
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

      const [showsMonth, upcoming, receivables, artists] = await Promise.all([
        supabase
          .from('shows')
          .select('id, status')
          .eq('org_id', orgId)
          .gte('start_at', startOfMonth)
          .lte('start_at', endOfMonth),
        supabase
          .from('shows')
          .select('id, title, status, start_at, city, state, artists(name, color)')
          .eq('org_id', orgId)
          .gte('start_at', now.toISOString())
          .order('start_at', { ascending: true })
          .limit(8),
        supabase
          .from('receivables')
          .select('amount, status')
          .eq('org_id', orgId)
          .in('status', ['pendente', 'parcial', 'atrasado']),
        supabase
          .from('artists')
          .select('id')
          .eq('org_id', orgId)
          .eq('active', true),
      ])

      return {
        showsThisMonth: (showsMonth.data ?? []) as { id: string; status: string }[],
        upcomingShows: (upcoming.data ?? []) as {
          id: string
          title: string
          status: string
          start_at: string
          city: string | null
          state: string | null
          artists: { name: string; color: string } | null
        }[],
        receivables: (receivables.data ?? []) as { amount: number; status: string }[],
        artistsCount: artists.data?.length ?? 0,
      }
    },
    staleTime: 30 * 1000, // 30s
  })
}

// ─── Agenda ───────────────────────────────────────────────────────────────────

export function useShows(orgId: string, status?: string, q?: string) {
  return useQuery({
    queryKey: ['shows', orgId, status, q],
    queryFn: async () => {
      const supabase = createClient() as any
      let query = supabase
        .from('shows')
        .select('id, title, status, start_at, city, state, cache_value, venue_name, artists(name, color)')
        .eq('org_id', orgId)
        .order('start_at', { ascending: false })
        .limit(50)

      if (status) query = query.eq('status', status)
      if (q) query = query.ilike('title', `%${q}%`)

      const { data } = await query
      return (data ?? []) as {
        id: string
        title: string
        status: string
        start_at: string
        city: string | null
        state: string | null
        cache_value: number
        venue_name: string | null
        artists: { name: string; color: string } | null
      }[]
    },
    staleTime: 30 * 1000,
  })
}

// ─── Financeiro ───────────────────────────────────────────────────────────────

export function useFinanceiro(orgId: string) {
  return useQuery({
    queryKey: ['financeiro', orgId],
    queryFn: async () => {
      const supabase = createClient() as any
      const [rec, exp] = await Promise.all([
        supabase
          .from('receivables')
          .select('id, amount, status, due_date, description, shows(title, artists(name))')
          .eq('org_id', orgId)
          .order('due_date', { ascending: true })
          .limit(30),
        supabase
          .from('expenses')
          .select('id, amount, category, description, paid, shows(title)')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      return {
        receivables: (rec.data ?? []) as {
          id: string
          amount: number
          status: string
          due_date: string
          description: string | null
          shows: { title: string; artists: { name: string } | null } | null
        }[],
        expenses: (exp.data ?? []) as {
          id: string
          amount: number
          category: string
          description: string | null
          paid: boolean
          shows: { title: string } | null
        }[],
      }
    },
    staleTime: 30 * 1000,
  })
}

// ─── Artistas ─────────────────────────────────────────────────────────────────

export function useArtists(orgId: string) {
  return useQuery({
    queryKey: ['artists', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient() as any
      const [artists, showCounts] = await Promise.all([
        supabase
          .from('artists')
          .select('id, name, photo_url, bio, color, base_city, base_state, active')
          .eq('org_id', orgId)
          .order('name'),
        supabase
          .from('shows')
          .select('artist_id')
          .eq('org_id', orgId)
          .in('status', ['confirmado', 'contrato_enviado', 'contrato_assinado']),
      ])

      const countByArtist = ((showCounts.data ?? []) as { artist_id: string }[])
        .reduce<Record<string, number>>((acc, s) => {
          acc[s.artist_id] = (acc[s.artist_id] ?? 0) + 1
          return acc
        }, {})

      return {
        artists: (artists.data ?? []) as {
          id: string
          name: string
          photo_url: string | null
          bio: string | null
          color: string
          base_city: string | null
          base_state: string | null
          active: boolean
        }[],
        countByArtist,
      }
    },
    staleTime: 60 * 1000,
  })
}

// ─── Contratantes ─────────────────────────────────────────────────────────────

export type ContractorRow = {
  id: string
  name: string
  cnpj: string | null
  city: string | null
  state: string | null
  notes: string | null
  rating: number | null
  active: boolean
  contact: Record<string, string>
  tags: string[]
  created_at: string
}

export function useContractors(orgId: string) {
  return useQuery({
    queryKey: ['contractors', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const supabase = createClient() as any
      const { data } = await supabase
        .from('contractors')
        .select('id, name, cnpj, city, state, notes, rating, active, contact, tags, created_at')
        .eq('org_id', orgId)
        .order('name')
      return (data ?? []) as ContractorRow[]
    },
    staleTime: 60 * 1000,
  })
}

export function useContractorDetail(orgId: string, contractorId: string) {
  return useQuery({
    queryKey: ['contractor', orgId, contractorId],
    queryFn: async () => {
      const supabase = createClient() as any
      const { data } = await supabase
        .from('contractors')
        .select('id, name, cnpj, city, state, notes, rating, active, contact, tags, created_at')
        .eq('id', contractorId)
        .eq('org_id', orgId)
        .single()
      return (data ?? null) as ContractorRow | null
    },
    staleTime: 30 * 1000,
  })
}

// ─── Artist detail ────────────────────────────────────────────────────────────

export type ArtistDetail = {
  id: string
  name: string
  slug: string
  photo_url: string | null
  bio: string | null
  color: string
  base_city: string | null
  base_state: string | null
  active: boolean
  social_links: Record<string, string>
  created_at: string
}

export type ArtistShowRow = {
  id: string
  title: string
  status: string
  start_at: string
  city: string | null
  state: string | null
  venue_name: string | null
  cache_value: number
}

export function useArtistDetail(orgId: string, artistId: string) {
  return useQuery({
    queryKey: ['artist', orgId, artistId],
    queryFn: async () => {
      const supabase = createClient() as any
      const [artistRes, showsRes] = await Promise.all([
        supabase
          .from('artists')
          .select('id, name, slug, photo_url, bio, color, base_city, base_state, active, social_links, created_at')
          .eq('id', artistId)
          .eq('org_id', orgId)
          .single(),
        supabase
          .from('shows')
          .select('id, title, status, start_at, city, state, venue_name, cache_value')
          .eq('artist_id', artistId)
          .eq('org_id', orgId)
          .order('start_at', { ascending: false })
          .limit(30),
      ])
      if (!artistRes.data) return null
      return {
        artist: artistRes.data as ArtistDetail,
        shows: (showsRes.data ?? []) as ArtistShowRow[],
      }
    },
    staleTime: 30 * 1000,
  })
}

// ─── Show detail ──────────────────────────────────────────────────────────────

export type ShowDetail = {
  id: string
  title: string
  status: string
  start_at: string
  end_at: string | null
  venue_name: string | null
  address: string | null
  city: string | null
  state: string | null
  cache_value: number
  production_value: number
  notes: string | null
  created_at: string
  artist_id: string
  contractor_id: string | null
  artists: {
    id: string
    name: string
    color: string
    photo_url: string | null
  } | null
}

export function useShowDetail(orgId: string, showId: string) {
  return useQuery({
    queryKey: ['show', orgId, showId],
    queryFn: async () => {
      const supabase = createClient() as any
      const { data } = await supabase
        .from('shows')
        .select('id, title, status, start_at, end_at, venue_name, address, city, state, cache_value, production_value, notes, created_at, artist_id, contractor_id, artists(id, name, color, photo_url)')
        .eq('id', showId)
        .eq('org_id', orgId)
        .single()
      return (data ?? null) as ShowDetail | null
    },
    staleTime: 30 * 1000,
  })
}

// ─── Calendário ───────────────────────────────────────────────────────────────

export type CalendarShow = {
  id: string
  title: string
  status: string
  start_at: string
  end_at: string | null
  city: string | null
  state: string | null
  venue_name: string | null
  cache_value: number
  contractor_id: string | null
  local_partner_id: string | null
  artists: { id: string; name: string; color: string; photo_url: string | null } | null
}

export function useCalendarShows(orgId: string, from: string, to: string) {
  const queryClient = useQueryClient()
  const key = ['calendar-shows', orgId, from, to]

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const supabase = createClient() as any
      const { data } = await supabase
        .from('shows')
        .select('id, title, status, start_at, end_at, city, state, venue_name, cache_value, contractor_id, local_partner_id, artists(id, name, color, photo_url)')
        .eq('org_id', orgId)
        .gte('start_at', from)
        .lte('start_at', to)
        .order('start_at', { ascending: true })
      return (data ?? []) as CalendarShow[]
    },
    staleTime: 0,
  })

  // Real-time subscription
  useEffect(() => {
    const supabase = createClient() as any
    const channel = supabase
      .channel(`calendar-${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shows', filter: `org_id=eq.${orgId}` },
        () => { queryClient.invalidateQueries({ queryKey: ['calendar-shows', orgId] }) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orgId, queryClient])

  return query
}
