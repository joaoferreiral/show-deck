export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ShowStatus = 'pre_reserva' | 'confirmado' | 'contrato_enviado' | 'contrato_assinado' | 'realizado' | 'cancelado'
export type MemberRole = 'owner' | 'empresario' | 'financeiro' | 'contratos' | 'marketing' | 'producao' | 'viewer'
export type PlanType = 'trial' | 'starter' | 'pro' | 'enterprise'
export type ReceivableStatus = 'pendente' | 'parcial' | 'pago' | 'atrasado'
export type ExpenseCategory = 'logistica' | 'hospedagem' | 'pirotecnia' | 'banda' | 'alimentacao' | 'equipamento' | 'outros'
export type AttachmentType = 'contrato' | 'rider' | 'mapa_palco' | 'outros'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          plan: PlanType
          trial_ends_at: string | null
          owner_id: string
          base_city: string | null
          base_state: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          plan?: PlanType
          trial_ends_at?: string | null
          owner_id: string
          base_city?: string | null
          base_state?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          plan?: PlanType
          trial_ends_at?: string | null
          owner_id?: string
          base_city?: string | null
          base_state?: string | null
          settings?: Json
          updated_at?: string
        }
      }
      organization_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: MemberRole
          permissions: Json
          invited_by: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role?: MemberRole
          permissions?: Json
          invited_by?: string | null
          joined_at?: string
        }
        Update: {
          role?: MemberRole
          permissions?: Json
        }
      }
      artists: {
        Row: {
          id: string
          org_id: string
          name: string
          slug: string
          photo_url: string | null
          bio: string | null
          color: string
          social_links: Json
          technical_rider_url: string | null
          contact: Json
          base_city: string | null
          base_state: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          slug: string
          photo_url?: string | null
          bio?: string | null
          color?: string
          social_links?: Json
          technical_rider_url?: string | null
          contact?: Json
          base_city?: string | null
          base_state?: string | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          slug?: string
          photo_url?: string | null
          bio?: string | null
          color?: string
          social_links?: Json
          technical_rider_url?: string | null
          contact?: Json
          base_city?: string | null
          base_state?: string | null
          active?: boolean
          updated_at?: string
        }
      }
      contractors: {
        Row: {
          id: string
          org_id: string
          name: string
          cnpj: string | null
          contact: Json
          city: string | null
          state: string | null
          tags: string[]
          notes: string | null
          rating: number | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          cnpj?: string | null
          contact?: Json
          city?: string | null
          state?: string | null
          tags?: string[]
          notes?: string | null
          rating?: number | null
          active?: boolean
        }
        Update: {
          name?: string
          cnpj?: string | null
          contact?: Json
          city?: string | null
          state?: string | null
          tags?: string[]
          notes?: string | null
          rating?: number | null
          active?: boolean
          updated_at?: string
        }
      }
      local_partners: {
        Row: {
          id: string
          org_id: string
          name: string
          cnpj: string | null
          contact: Json
          city: string | null
          state: string | null
          commission_default: number
          notes: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          cnpj?: string | null
          contact?: Json
          city?: string | null
          state?: string | null
          commission_default?: number
          notes?: string | null
          active?: boolean
        }
        Update: {
          name?: string
          cnpj?: string | null
          contact?: Json
          city?: string | null
          state?: string | null
          commission_default?: number
          notes?: string | null
          active?: boolean
          updated_at?: string
        }
      }
      shows: {
        Row: {
          id: string
          org_id: string
          artist_id: string
          contractor_id: string | null
          local_partner_id: string | null
          title: string
          status: ShowStatus
          start_at: string
          end_at: string | null
          venue_name: string | null
          address: string | null
          city: string | null
          state: string | null
          lat: number | null
          lng: number | null
          cache_value: number
          production_value: number
          currency: string
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          artist_id: string
          contractor_id?: string | null
          local_partner_id?: string | null
          title: string
          status?: ShowStatus
          start_at: string
          end_at?: string | null
          venue_name?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          lat?: number | null
          lng?: number | null
          cache_value?: number
          production_value?: number
          currency?: string
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          artist_id?: string
          contractor_id?: string | null
          local_partner_id?: string | null
          title?: string
          status?: ShowStatus
          start_at?: string
          end_at?: string | null
          venue_name?: string | null
          address?: string | null
          city?: string | null
          state?: string | null
          lat?: number | null
          lng?: number | null
          cache_value?: number
          production_value?: number
          currency?: string
          notes?: string | null
          updated_at?: string
        }
      }
      receivables: {
        Row: {
          id: string
          show_id: string
          org_id: string
          description: string | null
          due_date: string
          amount: number
          status: ReceivableStatus
          paid_at: string | null
          payment_method: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          show_id: string
          org_id: string
          description?: string | null
          due_date: string
          amount: number
          status?: ReceivableStatus
          paid_at?: string | null
          payment_method?: string | null
          notes?: string | null
        }
        Update: {
          description?: string | null
          due_date?: string
          amount?: number
          status?: ReceivableStatus
          paid_at?: string | null
          payment_method?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          show_id: string
          org_id: string
          category: ExpenseCategory
          description: string | null
          amount: number
          paid: boolean
          paid_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          show_id: string
          org_id: string
          category?: ExpenseCategory
          description?: string | null
          amount: number
          paid?: boolean
          paid_at?: string | null
          notes?: string | null
        }
        Update: {
          category?: ExpenseCategory
          description?: string | null
          amount?: number
          paid?: boolean
          paid_at?: string | null
          notes?: string | null
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          org_id: string
          user_id: string
          type: string
          title: string
          body: string | null
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          type: string
          title: string
          body?: string | null
          link?: string | null
          read?: boolean
        }
        Update: {
          read?: boolean
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      get_user_org_id: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: {
      show_status: ShowStatus
      member_role: MemberRole
      plan_type: PlanType
      receivable_status: ReceivableStatus
      expense_category: ExpenseCategory
      attachment_type: AttachmentType
    }
  }
}
