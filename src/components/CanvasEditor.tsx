'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect, Group } from 'react-konva'
import Konva from 'konva'

import { KonvaText } from './KonvaText'
import { KonvaBackgroundImage } from './KonvaBackgroundImage'
import { SimpleTextEditor } from './SimpleTextEditor'

import type { RemixSlideType, RemixTextBoxType, CanvasSizeType, BackgroundLayerType } from '@/lib/validations/remix-schema'
import { CANVAS_SIZES } from '@/lib/validations/remix-schema'

interface CanvasEditorProps {
  slide: RemixSlideType
  selectedTextBoxId: string | null
  selectedBackgroundLayerId: string | null
  onTextBoxSelect: (id: string | null) => void
  onBackgroundLayerSelect: (id: string | null) => void
  onTextBoxUpdate: (id: string, updates: Partial<RemixTextBoxType>) => void
  onBackgroundLayerUpdate: (id: string, updates: Partial<BackgroundLayerType>) => void
  backgroundImageUrls: Record<string, string>
  canvasWidth: number
  canvasHeight: number
  containerRef: React.RefObject<HTMLDivElement>
  resetZoomTrigger: number
}

export function CanvasEditor({
  slide,
  selectedTextBoxId,
  selectedBackgroundLayerId,
  onTextBoxSelect,
  onBackgroundLayerSelect,
  onTextBoxUpdate,
  onBackgroundLayerUpdate,
  backgroundImageUrls,
  canvasWidth,
  canvasHeight,
  containerRef,
  resetZoomTrigger
}: CanvasEditorProps) {
  const stageRef = useRef<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)
  const [stageScale, setStageScale] = useState(1)
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 })

  // Update container rect when container changes
  useEffect(() => {
    if (containerRef.current) {
      setContainerRect(containerRef.current.getBoundingClientRect())
    }
  }, [containerRef])

  // Reset zoom to center canvas with padding
  const resetZoomToFit = useCallback(() => {
    if (!stageRef.current || !containerRef.current) return

    const stage = stageRef.current
    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const padding = 32 // 32px padding around the canvas

    // Calculate available space after padding
    const availableWidth = containerWidth - (padding * 2)
    const availableHeight = containerHeight - (padding * 2)

    // Calculate the scale to fit canvas in available space
    const scaleX = availableWidth / canvasWidth
    const scaleY = availableHeight / canvasHeight
    const fitScale = Math.min(scaleX, scaleY, 1) // Don't scale up beyond 100%

    // Center the stage in the container (Konva coordinate system: 0,0 = top-left)
    const centerX = (containerWidth - canvasWidth * fitScale) / 2
    const centerY = (containerHeight - canvasHeight * fitScale) / 2

    // Reset stage to center with calculated scale
    stage.scale({ x: fitScale, y: fitScale })
    stage.position({ x: centerX, y: centerY })
    stage.batchDraw()

    setStageScale(fitScale)
    setStagePosition({ x: centerX, y: centerY })
  }, [canvasWidth, canvasHeight, containerRef])

  // Handle stage scale changes
  useEffect(() => {
    if (stageRef.current) {
      setStageScale(stageRef.current.scaleX())
    }
  }, [canvasWidth, canvasHeight])

  // Reset zoom when trigger changes or on initial mount
  useEffect(() => {
    resetZoomToFit()
  }, [resetZoomTrigger, resetZoomToFit])

  // Handle wheel event for zooming
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()

    const stage = stageRef.current
    if (!stage) return

    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1
    const limitedScale = Math.max(0.25, Math.min(3, newScale))

    stage.scale({ x: limitedScale, y: limitedScale })

    const newPos = {
      x: pointer.x - mousePointTo.x * limitedScale,
      y: pointer.y - mousePointTo.y * limitedScale,
    }
    stage.position(newPos)
    stage.batchDraw()

    setStageScale(limitedScale)
    setStagePosition(newPos)
  }, [])

  
  // Handle stage click (deselect)
  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    // If clicking on empty stage, deselect everything
    if (e.target === e.target.getStage()) {
      onTextBoxSelect(null)
      onBackgroundLayerSelect(null)
    }
  }, [onTextBoxSelect, onBackgroundLayerSelect])

  // Handle text editing
  const selectedTextBox = slide.textBoxes.find(tb => tb.id === selectedTextBoxId)

  const handleTextEditingChange = useCallback((editing: boolean) => {
    setIsEditing(editing)
  }, [])

  // Handle background layer click
  const handleBackgroundClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>, layerId: string) => {
    e.evt.stopPropagation()
    onBackgroundLayerSelect(layerId)
    onTextBoxSelect(null)
  }, [onBackgroundLayerSelect, onTextBoxSelect])

  // Handle text box click
  const handleTextClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>, textBoxId: string) => {
    e.evt.stopPropagation()
    onTextBoxSelect(textBoxId)
    onBackgroundLayerSelect(null)
  }, [onTextBoxSelect, onBackgroundLayerSelect])

  return (
    <>
      {/* Konva Stage */}
      <Stage
        ref={stageRef}
        width={canvasWidth}
        height={canvasHeight}
        onWheel={handleWheel}
        onClick={handleStageClick}
        style={{
          cursor: 'default',
        }}
      >
        <Layer>
          {/* Background layers */}
          {slide.backgroundLayers?.map((layer) => {
            if (layer.type === 'image' && layer.cacheAssetId) {
              return (
                <KonvaBackgroundImage
                  key={layer.id}
                  layer={layer as any}
                  imageUrl={backgroundImageUrls[layer.cacheAssetId] || `/api/assets/${layer.cacheAssetId}`}
                  isSelected={selectedBackgroundLayerId === layer.id}
                  onSelect={() => handleBackgroundClick(null, layer.id)}
                  onUpdate={(updates) => onBackgroundLayerUpdate(layer.id, updates as any)}
                  stageWidth={canvasWidth}
                  stageHeight={canvasHeight}
                />
              )
            } else {
              // Render color/gradient backgrounds as Konva shapes
              return (
                <Rect
                  key={layer.id}
                  x={0}
                  y={0}
                  width={canvasWidth}
                  height={canvasHeight}
                  fill={layer.type === 'color' ? layer.color :
                    layer.type === 'gradient' ?
                    `linear-gradient(${layer.gradient?.angle || 0}deg, ${layer.gradient?.colors.join(', ')})` :
                    '#ffffff'}
                  opacity={layer.opacity}
                  listening={true}
                  onClick={(e) => handleBackgroundClick(e, layer.id)}
                />
              )
            }
          })}

          {/* Default background if no layers */}
          {!slide.backgroundLayers?.length && (
            <Rect
              x={0}
              y={0}
              width={canvasWidth}
              height={canvasHeight}
              fill="#f3f4f6"
              listening={true}
              onClick={() => {
                // This will be handled by the parent to show image selection dialog
              }}
            />
          )}

          {/* Text boxes */}
          {slide.textBoxes.map((textBox) => (
            <Group key={textBox.id}>
              <KonvaText
                textBox={textBox}
                isSelected={selectedTextBoxId === textBox.id}
                onSelect={() => handleTextClick(null, textBox.id)}
                onUpdate={(updates) => onTextBoxUpdate(textBox.id, updates)}
                isEditing={isEditing && selectedTextBoxId === textBox.id}
                onEditingChange={handleTextEditingChange}
              />
            </Group>
          ))}
        </Layer>
      </Stage>

      {/* Simple Text Editor */}
      <SimpleTextEditor
        textBox={selectedTextBox || null}
        isEditing={isEditing && !!selectedTextBox}
        onUpdate={(updates) => {
          if (selectedTextBoxId) {
            onTextBoxUpdate(selectedTextBoxId, updates)
          }
        }}
        onClose={() => {
          setIsEditing(false)
        }}
        stageScale={stageScale}
        stagePosition={stagePosition}
        stageWidth={canvasWidth}
        stageHeight={canvasHeight}
        containerRect={containerRect}
      />
    </>
  )
}