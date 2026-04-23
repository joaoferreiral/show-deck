'use client'

import { useState, useMemo, useCallback } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { useCalendarShows, useArtists } from '@/lib/hooks/queries'
import { formatCurrency, initials, cn } from '@/lib/utils'
import { SHOW_STATUS_LABELS, SHOW_STATUS_COLORS } from '@/types'
import type { ShowStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, parseISO, addMonths, subMonths,
  addWeeks, subWeeks, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, FileDown,
  CheckSquare, Square, MapPin, Clock,
} from 'lucide-react'
import Link from 'next/link'
import { NewShowButton } from '@/components/shows/new-show-button'

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewMode = 'month' | 'week'
type Pendencia = 'todos' | 'sem_contratante' | 'sem_parceiro' | 'sem_cache'

const ALL_STATUSES: ShowStatus[] = [
  'pre_reserva', 'confirmado', 'contrato_enviado',
  'contrato_assinado', 'realizado', 'cancelado',
]

const PENDENCIA_LABELS: Record<Pendencia, string> = {
  todos: 'Todos os eventos',
  sem_contratante: 'Sem contratante',
  sem_parceiro: 'Sem parceiro local',
  sem_cache: 'Sem cachê',
}

const WEEKDAY_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  selectedStatuses, onToggleStatus,
  pendencia, onPendencia,
  onClose,
}: {
  selectedStatuses: Set<ShowStatus>
  onToggleStatus: (s: ShowStatus) => void
  pendencia: Pendencia
  onPendencia: (p: Pendencia) => void
  onClose: () => void
}) {
  return (
    <div
      className="absolute right-0 top-full mt-1 z-50 w-58 rounded-xl border border-border bg-background shadow-xl p-3 space-y-3"
      onMouseLeave={onClose}
    >
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Status</p>
        {ALL_STATUSES.map((s) => {
          const color = SHOW_STATUS_COLORS[s]
          const checked = selectedStatuses.has(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => onToggleStatus(s)}
              className="flex items-center gap-2.5 w-full py-1.5 px-1 rounded-lg hover:bg-muted/60 transition-colors text-left"
            >
              {checked
                ? <CheckSquare className="h-4 w-4 shrink-0" style={{ color }} />
                : <Square className="h-4 w-4 shrink-0 text-muted-foreground" />}
              <span className="text-sm">{SHOW_STATUS_LABELS[s]}</span>
            </button>
          )
        })}
      </div>
      <div className="border-t border-border pt-2.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Pendências</p>
        {(Object.keys(PENDENCIA_LABELS) as Pendencia[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPendencia(p)}
            className="flex items-center gap-2.5 w-full py-1.5 px-1 rounded-lg hover:bg-muted/60 transition-colors text-left"
          >
            {pendencia === p
              ? <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
              : <Square className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="text-sm">{PENDENCIA_LABELS[p]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const { orgId } = useSession()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewMode>('month')
  const [selectedArtistIds, setSelectedArtistIds] = useState<Set<string>>(new Set())
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ShowStatus>>(new Set(ALL_STATUSES))
  const [pendencia, setPendencia] = useState<Pendencia>('todos')
  const [filterOpen, setFilterOpen] = useState(false)
  const [exporting, setExporting] = useState(false)

  // ── Date range ────────────────────────────────────────────────────────────
  const rangeStart = view === 'month'
    ? startOfMonth(currentDate)
    : startOfWeek(currentDate, { weekStartsOn: 0 })
  const rangeEnd = view === 'month'
    ? endOfMonth(currentDate)
    : endOfWeek(currentDate, { weekStartsOn: 0 })

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangeStart.toISOString(), rangeEnd.toISOString()],
  )

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: shows = [], isLoading: showsLoading } = useCalendarShows(
    orgId, rangeStart.toISOString(), rangeEnd.toISOString(),
  )
  const { data: artistsData, isLoading: artistsLoading } = useArtists(orgId)
  const artists = artistsData?.artists ?? []

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredShows = useMemo(() => shows.filter((show) => {
    if (selectedArtistIds.size > 0 && show.artists && !selectedArtistIds.has(show.artists.id)) return false
    if (!selectedStatuses.has(show.status as ShowStatus)) return false
    if (pendencia === 'sem_contratante' && show.contractor_id != null) return false
    if (pendencia === 'sem_parceiro' && show.local_partner_id != null) return false
    if (pendencia === 'sem_cache' && show.cache_value > 0) return false
    return true
  }), [shows, selectedArtistIds, selectedStatuses, pendencia])

  const showsByDay = useMemo(() => {
    const map: Record<string, typeof filteredShows> = {}
    filteredShows.forEach((show) => {
      const key = format(parseISO(show.start_at), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(show)
    })
    return map
  }, [filteredShows])

  // ── Handlers ──────────────────────────────────────────────────────────────
  function toggleArtist(id: string) {
    setSelectedArtistIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleStatus(s: ShowStatus) {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })
  }

  function goNext() { setCurrentDate((d) => view === 'month' ? addMonths(d, 1) : addWeeks(d, 1)) }
  function goPrev() { setCurrentDate((d) => view === 'month' ? subMonths(d, 1) : subWeeks(d, 1)) }

  const activeFilters =
    (selectedArtistIds.size > 0 ? 1 : 0) +
    (selectedStatuses.size < ALL_STATUSES.length ? 1 : 0) +
    (pendencia !== 'todos' ? 1 : 0)

  const periodLabel = view === 'month'
    ? format(currentDate, 'MMMM / yyyy', { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase())
    : `${format(rangeStart, "d MMM", { locale: ptBR })} – ${format(rangeEnd, "d MMM yyyy", { locale: ptBR })}`

  // ── PDF Export ────────────────────────────────────────────────────────────
  const exportPDF = useCallback(async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()

      // Header
      const artistLabel = selectedArtistIds.size === 0
        ? 'Todos os artistas'
        : artists.filter((a) => selectedArtistIds.has(a.id)).map((a) => a.name).join(', ')

      doc.setFontSize(15)
      doc.setFont('helvetica', 'bold')
      doc.text(artistLabel, 14, 18)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(periodLabel.toUpperCase(), 14, 26)

      // Summary
      const byStatus = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
        acc[s] = filteredShows.filter((sh) => sh.status === s).length
        return acc
      }, {})
      const summaryParts = [`Total de eventos: ${filteredShows.length}`]
      ALL_STATUSES.forEach((s) => { if (byStatus[s] > 0) summaryParts.push(`${SHOW_STATUS_LABELS[s]}: ${byStatus[s]}`) })

      doc.setFontSize(8)
      doc.setTextColor(90, 90, 90)
      doc.text(summaryParts.join('   |   '), 14, 33)
      doc.setTextColor(0, 0, 0)

      // Table body — one row per day, shows stacked
      const tableBody: string[][] = []
      days.forEach((day) => {
        const key = format(day, 'yyyy-MM-dd')
        const dayShows = showsByDay[key] ?? []
        const dayLabel = `${WEEKDAY_SHORT[day.getDay()]}  ${format(day, 'd')}`
        if (dayShows.length === 0) {
          tableBody.push([dayLabel, '', '', '', ''])
        } else {
          dayShows.forEach((show, i) => {
            tableBody.push([
              i === 0 ? dayLabel : '',
              show.venue_name ?? show.city ?? '—',
              show.title + (show.artists ? `\n${show.artists.name}` : ''),
              format(parseISO(show.start_at), 'HH:mm'),
              SHOW_STATUS_LABELS[show.status as ShowStatus],
            ])
          })
        }
      })

      autoTable(doc, {
        head: [['Data', 'Local', 'Nome do evento', 'Hora', 'Status']],
        body: tableBody,
        startY: 38,
        styles: { fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }, overflow: 'linebreak' },
        headStyles: { fillColor: [28, 28, 28], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 18, fontStyle: 'bold', textColor: [40, 40, 40] },
          1: { cellWidth: 42 },
          2: { cellWidth: 74 },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 32 },
        },
        alternateRowStyles: { fillColor: [249, 249, 249] },
        rowPageBreak: 'avoid',
      })

      // Footer
      doc.setFontSize(7)
      doc.setTextColor(130, 130, 130)
      doc.text(`Emitido no dia ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, pageH - 8)
      doc.text('ShowDeck', pageW - 14, pageH - 8, { align: 'right' })

      doc.save(`Agenda_${format(currentDate, 'MM-yyyy')}.pdf`)
    } catch (err) {
      console.error('PDF error:', err)
    }
    setExporting(false)
  }, [days, showsByDay, filteredShows, selectedArtistIds, artists, periodLabel, currentDate])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Artist sidebar ────────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-44 shrink-0 flex-col border-r border-border overflow-y-auto bg-card">
        <div className="px-3 pt-4 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Artistas</p>
        </div>
        <div className="px-2 space-y-1 pb-4">
          {/* TODOS */}
          <button
            type="button"
            onClick={() => setSelectedArtistIds(new Set())}
            className={cn(
              'w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
              selectedArtistIds.size === 0 ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted',
            )}
          >
            <div className="h-7 w-7 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-primary">ALL</span>
            </div>
            <p className="text-xs font-semibold truncate">TODOS ({artists.length})</p>
          </button>

          {/* Per artist */}
          {artistsLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-lg" />)
            : artists.map((artist) => {
                const selected = selectedArtistIds.has(artist.id)
                return (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() => toggleArtist(artist.id)}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                      !selected && 'hover:bg-muted',
                    )}
                    style={selected
                      ? { backgroundColor: `${artist.color}12`, border: `1px solid ${artist.color}50` }
                      : undefined}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      {artist.photo_url && <AvatarImage src={artist.photo_url} alt={artist.name} />}
                      <AvatarFallback
                        style={{ backgroundColor: `${artist.color}25`, color: artist.color }}
                        className="text-[9px] font-bold"
                      >
                        {initials(artist.name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-xs font-medium truncate leading-tight">{artist.name}</p>
                  </button>
                )
              })}
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 flex-wrap bg-background">
          <NewShowButton orgId={orgId} />
          <Button
            variant="outline" size="sm" className="gap-1.5 h-8"
            onClick={exportPDF} disabled={exporting}
          >
            <FileDown className="h-3.5 w-3.5" />
            {exporting ? 'Gerando…' : 'Exportar PDF'}
          </Button>

          <div className="flex-1" />

          {/* Filter */}
          <div className="relative">
            <Button
              variant="outline" size="sm" className="h-8 gap-1.5"
              onClick={() => setFilterOpen((v) => !v)}
            >
              Filtros
              {activeFilters > 0 && (
                <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </Button>
            {filterOpen && (
              <FilterPanel
                selectedStatuses={selectedStatuses}
                onToggleStatus={toggleStatus}
                pendencia={pendencia}
                onPendencia={setPendencia}
                onClose={() => setFilterOpen(false)}
              />
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {(['month', 'week'] as ViewMode[]).map((v) => (
              <Button
                key={v} variant={view === v ? 'default' : 'ghost'}
                size="sm" className="h-7 px-3 text-xs"
                onClick={() => setView(v)}
              >
                {v === 'month' ? 'Mês' : 'Semana'}
              </Button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-8 w-7" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold w-[148px] text-center capitalize select-none">
              {periodLabel}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-7" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid border-b border-border bg-muted/40 shrink-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          style={{ gridTemplateColumns: '76px 1fr 1.4fr 64px 108px' }}>
          {['Data', 'Local', 'Nome do evento', 'Hora', 'Status'].map((h) => (
            <div key={h} className="px-3 py-2">{h}</div>
          ))}
        </div>

        {/* Day rows */}
        <div className="flex-1 overflow-y-auto">
          {showsLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="grid border-b border-border px-3 py-3 gap-3"
                  style={{ gridTemplateColumns: '76px 1fr 1.4fr 64px 108px' }}>
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))
            : days.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const dayShows = showsByDay[key] ?? []
                const weekday = WEEKDAY_SHORT[day.getDay()]
                const dayNum = format(day, 'd')
                const today = isToday(day)

                return (
                  <div
                    key={key}
                    className={cn(
                      'border-b border-border',
                      today && 'bg-primary/[0.035]',
                    )}
                  >
                    {dayShows.length === 0 ? (
                      <div
                        className="grid items-center min-h-[40px] hover:bg-muted/25 transition-colors"
                        style={{ gridTemplateColumns: '76px 1fr 1.4fr 64px 108px' }}
                      >
                        <div className="px-3 py-2 flex items-center gap-1.5">
                          <span className={cn('text-[11px] font-semibold tabular-nums w-8',
                            today ? 'text-primary' : 'text-muted-foreground/60')}>
                            {weekday}
                          </span>
                          <span className={cn('text-sm font-bold',
                            today ? 'text-primary' : 'text-muted-foreground/50')}>
                            {dayNum}
                          </span>
                        </div>
                        <div className="col-span-4" />
                      </div>
                    ) : (
                      dayShows.map((show, i) => {
                        const statusColor = SHOW_STATUS_COLORS[show.status as ShowStatus]
                        return (
                          <Link
                            key={show.id}
                            href={`/agenda/${show.id}`}
                            className="grid items-center min-h-[46px] hover:bg-muted/50 transition-colors"
                            style={{ gridTemplateColumns: '76px 1fr 1.4fr 64px 108px' }}
                          >
                            {/* Date */}
                            <div className="px-3 py-2.5 flex items-center gap-1.5">
                              {i === 0 ? (
                                <>
                                  <span className={cn('text-[11px] font-semibold w-8',
                                    today ? 'text-primary' : 'text-muted-foreground')}>
                                    {weekday}
                                  </span>
                                  <span className={cn('text-sm font-bold',
                                    today ? 'text-primary' : 'text-foreground')}>
                                    {dayNum}
                                  </span>
                                </>
                              ) : (
                                <div className="ml-9 w-0.5 h-4 rounded-full opacity-20"
                                  style={{ backgroundColor: show.artists?.color ?? '#71717a' }} />
                              )}
                            </div>

                            {/* Local */}
                            <div className="px-3 py-2.5 min-w-0">
                              <p className="text-sm text-muted-foreground truncate">
                                {show.venue_name ?? show.city
                                  ? `${show.venue_name ?? show.city}${show.state ? `, ${show.state}` : ''}`
                                  : <span className="italic opacity-40">—</span>}
                              </p>
                            </div>

                            {/* Event name */}
                            <div className="px-3 py-2.5 min-w-0 flex items-center gap-2">
                              {show.artists && (
                                <div className="w-[3px] h-8 rounded-full shrink-0"
                                  style={{ backgroundColor: show.artists.color }} />
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{show.title}</p>
                                {show.artists && (
                                  <p className="text-xs text-muted-foreground truncate">{show.artists.name}</p>
                                )}
                              </div>
                            </div>

                            {/* Time */}
                            <div className="px-3 py-2.5">
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {format(parseISO(show.start_at), 'HH:mm')}
                              </span>
                            </div>

                            {/* Status */}
                            <div className="px-3 py-2.5">
                              <Badge
                                className="text-[10px] whitespace-nowrap"
                                style={{ backgroundColor: `${statusColor}20`, color: statusColor, border: 'none' }}
                              >
                                {SHOW_STATUS_LABELS[show.status as ShowStatus]}
                              </Badge>
                            </div>
                          </Link>
                        )
                      })
                    )}
                  </div>
                )
              })}

          {!showsLoading && filteredShows.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Nenhum show encontrado com os filtros atuais.
            </p>
          )}
        </div>

        {/* Footer summary */}
        <div className="border-t border-border px-4 py-2 shrink-0 flex items-center gap-4 bg-muted/30 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {filteredShows.length} evento{filteredShows.length !== 1 ? 's' : ''}
          </span>
          {ALL_STATUSES.map((s) => {
            const count = filteredShows.filter((sh) => sh.status === s).length
            if (!count) return null
            return (
              <span key={s} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SHOW_STATUS_COLORS[s] }} />
                {SHOW_STATUS_LABELS[s]}: {count}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
