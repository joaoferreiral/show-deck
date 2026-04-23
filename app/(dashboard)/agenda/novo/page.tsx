'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/providers/session-provider'
import { useArtists, useContractors } from '@/lib/hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { BRAZILIAN_STATES } from '@/types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronRight, Upload, X, FileText, Loader2, Save, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TimePicker } from '@/components/ui/time-picker'
import Link from 'next/link'
import { initials } from '@/lib/utils'

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

  // Form state
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

  const needsGuarantee = ['cache_colocado', 'bilheteria_colocada'].includes(negotiationType)
  const showCache = ['cache', 'cache_colocado'].includes(negotiationType)

  // Upload
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

  // Save
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
    } else {
      toast({ title: 'Evento criado!' })
      qc.invalidateQueries({ queryKey: ['shows', orgId] })
      qc.invalidateQueries({ queryKey: ['calendar-shows', orgId] })
      qc.invalidateQueries({ queryKey: ['dashboard-analytics', orgId] })
      router.push(data?.id ? `/agenda/${data.id}` : '/agenda')
    }
    setSaving(false)
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <div>
          <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
            <Link href="/agenda" className="hover:text-foreground transition-colors">Agenda</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-foreground font-medium">Novo Evento</span>
          </nav>
          <h1 className="text-lg font-bold leading-tight">Novo Evento</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Voltar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* ── Form body ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 md:px-6 py-6 space-y-8">

          {/* ── SECTION 1: Informações ─────────────────────────────────── */}
          <section>
            <SectionTitle>Informações do Evento</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">

              <Field label="Artista" required>
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
              </Field>

              <Field label="Nome do evento" required className="xl:col-span-2">
                <Input placeholder="Ex: Show de Verão – Recife" value={eventName} onChange={e => setEventName(e.target.value)} />
              </Field>

              <Field label="Tipo de evento">
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SHOW_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Data" required>
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
              </Field>

              <Field label="Horário de início">
                <TimePicker value={startTime} onChange={setStartTime} />
              </Field>

              <Field label="Duração">
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Local / Casa de show" className="xl:col-span-1">
                <Input placeholder="Ex: Arena Pernambuco" value={venueName} onChange={e => setVenueName(e.target.value)} />
              </Field>

              <Field label="Estado">
                <Select value={stateUF} onValueChange={v => { setStateUF(v); setCity('') }}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map(s => <SelectItem key={s.value} value={s.value}>{s.value} – {s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Cidade">
                <CityInput value={city} uf={stateUF || undefined}
                  onSelect={(nome, sigla) => { setCity(nome); if (sigla && !stateUF) setStateUF(sigla) }} />
              </Field>

            </div>
          </section>

          {/* ── SECTION 2: Contratação ─────────────────────────────────── */}
          <section>
            <SectionTitle>Contratação e Financeiro</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-4">

              <Field label="Contratante">
                <Select value={contractorId} onValueChange={setContractorId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar contratante" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Nenhum</SelectItem>
                    {contractors.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Parceiro local">
                <Input placeholder="Nome do parceiro local" value={localPartner} onChange={e => setLocalPartner(e.target.value)} />
              </Field>

              <Field label="Tipo de contrato">
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prefeitura">Prefeitura / Governo</SelectItem>
                    <SelectItem value="privado">Privado</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {/* Negotiation type — full row */}
              <Field label="Tipo de negociação" className="col-span-full">
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
              </Field>

              {/* Cachê */}
              {showCache && (
                <Field label="Cachê (R$)">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input className="pl-9" placeholder="0,00" value={cacheStr}
                      onChange={e => setCacheStr(maskCurrency(e.target.value))} />
                  </div>
                </Field>
              )}

              {/* Guarantee + % bilheteria */}
              {needsGuarantee && (
                <>
                  <Field label="Garantia (R$)">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <Input className="pl-9" placeholder="0,00" value={guaranteeStr}
                        onChange={e => setGuaranteeStr(maskCurrency(e.target.value))} />
                    </div>
                  </Field>
                  <Field label="% Bilheteria">
                    <div className="relative">
                      <Input className="pr-8" placeholder="0" type="number" min="0" max="100" step="0.5"
                        value={bilheteriaPct} onChange={e => setBilheteriaPct(e.target.value)} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </Field>
                </>
              )}

              <Field label="Desconto (R$)">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <Input className="pl-9" placeholder="0,00" value={discountStr}
                    onChange={e => setDiscountStr(maskCurrency(e.target.value))} />
                </div>
              </Field>

              <Field label="Link de vendas" className="xl:col-span-2">
                <Input type="url" placeholder="https://…" value={salesLink}
                  onChange={e => setSalesLink(e.target.value)} />
              </Field>

            </div>
          </section>

          {/* ── SECTION 3: Anexos ──────────────────────────────────────── */}
          <section>
            <SectionTitle>Anexos do Evento</SectionTitle>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
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

            {/* Previews */}
            {attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {attachments.map(file => (
                  <div key={file.name} className="relative group rounded-lg border bg-card overflow-hidden">
                    <div className="aspect-square flex items-center justify-center bg-muted">
                      {file.type.startsWith('image/') && file.url
                        ? <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                        : <div className="flex flex-col items-center gap-1 p-2">
                            {file.uploading
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
                      <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setAttachments(a => a.filter(x => x.name !== file.name)) }}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Footer actions (bottom of page, aligned left) ─────────── */}
          <div className="flex items-center gap-3 pt-2 pb-4 border-t">
            <Button variant="outline" onClick={() => router.back()}>Voltar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Evento
            </Button>
          </div>

        </div>
      </div>
    </div>
  )
}
