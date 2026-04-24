'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Music2, Building2, ChevronDown, Plus, Check } from 'lucide-react'
import { BRAZILIAN_STATES } from '@/types'

interface PendingInvite {
  token: string
  role: string
  orgId: string
  orgName: string
}

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingInvite, setCheckingInvite] = useState(true)
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [acceptingInvite, setAcceptingInvite] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function checkInvite() {
      try {
        const res = await fetch('/api/invites/check-email')
        const data = await res.json()
        if (data.invite) {
          setPendingInvite(data.invite)
        } else {
          setShowCreateForm(true)
        }
      } catch {
        setShowCreateForm(true)
      } finally {
        setCheckingInvite(false)
      }
    }
    checkInvite()
  }, [])

  async function handleAcceptInvite() {
    if (!pendingInvite) return
    setAcceptingInvite(true)
    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: pendingInvite.token }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao entrar na organização', description: data.error, variant: 'destructive' })
        return
      }
      window.location.href = '/org-select'
    } catch {
      toast({ title: 'Erro ao entrar na organização', variant: 'destructive' })
    } finally {
      setAcceptingInvite(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)

    try {
      const res = await fetch('/api/org/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, city, state }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao criar organização', description: data.error, variant: 'destructive' })
        return
      }
      // Full page reload to clear all Next.js router cache and ensure
      // getSession() picks up the newly created membership
      window.location.href = '/org-select'
    } catch {
      toast({ title: 'Erro ao criar organização', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const roleLabel = (role: string) => {
    if (role === 'owner') return 'Proprietário'
    if (role === 'admin') return 'Administrador'
    return 'Membro'
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Music2 className="h-7 w-7 text-primary" />
        </div>
        <span className="text-2xl font-bold">ShowDeck</span>
      </div>

      {checkingInvite ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Verificando convites...</span>
        </div>
      ) : (
        <div className="w-full max-w-md space-y-4">
          {/* Pending invite card */}
          {pendingInvite && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-primary mb-1">
                  <Check className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Convite pendente</span>
                </div>
                <CardTitle className="text-lg">Você foi convidado!</CardTitle>
                <CardDescription>
                  Entre na organização abaixo ou crie a sua própria.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{pendingInvite.orgName}</p>
                    <p className="text-xs text-muted-foreground">
                      Você entrará como <span className="font-medium text-foreground">{roleLabel(pendingInvite.role)}</span>
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleAcceptInvite}
                  disabled={acceptingInvite}
                >
                  {acceptingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar em {pendingInvite.orgName}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Toggle create form */}
          {pendingInvite && !showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              Criar outra organização
            </button>
          )}

          {/* Create org form */}
          {showCreateForm && (
            <Card>
              <CardHeader>
                {!pendingInvite ? (
                  <>
                    <CardTitle>Bem-vindo ao ShowDeck!</CardTitle>
                    <CardDescription>
                      Crie sua organização para começar a gerenciar seus shows.
                    </CardDescription>
                  </>
                ) : (
                  <>
                    <CardTitle>Nova organização</CardTitle>
                    <CardDescription>
                      Crie uma organização própria no ShowDeck.
                    </CardDescription>
                  </>
                )}
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="orgName">Nome da sua empresa / assessoria</Label>
                    <Input
                      id="orgName"
                      placeholder="Ex: Agência Ritmo, Produções XYZ..."
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade base</Label>
                      <Input
                        id="city"
                        placeholder="Recife"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Select value={state} onValueChange={setState}>
                        <SelectTrigger>
                          <SelectValue placeholder="UF" />
                        </SelectTrigger>
                        <SelectContent>
                          {BRAZILIAN_STATES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.value} – {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading || !orgName.trim()}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Criar organização e entrar
                  </Button>

                  {pendingInvite && (
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                    >
                      <ChevronDown className="h-3 w-3 rotate-90" />
                      Voltar
                    </button>
                  )}
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
