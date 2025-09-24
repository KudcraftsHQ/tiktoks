'use client'

import React, { useState, useRef, useCallback } from 'react'

interface CarouselSlide {
  id: string
  backgroundImageUrl?: string | null
  backgroundImagePositionX: number
  backgroundImagePositionY: number
  backgroundImageZoom: number
  displayOrder: number
}

interface DraggableBackgroundImageProps {
  slide: CarouselSlide
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<CarouselSlide>) => void
  containerWidth: number
  containerHeight: number
}

export function DraggableBackgroundImage({
  slide,
  isSelected,
  onSelect,
  onUpdate,
  containerWidth,
  containerHeight
}: DraggableBackgroundImageProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, posX: 0, posY: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, zoom: 0 })
  const [rotationStart, setRotationStart] = useState({ x: 0, y: 0, rotation: 0 })
  const elementRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    onSelect()
    
    const target = e.target as HTMLElement
    if (target.classList.contains('resize-handle')) {
      // Start resizing (zoom)
      setIsResizing(true)
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        zoom: slide.backgroundImageZoom
      })
    } else if (target.classList.contains('rotate-handle')) {
      // Start rotating
      setIsRotating(true)
      setRotationStart({
        x: e.clientX,
        y: e.clientY,
        rotation: 0 // We don't have rotation in the interface yet, but we can add it
      })
    } else {
      // Start dragging (position)
      setIsDragging(true)
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        posX: slide.backgroundImagePositionX,
        posY: slide.backgroundImagePositionY
      })
    }
  }, [slide, onSelect])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const deltaX = (e.clientX - dragStart.x) / containerWidth
      const deltaY = (e.clientY - dragStart.y) / containerHeight
      
      const newX = Math.max(0, Math.min(1, dragStart.posX + deltaX))
      const newY = Math.max(0, Math.min(1, dragStart.posY + deltaY))
      
      onUpdate({ 
        backgroundImagePositionX: newX,
        backgroundImagePositionY: newY
      })
    } else if (isResizing) {
      const deltaY = dragStart.y - e.clientY // Inverted for intuitive zoom
      const zoomDelta = deltaY / 100 // Adjust sensitivity
      const newZoom = Math.max(0.5, Math.min(3, resizeStart.zoom + zoomDelta))
      
      onUpdate({ backgroundImageZoom: newZoom })
    }
  }, [isDragging, isResizing, dragStart, resizeStart, onUpdate, containerWidth, containerHeight])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
  }, [])

  // Attach global mouse events
  React.useEffect(() => {
    if (isDragging || isResizing || isRotating) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, isRotating, handleMouseMove, handleMouseUp])

  if (!slide.backgroundImageUrl) {
    return null // No image to manipulate
  }

  return (
    <>
      {/* Background Image with Selection Overlay */}
      <div
        ref={elementRef}
        className={`absolute inset-0 cursor-move ${
          isSelected 
            ? 'ring-2 ring-primary ring-inset ring-offset-0' 
            : 'hover:ring-1 hover:ring-gray-300 hover:ring-inset'
        } ${isDragging ? 'opacity-75' : ''}`}
        onMouseDown={handleMouseDown}
        style={{
          zIndex: isSelected ? 10 : 0
        }}
      >
        <img
          src={slide.backgroundImageUrl}
          alt="Background"
          className="w-full h-full object-cover pointer-events-none"
          style={{
            objectPosition: `${slide.backgroundImagePositionX * 100}% ${slide.backgroundImagePositionY * 100}%`,
            transform: `scale(${slide.backgroundImageZoom})`
          }}
        />
        
        {/* Selection overlay when selected */}
        {isSelected && (
          <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
        )}
      </div>

      {/* Control handles */}
      {isSelected && (
        <>
          {/* Corner resize handles */}
          <div
            className="resize-handle absolute w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg -bottom-2 -right-2 cursor-se-resize z-20"
            onMouseDown={handleMouseDown}
            title="Resize (Zoom)"
          />
          <div
            className="resize-handle absolute w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg -top-2 -right-2 cursor-ne-resize z-20"
            onMouseDown={handleMouseDown}
            title="Resize (Zoom)"
          />
          <div
            className="resize-handle absolute w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg -top-2 -left-2 cursor-nw-resize z-20"
            onMouseDown={handleMouseDown}
            title="Resize (Zoom)"
          />
          <div
            className="resize-handle absolute w-4 h-4 bg-primary border-2 border-white rounded-full shadow-lg -bottom-2 -left-2 cursor-sw-resize z-20"
            onMouseDown={handleMouseDown}
            title="Resize (Zoom)"
          />
          
          {/* Center position indicator */}
          <div
            className="absolute w-3 h-3 bg-white border-2 border-primary rounded-full shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
            style={{
              left: `${slide.backgroundImagePositionX * 100}%`,
              top: `${slide.backgroundImagePositionY * 100}%`,
            }}
            title="Image Center"
          />
          
          {/* Info badge */}
          <div className="absolute top-2 left-2 bg-primary text-white text-xs px-2 py-1 rounded shadow-lg pointer-events-none z-20">
            Background Image ({Math.round(slide.backgroundImageZoom * 100)}%)
          </div>
        </>
      )}
    </>
  )
}