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

  // Internal draft: tracks in-progress selection without notifying parent yet
  const [draft, setDraft] = React.useState<DateRange | undefined>(value)

  // When external value changes (preset buttons), sync the draft
  React.useEffect(() => { setDraft(value) }, [value])

  // Reset draft to confirmed value when popover closes without finishing
  function handleOpenChange(next: boolean) {
    if (!next) {
      // If user closed without completing the range, revert draft to last confirmed
      if (!draft?.to) setDraft(value)
    }
    setOpen(next)
  }

  const label = React.useMemo(() => {
    if (!value?.from) return null
    if (!value.to) return format(value.from, "d 'de' MMM, yyyy", { locale: ptBR })
    return `${format(value.from, "d MMM", { locale: ptBR })} – ${format(value.to, "d MMM, yyyy", { locale: ptBR })}`
  }, [value])

  // The hint reflects the draft (in-progress), not the committed value
  const hint = !draft?.from
    ? 'Clique para selecionar a data de início'
    : !draft.to
    ? 'Agora clique na data de fim'
    : 'Período selecionado — clique para alterar'

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(undefined)
    onChange(undefined)
  }

  function handleConfirm() {
    if (draft?.from && draft?.to) {
      onChange(draft)
      setOpen(false)
    }
  }

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
        <div className="border-b px-4 py-2.5">
          <span className="text-xs font-medium text-foreground">{hint}</span>
        </div>

        <Calendar
          mode="range"
          selected={draft}
          onSelect={range => {
            setDraft(range)
            // Auto-confirm and close only when both ends are picked
            if (range?.from && range?.to) {
              onChange(range)
              setOpen(false)
            }
          }}
          numberOfMonths={2}
          locale={ptBR}
          initialFocus
        />

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between gap-3">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setDraft(undefined); onChange(undefined) }}
          >
            Limpar
          </button>
          {draft?.from && draft?.to && (
            <button
              className="text-xs font-semibold text-primary hover:underline"
              onClick={handleConfirm}
            >
              Confirmar
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
