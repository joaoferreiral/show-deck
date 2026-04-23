import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toZonedTime } from 'date-fns-tz'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const TIMEZONE = 'America/Recife'

export function toRecife(date: Date | string): Date {
  return toZonedTime(new Date(date), TIMEZONE)
}

export function formatDate(date: Date | string, fmt = 'dd/MM/yyyy'): string {
  return format(toRecife(date), fmt, { locale: ptBR })
}

export function formatDateTime(date: Date | string): string {
  return format(toRecife(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

export function formatTime(date: Date | string): string {
  return format(toRecife(date), 'HH:mm', { locale: ptBR })
}

export function formatRelative(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '…'
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pre_reserva: '#71717a',
    confirmado: '#10b981',
    contrato_enviado: '#f59e0b',
    contrato_assinado: '#059669',
    realizado: '#3b82f6',
    cancelado: '#ef4444',
    pendente: '#f59e0b',
    parcial: '#3b82f6',
    pago: '#10b981',
    atrasado: '#ef4444',
  }
  return colors[status] ?? '#71717a'
}
