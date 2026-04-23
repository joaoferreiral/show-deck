'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'

// ── Projection ────────────────────────────────────────────────────────────────
const MIN_LON = -75
const MAX_LON = -28
const MIN_LAT = -35
const MAX_LAT = 6
const W = 460
const H = 420
const PAD = 8   // smaller pad — map fills the card

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
  if (geometry.type === 'Polygon') return geometry.coordinates.map(ringToD).join(' ')
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap((p: any) => p.map(ringToD)).join(' ')
  return ''
}

function centroid(geometry: any): [number, number] {
  const rings: [number, number][][] =
    geometry.type === 'Polygon'
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((p: any) => p[0])
  const ring = rings.sort((a, b) => b.length - a.length)[0]
  const sum = ring.reduce((acc, [lon, lat]) => [acc[0] + lon, acc[1] + lat], [0, 0])
  return project(sum[0] / ring.length, sum[1] / ring.length)
}

// ── GeoJSON cache ─────────────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Constants ─────────────────────────────────────────────────────────────────
const MIN_ZOOM = 1
const MAX_ZOOM = 5
const ZOOM_STEP = 0.5

// ── Component ─────────────────────────────────────────────────────────────────
export function BrazilGeoMap({ showsByState, primaryColor = '#7c3aed' }: Props) {
  const [features, setFeatures] = useState<Feature[]>([])
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })     // in SVG units
  const [dragging, setDragging] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef({ cx: 0, cy: 0, px: 0, py: 0 })

  // ── ViewBox computation ───────────────────────────────────────────────────
  const totalW = W + PAD * 2
  const totalH = H + PAD * 2
  const vbW = totalW / zoom
  const vbH = totalH / zoom
  // Clamp pan so the map can't be dragged fully out of view
  const maxPX = (totalW - vbW) / 2
  const maxPY = (totalH - vbH) / 2
  const cpx = Math.max(-maxPX, Math.min(maxPX, pan.x))
  const cpy = Math.max(-maxPY, Math.min(maxPY, pan.y))
  const vbX = (W / 2) - vbW / 2 - cpx
  const vbY = (H / 2) - vbH / 2 - cpy

  useEffect(() => {
    loadGeoJson().then(data => {
      if (!data) return
      setFeatures(data.features.map((f: any) => ({
        properties: f.properties,
        geometry: f.geometry,
        d: geometryToD(f.geometry),
        ...(() => { const [cx, cy] = centroid(f.geometry); return { cx, cy } })(),
      })))
    })
  }, [])

  // ── Drag handlers ─────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    setDragging(true)
    setTooltip(null)
    dragStart.current = { cx: e.clientX, cy: e.clientY, px: cpx, py: cpy }
    e.preventDefault()
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const dxSvg = ((e.clientX - dragStart.current.cx) / rect.width)  * vbW
    const dySvg = ((e.clientY - dragStart.current.cy) / rect.height) * vbH
    setPan({ x: dragStart.current.px + dxSvg, y: dragStart.current.py + dySvg })
  }, [dragging, vbW, vbH])

  const onMouseUp = useCallback(() => setDragging(false), [])

  useEffect(() => {
    if (!dragging) return
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, onMouseMove, onMouseUp])

  // Touch drag support
  const touchStart = useRef({ tx: 0, ty: 0, px: 0, py: 0 })
  function onTouchStart(e: React.TouchEvent<SVGSVGElement>) {
    const t = e.touches[0]
    touchStart.current = { tx: t.clientX, ty: t.clientY, px: cpx, py: cpy }
  }
  function onTouchMove(e: React.TouchEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const t = e.touches[0]
    const dxSvg = ((t.clientX - touchStart.current.tx) / rect.width)  * vbW
    const dySvg = ((t.clientY - touchStart.current.ty) / rect.height) * vbH
    setPan({ x: touchStart.current.px + dxSvg, y: touchStart.current.py + dySvg })
  }

  // ── Zoom helpers ──────────────────────────────────────────────────────────
  function zoomIn() { setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM)) }
  function zoomOut() {
    setZoom(z => {
      const next = Math.max(z - ZOOM_STEP, MIN_ZOOM)
      if (next === MIN_ZOOM) setPan({ x: 0, y: 0 })
      return next
    })
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  // Use client-relative position on the wrapper div for the HTML tooltip
  function handlePathMouseMove(e: React.MouseEvent<SVGPathElement>, sigla: string) {
    if (dragging) return
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const count = showsByState[sigla] ?? 0
    const name = features.find(f => f.properties.sigla === sigla)?.properties.name ?? sigla
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      text: `${name}: ${count} show${count !== 1 ? 's' : ''}`,
    })
  }

  const maxCount = Math.max(1, ...Object.values(showsByState))

  return (
    <div className="flex flex-col h-full gap-2">

      {/* Map area — absolute SVG so height never depends on flex chain */}
      <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-hidden rounded-lg" style={{ minHeight: 180 }}>
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
        >
          {features.map(({ properties: { sigla }, d, cx, cy }) => {
            const count = showsByState[sigla] ?? 0
            const hasShows = count > 0
            const isHovered = hovered === sigla
            const opacity = hasShows ? 0.5 + 0.5 * Math.sqrt(count / maxCount) : 0

            return (
              <g key={sigla}>
                <path
                  d={d}
                  fill={hasShows ? primaryColor : 'hsl(var(--muted))'}
                  fillOpacity={hasShows ? opacity : 0.25}
                  stroke={hasShows ? 'white' : 'hsl(var(--border))'}
                  strokeWidth={hasShows ? 1 : 0.5}
                  style={{
                    cursor: hasShows ? 'pointer' : dragging ? 'grabbing' : 'grab',
                    transition: 'fill-opacity 0.2s',
                    filter: isHovered && hasShows ? `drop-shadow(0 0 6px ${primaryColor}80)` : 'none',
                  }}
                  onMouseEnter={() => !dragging && setHovered(sigla)}
                  onMouseLeave={() => { setHovered(null); setTooltip(null) }}
                  onMouseMove={e => { if (hasShows) handlePathMouseMove(e, sigla) }}
                />
                <text
                  x={cx} y={cy + 0.5}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={hasShows ? 8.5 : 7}
                  fontWeight={hasShows ? 700 : 400}
                  fill={hasShows ? 'white' : 'hsl(var(--muted-foreground))'}
                  fillOpacity={hasShows ? 0.95 : 0.6}
                  style={{ pointerEvents: 'none' }}
                >
                  {sigla}
                </text>
                {hasShows && (
                  <text
                    x={cx} y={cy + 11}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={6.5} fontWeight={600}
                    fill="white" fillOpacity={0.85}
                    style={{ pointerEvents: 'none' }}
                  >
                    ({count})
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        {/* HTML Tooltip */}
        {tooltip && !dragging && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-semibold text-popover-foreground shadow-lg whitespace-nowrap"
            style={{
              left: Math.min(tooltip.x + 12, (wrapRef.current?.clientWidth ?? 300) - 160),
              top: tooltip.y - 32,
            }}
          >
            {tooltip.text}
          </div>
        )}

        {/* Zoom controls — top-right corner */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            onClick={zoomIn}
            disabled={zoom >= MAX_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/85 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            title="Aproximar"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={zoomOut}
            disabled={zoom <= MIN_ZOOM}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/85 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            title="Afastar"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          {zoom > 1 && (
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background/85 backdrop-blur-sm text-[9px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
              title="Resetar zoom"
            >
              1×
            </button>
          )}
        </div>

        {/* Zoom indicator */}
        {zoom > 1 && (
          <div className="absolute bottom-2 left-2 rounded-md bg-background/70 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border">
            {zoom.toFixed(1)}×
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pb-1 text-xs text-muted-foreground shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: primaryColor }} />
          Com shows
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-muted opacity-50" />
          Sem shows
        </span>
        {Object.values(showsByState).some(v => v > 1) && (
          <span className="text-muted-foreground/60 italic hidden sm:inline">
            Intensidade ∝ quantidade
          </span>
        )}
      </div>
    </div>
  )
}
