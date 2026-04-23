'use client'

import { CalendarShow } from '@/lib/hooks/queries'
import {
  startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
  isToday, format, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { SHOW_STATUS_LABELS, SHOW_STATUS_COLORS } from '@/types'
import type { ShowStatus } from '@/types'

interface WeekViewProps {
  currentDate: Date
  shows: CalendarShow[]
  onShowClick?: (show: CalendarShow) => void
}

export function WeekView({ currentDate, shows, onShowClick }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const showsForDay = (day: Date) =>
    shows
      .filter((s) => isSameDay(parseISO(s.start_at), day))
      .sort((a, b) => a.start_at.localeCompare(b.start_at))

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 shrink-0 sticky top-0 z-10">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className="py-3 text-center border-r border-border last:border-0"
          >
            <p className="text-xs text-muted-foreground capitalize">
              {format(day, 'EEE', { locale: ptBR })}
            </p>
            <p
              className={cn(
                'text-sm font-semibold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full mx-auto',
                isToday(day) ? 'bg-primary text-primary-foreground' : '',
              )}
            >
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div className="flex-1 grid grid-cols-7 overflow-y-auto">
        {days.map((day) => {
          const dayShows = showsForDay(day)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'border-r border-border last:border-0 p-1.5 space-y-1.5 min-h-full',
                isToday(day) && 'bg-primary/5',
              )}
            >
              {dayShows.length === 0 && (
                <div className="flex items-start justify-center pt-6">
                  <p className="text-xs text-muted-foreground/25 select-none">·</p>
                </div>
              )}
              {dayShows.map((show) => {
                const statusColor = SHOW_STATUS_COLORS[show.status as ShowStatus]
                return (
                  <div
                    key={show.id}
                    onClick={() => onShowClick?.(show)}
                    className="rounded-lg p-2 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: `${show.artists?.color ?? '#71717a'}15`,
                      borderLeft: `3px solid ${show.artists?.color ?? '#71717a'}`,
                    }}
                  >
                    {show.artists?.photo_url && (
                      <img
                        src={show.artists.photo_url}
                        alt={show.artists.name}
                        className="w-6 h-6 rounded-full object-cover mb-1"
                      />
                    )}
                    <p
                      className="text-[11px] font-semibold truncate leading-tight"
                      style={{ color: show.artists?.color ?? '#71717a' }}
                    >
                      {show.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(parseISO(show.start_at), 'HH:mm')}
                    </p>
                    {show.artists?.name && (
                      <p className="text-[10px] text-muted-foreground truncate">{show.artists.name}</p>
                    )}
                    {show.venue_name && (
                      <p className="text-[10px] text-muted-foreground truncate">{show.venue_name}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
