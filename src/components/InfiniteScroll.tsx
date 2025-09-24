'use client'

import { useEffect, useState, useCallback } from 'react'

interface InfiniteScrollProps {
  children: React.ReactNode
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  threshold?: number
}

export default function InfiniteScroll({ 
  children, 
  hasMore, 
  isLoading, 
  onLoadMore, 
  threshold = 100 
}: InfiniteScrollProps) {
  const [observer, setObserver] = useState<IntersectionObserver | null>(null)

  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isLoading) return

    if (observer) observer.disconnect()

    const newObserver = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        onLoadMore()
      }
    }, {
      rootMargin: `${threshold}px`
    })

    if (node) newObserver.observe(node)
    setObserver(newObserver)
  }, [isLoading, hasMore, onLoadMore, threshold])

  useEffect(() => {
    return () => {
      if (observer) observer.disconnect()
    }
  }, [observer])

  return (
    <div className="space-y-4">
      {children}
      {hasMore && (
        <div ref={lastElementRef} className="flex justify-center py-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span>Loading more...</span>
            </div>
          )}
        </div>
      )}
      {!hasMore && !isLoading && (
        <div className="text-center py-4 text-muted-foreground">
          No more carousels to load
        </div>
      )}
    </div>
  )
}