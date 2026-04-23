'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  CalendarDays, DollarSign, TrendingUp,
  MapPin, Users, Building2, Download, Plus, CheckCircle2,
  Maximize2, Minimize2,
} from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import Link from 'next/link'
import { cn } from '@/lib/utils'

import { useSession } from '@/components/providers/session-provider'
import { useDashboardAnalytics, useArtists, useContractors } from '@/lib/hooks/queries'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { BrazilGeoMap } from '@/components/dashboard/brazil-geo-map'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPresetRange(period: Period): DateRange {
  const now = new Date()
  if (period === 'today') return { from: startOfDay(now), to: endOfDay(now) }
  if (period === 'week')  return { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfWeek(now, { weekStartsOn: 0 }) }
  return { from: startOfMonth(now), to: endOfMonth(now) }
}

const PREFEITURA_TAGS = ['prefeitura', 'governo', 'municipal', 'estadual', 'federal', 'público', 'publico']
function contractType(tags: string[]): 'prefeitura' | 'privado' {
  if (!tags?.length) return 'privado'
  return tags.map(t => t.toLowerCase()).some(t => PREFEITURA_TAGS.some(k => t.includes(k)))
    ? 'prefeitura' : 'privado'
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, accent = '#7c3aed',
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight mt-1 tabular-nums truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="rounded-lg p-2 shrink-0 mt-0.5" style={{ backgroundColor: `${accent}15` }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Recharts Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-lg">
      {label && <p className="font-medium mb-1 text-foreground">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Artist filter button ──────────────────────────────────────────────────────

function ArtistBtn({
  isActive, onClick, avatar, name, count, color,
}: {
  isActive: boolean; onClick: () => void
  avatar?: string | null; name: string; count: number; color?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all duration-100',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
      style={isActive && color ? { backgroundColor: `${color}15`, color } : {}}
    >
      {/* Active bar */}
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ backgroundColor: color ?? 'hsl(var(--primary))' }}
        />
      )}

      {avatar !== undefined ? (
        <Avatar className="w-6 h-6 shrink-0">
          <AvatarImage src={avatar ?? undefined} />
          <AvatarFallback
            className="text-[9px] font-bold text-white"
            style={{ backgroundColor: color ?? 'hsl(var(--primary))' }}
          >
            {name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
          isActive ? 'bg-primary/20' : 'bg-muted',
        )}>
          <Users className="w-3 h-3" />
        </div>
      )}

      <span className="flex-1 text-left truncate text-xs font-medium">{name}</span>
      <span className={cn(
        'shrink-0 text-[10px] font-semibold rounded-full px-1.5 py-0.5 transition-colors',
        isActive ? 'bg-white/20' : 'bg-muted text-muted-foreground',
      )}>
        {count}
      </span>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { orgId } = useSession()
  const [period, setPeriod] = useState<Period>('month')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getPresetRange('month'))
  const [artistFilter, setArtistFilter] = useState<string>('todos')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  function handlePreset(p: Period) {
    setPeriod(p)
    setDateRange(getPresetRange(p))
  }
  function handleRangeChange(r: DateRange | undefined) {
    setDateRange(r)
    setPeriod('month')
  }

  const from = dateRange?.from ? startOfDay(dateRange.from).toISOString() : startOfMonth(new Date()).toISOString()
  const to   = dateRange?.to   ? endOfDay(dateRange.to).toISOString()     : endOfMonth(new Date()).toISOString()

  const { data: shows = [], isLoading } = useDashboardAnalytics(orgId, from, to)
  const { data: artistsData } = useArtists(orgId)
  const { data: contractors = [] } = useContractors(orgId)
  const artists = artistsData?.artists ?? []

  const contractorTagsMap = useMemo(
    () => Object.fromEntries(contractors.map(c => [c.id, c.tags ?? []])),
    [contractors],
  )

  const showCountByArtist = useMemo(() => {
    const acc: Record<string, number> = {}
    shows.forEach(s => { acc[s.artist_id] = (acc[s.artist_id] ?? 0) + 1 })
    return acc
  }, [shows])

  const filtered = useMemo(
    () => artistFilter === 'todos' ? shows : shows.filter(s => s.artist_id === artistFilter),
    [shows, artistFilter],
  )

  // KPIs
  const totalShows  = filtered.length
  const cacheTotal  = filtered.reduce((a, s) => a + (s.cache_value ?? 0), 0)
  const withCache   = filtered.filter(s => s.cache_value > 0)
  const ticketMedio = withCache.length > 0 ? cacheTotal / withCache.length : 0
  const realizados  = filtered.filter(s =>
    ['realizado', 'confirmado', 'contrato_assinado'].includes(s.status),
  ).length

  // By state
  const byState = useMemo(() => {
    const acc: Record<string, number> = {}
    filtered.forEach(s => { if (s.state) acc[s.state] = (acc[s.state] ?? 0) + 1 })
    return acc
  }, [filtered])

  const topStates = useMemo(
    () => Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([state, count]) => ({ state, count })),
    [byState],
  )

  // By city
  const byCities = useMemo(() => {
    const acc: Record<string, number> = {}
    filtered.forEach(s => {
      if (!s.city) return
      const key = s.state ? `${s.city} – ${s.state}` : s.city
      acc[key] = (acc[key] ?? 0) + 1
    })
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([city, count]) => ({ city, count }))
  }, [filtered])

  const maxCityCount = byCities[0]?.count ?? 1

  // Contract type
  const contractCounts = useMemo(() => {
    let prefeitura = 0, privado = 0, sem = 0
    filtered.forEach(s => {
      if (!s.contractor_id) { sem++; return }
      const tags = contractorTagsMap[s.contractor_id] ?? []
      if (contractType(tags) === 'prefeitura') prefeitura++; else privado++
    })
    return { prefeitura, privado, sem }
  }, [filtered, contractorTagsMap])

  const contractData = [
    { name: 'Prefeitura / Gov.', value: contractCounts.prefeitura, color: '#7c3aed' },
    { name: 'Privado',           value: contractCounts.privado,    color: '#3b82f6' },
    { name: 'Sem contratante',   value: contractCounts.sem,        color: '#94a3b8' },
  ].filter(d => d.value > 0)

  // Export PDF
  async function handleExport() {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Relatório de Shows', 14, 18)
    doc.setFontSize(10)
    doc.text(`Total: ${totalShows} | Cachê: ${formatCurrency(cacheTotal)} | Ticket médio: ${formatCurrency(ticketMedio)}`, 14, 26)
    autoTable(doc, {
      startY: 34,
      head: [['Data', 'Artista', 'Cidade – Estado', 'Status', 'Cachê']],
      body: filtered.map(s => [
        format(new Date(s.start_at), 'dd/MM/yyyy', { locale: ptBR }),
        s.artists?.name ?? '—',
        s.city ? `${s.city}${s.state ? ` – ${s.state}` : ''}` : '—',
        s.status,
        s.cache_value > 0 ? formatCurrency(s.cache_value) : '—',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [124, 58, 237] },
    })
    doc.save(`relatorio-${format(new Date(), 'yyyy-MM-dd')}.pdf`)
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 md:px-6 py-3 border-b flex items-center gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="ml-auto h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4 md:px-6 pt-4 pb-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="flex gap-4 px-4 md:px-6 pb-6 pt-2 flex-1">
          <Skeleton className="w-44 rounded-xl shrink-0" />
          <Skeleton className="flex-1 rounded-xl" />
          <Skeleton className="w-64 rounded-xl shrink-0" />
        </div>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full min-h-0 bg-background"
      style={isFullscreen ? { height: '100vh' } : undefined}
    >

      {/* ── Controls bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-2.5 border-b bg-background/95 backdrop-blur-sm shrink-0">

        {/* Period presets */}
        <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 gap-0.5">
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-100',
                period === p
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        <DateRangePicker
          value={dateRange}
          onChange={handleRangeChange}
          placeholder="Período personalizado"
          className="min-w-[210px] h-8 text-xs"
        />

        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="outline" className="gap-1.5 h-8">
            <Link href="/agenda/novo">
              <Plus className="w-3.5 h-3.5" />
              Novo show
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} className="gap-1.5 h-8">
            <Download className="w-3.5 h-3.5" />
            Exportar
          </Button>
          <Button size="sm" variant="outline" onClick={toggleFullscreen} className="h-8 w-8 p-0" title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 md:px-6 pt-4 pb-2 shrink-0">
        <KpiCard
          icon={CalendarDays} label="Total de shows" value={String(totalShows)}
          sub={`${realizados} realizados`} accent="#7c3aed"
        />
        <KpiCard
          icon={DollarSign} label="Cachê total" value={formatCurrency(cacheTotal)}
          sub={`${withCache.length} shows com cachê`} accent="#10b981"
        />
        <KpiCard
          icon={TrendingUp} label="Ticket médio" value={formatCurrency(ticketMedio)}
          sub="por show com cachê" accent="#3b82f6"
        />
        <KpiCard
          icon={CheckCircle2} label="Realizados" value={String(realizados)}
          sub={totalShows > 0 ? `${Math.round((realizados / totalShows) * 100)}% do total` : '—'}
          accent="#f59e0b"
        />
      </div>

      {/* ── Main body ─────────────────────────────────────────────────────── */}
      <div className="flex gap-4 px-4 md:px-6 pb-6 pt-2 flex-1 min-h-0 overflow-auto">

        {/* ── LEFT: Artist filter ─────────────────────────────────────────── */}
        <div className="w-44 shrink-0 flex flex-col gap-1">
          <p className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest uppercase px-2.5 pb-1">
            Filtrar
          </p>

          <ArtistBtn
            isActive={artistFilter === 'todos'}
            onClick={() => setArtistFilter('todos')}
            avatar={undefined}
            name="Todos"
            count={shows.length}
          />

          {artists.map(a => (
            <ArtistBtn
              key={a.id}
              isActive={artistFilter === a.id}
              onClick={() => setArtistFilter(artistFilter === a.id ? 'todos' : a.id)}
              avatar={a.photo_url}
              name={a.name}
              count={showCountByArtist[a.id] ?? 0}
              color={a.color}
            />
          ))}
        </div>

        {/* ── CENTER: Map + Cities ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Map card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-0 pt-4 px-4 flex flex-row items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <MapPin className="w-3.5 h-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">Eventos no Brasil</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-2 pt-0 flex justify-center">
              <div className="w-full max-w-[260px]">
                <BrazilGeoMap showsByState={byState} primaryColor="#7c3aed" />
              </div>
            </CardContent>
          </Card>

          {/* Cities card */}
          <Card>
            <CardHeader className="pb-0 pt-4 px-4 flex flex-row items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <MapPin className="w-3.5 h-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">Cidades</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-1 pt-3">
              {byCities.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 italic">
                  Nenhuma cidade no período selecionado.
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {byCities.map(({ city, count }, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 transition-colors">
                      <span className="text-xs text-muted-foreground w-4 font-mono shrink-0">{i + 1}</span>
                      <span className="flex-1 text-xs font-medium truncate">{city}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/50 transition-all"
                            style={{ width: `${(count / maxCityCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold w-4 text-right tabular-nums">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Charts ───────────────────────────────────────────────── */}
        <div className="w-64 shrink-0 space-y-3">

          {/* Tipo de contrato */}
          <Card>
            <CardHeader className="pb-0 pt-4 px-4 flex flex-row items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <Building2 className="w-3.5 h-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">Tipo de contrato</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-2">
              {contractData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 italic">Sem dados.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie
                        data={contractData} cx="50%" cy="50%"
                        innerRadius={36} outerRadius={55}
                        paddingAngle={3} dataKey="value"
                      >
                        {contractData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <RechartsTooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-1">
                    {contractData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                        <span className="text-xs font-bold tabular-nums">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Eventos por estado */}
          <Card>
            <CardHeader className="pb-0 pt-4 px-4 flex flex-row items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                <MapPin className="w-3.5 h-3.5 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold">Por estado</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4 pt-2">
              {topStates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 italic">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(100, topStates.length * 26)}>
                  <BarChart data={topStates} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                    <YAxis dataKey="state" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={26} />
                    <RechartsTooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Shows" fill="hsl(var(--primary))" fillOpacity={0.8} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Por artista */}
          {artists.length > 1 && (
            <Card>
              <CardHeader className="pb-0 pt-4 px-4 flex flex-row items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                  <Users className="w-3.5 h-3.5 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">Por artista</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-3">
                <div className="space-y-3">
                  {artists
                    .map(a => ({ ...a, count: showCountByArtist[a.id] ?? 0 }))
                    .filter(a => a.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .map(a => {
                      const maxCount = Math.max(...artists.map(x => showCountByArtist[x.id] ?? 0)) || 1
                      return (
                        <div key={a.id} className="flex items-center gap-2">
                          <Avatar className="w-5 h-5 shrink-0">
                            <AvatarImage src={a.photo_url ?? undefined} />
                            <AvatarFallback className="text-[8px] font-bold text-white" style={{ backgroundColor: a.color }}>
                              {a.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium truncate">{a.name}</span>
                              <span className="text-xs font-bold tabular-nums ml-1">{a.count}</span>
                            </div>
                            <div className="h-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${(a.count / maxCount) * 100}%`,
                                  backgroundColor: a.color,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  )
}
