'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function NewShowButton({ orgId: _ }: { orgId: string }) {
  return (
    <Button size="sm" asChild>
      <Link href="/agenda/novo">
        <Plus className="h-4 w-4 mr-1.5" />
        Novo Show
      </Link>
    </Button>
  )
}
