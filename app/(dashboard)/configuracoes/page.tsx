'use client'

import { useState } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, Loader2, Sun, Moon, Monitor, LogOut, Shield, Building2, User } from 'lucide-react'

export default function ConfiguracoesPage() {
  const { orgId, orgName, userName, userEmail } = useSession()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()

  const [savingOrg, setSavingOrg] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [newOrgName, setNewOrgName] = useState(orgName)
  const [newDisplayName, setNewDisplayName] = useState(userName)

  async function saveOrgName() {
    if (!newOrgName.trim() || newOrgName === orgName) return
    setSavingOrg(true)
    const supabase = createClient() as any
    const { error } = await supabase
      .from('organizations')
      .update({ name: newOrgName.trim(), updated_at: new Date().toISOString() })
      .eq('id', orgId)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Nome da organização atualizado!', description: 'A mudança aparecerá na próxima vez que recarregar.' })
    }
    setSavingOrg(false)
  }

  async function saveProfile() {
    if (!newDisplayName.trim()) return
    setSavingProfile(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { full_name: newDisplayName.trim() },
    })
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Perfil atualizado!' })
    }
    setSavingProfile(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const themes = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Escuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ]

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <h1 className="text-lg font-semibold">Configurações</h1>

      {/* ── Organização ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" />
            Organização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome da organização</Label>
            <div className="flex gap-2">
              <Input
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Nome da produtora"
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={saveOrgName}
                disabled={savingOrg || !newOrgName.trim() || newOrgName === orgName}
                className="gap-1.5 shrink-0"
              >
                {savingOrg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">ID da organização</Label>
            <p className="text-xs font-mono text-muted-foreground bg-muted rounded-md px-3 py-2 select-all">
              {orgId}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Perfil ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            Meu perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome de exibição</Label>
            <div className="flex gap-2">
              <Input
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="Seu nome"
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={saveProfile}
                disabled={savingProfile || !newDisplayName.trim() || newDisplayName === userName}
                className="gap-1.5 shrink-0"
              >
                {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">E-mail</Label>
            <p className="text-sm text-muted-foreground">{userEmail}</p>
            <p className="text-xs text-muted-foreground/60">O e-mail não pode ser alterado por aqui.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Aparência ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Sun className="h-3.5 w-3.5" />
            Aparência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                  theme === value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <Icon className={`h-5 w-5 ${theme === value ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-xs font-medium ${theme === value ? 'text-primary' : 'text-muted-foreground'}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Segurança ───────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium">Sair da conta</p>
              <p className="text-xs text-muted-foreground">Encerra sua sessão em todos os dispositivos</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Versão ──────────────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        ShowDeck v0.1 · Feito com ♥ para produtoras musicais
      </p>
    </div>
  )
}
