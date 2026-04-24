'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, XCircle, Building2, Mail } from 'lucide-react'

type InviteInfo = { orgName: string; orgId: string; role: string }

function JoinContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading]       = useState(true)
  const [invite, setInvite]         = useState<InviteInfo | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [mode, setMode]             = useState<'signup' | 'login'>('signup')

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [needsVerify, setNeedsVerify] = useState(false)

  useEffect(() => {
    async function init() {
      if (!token) { setInviteError('Link de convite inválido.'); setLoading(false); return }

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const res = await fetch(`/api/invites/validate?token=${encodeURIComponent(token)}`)
      const data = await res.json()

      if (!res.ok) {
        setInviteError(data.error ?? 'Link inválido ou expirado.')
      } else {
        setInvite(data)
      }
      setLoading(false)
    }
    init()
  }, [token])

  async function callAcceptAndRedirect() {
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast({ title: 'Erro ao aceitar convite', description: data.error, variant: 'destructive' })
      setSubmitting(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  async function handleAcceptLoggedIn() {
    setSubmitting(true)
    await callAcceptAndRedirect()
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const supabase = createClient()

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (signupError) {
      toast({ title: 'Erro ao criar conta', description: signupError.message, variant: 'destructive' })
      setSubmitting(false)
      return
    }

    // If no session, email verification is required
    if (!data.session) {
      setNeedsVerify(true)
      setSubmitting(false)
      return
    }

    await callAcceptAndRedirect()
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const supabase = createClient()

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) {
      toast({
        title: 'Erro ao entrar',
        description: loginError.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos.'
          : loginError.message,
        variant: 'destructive',
      })
      setSubmitting(false)
      return
    }

    await callAcceptAndRedirect()
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (inviteError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <XCircle className="h-10 w-10 text-destructive" />
          <p className="font-semibold">Link inválido</p>
          <p className="text-sm text-muted-foreground">{inviteError}</p>
          <Button variant="outline" size="sm" onClick={() => router.push('/login')}>
            Ir para o login
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Email verification needed ────────────────────────────────────────────────
  if (needsVerify) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="p-3 bg-primary/10 rounded-full">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <p className="font-semibold">Confirme seu e-mail</p>
          <p className="text-sm text-muted-foreground">
            Enviamos um link de confirmação para <span className="font-medium text-foreground">{email}</span>.
            Após confirmar, volte a este link para entrar na organização.
          </p>
          <p className="text-xs text-muted-foreground/60">
            Guarde o link desta página para acessar após a confirmação.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Logged-in user ───────────────────────────────────────────────────────────
  if (currentUser) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{invite!.orgName}</CardTitle>
              <p className="text-xs text-muted-foreground capitalize">
                Acesso como: {invite!.role === 'owner' ? 'Administrador' : 'Membro'}
              </p>
            </div>
          </div>
          <CardDescription>Você foi convidado para esta organização.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            Entrando como{' '}
            <span className="font-medium text-foreground">{currentUser.email}</span>
          </div>
          <Button className="w-full" onClick={handleAcceptLoggedIn} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar em {invite!.orgName}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Não é você?{' '}
            <button
              className="text-primary hover:underline"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                setCurrentUser(null)
              }}
            >
              Sair e usar outra conta
            </button>
          </p>
        </CardContent>
      </Card>
    )
  }

  // ── Not logged in ────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{invite!.orgName}</CardTitle>
            <p className="text-xs text-muted-foreground capitalize">
              Acesso como: {invite!.role === 'owner' ? 'Administrador' : 'Membro'}
            </p>
          </div>
        </div>
        <CardDescription>Crie uma conta ou entre para aceitar o convite.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab toggle */}
        <div className="flex rounded-lg border overflow-hidden text-sm">
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === 'signup'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Criar conta
          </button>
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 font-medium transition-colors ${
              mode === 'login'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            Já tenho conta
          </button>
        </div>

        {mode === 'signup' ? (
          <form onSubmit={handleSignup} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome"
                required
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar conta e entrar em {invite!.orgName}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar e aceitar convite
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  )
}
