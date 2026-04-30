'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useSession } from '@/components/providers/session-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/utils'
import {
  X, LogOut, Sun, MoonStar, Check, Plus, Music2,
  Mail, UserCircle, Settings, ChevronRight,
} from 'lucide-react'

type PendingInvite = {
  token: string
  orgId: string
  orgName: string
  role: string
}

type Props = {
  open: boolean
  onClose: () => void
}

export function MobileDrawer({ open, onClose }: Props) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { orgId, orgName, userName, userEmail, userAvatar, userRole, allOrgs } = useSession()
  const [invite, setInvite] = useState<PendingInvite | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)

  // Load pending invite when drawer opens
  useEffect(() => {
    if (!open) return
    fetch('/api/invites/check-email')
      .then(r => r.ok ? r.json() : { invite: null })
      .then(d => setInvite(d.invite ?? null))
      .catch(() => {})
  }, [open])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function switchOrg(id: string) {
    if (id === orgId) { onClose(); return }
    setSwitching(id)
    await fetch('/api/org/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: id }),
    })
    setSwitching(null)
    onClose()
    window.location.href = '/dashboard'
  }

  async function acceptInvite() {
    if (!invite) return
    setAccepting(true)
    try {
      const r1 = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: invite.token }),
      })
      if (!r1.ok) return
      await fetch('/api/org/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: invite.orgId }),
      })
      onClose()
      window.location.href = '/dashboard'
    } finally {
      setAccepting(false)
    }
  }

  async function declineInvite() {
    if (!invite) return
    setDeclining(true)
    await fetch('/api/invites/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: invite.token }),
    })
    setInvite(null)
    setDeclining(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    onClose()
    router.push('/login')
  }

  const roleLabel = userRole === 'owner' ? 'Proprietário' : userRole === 'admin' ? 'Administrador' : 'Membro'

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col border-r border-border shadow-2xl transition-transform duration-300 ease-in-out md:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{
          backgroundColor: 'hsl(var(--sidebar))',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary shadow-sm">
              <Music2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">ShowDeck</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Perfil ── */}
          <div className="px-4 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0">
                {userAvatar && <AvatarImage src={userAvatar} className="object-cover" />}
                <AvatarFallback className="text-sm font-bold bg-primary/20 text-primary">
                  {initials(userName || userEmail)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{userName || 'Usuário'}</p>
                <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                <span className="inline-block mt-0.5 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                  {roleLabel}
                </span>
              </div>
            </div>
            <Link
              href="/configuracoes"
              onClick={onClose}
              className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Configurações
              <ChevronRight className="h-3 w-3 ml-auto" />
            </Link>
          </div>

          {/* ── Organizações ── */}
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">
              Organizações
            </p>
            <div className="space-y-0.5">
              {allOrgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => switchOrg(org.id)}
                  disabled={switching === org.id}
                  className={cn(
                    'flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-sm transition-colors text-left',
                    org.id === orgId
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-secondary',
                  )}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/20 shrink-0">
                    <Music2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="flex-1 truncate font-medium text-xs">{org.name}</span>
                  {org.id === orgId && <Check className="h-3.5 w-3.5 shrink-0" />}
                  {switching === org.id && (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                  )}
                </button>
              ))}
              <Link
                href="/onboarding"
                onClick={onClose}
                className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova organização
              </Link>
            </div>
          </div>

          {/* ── Convite pendente ── */}
          {invite && (
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">
                Convite pendente
              </p>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 shrink-0">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{invite.orgName}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Convidado como <span className="font-medium">{invite.role}</span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    disabled={accepting}
                    onClick={acceptInvite}
                  >
                    {accepting ? 'Aceitando…' : 'Aceitar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                    disabled={declining}
                    onClick={declineInvite}
                  >
                    {declining ? '…' : 'Recusar'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Perfil link ── */}
          <div className="px-4 py-3">
            <Link
              href="/org-select"
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <UserCircle className="h-3.5 w-3.5" />
              Selecionar organização
            </Link>
          </div>
        </div>

        {/* ── Bottom actions — extra padding to clear the mobile bottom nav ── */}
        <div className="border-t border-border px-4 pt-3 pb-24 space-y-1 shrink-0">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {resolvedTheme === 'dark'
              ? <Sun className="h-3.5 w-3.5" />
              : <MoonStar className="h-3.5 w-3.5" />}
            {resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair da conta
          </button>
        </div>
      </div>
    </>
  )
}
