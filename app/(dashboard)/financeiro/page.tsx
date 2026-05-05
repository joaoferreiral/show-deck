'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/components/providers/session-provider'
import { useFinanceiro, useArtists } from '@/lib/hooks/queries'
import type { FinanceiroShow, ShowPayment } from '@/lib/hooks/queries'
import { formatCurrency, formatDate, cn, initials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import {
  ChevronDown, ChevronRight,
  CheckCircle2, Circle, AlertCircle, Clock,
  Plus, Trash2, LayoutList, Users, TrendingUp,
  DollarSign, AlertTriangle, Ban, Download, Loader2,
} from 'lucide-react'
import {
  startOfYear, endOfYear, startOfMonth, endOfMonth,
  addMonths, format, isAfter, isBefore, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

// ─── Payment status ───────────────────────────────────────────────────────────

type PaymentStatus = 'sem_plano' | 'pendente' | 'parcial' | 'atrasado' | 'pago'

function getPaymentStatus(payments: ShowPayment[]): PaymentStatus {
  if (!payments.length) return 'sem_plano'
  const now = new Date()
  const paid   = payments.filter(p => !!p.paid_at)
  const unpaid = payments.filter(p => !p.paid_at)
  if (!unpaid.length) return 'pago'
  const overdue = unpaid.filter(p => isBefore(parseISO(p.due_date), now))
  if (overdue.length) return 'atrasado'
  if (paid.length)   return 'parcial'
  return 'pendente'
}

const STATUS_CONFIG: Record<PaymentStatus, {
  label: string
  icon: React.ElementType
  className: string
}> = {
  sem_plano: { label: 'Sem plano',  icon: Ban,          className: 'text-muted-foreground bg-muted'                },
  pendente:  { label: 'Pendente',   icon: Clock,        className: 'text-blue-600 bg-blue-500/10 dark:text-blue-400' },
  parcial:   { label: 'Parcial',    icon: AlertCircle,  className: 'text-amber-600 bg-amber-500/10 dark:text-amber-400' },
  atrasado:  { label: 'Atrasado',   icon: AlertTriangle,className: 'text-destructive bg-destructive/10'             },
  pago:      { label: 'Pago',       icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400' },
}

// ─── Period helpers ───────────────────────────────────────────────────────────

type Period = 'mes' | 'trimestre' | 'ano' | 'tudo'

const PERIOD_LABELS: Record<Period, string> = {
  mes:       'Este mês',
  trimestre: 'Próx. 3 meses',
  ano:       'Este ano',
  tudo:      'Tudo',
}

function getPeriodRange(period: Period): { from?: string; to?: string } {
  const now = new Date()
  if (period === 'mes')
    return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
  if (period === 'trimestre')
    return { from: now.toISOString(), to: endOfMonth(addMonths(now, 2)).toISOString() }
  if (period === 'ano')
    return { from: startOfYear(now).toISOString(), to: endOfYear(now).toISOString() }
  return {}
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5 flex items-center gap-3">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', accent ?? 'bg-muted')}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-base font-bold tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Add Payment Plan form (inline) ──────────────────────────────────────────

function AddPaymentPlan({
  show,
  onClose,
  onSaved,
}: {
  show: FinanceiroShow
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [mode, setMode]               = useState<'integral' | 'parcelado'>('integral')
  const [totalAmount, setTotalAmount] = useState(String(show.cache_value || ''))
  const [numParcelas, setNumParcelas] = useState('2')
  const [startDate, setStartDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving]           = useState(false)

  async function handleSave() {
    const amount = parseFloat(totalAmount.replace(',', '.'))
    if (!amount || amount <= 0) {
      toast({ title: 'Valor inválido', description: 'Informe um valor maior que zero.', variant: 'destructive' })
      return
    }

    let installments: { amount: number; due_date: string; description?: string }[] = []

    if (mode === 'integral') {
      installments = [{ amount, due_date: startDate }]
    } else {
      const n = Math.max(2, parseInt(numParcelas, 10) || 2)
      const perParcela = Math.round((amount / n) * 100) / 100
      const base = parseISO(startDate)
      installments = Array.from({ length: n }, (_, i) => ({
        amount: i === n - 1 ? Math.round((amount - perParcela * (n - 1)) * 100) / 100 : perParcela,
        due_date: format(addMonths(base, i), 'yyyy-MM-dd'),
        description: `Parcela ${i + 1}/${n}`,
      }))
    }

    setSaving(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_id: show.id, installments }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast({ title: 'Plano criado', description: `${installments.length} parcela${installments.length > 1 ? 's' : ''} adicionada${installments.length > 1 ? 's' : ''}.` })
      onSaved()
      onClose()
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível salvar o plano.', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 mb-1 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
      <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Novo plano de pagamento</p>

      {/* Mode toggle */}
      <div className="flex gap-1.5">
        {(['integral', 'parcelado'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-medium border transition-colors',
              mode === m
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted'
            )}
          >
            {m === 'integral' ? 'À vista' : 'Parcelado'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Valor total (R$)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={totalAmount}
            onChange={e => setTotalAmount(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{mode === 'integral' ? 'Data de vencimento' : 'Data da 1ª parcela'}</Label>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        {mode === 'parcelado' && (
          <div className="space-y-1">
            <Label className="text-xs">Nº de parcelas</Label>
            <Input
              type="number"
              min="2"
              max="24"
              value={numParcelas}
              onChange={e => setNumParcelas(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>

      {mode === 'parcelado' && totalAmount && parseFloat(totalAmount) > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {parseInt(numParcelas, 10) || 2}× de {formatCurrency((parseFloat(totalAmount.replace(',', '.')) || 0) / (parseInt(numParcelas, 10) || 2))}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs">
          {saving ? 'Salvando…' : 'Salvar plano'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs">
          Cancelar
        </Button>
      </div>
    </div>
  )
}

// ─── Installment row ──────────────────────────────────────────────────────────

function InstallmentRow({
  payment,
  onTogglePaid,
  onDelete,
}: {
  payment: ShowPayment
  onTogglePaid: (p: ShowPayment) => void
  onDelete: (p: ShowPayment) => void
}) {
  const now      = new Date()
  const isPaid   = !!payment.paid_at
  const dueDate  = parseISO(payment.due_date)
  const overdue  = !isPaid && isBefore(dueDate, now)

  return (
    <div className={cn(
      'flex items-center gap-3 py-2 px-1 rounded-md group',
      isPaid ? 'opacity-60' : ''
    )}>
      <button
        onClick={() => onTogglePaid(payment)}
        className="shrink-0 transition-colors"
        aria-label={isPaid ? 'Desmarcar como pago' : 'Marcar como pago'}
      >
        {isPaid
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          : overdue
            ? <Circle className="h-4 w-4 text-destructive" />
            : <Circle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-xs font-semibold tabular-nums',
            isPaid ? 'line-through text-muted-foreground' : overdue ? 'text-destructive' : 'text-foreground'
          )}>
            {formatCurrency(payment.amount)}
          </span>
          {payment.description && (
            <span className="text-[11px] text-muted-foreground truncate">{payment.description}</span>
          )}
        </div>
        <p className={cn(
          'text-[11px]',
          isPaid ? 'text-muted-foreground/50' : overdue ? 'text-destructive/70' : 'text-muted-foreground'
        )}>
          {isPaid
            ? `Pago em ${formatDate(payment.paid_at!)}`
            : overdue
              ? `Venceu ${formatDate(payment.due_date)}`
              : `Vence ${formatDate(payment.due_date)}`
          }
        </p>
      </div>

      <button
        onClick={() => onDelete(payment)}
        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
        aria-label="Remover parcela"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Show row (expandable) ────────────────────────────────────────────────────

function ShowRow({
  show,
  orgId,
  queryClient,
  onDataChange,
}: {
  show: FinanceiroShow
  orgId: string
  queryClient: ReturnType<typeof useQueryClient>
  onDataChange: () => void
}) {
  const [open, setOpen]           = useState(false)
  const [addingPlan, setAddingPlan] = useState(false)
  const { toast } = useToast()

  const payStatus = getPaymentStatus(show.payments)
  const config    = STATUS_CONFIG[payStatus]
  const StatusIcon = config.icon

  const totalPaid    = show.payments.filter(p => p.paid_at).reduce((s, p) => s + p.amount, 0)
  const totalPending = show.payments.filter(p => !p.paid_at).reduce((s, p) => s + p.amount, 0)

  // Optimistically update a single payment in the cache — zero delay
  const patchCachePayment = useCallback((paymentId: string, newPaidAt: string | null) => {
    queryClient.setQueriesData<FinanceiroShow[]>(
      { queryKey: ['financeiro', orgId], exact: false },
      (old) => {
        if (!old) return old
        return old.map(s => ({
          ...s,
          payments: s.payments.map(p =>
            p.id === paymentId ? { ...p, paid_at: newPaidAt } : p
          ),
        }))
      }
    )
  }, [queryClient, orgId])

  const handleTogglePaid = useCallback(async (payment: ShowPayment) => {
    const newPaidAt = payment.paid_at ? null : new Date().toISOString()
    // Apply optimistic update immediately — UI responds at once
    patchCachePayment(payment.id, newPaidAt)
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_at: newPaidAt }),
      })
      if (!res.ok) throw new Error()
      // Sync cache with server response in background (no visible re-render)
      onDataChange()
    } catch {
      // Revert optimistic update on error
      patchCachePayment(payment.id, payment.paid_at)
      toast({ title: 'Erro', description: 'Não foi possível atualizar o pagamento.', variant: 'destructive' })
    }
  }, [patchCachePayment, onDataChange, toast])

  const handleDelete = useCallback(async (payment: ShowPayment) => {
    try {
      const res = await fetch(`/api/payments/${payment.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Parcela removida' })
      onDataChange()
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível remover a parcela.', variant: 'destructive' })
    }
  }, [onDataChange, toast])

  return (
    <div className="border-b border-border/50 last:border-b-0">
      {/* Main row */}
      <button
        onClick={() => { setOpen(v => !v); setAddingPlan(false) }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        }

        {/* Artist color bar */}
        <span
          className="w-1 h-8 rounded-full shrink-0"
          style={{ backgroundColor: show.artists?.color ?? '#4A4540' }}
        />

        {/* Show info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{show.title}</span>
            <span className="text-[11px] text-muted-foreground shrink-0">
              {formatDate(show.start_at, 'dd/MM/yy')}
            </span>
            {show.city && (
              <span className="text-[11px] text-muted-foreground/60 truncate hidden sm:inline">
                {show.city}{show.state ? ` · ${show.state}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {show.artists?.name && (
              <span className="text-[11px] text-muted-foreground">{show.artists.name}</span>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Cache vs payments summary */}
          <div className="hidden sm:flex flex-col items-end">
            {show.cache_value > 0 && (
              <span className="text-xs font-semibold tabular-nums">
                {formatCurrency(show.cache_value)}
              </span>
            )}
            {show.payments.length > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {totalPaid > 0 && <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)} pago</span>}
                {totalPaid > 0 && totalPending > 0 && ' · '}
                {totalPending > 0 && <span>{formatCurrency(totalPending)} pendente</span>}
              </span>
            )}
          </div>

          {/* Status badge */}
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
            config.className
          )}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-3">
          <div className="ml-7 pl-3 border-l border-border/60">
            {/* Link to show detail */}
            <div className="flex items-center justify-between mb-2">
              <Link
                href={`/agenda/${show.id}`}
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                onClick={e => e.stopPropagation()}
              >
                Ver show completo →
              </Link>
              {show.payments.length > 0 && (
                <button
                  onClick={() => setAddingPlan(v => !v)}
                  className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Adicionar parcela
                </button>
              )}
            </div>

            {/* Installments */}
            {show.payments.length > 0 ? (
              <div className="space-y-0.5">
                {show.payments.map(p => (
                  <InstallmentRow
                    key={p.id}
                    payment={p}
                    onTogglePaid={handleTogglePaid}
                    onDelete={handleDelete}
                  />
                ))}
                {/* Totals */}
                {show.payments.length > 1 && (
                  <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-border/50 text-[11px]">
                    <span className="text-muted-foreground">Total do plano</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(show.payments.reduce((s, p) => s + p.amount, 0))}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-2">
                {!addingPlan && (
                  <button
                    onClick={() => setAddingPlan(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Criar plano de pagamento
                  </button>
                )}
              </div>
            )}

            {addingPlan && (
              <AddPaymentPlan
                show={show}
                onClose={() => setAddingPlan(false)}
                onSaved={onDataChange}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Artist group (Por Artista view) ─────────────────────────────────────────

function ArtistGroup({ artist, shows, orgId, queryClient, onDataChange }: {
  artist: { id: string; name: string; color: string; photo_url: string | null }
  shows: FinanceiroShow[]
  orgId: string
  queryClient: ReturnType<typeof useQueryClient>
  onDataChange: () => void
}) {
  const [open, setOpen] = useState(true)

  const totalCache   = shows.reduce((s, sh) => s + (sh.cache_value || 0), 0)
  const totalPaid    = shows.flatMap(s => s.payments).filter(p => p.paid_at).reduce((s, p) => s + p.amount, 0)
  const totalPending = shows.flatMap(s => s.payments).filter(p => !p.paid_at).reduce((s, p) => s + p.amount, 0)
  const overdue      = shows.flatMap(s => s.payments).filter(p => !p.paid_at && isBefore(parseISO(p.due_date), new Date()))

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Artist header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left bg-muted/20"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        }
        <Avatar className="h-7 w-7 shrink-0">
          {artist.photo_url && <AvatarImage src={artist.photo_url} alt={artist.name} />}
          <AvatarFallback style={{ backgroundColor: artist.color + '33', color: artist.color }} className="text-[10px] font-bold">
            {initials(artist.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold truncate">{artist.name}</p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0 text-[11px] text-muted-foreground mt-0.5">
            <span className="shrink-0">{shows.length} show{shows.length !== 1 ? 's' : ''}</span>
            {totalCache > 0 && <span className="tabular-nums font-medium text-foreground shrink-0">{formatCurrency(totalCache)}</span>}
            {overdue.length > 0 && (
              <span className="text-destructive font-medium shrink-0">{overdue.length} em atraso</span>
            )}
            {totalPaid > 0 && <span className="text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">{formatCurrency(totalPaid)} pago</span>}
            {totalPending > 0 && <span className="tabular-nums shrink-0">{formatCurrency(totalPending)} pendente</span>}
          </div>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-border/50">
          {shows.map(show => (
            <ShowRow key={show.id} show={show} orgId={orgId} queryClient={queryClient} onDataChange={onDataChange} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = 'shows' | 'artistas'
type FilterStatus = 'todos' | PaymentStatus

export default function FinanceiroPage() {
  const { orgId, orgName } = useSession()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [period, setPeriod]           = useState<Period>('ano')
  const [filterArtist, setFilterArtist] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
  const [viewMode, setViewMode]       = useState<ViewMode>('shows')
  const [exporting, setExporting]     = useState(false)

  const { from, to } = getPeriodRange(period)

  const { data: shows, isLoading } = useFinanceiro(
    orgId,
    from,
    to,
    filterArtist || undefined
  )
  const { data: artistsData } = useArtists(orgId)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['financeiro', orgId] })
  }, [queryClient, orgId])

  // ── Filtered shows ──
  const filteredShows = useMemo(() => {
    if (!shows) return []
    if (filterStatus === 'todos') return shows
    return shows.filter(s => getPaymentStatus(s.payments) === filterStatus)
  }, [shows, filterStatus])

  // ── KPIs ──
  const kpis = useMemo(() => {
    if (!shows) return { semPlano: 0, totalPendente: 0, totalPago: 0, totalAtrasado: 0 }
    const allPayments = shows.flatMap(s => s.payments)
    const now = new Date()
    return {
      semPlano:      shows.filter(s => !s.payments.length).length,
      totalPendente: allPayments.filter(p => !p.paid_at).reduce((s, p) => s + p.amount, 0),
      totalPago:     allPayments.filter(p => p.paid_at).reduce((s, p) => s + p.amount, 0),
      totalAtrasado: allPayments.filter(p => !p.paid_at && isBefore(parseISO(p.due_date), now)).reduce((s, p) => s + p.amount, 0),
    }
  }, [shows])

  // ── Group by artist for artista view ──
  const byArtist = useMemo(() => {
    const map = new Map<string, { artist: FinanceiroShow['artists'] & { id: string }; shows: FinanceiroShow[] }>()
    filteredShows.forEach(show => {
      if (!show.artists) return
      const key = show.artist_id
      if (!map.has(key)) {
        map.set(key, { artist: show.artists as { id: string; name: string; color: string; photo_url: string | null }, shows: [] })
      }
      map.get(key)!.shows.push(show)
    })
    return Array.from(map.values()).sort((a, b) => a.artist.name.localeCompare(b.artist.name))
  }, [filteredShows])

  const artists = artistsData?.artists ?? []

  // ── PDF Export ──────────────────────────────────────────────────────────────
  async function exportPDF() {
    if (!filteredShows.length) {
      toast({ title: 'Nenhum dado', description: 'Não há shows para exportar com os filtros atuais.', variant: 'destructive' })
      return
    }
    setExporting(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const now   = new Date()
      const brand: [number, number, number] = [44, 41, 38]   // #2C2926
      const gray:  [number, number, number] = [100, 97, 93]
      const green: [number, number, number] = [22, 163, 74]
      const red:   [number, number, number] = [220, 38, 38]
      const blue:  [number, number, number] = [37, 99, 235]
      const pageW = doc.internal.pageSize.getWidth()

      // ── Cabeçalho ──────────────────────────────────────────────────────────
      doc.setFillColor(...brand)
      doc.rect(0, 0, pageW, 28, 'F')

      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text('ShowDeck', 14, 11)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('Relatório Financeiro', 14, 18)

      doc.setTextColor(200, 196, 192)
      doc.setFontSize(8)
      doc.text(orgName, pageW - 14, 11, { align: 'right' })
      doc.text(`Gerado em ${format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageW - 14, 18, { align: 'right' })

      // período
      const periodStr = period === 'tudo'
        ? 'Todo o período'
        : `${PERIOD_LABELS[period]}${from ? ` · ${format(new Date(from), 'dd/MM/yyyy')} – ${format(new Date(to!), 'dd/MM/yyyy')}` : ''}`
      doc.text(periodStr, pageW / 2, 24, { align: 'center' })

      // ── Resumo KPIs ────────────────────────────────────────────────────────
      let y = 38
      doc.setTextColor(...brand)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Resumo', 14, y)

      y += 6
      const kpiData = [
        ['A Receber',       formatCurrency(kpis.totalPendente)],
        ['Recebido',        formatCurrency(kpis.totalPago)],
        ['Em Atraso',       formatCurrency(kpis.totalAtrasado)],
        ['Shows sem Plano', String(kpis.semPlano)],
        ['Total de Shows',  String(filteredShows.length)],
      ]
      autoTable(doc, {
        startY: y,
        body: kpiData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50, textColor: gray },
          1: { cellWidth: 60, textColor: brand },
        },
        margin: { left: 14, right: 14 },
      })

      y = (doc as any).lastAutoTable.finalY + 8

      // ── Detalhe por show ───────────────────────────────────────────────────
      doc.setTextColor(...brand)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('Detalhe por Show', 14, y)
      y += 4

      for (const show of filteredShows) {
        const payStatus = getPaymentStatus(show.payments)
        const statusLabel = STATUS_CONFIG[payStatus].label
        const totalShowPaid    = show.payments.filter(p => p.paid_at).reduce((s, p) => s + p.amount, 0)
        const totalShowPending = show.payments.filter(p => !p.paid_at).reduce((s, p) => s + p.amount, 0)

        // show header row
        autoTable(doc, {
          startY: y,
          head: [[
            { content: show.title, colSpan: 3, styles: { fontStyle: 'bold', fontSize: 9, textColor: [255,255,255], fillColor: brand } },
            { content: statusLabel, styles: { fontStyle: 'bold', fontSize: 8, textColor: [255,255,255], fillColor: brand, halign: 'right' } },
          ]],
          body: [[
            show.artists?.name ?? '—',
            format(new Date(show.start_at), 'dd/MM/yyyy', { locale: ptBR }),
            show.city ? `${show.city}${show.state ? ` / ${show.state}` : ''}` : '—',
            show.cache_value > 0 ? formatCurrency(show.cache_value) : '—',
          ]],
          styles: { fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } },
          bodyStyles: { textColor: gray },
          margin: { left: 14, right: 14 },
          tableWidth: pageW - 28,
          columnStyles: {
            0: { cellWidth: 55 },
            1: { cellWidth: 28 },
            2: { cellWidth: 'auto' },
            3: { cellWidth: 35, halign: 'right' },
          },
        })
        y = (doc as any).lastAutoTable.finalY

        if (show.payments.length > 0) {
          const rows = show.payments.map((p, i) => {
            const isPaid  = !!p.paid_at
            const overdue = !isPaid && isBefore(parseISO(p.due_date), now)
            return [
              p.description ?? `Parcela ${i + 1}`,
              format(new Date(p.due_date), 'dd/MM/yyyy'),
              isPaid ? `Pago em ${format(new Date(p.paid_at!), 'dd/MM/yyyy')}` : overdue ? 'Em atraso' : 'Pendente',
              formatCurrency(p.amount),
            ]
          })

          // summary row
          if (show.payments.length > 1) {
            rows.push(['', '', 'Total pago / pendente', `${formatCurrency(totalShowPaid)} / ${formatCurrency(totalShowPending)}`])
          }

          autoTable(doc, {
            startY: y,
            head: [['Descrição', 'Vencimento', 'Status', 'Valor']],
            body: rows,
            styles: { fontSize: 7.5, cellPadding: { top: 1.2, bottom: 1.2, left: 4, right: 3 } },
            headStyles: { fillColor: [230, 228, 224], textColor: brand, fontStyle: 'bold', fontSize: 7.5 },
            bodyStyles: { textColor: gray },
            margin: { left: 20, right: 14 },
            tableWidth: pageW - 34,
            columnStyles: {
              0: { cellWidth: 'auto' },
              1: { cellWidth: 26 },
              2: { cellWidth: 30 },
              3: { cellWidth: 32, halign: 'right' },
            },
            didParseCell(data) {
              if (data.section === 'body' && data.column.index === 2) {
                const v = String(data.cell.raw)
                if (v === 'Pago em' || v.startsWith('Pago em'))       data.cell.styles.textColor = green
                else if (v === 'Em atraso')                            data.cell.styles.textColor = red
                else if (v === 'Pendente')                             data.cell.styles.textColor = blue
              }
              // summary row — last row bold
              if (data.section === 'body' && data.row.index === rows.length - 1 && show.payments.length > 1) {
                data.cell.styles.fontStyle = 'bold'
                data.cell.styles.textColor = brand
              }
            },
          })
          y = (doc as any).lastAutoTable.finalY + 3
        } else {
          // no payment plan
          doc.setFontSize(7.5)
          doc.setTextColor(...gray)
          doc.setFont('helvetica', 'italic')
          doc.text('Sem plano de pagamento cadastrado.', 22, y + 4)
          y += 8
        }

        // page break buffer
        if (y > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage()
          y = 16
        }
      }

      // ── Rodapé ─────────────────────────────────────────────────────────────
      const totalPages = (doc.internal as any).getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(...gray)
        doc.setFont('helvetica', 'normal')
        doc.text(`ShowDeck · ${orgName}`, 14, doc.internal.pageSize.getHeight() - 6)
        doc.text(`Página ${i} de ${totalPages}`, pageW - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
      }

      doc.save(`financeiro-${format(now, 'yyyy-MM-dd')}.pdf`)
      toast({ title: 'PDF exportado com sucesso!' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar o PDF.', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 md:px-6 py-3 flex flex-wrap items-center gap-3">

          {/* Period filter */}
          <div className="flex gap-1">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  period === p
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Artist filter */}
          <select
            value={filterArtist}
            onChange={e => setFilterArtist(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todos os artistas</option>
            {artists.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as FilterStatus)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="todos">Todos os status</option>
            {(Object.keys(STATUS_CONFIG) as PaymentStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-1.5">
            {/* View toggle */}
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('shows')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'shows'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Por show</span>
              </button>
              <button
                onClick={() => setViewMode('artistas')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'artistas'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Por artista</span>
              </button>
            </div>

            <div className="w-px h-4 bg-border" />

            {/* Export PDF */}
            <button
              onClick={exportPDF}
              disabled={exporting || isLoading || !filteredShows.length}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Exportar PDF"
            >
              {exporting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Download className="h-3.5 w-3.5" />
              }
              <span className="hidden sm:inline">Exportar PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-4 space-y-4">
        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={DollarSign}
            label="A receber"
            value={formatCurrency(kpis.totalPendente)}
            accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Recebido"
            value={formatCurrency(kpis.totalPago)}
            accent="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Em atraso"
            value={formatCurrency(kpis.totalAtrasado)}
            accent={kpis.totalAtrasado > 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}
          />
          <KpiCard
            icon={Ban}
            label="Shows sem plano"
            value={String(kpis.semPlano)}
            sub={kpis.semPlano ? 'Clique para adicionar' : 'Todos planejados'}
            accent={kpis.semPlano > 0 ? 'bg-muted text-muted-foreground' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}
          />
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : filteredShows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/30 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              {filterStatus !== 'todos'
                ? `Nenhum show com status "${STATUS_CONFIG[filterStatus as PaymentStatus]?.label}" no período.`
                : 'Nenhum show encontrado no período selecionado.'
              }
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Tente um período diferente ou verifique os filtros.
            </p>
          </div>
        ) : viewMode === 'shows' ? (
          /* ── Por show ── */
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {filteredShows.length} show{filteredShows.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div>
              {filteredShows.map(show => (
                <ShowRow key={show.id} show={show} orgId={orgId} queryClient={queryClient} onDataChange={invalidate} />
              ))}
            </div>
          </div>
        ) : (
          /* ── Por artista ── */
          <div className="space-y-3">
            {byArtist.map(({ artist, shows: artistShows }) => (
              <ArtistGroup
                key={artist.id}
                artist={artist}
                shows={artistShows}
                orgId={orgId}
                queryClient={queryClient}
                onDataChange={invalidate}
              />
            ))}
            {/* Shows without artist */}
            {(() => {
              const noArtist = filteredShows.filter(s => !s.artists)
              if (!noArtist.length) return null
              return (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/20">
                    <p className="text-sm font-semibold text-muted-foreground">Sem artista vinculado</p>
                  </div>
                  {noArtist.map(show => (
                    <ShowRow key={show.id} show={show} orgId={orgId} queryClient={queryClient} onDataChange={invalidate} />
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}
