'use client'

import React, { useRef, useImperativeHandle, forwardRef } from 'react'
import type { RemixSlideType } from '@/lib/validations/remix-schema'
import { DraggableTextBox } from './DraggableTextBox'
import { DraggableBackgroundImage } from './DraggableBackgroundImage'

interface HiddenSlideRendererProps {
  slides: RemixSlideType[]
  backgroundImageUrls: Record<string, string>
}

export interface HiddenSlideRendererRef {
  getSlideElements: () => HTMLElement[]
}

/**
 * Hidden component that renders all slides off-screen for export purposes
 * This avoids the flashing effect when switching slides during export
 */
export const HiddenSlideRenderer = forwardRef<HiddenSlideRendererRef, HiddenSlideRendererProps>(
  ({ slides, backgroundImageUrls }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(ref, () => ({
      getSlideElements: () => {
        if (!containerRef.current) return []
        
        // Return all slide canvas elements
        const slideElements = containerRef.current.querySelectorAll('[data-export-slide]')
        return Array.from(slideElements) as HTMLElement[]
      }
    }))

    return (
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: '-10000px',
          left: '-10000px',
          // Don't use visibility: hidden - it prevents rendering!
          // visibility: 'hidden',
          pointerEvents: 'none',
          zIndex: -9999,
        }}
        aria-hidden="true"
      >
        {slides.map((slide, index) => {
          const canvasWidth = slide.canvas?.width || 1080
          const canvasHeight = slide.canvas?.height || 1920

          return (
            <div
              key={slide.id || `slide-${index}`}
              data-export-slide={index}
              style={{
                width: canvasWidth,
                height: canvasHeight,
                marginBottom: '20px',
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              }}
            >
              {/* Background Layers */}
              {slide.backgroundLayers && slide.backgroundLayers.map((layer) => {
                if (layer.type === 'image' && layer.cacheAssetId) {
                  // Render image background layer
                  const imageUrl = backgroundImageUrls[layer.cacheAssetId] || `/api/assets/${layer.cacheAssetId}`
                  
                  return (
                    <div
                      key={layer.id}
                      style={{
                        position: 'absolute',
                        left: `${(layer.x || 0) * 100}%`,
                        top: `${(layer.y || 0) * 100}%`,
                        width: `${(layer.width || 1) * 100}%`,
                        height: `${(layer.height || 1) * 100}%`,
                        transform: `rotate(${layer.rotation || 0}deg)`,
                        transformOrigin: 'center',
                        opacity: layer.opacity ?? 1,
                        mixBlendMode: layer.blendMode as any,
                        zIndex: layer.zIndex || 1,
                        backgroundImage: `url(${imageUrl})`,
                        backgroundSize: layer.fitMode === 'cover' ? 'cover' :
                                       layer.fitMode === 'contain' ? 'contain' :
                                       layer.fitMode === 'fill' ? '100% 100%' :
                                       layer.fitMode === 'fit-width' ? '100% auto' :
                                       layer.fitMode === 'fit-height' ? 'auto 100%' :
                                       'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                      }}
                    />
                  )
                } else if (layer.type === 'color') {
                  // Render color background
                  return (
                    <div
                      key={layer.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: layer.color,
                        opacity: layer.opacity ?? 1,
                        mixBlendMode: layer.blendMode as any,
                        zIndex: layer.zIndex || 1,
                      }}
                    />
                  )
                } else if (layer.type === 'gradient' && layer.gradient) {
                  // Render gradient background
                  const gradient = layer.gradient
                  const gradientStyle = gradient.type === 'linear'
                    ? `linear-gradient(${gradient.angle || 0}deg, ${gradient.colors.join(', ')})`
                    : `radial-gradient(circle at ${(gradient.centerX || 0.5) * 100}% ${(gradient.centerY || 0.5) * 100}%, ${gradient.colors.join(', ')})`
                  
                  return (
                    <div
                      key={layer.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: gradientStyle,
                        opacity: layer.opacity ?? 1,
                        mixBlendMode: layer.blendMode as any,
                        zIndex: layer.zIndex || 1,
                      }}
                    />
                  )
                }
                return null
              })}

              {/* Default background if no layers */}
              {!slide.backgroundLayers?.length && (
                <div 
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#ffffff'
                  }} 
                />
              )}

              {/* Text Boxes */}
              {slide.textBoxes && slide.textBoxes.map((textBox) => {
                const boxX = (textBox.x || 0) * canvasWidth
                const boxY = (textBox.y || 0) * canvasHeight
                const boxWidth = (textBox.width || 0) * canvasWidth
                const boxHeight = (textBox.height || 0) * canvasHeight

                return (
                  <div
                    key={textBox.id}
                    style={{
                      position: 'absolute',
                      left: boxX,
                      top: boxY,
                      width: boxWidth,
                      minHeight: boxHeight,
                      transform: `rotate(${textBox.transform?.rotation || 0}deg)`,
                      transformOrigin: 'center',
                      zIndex: textBox.zIndex || 10,
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
                      pointerEvents: 'none',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline',
                        WebkitTextStroke: textBox.outlineWidth && textBox.outlineWidth > 0
                          ? `${textBox.outlineWidth}px ${textBox.outlineColor}`
                          : undefined,
                        textShadow: textBox.enableShadow
                          ? `${textBox.shadowOffsetX}px ${textBox.shadowOffsetY}px ${textBox.shadowBlur}px ${textBox.shadowColor}`
                          : undefined,
                        backgroundColor: textBox.backgroundColor
                          ? `rgba(${parseInt(textBox.backgroundColor.slice(1, 3), 16)}, ${parseInt(textBox.backgroundColor.slice(3, 5), 16)}, ${parseInt(textBox.backgroundColor.slice(5, 7), 16)}, ${textBox.backgroundOpacity || 1})`
                          : undefined,
                        borderRadius: textBox.borderRadius ? `${textBox.borderRadius}px` : undefined,
                        paddingTop: `${textBox.paddingTop}px`,
                        paddingRight: `${textBox.paddingRight}px`,
                        paddingBottom: `${textBox.paddingBottom}px`,
                        paddingLeft: `${textBox.paddingLeft}px`,
                        boxDecorationBreak: 'clone',
                        WebkitBoxDecorationBreak: 'clone',
                      }}
                    >
                      {textBox.text}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  }
)

HiddenSlideRenderer.displayName = 'HiddenSlideRenderer'
