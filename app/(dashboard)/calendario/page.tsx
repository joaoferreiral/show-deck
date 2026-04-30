'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { useCalendarShows } from '@/lib/hooks/queries'
import { Button } from '@/components/ui/button'
import { MonthView } from '@/components/calendar/month-view'
import { WeekView } from '@/components/calendar/week-view'
import { DayView } from '@/components/calendar/day-view'
import { YearView } from '@/components/calendar/year-view'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, LayoutGrid, CalendarDays, AlignJustify, CalendarRange } from 'lucide-react'
import {
  format,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  startOfDay, endOfDay,
  startOfYear, endOfYear,
  addMonths, subMonths,
  addWeeks, subWeeks,
  addDays, subDays,
  addYears, subYears,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

type CalendarView = 'year' | 'month' | 'week' | 'day'

const VIEWS: { v: CalendarView; icon: React.ElementType; label: string }[] = [
  { v: 'year',  icon: CalendarRange, label: 'Ano'     },
  { v: 'month', icon: LayoutGrid,    label: 'Mês'     },
  { v: 'week',  icon: CalendarDays,  label: 'Semana'  },
  { v: 'day',   icon: AlignJustify,  label: 'Dia'     },
]

export default function CalendarioPage() {
  const { orgId } = useSession()
  const [view, setView]               = useState<CalendarView>('year')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // ─── Date range for query ─────────────────────────────────────────────────
  const from = (() => {
    if (view === 'year')  return startOfYear(currentDate).toISOString()
    if (view === 'month') return startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 }).toISOString()
    if (view === 'week')  return startOfWeek(currentDate, { weekStartsOn: 0 }).toISOString()
    return startOfDay(currentDate).toISOString()
  })()

  const to = (() => {
    if (view === 'year')  return endOfYear(currentDate).toISOString()
    if (view === 'month') return endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 }).toISOString()
    if (view === 'week')  return endOfWeek(currentDate, { weekStartsOn: 0 }).toISOString()
    return endOfDay(currentDate).toISOString()
  })()

  const { data: shows = [] } = useCalendarShows(orgId, from, to)

  // ─── Fullscreen ───────────────────────────────────────────────────────────
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

  // ─── Navigation ──────────────────────────────────────────────────────────
  function goNext() {
    if (view === 'year')  setCurrentDate(d => addYears(d, 1))
    else if (view === 'month') setCurrentDate(d => addMonths(d, 1))
    else if (view === 'week')  setCurrentDate(d => addWeeks(d, 1))
    else                       setCurrentDate(d => addDays(d, 1))
  }
  function goPrev() {
    if (view === 'year')  setCurrentDate(d => subYears(d, 1))
    else if (view === 'month') setCurrentDate(d => subMonths(d, 1))
    else if (view === 'week')  setCurrentDate(d => subWeeks(d, 1))
    else                       setCurrentDate(d => subDays(d, 1))
  }

  // ─── Header title ─────────────────────────────────────────────────────────
  const title = (() => {
    if (view === 'year')  return format(currentDate, 'yyyy')
    if (view === 'month') return format(currentDate, 'MMMM yyyy', { locale: ptBR })
    if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      const end   = endOfWeek(currentDate,   { weekStartsOn: 0 })
      return `${format(start, "d 'de' MMM", { locale: ptBR })} – ${format(end, "d 'de' MMM yyyy", { locale: ptBR })}`
    }
    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })
  })()

  // When clicking a day in year view → go to day view
  function handleYearDayClick(date: Date) {
    setCurrentDate(date)
    setView('day')
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full bg-background"
      style={isFullscreen ? { height: '100vh' } : undefined}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0 flex-wrap bg-background">
        {/* Prev / Today / Next */}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goPrev} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoje
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goNext} aria-label="Próximo">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Period title */}
        <h2 className="text-sm font-semibold capitalize flex-1 truncate select-none">
          {title}
        </h2>

        {/* View selector */}
        <div className="flex items-center gap-0.5 bg-muted rounded-lg p-1">
          {VIEWS.map(({ v, icon: Icon, label }) => (
            <Button
              key={v}
              variant={view === v ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs gap-1.5"
              onClick={() => setView(v)}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          ))}
        </div>

        {/* Fullscreen toggle */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          aria-label={isFullscreen ? 'Sair da tela cheia' : 'Entrar em tela cheia'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* ── Calendar body ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {view === 'year' && (
          <YearView
            year={currentDate.getFullYear()}
            shows={shows}
            onDayClick={handleYearDayClick}
          />
        )}
        {view === 'month' && (
          <MonthView
            currentDate={currentDate}
            shows={shows}
            onDayClick={(d) => { setCurrentDate(d); setView('day') }}
          />
        )}
        {view === 'week' && (
          <WeekView currentDate={currentDate} shows={shows} />
        )}
        {view === 'day' && (
          <DayView currentDate={currentDate} shows={shows} />
        )}
      </div>
    </div>
  )
}
