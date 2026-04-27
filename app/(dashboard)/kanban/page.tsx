import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { KanbanBoard } from './kanban-board'
import type { KanbanColumn, KanbanCard } from './kanban-board'

async function resolveOrgId(userId: string): Promise<string | null> {
  const cookieStore = await cookies()
  const savedOrgId = cookieStore.get('showdeck_org')?.value
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any
  const { data: memberships } = await sb
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
  if (!memberships?.length) return null
  const match = (memberships as any[]).find((m: { org_id: string }) => m.org_id === savedOrgId)
  return (match ?? memberships[0]).org_id as string
}

export default async function KanbanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const orgId = await resolveOrgId(user.id)
  if (!orgId) redirect('/onboarding')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceClient() as any

  const [{ data: columnsRaw }, { data: cardsRaw }] = await Promise.all([
    sb.from('kanban_columns').select('id, name, color, position').eq('org_id', orgId).order('position'),
    sb.from('kanban_cards').select('id, column_id, title, description, tag_label, tag_color, position').eq('org_id', orgId).order('position'),
  ])

  const columns: KanbanColumn[] = columnsRaw ?? []
  const cards: KanbanCard[] = cardsRaw ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Quadro</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {columns.length} coluna{columns.length !== 1 ? 's' : ''} · {cards.length} card{cards.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Board — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard initialColumns={columns} initialCards={cards} />
      </div>
    </div>
  )
}
