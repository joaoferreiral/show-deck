'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { BRAZILIAN_STATES } from '@/types'
import type { Artist } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { initials } from '@/lib/utils'

// ─── City Autocomplete ────────────────────────────────────────────────────────

type IbgeMunicipality = {
  id: number
  nome: string
  sigla: string // state abbreviation
}

// Module-level cache per state
const _cityCache: Record<string, IbgeMunicipality[]> = {}
const _allKey = '__all__'

async function fetchCities(uf?: string): Promise<IbgeMunicipality[]> {
  const key = uf || _allKey
  if (_cityCache[key]) return _cityCache[key]

  const url = uf
    ? `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
    : `https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome`

  const res = await fetch(url)
  const data = await res.json()

  const mapped: IbgeMunicipality[] = data.map((m: any) => ({
    id: m.id,
    nome: m.nome,
    sigla: uf ?? m.microrregiao?.mesorregiao?.UF?.sigla ?? '',
  }))

  _cityCache[key] = mapped
  return mapped
}

interface CityInputProps {
  value: string
  onChange: (city: string, uf?: string) => void
  stateFilter?: string
  placeholder?: string
}

function CityInput({ value, onChange, stateFilter, placeholder = 'Ex: Recife' }: CityInputProps) {
  const [cities, setCities] = useState<IbgeMunicipality[]>([])
  const [suggestions, setSuggestions] = useState<IbgeMunicipality[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Pre-load cities when state changes
  useEffect(() => {
    if (!stateFilter) return
    setLoading(true)
    fetchCities(stateFilter).then(c => { setCities(c); setLoading(false) })
  }, [stateFilter])

  // Filter as user types
  useEffect(() => {
    const q = value.trim().toLowerCase()
    if (q.length < 2) { setSuggestions([]); return }

    const pool = cities.length > 0 ? cities : []
    const matches = pool
      .filter(c => c.nome.toLowerCase().includes(q))
      .slice(0, 10)
    setSuggestions(matches)
    setOpen(matches.length > 0)
    setActiveIdx(-1)
  }, [value, cities])

  // Load all cities lazily when user types without a state
  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)
    if (v.length >= 2 && !stateFilter && cities.length === 0) {
      setLoading(true)
      const all = await fetchCities()
      setCities(all)
      setLoading(false)
    }
  }, [onChange, stateFilter, cities.length])

  function pick(m: IbgeMunicipality) {
    onChange(m.nome, m.sigla)
    setSuggestions([])
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      pick(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
      {open && suggestions.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 max-h-52 overflow-auto rounded-md border bg-popover shadow-md py-1"
        >
          {suggestions.map((m, i) => (
            <li
              key={m.id}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
              }`}
              onMouseDown={() => pick(m)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <span>{m.nome}</span>
              <span className="text-xs text-muted-foreground ml-2">{m.sigla}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Dialog ───────────────────────────────────────────────────────────────────

interface NewShowDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
}

export function NewShowDialog({ open, onOpenChange, orgId }: NewShowDialogProps) {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(false)

  const [title, setTitle] = useState('')
  const [artistId, setArtistId] = useState('')
  const [startAt, setStartAt] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [venueName, setVenueName] = useState('')
  const [cacheValue, setCacheValue] = useState('')
  const [status, setStatus] = useState('pre_reserva')

  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from('artists')
      .select('id, name, color, photo_url')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('name')
      .then(({ data }) => setArtists(data ?? []))
  }, [open, orgId])

  function reset() {
    setTitle(''); setArtistId(''); setStartAt(''); setCity('')
    setState(''); setVenueName(''); setCacheValue(''); setStatus('pre_reserva')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!artistId || !startAt || !title) return
    setLoading(true)

    const supabase = createClient()
    const sb = supabase as any
    const { error } = await sb.from('shows').insert({
      org_id: orgId,
      artist_id: artistId,
      title,
      status,
      start_at: new Date(startAt).toISOString(),
      city: city || null,
      state: state || null,
      venue_name: venueName || null,
      cache_value: parseFloat(cacheValue) || 0,
    })

    if (error) {
      toast({ title: 'Erro ao criar show', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Show criado!', description: `"${title}" adicionado à agenda.` })
      queryClient.invalidateQueries({ queryKey: ['shows', orgId] })
      queryClient.invalidateQueries({ queryKey: ['calendar-shows', orgId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', orgId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-analytics', orgId] })
      onOpenChange(false)
      reset()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Show</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Título do show *</Label>
            <Input
              placeholder="Ex: Show no Recife - Forró Pé de Serra"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Artista *</Label>
            <Select value={artistId} onValueChange={setArtistId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar artista" />
              </SelectTrigger>
              <SelectContent>
                {artists.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        {(a as any).photo_url && <AvatarImage src={(a as any).photo_url} alt={a.name} />}
                        <AvatarFallback style={{ backgroundColor: `${a.color}30`, color: a.color }} className="text-[9px] font-bold">
                          {initials(a.name)}
                        </AvatarFallback>
                      </Avatar>
                      {a.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!artists.length && (
              <p className="text-xs text-muted-foreground">
                Cadastre um artista primeiro na aba Artistas.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Data e hora *</Label>
            <Input
              type="datetime-local"
              value={startAt}
              onChange={e => setStartAt(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={state} onValueChange={v => { setState(v); setCity('') }}>
                <SelectTrigger>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.value} – {s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <CityInput
                value={city}
                stateFilter={state || undefined}
                onChange={(nome, uf) => {
                  setCity(nome)
                  if (uf && !state) setState(uf)
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Local / Casa de show</Label>
            <Input
              placeholder="Ex: Arena Pernambuco"
              value={venueName}
              onChange={e => setVenueName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cachê (R$)</Label>
              <Input
                type="number"
                placeholder="0,00"
                min="0"
                step="0.01"
                value={cacheValue}
                onChange={e => setCacheValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_reserva">Pré-reserva</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="contrato_enviado">Contrato Enviado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => { onOpenChange(false); reset() }}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || !artistId || !title || !startAt}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Show
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
