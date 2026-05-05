'use client'

import { useState } from 'react'

// Centroid positions for all 26 states + DF
// Projected onto a 300×320 SVG canvas based on real geographic coordinates
const STATES: Record<string, { x: number; y: number; name: string }> = {
  RR: { x: 82,  y: 28,  name: 'Roraima' },
  AP: { x: 168, y: 28,  name: 'Amapá' },
  AM: { x: 62,  y: 78,  name: 'Amazonas' },
  PA: { x: 150, y: 68,  name: 'Pará' },
  AC: { x: 16,  y: 116, name: 'Acre' },
  RO: { x: 76,  y: 128, name: 'Rondônia' },
  TO: { x: 176, y: 122, name: 'Tocantins' },
  MA: { x: 190, y: 76,  name: 'Maranhão' },
  PI: { x: 214, y: 90,  name: 'Piauí' },
  CE: { x: 244, y: 74,  name: 'Ceará' },
  RN: { x: 270, y: 80,  name: 'Rio Grande do Norte' },
  PB: { x: 271, y: 94,  name: 'Paraíba' },
  PE: { x: 255, y: 108, name: 'Pernambuco' },
  AL: { x: 273, y: 120, name: 'Alagoas' },
  SE: { x: 264, y: 132, name: 'Sergipe' },
  BA: { x: 224, y: 150, name: 'Bahia' },
  MT: { x: 118, y: 142, name: 'Mato Grosso' },
  GO: { x: 168, y: 165, name: 'Goiás' },
  DF: { x: 181, y: 178, name: 'Distrito Federal' },
  MS: { x: 132, y: 212, name: 'Mato Grosso do Sul' },
  MG: { x: 202, y: 192, name: 'Minas Gerais' },
  ES: { x: 242, y: 205, name: 'Espírito Santo' },
  RJ: { x: 215, y: 232, name: 'Rio de Janeiro' },
  SP: { x: 176, y: 228, name: 'São Paulo' },
  PR: { x: 158, y: 252, name: 'Paraná' },
  SC: { x: 162, y: 268, name: 'Santa Catarina' },
  RS: { x: 152, y: 292, name: 'Rio Grande do Sul' },
}

const MIN_R = 9
const MAX_R = 24

interface BrazilMapProps {
  showsByState: Record<string, number>
  primaryColor?: string
}

export function BrazilMap({ showsByState, primaryColor = '#4A4540' }: BrazilMapProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const maxCount = Math.max(1, ...Object.values(showsByState).filter(Boolean))

  function getRadius(count: number) {
    if (count === 0) return MIN_R
    return MIN_R + (MAX_R - MIN_R) * Math.sqrt(count / maxCount)
  }

  return (
    <div className="relative w-full flex flex-col items-center">
      <svg
        viewBox="0 0 300 318"
        className="w-full max-w-[260px]"
        style={{ overflow: 'visible' }}
      >
        {Object.entries(STATES).map(([code, { x, y, name }]) => {
          const count = showsByState[code] ?? 0
          const r = getRadius(count)
          const hasShows = count > 0
          const isHovered = hovered === code

          return (
            <g
              key={code}
              onMouseEnter={() => setHovered(code)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: hasShows ? 'pointer' : 'default' }}
            >
              {/* Glow ring on hover */}
              {isHovered && hasShows && (
                <circle
                  cx={x} cy={y} r={r + 5}
                  fill={primaryColor}
                  fillOpacity={0.15}
                />
              )}

              {/* Main bubble */}
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={hasShows ? primaryColor : 'hsl(var(--muted))'}
                fillOpacity={hasShows ? (isHovered ? 1 : 0.82) : 0.5}
                stroke={hasShows ? primaryColor : 'hsl(var(--border))'}
                strokeWidth={hasShows ? 1.5 : 0.8}
                style={{ transition: 'r 0.2s, fill-opacity 0.15s' }}
              />

              {/* State code label */}
              <text
                x={x}
                y={y + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={count > 0 ? (r > 14 ? 7.5 : 6.5) : 6}
                fontWeight={hasShows ? 700 : 400}
                fill={hasShows ? '#fff' : 'hsl(var(--muted-foreground))'}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {code}
              </text>

              {/* Count label below bubble */}
              {hasShows && (
                <text
                  x={x}
                  y={y + r + 7}
                  textAnchor="middle"
                  fontSize={6.5}
                  fontWeight={600}
                  fill={primaryColor}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {count}
                </text>
              )}

              {/* Tooltip */}
              {isHovered && (
                <g>
                  <rect
                    x={x - 52} y={y - r - 26}
                    width={104} height={20}
                    rx={4}
                    fill="hsl(var(--popover))"
                    stroke="hsl(var(--border))"
                    strokeWidth={0.8}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                  />
                  <text
                    x={x} y={y - r - 12}
                    textAnchor="middle"
                    fontSize={8}
                    fontWeight={600}
                    fill="hsl(var(--popover-foreground))"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {name}: {count} show{count !== 1 ? 's' : ''}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />
          Com shows
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-full bg-muted border border-border" />
          Sem shows
        </span>
        <span className="text-muted-foreground/60 italic">Tamanho ∝ nº de shows</span>
      </div>
    </div>
  )
}
