'use client'

import { useSession } from '@/components/providers/session-provider'
import { useArtists } from '@/lib/hooks/queries'
import { initials } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Mic2 } from 'lucide-react'
import Link from 'next/link'
import { NewArtistButton } from '@/components/artists/new-artist-button'

export default function ArtistasPage() {
  const { orgId } = useSession()
  const { data, isLoading } = useArtists(orgId)

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? <Skeleton className="h-4 w-20 inline-block" /> : `${data?.artists.length ?? 0} artista${(data?.artists.length ?? 0) !== 1 ? 's' : ''}`}
        </p>
        <NewArtistButton orgId={orgId} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !data?.artists.length && (
        <Card>
          <CardContent className="py-16 text-center">
            <Mic2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Nenhum artista cadastrado ainda.</p>
            <NewArtistButton orgId={orgId} />
          </CardContent>
        </Card>
      )}

      {/* Grid */}
      {!isLoading && !!data?.artists.length && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.artists.map((artist) => (
            <Link key={artist.id} href={`/artistas/${artist.id}`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12 shrink-0">
                      {artist.photo_url && <AvatarImage src={artist.photo_url} alt={artist.name} />}
                      <AvatarFallback
                        style={{ backgroundColor: `${artist.color}20`, color: artist.color }}
                        className="text-sm font-semibold"
                      >
                        {initials(artist.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{artist.name}</p>
                        {!artist.active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                      </div>
                      {artist.bio && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{artist.bio}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {(artist.base_city || artist.base_state) && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {artist.base_city ?? ''}{artist.base_state ? `, ${artist.base_state}` : ''}
                          </span>
                        )}
                        {(data.countByArtist[artist.id] ?? 0) > 0 && (
                          <span className="text-xs font-medium text-primary">
                            {data.countByArtist[artist.id]} show{data.countByArtist[artist.id] > 1 ? 's' : ''} ativo{data.countByArtist[artist.id] > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
