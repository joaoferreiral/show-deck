import { Skeleton } from '@/components/ui/skeleton'

export default function CalendarioLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-4 w-40 ml-2" />
        <div className="ml-auto flex gap-1">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
      {/* Month grid skeleton */}
      <div className="flex-1 p-4 grid grid-cols-7 gap-px bg-border">
        {Array.from({ length: 42 }).map((_, i) => (
          <Skeleton key={i} className="min-h-[80px] rounded-none bg-background" />
        ))}
      </div>
    </div>
  )
}
