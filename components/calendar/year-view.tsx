'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  startOfYear, endOfYear,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval, eachMonthOfInterval,
  isSameMonth, isSameDay, isToday,
  format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { SHOW_STATUS_COLORS } from '@/types'
import type { CalendarShow } from '@/lib/hooks/queries'
import type { ShowStatus } from '@/types'

const DAY_HEADERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

interface Props {
  year: number
  shows: CalendarShow[]
  onDayClick?: (date: Date) => void
}

// ─── Single mini month ────────────────────────────────────────────────────────

function MiniMonth({
  monthDate,
  shows,
  onDayClick,
}: {
  monthDate: Date
  shows: CalendarShow[]
  onDayClick?: (d: Date) => void
}) {
  const monthStart = startOfMonth(monthDate)
  const monthEnd   = endOfMonth(monthDate)

  // Grid: pad to fill full weeks
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd   = endOfWeek(monthEnd,   { weekStartsOn: 0 })
  const days      = eachDayOfInterval({ start: gridStart, end: gridEnd })

  // Index shows by day key
  const showsByDay = useMemo(() => {
    const map: Record<string, CalendarShow[]> = {}
    shows.forEach(s => {
      const key = format(new Date(s.start_at), 'yyyy-MM-dd')
      ;(map[key] ??= []).push(s)
    })
    return map
  }, [shows])

  // Shows for this month (for the list below)
  const monthShows = useMemo(
    () => shows
      .filter(s => {
        const d = new Date(s.start_at)
        return d >= monthStart && d <= monthEnd
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [shows, monthStart, monthEnd],
  )

  return (
    <div className="flex flex-col h-full rounded-xl border border-border bg-card overflow-hidden">
      {/* Month label */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/70">
          {format(monthDate, 'MMMM', { locale: ptBR })}
        </h3>
        {monthShows.length > 0 && (
          <span className="rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-semibold">
            {monthShows.length}
          </span>
        )}
      </div>

      {/* Mini calendar grid */}
      <div className="px-2 shrink-0">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 mb-0.5">
          {DAY_HEADERS.map((d, i) => (
            <div
              key={i}
              className="flex items-center justify-center py-0.5 text-[9px] font-semibold text-muted-foreground/60 select-none"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const key      = format(day, 'yyyy-MM-dd')
            const dayShows = showsByDay[key] ?? []
            const inMonth  = isSameMonth(day, monthDate)
            const today    = isToday(day)

            return (
              <button
                key={idx}
                onClick={() => inMonth && onDayClick?.(day)}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-0.5 rounded-md transition-colors min-h-[30px]',
                  inMonth ? 'hover:bg-muted/60 cursor-pointer' : 'cursor-default pointer-events-none',
                  !inMonth && 'invisible',
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium leading-none select-none',
                    today ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground',
                  )}
                >
                  {format(day, 'd')}
                </span>

                {dayShows.length > 0 && (
                  <div className="flex items-center justify-center gap-0.5">
                    {dayShows.slice(0, 3).map((s, i) => (
                      <span
                        key={i}
                        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: s.artists?.color
                            ?? SHOW_STATUS_COLORS[s.status as ShowStatus]
                            ?? '#7c3aed',
                        }}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-border/50 my-2 shrink-0" />

      {/* Shows list — scrollable, fills remaining space */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
        {monthShows.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/40 text-center py-3 italic">
            Sem shows
          </p>
        ) : (
          <div className="space-y-0.5">
            {monthShows.map(show => {
              const color       = show.artists?.color ?? SHOW_STATUS_COLORS[show.status as ShowStatus] ?? '#7c3aed'
              const statusColor = SHOW_STATUS_COLORS[show.status as ShowStatus] ?? '#6b7280'
              return (
                <Link
                  key={show.id}
                  href={`/agenda/${show.id}`}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted/50 transition-colors group"
                >
                  <span className="w-1 h-5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-4 shrink-0">
                    {format(new Date(show.start_at), 'd')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold truncate group-hover:text-primary transition-colors leading-tight">
                      {show.title}
                    </p>
                    {show.artists?.name && (
                      <p className="text-[9px] text-muted-foreground truncate leading-tight">
                        {show.artists.name}{show.city ? ` · ${show.city}` : ''}
                      </p>
                    )}
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Year view ────────────────────────────────────────────────────────────────

export function YearView({ year, shows, onDayClick }: Props) {
  const months = useMemo(() => {
    const yearDate = new Date(year, 0, 1)
    return eachMonthOfInterval({
      start: startOfYear(yearDate),
      end:   endOfYear(yearDate),
    })
  }, [year])

  // Index shows by month for fast lookup
  const showsByMonth = useMemo(() => {
    const map: Record<number, CalendarShow[]> = {}
    shows.forEach(s => {
      const m = new Date(s.start_at).getMonth()
      ;(map[m] ??= []).push(s)
    })
    return map
  }, [shows])

  const totalShows = shows.length

  return (
    <div className="h-full overflow-y-auto">
      {/* Year summary bar */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 md:px-6 py-2.5 border-b border-border bg-background/95 backdrop-blur-sm shrink-0">
        <span className="text-xs font-bold text-muted-foreground">{year}</span>
        {totalShows > 0 ? (
          <span className="text-xs text-muted-foreground">
            {totalShows} show{totalShows !== 1 ? 's' : ''} no ano
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50 italic">Nenhum show cadastrado</span>
        )}
      </div>

      {/* 12 months grid — each cell is the same height via grid rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-fr gap-4 p-4 md:p-6">
        {months.map((monthDate) => (
          <MiniMonth
            key={monthDate.getMonth()}
            monthDate={monthDate}
            shows={showsByMonth[monthDate.getMonth()] ?? []}
            onDayClick={onDayClick}
          />
        ))}
      </div>
    </div>
  )
}
