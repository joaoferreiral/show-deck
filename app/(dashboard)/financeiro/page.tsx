'use client'

import { useSession } from '@/components/providers/session-provider'
import { useFinanceiro } from '@/lib/hooks/queries'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react'

const receivableStatusColors: Record<string, string> = {
  pendente: '#f59e0b',
  parcial: '#3b82f6',
  pago: '#10b981',
  atrasado: '#ef4444',
}
const receivableStatusLabels: Record<string, string> = {
  pendente: 'Pendente',
  parcial: 'Parcial',
  pago: 'Pago',
  atrasado: 'Atrasado',
}

export default function FinanceiroPage() {
  const { orgId } = useSession()
  const { data, isLoading } = useFinanceiro(orgId)

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-28" />
            </CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent></Card>
      </div>
    )
  }

  const { receivables, expenses } = data

  const totalReceivable = receivables.filter((r) => ['pendente', 'parcial'].includes(r.status)).reduce((s, r) => s + r.amount, 0)
  const totalReceived = receivables.filter((r) => r.status === 'pago').reduce((s, r) => s + r.amount, 0)
  const totalOverdue = receivables.filter((r) => r.status === 'atrasado').reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenses.filter((e) => !e.paid).reduce((s, e) => s + e.amount, 0)

  const kpis = [
    { label: 'A receber', value: formatCurrency(totalReceivable), icon: TrendingUp, color: 'text-amber-500' },
    { label: 'Recebido', value: formatCurrency(totalReceived), icon: CheckCircle2, color: 'text-emerald-500' },
    { label: 'Em atraso', value: formatCurrency(totalOverdue), icon: AlertCircle, color: 'text-red-500' },
    { label: 'Despesas pendentes', value: formatCurrency(totalExpenses), icon: TrendingDown, color: 'text-rose-500' },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold mt-1">{kpi.value}</p>
                </div>
                <kpi.icon className={`h-5 w-5 mt-0.5 ${kpi.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Recebíveis</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!receivables.length ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nenhum recebível cadastrado.</p>
          ) : (
            <div className="divide-y divide-border">
              {receivables.map((r) => (
                <div key={r.id} className="flex items-center gap-4 px-6 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.description ?? r.shows?.title ?? 'Recebível'}</p>
                    {r.shows && (
                      <p className="text-xs text-muted-foreground">
                        {r.shows.title} · {r.shows.artists?.name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">Vencimento: {formatDate(r.due_date)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(r.amount)}</p>
                    <Badge
                      className="text-[10px] mt-1"
                      style={{
                        backgroundColor: `${receivableStatusColors[r.status]}20`,
                        color: receivableStatusColors[r.status],
                        border: 'none',
                      }}
                    >
                      {receivableStatusLabels[r.status]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Despesas Recentes</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!expenses.length ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nenhuma despesa cadastrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-4 px-6 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.description ?? e.category}</p>
                    {e.shows && <p className="text-xs text-muted-foreground">{e.shows.title}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(e.amount)}</p>
                    <Badge variant={e.paid ? 'outline' : 'secondary'} className="text-[10px]">
                      {e.paid ? 'Pago' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
