'use client'

import { useRef, useState } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Save, Loader2, Sun, Moon, Monitor, LogOut, Shield,
  Building2, Camera, Check,
} from 'lucide-react'
import { initials } from '@/lib/utils'
import { cn } from '@/lib/utils'

const ROLE_LABEL = { owner: 'Proprietário', admin: 'Administrador', member: 'Membro' }
const ROLE_COLOR = {
  owner:  'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  admin:  'bg-primary/10 text-primary',
  member: 'bg-muted text-muted-foreground',
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card shadow-card overflow-hidden', className)}>
      {children}
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border bg-muted/30">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { orgId, userId, orgName, userName, userEmail, userRole, userAvatar } = useSession()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  // Profile state
  const [avatarUrl, setAvatarUrl] = useState(userAvatar ?? '')
  const [uploading, setUploading]   = useState(false)
  const [displayName, setDisplayName] = useState(userName)
  const [savingName, setSavingName]   = useState(false)
  const [nameSaved, setNameSaved]     = useState(false)

  // Org state
  const [orgNameVal, setOrgNameVal] = useState(orgName)
  const [savingOrg, setSavingOrg]   = useState(false)
  const [orgSaved, setOrgSaved]     = useState(false)

  // ── Avatar upload ──────────────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const preview = URL.createObjectURL(file)
    setAvatarUrl(preview)
    setUploading(true)

    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      toast({ title: 'Erro ao enviar foto', description: 'Verifique se o bucket "avatars" existe no Supabase.', variant: 'destructive' })
      setAvatarUrl(userAvatar ?? '')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

    await supabase.auth.updateUser({ data: { avatar_url: publicUrl } })
    setAvatarUrl(publicUrl)
    setUploading(false)
    toast({ title: 'Foto atualizada!' })
  }

  // ── Save display name ──────────────────────────────────────────────────────
  async function saveName() {
    if (!displayName.trim() || displayName === userName) return
    setSavingName(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName.trim() } })
    if (error) {
      toast({ title: 'Erro ao salvar nome', description: error.message, variant: 'destructive' })
    } else {
      setNameSaved(true)
      setTimeout(() => setNameSaved(false), 2000)
    }
    setSavingName(false)
  }

  // ── Save org name ──────────────────────────────────────────────────────────
  async function saveOrg() {
    if (!orgNameVal.trim() || orgNameVal === orgName) return
    setSavingOrg(true)
    const supabase = createClient() as any
    const { error } = await supabase
      .from('organizations')
      .update({ name: orgNameVal.trim(), updated_at: new Date().toISOString() })
      .eq('id', orgId)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } else {
      setOrgSaved(true)
      setTimeout(() => setOrgSaved(false), 2000)
      toast({ title: 'Nome da organização atualizado!' })
    }
    setSavingOrg(false)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const themes = [
    { value: 'light',  label: 'Claro',   icon: Sun },
    { value: 'dark',   label: 'Escuro',  icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ]

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-4">

      {/* Page title */}
      <div className="pt-1 pb-2">
        <h1 className="text-base font-semibold">Configurações</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Gerencie seu perfil, organização e preferências.</p>
      </div>

      {/* ── Perfil ──────────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeader icon={Camera} title="Meu perfil" />

        <div className="p-5 space-y-5">
          {/* Avatar row */}
          <div className="flex items-center gap-4">
            {/* Clickable avatar */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="group relative rounded-full shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />}
                <AvatarFallback className="text-lg font-bold bg-primary/15 text-primary">
                  {initials(displayName || userEmail)}
                </AvatarFallback>
              </Avatar>

              {/* Overlay */}
              <span className={cn(
                'absolute inset-0 rounded-full flex items-center justify-center transition-opacity bg-black/50',
                uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}>
                {uploading
                  ? <Loader2 className="h-4 w-4 text-white animate-spin" />
                  : <Camera className="h-4 w-4 text-white" />
                }
              </span>
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />

            {/* Name + role */}
            <div className="min-w-0">
              <p className="font-semibold truncate">{displayName || userEmail}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              <span className={cn('mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', ROLE_COLOR[userRole])}>
                {ROLE_LABEL[userRole]}
              </span>
            </div>
          </div>

          {/* Name field */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome de exibição</Label>
            <div className="flex gap-2">
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                placeholder="Seu nome"
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={saveName}
                disabled={savingName || !displayName.trim() || displayName === userName}
                className="gap-1.5 shrink-0 min-w-[80px]"
              >
                {savingName
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : nameSaved
                    ? <Check className="h-3.5 w-3.5" />
                    : <Save className="h-3.5 w-3.5" />
                }
                {nameSaved ? 'Salvo!' : 'Salvar'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground/70">
              Clique na foto para alterá-la · O e-mail não pode ser alterado por aqui.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Organização ─────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeader icon={Building2} title="Organização" />
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <div className="flex gap-2">
              <Input
                value={orgNameVal}
                onChange={e => setOrgNameVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveOrg()}
                placeholder="Nome da produtora"
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={saveOrg}
                disabled={savingOrg || !orgNameVal.trim() || orgNameVal === orgName}
                className="gap-1.5 shrink-0 min-w-[80px]"
              >
                {savingOrg
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : orgSaved
                    ? <Check className="h-3.5 w-3.5" />
                    : <Save className="h-3.5 w-3.5" />
                }
                {orgSaved ? 'Salvo!' : 'Salvar'}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ID da organização</p>
            <p className="text-xs font-mono text-muted-foreground/70 bg-muted rounded-lg px-3 py-2 select-all tracking-tight">
              {orgId}
            </p>
          </div>
        </div>
      </Section>

      {/* ── Aparência ───────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeader icon={Sun} title="Aparência" />
        <div className="p-5">
          <div className="grid grid-cols-3 gap-2">
            {themes.map(({ value, label, icon: Icon }) => {
              const active = theme === value
              return (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border-2 p-3.5 transition-all duration-150',
                    active
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50'
                  )}
                >
                  <Icon className={cn('h-4.5 w-4.5', active ? 'text-primary' : 'text-muted-foreground')} style={{ width: '1.125rem', height: '1.125rem' }} />
                  <span className={cn('text-xs font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
                    {label}
                  </span>
                  {active && (
                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary hidden" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </Section>

      {/* ── Segurança ───────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeader icon={Shield} title="Segurança" />
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sair da conta</p>
              <p className="text-xs text-muted-foreground mt-0.5">Encerra sua sessão em todos os dispositivos</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50 hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        </div>
      </Section>

      <p className="text-center text-[11px] text-muted-foreground/50 pb-2">
        ShowDeck v0.1 · Feito com ♥ para produtoras musicais
      </p>
    </div>
  )
}
