'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Text, Transformer, Rect, Circle } from 'react-konva'
import type { RemixTextBoxType } from '@/lib/validations/remix-schema'


interface KonvaTextProps {
  textBox: RemixTextBoxType
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<RemixTextBoxType>) => void
  isEditing: boolean
  onEditingChange: (editing: boolean) => void
}

export function KonvaText({
  textBox,
  isSelected,
  onSelect,
  onUpdate,
  isEditing,
  onEditingChange
}: KonvaTextProps) {
  const textRef = useRef<any>(null)
  const transformerRef = useRef<any>(null)
  const [isWidthDragging, setIsWidthDragging] = useState(false)

  
  // Update transformer when selection changes
  useEffect(() => {
    if (isSelected && transformerRef.current && textRef.current) {
      transformerRef.current.nodes([textRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected, textBox])

  // Handle text editing start
  const handleDoubleClick = useCallback(() => {
    onEditingChange(true)
  }, [onEditingChange])

  // Handle text style changes - update width and proportionally adjust font size
  const handleTransform = useCallback(() => {
    if (textRef.current) {
      const node = textRef.current
      const scaleX = node.scaleX()

      // Calculate new width and proportionally adjust font size
      const newWidth = textBox.width * scaleX
      const newFontSize = textBox.fontSize * scaleX

      // Update both width and font size proportionally
      onUpdate({
        width: newWidth,
        fontSize: newFontSize
      })

      // Reset scale to 1 since we're using explicit width/height
      node.scaleX(1)
      node.scaleY(1)
    }
  }, [textBox.width, textBox.fontSize, onUpdate])

  // Handle drag end
  const handleDragEnd = useCallback((e: any) => {
    const node = e.target
    onUpdate({
      x: node.x() / (node.getStage()?.width() || 1080),
      y: node.y() / (node.getStage()?.height() || 1920)
    })
  }, [onUpdate])

  // Handle width resize drag
  const handleWidthDragMove = useCallback((e: any) => {
    if (!textRef.current) return

    const node = textRef.current
    const stage = node.getStage()
    const pointerPos = stage.getPointerPosition()

    // Calculate new width based on mouse position
    const textX = node.x()
    const newWidth = Math.max(50, pointerPos.x - textX)

    // Calculate scale factor and proportionally adjust font size
    const currentWidth = textBox.width * 1080
    const scaleFactor = newWidth / currentWidth
    const newFontSize = Math.max(8, textBox.fontSize * scaleFactor)

    // Update both width and font size
    const normalizedWidth = newWidth / 1080
    onUpdate({
      width: normalizedWidth,
      fontSize: newFontSize
    })
  }, [textBox.width, textBox.fontSize, onUpdate])

  const handleWidthDragEnd = useCallback(() => {
    setIsWidthDragging(false)
  }, [])

  // Calculate canvas dimensions
  const stageWidth = 1080 // Default width
  const stageHeight = 1920 // Default height

  const x = textBox.x * stageWidth
  const y = textBox.y * stageHeight
  const width = textBox.width * stageWidth
  const height = textBox.height * stageHeight

  return (
    <>
      <Text
        ref={textRef}
        x={x}
        y={y}
        width={width}
        height={height}
        text={textBox.text}
        fontSize={textBox.fontSize}
        fontFamily={textBox.fontFamily}
        fontStyle={textBox.fontStyle}
        fontWeight={textBox.fontWeight}
        textDecoration={textBox.textDecoration}
        fill={textBox.color}
        align={textBox.textAlign as any}
        verticalAlign={textBox.textAlign === 'center' ? 'middle' : 'top'}
        lineHeight={textBox.lineHeight || 1.2}
        letterSpacing={textBox.letterSpacing}
        wrap={textBox.textWrap === 'wrap' ? 'word' : 'none'}
        ellipsis={textBox.textWrap === 'ellipsis'}
        padding={textBox.paddingLeft || textBox.paddingTop || 0}

        // Text effects
        stroke={textBox.outlineWidth && textBox.outlineWidth > 0 ? textBox.outlineColor : undefined}
        strokeWidth={textBox.outlineWidth || 0}
        shadowColor={textBox.enableShadow ? textBox.shadowColor : undefined}
        shadowBlur={textBox.enableShadow ? textBox.shadowBlur : 0}
        shadowOffsetX={textBox.enableShadow ? textBox.shadowOffsetX : 0}
        shadowOffsetY={textBox.enableShadow ? textBox.shadowOffsetY : 0}
        shadowOpacity={textBox.enableShadow ? 1 : 0}

        // Background
        fillAfterStrokeEnabled={true}

        draggable={isSelected}
        onClick={onSelect}
        onDoubleClick={handleDoubleClick}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransform}
      />

      {isSelected && (
        <>
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              // Limit minimum width
              if (newBox.width < 50) newBox.width = 50

              // For wrapping text, maintain auto-height by not constraining height
              if (textBox.textWrap === 'wrap') {
                // Only update width, keep height as-is (it will be auto-calculated)
                return {
                  ...newBox,
                  height: oldBox.height
                }
              } else {
                // For non-wrapping text, allow height adjustment
                if (newBox.height < 20) newBox.height = 20
                return newBox
              }
            }}
            enabledAnchors={[
              'top-left',
              'top-right',
              'bottom-left',
              'bottom-right'
            ]}
            // Customize resizing to proportionally adjust width and font size for wrapping text
            onTransform={() => {
              if (textBox.textWrap === 'wrap' && textRef.current) {
                const node = textRef.current
                const scaleX = node.scaleX()

                // Update both width and font size proportionally
                onUpdate({
                  width: textBox.width * scaleX,
                  fontSize: textBox.fontSize * scaleX
                })

                // Reset scale
                node.scaleX(1)
                node.scaleY(1)
              }
            }}
          />

          {/* Width control handle (right-middle) for text wrapping */}
          {textBox.textWrap === 'wrap' && (
            <Circle
              x={x + width}
              y={y + height / 2}
              radius={8}
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth={2}
              draggable
              onDragStart={() => setIsWidthDragging(true)}
              onDragMove={handleWidthDragMove}
              onDragEnd={handleWidthDragEnd}
              onMouseEnter={(e) => {
                const stage = e.target.getStage()
                stage.container().style.cursor = 'ew-resize'
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage()
                stage.container().style.cursor = 'default'
              }}
            />
          )}
        </>
      )}
    </>
  )
}