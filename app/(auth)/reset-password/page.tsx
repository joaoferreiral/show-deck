'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, ArrowLeft, Mail } from 'lucide-react'

export default function ResetPasswordPage() {
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]     = useState(false)
  const { toast } = useToast()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    })
    setLoading(false)
    if (error) {
      toast({ title: 'Erro ao enviar email', description: error.message, variant: 'destructive' })
    } else {
      setSent(true)
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Email enviado!</CardTitle>
          <CardDescription>
            Enviamos um link para <strong>{email}</strong>. Verifique sua caixa de entrada e clique no link para criar uma nova senha.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Não encontrou? Verifique a pasta de spam ou solicite novamente.
          </p>
          <Button variant="outline" className="w-full gap-2" onClick={() => setSent(false)}>
            Reenviar email
          </Button>
          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao login
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Esqueceu a senha?</CardTitle>
        <CardDescription>
          Digite seu email e enviaremos um link para você criar uma nova senha. Não é necessário saber a senha atual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email da sua conta</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !email}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar link de redefinição
          </Button>
        </form>

        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="inline h-3.5 w-3.5 mr-1" />
          Voltar ao login
        </Link>
      </CardContent>
    </Card>
  )
}
