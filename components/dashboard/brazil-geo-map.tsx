'use client'

import { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'

// ── Projection ────────────────────────────────────────────────────────────────
// Expand bounds beyond Brazil's real extent to reduce visual scale
// (more "ocean" around the country → smaller map within the card)
const MIN_LON = -85
const MAX_LON = -20
const MIN_LAT = -40
const MAX_LAT = 12
const W = 460
const H = 420
// Padding so tooltip/glow never gets clipped by the card's overflow
const PAD = 24

function project(lon: number, lat: number): [number, number] {
  const x = ((lon - MIN_LON) / (MAX_LON - MIN_LON)) * W
  const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * H
  return [x, y]
}

function ringToD(ring: [number, number][]): string {
  return ring.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ') + ' Z'
}

function geometryToD(geometry: any): string {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(ringToD).join(' ')
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((poly: any) => poly.map(ringToD)).join(' ')
  }
  return ''
}

// ── Centroid (label position) ──────────────────────────────────────────────────
function centroid(geometry: any): [number, number] {
  const rings: [number, number][][] =
    geometry.type === 'Polygon'
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((p: any) => p[0])

  // Pick the ring with most points (largest polygon for MultiPolygon)
  const ring = rings.sort((a, b) => b.length - a.length)[0]
  const sum = ring.reduce(
    (acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat],
    [0, 0],
  )
  return project(sum[0] / ring.length, sum[1] / ring.length)
}

// ── Module-level cache ─────────────────────────────────────────────────────────
let _geojson: any = null
let _promise: Promise<any> | null = null

async function loadGeoJson() {
  if (_geojson) return _geojson
  if (!_promise) {
    _promise = fetch('/brazil-states.geojson')
      .then(r => r.json())
      .then(d => { _geojson = d; _promise = null; return d })
      .catch(() => { _promise = null; return null })
  }
  return _promise
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  showsByState: Record<string, number>
  primaryColor?: string
}

type Feature = {
  properties: { sigla: string; name: string }
  geometry: any
  d: string
  cx: number
  cy: number
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const ZOOM_STEP = 0.5

export function BrazilGeoMap({ showsByState, primaryColor = '#7c3aed' }: Props) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [zoom, setZoom] = useState(1)
  const svgRef = useRef<SVGSVGElement>(null)

  // Compute dynamic viewBox centered on the map
  const totalW = W + PAD * 2
  const totalH = H + PAD * 2
  const vbW = totalW / zoom
  const vbH = totalH / zoom
  const vbX = totalW / 2 - vbW / 2 - PAD
  const vbY = totalH / 2 - vbH / 2 - PAD

  useEffect(() => {
    loadGeoJson().then(data => {
      if (!data) return
      setFeatures(
        data.features.map((f: any) => {
          const d = geometryToD(f.geometry)
          const [cx, cy] = centroid(f.geometry)
          return { properties: f.properties, geometry: f.geometry, d, cx, cy }
        }),
      )
    })
  }, [])

  const maxCount = Math.max(1, ...Object.values(showsByState))

  function handleMouseMove(e: React.MouseEvent<SVGPathElement>, sigla: string) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const scaleX = W / rect.width
    const scaleY = H / rect.height
    const count = showsByState[sigla] ?? 0
    const name = features.find(f => f.properties.sigla === sigla)?.properties.name ?? sigla
    setTooltip({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY - 20,
      text: `${name}: ${count} show${count !== 1 ? 's' : ''}`,
    })
  }

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        className="w-full"
      >
        {features.map(({ properties: { sigla, name }, d, cx, cy }) => {
          const count = showsByState[sigla] ?? 0
          const hasShows = count > 0
          const isHovered = hovered === sigla

          // Opacity scales with count
          const opacity = hasShows
            ? 0.55 + 0.45 * Math.sqrt(count / maxCount)
            : 0

          return (
            <g key={sigla}>
              <path
                d={d}
                fill={hasShows ? primaryColor : 'hsl(var(--muted))'}
                fillOpacity={hasShows ? opacity : 0.25}
                stroke={hasShows ? 'white' : 'hsl(var(--border))'}
                strokeWidth={hasShows ? 1 : 0.5}
                style={{
                  cursor: hasShows ? 'pointer' : 'default',
                  transition: 'fill-opacity 0.2s',
                  filter: isHovered && hasShows ? `drop-shadow(0 0 6px ${primaryColor}80)` : 'none',
                }}
                onMouseEnter={() => setHovered(sigla)}
                onMouseLeave={() => { setHovered(null); setTooltip(null) }}
                onMouseMove={e => { if (hasShows) handleMouseMove(e, sigla) }}
              />

              {/* State abbreviation label */}
              <text
                x={cx}
                y={cy + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={hasShows ? 8.5 : 7}
                fontWeight={hasShows ? 700 : 400}
                fill={hasShows ? 'white' : 'hsl(var(--muted-foreground))'}
                fillOpacity={hasShows ? 0.95 : 0.6}
                style={{ pointerEvents: 'none' }}
              >
                {sigla}
              </text>

              {/* Show count badge */}
              {hasShows && (
                <text
                  x={cx}
                  y={cy + 11}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={6.5}
                  fontWeight={600}
                  fill="white"
                  fillOpacity={0.85}
                  style={{ pointerEvents: 'none' }}
                >
                  ({count})
                </text>
              )}
            </g>
          )
        })}

        {/* SVG Tooltip */}
        {tooltip && (
          <g style={{ pointerEvents: 'none' }}>
            <rect
              x={Math.min(tooltip.x - 55, W - 115)}
              y={tooltip.y - 14}
              width={110}
              height={22}
              rx={4}
              fill="hsl(var(--popover))"
              stroke="hsl(var(--border))"
              strokeWidth={0.8}
              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.18))"
            />
            <text
              x={Math.min(tooltip.x, W - 60)}
              y={tooltip.y - 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={8.5}
              fontWeight={600}
              fill="hsl(var(--popover-foreground))"
            >
              {tooltip.text}
            </text>
          </g>
        )}
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-8 right-1 flex flex-col gap-0.5">
        <button
          onClick={() => setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM))}
          disabled={zoom >= MAX_ZOOM}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          title="Zoom in"
        >
          <ZoomIn className="h-3 w-3" />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM))}
          disabled={zoom <= MIN_ZOOM}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          title="Zoom out"
        >
          <ZoomOut className="h-3 w-3" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: primaryColor }} />
          Com shows
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-muted opacity-50" />
          Sem shows
        </span>
        {Object.values(showsByState).some(v => v > 1) && (
          <span className="text-muted-foreground/60 italic">
            Intensidade ∝ quantidade
          </span>
        )}
      </div>
    </div>
  )
}
