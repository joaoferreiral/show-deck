'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/components/providers/session-provider'
import { useShowDetail, useArtists, useContractors } from '@/lib/hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { formatDate, formatCurrency, initials } from '@/lib/utils'
import { SHOW_STATUS_LABELS, SHOW_STATUS_COLORS, BRAZILIAN_STATES } from '@/types'
import type { ShowStatus } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronRight, ArrowLeft, Upload, X, FileText, Loader2, Save,
  CalendarDays, Pencil, Trash2, Music2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TimePicker } from '@/components/ui/time-picker'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import Link from 'next/link'

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = ['Show', 'Festival', 'Evento Privado', 'Casamento', 'Corporativo', 'Balada', 'Outro']
const DURATION_OPTIONS = ['30 min', '45 min', '1h', '1h30', '2h', '2h30', '3h', '3h30', '4h', '+4h']
const SHOW_STATUSES = [
  { value: 'pre_reserva', label: 'Pré-reserva' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'contrato_enviado', label: 'Contrato Enviado' },
  { value: 'contrato_assinado', label: 'Contrato Assinado' },
  { value: 'realizado', label: 'Realizado' },
  { value: 'cancelado', label: 'Cancelado' },
]
const NEGOTIATION_TYPES = [
  { value: 'cache', label: 'Cachê' },
  { value: 'cache_colocado', label: 'Cachê Colocado' },
  { value: 'bilheteria', label: 'Bilheteria' },
  { value: 'bilheteria_colocada', label: 'Bilheteria Colocada' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskCurrency(v: string) {
  const d = v.replace(/\D/g, '')
  if (!d) return ''
  return (parseInt(d, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function parseCurrency(v: string) {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
}
function toCurrencyStr(n: number) {
  if (!n) return ''
  return (n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── City autocomplete ────────────────────────────────────────────────────────

type Municipio = { id: number; nome: string; sigla: string }
const _cityCache: Record<string, Municipio[]> = {}

async function loadCities(uf?: string): Promise<Municipio[]> {
  const key = uf ?? '__all__'
  if (_cityCache[key]) return _cityCache[key]
  const url = uf
    ? `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
    : `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`
  const data = await fetch(url).then(r => r.json())
  _cityCache[key] = data.map((m: any) => ({
    id: m.id, nome: m.nome,
    sigla: uf ?? m.microrregiao?.mesorregiao?.UF?.sigla ?? '',
  }))
  return _cityCache[key]
}

function CityInput({ value, uf, onSelect }: {
  value: string; uf?: string
  onSelect: (nome: string, sigla: string) => void
}) {
  const [query, setQuery] = useState(value)
  const [pool, setPool] = useState<Municipio[]>([])
  const [suggestions, setSuggestions] = useState<Municipio[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [confirmed, setConfirmed] = useState(!!value)

  useEffect(() => { setQuery(value); setConfirmed(!!value) }, [value])
  useEffect(() => { if (uf) loadCities(uf).then(setPool) }, [uf])

  function search(q: string) {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    const matches = pool.filter(m => m.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 10)
    setSuggestions(matches); setOpen(matches.length > 0); setActiveIdx(-1)
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v); setConfirmed(false)
    let p = pool
    if (!p.length) { p = await loadCities(uf); setPool(p) }
    search(v)
  }

  function pick(m: Municipio) {
    setQuery(m.nome); setConfirmed(true)
    setSuggestions([]); setOpen(false)
    onSelect(m.nome, m.sigla)
  }

  function handleBlur() {
    setTimeout(() => {
      if (!confirmed) { setQuery(''); onSelect('', uf ?? '') }
      setOpen(false)
    }, 150)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(suggestions[activeIdx]) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="relative">
      <Input placeholder="Digite para buscar…" value={query}
        onChange={handleChange} onBlur={handleBlur} onKeyDown={handleKey}
        onFocus={() => suggestions.length && setOpen(true)} autoComplete="off"
        className={confirmed ? 'border-primary/40' : ''} />
      {open && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-52 overflow-auto rounded-md border bg-popover shadow-md py-1">
          {suggestions.map((m, i) => (
            <li key={m.id} onMouseDown={() => pick(m)}
              className={`px-3 py-2 text-sm cursor-pointer flex justify-between ${i === activeIdx ? 'bg-accent' : 'hover:bg-muted'}`}>
              <span>{m.nome}</span>
              <span className="text-xs text-muted-foreground">{m.sigla}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest border-b pb-2 mb-4">
      {children}
    </h2>
  )
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, required, children, className }: {
  label: string; required?: boolean; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label className="text-xs font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  )
}

// ─── Read-only value display ──────────────────────────────────────────────────

function ReadValue({ children, empty = '—' }: { children?: React.ReactNode; empty?: string }) {
  if (!children) return <p className="text-sm text-muted-foreground italic">{empty}</p>
  return <p className="text-sm">{children}</p>
}

// ─── Attachment type ──────────────────────────────────────────────────────────

type AttachFile = { name: string; url: string; type: string; size: number; uploading?: boolean }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShowDetailPage() {
  const params = useParams()
  const showId = params.id as string
  const { orgId } = useSession()
  const router = useRouter()
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: show, isLoading } = useShowDetail(orgId, showId)
  const { data: artistsData } = useArtists(orgId)
  const { data: contractors = [] } = useContractors(orgId)
  const artists = artistsData?.artists ?? []

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [calOpen, setCalOpen] = useState(false)

  // ── Form state (edit mode) ────────────────────────────────────────────────
  const [artistId, setArtistId] = useState('')
  const [status, setStatus] = useState('pre_reserva')
  const [eventDate, setEventDate] = useState<Date | undefined>()
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventType, setEventType] = useState('')
  const [contractType, setContractType] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [localPartner, setLocalPartner] = useState('')
  const [venueName, setVenueName] = useState('')
  const [stateUF, setStateUF] = useState('')
  const [city, setCity] = useState('')
  const [negotiationType, setNegotiationType] = useState('cache')
  const [cacheStr, setCacheStr] = useState('')
  const [guaranteeStr, setGuaranteeStr] = useState('')
  const [bilheteriaPct, setBilheteriaPct] = useState('')
  const [discountStr, setDiscountStr] = useState('')
  const [salesLink, setSalesLink] = useState('')
  const [attachments, setAttachments] = useState<AttachFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadKey = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : 'key')

  const needsGuarantee = ['cache_colocado', 'bilheteria_colocada'].includes(negotiationType)
  const showCache = ['cache', 'cache_colocado'].includes(negotiationType)

  // ── Initialize edit form from show data ──────────────────────────────────
  function startEdit() {
    if (!show) return
    let extras: any = {}
    try { extras = JSON.parse(show.notes ?? '{}') } catch { extras = {} }

    const d = new Date(show.start_at)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')

    setArtistId(show.artist_id ?? '')
    setStatus(show.status)
    setEventDate(d)
    setStartTime(`${hh}:${mm}`)
    setDuration(extras.duration ?? '')
    setEventName(show.title)
    setEventType(extras.event_type ?? '')
    setContractType(extras.contract_type ?? '')
    setContractorId(show.contractor_id ?? '')
    setLocalPartner(extras.local_partner ?? '')
    setVenueName(show.venue_name ?? '')
    setStateUF(show.state ?? '')
    setCity(show.city ?? '')
    setNegotiationType(extras.negotiation_type ?? 'cache')
    setCacheStr(toCurrencyStr(show.cache_value))
    setGuaranteeStr(toCurrencyStr(extras.guarantee_value ?? 0))
    setBilheteriaPct(extras.bilheteria_pct ? String(extras.bilheteria_pct) : '')
    setDiscountStr(toCurrencyStr(extras.discount ?? 0))
    setSalesLink(extras.sales_link ?? '')
    setAttachments(
      (extras.attachments ?? []).map((a: any) => ({
        name: a.name, url: a.url, type: a.type ?? '', size: a.size ?? 0,
      }))
    )
    uploadKey.current = extras.upload_key ?? uploadKey.current
    setEditing(true)
  }

  // ── File upload ───────────────────────────────────────────────────────────
  async function uploadFiles(files: FileList | File[]) {
    const supabase = createClient() as any
    for (const file of Array.from(files)) {
      setAttachments(a => [...a, { name: file.name, url: '', type: file.type, size: file.size, uploading: true }])
      const path = `${orgId}/${uploadKey.current}/${file.name}`
      const { error } = await supabase.storage.from('show-attachments').upload(path, file, { upsert: true })
      const url = error ? URL.createObjectURL(file) : supabase.storage.from('show-attachments').getPublicUrl(path).data.publicUrl
      setAttachments(a => a.map(x => x.name === file.name && x.uploading ? { ...x, url, uploading: false } : x))
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!artistId || !eventDate || !eventName.trim()) {
      toast({ title: 'Campos obrigatórios', description: 'Artista, nome e data são obrigatórios.', variant: 'destructive' })
      return
    }
    setSaving(true)
    const supabase = createClient() as any
    const dateStr = format(eventDate, 'yyyy-MM-dd')
    const startAt = startTime ? new Date(`${dateStr}T${startTime}:00`).toISOString() : new Date(dateStr).toISOString()
    const extras = {
      event_type: eventType, contract_type: contractType, duration,
      negotiation_type: negotiationType,
      guarantee_value: parseCurrency(guaranteeStr),
      bilheteria_pct: parseFloat(bilheteriaPct) || 0,
      discount: parseCurrency(discountStr),
      sales_link: salesLink, local_partner: localPartner,
      attachments: attachments.map(a => ({ name: a.name, url: a.url, type: a.type, size: a.size })),
      upload_key: uploadKey.current,
    }

    const { error } = await supabase.from('shows').update({
      artist_id: artistId,
      title: eventName,
      status,
      start_at: startAt,
      venue_name: venueName || null,
      city: city || null,
      state: stateUF || null,
      cache_value: parseCurrency(cacheStr),
      contractor_id: contractorId && contractorId !== '_none' ? contractorId : null,
      notes: JSON.stringify(extras),
      updated_at: new Date().toISOString(),
    }).eq('id', showId).eq('org_id', orgId)

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Show atualizado!' })
      qc.invalidateQueries({ queryKey: ['show', orgId, showId] })
      qc.invalidateQueries({ queryKey: ['shows', orgId] })
      qc.invalidateQueries({ queryKey: ['calendar-shows', orgId] })
      qc.invalidateQueries({ queryKey: ['dashboard-analytics', orgId] })
      setEditing(false)
    }
    setSaving(false)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient() as any
    const { error } = await supabase.from('shows').delete().eq('id', showId).eq('org_id', orgId)
    if (error) {
      toast({ title: 'Erro ao deletar', description: error.message, variant: 'destructive' })
      setDeleting(false)
    } else {
      toast({ title: 'Show removido.' })
      qc.invalidateQueries({ queryKey: ['shows', orgId] })
      qc.invalidateQueries({ queryKey: ['calendar-shows', orgId] })
      qc.invalidateQueries({ queryKey: ['dashboard-analytics', orgId] })
      router.push('/agenda')
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-full">
        <div className="sticky top-0 z-10 bg-background border-b px-4 md:px-6 py-3">
          <Skeleton className="h-4 w-40 mb-1" />
          <Skeleton className="h-6 w-64" />
        </div>
        <div className="px-4 md:px-6 py-6 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!show) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
        <Music2 className="h-10 w-10 opacity-30" />
        <p>Show não encontrado.</p>
        <Button variant="link" asChild><Link href="/agenda">Voltar para agenda</Link></Button>
      </div>
    )
  }

  // ── Parse extras for view mode ─────────────────────────────────────────────
  let viewExtras: any = {}
  try { viewExtras = JSON.parse(show.notes ?? '{}') } catch { viewExtras = {} }
  const viewAttachments: AttachFile[] = (viewExtras.attachments ?? [])
  const showArtist = artists.find(a => a.id === show.artist_id)
  const showContractor = contractors.find(c => c.id === show.contractor_id)
  const statusColor = SHOW_STATUS_COLORS[show.status as ShowStatus] ?? '#71717a'
  const artistColor = show.artists?.color ?? '#71717a'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">

      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground -ml-1"
            onClick={() => router.back()}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
              <Link href="/agenda" className="hover:text-foreground transition-colors">Agenda</Link>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground font-medium truncate max-w-[160px] md:max-w-[200px]">
                {editing ? 'Editando' : show.title}
              </span>
            </nav>
            <h1 className="text-lg font-bold leading-tight truncate max-w-[220px] md:max-w-md">
              {show.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!editing ? (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    Deletar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deletar show?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso removerá <strong>"{show.title}"</strong> permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {deleting ? 'Deletando…' : 'Sim, deletar'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 md:px-6 py-6 space-y-8">

          {/* ── SECTION 1: Informações ─────────────────────────────────── */}
          <section>
            <SectionTitle>Informações do Evento</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">

              {/* Artista */}
              <Field label="Artista" required>
                {editing ? (
                  <Select value={artistId} onValueChange={setArtistId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar artista" />
                    </SelectTrigger>
                    <SelectContent>
                      {artists.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={a.photo_url ?? undefined} />
                              <AvatarFallback style={{ backgroundColor: a.color + '30', color: a.color }} className="text-[9px] font-bold">
                                {initials(a.name)}
                              </AvatarFallback>
                            </Avatar>
                            {a.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  show.artists ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={show.artists.photo_url ?? undefined} />
                        <AvatarFallback style={{ backgroundColor: artistColor + '30', color: artistColor }} className="text-[9px] font-bold">
                          {initials(show.artists.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{show.artists.name}</span>
                    </div>
                  ) : <ReadValue />
                )}
              </Field>

              {/* Nome do evento */}
              <Field label="Nome do evento" required className="xl:col-span-2">
                {editing
                  ? <Input placeholder="Ex: Show de Verão – Recife" value={eventName} onChange={e => setEventName(e.target.value)} />
                  : <ReadValue>{show.title}</ReadValue>}
              </Field>

              {/* Tipo de evento */}
              <Field label="Tipo de evento">
                {editing ? (
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <ReadValue>{viewExtras.event_type}</ReadValue>}
              </Field>

              {/* Status */}
              <Field label="Status">
                {editing ? (
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SHOW_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    className="text-xs mt-1"
                    style={{ backgroundColor: `${statusColor}20`, color: statusColor, border: 'none' }}
                  >
                    {SHOW_STATUS_LABELS[show.status as ShowStatus] ?? show.status}
                  </Badge>
                )}
              </Field>

              {/* Data */}
              <Field label="Data" required>
                {editing ? (
                  <Popover open={calOpen} onOpenChange={setCalOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex w-full items-center gap-2 rounded-md border bg-background px-3 h-10 text-sm text-left hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary">
                        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className={eventDate ? 'text-foreground' : 'text-muted-foreground'}>
                          {eventDate ? format(eventDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Selecionar data'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={eventDate}
                        onSelect={d => { setEventDate(d); setCalOpen(false) }}
                        locale={ptBR} initialFocus />
                    </PopoverContent>
                  </Popover>
                ) : <ReadValue>{formatDate(show.start_at, "dd/MM/yyyy")}</ReadValue>}
              </Field>

              {/* Horário de início */}
              <Field label="Horário de início">
                {editing
                  ? <TimePicker value={startTime} onChange={setStartTime} />
                  : <ReadValue>{startTime || formatDate(show.start_at, "HH:mm")}</ReadValue>}
              </Field>

              {/* Duração */}
              <Field label="Duração">
                {editing ? (
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <ReadValue>{viewExtras.duration}</ReadValue>}
              </Field>

              {/* Local */}
              <Field label="Local / Casa de show">
                {editing
                  ? <Input placeholder="Ex: Arena Pernambuco" value={venueName} onChange={e => setVenueName(e.target.value)} />
                  : <ReadValue>{show.venue_name}</ReadValue>}
              </Field>

              {/* Estado */}
              <Field label="Estado">
                {editing ? (
                  <Select value={stateUF} onValueChange={v => { setStateUF(v); setCity('') }}>
                    <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.value} – {s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <ReadValue>{show.state}</ReadValue>}
              </Field>

              {/* Cidade */}
              <Field label="Cidade">
                {editing
                  ? <CityInput value={city} uf={stateUF || undefined}
                      onSelect={(nome, sigla) => { setCity(nome); if (sigla && !stateUF) setStateUF(sigla) }} />
                  : <ReadValue>{show.city}</ReadValue>}
              </Field>

            </div>
          </section>

          {/* ── SECTION 2: Contratação ─────────────────────────────────── */}
          <section>
            <SectionTitle>Contratação e Financeiro</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">

              {/* Contratante */}
              <Field label="Contratante">
                {editing ? (
                  <Select value={contractorId} onValueChange={setContractorId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar contratante" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Nenhum</SelectItem>
                      {contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <ReadValue>{showContractor?.name}</ReadValue>}
              </Field>

              {/* Parceiro local */}
              <Field label="Parceiro local">
                {editing
                  ? <Input placeholder="Nome do parceiro local" value={localPartner} onChange={e => setLocalPartner(e.target.value)} />
                  : <ReadValue>{viewExtras.local_partner}</ReadValue>}
              </Field>

              {/* Tipo de contrato */}
              <Field label="Tipo de contrato">
                {editing ? (
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prefeitura">Prefeitura / Governo</SelectItem>
                      <SelectItem value="privado">Privado</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <ReadValue>
                    {viewExtras.contract_type === 'prefeitura' ? 'Prefeitura / Governo'
                      : viewExtras.contract_type === 'privado' ? 'Privado'
                      : viewExtras.contract_type}
                  </ReadValue>
                )}
              </Field>

              {/* Tipo de negociação */}
              <Field label="Tipo de negociação" className="col-span-full">
                {editing ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {NEGOTIATION_TYPES.map(n => (
                      <button key={n.value} type="button" onClick={() => setNegotiationType(n.value)}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-center ${
                          negotiationType === n.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground'
                        }`}>
                        {n.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <ReadValue>
                    {NEGOTIATION_TYPES.find(n => n.value === viewExtras.negotiation_type)?.label ?? viewExtras.negotiation_type}
                  </ReadValue>
                )}
              </Field>

              {/* Cachê */}
              {(editing ? showCache : (viewExtras.negotiation_type === 'cache' || viewExtras.negotiation_type === 'cache_colocado' || show.cache_value > 0)) && (
                <Field label="Cachê (R$)">
                  {editing ? (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <Input className="pl-9" placeholder="0,00" value={cacheStr}
                        onChange={e => setCacheStr(maskCurrency(e.target.value))} />
                    </div>
                  ) : <ReadValue>{formatCurrency(show.cache_value)}</ReadValue>}
                </Field>
              )}

              {/* Garantia + % Bilheteria */}
              {(editing ? needsGuarantee : (viewExtras.guarantee_value > 0 || viewExtras.bilheteria_pct > 0)) && (
                <>
                  <Field label="Garantia (R$)">
                    {editing ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                        <Input className="pl-9" placeholder="0,00" value={guaranteeStr}
                          onChange={e => setGuaranteeStr(maskCurrency(e.target.value))} />
                      </div>
                    ) : <ReadValue>{viewExtras.guarantee_value > 0 ? formatCurrency(viewExtras.guarantee_value) : undefined}</ReadValue>}
                  </Field>
                  <Field label="% Bilheteria">
                    {editing ? (
                      <div className="relative">
                        <Input className="pr-8" placeholder="0" type="number" min="0" max="100" step="0.5"
                          value={bilheteriaPct} onChange={e => setBilheteriaPct(e.target.value)} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                      </div>
                    ) : <ReadValue>{viewExtras.bilheteria_pct > 0 ? `${viewExtras.bilheteria_pct}%` : undefined}</ReadValue>}
                  </Field>
                </>
              )}

              {/* Desconto */}
              <Field label="Desconto (R$)">
                {editing ? (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input className="pl-9" placeholder="0,00" value={discountStr}
                      onChange={e => setDiscountStr(maskCurrency(e.target.value))} />
                  </div>
                ) : <ReadValue>{viewExtras.discount > 0 ? formatCurrency(viewExtras.discount) : undefined}</ReadValue>}
              </Field>

              {/* Link de vendas */}
              <Field label="Link de vendas" className="xl:col-span-2">
                {editing
                  ? <Input type="url" placeholder="https://…" value={salesLink} onChange={e => setSalesLink(e.target.value)} />
                  : viewExtras.sales_link
                    ? <a href={viewExtras.sales_link} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline truncate block">{viewExtras.sales_link}</a>
                    : <ReadValue />}
              </Field>

            </div>
          </section>

          {/* ── SECTION 3: Anexos ──────────────────────────────────────── */}
          <section>
            <SectionTitle>Anexos do Evento</SectionTitle>

            {editing && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors mb-4 ${
                  dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }`}
              >
                <Upload className={`w-7 h-7 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-center">
                  <p className="text-sm font-medium">Arraste arquivos aqui ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, imagens, planilhas — qualquer formato</p>
                </div>
                <input ref={fileRef} type="file" multiple className="hidden"
                  onChange={e => { if (e.target.files) uploadFiles(e.target.files) }} />
              </div>
            )}

            {(editing ? attachments : viewAttachments).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {(editing ? attachments : viewAttachments).map(file => (
                  <div key={file.name} className="relative group rounded-lg border bg-card overflow-hidden">
                    <div className="aspect-square flex items-center justify-center bg-muted">
                      {file.type.startsWith('image/') && file.url
                        ? <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        : <div className="flex flex-col items-center gap-1 p-2">
                            {(file as any).uploading
                              ? <Loader2 className="w-7 h-7 text-muted-foreground animate-spin" />
                              : <FileText className="w-7 h-7 text-muted-foreground" />}
                            <span className="text-[9px] text-muted-foreground uppercase font-mono">
                              {file.name.split('.').pop()}
                            </span>
                          </div>
                      }
                    </div>
                    <div className="px-2 py-1 bg-card">
                      <p className="text-[11px] font-medium truncate">{file.name}</p>
                    </div>
                    {editing && (
                      <button
                        onClick={e => { e.stopPropagation(); setAttachments(a => a.filter(x => x.name !== file.name)) }}
                        className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {!editing && file.url && (
                      <a href={file.url} target="_blank" rel="noreferrer"
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/30 flex items-center justify-center transition-opacity">
                        <span className="text-white text-xs font-semibold">Abrir</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : !editing && (
              <p className="text-sm text-muted-foreground italic">Nenhum anexo.</p>
            )}
          </section>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          {editing && (
            <div className="flex items-center gap-3 pt-2 pb-4 border-t">
              <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar Evento
              </Button>
            </div>
          )}

          {/* ── Meta ────────────────────────────────────────────────────── */}
          {!editing && (
            <p className="text-xs text-muted-foreground pb-2">
              Criado em {formatDate(show.created_at, 'dd/MM/yyyy')} · ID: {show.id.slice(0, 8)}
            </p>
          )}

        </div>
      </div>
    </div>
  )
}
