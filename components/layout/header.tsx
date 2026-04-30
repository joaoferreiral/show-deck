'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MoonStar, Sun, Menu } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { MobileDrawer } from './mobile-drawer'

const PAGE_TITLES: Record<string, { label: string; description?: string }> = {
  '/dashboard':    { label: 'Dashboard',     description: 'Visão geral' },
  '/agenda':       { label: 'Agenda',        description: 'Shows e eventos' },
  '/calendario':   { label: 'Calendário',    description: 'Visualização mensal' },
  '/kanban':       { label: 'Quadro',        description: 'Kanban' },
  '/financeiro':   { label: 'Financeiro',    description: 'Em desenvolvimento' },
  '/artistas':     { label: 'Artistas',      description: 'Gestão de artistas' },
  '/contratantes': { label: 'Contratantes',  description: 'Empresas e produtoras' },
  '/equipe':       { label: 'Equipe',        description: 'Membros e convites' },
  '/configuracoes':{ label: 'Configurações', description: 'Conta e preferências' },
}

export function Header() {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const match = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))
  const { label = 'ShowDeck', description } = match?.[1] ?? {}

  // Hide header on pages that have their own sticky header
  const hasOwnHeader = pathname.includes('/novo') || (pathname.match(/\/agenda\/[^/]+$/) && !pathname.endsWith('/agenda'))
  if (hasOwnHeader) return null

  return (
    <>
      <header
        className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/90 backdrop-blur-md px-4 md:px-6 shrink-0"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          height: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
        }}
      >
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors -ml-1"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Page identity */}
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-sm font-semibold leading-none">{label}</h1>
          {description && (
            <span className="hidden sm:block text-xs text-muted-foreground leading-none">{description}</span>
          )}
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1">
          {/* Theme toggle — desktop only (mobile version is inside the drawer) */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {resolvedTheme === 'dark'
              ? <Sun className="h-4 w-4" />
              : <MoonStar className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Mobile slide-out drawer */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
