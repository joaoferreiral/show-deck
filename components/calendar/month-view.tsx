'use client'

import { CalendarShow } from '@/lib/hooks/queries'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, isToday,
  format, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface MonthViewProps {
  currentDate: Date
  shows: CalendarShow[]
  onDayClick: (date: Date) => void
}

export function MonthView({ currentDate, shows, onDayClick }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const showsForDay = (day: Date) =>
    shows
      .filter((s) => isSameDay(parseISO(s.start_at), day))
      .sort((a, b) => a.start_at.localeCompare(b.start_at))

  return (
    <div className="flex flex-col h-full">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 shrink-0">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid — 6 rows max */}
      <div
        className="flex-1 grid grid-cols-7"
        style={{ gridTemplateRows: `repeat(${Math.ceil(days.length / 7)}, minmax(80px, 1fr))` }}
      >
        {days.map((day) => {
          const dayShows = showsForDay(day)
          const inMonth = isSameMonth(day, currentDate)
          const today = isToday(day)

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                'border-r border-b border-border p-1 cursor-pointer hover:bg-muted/30 transition-colors overflow-hidden',
                !inMonth && 'opacity-40 bg-muted/10',
              )}
            >
              {/* Day number */}
              <div className="flex items-center justify-end mb-1">
                <span
                  className={cn(
                    'w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full',
                    today ? 'bg-primary text-primary-foreground' : 'text-foreground',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Show pills */}
              <div className="space-y-0.5">
                {dayShows.slice(0, 3).map((show) => (
                  <div
                    key={show.id}
                    className="flex items-center gap-1 rounded px-1 py-0.5 truncate"
                    style={{
                      backgroundColor: `${show.artists?.color ?? '#71717a'}22`,
                      color: show.artists?.color ?? '#71717a',
                    }}
                  >
                    {show.artists?.photo_url ? (
                      <img
                        src={show.artists.photo_url}
                        alt=""
                        className="w-3 h-3 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span
                        className="w-2 h-2 rounded-full shrink-0 inline-block"
                        style={{ backgroundColor: show.artists?.color ?? '#71717a' }}
                      />
                    )}
                    <span className="text-[10px] font-medium truncate leading-tight">
                      {show.title}
                    </span>
                  </div>
                ))}
                {dayShows.length > 3 && (
                  <p className="text-[10px] text-muted-foreground px-1">
                    +{dayShows.length - 3} mais
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
