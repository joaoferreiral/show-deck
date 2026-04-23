import { Music2 } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Music2 className="h-7 w-7 text-primary" />
        </div>
        <span className="text-2xl font-bold">ShowDeck</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
