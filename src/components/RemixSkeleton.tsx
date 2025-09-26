import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function RemixSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <div className="h-7 w-7 bg-muted rounded"></div>
            <div className="h-7 w-7 bg-muted rounded"></div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Slide previews skeleton */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-[9/16] bg-muted rounded"></div>
              <div className="h-2 bg-muted rounded"></div>
              <div className="h-2 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="h-3 bg-muted rounded w-16"></div>
          <div className="h-5 w-16 bg-muted rounded"></div>
        </div>

        <div className="h-3 bg-muted rounded w-24"></div>

        <div className="flex gap-2">
          <div className="h-8 bg-muted rounded flex-1"></div>
          <div className="h-8 w-8 bg-muted rounded"></div>
        </div>
      </CardContent>
    </Card>
  )
}