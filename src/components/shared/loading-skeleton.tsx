import { Skeleton } from "@/components/ui/skeleton"

export function TableSkeleton({ rowCount = 5 }: { rowCount?: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-[250px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
      <div className="rounded-md border">
        <div className="flex items-center space-x-4 p-4 border-b bg-slate-50 dark:bg-slate-900">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border-b last:border-0">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-8 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
      </div>
      <Skeleton className="h-[125px] w-full rounded-xl" />
    </div>
  )
}

export function ChatSkeleton({ messageCount = 4 }: { messageCount?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: messageCount }).map((_, i) => (
        <div key={i} className={`flex items-start gap-4 ${i % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className={`space-y-2 ${i % 2 === 0 ? '' : 'flex flex-col items-end'}`}>
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className={`h-16 rounded-2xl ${i % 2 === 0 ? 'w-[250px] rounded-tl-sm' : 'w-[200px] rounded-tr-sm'}`} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function GallerySkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  )
}

export function MapSkeleton() {
  return (
    <div className="w-full h-[500px] bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden relative">
      <Skeleton className="w-full h-full" />
      <div className="absolute top-4 left-4 space-y-2">
        <Skeleton className="h-10 w-10 rounded-md shadow-md" />
        <Skeleton className="h-10 w-10 rounded-md shadow-md" />
      </div>
    </div>
  )
}
