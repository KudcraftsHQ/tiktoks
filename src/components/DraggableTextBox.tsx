'use client'

import React, { useState, useRef, useCallback } from 'react'

interface CarouselTextBox {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textDecoration: string
  color: string
  textAlign: string
  zIndex: number
  textStroke?: string
  textShadow?: string
  borderWidth?: number
  borderColor?: string
}

interface DraggableTextBoxProps {
  textBox: CarouselTextBox
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<CarouselTextBox>) => void
  containerWidth: number
  containerHeight: number
}

export function DraggableTextBox({
  textBox,
  isSelected,
  onSelect,
  onUpdate,
  containerWidth,
  containerHeight
}: DraggableTextBoxProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const elementRef = useRef<HTMLDivElement>(null)
  const editableRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    onSelect()
    
    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      // Start resizing
      setIsResizing(true)
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: textBox.width,
        height: textBox.height
      })
    } else {
      // Start dragging
      setIsDragging(true)
      setDragStart({
        x: e.clientX - textBox.x * containerWidth,
        y: e.clientY - textBox.y * containerHeight
      })
    }
  }, [textBox, onSelect, containerWidth, containerHeight])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = (e.clientX - dragStart.x) / containerWidth
      const newY = (e.clientY - dragStart.y) / containerHeight
      
      // Allow text box to extend outside the canvas area
      // Clamp to allow some overflow but prevent complete loss of control
      const clampedX = Math.max(-0.5, Math.min(1.2, newX))
      const clampedY = Math.max(-0.5, Math.min(1.2, newY))
      
      onUpdate({ x: clampedX, y: clampedY })
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x
      const deltaY = e.clientY - resizeStart.y
      
      const newWidth = Math.max(0.05, Math.min(1.5, resizeStart.width + deltaX / containerWidth))
      const newHeight = Math.max(0.02, Math.min(1.5, resizeStart.height + deltaY / containerHeight))
      
      onUpdate({ width: newWidth, height: newHeight })
    }
  }, [isDragging, isResizing, dragStart, resizeStart, textBox, onUpdate, containerWidth, containerHeight])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging && !isResizing) {
      setIsEditing(true)
      setTimeout(() => {
        if (editableRef.current) {
          editableRef.current.focus()
          // Select all text
          const range = document.createRange()
          range.selectNodeContents(editableRef.current)
          const sel = window.getSelection()
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }, 0)
    }
  }, [isDragging, isResizing])

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

  // Attach global mouse events for dragging/resizing
  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  return (
    <div
      ref={elementRef}
      className={`absolute cursor-move select-none ${
        isSelected 
          ? 'ring-2 ring-primary ring-offset-1' 
          : 'hover:ring-1 hover:ring-gray-300'
      } ${isDragging ? 'opacity-75' : ''}`}
      style={{
        left: `${textBox.x * 100}%`,
        top: `${textBox.y * 100}%`,
        width: `${textBox.width * 100}%`,
        height: `${textBox.height * 100}%`,
        zIndex: textBox.zIndex + (isSelected ? 1000 : 0)
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`w-full h-full flex items-center justify-center p-2 ${isEditing ? 'bg-white/20 backdrop-blur-sm rounded' : ''}`}
        style={{
          fontSize: textBox.fontSize,
          fontFamily: textBox.fontFamily,
          fontWeight: textBox.fontWeight,
          fontStyle: textBox.fontStyle,
          textDecoration: textBox.textDecoration,
          color: textBox.color,
          textAlign: textBox.textAlign as any,
          lineHeight: '1.2',
          WebkitTextStroke: textBox.borderWidth && textBox.borderWidth > 0 
            ? `${textBox.borderWidth}px ${textBox.borderColor}` 
            : undefined,
          textShadow: textBox.textShadow,
        }}
      >
        {isEditing ? (
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            className="w-full h-full flex items-center justify-center outline-none resize-none border-2 border-primary/50 rounded bg-white/90 p-1"
            style={{
              fontSize: textBox.fontSize,
              fontFamily: textBox.fontFamily,
              fontWeight: textBox.fontWeight,
              fontStyle: textBox.fontStyle,
              textDecoration: textBox.textDecoration,
              color: textBox.color,
              textAlign: textBox.textAlign as any,
              lineHeight: '1.2',
              WebkitTextStroke: textBox.borderWidth && textBox.borderWidth > 0 
                ? `${textBox.borderWidth}px ${textBox.borderColor}` 
                : undefined,
              textShadow: textBox.textShadow,
            }}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            dangerouslySetInnerHTML={{ __html: textBox.text }}
          />
        ) : (
          textBox.text
        )}
      </div>

      {/* Resize handles */}
      {isSelected && (
        <>
          {/* Corner handles */}
          <div
            className="resize-handle absolute w-3 h-3 bg-primary border border-white rounded-full -bottom-1.5 -right-1.5 cursor-se-resize"
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-3 bg-primary border border-white rounded-full -top-1.5 -right-1.5 cursor-ne-resize"
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-3 bg-primary border border-white rounded-full -top-1.5 -left-1.5 cursor-nw-resize"
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-3 bg-primary border border-white rounded-full -bottom-1.5 -left-1.5 cursor-sw-resize"
            onMouseDown={handleMouseDown}
          />
          
          {/* Edge handles */}
          <div
            className="resize-handle absolute w-3 h-1 bg-primary border border-white rounded-full -top-0.5 left-1/2 -translate-x-1/2 cursor-n-resize"
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-1 h-3 bg-primary border border-white rounded-full -right-0.5 top-1/2 -translate-y-1/2 cursor-e-resize"
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-3 h-1 bg-primary border border-white rounded-full -bottom-0.5 left-1/2 -translate-x-1/2 cursor-s-resize"
            onMouseDown={handleMouseDown}
          />
          <div
            className="resize-handle absolute w-1 h-3 bg-primary border border-white rounded-full -left-0.5 top-1/2 -translate-y-1/2 cursor-w-resize"
            onMouseDown={handleMouseDown}
          />
        </>
      )}
    </div>
  )
}