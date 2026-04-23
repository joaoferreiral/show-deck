'use client'

import { WifiOff, Music2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
      <div className="p-4 bg-muted rounded-2xl mb-6">
        <WifiOff className="h-12 w-12 text-muted-foreground" />
      </div>
      <div className="mb-2 flex items-center gap-2 justify-center">
        <Music2 className="h-5 w-5 text-primary" />
        <span className="font-bold text-lg">ShowDeck</span>
      </div>
      <h1 className="text-xl font-semibold mt-2">Você está offline</h1>
      <p className="text-muted-foreground text-sm mt-2 max-w-xs">
        Verifique sua conexão com a internet e tente novamente. Alguns dados podem estar disponíveis em cache.
      </p>
      <Button
        className="mt-6"
        onClick={() => window.location.reload()}
      >
        Tentar novamente
      </Button>
    </div>
  )
}
