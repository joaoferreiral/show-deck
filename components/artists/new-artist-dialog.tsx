'use client'

import { useState, useRef } from 'react'
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Camera } from 'lucide-react'
import { BRAZILIAN_STATES } from '@/types'
import { slugify, initials } from '@/lib/utils'

interface NewArtistDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
}

const COLORS = [
  { label: 'Violeta', value: '#7c3aed' },
  { label: 'Rosa', value: '#db2777' },
  { label: 'Azul', value: '#2563eb' },
  { label: 'Verde', value: '#059669' },
  { label: 'Laranja', value: '#ea580c' },
  { label: 'Vermelho', value: '#dc2626' },
  { label: 'Amarelo', value: '#ca8a04' },
  { label: 'Ciano', value: '#0891b2' },
]

export function NewArtistDialog({ open, onOpenChange, orgId }: NewArtistDialogProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [color, setColor] = useState('#7c3aed')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

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

  function resetForm() {
    setName('')
    setBio('')
    setCity('')
    setState('')
    setColor('#7c3aed')
    setPhoto(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    try {
      // Upload photo via browser storage client (public bucket, no RLS issue)
      let photoUrl: string | null = null
      if (photo) {
        const supabase = createClient() as any
        const ext = photo.name.split('.').pop() ?? 'jpg'
        const fileName = `${orgId}/${Date.now()}.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('artist-photos')
          .upload(fileName, photo, { upsert: true })

        if (uploadError) {
          toast({
            title: 'Aviso: foto não enviada',
            description: 'Verifique se o bucket "artist-photos" existe no Supabase Storage.',
            variant: 'destructive',
          })
        } else if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('artist-photos')
            .getPublicUrl(uploadData.path)
          photoUrl = publicUrl
        }
      }

      // Create artist via API route (uses service client, bypasses RLS)
      const res = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: `${slugify(name)}-${Date.now()}`,
          bio: bio.trim() || null,
          base_city: city || null,
          base_state: state || null,
          color,
          photo_url: photoUrl,
          social_links: {},
          contact: {},
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Erro ao cadastrar artista', description: data.error, variant: 'destructive' })
        return
      }

      toast({ title: 'Artista cadastrado!', description: `${name} foi adicionado(a).` })

      // Immediately inject the new artist into the cache so the list updates without waiting for a refetch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      queryClient.setQueryData(['artists', orgId], (old: any) => {
        const prev = old ?? { artists: [], countByArtist: {} }
        const updated = [...(prev.artists ?? []), data.artist].sort((a: any, b: any) =>
          a.name.localeCompare(b.name, 'pt-BR')
        )
        return { ...prev, artists: updated }
      })
      // Also invalidate so the list re-syncs from the server in the background
      queryClient.invalidateQueries({ queryKey: ['artists', orgId] })

      onOpenChange(false)
      resetForm()
    } catch {
      toast({ title: 'Erro ao cadastrar artista', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Artista</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Photo upload */}
          <div className="flex flex-col items-center gap-2">
            <div
              className="relative cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="h-20 w-20">
                {photoPreview && <AvatarImage src={photoPreview} alt="Preview" />}
                <AvatarFallback
                  style={{ backgroundColor: `${color}20`, color }}
                  className="text-2xl font-bold"
                >
                  {name ? initials(name) : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {photoPreview ? 'Clique para trocar a foto' : 'Clique para adicionar foto'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          <div className="space-y-2">
            <Label>Nome artístico *</Label>
            <Input
              placeholder="Ex: Banda Forró Total, DJ Marquinhos..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Bio / Descrição</Label>
            <Input
              placeholder="Breve descrição do artista"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cidade base</Label>
              <Input
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

          <div className="space-y-2">
            <Label>Cor de identificação</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setColor(c.value)}
                  className="w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    backgroundColor: c.value,
                    boxShadow: color === c.value ? `0 0 0 3px white, 0 0 0 5px ${c.value}` : undefined,
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Cor usada nos cards e na agenda para identificar rapidamente o artista.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => { onOpenChange(false); resetForm() }}
            >
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
