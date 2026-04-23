'use client'

import { usePathname } from 'next/navigation'
import { Bell, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/agenda': 'Agenda',
  '/financeiro': 'Financeiro',
  '/artistas': 'Artistas',
  '/contratantes': 'Contratantes',
  '/configuracoes': 'Configurações',
}

interface HeaderProps {
  unreadNotifications?: number
}

export function Header({ unreadNotifications = 0 }: HeaderProps) {
  const pathname = usePathname()
  const title = Object.entries(pageTitles).find(([key]) => pathname.startsWith(key))?.[1] ?? 'ShowDeck'

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-4 md:px-6">
      <h1 className="text-base font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <Badge
              className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
              variant="destructive"
            >
              {unreadNotifications > 9 ? '9+' : unreadNotifications}
            </Badge>
          )}
        </Button>
      </div>
    </header>
  )
}
