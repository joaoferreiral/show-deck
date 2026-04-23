'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/utils'
import {
  LayoutDashboard,
  CalendarDays,
  Calendar,
  TrendingUp,
  Mic2,
  Building2,
  Settings,
  LogOut,
  Music2,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ─── Nav structure ─────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: 'Visão Geral',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operacional',
    items: [
      { href: '/agenda', label: 'Agenda', icon: CalendarDays },
      { href: '/calendario', label: 'Calendário', icon: Calendar },
    ],
  },
  {
    label: 'Negócios',
    items: [
      { href: '/artistas', label: 'Artistas', icon: Mic2 },
      { href: '/contratantes', label: 'Contratantes', icon: Building2 },
      { href: '/financeiro', label: 'Financeiro', icon: TrendingUp, soon: true },
    ],
  },
]

// Flat list for mobile nav (first 4 most used)
const MOBILE_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/artistas', label: 'Artistas', icon: Mic2 },
  { href: '/financeiro', label: 'Financeiro', icon: TrendingUp },
]

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon: Icon,
  soon,
}: {
  href: string
  label: string
  icon: React.ElementType
  soon?: boolean
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
      {/* Active indicator bar */}
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
  userName: string
  userEmail: string
}

export function Sidebar({ orgName, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="flex h-full flex-col"
      style={{ backgroundColor: 'hsl(var(--sidebar))', borderRight: '1px solid hsl(var(--border))' }}
    >
      {/* ── Logo / Brand ── */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary shadow-sm">
          <Music2 className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-none truncate">{orgName}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide font-medium">ShowDeck</p>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 select-none">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
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

        {/* User row */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-md mt-1">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">
              {initials(userName || userEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium leading-none truncate">{userName || 'Usuário'}</p>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">{userEmail}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
            title="Sair"
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border"
      style={{ backgroundColor: 'hsl(var(--sidebar))' }}>
      {MOBILE_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors',
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
