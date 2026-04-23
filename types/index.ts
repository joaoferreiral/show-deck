import type { Database, ShowStatus, MemberRole } from './supabase'

export type Organization = Database['public']['Tables']['organizations']['Row']
export type OrganizationMember = Database['public']['Tables']['organization_members']['Row']
export type Artist = Database['public']['Tables']['artists']['Row']
export type Contractor = Database['public']['Tables']['contractors']['Row']
export type LocalPartner = Database['public']['Tables']['local_partners']['Row']
export type Show = Database['public']['Tables']['shows']['Row']
export type Receivable = Database['public']['Tables']['receivables']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

export type ShowWithRelations = Show & {
  artist?: Artist
  contractor?: Contractor | null
  local_partner?: LocalPartner | null
  receivables?: Receivable[]
  expenses?: Expense[]
}

export type { ShowStatus, MemberRole }

export const SHOW_STATUS_LABELS: Record<ShowStatus, string> = {
  pre_reserva: 'Pré-reserva',
  confirmado: 'Confirmado',
  contrato_enviado: 'Contrato Enviado',
  contrato_assinado: 'Contrato Assinado',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const SHOW_STATUS_COLORS: Record<ShowStatus, string> = {
  pre_reserva: '#71717a',
  confirmado: '#10b981',
  contrato_enviado: '#f59e0b',
  contrato_assinado: '#059669',
  realizado: '#3b82f6',
  cancelado: '#ef4444',
}

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Proprietário',
  empresario: 'Empresário',
  financeiro: 'Financeiro',
  contratos: 'Contratos',
  marketing: 'Marketing',
  producao: 'Produção',
  viewer: 'Visualizador',
}

export const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
]

export interface NavItem {
  label: string
  href: string
  icon: string
  badge?: number
}

export interface DashboardKPI {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
}
