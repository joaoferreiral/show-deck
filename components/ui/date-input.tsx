'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { parse, isValid, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

function maskDate(v: string) {
  let raw = v.replace(/\D/g, '').slice(0, 8)
  if (raw.length > 4) raw = raw.slice(0, 2) + '/' + raw.slice(2, 4) + '/' + raw.slice(4)
  else if (raw.length > 2) raw = raw.slice(0, 2) + '/' + raw.slice(2)
  return raw
}

interface DateInputProps {
  /** Valor em dd/MM/yyyy */
  value: string
  onChange: (v: string) => void
  placeholder?: string
  /** Classe CSS aplicada ao wrapper */
  className?: string
  /** Classe CSS extra para o input de texto */
  inputClassName?: string
  /** 'sm' = h-7 text-xs w-28  |  'md' = h-9 text-sm w-32 */
  size?: 'sm' | 'md'
  disabled?: boolean
}

export function DateInput({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  className,
  inputClassName,
  size = 'sm',
  disabled,
}: DateInputProps) {
  const [open, setOpen] = useState(false)

  const parsed      = parse(value, 'dd/MM/yyyy', new Date())
  const calendarVal = isValid(parsed) ? parsed : undefined

  function handleCalendarSelect(date: Date | undefined) {
    if (date) onChange(format(date, 'dd/MM/yyyy'))
    setOpen(false)
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(maskDate(e.target.value))}
        placeholder={placeholder}
        maxLength={10}
        disabled={disabled}
        className={cn(
          'flex rounded-md border border-input bg-background text-foreground shadow-sm transition-colors',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'pr-7',
          size === 'sm' ? 'h-7 px-2 text-xs w-28' : 'h-9 px-3 text-sm w-32',
          inputClassName,
        )}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              'absolute right-1.5 p-0.5 rounded text-muted-foreground/60',
              'hover:text-foreground transition-colors',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            )}
            tabIndex={-1}
            aria-label="Abrir calendário"
          >
            <CalendarIcon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={calendarVal}
            onSelect={handleCalendarSelect}
            locale={ptBR}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
