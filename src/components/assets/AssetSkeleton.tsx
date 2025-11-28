import { Skeleton } from '@/components/ui/skeleton'

export function AssetGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative aspect-[3/4] border rounded-lg overflow-hidden">
          <Skeleton className="w-full h-full" />
        </div>
      ))}
    </>
  )
}

export function FolderSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative aspect-[3/4] border-2 rounded-lg p-4">
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <Skeleton className="h-12 w-12 rounded" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </>
  )
}
