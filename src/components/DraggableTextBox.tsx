'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { RemixTextBoxType } from '@/lib/validations/remix-schema'

interface DraggableTextBoxProps {
  textBox: RemixTextBoxType
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<RemixTextBoxType>) => void
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
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 })
  const elementRef = useRef<HTMLDivElement>(null)
  const editableRef = useRef<HTMLDivElement>(null)
  const textContentRef = useRef<HTMLSpanElement>(null)

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

  // Calculate content size for minimal text box behavior
  const calculateContentSize = useCallback(() => {
    if (textContentRef.current) {
      const rect = textContentRef.current.getBoundingClientRect()
      setContentSize({
        width: rect.width,
        height: rect.height
      })
    }
  }, [textBox.text, textBox.fontSize, textBox.fontFamily, textBox.fontWeight, textBox.fontStyle, textBox.textWrap])

  // Update content size when text or styling changes
  useEffect(() => {
    calculateContentSize()
  }, [textBox.text, textBox.fontSize, textBox.fontFamily, textBox.fontWeight, textBox.fontStyle, textBox.textWrap, calculateContentSize])

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

  // Calculate if we should use minimal sizing (when not selected and no background)
  const useMinimalSizing = !isSelected && !textBox.backgroundColor

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
        width: useMinimalSizing ? 'auto' : `${textBox.width * 100}%`,
        height: useMinimalSizing ? 'auto' : `${textBox.height * 100}%`,
        zIndex: Math.max(textBox.zIndex + 10, 20) + (isSelected ? 1000 : 0)
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`inline-flex ${isEditing ? 'bg-white/20 backdrop-blur-sm' : ''} ${textBox.textWrap === 'wrap' ? '' : 'whitespace-nowrap'}`}
        style={{
          fontSize: `${textBox.fontSize}px`,
          fontFamily: textBox.fontFamily,
          fontWeight: textBox.fontWeight,
          fontStyle: textBox.fontStyle,
          textDecoration: textBox.textDecoration,
          color: textBox.color,
          textAlign: textBox.textAlign as any,
          lineHeight: textBox.lineHeight || 1.2,
          letterSpacing: textBox.letterSpacing ? `${textBox.letterSpacing}px` : undefined,
          whiteSpace: textBox.textWrap === 'wrap' ? 'normal' : 'nowrap',
          overflow: textBox.textWrap === 'ellipsis' ? 'hidden' : 'visible',
          textOverflow: textBox.textWrap === 'ellipsis' ? 'ellipsis' : 'clip',
          WebkitTextStroke: textBox.outlineWidth && textBox.outlineWidth > 0
            ? `${textBox.outlineWidth}px ${textBox.outlineColor}`
            : undefined,
          textStroke: textBox.outlineWidth && textBox.outlineWidth > 0
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
          maxWidth: useMinimalSizing ? 'none' : undefined,
        }}
      >
        <span
          ref={textContentRef}
          style={{
            display: 'inline-block',
            maxWidth: textBox.textWrap === 'wrap' ? '100%' : 'none'
          }}
        >
          {isEditing ? (
            <div
              ref={editableRef}
              contentEditable
              suppressContentEditableWarning
              className="outline-none resize-none border-2 border-primary/50"
              style={{
                fontSize: `${textBox.fontSize}px`,
                fontFamily: textBox.fontFamily,
                fontWeight: textBox.fontWeight,
                fontStyle: textBox.fontStyle,
                textDecoration: textBox.textDecoration,
                color: textBox.color,
                textAlign: textBox.textAlign as any,
                lineHeight: textBox.lineHeight || 1.2,
                letterSpacing: textBox.letterSpacing ? `${textBox.letterSpacing}px` : undefined,
                whiteSpace: textBox.textWrap === 'wrap' ? 'normal' : 'nowrap',
                WebkitTextStroke: textBox.outlineWidth && textBox.outlineWidth > 0
                  ? `${textBox.outlineWidth}px ${textBox.outlineColor}`
                  : undefined,
                textShadow: textBox.enableShadow
                  ? `${textBox.shadowOffsetX}px ${textBox.shadowOffsetY}px ${textBox.shadowBlur}px ${textBox.shadowColor}`
                  : textBox.textShadow,
                backgroundColor: textBox.backgroundColor ?
                  `rgba(${parseInt(textBox.backgroundColor.slice(1, 3), 16)}, ${parseInt(textBox.backgroundColor.slice(3, 5), 16)}, ${parseInt(textBox.backgroundColor.slice(5, 7), 16)}, ${Math.max(0.9, textBox.backgroundOpacity || 1)})` :
                  'rgba(255, 255, 255, 0.9)',
                borderRadius: textBox.borderRadius ? `${textBox.borderRadius}px` : '4px',
                paddingTop: `${textBox.paddingTop}px`,
                paddingRight: `${textBox.paddingRight}px`,
                paddingBottom: `${textBox.paddingBottom}px`,
                paddingLeft: `${textBox.paddingLeft}px`,
              }}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              dangerouslySetInnerHTML={{ __html: textBox.text }}
            />
          ) : (
            <span style={{
              WebkitTextStroke: textBox.outlineWidth && textBox.outlineWidth > 0
                ? `${textBox.outlineWidth}px ${textBox.outlineColor}`
                : undefined,
              textShadow: textBox.enableShadow
                ? `${textBox.shadowOffsetX}px ${textBox.shadowOffsetY}px ${textBox.shadowBlur}px ${textBox.shadowColor}`
                : textBox.textShadow,
            }}>
              {textBox.text}
            </span>
          )}
        </span>
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