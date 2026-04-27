'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/components/providers/session-provider'
import { useArtistDetail } from '@/lib/hooks/queries'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/use-toast'
import { formatDate, formatCurrency, initials, slugify } from '@/lib/utils'
import { SHOW_STATUS_LABELS, SHOW_STATUS_COLORS, BRAZILIAN_STATES } from '@/types'
import type { ShowStatus } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft, Pencil, Save, X, Trash2, Camera,
  MapPin, Calendar, Mic2,
} from 'lucide-react'
import Link from 'next/link'

const COLORS = [
  '#7c3aed', '#db2777', '#2563eb', '#059669',
  '#ea580c', '#dc2626', '#ca8a04', '#0891b2',
]

export default function ArtistDetailPage() {
  const params = useParams()
  const artistId = params.id as string
  const { orgId } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useArtistDetail(orgId, artistId)

  // ─── Edit state ───────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [color, setColor] = useState('#7c3aed')
  const [active, setActive] = useState(true)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  function startEdit() {
    if (!data) return
    const a = data.artist
    setName(a.name)
    setBio(a.bio ?? '')
    setCity(a.base_city ?? '')
    setState(a.base_state ?? '')
    setColor(a.color)
    setActive(a.active)
    setPhoto(null)
    setPhotoPreview(null)
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setPhoto(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Máximo de 5 MB.', variant: 'destructive' })
      return
    }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)

    let photoUrl: string | null = data?.artist.photo_url ?? null

    // Photo upload still uses browser storage client (public bucket, no RLS issue)
    if (photo) {
      const supabase = createClient() as any
      const ext = photo.name.split('.').pop() ?? 'jpg'
      const fileName = `${orgId}/${artistId}-${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('artist-photos')
        .upload(fileName, photo, { upsert: true })
      if (uploadError) {
        toast({ title: 'Aviso: foto não enviada', description: uploadError.message, variant: 'destructive' })
      } else if (uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('artist-photos')
          .getPublicUrl(uploadData.path)
        photoUrl = publicUrl
      }
    }

    try {
      const res = await fetch(`/api/artists/${artistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: `${slugify(name)}-${artistId.slice(0, 8)}`,
          bio: bio.trim() || null,
          base_city: city || null,
          base_state: state || null,
          color,
          active,
          photo_url: photoUrl,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao salvar', description: json.error, variant: 'destructive' })
      } else {
        toast({ title: 'Artista atualizado!' })
        queryClient.invalidateQueries({ queryKey: ['artist', orgId, artistId] })
        queryClient.invalidateQueries({ queryKey: ['artists', orgId] })
        setEditing(false)
        if (photoPreview) URL.revokeObjectURL(photoPreview)
        setPhotoPreview(null)
      }
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/artists/${artistId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao deletar', description: json.error, variant: 'destructive' })
        setDeleting(false)
      } else {
        toast({ title: 'Artista removido.' })
        queryClient.invalidateQueries({ queryKey: ['artists', orgId] })
        router.push('/artistas')
      }
    } catch {
      toast({ title: 'Erro ao deletar', variant: 'destructive' })
      setDeleting(false)
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Mic2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Artista não encontrado.</p>
        <Button variant="link" asChild className="mt-2"><Link href="/artistas">Voltar</Link></Button>
      </div>
    )
  }

  const { artist, shows } = data
  const displayColor = editing ? color : artist.color
  const displayPhoto = photoPreview ?? artist.photo_url
  const displayName = editing ? name : artist.name

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto">
      {/* ── Back + actions ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 -ml-2">
          <Link href="/artistas">
            <ArrowLeft className="h-4 w-4" />
            Artistas
          </Link>
        </Button>

        <div className="flex items-center gap-2">
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
                    <AlertDialogTitle>Deletar artista?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso removerá <strong>{artist.name}</strong> permanentemente. Os shows vinculados
                      a este artista não serão deletados, mas perderão o vínculo.
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
              <Button variant="outline" size="sm" className="gap-1.5" onClick={cancelEdit}>
                <X className="h-3.5 w-3.5" />
                Cancelar
              </Button>
              <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || !name.trim()}>
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Salvando…' : 'Salvar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {/* Avatar (clickable in edit mode) */}
            <div
              className={`relative shrink-0 ${editing ? 'cursor-pointer group' : ''}`}
              onClick={editing ? () => fileInputRef.current?.click() : undefined}
            >
              <Avatar className="h-20 w-20">
                {displayPhoto && <AvatarImage src={displayPhoto} alt={displayName} />}
                <AvatarFallback
                  style={{ backgroundColor: `${displayColor}20`, color: displayColor }}
                  className="text-2xl font-bold"
                >
                  {initials(displayName || '?')}
                </AvatarFallback>
              </Avatar>
              {editing && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />

            <div className="flex-1 min-w-0 space-y-2">
              {editing ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-lg font-semibold h-10"
                  placeholder="Nome artístico"
                />
              ) : (
                <h1 className="text-xl font-bold truncate">{artist.name}</h1>
              )}

              {/* Active toggle */}
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <Switch checked={active} onCheckedChange={setActive} id="active-toggle" />
                    <Label htmlFor="active-toggle" className="text-sm">
                      {active ? 'Ativo' : 'Inativo'}
                    </Label>
                  </>
                ) : (
                  <Badge variant={artist.active ? 'default' : 'secondary'} className="text-xs">
                    {artist.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                )}
              </div>

              {/* Color picker in edit mode */}
              {editing && (
                <div className="flex items-center gap-2 pt-1">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
                      style={{
                        backgroundColor: c,
                        boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Info ────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Informações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bio */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Bio / Descrição</Label>
            {editing ? (
              <Input
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Breve descrição do artista"
              />
            ) : (
              <p className="text-sm">{artist.bio || <span className="text-muted-foreground italic">Sem descrição</span>}</p>
            )}
          </div>

          {/* City + State */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cidade base</Label>
              {editing ? (
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Recife" />
              ) : (
                <p className="text-sm flex items-center gap-1">
                  {artist.base_city
                    ? <><MapPin className="h-3 w-3 text-muted-foreground" />{artist.base_city}</>
                    : <span className="text-muted-foreground italic">—</span>}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              {editing ? (
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.value} – {s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{artist.base_state || <span className="text-muted-foreground italic">—</span>}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Shows ───────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Shows ({shows.length})
          </CardTitle>
          <Link href={`/agenda?artist=${artistId}`} className="text-xs text-primary hover:underline">
            Ver todos
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {!shows.length ? (
            <p className="px-5 py-6 text-sm text-muted-foreground text-center">Nenhum show registrado.</p>
          ) : (
            <div className="divide-y divide-border">
              {shows.slice(0, 8).map((show) => {
                const statusColor = SHOW_STATUS_COLORS[show.status as ShowStatus]
                return (
                  <Link
                    key={show.id}
                    href={`/agenda/${show.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div
                      className="w-1 h-8 rounded-full shrink-0"
                      style={{ backgroundColor: artist.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{show.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {formatDate(show.start_at, "dd/MM/yyyy 'às' HH:mm")}
                        {show.city && ` · ${show.city}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {show.cache_value > 0 && (
                        <p className="text-xs font-medium">{formatCurrency(show.cache_value)}</p>
                      )}
                      <Badge
                        className="text-[10px] mt-0.5"
                        style={{ backgroundColor: `${statusColor}20`, color: statusColor, border: 'none' }}
                      >
                        {SHOW_STATUS_LABELS[show.status as ShowStatus]}
                      </Badge>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
