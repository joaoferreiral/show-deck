'use client'

import { TrendingUp, Receipt, PiggyBank, BarChart3, FileSpreadsheet, Wallet, ArrowRight } from 'lucide-react'

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Fluxo de Caixa',
    description: 'Visão completa de entradas e saídas por período, com projeções baseadas em shows confirmados.',
  },
  {
    icon: Receipt,
    title: 'Recebíveis e Cachês',
    description: 'Controle de pagamentos por show: pendentes, parciais, recebidos e em atraso.',
  },
  {
    icon: Wallet,
    title: 'Despesas e Custos',
    description: 'Registro de despesas por categoria (produção, transporte, hospedagem, rider técnico).',
  },
  {
    icon: FileSpreadsheet,
    title: 'Contratos Financeiros',
    description: 'Gestão de cachê colocado, bilheteria, garantias e percentuais por tipo de negociação.',
  },
  {
    icon: BarChart3,
    title: 'Relatórios e Gráficos',
    description: 'DRE simplificado, evolução de receita por artista, sazonalidade e comparativos.',
  },
  {
    icon: PiggyBank,
    title: 'Metas e Previsões',
    description: 'Defina metas de faturamento por artista e acompanhe o progresso em tempo real.',
  },
]

export default function FinanceiroPage() {
  return (
    <div className="flex flex-col min-h-full items-center justify-center px-4 py-16">

      {/* Badge */}
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-8">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        Em Desenvolvimento
      </div>

      {/* Heading */}
      <div className="text-center max-w-md mb-12">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Módulo Financeiro</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Estamos construindo uma gestão financeira completa para shows e artistas.
          Em breve você terá controle total sobre cachês, recebíveis e despesas.
        </p>
      </div>

      {/* Feature grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl mb-12">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group relative rounded-xl border bg-card p-5 transition-colors hover:border-primary/30 hover:bg-primary/5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>

            {/* Locked overlay hint */}
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="h-3.5 w-3.5 text-primary/50" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground/60 text-center">
        As funcionalidades financeiras estarão disponíveis em breve. <br />
        Os dados de cachê inseridos nos shows já estão sendo registrados.
      </p>

    </div>
  )
}
