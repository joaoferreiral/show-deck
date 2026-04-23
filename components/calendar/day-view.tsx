'use client'

import { CalendarShow } from '@/lib/hooks/queries'
import { isSameDay, format, parseISO } from 'date-fns'
import { formatCurrency, initials } from '@/lib/utils'
import { SHOW_STATUS_LABELS, SHOW_STATUS_COLORS } from '@/types'
import type { ShowStatus } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { MapPin, Clock } from 'lucide-react'

interface DayViewProps {
  currentDate: Date
  shows: CalendarShow[]
}

export function DayView({ currentDate, shows }: DayViewProps) {
  const dayShows = shows
    .filter((s) => isSameDay(parseISO(s.start_at), currentDate))
    .sort((a, b) => a.start_at.localeCompare(b.start_at))

  return (
    <div className="p-4 max-w-2xl mx-auto w-full">
      {dayShows.length === 0 ? (
        <div className="py-20 text-center">
          <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum show agendado para este dia.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayShows.map((show) => {
            const statusColor = SHOW_STATUS_COLORS[show.status as ShowStatus]
            const artistColor = show.artists?.color ?? '#71717a'

            return (
              <div
                key={show.id}
                className="flex items-stretch gap-0 rounded-xl border border-border bg-card overflow-hidden"
              >
                {/* Left color stripe */}
                <div className="w-1 shrink-0" style={{ backgroundColor: artistColor }} />

                {/* Content */}
                <div className="flex items-start gap-4 p-4 flex-1 min-w-0">
                  {/* Time */}
                  <div className="text-center shrink-0 pt-0.5 w-12">
                    <p className="text-base font-bold leading-none tabular-nums">
                      {format(parseISO(show.start_at), 'HH:mm')}
                    </p>
                    {show.end_at && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        até {format(parseISO(show.end_at), 'HH:mm')}
                      </p>
                    )}
                  </div>

                  {/* Artist avatar */}
                  {show.artists && (
                    <Avatar className="h-10 w-10 shrink-0">
                      {show.artists.photo_url && (
                        <AvatarImage src={show.artists.photo_url} alt={show.artists.name} />
                      )}
                      <AvatarFallback
                        style={{ backgroundColor: `${artistColor}20`, color: artistColor }}
                        className="text-xs font-bold"
                      >
                        {initials(show.artists.name)}
                      </AvatarFallback>
                    </Avatar>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-tight">{show.title}</p>
                      <Badge
                        className="text-[10px] shrink-0"
                        style={{
                          backgroundColor: `${statusColor}20`,
                          color: statusColor,
                          border: 'none',
                        }}
                      >
                        {SHOW_STATUS_LABELS[show.status as ShowStatus]}
                      </Badge>
                    </div>

                    {show.artists?.name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{show.artists.name}</p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                      {(show.venue_name || show.city) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {show.venue_name ?? show.city}
                          {show.state ? `, ${show.state}` : ''}
                        </span>
                      )}
                      {show.cache_value > 0 && (
                        <span className="font-medium text-foreground">
                          {formatCurrency(show.cache_value)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
