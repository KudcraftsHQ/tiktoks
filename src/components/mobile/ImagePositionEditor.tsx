'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, Check } from 'lucide-react'

interface ImagePositionEditorProps {
  imageUrl: string
  currentOffsetY: number
  onSave: (offsetY: number) => void
  onCancel: () => void
}

export function ImagePositionEditor({
  imageUrl,
  currentOffsetY,
  onSave,
  onCancel,
}: ImagePositionEditorProps) {
  const [offsetY, setOffsetY] = useState(currentOffsetY)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef({ y: 0, initialOffsetY: 0 })

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    const touch = e.touches[0]
    dragStartRef.current = {
      y: touch.clientY,
      initialOffsetY: offsetY,
    }
  }

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return

    e.preventDefault()
    const touch = e.touches[0]
    const deltaY = touch.clientY - dragStartRef.current.y
    const containerHeight = containerRef.current.offsetHeight

    // Convert pixel delta to normalized offset
    // Positive deltaY = drag down = increase offsetY (show lower part of image)
    const offsetDelta = deltaY / containerHeight
    const newOffsetY = dragStartRef.current.initialOffsetY + offsetDelta

    // Clamp to [0, 1]
    setOffsetY(Math.max(0, Math.min(1, newOffsetY)))
  }

  // Handle touch end
  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Handle mouse events for desktop testing
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    dragStartRef.current = {
      y: e.clientY,
      initialOffsetY: offsetY,
    }
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      const deltaY = e.clientY - dragStartRef.current.y
      const containerHeight = containerRef.current.offsetHeight
      const offsetDelta = deltaY / containerHeight
      const newOffsetY = dragStartRef.current.initialOffsetY + offsetDelta

      setOffsetY(Math.max(0, Math.min(1, newOffsetY)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Calculate object position for the image
  const getObjectPosition = () => {
    const yPercent = offsetY * 100
    return `50% ${yPercent}%`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
      style={{
        touchAction: 'none',
      }}
    >
      {/* Header */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between border-b border-white/10 bg-black/50 p-4">
        <h2 className="text-lg font-semibold text-white">Adjust Position</h2>
        <Button
          onClick={onCancel}
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Image Preview Container */}
      <div className="flex flex-1 items-center justify-center p-4 pt-20 pb-32">
        <div
          ref={containerRef}
          className="relative w-full max-w-md overflow-hidden rounded-lg border-2 border-white/20 shadow-2xl"
          style={{
            aspectRatio: '3/4',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          {/* Image */}
          <img
            src={imageUrl}
            alt="Position preview"
            className="h-full w-full object-cover"
            style={{
              objectPosition: getObjectPosition(),
            }}
            draggable={false}
          />

          {/* Crop boundary guides */}
          <div className="pointer-events-none absolute inset-0">
            {/* Top guide */}
            <div className="absolute left-0 right-0 top-0 border-t-2 border-dashed border-white/30" />
            {/* Center guide */}
            <div className="absolute left-0 right-0 top-1/2 border-t-2 border-dashed border-white/50" />
            {/* Bottom guide */}
            <div className="absolute bottom-0 left-0 right-0 border-t-2 border-dashed border-white/30" />
          </div>

          {/* Drag indicator */}
          {!isDragging && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="rounded-lg bg-black/70 px-4 py-2 text-sm text-white shadow-lg">
                Drag to reposition
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer with buttons */}
      <div
        className="absolute bottom-0 left-0 right-0 flex gap-2 border-t border-white/10 bg-black/50 p-4"
        style={{
          paddingBottom: `calc(1rem + var(--safe-area-inset-bottom))`,
        }}
      >
        <Button
          onClick={onCancel}
          variant="outline"
          size="lg"
          className="flex-1 border-white/20 bg-transparent text-white hover:bg-white/10"
        >
          Cancel
        </Button>
        <Button
          onClick={() => onSave(offsetY)}
          size="lg"
          className="flex-1"
        >
          <Check className="mr-2 h-5 w-5" />
          Save Position
        </Button>
      </div>

      {/* Position indicator */}
      <div className="absolute right-4 top-24 rounded-lg bg-black/70 px-3 py-2 text-xs text-white shadow-lg">
        <div className="mb-1 text-white/60">Vertical Position</div>
        <div className="font-mono text-lg">{Math.round(offsetY * 100)}%</div>
      </div>
    </div>
  )
}
