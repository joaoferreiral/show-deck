'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Users, Link2, Copy, Check, RefreshCw, Loader2, Trash2,
  ShieldCheck, UserCheck, Crown, Activity, Calendar,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { initials } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = {
  userId: string
  role: 'owner' | 'admin' | 'member'
  email: string
  name: string | null
  isMe: boolean
  createdAt: string
}

type LogEntry = {
  id: string
  action: string
  entity_type: string | null
  entity_name: string | null
  metadata: Record<string, string> | null
  created_at: string
  email: string | null
  name: string | null
  user_id: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
}

const ROLE_ICON: Record<string, React.ElementType> = {
  owner: Crown,
  admin: ShieldCheck,
  member: UserCheck,
}

const ROLE_BADGE_CLASS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  admin: 'bg-primary/10 text-primary',
  member: 'bg-muted text-muted-foreground',
}

function actionLabel(entry: LogEntry): string {
  const who = entry.name ?? entry.email ?? 'Alguém'
  const what = entry.entity_name ? `"${entry.entity_name}"` : ''
  switch (entry.action) {
    case 'show.created':    return `${who} criou o show ${what}`
    case 'show.updated':    return `${who} atualizou ${what}`
    case 'show.deleted':    return `${who} excluiu ${what}`
    case 'artist.created':  return `${who} adicionou o artista ${what}`
    case 'contractor.created': return `${who} adicionou o contratante ${what}`
    case 'member.joined':   return `${who} entrou na organização`
    case 'member.removed':  return `${who} removeu ${what}`
    case 'member.role_changed': {
      const from = ROLE_LABEL[entry.metadata?.from ?? ''] ?? entry.metadata?.from
      const to   = ROLE_LABEL[entry.metadata?.to   ?? ''] ?? entry.metadata?.to
      return `${who} alterou o perfil de ${what} de ${from} para ${to}`
    }
    case 'invite.created':  return `${who} gerou um link de convite`
    default: return `${who} realizou uma ação`
  }
}

function actionIcon(action: string) {
  if (action.startsWith('show'))       return '🎤'
  if (action.startsWith('artist'))     return '🎸'
  if (action.startsWith('contractor')) return '🏢'
  if (action.startsWith('member'))     return '👤'
  if (action.startsWith('invite'))     return '🔗'
  return '📋'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EquipePage() {
  const { orgId, userRole } = useSession()
  const { toast } = useToast()

  const isOwner = userRole === 'owner'
  const canManage = userRole === 'owner' || userRole === 'admin'

  // Members
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)

  // Invite
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  // Activity
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    const res = await fetch('/api/org/members')
    const data = await res.json()
    setMembers(data.members ?? [])
    setMembersLoading(false)
  }, [])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    const res = await fetch('/api/org/activity?limit=30')
    const data = await res.json()
    setLogs(data.logs ?? [])
    setLogsLoading(false)
  }, [])

  useEffect(() => { loadMembers(); loadLogs() }, [loadMembers, loadLogs])

  // ── Generate invite ──────────────────────────────────────────────────────
  async function generateInvite() {
    setGenerating(true)
    const res = await fetch('/api/invites/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      setInviteLink(data.link)
      // Reload logs to show the invite.created entry
      loadLogs()
    }
    setGenerating(false)
  }

  async function copyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Remove member ────────────────────────────────────────────────────────
  async function removeMember(userId: string) {
    setRemovingId(userId)
    const res = await fetch('/api/org/members/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      toast({ title: 'Membro removido' })
      loadMembers()
      loadLogs()
    }
    setRemovingId(null)
  }

  // ── Change role ──────────────────────────────────────────────────────────
  async function changeRole(userId: string, newRole: string) {
    setChangingRoleId(userId)
    const res = await fetch('/api/org/members/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId, newRole }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      toast({ title: 'Perfil atualizado' })
      loadMembers()
      loadLogs()
    }
    setChangingRoleId(null)
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie os membros da organização e acompanhe a atividade recente.
        </p>
      </div>

      {/* ── Membros ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Membros
              {!membersLoading && (
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {members.length}
                </span>
              )}
            </CardTitle>
            {canManage && (
              <div className="flex items-center gap-2">
                {inviteLink ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      readOnly
                      value={inviteLink}
                      className="h-8 w-52 text-xs font-mono bg-muted border-dashed"
                    />
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0" onClick={copyLink}>
                      {copied
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={generateInvite}
                      disabled={generating}
                      title="Gerar novo link"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={generateInvite} disabled={generating} className="h-8 gap-1.5">
                    {generating
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Link2 className="h-3.5 w-3.5" />}
                    Convidar membro
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {membersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {members.map(m => {
                const RoleIcon = ROLE_ICON[m.role] ?? UserCheck
                const canEdit = isOwner && !m.isMe && m.role !== 'owner'
                const canRemove = canManage && !m.isMe && m.role !== 'owner'
                  && !(userRole === 'admin' && m.role === 'admin')

                return (
                  <div key={m.userId} className="flex items-center gap-3 py-3">
                    {/* Avatar */}
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs font-bold bg-primary/15 text-primary">
                        {initials(m.name || m.email)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">
                        {m.name ?? m.email}
                        {m.isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}
                      </p>
                      {m.name && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{m.email}</p>
                      )}
                    </div>

                    {/* Role badge / select */}
                    {canEdit ? (
                      <Select
                        value={m.role}
                        onValueChange={val => changeRole(m.userId, val)}
                        disabled={changingRoleId === m.userId}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs gap-1">
                          {changingRoleId === m.userId
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <RoleIcon className="h-3 w-3" />}
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin" className="text-xs">Administrador</SelectItem>
                          <SelectItem value="member" className="text-xs">Membro</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE_CLASS[m.role]}`}>
                        <RoleIcon className="h-3 w-3" />
                        {ROLE_LABEL[m.role]}
                      </span>
                    )}

                    {/* Remove button */}
                    {canRemove ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            disabled={removingId === m.userId}
                            title="Remover membro"
                          >
                            {removingId === m.userId
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{m.name ?? m.email}</strong> perderá o acesso à organização imediatamente.
                              Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => removeMember(m.userId)}
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <div className="w-7 shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Invite link helper text */}
          {canManage && !inviteLink && (
            <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-3">
              O link de convite expira em 7 dias e só pode ser usado uma vez.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Atividade recente ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            Atividade recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
              <p className="text-xs text-muted-foreground/60">As ações da equipe aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {logs.map((entry, i) => (
                <div key={entry.id ?? i} className="flex items-start gap-3 py-2.5 border-b border-border/50 last:border-0">
                  {/* Emoji icon */}
                  <span className="text-base mt-0.5 shrink-0 select-none" aria-hidden>
                    {actionIcon(entry.action)}
                  </span>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">{actionLabel(entry)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
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
