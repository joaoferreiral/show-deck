'use client'

import { useState } from 'react'
import {
  Music2, Building2, Crown, ShieldCheck, UserCheck,
  Loader2, Trash2, TriangleAlert, Plus, LogOut,
  CheckCircle2, XCircle, ChevronRight,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { initials, cn } from '@/lib/utils'
import Link from 'next/link'

interface OrgEntry {
  id: string
  name: string
  role: 'owner' | 'admin' | 'member'
}

interface InviteEntry {
  token: string
  role: string
  orgId: string
  orgName: string
}

interface Props {
  orgs: OrgEntry[]
  invites: InviteEntry[]
  user: { name: string; email: string; avatar: string | null }
}

const ROLE_ICON = {
  owner: Crown,
  admin: ShieldCheck,
  member: UserCheck,
}
const ROLE_LABEL = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
}
const ROLE_COLOR = {
  owner: 'text-amber-500',
  admin: 'text-primary',
  member: 'text-muted-foreground',
}

export function OrgSelectClient({ orgs: initialOrgs, invites: initialInvites, user }: Props) {
  const [orgs, setOrgs] = useState(initialOrgs)
  const [invites, setInvites] = useState(initialInvites)
  const [enteringId, setEnteringId] = useState<string | null>(null)
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null)
  const [decliningToken, setDecliningToken] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { toast } = useToast()

  // ── Enter org ──────────────────────────────────────────────────────────────
  async function enterOrg(orgId: string) {
    setEnteringId(orgId)
    await fetch('/api/org/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    })
    window.location.href = '/dashboard'
  }

  // ── Accept invite ──────────────────────────────────────────────────────────
  async function acceptInvite(token: string, orgId: string) {
    setAcceptingToken(token)
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao aceitar convite', description: data.error, variant: 'destructive' })
        return
      }
      // Set the org cookie and go to dashboard
      await fetch('/api/org/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      window.location.href = '/dashboard'
    } catch {
      toast({ title: 'Erro ao aceitar convite', variant: 'destructive' })
    } finally {
      setAcceptingToken(null)
    }
  }

  // ── Decline invite ─────────────────────────────────────────────────────────
  async function declineInvite(token: string) {
    setDecliningToken(token)
    try {
      await fetch('/api/invites/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      setInvites(prev => prev.filter(i => i.token !== token))
    } catch {
      toast({ title: 'Erro ao recusar convite', variant: 'destructive' })
    } finally {
      setDecliningToken(null)
    }
  }

  // ── Delete org ─────────────────────────────────────────────────────────────
  async function deleteOrg(orgId: string) {
    setDeletingId(orgId)
    try {
      const res = await fetch('/api/org/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao excluir organização', description: data.error, variant: 'destructive' })
        return
      }
      const remaining = orgs.filter(o => o.id !== orgId)
      if (remaining.length === 0 && invites.length === 0) {
        window.location.href = '/onboarding'
        return
      }
      if (remaining.length === 1 && invites.length === 0) {
        // Auto-enter the only remaining org
        await enterOrg(remaining[0].id)
        return
      }
      setOrgs(remaining)
    } catch {
      toast({ title: 'Erro ao excluir organização', variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Music2 className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold text-base">ShowDeck</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-start justify-center pt-10 pb-16 px-4">
        <div className="w-full max-w-md space-y-6">

          {/* User greeting */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              {user.avatar && <AvatarImage src={user.avatar} alt={user.name} className="object-cover" />}
              <AvatarFallback className="text-base font-bold bg-primary/15 text-primary">
                {initials(user.name || user.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold truncate">{user.name || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          {/* Pending invites */}
          {invites.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-1">
                Convites pendentes
              </p>
              <div className="space-y-2">
                {invites.map(invite => (
                  <div
                    key={invite.token}
                    className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{invite.orgName}</p>
                        <p className="text-xs text-muted-foreground">
                          Você foi convidado como{' '}
                          <span className="font-medium text-foreground">
                            {ROLE_LABEL[invite.role as keyof typeof ROLE_LABEL] ?? invite.role}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={() => acceptInvite(invite.token, invite.orgId)}
                        disabled={!!acceptingToken || !!decliningToken}
                      >
                        {acceptingToken === invite.token
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <CheckCircle2 className="h-3.5 w-3.5" />
                        }
                        Aceitar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 text-muted-foreground"
                        onClick={() => declineInvite(invite.token)}
                        disabled={!!acceptingToken || !!decliningToken}
                      >
                        {decliningToken === invite.token
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <XCircle className="h-3.5 w-3.5" />
                        }
                        Recusar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Org list */}
          {orgs.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-1">
                Suas organizações
              </p>
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {orgs.map(org => {
                  const RoleIcon = ROLE_ICON[org.role]
                  const isEntering = enteringId === org.id
                  const isDeleting = deletingId === org.id

                  return (
                    <div key={org.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/40 transition-colors">
                      {/* Org icon */}
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary shrink-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{org.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <RoleIcon className={cn('h-3 w-3', ROLE_COLOR[org.role])} />
                          <span className="text-[11px] text-muted-foreground">{ROLE_LABEL[org.role]}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Delete (owner only) */}
                        {org.role === 'owner' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                                disabled={isEntering || isDeleting}
                              >
                                {isDeleting
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Trash2 className="h-3.5 w-3.5" />
                                }
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <TriangleAlert className="h-5 w-5 text-destructive" />
                                  Excluir &quot;{org.name}&quot;?
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                  <div className="space-y-2 text-sm text-muted-foreground">
                                    <p>
                                      Esta ação é <strong className="text-foreground">permanente e irreversível</strong>.
                                      Todos os dados serão excluídos:
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                      <li>Todos os shows e agenda</li>
                                      <li>Todos os membros da equipe</li>
                                      <li>Todos os convites pendentes</li>
                                      <li>Todo o histórico de atividades</li>
                                    </ul>
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteOrg(org.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  Sim, excluir tudo
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}

                        {/* Enter */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1 h-8 px-3 text-primary hover:bg-primary/10"
                          onClick={() => enterOrg(org.id)}
                          disabled={!!enteringId || !!deletingId}
                        >
                          {isEntering
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <ChevronRight className="h-3.5 w-3.5" />
                          }
                          {isEntering ? 'Entrando...' : 'Entrar'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Create new org */}
          <Link
            href="/onboarding"
            className="flex items-center gap-2 w-full rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 hover:bg-muted/30 transition-all"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Nova organização
          </Link>
        </div>
      </main>
    </div>
  )
}
