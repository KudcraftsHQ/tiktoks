'use client'

import React, { useState, useRef, useCallback } from 'react'

interface BackgroundLayer {
  id: string
  type: string
  imageId?: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  fitMode?: 'cover' | 'contain' | 'fill' | 'fit-width' | 'fit-height'
  zIndex: number
  opacity: number
  color?: string
  gradient?: any
  blendMode?: string
}

interface DraggableBackgroundImageProps {
  layer: BackgroundLayer
  imageUrl?: string
  isSelected: boolean
  onSelect: () => void
  onDeselect?: () => void
  anyOtherSelected?: boolean
  onUpdate: (updates: Partial<BackgroundLayer>) => void
  containerWidth: number
  containerHeight: number
}

export function DraggableBackgroundImage({
  layer,
  imageUrl,
  isSelected,
  onSelect,
  onDeselect,
  anyOtherSelected,
  onUpdate,
  containerWidth,
  containerHeight
}: DraggableBackgroundImageProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [resizeDirection, setResizeDirection] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, posX: 0, posY: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [rotationStart, setRotationStart] = useState({ x: 0, y: 0, rotation: 0 })
  const [hasMoved, setHasMoved] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const target = e.target as HTMLElement
    setHasMoved(false)
    
    // If clicking on resize or rotate handles, always select
    if (target.classList.contains('resize-handle')) {
      onSelect()
      setIsResizing(true)
      
      // Determine resize direction from cursor style
      const cursor = target.style.cursor || window.getComputedStyle(target).cursor
      setResizeDirection(cursor)
      
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: layer.width,
        height: layer.height
      })
    } else if (target.classList.contains('rotate-handle')) {
      onSelect()
      setIsRotating(true)
      setRotationStart({
        x: e.clientX,
        y: e.clientY,
        rotation: layer.rotation || 0
      })
    } else {
      // Clicking on the background layer body
      if (anyOtherSelected && onDeselect) {
        // If something else is selected, first deselect it (don't select background yet)
        onDeselect()
      } else if (!isSelected) {
        // If not selected, just select it (don't start dragging yet)
        onSelect()
      } else {
        // If already selected, prepare for dragging
        setIsDragging(true)
        setDragStart({
          x: e.clientX,
          y: e.clientY,
          posX: layer.x,
          posY: layer.y
        })
      }
    }
  }, [layer, isSelected, anyOtherSelected, onSelect, onDeselect])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setHasMoved(true)
      
      // Get the actual rendered container dimensions
      const container = elementRef.current?.parentElement
      if (!container) return
      
      const containerRect = container.getBoundingClientRect()
      const actualWidth = containerRect.width
      const actualHeight = containerRect.height
      
      const deltaX = (e.clientX - dragStart.x) / actualWidth
      const deltaY = (e.clientY - dragStart.y) / actualHeight

      const newX = dragStart.posX + deltaX
      const newY = dragStart.posY + deltaY

      onUpdate({
        x: newX,
        y: newY
      })
    } else if (isResizing) {
      setHasMoved(true)
      
      // Get the actual rendered container dimensions
      const container = elementRef.current?.parentElement
      if (!container) return
      
      const containerRect = container.getBoundingClientRect()
      const actualWidth = containerRect.width
      const actualHeight = containerRect.height
      
      // Proportional scaling based on corner drag distance
      const deltaX = e.clientX - resizeStart.x
      const deltaY = e.clientY - resizeStart.y
      
      // Calculate scale change based on cursor direction
      let scaleDelta = 0
      
      if (resizeDirection === 'nw-resize') {
        // Top-left: invert both deltas
        scaleDelta = -(deltaX + deltaY) / (actualWidth + actualHeight)
      } else if (resizeDirection === 'ne-resize') {
        // Top-right: normal X, inverted Y
        scaleDelta = (deltaX - deltaY) / (actualWidth + actualHeight)
      } else if (resizeDirection === 'sw-resize') {
        // Bottom-left: inverted X, normal Y
        scaleDelta = (-deltaX + deltaY) / (actualWidth + actualHeight)
      } else if (resizeDirection === 'se-resize') {
        // Bottom-right: both normal
        scaleDelta = (deltaX + deltaY) / (actualWidth + actualHeight)
      }
      
      const newScale = Math.max(0.1, Math.min(10, resizeStart.width + scaleDelta))

      // Always maintain aspect ratio - scale both width and height equally
      onUpdate({ width: newScale, height: newScale })
    } else if (isRotating && elementRef.current) {
      setHasMoved(true)
      const rect = elementRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX)
      const startAngle = Math.atan2(rotationStart.y - centerY, rotationStart.x - centerX)
      const deltaAngle = angle - startAngle
      const degrees = (deltaAngle * 180) / Math.PI

      onUpdate({ rotation: (rotationStart.rotation + degrees) % 360 })
    }
  }, [isDragging, isResizing, isRotating, dragStart, resizeStart, rotationStart, resizeDirection, onUpdate, containerWidth, containerHeight])

  const handleMouseUp = useCallback(() => {
    // If it was a click (no movement) on an already selected background, deselect it
    if (!hasMoved && isSelected && onDeselect) {
      onDeselect()
    }
    
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
    setResizeDirection(null)
    setHasMoved(false)
  }, [hasMoved, isSelected, onDeselect])

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

  if (!imageUrl || layer.type !== 'image') {
    return null
  }

  const fitClass = layer.fitMode === 'contain'
    ? 'object-contain'
    : layer.fitMode === 'fill'
      ? 'object-fill'
      : layer.fitMode === 'fit-width'
        ? 'object-cover'
        : 'object-cover'

  const rotation = layer.rotation || 0
  
  // Calculate the bounding box dimensions based on transform
  // When image is scaled, the visual bounds change
  const visualWidth = containerWidth * layer.width
  const visualHeight = containerHeight * layer.height
  const centerX = containerWidth / 2 + (layer.x * containerWidth)
  const centerY = containerHeight / 2 + (layer.y * containerHeight)

  return (
    <>
      {/* Background image container - always behind text (low z-index) */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ${isDragging ? 'opacity-75' : ''}`}
        style={{
          zIndex: layer.zIndex,
          opacity: isSelected ? 0.5 : (layer.opacity ?? 1)
        }}
      >
        <img
          src={imageUrl}
          alt="Background"
          className={`w-full h-full pointer-events-none ${fitClass}`}
          style={{
            transform: `translate(${layer.x * 100}%, ${layer.y * 100}%) rotate(${rotation}deg) scale(${layer.width}, ${layer.height})`,
            transformOrigin: 'center center',
            mixBlendMode: layer.blendMode as any
          }}
        />
      </div>

      {/* Clickable overlay - always present for selection */}
      {/* Use a low z-index to ensure text boxes are always clickable on top */}
      {!isSelected && (
        <div
          className="absolute inset-0 cursor-pointer hover:bg-primary/5 transition-colors"
          style={{
            zIndex: Math.min(layer.zIndex, 50) // Cap at 50 to ensure text boxes (100+) are always on top
          }}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSelect()
          }}
          title="Click to select background"
        />
      )}

      {/* Selection overlay with bounding box and handles - wraps the image bounds */}
      {isSelected && (
        <div
          ref={elementRef}
          className="absolute pointer-events-none"
          style={{
            left: `${centerX}px`,
            top: `${centerY}px`,
            width: `${visualWidth}px`,
            height: `${visualHeight}px`,
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            zIndex: 1000 // High z-index for selection UI only, not the image itself
          }}
        >
          {/* Purple bounding box */}
          <div
            className="absolute inset-0 border-[3px] rounded shadow-lg pointer-events-none"
            style={{
              borderColor: '#a855f7',
              boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.5), 0 0 12px rgba(168, 85, 247, 0.4)'
            }}
          />

          {/* Corner handles for proportional resizing */}
          {/* Top-left corner */}
          <div
            className="resize-handle absolute w-6 h-6 bg-white border-[3px] border-purple-500 rounded-full shadow-lg hover:scale-110 hover:bg-purple-50 transition-all cursor-nw-resize pointer-events-auto"
            style={{
              left: '-12px',
              top: '-12px'
            }}
            onMouseDown={handleMouseDown}
            title="Resize"
          />
          
          {/* Top-right corner */}
          <div
            className="resize-handle absolute w-6 h-6 bg-white border-[3px] border-purple-500 rounded-full shadow-lg hover:scale-110 hover:bg-purple-50 transition-all cursor-ne-resize pointer-events-auto"
            style={{
              right: '-12px',
              top: '-12px'
            }}
            onMouseDown={handleMouseDown}
            title="Resize"
          />
          
          {/* Bottom-left corner */}
          <div
            className="resize-handle absolute w-6 h-6 bg-white border-[3px] border-purple-500 rounded-full shadow-lg hover:scale-110 hover:bg-purple-50 transition-all cursor-sw-resize pointer-events-auto"
            style={{
              left: '-12px',
              bottom: '-12px'
            }}
            onMouseDown={handleMouseDown}
            title="Resize"
          />
          
          {/* Bottom-right corner */}
          <div
            className="resize-handle absolute w-6 h-6 bg-white border-[3px] border-purple-500 rounded-full shadow-lg hover:scale-110 hover:bg-purple-50 transition-all cursor-se-resize pointer-events-auto"
            style={{
              right: '-12px',
              bottom: '-12px'
            }}
            onMouseDown={handleMouseDown}
            title="Resize"
          />

          {/* Rotation handle */}
          <div
            className="rotate-handle absolute w-12 h-12 bg-white border-[3px] border-purple-500 rounded-full shadow-xl hover:scale-110 hover:bg-purple-50 transition-all cursor-grab active:cursor-grabbing flex items-center justify-center pointer-events-auto"
            style={{
              top: '-64px',
              left: '50%',
              transform: 'translateX(-50%)'
            }}
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSelect()
              setIsRotating(true)
              setRotationStart({ x: e.clientX, y: e.clientY, rotation })
            }}
            title="Rotate"
          >
            <svg 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#a855f7" 
              strokeWidth="2.5"
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </div>

          {/* Draggable overlay for moving the background */}
          <div
            className="absolute inset-0 cursor-move pointer-events-auto"
            onMouseDown={handleMouseDown}
          />
        </div>
      )}
    </>
  )
}