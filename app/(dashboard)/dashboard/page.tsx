'use client'

import { useMemo, useState } from 'react'
import {
  startOfDay, endOfDay,
  startOfWeek, endOfWeek,
  startOfMonth, endOfMonth,
  format, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  CalendarDays, DollarSign, TrendingUp, Music2,
  MapPin, Users, Building2, Download, Plus,
} from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import Link from 'next/link'

import { useSession } from '@/components/providers/session-provider'
import { useDashboardAnalytics, useArtists, useContractors } from '@/lib/hooks/queries'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { BrazilGeoMap } from '@/components/dashboard/brazil-geo-map'

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPresetRange(period: Period): DateRange {
  const now = new Date()
  if (period === 'today') return { from: startOfDay(now), to: endOfDay(now) }
  if (period === 'week') return { from: startOfWeek(now, { weekStartsOn: 0 }), to: endOfWeek(now, { weekStartsOn: 0 }) }
  return { from: startOfMonth(now), to: endOfMonth(now) }
}

const PREFEITURA_TAGS = ['prefeitura', 'governo', 'municipal', 'estadual', 'federal', 'público', 'publico']

function contractType(tags: string[]): 'prefeitura' | 'privado' {
  if (!tags?.length) return 'privado'
  return tags.map(t => t.toLowerCase()).some(t => PREFEITURA_TAGS.some(k => t.includes(k)))
    ? 'prefeitura' : 'privado'
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accent = '#7c3aed' }: {
  icon: any; label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 flex items-start gap-4">
        <div className="rounded-xl p-2.5 mt-0.5 shrink-0" style={{ backgroundColor: `${accent}18` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold mt-0.5 truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { orgId } = useSession()
  const [period, setPeriod] = useState<Period>('month')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(getPresetRange('month'))
  const [artistFilter, setArtistFilter] = useState<string>('todos')

  // Sync preset buttons → dateRange
  function handlePreset(p: Period) {
    setPeriod(p)
    setDateRange(getPresetRange(p))
  }

  // If user picks a custom range, clear preset selection
  function handleRangeChange(r: DateRange | undefined) {
    setDateRange(r)
    setPeriod('month') // deselect presets visually
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

  // Artist counts (all shows, for sidebar badge)
  const showCountByArtist = useMemo(() => {
    const acc: Record<string, number> = {}
    shows.forEach(s => { acc[s.artist_id] = (acc[s.artist_id] ?? 0) + 1 })
    return acc
  }, [shows])

  // Filtered
  const filtered = useMemo(
    () => artistFilter === 'todos' ? shows : shows.filter(s => s.artist_id === artistFilter),
    [shows, artistFilter],
  )

  // KPIs
  const totalShows = filtered.length
  const cacheTotal = filtered.reduce((a, s) => a + (s.cache_value ?? 0), 0)
  const withCache = filtered.filter(s => s.cache_value > 0)
  const ticketMedio = withCache.length > 0 ? cacheTotal / withCache.length : 0
  const realizados = filtered.filter(s =>
    ['realizado', 'confirmado', 'contrato_assinado'].includes(s.status)
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
    { name: 'Privado', value: contractCounts.privado, color: '#3b82f6' },
    { name: 'Sem contratante', value: contractCounts.sem, color: '#94a3b8' },
  ].filter(d => d.value > 0)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 md:px-6 py-3 border-b flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="ml-auto h-9 w-32" />
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

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-6 py-3 border-b bg-background">
        <h1 className="text-lg font-bold mr-1">Relatório</h1>

        {/* Preset tabs */}
        <div className="flex rounded-lg border bg-muted/30 p-0.5 gap-0.5">
          {(['today', 'week', 'month'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                period === p
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p === 'today' ? 'Hoje' : p === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>

        {/* Airbnb-style range picker */}
        <DateRangePicker
          value={dateRange}
          onChange={handleRangeChange}
          placeholder="Selecione o período"
          className="min-w-[220px]"
        />

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/agenda/novo"
            className="flex items-center gap-1.5 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white px-3 py-1.5 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo show
          </Link>

          <button
            onClick={async () => {
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
            }}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-sm font-semibold transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-4 md:px-6 pt-4 pb-2">
        <KpiCard icon={CalendarDays} label="Total de shows" value={String(totalShows)}
          sub={`${realizados} realizados`} accent="#7c3aed" />
        <KpiCard icon={DollarSign} label="Cachê total" value={formatCurrency(cacheTotal)}
          sub={`${withCache.length} shows c/ cachê`} accent="#10b981" />
        <KpiCard icon={TrendingUp} label="Ticket médio" value={formatCurrency(ticketMedio)}
          sub="por show c/ cachê" accent="#3b82f6" />
        <KpiCard icon={Music2} label="Shows realizados" value={String(realizados)}
          sub={totalShows > 0 ? `${Math.round((realizados / totalShows) * 100)}% do total` : '—'} accent="#f59e0b" />
      </div>

      {/* ── Body: sidebar | center | right ── */}
      <div className="flex gap-4 px-4 md:px-6 pb-6 pt-2 flex-1 min-h-0 overflow-auto">

        {/* LEFT — Artist sidebar */}
        <div className="w-44 shrink-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-2">
            Artistas
          </p>

          {/* TODOS */}
          <button
            onClick={() => setArtistFilter('todos')}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors border ${
              artistFilter === 'todos'
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </span>
            <span className="flex-1 text-left truncate text-xs">TODOS</span>
            <span className="text-[10px] font-bold shrink-0">({shows.length})</span>
          </button>

          {artists.map(a => {
            const count = showCountByArtist[a.id] ?? 0
            const isActive = artistFilter === a.id
            return (
              <button
                key={a.id}
                onClick={() => setArtistFilter(isActive ? 'todos' : a.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  isActive ? 'border-current' : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                style={isActive ? { color: a.color, backgroundColor: `${a.color}15` } : {}}
              >
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarImage src={a.photo_url ?? undefined} />
                  <AvatarFallback
                    className="text-[10px] font-bold text-white"
                    style={{ backgroundColor: a.color }}
                  >
                    {a.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-left truncate text-xs">{a.name}</span>
                <span className="text-[10px] font-bold shrink-0">({count})</span>
              </button>
            )
          })}
        </div>

        {/* CENTER — Map + Cities */}
        <div className="flex-1 min-w-0 space-y-4">
          <Card>
            <CardHeader className="pb-0 pt-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Eventos no Brasil
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <BrazilGeoMap showsByState={byState} primaryColor="#7c3aed" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-0 pt-3 px-4">
              <CardTitle className="text-sm">Cidades</CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {byCities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cidade no período.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left text-xs font-medium text-muted-foreground px-4 pb-1.5">Cidade</th>
                      <th className="text-right text-xs font-medium text-muted-foreground px-4 pb-1.5">Shows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCities.map(({ city, count }, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-1.5 text-xs">{city}</td>
                        <td className="px-4 py-1.5 text-right font-semibold text-xs">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Charts */}
        <div className="w-64 shrink-0 space-y-4">

          {/* Tipo de contrato */}
          <Card>
            <CardHeader className="pb-1 pt-4 px-5">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Tipo de contrato
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              {contractData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sem dados.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={contractData} cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                        paddingAngle={3} dataKey="value">
                        {contractData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-1">
                    {contractData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          {d.name}
                        </span>
                        <span className="font-semibold">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Eventos por estado */}
          <Card>
            <CardHeader className="pb-1 pt-4 px-5">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Eventos por estado
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4">
              {topStates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sem dados.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(100, topStates.length * 26)}>
                  <BarChart data={topStates} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis dataKey="state" type="category" tick={{ fontSize: 11 }} width={26} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Shows" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Shows por artista */}
          {artists.length > 1 && (
            <Card>
              <CardHeader className="pb-1 pt-4 px-5">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Por artista
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                <div className="space-y-2">
                  {artists
                    .map(a => ({ ...a, count: showCountByArtist[a.id] ?? 0 }))
                    .filter(a => a.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .map(a => (
                      <div key={a.id} className="flex items-center gap-2">
                        <Avatar className="w-5 h-5 shrink-0">
                          <AvatarImage src={a.photo_url ?? undefined} />
                          <AvatarFallback className="text-[8px] font-bold text-white" style={{ backgroundColor: a.color }}>
                            {a.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs truncate">{a.name}</span>
                            <span className="text-xs font-bold ml-1">{a.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(a.count / (Math.max(...artists.map(x => showCountByArtist[x.id] ?? 0)) || 1)) * 100}%`,
                                backgroundColor: a.color,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>

    </div>
  )
}
