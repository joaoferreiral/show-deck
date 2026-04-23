'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/components/providers/session-provider'
import { useContractorDetail } from '@/lib/hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { formatDate } from '@/lib/utils'
import { BRAZILIAN_STATES } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Pencil, Save, X, Trash2, Building2, MapPin, Phone, Star } from 'lucide-react'
import Link from 'next/link'

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <button key={i} type="button" onClick={() => onChange(i + 1)}>
          <Star className={`h-5 w-5 transition-colors ${i < value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
        </button>
      ))}
      {value > 0 && (
        <button type="button" onClick={() => onChange(0)} className="ml-1 text-xs text-muted-foreground hover:text-foreground">
          limpar
        </button>
      )}
    </div>
  )
}

export default function ContractorDetailPage() {
  const params = useParams()
  const contractorId = params.id as string
  const { orgId } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: contractor, isLoading } = useContractorDetail(orgId, contractorId)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [name, setName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState(0)
  const [active, setActive] = useState(true)

  function startEdit() {
    if (!contractor) return
    setName(contractor.name)
    setCnpj(contractor.cnpj ?? '')
    setPhone((contractor.contact as any)?.phone ?? '')
    setCity(contractor.city ?? '')
    setState(contractor.state ?? '')
    setNotes(contractor.notes ?? '')
    setRating(contractor.rating ?? 0)
    setActive(contractor.active)
    setEditing(true)
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const supabase = createClient() as any
    const { error } = await supabase
      .from('contractors')
      .update({
        name: name.trim(),
        cnpj: cnpj || null,
        contact: phone ? { phone } : {},
        city: city || null,
        state: state || null,
        notes: notes || null,
        rating: rating || null,
        active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractorId)
      .eq('org_id', orgId)

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Contratante atualizado!' })
      queryClient.invalidateQueries({ queryKey: ['contractor', orgId, contractorId] })
      queryClient.invalidateQueries({ queryKey: ['contractors', orgId] })
      setEditing(false)
    }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient() as any
    const { error } = await supabase
      .from('contractors')
      .delete()
      .eq('id', contractorId)
      .eq('org_id', orgId)

    if (error) {
      toast({ title: 'Erro ao deletar', description: error.message, variant: 'destructive' })
      setDeleting(false)
    } else {
      toast({ title: 'Contratante removido.' })
      queryClient.invalidateQueries({ queryKey: ['contractors', orgId] })
      router.push('/contratantes')
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!contractor) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Building2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Contratante não encontrado.</p>
        <Button variant="link" asChild className="mt-2"><Link href="/contratantes">Voltar</Link></Button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link href="/contratantes"><ArrowLeft className="h-4 w-4" />Contratantes</Link>
        </Button>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" />Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />Deletar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deletar contratante?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso removerá <strong>{contractor.name}</strong> permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
                      {deleting ? 'Deletando…' : 'Sim, deletar'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />Cancelar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || !name.trim()}>
                <Save className="h-3.5 w-3.5" />{saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Hero */}
      <Card>
        <CardContent className="p-5 space-y-3">
          {editing ? (
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-semibold h-10" placeholder="Nome do contratante" />
          ) : (
            <h1 className="text-xl font-bold">{contractor.name}</h1>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {editing ? (
              <>
                <Switch checked={active} onCheckedChange={setActive} id="active" />
                <Label htmlFor="active" className="text-sm">{active ? 'Ativo' : 'Inativo'}</Label>
              </>
            ) : (
              <Badge variant={contractor.active ? 'default' : 'secondary'} className="text-xs">
                {contractor.active ? 'Ativo' : 'Inativo'}
              </Badge>
            )}
          </div>
          {editing ? (
            <StarPicker value={rating} onChange={setRating} />
          ) : contractor.rating ? (
            <div className="flex items-center gap-0.5 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < (contractor.rating ?? 0) ? 'fill-amber-400' : 'fill-muted stroke-muted-foreground'}`} />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CNPJ</Label>
              {editing
                ? <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
                : <p className="text-sm font-mono">{contractor.cnpj || <span className="text-muted-foreground italic not-italic font-sans">—</span>}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Telefone</Label>
              {editing
                ? <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(81) 99999-9999" />
                : <p className="text-sm">{(contractor.contact as any)?.phone || <span className="text-muted-foreground italic">—</span>}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Cidade</Label>
              {editing
                ? <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Caruaru" />
                : <p className="text-sm">{contractor.city || <span className="text-muted-foreground italic">—</span>}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              {editing
                ? <Select value={state} onValueChange={setState}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.value} – {s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                : <p className="text-sm">{contractor.state || <span className="text-muted-foreground italic">—</span>}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Observações</Label>
            {editing
              ? <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais…" rows={3} className="resize-none" />
              : <p className="text-sm whitespace-pre-wrap">{contractor.notes || <span className="text-muted-foreground italic">Nenhuma observação.</span>}</p>}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pb-2">
        Cadastrado em {formatDate(contractor.created_at, 'dd/MM/yyyy')} · ID: {contractor.id.slice(0, 8)}
      </p>
    </div>
  )
}
