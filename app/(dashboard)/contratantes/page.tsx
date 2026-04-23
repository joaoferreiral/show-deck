'use client'

import { useRef, useState } from 'react'
import { useSession } from '@/components/providers/session-provider'
import { useContractors } from '@/lib/hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Building2, MapPin, Phone, Plus, Star, Camera } from 'lucide-react'
import Link from 'next/link'
import { BRAZILIAN_STATES } from '@/types'

// ─── Masks ────────────────────────────────────────────────────────────────────

function maskCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ value }: { value: number | null }) {
  if (!value) return null
  return (
    <span className="flex items-center gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < value ? 'fill-amber-400' : 'fill-muted stroke-muted-foreground'}`} />
      ))}
    </span>
  )
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

function NewContractorDialog({
  open, onOpenChange, orgId,
}: { open: boolean; onOpenChange: (v: boolean) => void; orgId: string }) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  function reset() {
    setName(''); setCnpj(''); setPhone(''); setCity(''); setState('')
    setNotes(''); setPhotoUrl(null)
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setPhotoUrl(localUrl)
    setUploading(true)

    try {
      const supabase = createClient() as any
      const ext = file.name.split('.').pop()
      const path = `${orgId}/contractors/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('contractor-photos').upload(path, file, { upsert: true })
      if (error) {
        // Keep local preview but warn user it won't persist
        toast({
          title: 'Aviso: bucket não configurado',
          description: 'A foto aparece em tela, mas não será salva até criar o bucket "contractor-photos" no Supabase.',
          variant: 'destructive',
        })
      } else {
        const { data } = supabase.storage.from('contractor-photos').getPublicUrl(path)
        setPhotoUrl(data.publicUrl)
        URL.revokeObjectURL(localUrl)
      }
    } catch {
      toast({ title: 'Erro ao fazer upload da foto', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    const supabase = createClient() as any
    const { error } = await supabase.from('contractors').insert({
      org_id: orgId,
      name: name.trim(),
      cnpj: cnpj || null,
      contact: phone ? { phone } : {},
      city: city || null,
      state: state || null,
      notes: notes || null,
      photo_url: photoUrl || null,
      tags: [],
      active: true,
    })
    if (error) {
      toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Contratante cadastrado!' })
      queryClient.invalidateQueries({ queryKey: ['contractors', orgId] })
      onOpenChange(false)
      reset()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo Contratante</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Photo upload */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar className="h-20 w-20 cursor-pointer" onClick={() => fileRef.current?.click()}>
                <AvatarImage src={photoUrl ?? undefined} />
                <AvatarFallback className="bg-muted text-2xl">
                  {name ? name.charAt(0).toUpperCase() : <Building2 className="h-8 w-8 text-muted-foreground" />}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 text-white shadow hover:bg-primary/80 transition-colors"
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Foto / logo da empresa</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input placeholder="Ex: Prefeitura de Caruaru" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input
                placeholder="00.000.000/0001-00"
                value={cnpj}
                onChange={e => setCnpj(maskCnpj(e.target.value))}
                maxLength={18}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                placeholder="(81) 99999-9999"
                value={phone}
                onChange={e => setPhone(maskPhone(e.target.value))}
                maxLength={15}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input placeholder="Caruaru" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.value} – {s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input placeholder="Informações adicionais…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => { onOpenChange(false); reset() }}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContratantesPage() {
  const { orgId } = useSession()
  const { data: contractors = [], isLoading } = useContractors(orgId)
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? <Skeleton className="h-4 w-20 inline-block" />
            : `${contractors.length} contratante${contractors.length !== 1 ? 's' : ''}`}
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo contratante
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-20" />
            </CardContent></Card>
          ))}
        </div>
      )}

      {!isLoading && contractors.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Nenhum contratante cadastrado ainda.</p>
            <Button size="sm" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Novo contratante
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && contractors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contractors.map(c => (
            <Link key={c.id} href={`/contratantes/${c.id}`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={(c as any).photo_url ?? undefined} />
                      <AvatarFallback className="bg-muted text-sm font-bold">
                        {c.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-tight truncate">{c.name}</p>
                        {!c.active && <Badge variant="secondary" className="text-[10px] shrink-0">Inativo</Badge>}
                      </div>
                      {c.cnpj && <p className="text-xs text-muted-foreground font-mono mt-0.5">{c.cnpj}</p>}
                    </div>
                  </div>
                  {(c.city || c.state) && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {c.city ?? ''}{c.state ? `, ${c.state}` : ''}
                    </p>
                  )}
                  {(c.contact as any)?.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />
                      {(c.contact as any).phone}
                    </p>
                  )}
                  <StarRating value={c.rating} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <NewContractorDialog open={dialogOpen} onOpenChange={setDialogOpen} orgId={orgId} />
    </div>
  )
}
