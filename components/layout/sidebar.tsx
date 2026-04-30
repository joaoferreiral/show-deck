'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/utils'
import {
  LayoutDashboard, CalendarDays, Calendar, TrendingUp,
  Mic2, Building2, Settings, LogOut, Music2, Users,
  ChevronDown, Check, Plus, KanbanSquare, UserCheck,
} from 'lucide-react'
import { useSession } from '@/components/providers/session-provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import type { OrgEntry } from '@/components/providers/session-provider'

// ─── Nav structure ─────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Visão Geral',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Operacional',
    items: [
      { href: '/agenda',     label: 'Agenda',      icon: CalendarDays },
      { href: '/calendario', label: 'Calendário',  icon: Calendar },
      { href: '/kanban',     label: 'Quadro',      icon: KanbanSquare },
    ],
  },
  {
    label: 'Negócios',
    items: [
      { href: '/artistas',    label: 'Artistas',     icon: Mic2 },
      { href: '/contratantes',label: 'Contratantes', icon: Building2 },
      { href: '/financeiro',  label: 'Financeiro',   icon: TrendingUp, soon: true },
    ],
  },
]

const MOBILE_ITEMS_BASE = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agenda',    label: 'Agenda',    icon: CalendarDays },
  { href: '/artistas',  label: 'Artistas',  icon: Mic2 },
  { href: '/kanban',    label: 'Quadro',    icon: KanbanSquare },
]

const MOBILE_ITEM_EQUIPE = { href: '/equipe', label: 'Equipe', icon: UserCheck }

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({ href, label, icon: Icon, soon }: {
  href: string; label: string; icon: React.ElementType; soon?: boolean
}) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(href + '/')

  return (
    <Link
      href={href}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-100',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary" />
      )}
      <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
      <span className="flex-1 truncate">{label}</span>
      {soon && (
        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Em breve
        </span>
      )}
    </Link>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  orgName: string
  orgId: string
  userName: string
  userEmail: string
  userRole?: 'owner' | 'admin' | 'member'
  userAvatar?: string | null
  allOrgs?: OrgEntry[]
}

export function Sidebar({ orgName, orgId, userName, userEmail, userRole = 'member', userAvatar, allOrgs = [] }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [switching, setSwitching] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function switchOrg(id: string) {
    if (id === orgId) return
    setSwitching(true)
    await fetch('/api/org/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: id }),
    })
    router.refresh()
    setSwitching(false)
  }

  return (
    <aside
      className="flex h-full flex-col"
      style={{ backgroundColor: 'hsl(var(--sidebar))', borderRight: '1px solid hsl(var(--border))' }}
    >
      {/* ── Org switcher ── */}
      <div className="px-3 h-14 border-b border-border shrink-0 flex items-center">
        {allOrgs.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 w-full rounded-md px-1.5 py-1.5 hover:bg-secondary transition-colors min-w-0">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary shadow-sm shrink-0">
                  <Music2 className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold leading-none truncate">{orgName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide font-medium">ShowDeck</p>
                </div>
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform', switching && 'animate-spin')} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {allOrgs.map(org => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => switchOrg(org.id)}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                >
                  <span className="truncate">{org.name}</span>
                  {org.id === orgId && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/onboarding" className="flex items-center gap-2 cursor-pointer">
                  <Plus className="h-3.5 w-3.5" />
                  Nova organização
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary shadow-sm shrink-0">
              <Music2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-none truncate">{orgName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide font-medium">ShowDeck</p>
            </div>
            <Link href="/onboarding" title="Nova organização">
              <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            </Link>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => <NavItem key={item.href} {...item} />)}
            </div>
          </div>
        ))}

        {(userRole === 'owner' || userRole === 'admin') && (
          <div>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
              Administração
            </p>
            <div className="space-y-0.5">
              <NavItem href="/equipe" label="Equipe" icon={Users} />
            </div>
          </div>
        )}
      </nav>

      {/* ── Bottom ── */}
      <div className="border-t border-border p-2 space-y-0.5">
        <Link
          href="/configuracoes"
          className={cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/configuracoes')
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Configurações
        </Link>

        <div className="flex items-center gap-2.5 px-3 py-2 rounded-md mt-1">
          <Avatar className="h-6 w-6 shrink-0">
            {userAvatar && <AvatarImage src={userAvatar} alt={userName} className="object-cover" />}
            <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">
              {initials(userName || userEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium leading-none truncate">{userName || 'Usuário'}</p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{userEmail}</p>
          </div>
          <Button
            variant="ghost" size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleLogout} title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  )
}

// ─── Mobile bottom navigation ─────────────────────────────────────────────────

export function BottomNav() {
  const pathname = usePathname()
  const { userRole } = useSession()

  const isAdminOrOwner = userRole === 'owner' || userRole === 'admin'
  const mobileItems = isAdminOrOwner
    ? [...MOBILE_ITEMS_BASE, MOBILE_ITEM_EQUIPE]
    : MOBILE_ITEMS_BASE

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border"
      style={{
        backgroundColor: 'hsl(var(--sidebar))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {mobileItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href} href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1.5 pt-2.5 pb-3 text-xs font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
            <span className="text-[10px] leading-none">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
