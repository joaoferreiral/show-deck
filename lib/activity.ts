import { createServiceClient } from '@/lib/supabase/service'

export type ActivityAction =
  | 'show.created'
  | 'show.updated'
  | 'show.deleted'
  | 'artist.created'
  | 'contractor.created'
  | 'member.joined'
  | 'member.removed'
  | 'member.role_changed'
  | 'member.disabled'
  | 'member.enabled'
  | 'invite.created'

interface LogParams {
  orgId: string
  userId: string
  action: ActivityAction
  entityType?: string
  entityId?: string
  entityName?: string
  metadata?: Record<string, unknown>
}

/**
 * Server-side only — call from API routes or Server Actions.
 * Never throws: logging failures are silently swallowed.
 */
export async function logActivity(params: LogParams) {
  try {
    const service = createServiceClient() as any
    await service.from('activity_logs').insert({
      org_id: params.orgId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      entity_name: params.entityName ?? null,
      metadata: params.metadata ?? {},
    })
  } catch {
    // Logging must never break the main flow
  }
}
