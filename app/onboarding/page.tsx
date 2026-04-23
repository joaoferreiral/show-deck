'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Music2 } from 'lucide-react'
import { BRAZILIAN_STATES } from '@/types'
import { slugify } from '@/lib/utils'

export default function OnboardingPage() {
  const [orgName, setOrgName] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const slug = slugify(orgName)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    const { data: org, error } = await sb
      .from('organizations')
      .insert({
        name: orgName,
        slug: `${slug}-${Date.now()}`,
        owner_id: user.id,
        base_city: city || null,
        base_state: state || null,
        plan: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        settings: {},
      })
      .select()
      .single()

    if (error) {
      toast({ title: 'Erro ao criar organização', description: error.message, variant: 'destructive' })
      setLoading(false)
      return
    }

    await sb.from('organization_members').insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner',
      permissions: {},
    })

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center gap-2">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Music2 className="h-7 w-7 text-primary" />
        </div>
        <span className="text-2xl font-bold">ShowDeck</span>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bem-vindo ao ShowDeck!</CardTitle>
          <CardDescription>
            Crie sua organização para começar a gerenciar seus shows.
          </CardDescription>
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
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
