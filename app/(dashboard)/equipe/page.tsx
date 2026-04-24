'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Users, Check, Loader2, Trash2, ShieldCheck, UserCheck, Crown,
  Activity, Calendar, Send, Mail, MailCheck, Clock, X, PowerOff, Power,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { initials, cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = {
  userId: string
  role: 'owner' | 'admin' | 'member'
  email: string
  name: string | null
  isMe: boolean
  createdAt: string
  disabled: boolean
}

type PendingInvite = {
  id: string
  token: string
  invited_email: string
  role: string
  expires_at: string
  created_at: string
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
    case 'show.created':       return `${who} criou o show ${what}`
    case 'show.updated':       return `${who} atualizou ${what}`
    case 'show.deleted':       return `${who} excluiu ${what}`
    case 'artist.created':     return `${who} adicionou o artista ${what}`
    case 'contractor.created': return `${who} adicionou o contratante ${what}`
    case 'member.joined':      return `${who} entrou na organização`
    case 'member.removed':     return `${who} removeu ${what}`
    case 'member.disabled':    return `${who} desativou ${what}`
    case 'member.enabled':     return `${who} reativou ${what}`
    case 'member.role_changed': {
      const from = ROLE_LABEL[entry.metadata?.from ?? ''] ?? entry.metadata?.from
      const to   = ROLE_LABEL[entry.metadata?.to   ?? ''] ?? entry.metadata?.to
      return `${who} alterou o perfil de ${what} de ${from} para ${to}`
    }
    case 'invite.created': return `${who} convidou ${entry.metadata?.invited_email ?? what}`
    default: return `${who} realizou uma ação`
  }
}

function actionIcon(action: string) {
  if (action.startsWith('show'))       return '🎤'
  if (action.startsWith('artist'))     return '🎸'
  if (action.startsWith('contractor')) return '🏢'
  if (action === 'member.disabled')    return '🔒'
  if (action === 'member.enabled')     return '🔓'
  if (action.startsWith('member'))     return '👤'
  if (action.startsWith('invite'))     return '✉️'
  return '📋'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EquipePage() {
  const { orgId, userRole } = useSession()
  const { toast } = useToast()

  const isOwner   = userRole === 'owner'
  const canManage = userRole === 'owner' || userRole === 'admin'

  // Members
  const [members, setMembers]           = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [removingId, setRemovingId]     = useState<string | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)
  const [togglingId, setTogglingId]     = useState<string | null>(null)

  // Pending invites
  const [pendingInvites, setPendingInvites]         = useState<PendingInvite[]>([])
  const [pendingLoading, setPendingLoading]         = useState(true)
  const [cancellingToken, setCancellingToken]       = useState<string | null>(null)

  // Send invite
  const [inviteEmail, setInviteEmail] = useState('')
  const [sending, setSending]         = useState(false)
  const [sentTo, setSentTo]           = useState<string | null>(null)

  // Activity
  const [logs, setLogs]               = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(true)

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res  = await fetch('/api/org/members')
      const data = await res.json()
      if (res.ok) setMembers(data.members ?? [])
    } catch { /* silent */ } finally { setMembersLoading(false) }
  }, [])

  const loadInvites = useCallback(async () => {
    setPendingLoading(true)
    try {
      const res  = await fetch('/api/org/invites')
      const data = await res.json()
      if (res.ok) setPendingInvites(data.invites ?? [])
    } catch { /* silent */ } finally { setPendingLoading(false) }
  }, [])

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const res  = await fetch('/api/org/activity?limit=30')
      const data = await res.json()
      if (res.ok) setLogs(data.logs ?? [])
    } catch { /* silent */ } finally { setLogsLoading(false) }
  }, [])

  useEffect(() => { loadMembers(); loadInvites(); loadLogs() }, [loadMembers, loadInvites, loadLogs])

  // ── Send invite ───────────────────────────────────────────────────────────

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setSending(true)
    setSentTo(null)
    try {
      const res  = await fetch('/api/invites/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), orgId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao enviar convite', description: data.error, variant: 'destructive' })
      } else {
        setSentTo(inviteEmail.trim())
        setInviteEmail('')
        loadInvites()
        loadLogs()
        toast({
          title: data.emailSent ? 'Convite enviado!' : 'Convite criado',
          description: data.emailSent
            ? `E-mail enviado para ${inviteEmail.trim()}`
            : `${inviteEmail.trim()} verá o convite ao fazer login.`,
        })
      }
    } catch {
      toast({ title: 'Erro de conexão', variant: 'destructive' })
    } finally {
      setSending(false)
    }
  }

  // ── Cancel invite ─────────────────────────────────────────────────────────

  async function cancelInvite(token: string) {
    setCancellingToken(token)
    try {
      const res = await fetch('/api/org/invites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (res.ok) {
        setPendingInvites(prev => prev.filter(i => i.token !== token))
        toast({ title: 'Convite cancelado' })
      }
    } catch {
      toast({ title: 'Erro ao cancelar convite', variant: 'destructive' })
    } finally {
      setCancellingToken(null)
    }
  }

  // ── Remove member ─────────────────────────────────────────────────────────

  async function removeMember(userId: string) {
    setRemovingId(userId)
    const res  = await fetch('/api/org/members/remove', {
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

  // ── Toggle status ─────────────────────────────────────────────────────────

  async function toggleStatus(userId: string) {
    setTogglingId(userId)
    const res  = await fetch('/api/org/members/toggle-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: 'Erro', description: data.error, variant: 'destructive' })
    } else {
      const nowDisabled: boolean = data.disabled
      setMembers(prev =>
        prev.map(m => m.userId === userId ? { ...m, disabled: nowDisabled } : m)
      )
      toast({ title: nowDisabled ? 'Membro desativado' : 'Membro reativado' })
      loadLogs()
    }
    setTogglingId(null)
  }

  // ── Change role ───────────────────────────────────────────────────────────

  async function changeRole(userId: string, newRole: string) {
    setChangingRoleId(userId)
    const res  = await fetch('/api/org/members/role', {
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
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie membros, convites e acompanhe a atividade recente.
        </p>
      </div>

      {/* ── Membros ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Users className="h-3.5 w-3.5" />
            Membros
            {!membersLoading && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                {members.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          {membersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {members.map(m => {
                const RoleIcon = ROLE_ICON[m.role] ?? UserCheck
                const canEdit   = isOwner && !m.isMe && m.role !== 'owner'
                const canRemove = canManage && !m.isMe && m.role !== 'owner'
                  && !(userRole === 'admin' && m.role === 'admin')
                const canToggle = canRemove

                return (
                  <div
                    key={m.userId}
                    className={cn('flex items-center gap-3 py-3 transition-opacity', m.disabled && 'opacity-50')}
                  >
                    {/* Avatar */}
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className={cn(
                        'text-xs font-bold',
                        m.disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/15 text-primary'
                      )}>
                        {initials(m.name || m.email)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium leading-none truncate">
                          {m.name ?? m.email}
                          {m.isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}
                        </p>
                        {m.disabled && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            <PowerOff className="h-2.5 w-2.5" />
                            Desativado
                          </span>
                        )}
                      </div>
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
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                        ROLE_BADGE_CLASS[m.role]
                      )}>
                        <RoleIcon className="h-3 w-3" />
                        {ROLE_LABEL[m.role]}
                      </span>
                    )}

                    {/* Toggle disable */}
                    {canToggle && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-7 w-7 shrink-0 transition-colors',
                          m.disabled
                            ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30'
                            : 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                        )}
                        title={m.disabled ? 'Reativar membro' : 'Desativar temporariamente'}
                        disabled={togglingId === m.userId}
                        onClick={() => toggleStatus(m.userId)}
                      >
                        {togglingId === m.userId
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : m.disabled
                            ? <Power className="h-3.5 w-3.5" />
                            : <PowerOff className="h-3.5 w-3.5" />
                        }
                      </Button>
                    )}

                    {/* Remove */}
                    {canRemove ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
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
                      <div className={cn('shrink-0', canToggle ? 'w-0' : 'w-7')} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Convites enviados ─────────────────────────────────────────────────── */}
      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MailCheck className="h-3.5 w-3.5" />
              Convites enviados
              {!pendingLoading && pendingInvites.length > 0 && (
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {pendingInvites.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-0 space-y-4">
            {/* Pending list */}
            {pendingLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : pendingInvites.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 py-2">Nenhum convite pendente.</p>
            ) : (
              <div className="divide-y divide-border">
                {pendingInvites.map(inv => (
                  <div key={inv.token} className="flex items-center gap-3 py-2.5">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.invited_email}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground">
                          {ROLE_LABEL[inv.role] ?? inv.role}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          Expira {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      title="Cancelar convite"
                      disabled={cancellingToken === inv.token}
                      onClick={() => cancelInvite(inv.token)}
                    >
                      {cancellingToken === inv.token
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <X className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Invite form */}
            <div className="pt-2 border-t border-border space-y-2">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Convidar por e-mail
              </p>
              <form onSubmit={sendInvite} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={e => { setInviteEmail(e.target.value); setSentTo(null) }}
                  className="flex-1 h-8 text-sm"
                  required
                />
                <Button type="submit" size="sm" className="h-8 gap-1.5 shrink-0" disabled={sending}>
                  {sending
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />}
                  Enviar
                </Button>
              </form>
              {sentTo && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Convite enviado para {sentTo}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground/60">
                O convite expira em 7 dias e é de uso único.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Atividade recente ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            Atividade recente
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
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
                  <span className="text-base mt-0.5 shrink-0 select-none" aria-hidden>
                    {actionIcon(entry.action)}
                  </span>
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
