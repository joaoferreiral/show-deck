'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { CalendarDays, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateRangePickerProps {
  value?: DateRange
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
  align?: 'start' | 'center' | 'end'
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Selecione o período',
  className,
  align = 'start',
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  // draft: the in-progress selection, managed independently from external value.
  // null = not started (no date clicked yet in current session)
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined)

  // Phase tracking: 'from' = waiting for first click, 'to' = waiting for second click
  const [phase, setPhase] = React.useState<'from' | 'to'>('from')

  // When popover opens: always start fresh — clear draft and reset phase.
  // When it closes without a completed range: just clean up draft.
  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(undefined)
      setPhase('from')
    } else {
      // Closed without completing — discard draft
      setDraft(undefined)
      setPhase('from')
    }
    setOpen(next)
  }

  // react-day-picker v8 onSelect for range mode receives:
  //   (range, selectedDay, activeModifiers, e)
  // We use selectedDay (the actual clicked date) to drive our own phase logic,
  // ignoring whatever range react-day-picker computed internally.
  function handleSelect(_range: DateRange | undefined, selectedDay: Date) {
    if (phase === 'from') {
      // First click — set from, wait for to
      setDraft({ from: selectedDay, to: undefined })
      setPhase('to')
    } else {
      // Second click — complete the range
      if (!draft?.from) {
        // Shouldn't happen, but guard anyway
        setDraft({ from: selectedDay, to: undefined })
        setPhase('to')
        return
      }
      const from = selectedDay < draft.from ? selectedDay : draft.from
      const to   = selectedDay < draft.from ? draft.from  : selectedDay
      const completed: DateRange = { from, to }
      setDraft(completed)
      onChange(completed)
      setOpen(false)
      setPhase('from')
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(undefined)
  }

  const label = React.useMemo(() => {
    if (!value?.from) return null
    if (!value.to) return format(value.from, "d 'de' MMM, yyyy", { locale: ptBR })
    return `${format(value.from, "d MMM", { locale: ptBR })} – ${format(value.to, "d MMM, yyyy", { locale: ptBR })}`
  }, [value])

  const hint = phase === 'from'
    ? (value?.from ? 'Clique para selecionar a nova data de início' : 'Clique na data de início')
    : 'Agora clique na data de fim'

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors',
            'hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
            open && 'border-primary ring-2 ring-primary ring-offset-1',
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className={cn('flex-1 text-left', !label && 'text-muted-foreground')}>
            {label ?? placeholder}
          </span>
          {label && (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              onClick={handleClear}
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align={align}>
        {/* Status hint */}
        <div className="border-b px-4 py-2.5 flex items-center gap-2">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
              phase === 'from' ? 'bg-muted-foreground' : 'bg-primary animate-pulse',
            )}
          />
          <span className="text-xs font-medium text-foreground">{hint}</span>
        </div>

        <Calendar
          mode="range"
          selected={draft}
          onSelect={handleSelect as any}
          numberOfMonths={2}
          locale={ptBR}
          initialFocus
        />

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between gap-3">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setDraft(undefined); setPhase('from'); onChange(undefined) }}
          >
            Limpar
          </button>
          {phase === 'to' && draft?.from && (
            <span className="text-xs text-muted-foreground">
              Início: <span className="font-semibold text-foreground">{format(draft.from, "d MMM", { locale: ptBR })}</span>
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
