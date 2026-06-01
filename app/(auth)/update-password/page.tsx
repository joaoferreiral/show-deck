'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, KeyRound, Eye, EyeOff } from 'lucide-react'

export default function UpdatePasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' })
      return
    }
    if (password !== confirm) {
      toast({ title: 'As senhas não coincidem', variant: 'destructive' })
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast({ title: 'Erro ao atualizar senha', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Senha atualizada com sucesso!' })
      router.push('/dashboard')
      router.refresh()
    }
  }

  const strength = password.length === 0 ? null : password.length < 6 ? 'fraca' : password.length < 10 ? 'ok' : 'forte'
  const strengthColor = strength === 'fraca' ? 'bg-destructive' : strength === 'ok' ? 'bg-amber-500' : 'bg-emerald-500'
  const strengthWidth = strength === 'fraca' ? 'w-1/3' : strength === 'ok' ? 'w-2/3' : 'w-full'

  return (
    <Card>
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-2">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <CardTitle>Criar nova senha</CardTitle>
        <CardDescription>Escolha uma senha segura para proteger sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPwd ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Strength bar */}
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${strengthColor} ${strengthWidth}`} />
                </div>
                <p className={`text-[11px] ${strength === 'fraca' ? 'text-destructive' : strength === 'ok' ? 'text-amber-600' : 'text-emerald-600'}`}>
                  Senha {strength}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirmar nova senha</Label>
            <Input
              id="confirm"
              type={showPwd ? 'text' : 'password'}
              placeholder="Repita a senha"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className={confirm && confirm !== password ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {confirm && confirm !== password && (
              <p className="text-[11px] text-destructive">As senhas não coincidem</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !password || !confirm || password !== confirm || password.length < 6}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar nova senha
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
