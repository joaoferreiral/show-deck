'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/components/providers/session-provider'
import { useFinanceiro, useArtists } from '@/lib/hooks/queries'
import type { FinanceiroShow, ShowPayment, ShowExpense } from '@/lib/hooks/queries'
import { formatCurrency, formatDate, cn, initials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import {
  ChevronDown, ChevronRight,
  CheckCircle2, Circle, AlertCircle, Clock,
  Plus, Trash2, LayoutList, Users, TrendingUp,
  AlertTriangle, Ban, Download, Loader2,
  Truck, Building2, Sparkles, Music2, Utensils, Wrench, MoreHorizontal,
  ArrowUpRight,
} from 'lucide-react'
import {
  startOfYear, endOfYear, startOfMonth, endOfMonth,
  addMonths, format, isBefore, parseISO,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

// ─── Payment status ───────────────────────────────────────────────────────────

type PaymentStatus = 'sem_plano' | 'pendente' | 'parcial' | 'atrasado' | 'pago'

function getPaymentStatus(payments: ShowPayment[]): PaymentStatus {
  if (!payments.length) return 'sem_plano'
  const now    = new Date()
  const paid   = payments.filter(p => !!p.paid_at)
  const unpaid = payments.filter(p => !p.paid_at)
  if (!unpaid.length) return 'pago'
  const overdue = unpaid.filter(p => isBefore(parseISO(p.due_date), now))
  if (overdue.length) return 'atrasado'
  if (paid.length)   return 'parcial'
  return 'pendente'
}

const STATUS_CONFIG: Record<PaymentStatus, {
  label: string; icon: React.ElementType; className: string
}> = {
  sem_plano: { label: 'Sem plano',  icon: Ban,           className: 'text-muted-foreground bg-muted' },
  pendente:  { label: 'Pendente',   icon: Clock,         className: 'text-blue-600 bg-blue-500/10 dark:text-blue-400' },
  parcial:   { label: 'Parcial',    icon: AlertCircle,   className: 'text-amber-600 bg-amber-500/10 dark:text-amber-400' },
  atrasado:  { label: 'Atrasado',   icon: AlertTriangle, className: 'text-destructive bg-destructive/10' },
  pago:      { label: 'Pago',       icon: CheckCircle2,  className: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400' },
}

// ─── Expense category config ──────────────────────────────────────────────────

type ExpenseCategory = 'logistica' | 'hospedagem' | 'pirotecnia' | 'banda' | 'alimentacao' | 'equipamento' | 'outros'

const EXPENSE_CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; icon: React.ElementType }> = {
  logistica:   { label: 'Logística',   icon: Truck          },
  hospedagem:  { label: 'Hospedagem',  icon: Building2      },
  pirotecnia:  { label: 'Pirotecnia',  icon: Sparkles       },
  banda:       { label: 'Banda',       icon: Music2         },
  alimentacao: { label: 'Alimentação', icon: Utensils       },
  equipamento: { label: 'Equipamento', icon: Wrench         },
  outros:      { label: 'Outros',      icon: MoreHorizontal },
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
  if (period === 'mes')       return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
  if (period === 'trimestre') return { from: now.toISOString(), to: endOfMonth(addMonths(now, 2)).toISOString() }
  if (period === 'ano')       return { from: startOfYear(now).toISOString(), to: endOfYear(now).toISOString() }
  return {}
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionDivider({ label, onAdd, addLabel }: {
  label: string
  onAdd?: () => void
  addLabel?: string
}) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/50" />
      {onAdd && (
        <button
          onClick={e => { e.stopPropagation(); onAdd() }}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
        >
          <Plus className="h-3 w-3" />
          {addLabel ?? 'adicionar'}
        </button>
      )}
    </div>
  )
}

// ─── Installment row ──────────────────────────────────────────────────────────

function InstallmentRow({
  payment, onTogglePaid, onDelete,
}: {
  payment: ShowPayment
  onTogglePaid: (p: ShowPayment) => void
  onDelete: (p: ShowPayment) => void
}) {
  const now     = new Date()
  const isPaid  = !!payment.paid_at
  const overdue = !isPaid && isBefore(parseISO(payment.due_date), now)

  return (
    <div className="group flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors">
      {/* Toggle */}
      <button
        onClick={() => onTogglePaid(payment)}
        className={cn('shrink-0 transition-transform duration-150', isPaid ? 'scale-105' : 'scale-100')}
        aria-label={isPaid ? 'Desmarcar' : 'Marcar como pago'}
      >
        {isPaid
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          : overdue
            ? <Circle className="h-4 w-4 text-destructive" />
            : <Circle className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {/* Amount + strikethrough */}
      <span className="relative shrink-0 inline-flex items-center">
        <span className={cn(
          'text-xs font-semibold tabular-nums transition-colors duration-300',
          isPaid ? 'text-muted-foreground/50' : overdue ? 'text-destructive' : 'text-foreground',
        )}>
          {formatCurrency(payment.amount)}
        </span>
        <span
          aria-hidden
          className={cn(
            'absolute left-0 top-[55%] h-px bg-muted-foreground/50 origin-left transition-transform duration-300 ease-out',
            isPaid ? 'scale-x-100' : 'scale-x-0',
          )}
          style={{ width: '100%' }}
        />
      </span>

      {/* Description */}
      {payment.description && (
        <span className={cn(
          'text-[11px] truncate transition-colors duration-300',
          isPaid ? 'text-muted-foreground/40' : 'text-muted-foreground',
        )}>
          {payment.description}
        </span>
      )}

      {/* Date */}
      <span className={cn(
        'ml-auto text-[11px] tabular-nums shrink-0 transition-colors duration-300',
        isPaid ? 'text-emerald-600 dark:text-emerald-400' : overdue ? 'text-destructive/70' : 'text-muted-foreground',
      )}>
        {isPaid
          ? `Pago em ${formatDate(payment.paid_at!)}`
          : overdue
            ? `Venceu ${formatDate(payment.due_date)}`
            : `Vence ${formatDate(payment.due_date)}`
        }
      </span>

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(payment) }}
        className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Remover parcela"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Expense row ──────────────────────────────────────────────────────────────

function ExpenseRow({
  expense, onTogglePaid, onUpdatePaidAt, onDelete,
}: {
  expense: ShowExpense
  onTogglePaid: (e: ShowExpense) => void
  onUpdatePaidAt: (e: ShowExpense, date: string) => void
  onDelete: (e: ShowExpense) => void
}) {
  const [editingDate, setEditingDate] = useState(false)
  const [dateVal, setDateVal] = useState(
    expense.paid_at
      ? format(parseISO(expense.paid_at), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
  )

  const isPaid    = expense.paid
  const catKey    = (expense.category as ExpenseCategory) in EXPENSE_CATEGORY_CONFIG
    ? expense.category as ExpenseCategory : 'outros'
  const catConfig = EXPENSE_CATEGORY_CONFIG[catKey]
  const CatIcon   = catConfig.icon

  function commitDate() {
    onUpdatePaidAt(expense, dateVal)
    setEditingDate(false)
  }

  return (
    <div className="group flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/40 transition-colors">
      {/* Toggle */}
      <button
        onClick={() => onTogglePaid(expense)}
        className={cn('shrink-0 transition-transform duration-150', isPaid ? 'scale-105' : 'scale-100')}
        aria-label={isPaid ? 'Desmarcar' : 'Marcar como paga'}
      >
        {isPaid
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          : <Circle className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {/* Category icon */}
      <CatIcon className={cn(
        'h-3.5 w-3.5 shrink-0 transition-colors duration-300',
        isPaid ? 'text-muted-foreground/30' : 'text-muted-foreground',
      )} />

      {/* Amount + strikethrough */}
      <span className="relative shrink-0 inline-flex items-center">
        <span className={cn(
          'text-xs font-semibold tabular-nums transition-colors duration-300',
          isPaid ? 'text-muted-foreground/50' : 'text-foreground',
        )}>
          {formatCurrency(expense.amount)}
        </span>
        <span
          aria-hidden
          className={cn(
            'absolute left-0 top-[55%] h-px bg-muted-foreground/50 origin-left transition-transform duration-300 ease-out',
            isPaid ? 'scale-x-100' : 'scale-x-0',
          )}
          style={{ width: '100%' }}
        />
      </span>

      {/* Description / label */}
      <span className={cn(
        'text-[11px] truncate flex-1 min-w-0 transition-colors duration-300',
        isPaid ? 'text-muted-foreground/40' : 'text-muted-foreground',
      )}>
        {expense.description ?? catConfig.label}
      </span>

      {/* Paid date — editable inline */}
      {isPaid ? (
        editingDate ? (
          <input
            type="date"
            value={dateVal}
            onChange={e => setDateVal(e.target.value)}
            onBlur={commitDate}
            onKeyDown={e => { if (e.key === 'Enter') commitDate(); if (e.key === 'Escape') setEditingDate(false) }}
            autoFocus
            className="text-[11px] tabular-nums border-0 border-b border-primary bg-transparent outline-none w-32 text-right"
          />
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setEditingDate(true) }}
            title="Clique para editar a data"
            className="text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400 hover:underline shrink-0 transition-colors"
          >
            {expense.paid_at ? `Paga em ${formatDate(expense.paid_at)}` : 'Definir data'}
          </button>
        )
      ) : (
        <span className="text-[11px] text-muted-foreground/50 shrink-0">Pendente</span>
      )}

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(expense) }}
        className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Remover despesa"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Compact expense form ─────────────────────────────────────────────────────

function AddExpenseForm({
  showId, onClose, onSaved,
}: {
  showId: string; onClose: () => void; onSaved: () => void
}) {
  const { toast } = useToast()
  const [category, setCategory]       = useState<ExpenseCategory>('outros')
  const [description, setDescription] = useState('')
  const [amount, setAmount]           = useState('')
  const [paid, setPaid]               = useState(false)
  const [paidDate, setPaidDate]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving]           = useState(false)

  async function handleSave() {
    const parsedAmount = parseFloat(amount.replace(',', '.'))
    if (!parsedAmount || parsedAmount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          show_id: showId, category,
          description: description.trim() || null,
          amount: parsedAmount, paid,
          paid_at: paid && paidDate ? new Date(`${paidDate}T12:00:00`).toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Despesa adicionada' })
      onSaved()
      onClose()
    } catch {
      toast({ title: 'Erro ao salvar despesa', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
      <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Nova despesa</p>

      {/* Row 1: category + amount + description */}
      <div className="flex flex-wrap gap-2">
        <select
          value={category}
          onChange={e => setCategory(e.target.value as ExpenseCategory)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {(Object.entries(EXPENSE_CATEGORY_CONFIG) as [ExpenseCategory, { label: string }][]).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <Input
          type="number" min="0" step="0.01" placeholder="Valor (R$)"
          value={amount} onChange={e => setAmount(e.target.value)}
          className="h-8 text-xs w-28"
        />
        <Input
          type="text" placeholder="Descrição (opcional)"
          value={description} onChange={e => setDescription(e.target.value)}
          className="h-8 text-xs flex-1 min-w-[140px]"
        />
      </div>

      {/* Row 2: paid checkbox + date + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={paid}
            onChange={e => setPaid(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          <span className="text-xs text-muted-foreground">Já paga</span>
        </label>
        {paid && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">em</span>
            <Input
              type="date"
              value={paidDate}
              onChange={e => setPaidDate(e.target.value)}
              className="h-7 text-xs w-36"
            />
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs px-3">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Adicionar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs px-2 text-muted-foreground">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Payment Plan form ────────────────────────────────────────────────────

function AddPaymentPlan({
  show, onClose, onSaved,
}: {
  show: FinanceiroShow; onClose: () => void; onSaved: () => void
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
      toast({ title: 'Valor inválido', variant: 'destructive' }); return
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ show_id: show.id, installments }),
      })
      if (!res.ok) throw new Error()
      toast({ title: `${installments.length} parcela${installments.length > 1 ? 's' : ''} criada${installments.length > 1 ? 's' : ''}` })
      onSaved(); onClose()
    } catch {
      toast({ title: 'Erro ao salvar plano', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
      <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Novo recebimento</p>

      <div className="flex flex-wrap gap-2 items-end">
        {/* Mode */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {(['integral', 'parcelado'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                'px-3 py-1 text-xs font-medium transition-colors',
                mode === m ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {m === 'integral' ? 'À vista' : 'Parcelado'}
            </button>
          ))}
        </div>
        <Input
          type="number" min="0" step="0.01" placeholder="Valor total (R$)"
          value={totalAmount} onChange={e => setTotalAmount(e.target.value)}
          className="h-8 text-xs w-36"
        />
        <Input
          type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          className="h-8 text-xs w-36"
        />
        {mode === 'parcelado' && (
          <Input
            type="number" min="2" max="24" placeholder="Nº parcelas"
            value={numParcelas} onChange={e => setNumParcelas(e.target.value)}
            className="h-8 text-xs w-24"
          />
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs px-3">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 text-xs px-2 text-muted-foreground">
            Cancelar
          </Button>
        </div>
      </div>

      {mode === 'parcelado' && parseFloat(totalAmount) > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {parseInt(numParcelas, 10) || 2}× de {formatCurrency((parseFloat(totalAmount.replace(',', '.')) || 0) / (parseInt(numParcelas, 10) || 2))}
        </p>
      )}
    </div>
  )
}

// ─── Show row (expandable) ────────────────────────────────────────────────────

function ShowRow({
  show, orgId, queryClient, onDataChange,
}: {
  show: FinanceiroShow
  orgId: string
  queryClient: ReturnType<typeof useQueryClient>
  onDataChange: () => void
}) {
  const [open, setOpen]                   = useState(false)
  const [addingPlan, setAddingPlan]       = useState(false)
  const [addingExpense, setAddingExpense] = useState(false)
  const { toast } = useToast()

  const payStatus  = getPaymentStatus(show.payments)
  const config     = STATUS_CONFIG[payStatus]
  const StatusIcon = config.icon
  const expenses   = show.expenses ?? []

  const totalPaid     = show.payments.filter(p => p.paid_at).reduce((s, p) => s + p.amount, 0)
  const totalPending  = show.payments.filter(p => !p.paid_at).reduce((s, p) => s + p.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const resultado     = show.cache_value - totalExpenses

  // ── Optimistic: payments ──────────────────────────────────────────────────
  const patchCachePayment = useCallback((paymentId: string, newPaidAt: string | null) => {
    queryClient.setQueriesData<FinanceiroShow[]>(
      { queryKey: ['financeiro', orgId], exact: false },
      old => old ? old.map(s => ({ ...s, payments: s.payments.map(p => p.id === paymentId ? { ...p, paid_at: newPaidAt } : p) })) : old
    )
  }, [queryClient, orgId])

  // ── Optimistic: expenses ──────────────────────────────────────────────────
  const patchCacheExpense = useCallback((expenseId: string, patch: Partial<ShowExpense>) => {
    queryClient.setQueriesData<FinanceiroShow[]>(
      { queryKey: ['financeiro', orgId], exact: false },
      old => old ? old.map(s => ({
        ...s, expenses: (s.expenses ?? []).map(e => e.id === expenseId ? { ...e, ...patch } : e),
      })) : old
    )
  }, [queryClient, orgId])

  const patchCacheDeleteExpense = useCallback((expenseId: string) => {
    queryClient.setQueriesData<FinanceiroShow[]>(
      { queryKey: ['financeiro', orgId], exact: false },
      old => old ? old.map(s => ({ ...s, expenses: (s.expenses ?? []).filter(e => e.id !== expenseId) })) : old
    )
  }, [queryClient, orgId])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleTogglePaid = useCallback(async (payment: ShowPayment) => {
    const newPaidAt = payment.paid_at ? null : new Date().toISOString()
    patchCachePayment(payment.id, newPaidAt)
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_at: newPaidAt }),
      })
      if (!res.ok) throw new Error()
      onDataChange()
    } catch {
      patchCachePayment(payment.id, payment.paid_at)
      toast({ title: 'Erro ao atualizar pagamento', variant: 'destructive' })
    }
  }, [patchCachePayment, onDataChange, toast])

  const handleDeletePayment = useCallback(async (payment: ShowPayment) => {
    try {
      const res = await fetch(`/api/payments/${payment.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Parcela removida' })
      onDataChange()
    } catch {
      toast({ title: 'Erro ao remover parcela', variant: 'destructive' })
    }
  }, [onDataChange, toast])

  const handleToggleExpensePaid = useCallback(async (expense: ShowExpense) => {
    const newPaid   = !expense.paid
    const newPaidAt = newPaid ? new Date().toISOString() : null
    patchCacheExpense(expense.id, { paid: newPaid, paid_at: newPaidAt })
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: newPaid }),
      })
      if (!res.ok) throw new Error()
      onDataChange()
    } catch {
      patchCacheExpense(expense.id, { paid: expense.paid, paid_at: expense.paid_at })
      toast({ title: 'Erro ao atualizar despesa', variant: 'destructive' })
    }
  }, [patchCacheExpense, onDataChange, toast])

  const handleUpdateExpensePaidAt = useCallback(async (expense: ShowExpense, dateStr: string) => {
    const newPaidAt = dateStr ? new Date(`${dateStr}T12:00:00`).toISOString() : new Date().toISOString()
    patchCacheExpense(expense.id, { paid_at: newPaidAt })
    try {
      await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid_at: newPaidAt }),
      })
      onDataChange()
    } catch {
      patchCacheExpense(expense.id, { paid_at: expense.paid_at })
    }
  }, [patchCacheExpense, onDataChange])

  const handleDeleteExpense = useCallback(async (expense: ShowExpense) => {
    patchCacheDeleteExpense(expense.id)
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Despesa removida' })
      onDataChange()
    } catch {
      onDataChange()
      toast({ title: 'Erro ao remover despesa', variant: 'destructive' })
    }
  }, [patchCacheDeleteExpense, onDataChange, toast])

  return (
    <div className="border-b border-border/40 last:border-b-0">
      {/* ── Main row ── */}
      <button
        onClick={() => { setOpen(v => !v); setAddingPlan(false); setAddingExpense(false) }}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        }
        <span className="w-0.5 h-7 rounded-full shrink-0" style={{ backgroundColor: show.artists?.color ?? '#4A4540' }} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold truncate">{show.title}</span>
            <span className="text-[11px] text-muted-foreground/60 shrink-0 tabular-nums">
              {formatDate(show.start_at, 'dd/MM/yy')}
            </span>
            {show.city && (
              <span className="text-[11px] text-muted-foreground/50 truncate hidden sm:inline">
                {show.city}{show.state ? ` · ${show.state}` : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-muted-foreground">
            {show.artists?.name && <span>{show.artists.name}</span>}
            {totalExpenses > 0 && (
              <span className="text-muted-foreground/50">· {formatCurrency(totalExpenses)} despesas</span>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex flex-col items-end text-[11px] tabular-nums">
            {show.cache_value > 0 && (
              <span className="font-semibold text-foreground text-xs">{formatCurrency(show.cache_value)}</span>
            )}
            {show.payments.length > 0 && (
              <span className="text-muted-foreground">
                {totalPaid > 0 && <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)} rec.</span>}
                {totalPaid > 0 && totalPending > 0 && ' · '}
                {totalPending > 0 && <span>{formatCurrency(totalPending)} pend.</span>}
              </span>
            )}
          </div>
          <span className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0',
            config.className,
          )}>
            <StatusIcon className="h-2.5 w-2.5" />
            {config.label}
          </span>
        </div>
      </button>

      {/* ── Expanded ── */}
      {open && (
        <div className="px-4 pb-4">
          <div className="ml-8 space-y-0.5">

            {/* Show link */}
            <div className="flex justify-end pb-1">
              <Link
                href={`/agenda/${show.id}`}
                className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors"
                onClick={e => e.stopPropagation()}
              >
                Ver show completo <ArrowUpRight className="inline h-2.5 w-2.5" />
              </Link>
            </div>

            {/* ── Recebimentos ── */}
            <SectionDivider
              label="Recebimentos"
              onAdd={() => { setAddingPlan(v => !v); setAddingExpense(false) }}
              addLabel={addingPlan ? 'cancelar' : show.payments.length ? 'parcela' : 'criar plano'}
            />

            {show.payments.length > 0 ? (
              <div className="space-y-0">
                {show.payments.map(p => (
                  <InstallmentRow
                    key={p.id}
                    payment={p}
                    onTogglePaid={handleTogglePaid}
                    onDelete={handleDeletePayment}
                  />
                ))}
                {show.payments.length > 1 && (
                  <div className="flex justify-end pt-1 text-[11px] text-muted-foreground tabular-nums border-t border-border/30 mt-1">
                    <span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totalPaid)}</span>
                      {totalPaid > 0 && totalPending > 0 && ' · '}
                      {totalPending > 0 && <span>{formatCurrency(totalPending)} a receber</span>}
                    </span>
                  </div>
                )}
              </div>
            ) : !addingPlan ? (
              <button
                onClick={() => setAddingPlan(true)}
                className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors py-1 px-2"
              >
                Nenhum recebimento cadastrado — criar plano
              </button>
            ) : null}

            {addingPlan && (
              <div className="mt-2">
                <AddPaymentPlan
                  show={show}
                  onClose={() => setAddingPlan(false)}
                  onSaved={onDataChange}
                />
              </div>
            )}

            {/* ── Despesas ── */}
            <div className="pt-2">
              <SectionDivider
                label="Despesas"
                onAdd={() => { setAddingExpense(v => !v); setAddingPlan(false) }}
                addLabel={addingExpense ? 'cancelar' : 'adicionar'}
              />

              {expenses.length > 0 ? (
                <div className="space-y-0">
                  {expenses.map(e => (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      onTogglePaid={handleToggleExpensePaid}
                      onUpdatePaidAt={handleUpdateExpensePaidAt}
                      onDelete={handleDeleteExpense}
                    />
                  ))}
                  {expenses.length > 1 && (
                    <div className="flex justify-end pt-1 text-[11px] text-muted-foreground tabular-nums border-t border-border/30 mt-1">
                      Total {formatCurrency(totalExpenses)}
                    </div>
                  )}
                </div>
              ) : !addingExpense ? (
                <button
                  onClick={() => setAddingExpense(true)}
                  className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors py-1 px-2"
                >
                  Nenhuma despesa cadastrada
                </button>
              ) : null}

              {addingExpense && (
                <div className="mt-2">
                  <AddExpenseForm
                    showId={show.id}
                    onClose={() => setAddingExpense(false)}
                    onSaved={onDataChange}
                  />
                </div>
              )}
            </div>

            {/* ── Resultado líquido ── */}
            {show.cache_value > 0 && totalExpenses > 0 && (
              <div className="pt-2 flex items-center justify-end gap-3 text-[11px] tabular-nums border-t border-border/30 mt-1">
                <span className="text-muted-foreground/50">
                  {formatCurrency(show.cache_value)} − {formatCurrency(totalExpenses)}
                </span>
                <span className={cn(
                  'font-semibold',
                  resultado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                )}>
                  {resultado >= 0 ? '+' : ''}{formatCurrency(resultado)}
                </span>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}

// ─── Artist group ─────────────────────────────────────────────────────────────

function ArtistGroup({
  artist, shows, orgId, queryClient, onDataChange,
}: {
  artist: { id: string; name: string; color: string; photo_url: string | null }
  shows: FinanceiroShow[]
  orgId: string
  queryClient: ReturnType<typeof useQueryClient>
  onDataChange: () => void
}) {
  const [open, setOpen] = useState(true)

  const totalCache    = shows.reduce((s, sh) => s + (sh.cache_value || 0), 0)
  const totalPaid     = shows.flatMap(s => s.payments).filter(p => p.paid_at).reduce((s, p) => s + p.amount, 0)
  const totalPending  = shows.flatMap(s => s.payments).filter(p => !p.paid_at).reduce((s, p) => s + p.amount, 0)
  const totalExpenses = shows.flatMap(s => s.expenses ?? []).reduce((s, e) => s + e.amount, 0)
  const overdue       = shows.flatMap(s => s.payments).filter(p => !p.paid_at && isBefore(parseISO(p.due_date), new Date()))

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left bg-muted/10"
      >
        {open
          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        }
        <Avatar className="h-7 w-7 shrink-0">
          {artist.photo_url && <AvatarFallback style={{ backgroundColor: artist.color + '22', color: artist.color }} className="text-[10px] font-bold">
            {initials(artist.name)}
          </AvatarFallback>}
          <AvatarFallback style={{ backgroundColor: artist.color + '22', color: artist.color }} className="text-[10px] font-bold">
            {initials(artist.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{artist.name}</p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0 text-[11px] text-muted-foreground mt-0.5">
            <span className="shrink-0">{shows.length} show{shows.length !== 1 ? 's' : ''}</span>
            {totalCache > 0 && <span className="tabular-nums font-medium text-foreground shrink-0">{formatCurrency(totalCache)}</span>}
            {overdue.length > 0 && <span className="text-destructive font-medium shrink-0">{overdue.length} em atraso</span>}
            {totalPaid > 0 && <span className="text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">{formatCurrency(totalPaid)} rec.</span>}
            {totalPending > 0 && <span className="tabular-nums shrink-0">{formatCurrency(totalPending)} pend.</span>}
            {totalExpenses > 0 && <span className="tabular-nums text-muted-foreground/60 shrink-0">{formatCurrency(totalExpenses)} desp.</span>}
          </div>
        </div>
      </button>
      {open && (
        <div className="divide-y divide-border/40">
          {shows.map(show => (
            <ShowRow key={show.id} show={show} orgId={orgId} queryClient={queryClient} onDataChange={onDataChange} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = 'shows' | 'artistas'
type FilterStatus = 'todos' | PaymentStatus

export default function FinanceiroPage() {
  const { orgId, orgName } = useSession()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [period, setPeriod]             = useState<Period>('ano')
  const [filterArtist, setFilterArtist] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
  const [viewMode, setViewMode]         = useState<ViewMode>('shows')
  const [exporting, setExporting]       = useState(false)

  const { from, to } = getPeriodRange(period)
  const { data: shows, isLoading } = useFinanceiro(orgId, from, to, filterArtist || undefined)
  const { data: artistsData } = useArtists(orgId)

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['financeiro', orgId] })
  }, [queryClient, orgId])

  const filteredShows = useMemo(() => {
    if (!shows) return []
    if (filterStatus === 'todos') return shows
    return shows.filter(s => getPaymentStatus(s.payments) === filterStatus)
  }, [shows, filterStatus])

  // ── Metrics ──────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!shows) return { semPlano: 0, totalPendente: 0, totalPago: 0, totalAtrasado: 0, totalDespesas: 0, totalCache: 0 }
    const allPayments = shows.flatMap(s => s.payments)
    const allExpenses = shows.flatMap(s => s.expenses ?? [])
    const now = new Date()
    const totalPago = allPayments.filter(p => p.paid_at).reduce((s, p) => s + p.amount, 0)
    const totalDespesas = allExpenses.reduce((s, e) => s + e.amount, 0)
    return {
      semPlano:      shows.filter(s => !s.payments.length).length,
      totalCache:    shows.reduce((s, sh) => s + sh.cache_value, 0),
      totalPendente: allPayments.filter(p => !p.paid_at).reduce((s, p) => s + p.amount, 0),
      totalPago,
      totalAtrasado: allPayments.filter(p => !p.paid_at && isBefore(parseISO(p.due_date), now)).reduce((s, p) => s + p.amount, 0),
      totalDespesas,
    }
  }, [shows])

  const resultado = metrics.totalPago - metrics.totalDespesas

  const byArtist = useMemo(() => {
    const map = new Map<string, { artist: FinanceiroShow['artists'] & { id: string }; shows: FinanceiroShow[] }>()
    filteredShows.forEach(show => {
      if (!show.artists) return
      const key = show.artist_id
      if (!map.has(key)) map.set(key, { artist: show.artists as { id: string; name: string; color: string; photo_url: string | null }, shows: [] })
      map.get(key)!.shows.push(show)
    })
    return Array.from(map.values()).sort((a, b) => a.artist.name.localeCompare(b.artist.name))
  }, [filteredShows])

  const artists = artistsData?.artists ?? []

  // ── PDF Export ────────────────────────────────────────────────────────────
  async function exportPDF() {
    if (!filteredShows.length) {
      toast({ title: 'Nenhum dado para exportar', variant: 'destructive' }); return
    }
    setExporting(true)
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const now   = new Date()
      const brand: [number, number, number] = [44, 41, 38]
      const gray:  [number, number, number] = [100, 97, 93]
      const green: [number, number, number] = [22, 163, 74]
      const red:   [number, number, number] = [220, 38, 38]
      const blue:  [number, number, number] = [37, 99, 235]
      const pageW = doc.internal.pageSize.getWidth()

      doc.setFillColor(...brand)
      doc.rect(0, 0, pageW, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16); doc.setFont('helvetica', 'bold')
      doc.text('ShowDeck', 14, 11)
      doc.setFontSize(9); doc.setFont('helvetica', 'normal')
      doc.text('Relatório Financeiro', 14, 18)
      doc.setTextColor(200, 196, 192); doc.setFontSize(8)
      doc.text(orgName, pageW - 14, 11, { align: 'right' })
      doc.text(`Gerado em ${format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageW - 14, 18, { align: 'right' })
      const periodStr = period === 'tudo' ? 'Todo o período'
        : `${PERIOD_LABELS[period]}${from ? ` · ${format(new Date(from), 'dd/MM/yyyy')} – ${format(new Date(to!), 'dd/MM/yyyy')}` : ''}`
      doc.text(periodStr, pageW / 2, 24, { align: 'center' })

      let y = 38
      doc.setTextColor(...brand); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Resumo', 14, y)
      y += 6

      const totalExpensesPDF     = filteredShows.flatMap(s => s.expenses ?? []).reduce((s, e) => s + e.amount, 0)
      const resultadoLiquidoPDF  = metrics.totalPago - totalExpensesPDF
      autoTable(doc, {
        startY: y,
        body: [
          ['A Receber',         formatCurrency(metrics.totalPendente)],
          ['Recebido',          formatCurrency(metrics.totalPago)],
          ['Em Atraso',         formatCurrency(metrics.totalAtrasado)],
          ['Total Despesas',    formatCurrency(totalExpensesPDF)],
          ['Resultado Líquido', formatCurrency(resultadoLiquidoPDF)],
          ['Shows sem Plano',   String(metrics.semPlano)],
          ['Total de Shows',    String(filteredShows.length)],
        ],
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: { top: 1.5, bottom: 1.5, left: 3, right: 3 } },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50, textColor: gray },
          1: { cellWidth: 60, textColor: brand },
        },
        margin: { left: 14, right: 14 },
      })
      y = (doc as any).lastAutoTable.finalY + 8

      doc.setTextColor(...brand); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text('Detalhe por Show', 14, y); y += 4

      for (const show of filteredShows) {
        const payStatus        = getPaymentStatus(show.payments)
        const statusLabel      = STATUS_CONFIG[payStatus].label
        const totalShowPaid    = show.payments.filter(p => p.paid_at).reduce((s, p) => s + p.amount, 0)
        const totalShowPending = show.payments.filter(p => !p.paid_at).reduce((s, p) => s + p.amount, 0)
        const showExpenses     = show.expenses ?? []
        const totalShowExp     = showExpenses.reduce((s, e) => s + e.amount, 0)

        autoTable(doc, {
          startY: y,
          head: [[
            { content: show.title, colSpan: 3, styles: { fontStyle: 'bold', fontSize: 9, textColor: [255,255,255] as [number,number,number], fillColor: brand } },
            { content: statusLabel, styles: { fontStyle: 'bold', fontSize: 8, textColor: [255,255,255] as [number,number,number], fillColor: brand, halign: 'right' } },
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
          columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 28 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 35, halign: 'right' } },
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
          if (show.payments.length > 1) rows.push(['', '', 'Total pago / pendente', `${formatCurrency(totalShowPaid)} / ${formatCurrency(totalShowPending)}`])
          autoTable(doc, {
            startY: y,
            head: [['Descrição', 'Vencimento', 'Status', 'Valor']],
            body: rows,
            styles: { fontSize: 7.5, cellPadding: { top: 1.2, bottom: 1.2, left: 4, right: 3 } },
            headStyles: { fillColor: [230, 228, 224] as [number,number,number], textColor: brand, fontStyle: 'bold', fontSize: 7.5 },
            bodyStyles: { textColor: gray },
            margin: { left: 20, right: 14 }, tableWidth: pageW - 34,
            columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 26 }, 2: { cellWidth: 30 }, 3: { cellWidth: 32, halign: 'right' } },
            didParseCell(data) {
              if (data.section === 'body' && data.column.index === 2) {
                const v = String(data.cell.raw)
                if (v.startsWith('Pago em'))  data.cell.styles.textColor = green
                else if (v === 'Em atraso')   data.cell.styles.textColor = red
                else if (v === 'Pendente')    data.cell.styles.textColor = blue
              }
              if (data.section === 'body' && data.row.index === rows.length - 1 && show.payments.length > 1) {
                data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = brand
              }
            },
          })
          y = (doc as any).lastAutoTable.finalY + 2
        } else {
          doc.setFontSize(7.5); doc.setTextColor(...gray); doc.setFont('helvetica', 'italic')
          doc.text('Sem plano de pagamento.', 22, y + 4); y += 8
        }

        // Despesas
        if (showExpenses.length > 0) {
          const expRows: string[][] = showExpenses.map(e => [
            EXPENSE_CATEGORY_CONFIG[e.category as ExpenseCategory]?.label ?? e.category,
            e.description ?? '—',
            e.paid && e.paid_at ? `Paga em ${format(new Date(e.paid_at), 'dd/MM/yyyy')}` : e.paid ? 'Paga' : 'Pendente',
            formatCurrency(e.amount),
          ])
          expRows.push(['', '', 'Total despesas', formatCurrency(totalShowExp)])
          autoTable(doc, {
            startY: y,
            head: [['Categoria', 'Descrição', 'Status', 'Valor']],
            body: expRows,
            styles: { fontSize: 7.5, cellPadding: { top: 1.2, bottom: 1.2, left: 4, right: 3 } },
            headStyles: { fillColor: [243, 240, 235] as [number,number,number], textColor: gray, fontStyle: 'bold', fontSize: 7.5 },
            bodyStyles: { textColor: gray },
            margin: { left: 20, right: 14 }, tableWidth: pageW - 34,
            columnStyles: { 0: { cellWidth: 28 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 32 }, 3: { cellWidth: 32, halign: 'right' } },
            didParseCell(data) {
              if (data.section === 'body' && data.column.index === 2) {
                const v = String(data.cell.raw)
                if (v.startsWith('Paga')) data.cell.styles.textColor = green
                else if (v === 'Pendente') data.cell.styles.textColor = blue
              }
              if (data.section === 'body' && data.row.index === expRows.length - 1) {
                data.cell.styles.fontStyle = 'bold'; data.cell.styles.textColor = brand
              }
            },
          })
          y = (doc as any).lastAutoTable.finalY
          if (show.cache_value > 0) {
            const res = show.cache_value - totalShowExp
            y += 3
            doc.setFontSize(7.5); doc.setFont('helvetica', 'bold')
            doc.setTextColor(...(res >= 0 ? green : red))
            doc.text(`Resultado: ${res >= 0 ? '+' : ''}${formatCurrency(res)}`, pageW - 14, y, { align: 'right' })
            y += 5
          } else { y += 3 }
        }

        if (y > doc.internal.pageSize.getHeight() - 30) { doc.addPage(); y = 16 }
      }

      const totalPages = (doc.internal as any).getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7); doc.setTextColor(...gray); doc.setFont('helvetica', 'normal')
        doc.text(`ShowDeck · ${orgName}`, 14, doc.internal.pageSize.getHeight() - 6)
        doc.text(`Página ${i} de ${totalPages}`, pageW - 14, doc.internal.pageSize.getHeight() - 6, { align: 'right' })
      }

      doc.save(`financeiro-${format(now, 'yyyy-MM-dd')}.pdf`)
      toast({ title: 'PDF exportado!' })
    } catch (err) {
      console.error(err)
      toast({ title: 'Erro ao exportar PDF', variant: 'destructive' })
    } finally { setExporting(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 md:px-6 py-2.5 flex flex-wrap items-center gap-2">

          {/* Period pills */}
          <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150',
                  period === p
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Filters */}
          <select
            value={filterArtist}
            onChange={e => setFilterArtist(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todos os artistas</option>
            {artists.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

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

          <div className="ml-auto flex items-center gap-1">
            {/* View toggle */}
            <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
              <button
                onClick={() => setViewMode('shows')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150',
                  viewMode === 'shows' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Por show</span>
              </button>
              <button
                onClick={() => setViewMode('artistas')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150',
                  viewMode === 'artistas' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Por artista</span>
              </button>
            </div>

            <div className="w-px h-4 bg-border mx-0.5" />

            <button
              onClick={exportPDF}
              disabled={exporting || isLoading || !filteredShows.length}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Exportar PDF"
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-4 space-y-4">

        {/* ── Metric strip ── */}
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <div className="flex items-stretch divide-x divide-border min-w-max">
            {[
              { label: 'Cachê total',    value: formatCurrency(metrics.totalCache),    color: 'text-foreground' },
              { label: 'A receber',      value: formatCurrency(metrics.totalPendente), color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Recebido',       value: formatCurrency(metrics.totalPago),     color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Em atraso',      value: formatCurrency(metrics.totalAtrasado), color: metrics.totalAtrasado > 0 ? 'text-destructive' : 'text-muted-foreground' },
              { label: 'Despesas',       value: formatCurrency(metrics.totalDespesas), color: 'text-foreground' },
              { label: 'Resultado',      value: (resultado >= 0 ? '+' : '') + formatCurrency(resultado), color: resultado >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive' },
              { label: 'Sem plano',      value: String(metrics.semPlano),              color: metrics.semPlano > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground' },
            ].map(m => (
              <div key={m.label} className="px-5 py-3.5 flex flex-col gap-1 min-w-[100px]">
                <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest whitespace-nowrap">
                  {m.label}
                </span>
                <span className={cn('text-sm font-bold tabular-nums whitespace-nowrap', m.color)}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
          </div>
        ) : filteredShows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum show encontrado</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Ajuste o período ou os filtros</p>
          </div>
        ) : viewMode === 'shows' ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/10 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                {filteredShows.length} show{filteredShows.length !== 1 ? 's' : ''}
              </span>
            </div>
            {filteredShows.map(show => (
              <ShowRow key={show.id} show={show} orgId={orgId} queryClient={queryClient} onDataChange={invalidate} />
            ))}
          </div>
        ) : (
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
            {(() => {
              const noArtist = filteredShows.filter(s => !s.artists)
              if (!noArtist.length) return null
              return (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 border-b border-border bg-muted/10">
                    <p className="text-sm font-semibold text-muted-foreground">Sem artista</p>
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
