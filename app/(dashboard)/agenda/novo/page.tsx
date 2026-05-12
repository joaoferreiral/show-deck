'use client'

import { useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/providers/session-provider'
import { useArtists, useContractors } from '@/lib/hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { BRAZILIAN_STATES } from '@/types'
import { SHOW_STATUS_COLORS, SHOW_STATUS_LABELS } from '@/types'
import type { ShowStatus } from '@/types'
import { format, addMonths, parseISO, isBefore } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/utils'
import {
  Upload, X, FileText, Loader2, Save,
  CalendarDays, Banknote, ArrowLeftRight, Ticket, Percent,
  Info, MapPin, Users, Link2, CreditCard, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TimePicker } from '@/components/ui/time-picker'

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPES = ['Show', 'Festival', 'Evento Privado', 'Casamento', 'Corporativo', 'Balada', 'Outro']
const DURATION_OPTIONS = ['30 min', '45 min', '1h', '1h30', '2h', '2h30', '3h', '3h30', '4h', '+4h']
const SHOW_STATUSES = [
  { value: 'pre_reserva',       label: 'Pré-reserva' },
  { value: 'confirmado',        label: 'Confirmado' },
  { value: 'contrato_enviado',  label: 'Contrato Enviado' },
  { value: 'contrato_assinado', label: 'Contrato Assinado' },
  { value: 'realizado',         label: 'Realizado' },
  { value: 'cancelado',         label: 'Cancelado' },
]
const NEGOTIATION_TYPES = [
  {
    value: 'cache',
    label: 'Cachê',
    description: 'Valor fixo combinado',
    icon: Banknote,
  },
  {
    value: 'cache_colocado',
    label: 'Cachê Colocado',
    description: 'Cachê + % da bilheteria',
    icon: ArrowLeftRight,
  },
  {
    value: 'bilheteria',
    label: 'Bilheteria',
    description: '100% da renda líquida',
    icon: Ticket,
  },
  {
    value: 'bilheteria_colocada',
    label: 'Bilheteria Colocada',
    description: 'Garantia mínima + bilheteria',
    icon: Percent,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskCurrency(v: string) {
  const d = v.replace(/\D/g, '')
  if (!d) return ''
  return (parseInt(d, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function parseCurrency(v: string) {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
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
    id: m.id,
    nome: m.nome,
    sigla: uf ?? m.microrregiao?.mesorregiao?.UF?.sigla ?? '',
  }))
  return _cityCache[key]
}

function CityInput({ value, uf, onSelect }: {
  value: string
  uf?: string
  onSelect: (nome: string, sigla: string) => void
}) {
  const [query, setQuery] = useState(value)
  const [pool, setPool] = useState<Municipio[]>([])
  const [suggestions, setSuggestions] = useState<Municipio[]>([])
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [confirmed, setConfirmed] = useState(!!value)

  useState(() => { setQuery(value); setConfirmed(!!value) })

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
      <Input
        placeholder="Digite para buscar…"
        value={query}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKey}
        onFocus={() => suggestions.length && setOpen(true)}
        autoComplete="off"
        className={cn(confirmed && 'border-primary/50 ring-primary/20')}
      />
      {open && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-52 overflow-auto rounded-lg border bg-popover shadow-lg py-1">
          {suggestions.map((m, i) => (
            <li
              key={m.id}
              onMouseDown={() => pick(m)}
              className={cn(
                'px-3 py-2 text-sm cursor-pointer flex items-center justify-between transition-colors',
                i === activeIdx ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
              )}
            >
              <span>{m.nome}</span>
              <span className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{m.sigla}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Section title ────────────────────────────────────────────────────────────

function SectionTitle({
  icon: Icon,
  children,
  step,
}: {
  icon: React.ElementType
  children: React.ReactNode
  step: number
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-semibold text-muted-foreground/50 tracking-widest shrink-0">
        {String(step).padStart(2, '0')}
      </span>
    </div>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
  className,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1.5">
        <Label className="text-xs font-medium text-foreground/80">
          {label}
        </Label>
        {required && (
          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1 py-0.5 rounded leading-none">
            obrigatório
          </span>
        )}
      </div>
      {children}
      {hint && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3 shrink-0" />
          {hint}
        </p>
      )}
    </div>
  )
}

// ─── Currency field ───────────────────────────────────────────────────────────

function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative flex items-center">
      <span className="absolute left-0 flex items-center justify-center w-10 h-full text-xs font-semibold text-muted-foreground border-r border-border bg-muted/50 rounded-l-md select-none">
        R$
      </span>
      <Input
        className="pl-12 font-mono tabular-nums"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(maskCurrency(e.target.value))}
      />
    </div>
  )
}

// ─── Attachment type ──────────────────────────────────────────────────────────

type AttachFile = { name: string; url: string; type: string; size: number; uploading?: boolean }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NovoEventoPage() {
  const { orgId } = useSession()
  const router = useRouter()
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data: artistsData } = useArtists(orgId)
  const { data: contractors = [] } = useContractors(orgId)
  const artists = artistsData?.artists ?? []
  const uploadKey = useRef(typeof crypto !== 'undefined' ? crypto.randomUUID() : 'key')

  // ── Form state ────────────────────────────────────────────────────────────
  const [artistId, setArtistId] = useState('')
  const [status, setStatus] = useState('pre_reserva')
  const [eventDate, setEventDate] = useState<Date | undefined>()
  const [calOpen, setCalOpen] = useState(false)
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
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Payment plan state ────────────────────────────────────────────────────
  const [paymentMode, setPaymentMode] = useState<'sem_plano' | 'integral' | 'parcelado'>('sem_plano')
  const [paymentAmountStr, setPaymentAmountStr] = useState('')
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [numParcelas, setNumParcelas] = useState('2')

  function selectPaymentMode(mode: 'sem_plano' | 'integral' | 'parcelado') {
    setPaymentMode(mode)
    // Auto-fill from cachê if amount not yet set
    if (mode !== 'sem_plano' && !paymentAmountStr && cacheStr) {
      setPaymentAmountStr(cacheStr)
    }
  }

  // Installment preview for parcelado mode
  const installmentPreview = useMemo(() => {
    if (paymentMode !== 'parcelado') return []
    const amount = parseCurrency(paymentAmountStr)
    if (!amount || amount <= 0) return []
    const n = Math.max(2, parseInt(numParcelas, 10) || 2)
    const perParcela = Math.round((amount / n) * 100) / 100
    const base = parseISO(paymentDate || format(new Date(), 'yyyy-MM-dd'))
    return Array.from({ length: n }, (_, i) => ({
      amount: i === n - 1
        ? Math.round((amount - perParcela * (n - 1)) * 100) / 100
        : perParcela,
      due_date: format(addMonths(base, i), 'yyyy-MM-dd'),
      description: `Parcela ${i + 1}/${n}`,
    }))
  }, [paymentMode, paymentAmountStr, numParcelas, paymentDate])

  const needsGuarantee = ['cache_colocado', 'bilheteria_colocada'].includes(negotiationType)
  const showCache = ['cache', 'cache_colocado'].includes(negotiationType)

  const selectedArtist = artists.find(a => a.id === artistId)
  const selectedStatus = SHOW_STATUSES.find(s => s.value === status)
  const statusColor = SHOW_STATUS_COLORS[status as ShowStatus]

  // ── File upload ───────────────────────────────────────────────────────────
  async function uploadFiles(files: FileList | File[]) {
    const supabase = createClient() as any
    for (const file of Array.from(files)) {
      setAttachments(a => [...a, { name: file.name, url: '', type: file.type, size: file.size, uploading: true }])
      const path = `${orgId}/${uploadKey.current}/${file.name}`
      const { error } = await supabase.storage.from('show-attachments').upload(path, file, { upsert: true })
      const url = error
        ? URL.createObjectURL(file)
        : supabase.storage.from('show-attachments').getPublicUrl(path).data.publicUrl
      setAttachments(a => a.map(x => x.name === file.name && x.uploading ? { ...x, url, uploading: false } : x))
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!artistId || !eventDate || !eventName.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha artista, nome do evento e data antes de salvar.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    const supabase = createClient() as any
    const dateStr = format(eventDate, 'yyyy-MM-dd')
    const startAt = startTime
      ? new Date(`${dateStr}T${startTime}:00`).toISOString()
      : new Date(dateStr).toISOString()
    const extras = {
      event_type: eventType, contract_type: contractType, duration,
      negotiation_type: negotiationType,
      guarantee_value: parseCurrency(guaranteeStr),
      bilheteria_pct: parseFloat(bilheteriaPct) || 0,
      discount: parseCurrency(discountStr),
      sales_link: salesLink, local_partner: localPartner,
      attachments: attachments.map(a => ({ name: a.name, url: a.url, type: a.type })),
      upload_key: uploadKey.current,
    }
    const { data, error } = await supabase.from('shows').insert({
      org_id: orgId, artist_id: artistId, title: eventName, status,
      start_at: startAt, city: city || null, state: stateUF || null,
      venue_name: venueName || null, cache_value: parseCurrency(cacheStr),
      contractor_id: contractorId && contractorId !== '_none' ? contractorId : null,
      notes: JSON.stringify(extras),
    }).select('id').single()

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      setSaving(false)
      return
    }

    // ── Create payment plan if configured ──────────────────────────────────
    if (data?.id && paymentMode !== 'sem_plano') {
      const payAmount = parseCurrency(paymentAmountStr)
      if (payAmount > 0) {
        const installments = paymentMode === 'integral'
          ? [{ amount: payAmount, due_date: paymentDate }]
          : installmentPreview
        if (installments.length) {
          await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ show_id: data.id, installments }),
          }).catch(() => {})
        }
      }
    }

    toast({ title: 'Evento criado com sucesso!' })
    qc.invalidateQueries({ queryKey: ['shows', orgId] })
    qc.invalidateQueries({ queryKey: ['calendar-shows', orgId] })
    qc.invalidateQueries({ queryKey: ['dashboard-analytics', orgId] })
    qc.invalidateQueries({ queryKey: ['financeiro', orgId] })
    // Log activity (fire-and-forget)
    fetch('/api/org/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'show.created', entityType: 'show', entityId: data?.id, entityName: eventName }),
    }).catch(() => {})
    router.push(data?.id ? `/agenda/${data.id}` : '/agenda')
    setSaving(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full bg-background">

      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        <h1 className="text-sm font-semibold">Novo Evento</h1>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground"
          >
            Voltar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1.5 min-w-[90px]"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* ── Form body ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 md:px-6 py-6 space-y-5 max-w-6xl mx-auto w-full">

          {/* ── SECTION 1: Informações ─────────────────────────────────── */}
          <section className="rounded-xl border bg-card p-5 md:p-6 shadow-sm">
            <SectionTitle icon={Info} step={1}>Informações do Evento</SectionTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4">

              {/* Artista */}
              <Field label="Artista" required>
                <Select value={artistId} onValueChange={setArtistId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecionar artista">
                      {selectedArtist && (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={selectedArtist.photo_url ?? undefined} />
                            <AvatarFallback
                              style={{ backgroundColor: selectedArtist.color + '30', color: selectedArtist.color }}
                              className="text-[9px] font-bold"
                            >
                              {initials(selectedArtist.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{selectedArtist.name}</span>
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {artists.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={a.photo_url ?? undefined} />
                            <AvatarFallback
                              style={{ backgroundColor: a.color + '30', color: a.color }}
                              className="text-[9px] font-bold"
                            >
                              {initials(a.name)}
                            </AvatarFallback>
                          </Avatar>
                          {a.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Nome do evento */}
              <Field label="Nome do evento" required className="xl:col-span-2">
                <Input
                  placeholder="Ex: Show de Verão — Recife"
                  value={eventName}
                  onChange={e => setEventName(e.target.value)}
                  className="h-10"
                />
              </Field>

              {/* Tipo de evento */}
              <Field label="Tipo de evento">
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              {/* Status */}
              <Field label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-10">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: statusColor }}
                        />
                        {selectedStatus?.label}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SHOW_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: SHOW_STATUS_COLORS[s.value as ShowStatus] }}
                          />
                          {s.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Data */}
              <Field label="Data" required>
                <Popover open={calOpen} onOpenChange={setCalOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md border bg-background px-3 h-10 text-sm text-left transition-colors',
                        'hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                        calOpen && 'border-primary ring-2 ring-primary ring-offset-1',
                      )}
                    >
                      <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className={cn('flex-1', !eventDate && 'text-muted-foreground')}>
                        {eventDate
                          ? format(eventDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : 'Selecionar data'}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={eventDate}
                      onSelect={d => { setEventDate(d); setCalOpen(false) }}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </Field>

              {/* Horário */}
              <Field label="Horário de início">
                <TimePicker value={startTime} onChange={setStartTime} />
              </Field>

              {/* Duração */}
              <Field label="Duração">
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              {/* Local */}
              <Field label="Local / Casa de show">
                <Input
                  placeholder="Ex: Arena Pernambuco"
                  value={venueName}
                  onChange={e => setVenueName(e.target.value)}
                  className="h-10"
                />
              </Field>

              {/* Estado */}
              <Field label="Estado">
                <Select value={stateUF} onValueChange={v => { setStateUF(v); setCity('') }}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.value} – {s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* Cidade */}
              <Field
                label="Cidade"
                hint={!stateUF ? 'Selecione o estado primeiro para sugestões precisas' : undefined}
              >
                <CityInput
                  value={city}
                  uf={stateUF || undefined}
                  onSelect={(nome, sigla) => { setCity(nome); if (sigla && !stateUF) setStateUF(sigla) }}
                />
              </Field>

            </div>
          </section>

          {/* ── SECTION 2: Contratação ─────────────────────────────────── */}
          <section className="rounded-xl border bg-card p-5 md:p-6 shadow-sm">
            <SectionTitle icon={Users} step={2}>Contratação e Financeiro</SectionTitle>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4">

              {/* Contratante */}
              <Field label="Contratante">
                <Select value={contractorId} onValueChange={setContractorId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecionar contratante" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              {/* Parceiro local */}
              <Field label="Parceiro local">
                <Input
                  placeholder="Nome do parceiro local"
                  value={localPartner}
                  onChange={e => setLocalPartner(e.target.value)}
                  className="h-10"
                />
              </Field>

              {/* Tipo de contrato */}
              <Field label="Tipo de contrato">
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prefeitura">Prefeitura / Governo</SelectItem>
                    <SelectItem value="privado">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Tipo de negociação — full width */}
              <Field label="Tipo de negociação" className="col-span-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-0.5">
                  {NEGOTIATION_TYPES.map(n => {
                    const isActive = negotiationType === n.value
                    return (
                      <button
                        key={n.value}
                        type="button"
                        onClick={() => setNegotiationType(n.value)}
                        className={cn(
                          'group relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150',
                          isActive
                            ? 'border-primary bg-primary/8 shadow-sm shadow-primary/10'
                            : 'border-border bg-background hover:border-primary/40 hover:bg-muted/40',
                        )}
                      >
                        {/* Active indicator */}
                        {isActive && (
                          <span className="absolute top-3 right-3 flex h-2 w-2 rounded-full bg-primary" />
                        )}
                        <div
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                            isActive ? 'bg-primary/15' : 'bg-muted group-hover:bg-primary/10',
                          )}
                        >
                          <n.icon
                            className={cn(
                              'h-3.5 w-3.5 transition-colors',
                              isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary',
                            )}
                          />
                        </div>
                        <div>
                          <p className={cn('text-sm font-semibold leading-none mb-1', isActive ? 'text-primary' : 'text-foreground')}>
                            {n.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground leading-tight">{n.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </Field>

              {/* Cachê */}
              {showCache && (
                <Field label="Cachê">
                  <CurrencyInput value={cacheStr} onChange={setCacheStr} />
                </Field>
              )}

              {/* Garantia + % bilheteria */}
              {needsGuarantee && (
                <>
                  <Field label="Garantia mínima">
                    <CurrencyInput value={guaranteeStr} onChange={setGuaranteeStr} />
                  </Field>
                  <Field label="% da Bilheteria">
                    <div className="relative flex items-center">
                      <Input
                        className="pr-10 font-mono tabular-nums h-10"
                        placeholder="0"
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={bilheteriaPct}
                        onChange={e => setBilheteriaPct(e.target.value)}
                      />
                      <span className="absolute right-0 flex items-center justify-center w-10 h-full text-xs font-semibold text-muted-foreground border-l border-border bg-muted/50 rounded-r-md select-none">
                        %
                      </span>
                    </div>
                  </Field>
                </>
              )}

              {/* Desconto */}
              <Field label="Desconto">
                <CurrencyInput value={discountStr} onChange={setDiscountStr} />
              </Field>

              {/* Link de vendas */}
              <Field label="Link de vendas" className="xl:col-span-2">
                <div className="relative flex items-center">
                  <Link2 className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="url"
                    className="pl-9 h-10"
                    placeholder="https://…"
                    value={salesLink}
                    onChange={e => setSalesLink(e.target.value)}
                  />
                </div>
              </Field>

            </div>
          </section>

          {/* ── SECTION 3: Plano de Pagamento ─────────────────────────── */}
          <section className="rounded-xl border bg-card p-5 md:p-6 shadow-sm">
            <SectionTitle icon={CreditCard} step={3}>Plano de Pagamento</SectionTitle>

            {/* Mode selector */}
            <div className="flex flex-wrap gap-2 mb-5">
              {([
                { value: 'sem_plano', label: 'Sem plano agora' },
                { value: 'integral',  label: 'À vista' },
                { value: 'parcelado', label: 'Parcelado' },
              ] as const).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectPaymentMode(value)}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150',
                    paymentMode === value
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted/50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {paymentMode === 'sem_plano' && (
              <p className="text-sm text-muted-foreground">
                Você poderá adicionar o plano de pagamento depois, na aba <strong>Financeiro</strong>.
              </p>
            )}

            {(paymentMode === 'integral' || paymentMode === 'parcelado') && (
              <div className="space-y-4">
                <div className={cn(
                  'grid gap-4',
                  paymentMode === 'parcelado'
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2',
                )}>
                  {/* Amount */}
                  <Field label="Valor total (R$)" required>
                    <CurrencyInput value={paymentAmountStr} onChange={setPaymentAmountStr} />
                  </Field>

                  {/* Date */}
                  <Field label={paymentMode === 'integral' ? 'Data de vencimento' : 'Data da 1ª parcela'} required>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={e => setPaymentDate(e.target.value)}
                      className="h-10"
                    />
                  </Field>

                  {/* Num parcelas */}
                  {paymentMode === 'parcelado' && (
                    <Field label="Nº de parcelas">
                      <Input
                        type="number"
                        min="2"
                        max="24"
                        value={numParcelas}
                        onChange={e => setNumParcelas(e.target.value)}
                        className="h-10"
                      />
                    </Field>
                  )}
                </div>

                {/* Installment preview */}
                {paymentMode === 'parcelado' && installmentPreview.length > 0 && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="px-4 py-2 bg-muted/40 border-b border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Prévia das parcelas
                      </p>
                    </div>
                    <div className="divide-y divide-border/50">
                      {installmentPreview.map((inst, i) => {
                        const isLast = i === installmentPreview.length - 1
                        const isPast = isBefore(parseISO(inst.due_date), new Date())
                        return (
                          <div key={i} className="flex items-center justify-between px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                                {i + 1}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {inst.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <span className={cn(
                                'text-[11px]',
                                isPast ? 'text-destructive' : 'text-muted-foreground',
                              )}>
                                {format(parseISO(inst.due_date), 'dd/MM/yyyy')}
                              </span>
                              <span className={cn(
                                'text-xs font-semibold tabular-nums',
                                isLast && installmentPreview.length > 1 ? 'text-primary' : 'text-foreground',
                              )}>
                                {inst.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {/* Total */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border">
                      <span className="text-xs font-semibold text-muted-foreground">Total</span>
                      <span className="text-sm font-bold tabular-nums">
                        {parseCurrency(paymentAmountStr).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                )}

                {/* À vista summary */}
                {paymentMode === 'integral' && paymentAmountStr && parseCurrency(paymentAmountStr) > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      Pagamento único de{' '}
                      <strong>
                        {parseCurrency(paymentAmountStr).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </strong>{' '}
                      com vencimento em{' '}
                      <strong>
                        {paymentDate
                          ? format(parseISO(paymentDate), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : '—'}
                      </strong>
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── SECTION 4: Anexos ──────────────────────────────────────── */}
          <section className="rounded-xl border bg-card p-5 md:p-6 shadow-sm">
            <SectionTitle icon={FileText} step={4}>Anexos do Evento</SectionTitle>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'relative flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-all duration-150',
                dragOver
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'border-border hover:border-primary/40 hover:bg-muted/30',
              )}
            >
              <div className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl transition-colors',
                dragOver ? 'bg-primary/15' : 'bg-muted',
              )}>
                <Upload className={cn('w-5 h-5 transition-colors', dragOver ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {dragOver ? 'Solte para anexar' : 'Arraste ou clique para anexar'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF, Word, imagens, planilhas — qualquer formato</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => { if (e.target.files) uploadFiles(e.target.files) }}
              />
            </div>

            {/* Previews */}
            {attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 gap-3">
                {attachments.map(file => (
                  <div key={file.name} className="relative group rounded-lg border bg-muted/30 overflow-hidden">
                    <div className="aspect-square flex items-center justify-center">
                      {file.type.startsWith('image/') && file.url
                        ? <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        : (
                          <div className="flex flex-col items-center gap-1.5 p-3">
                            {file.uploading
                              ? <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                              : <FileText className="w-6 h-6 text-muted-foreground" />}
                            <span className="text-[9px] text-muted-foreground uppercase font-mono font-semibold">
                              {file.name.split('.').pop()}
                            </span>
                          </div>
                        )}
                    </div>
                    <div className="px-2 py-1.5 border-t border-border bg-card">
                      <p className="text-[10px] font-medium truncate leading-tight">{file.name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setAttachments(a => a.filter(x => x.name !== file.name)) }}
                      className="absolute top-1.5 right-1.5 rounded-full bg-foreground/80 p-1 text-background opacity-0 group-hover:opacity-100 transition-opacity hover:bg-foreground"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 pb-6">
            <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground w-full sm:w-auto">
              ← Voltar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 px-6 w-full sm:w-auto">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando…' : 'Salvar Evento'}
            </Button>
          </div>

        </div>
      </div>
    </div>
  )
}
