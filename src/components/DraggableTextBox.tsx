'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { RemixTextBoxType } from '@/lib/validations/remix-schema'

interface DraggableTextBoxProps {
  textBox: RemixTextBoxType
  isSelected: boolean
  onSelect: () => void
  onDeselect?: () => void
  anyOtherSelected?: boolean
  onUpdate: (updates: Partial<RemixTextBoxType>) => void
  containerWidth: number
  containerHeight: number
}

export function DraggableTextBox({
  textBox,
  isSelected,
  onSelect,
  onDeselect,
  anyOtherSelected,
  onUpdate,
  containerWidth,
  containerHeight
}: DraggableTextBoxProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isRotating, setIsRotating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, posX: 0, posY: 0 })
  const [resizeStart, setResizeStart] = useState({ 
    x: 0, 
    y: 0, 
    width: 0, 
    height: 0, 
    fontSize: 0,
    posX: 0,
    posY: 0
  })
  const [rotationStart, setRotationStart] = useState({ x: 0, y: 0, rotation: 0 })
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 })
  const [hasMoved, setHasMoved] = useState(false)
  const elementRef = useRef<HTMLDivElement>(null)
  const editableRef = useRef<HTMLDivElement>(null)
  const textContentRef = useRef<HTMLSpanElement>(null)

  const [resizeDirection, setResizeDirection] = useState<string | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const target = e.target as HTMLElement
    setHasMoved(false)
    
    // If clicking on resize or rotate handles, don't deselect
    if (target.classList.contains('resize-handle')) {
      onSelect()
      setIsResizing(true)
      
      // Determine resize direction from data attribute
      const direction = target.getAttribute('data-direction')
      setResizeDirection(direction)
      
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: textBox.width,
        height: textBox.height,
        fontSize: textBox.fontSize,
        posX: textBox.x,
        posY: textBox.y
      })
    } else if (target.classList.contains('rotate-handle')) {
      onSelect()
      setIsRotating(true)
      setRotationStart({
        x: e.clientX,
        y: e.clientY,
        rotation: textBox.transform?.rotation || 0
      })
    } else {
      // Clicking on the text box body
      if (anyOtherSelected && onDeselect) {
        // If something else is selected (e.g., background), first deselect it
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
          posX: textBox.x,
          posY: textBox.y
        })
      }
    }
  }, [textBox, isSelected, anyOtherSelected, onSelect, onDeselect, containerWidth, containerHeight])

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

      const clampedX = Math.max(-1, Math.min(2, newX))
      const clampedY = Math.max(-1, Math.min(2, newY))

      onUpdate({ x: clampedX, y: clampedY })
    } else if (isResizing) {
      setHasMoved(true)
      
      // Get the actual rendered container dimensions
      const container = elementRef.current?.parentElement
      if (!container) return
      
      const containerRect = container.getBoundingClientRect()
      const actualWidth = containerRect.width
      
      const deltaX = e.clientX - resizeStart.x
      const deltaY = e.clientY - resizeStart.y

      // Calculate scale based on diagonal movement
      let scaleFactor = 1
      let newX = resizeStart.posX
      let newY = resizeStart.posY

      if (resizeDirection === 'se') {
        // Bottom-right: anchor at top-left
        const diagonalDelta = (deltaX + deltaY) / 2
        scaleFactor = 1 + diagonalDelta / (actualWidth * resizeStart.width)
      } else if (resizeDirection === 'sw') {
        // Bottom-left: anchor at top-right
        const diagonalDelta = (-deltaX + deltaY) / 2
        scaleFactor = 1 + diagonalDelta / (actualWidth * resizeStart.width)
        // Adjust x position to keep top-right corner fixed
        const widthChange = (scaleFactor - 1) * resizeStart.width
        newX = resizeStart.posX - widthChange
      } else if (resizeDirection === 'ne') {
        // Top-right: anchor at bottom-left
        const diagonalDelta = (deltaX - deltaY) / 2
        scaleFactor = 1 + diagonalDelta / (actualWidth * resizeStart.width)
        // Adjust y position to keep bottom-left corner fixed
        const widthChange = (scaleFactor - 1) * resizeStart.width
        newY = resizeStart.posY - widthChange * (resizeStart.height / resizeStart.width)
      } else if (resizeDirection === 'nw') {
        // Top-left: anchor at bottom-right
        const diagonalDelta = (-deltaX - deltaY) / 2
        scaleFactor = 1 + diagonalDelta / (actualWidth * resizeStart.width)
        // Adjust both x and y positions to keep bottom-right corner fixed
        const widthChange = (scaleFactor - 1) * resizeStart.width
        newX = resizeStart.posX - widthChange
        newY = resizeStart.posY - widthChange * (resizeStart.height / resizeStart.width)
      }

      // Constrain scale factor
      scaleFactor = Math.max(0.2, Math.min(5, scaleFactor))

      const newWidth = Math.max(0.05, Math.min(2, resizeStart.width * scaleFactor))
      const newFontSize = Math.max(8, Math.min(200, resizeStart.fontSize * scaleFactor))

      onUpdate({
        width: newWidth,
        fontSize: newFontSize,
        x: newX,
        y: newY
      })
    } else if (isRotating && elementRef.current) {
      setHasMoved(true)
      const rect = elementRef.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX)
      const startAngle = Math.atan2(rotationStart.y - centerY, rotationStart.x - centerX)
      const deltaAngle = angle - startAngle
      const degrees = (deltaAngle * 180) / Math.PI

      onUpdate({
        transform: {
          rotation: (rotationStart.rotation + degrees) % 360,
          scaleX: textBox.transform?.scaleX || 1,
          scaleY: textBox.transform?.scaleY || 1,
          skewX: textBox.transform?.skewX || 0,
          skewY: textBox.transform?.skewY || 0
        }
      })
    }
  }, [isDragging, isResizing, isRotating, dragStart, resizeStart, rotationStart, resizeDirection, textBox.transform, onUpdate, containerWidth, containerHeight])

  const handleMouseUp = useCallback(() => {
    // If it was a click (no movement) on an already selected text box, deselect it
    if (!hasMoved && isSelected && onDeselect) {
      onDeselect()
    }
    
    setIsDragging(false)
    setIsResizing(false)
    setIsRotating(false)
    setResizeDirection(null)
    setHasMoved(false)
  }, [hasMoved, isSelected, onDeselect])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging && !isResizing && !isRotating) {
      // Store click coordinates to position cursor later
      const clickX = e.clientX
      const clickY = e.clientY
      
      setIsEditing(true)
      setTimeout(() => {
        if (editableRef.current) {
          editableRef.current.focus()
          
          // Position cursor at click location using coordinates
          try {
            let range: Range | null = null
            
            // Use caretRangeFromPoint (Chrome/Safari) or caretPositionFromPoint (Firefox)
            if (document.caretRangeFromPoint) {
              range = document.caretRangeFromPoint(clickX, clickY)
            } else if ((document as any).caretPositionFromPoint) {
              const caretPosition = (document as any).caretPositionFromPoint(clickX, clickY)
              if (caretPosition) {
                range = document.createRange()
                range.setStart(caretPosition.offsetNode, caretPosition.offset)
                range.collapse(true)
              }
            }
            
            if (range) {
              const selection = window.getSelection()
              selection?.removeAllRanges()
              selection?.addRange(range)
            }
          } catch (err) {
            console.warn('Could not position cursor at click location:', err)
          }
        }
      }, 0)
    }
  }, [isDragging, isResizing, isRotating])

  const handleTextChange = useCallback(() => {
    if (editableRef.current) {
      const newText = editableRef.current.textContent || ''
      if (newText !== textBox.text) {
        onUpdate({ text: newText })
      }
    }
  }, [textBox.text, onUpdate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false)
      if (editableRef.current) {
        editableRef.current.textContent = textBox.text
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      setIsEditing(false)
      handleTextChange()
    }
  }, [textBox.text, handleTextChange])

  const handleBlur = useCallback(() => {
    setIsEditing(false)
    handleTextChange()
  }, [handleTextChange])

  const calculateContentSize = useCallback(() => {
    if (textContentRef.current) {
      const rect = textContentRef.current.getBoundingClientRect()
      setContentSize({
        width: rect.width,
        height: rect.height
      })
    }
  }, [textBox.text, textBox.fontSize, textBox.fontFamily, textBox.fontWeight, textBox.fontStyle, textBox.textWrap])

  useEffect(() => {
    calculateContentSize()
  }, [textBox.text, textBox.fontSize, textBox.fontFamily, textBox.fontWeight, textBox.fontStyle, textBox.textWrap, calculateContentSize])

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

  const useMinimalSizing = !isSelected && !textBox.backgroundColor
  const rotation = textBox.transform?.rotation || 0

  return (
    <div
      ref={elementRef}
      className={`absolute cursor-move select-none ${isDragging ? 'opacity-75' : ''}`}
      style={{
        left: `${textBox.x * 100}%`,
        top: `${textBox.y * 100}%`,
        width: `${textBox.width * 100}%`,
        height: 'auto',
        minHeight: useMinimalSizing ? 'auto' : undefined,
        transform: `rotate(${rotation}deg)`,
        zIndex: textBox.zIndex || 10
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      {/* Selection indicator - positioned absolutely to not affect layout */}
      {isSelected && (
        <div
          className="absolute pointer-events-none border-[3px] rounded shadow-lg"
          style={{
            top: '-3px',
            left: '-3px',
            right: '-3px',
            bottom: '-3px',
            borderColor: '#a855f7',
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.5), 0 0 12px rgba(168, 85, 247, 0.4)'
          }}
        />
      )}
      {/* Wrapper for text alignment - needs block display */}
      <div
        style={{
          width: '100%',
          textAlign: textBox.textAlign as any,
        }}
      >
        <div
          style={{
            display: textBox.textWrap === 'wrap' ? 'inline' : 'inline-block',
            fontSize: `${textBox.fontSize}px`,
            fontFamily: textBox.fontFamily,
            fontWeight: textBox.fontWeight,
            fontStyle: textBox.fontStyle,
            textDecoration: textBox.textDecoration,
            color: textBox.color,
            lineHeight: textBox.lineHeight || 1.2,
            letterSpacing: textBox.letterSpacing ? `${textBox.letterSpacing}px` : undefined,
            wordSpacing: (textBox as any).wordSpacing ? `${(textBox as any).wordSpacing}px` : undefined,
            whiteSpace: textBox.textWrap === 'wrap' ? 'pre-wrap' : 'nowrap',
            overflow: textBox.textWrap === 'ellipsis' ? 'hidden' : 'visible',
            textOverflow: textBox.textWrap === 'ellipsis' ? 'ellipsis' : 'clip',
            maxWidth: textBox.textWrap === 'wrap' ? `${textBox.width * 100}%` : 'none',
            WebkitTextStroke: textBox.outlineWidth && textBox.outlineWidth > 0
              ? `${textBox.outlineWidth}px ${textBox.outlineColor}`
              : undefined,
            textShadow: textBox.enableShadow
              ? `${textBox.shadowOffsetX}px ${textBox.shadowOffsetY}px ${textBox.shadowBlur}px ${textBox.shadowColor}`
              : textBox.textShadow,
            backgroundColor: textBox.backgroundColor ?
              `rgba(${parseInt(textBox.backgroundColor.slice(1, 3), 16)}, ${parseInt(textBox.backgroundColor.slice(3, 5), 16)}, ${parseInt(textBox.backgroundColor.slice(5, 7), 16)}, ${textBox.backgroundOpacity || 1})` :
              undefined,
            borderRadius: textBox.borderRadius ? `${textBox.borderRadius}px` : undefined,
            paddingTop: `${textBox.paddingTop}px`,
            paddingRight: `${textBox.paddingRight}px`,
            paddingBottom: `${textBox.paddingBottom}px`,
            paddingLeft: `${textBox.paddingLeft}px`,
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
          } as React.CSSProperties}
        >
        <span ref={textContentRef} style={{ display: 'inline' }}>
          {isEditing ? (
            <div
              ref={editableRef}
              contentEditable
              suppressContentEditableWarning
              className="outline-none"
              style={{
                display: 'inline',
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              dangerouslySetInnerHTML={{ __html: textBox.text }}
            />
          ) : (
            textBox.text
          )}
        </span>
        </div>
      </div>

      {isSelected && (
        <>
          {/* Corner resize handles for proportional scaling */}
          {/* Top-left */}
          <div
            className="resize-handle absolute w-6 h-6 bg-white border-[3px] border-purple-500 rounded-full shadow-lg hover:scale-110 hover:bg-purple-50 transition-all -top-3 -left-3 cursor-nw-resize z-10"
            data-direction="nw"
            onMouseDown={handleMouseDown}
          />
          {/* Top-right */}
          <div
            className="resize-handle absolute w-6 h-6 bg-white border-[3px] border-purple-500 rounded-full shadow-lg hover:scale-110 hover:bg-purple-50 transition-all -top-3 -right-3 cursor-ne-resize z-10"
            data-direction="ne"
            onMouseDown={handleMouseDown}
          />
          {/* Bottom-left */}
          <div
            className="resize-handle absolute w-6 h-6 bg-white border-[3px] border-purple-500 rounded-full shadow-lg hover:scale-110 hover:bg-purple-50 transition-all -bottom-3 -left-3 cursor-sw-resize z-10"
            data-direction="sw"
            onMouseDown={handleMouseDown}
          />
          {/* Bottom-right */}
          <div
            className="resize-handle absolute w-6 h-6 bg-white border-[3px] border-purple-500 rounded-full shadow-lg hover:scale-110 hover:bg-purple-50 transition-all -bottom-3 -right-3 cursor-se-resize z-10"
            data-direction="se"
            onMouseDown={handleMouseDown}
          />

          {/* Rotation handle */}
          <div
            className="rotate-handle absolute w-12 h-12 bg-white border-[3px] border-purple-500 rounded-full shadow-xl hover:scale-110 hover:bg-purple-50 transition-all -top-20 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing flex items-center justify-center z-10"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onSelect()
              setIsRotating(true)
              setRotationStart({ x: e.clientX, y: e.clientY, rotation })
            }}
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
        </>
      )}
    </div>
  )
}