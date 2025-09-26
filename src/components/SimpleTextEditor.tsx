'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { RemixTextBoxType } from '@/lib/validations/remix-schema'

interface SimpleTextEditorProps {
  textBox: RemixTextBoxType | null
  isEditing: boolean
  onUpdate: (updates: Partial<RemixTextBoxType>) => void
  onClose: () => void
  stageScale: number
  stagePosition: { x: number; y: number }
  stageWidth: number
  stageHeight: number
  containerRect: DOMRect | null
}

export function SimpleTextEditor({
  textBox,
  isEditing,
  onUpdate,
  onClose,
  stageScale,
  stagePosition,
  stageWidth,
  stageHeight,
  containerRect
}: SimpleTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [editingText, setEditingText] = useState(textBox?.text || '')

  // Update text when textBox changes
  useEffect(() => {
    if (textBox) {
      setEditingText(textBox.text)
    }
  }, [textBox])

  // Focus and select text when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  // Handle text submission
  const handleSubmit = useCallback(() => {
    if (textBox && editingText.trim() !== textBox.text) {
      onUpdate({ text: editingText.trim() })
    }
    onClose()
  }, [textBox, editingText, onUpdate, onClose])

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [onClose, handleSubmit])

  if (!textBox || !isEditing) {
    return null
  }

  // Calculate position centered on the text box
  const getEditorPosition = (): React.CSSProperties => {
    if (!containerRect) {
      return { display: 'none' }
    }

    const x = textBox.x * stageWidth
    const y = textBox.y * stageHeight
    const width = Math.max(200, textBox.width * stageWidth)
    const height = Math.max(100, textBox.height * stageHeight)

    // Center the editor in the viewport
    const screenX = containerRect.left + (containerRect.width - width) / 2
    const screenY = containerRect.top + (containerRect.height - height) / 2

    return {
      position: 'fixed' as const,
      left: `${screenX}px`,
      top: `${screenY}px`,
      width: `${width}px`,
      minHeight: `${height}px`,
      fontSize: `${Math.max(14, textBox.fontSize * stageScale)}px`,
      fontFamily: textBox.fontFamily,
      fontWeight: textBox.fontWeight,
      fontStyle: textBox.fontStyle,
      color: textBox.color,
      backgroundColor: 'white',
      border: '2px solid #3b82f6',
      borderRadius: '8px',
      padding: '16px',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
      outline: 'none',
      resize: 'both' as const,
      zIndex: 10000,
      transform: 'translateZ(0)',
      opacity: isEditing ? 1 : 0,
      transition: 'opacity 0.2s ease-in-out'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-9999 flex items-center justify-center">
      <textarea
        ref={textareaRef}
        value={editingText}
        onChange={(e) => setEditingText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        style={getEditorPosition()}
        className="focus:outline-none"
        placeholder="Enter your text..."
        autoFocus
      />
    </div>
  )
}