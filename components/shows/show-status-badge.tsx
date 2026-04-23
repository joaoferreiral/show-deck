import { Badge } from '@/components/ui/badge'
import { SHOW_STATUS_LABELS, SHOW_STATUS_COLORS } from '@/types'
import type { ShowStatus } from '@/types'

interface ShowStatusBadgeProps {
  status: ShowStatus
}

export function ShowStatusBadge({ status }: ShowStatusBadgeProps) {
  const color = SHOW_STATUS_COLORS[status]
  const label = SHOW_STATUS_LABELS[status]

  return (
    <Badge
      style={{
        backgroundColor: `${color}20`,
        color,
        border: 'none',
      }}
      className="text-xs font-medium"
    >
      {label}
    </Badge>
  )
}
