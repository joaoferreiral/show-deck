'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// 00–23
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
// 00, 05, 10, … 55
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

interface TimePickerProps {
  value: string            // "HH:mm" or ""
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'Selecionar horário',
  className,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)

  // Internal selections (can differ from committed value while popover is open)
  const [hour, setHour] = useState(() => value ? value.split(':')[0] : '')
  const [minute, setMinute] = useState(() => value ? value.split(':')[1] : '')

  const hourRef   = useRef<HTMLDivElement>(null)
  const minuteRef = useRef<HTMLDivElement>(null)

  // Sync when external value changes
  useEffect(() => {
    setHour(value ? value.split(':')[0] : '')
    setMinute(value ? value.split(':')[1] : '')
  }, [value])

  // Auto-scroll to selected item when popover opens
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      scrollTo(hourRef, hour)
      scrollTo(minuteRef, minute)
    }, 60)
    return () => clearTimeout(timer)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>, v: string) {
    if (!v || !ref.current) return
    const el = ref.current.querySelector(`[data-v="${v}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  function pick(type: 'h' | 'm', v: string) {
    const h = type === 'h' ? v : hour
    const m = type === 'm' ? v : minute
    if (type === 'h') { setHour(v); scrollTo(hourRef, v) }
    else               { setMinute(v); scrollTo(minuteRef, v) }

    // Commit + close as soon as both sides are chosen
    if (h && m) {
      onChange(`${h}:${m}`)
      // Short delay so user sees the highlight before the popover closes
      if (type === 'm') setTimeout(() => setOpen(false), 120)
    }
  }

  function clear() {
    setHour('')
    setMinute('')
    onChange('')
  }

  const label = hour && minute ? `${hour}:${minute}` : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-2 rounded-md border bg-background px-3 h-10 text-sm text-left transition-colors',
            'hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
            open && 'border-primary ring-2 ring-primary ring-offset-1',
            className,
          )}
        >
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className={cn('flex-1', !label && 'text-muted-foreground')}>
            {label ?? placeholder}
          </span>
          {label && (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0 transition-colors"
              onClick={e => { e.stopPropagation(); clear() }}
            />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[152px] p-0 overflow-hidden" align="start">
        {/* Column headers */}
        <div className="flex divide-x border-b bg-muted/40">
          <div className="flex-1 py-1.5 text-center text-[11px] font-semibold text-muted-foreground tracking-wide">
            Hora
          </div>
          <div className="flex-1 py-1.5 text-center text-[11px] font-semibold text-muted-foreground tracking-wide">
            Min
          </div>
        </div>

        {/* Scrollable columns */}
        <div className="flex divide-x">
          {/* Hours */}
          <div
            ref={hourRef}
            className="flex-1 h-52 overflow-y-auto overscroll-contain scroll-smooth py-1"
          >
            {HOURS.map(h => (
              <button
                key={h}
                type="button"
                data-v={h}
                onClick={() => pick('h', h)}
                className={cn(
                  'w-full px-2 py-[7px] text-sm text-center transition-colors',
                  h === hour
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'hover:bg-muted text-foreground',
                )}
              >
                {h}
              </button>
            ))}
          </div>

          {/* Minutes */}
          <div
            ref={minuteRef}
            className="flex-1 h-52 overflow-y-auto overscroll-contain scroll-smooth py-1"
          >
            {MINUTES.map(m => (
              <button
                key={m}
                type="button"
                data-v={m}
                onClick={() => pick('m', m)}
                className={cn(
                  'w-full px-2 py-[7px] text-sm text-center transition-colors',
                  m === minute
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'hover:bg-muted text-foreground',
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-3 py-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={clear}
          >
            Limpar
          </button>
          {hour && minute && (
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              {hour}:{minute} ✓
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
