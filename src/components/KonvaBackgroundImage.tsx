'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Image, Transformer } from 'react-konva'
import Konva from 'konva'

interface BackgroundLayer {
  id: string
  type: string
  imageId?: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  opacity: number
}

interface KonvaBackgroundImageProps {
  layer: BackgroundLayer
  imageUrl?: string
  isSelected: boolean
  onSelect: () => void
  onUpdate: (updates: Partial<BackgroundLayer>) => void
  stageWidth: number
  stageHeight: number
}

export function KonvaBackgroundImage({
  layer,
  imageUrl,
  isSelected,
  onSelect,
  onUpdate,
  stageWidth,
  stageHeight
}: KonvaBackgroundImageProps) {
  const imageRef = useRef<any>(null)
  const transformerRef = useRef<any>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  // Load image
  useEffect(() => {
    if (imageUrl) {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => setImage(img)
      img.onerror = () => console.error('Failed to load background image')
      img.src = imageUrl
    }
  }, [imageUrl])

  // Update transformer when selection changes
  useEffect(() => {
    if (isSelected && transformerRef.current && imageRef.current) {
      transformerRef.current.nodes([imageRef.current])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected, layer])

  // Handle transform (scale and position)
  const handleTransform = useCallback(() => {
    if (imageRef.current) {
      const node = imageRef.current

      // Calculate position as percentage
      const xPercent = node.x() / stageWidth
      const yPercent = node.y() / stageHeight

      // Get the scale values
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()

      // Update layer with new position and scale
      onUpdate({
        x: Math.max(0, Math.min(1, xPercent)),
        y: Math.max(0, Math.min(1, yPercent)),
        width: Math.max(0.5, Math.min(3, scaleX)),
        height: Math.max(0.5, Math.min(3, scaleY))
      })

      // Reset scale since we're storing it explicitly
      node.scaleX(1)
      node.scaleY(1)
    }
  }, [stageWidth, stageHeight, onUpdate])

  // Handle drag end
  const handleDragEnd = useCallback((e: any) => {
    const node = e.target
    onUpdate({
      x: Math.max(0, Math.min(1, node.x() / stageWidth)),
      y: Math.max(0, Math.min(1, node.y() / stageHeight))
    })
  }, [stageWidth, stageHeight, onUpdate])

  if (!image || layer.type !== 'image') {
    return null
  }

  // Calculate position and size
  const x = layer.x * stageWidth
  const y = layer.y * stageHeight
  const width = stageWidth * layer.width
  const height = stageHeight * layer.height

  return (
    <>
      <Image
        ref={imageRef}
        image={image}
        x={x}
        y={y}
        width={width}
        height={height}
        opacity={layer.opacity}
        draggable={isSelected}
        onClick={onSelect}
        onDragEnd={handleDragEnd}
        alt=""
        onTransformEnd={handleTransform}
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        listening={true}
      />

      {isSelected && (
        <Transformer
          ref={transformerRef}
          boundBoxFunc={(oldBox, newBox) => {
            // Limit minimum scale
            const minScale = 0.5
            const maxScale = 3

            const scaleX = newBox.width / (image.width || stageWidth)
            const scaleY = newBox.height / (image.height || stageHeight)

            if (scaleX < minScale) newBox.width = oldBox.width
            if (scaleY < minScale) newBox.height = oldBox.height
            if (scaleX > maxScale) newBox.width = oldBox.width
            if (scaleY > maxScale) newBox.height = oldBox.height

            return newBox
          }}
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right'
          ]}
          rotateEnabled={false}
          keepRatio={true}
        />
      )}
    </>
  )
}