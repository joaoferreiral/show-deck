'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { NewArtistDialog } from './new-artist-dialog'

interface NewArtistButtonProps {
  orgId: string
}

export function NewArtistButton({ orgId }: NewArtistButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1.5" />
        Novo Artista
      </Button>
      <NewArtistDialog open={open} onOpenChange={setOpen} orgId={orgId} />
    </>
  )
}
