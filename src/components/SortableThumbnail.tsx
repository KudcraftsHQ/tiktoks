'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ImageIcon, Trash2 } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

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
}

interface CarouselSlide {
  id: string
  backgroundImageUrl?: string | null
  backgroundImagePositionX: number
  backgroundImagePositionY: number
  backgroundImageZoom: number
  displayOrder: number
  textBoxes: CarouselTextBox[]
}

interface SortableThumbnailProps {
  slide: CarouselSlide
  index: number
  isActive: boolean
  onClick: () => void
  onDelete: () => void
  canDelete: boolean
}

export function SortableThumbnail({ 
  slide, 
  index, 
  isActive, 
  onClick, 
  onDelete, 
  canDelete 
}: SortableThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none', // Prevent scrolling while dragging
    zIndex: isDragging ? 1000 : 'auto',
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onClick={onClick}
          className={`flex-shrink-0 w-18 h-28 rounded-2xl border-3 box-border relative overflow-hidden select-none group sortable-item ${
            isActive
              ? 'border-primary shadow-xl' 
              : 'border-border hover:border-primary/50 thumbnail-hover'
          } ${
            isDragging ? 'dragging scale-95 opacity-40' : 'cursor-grab hover:cursor-grab active:cursor-grabbing'
          }`}
        >
          {/* Thumbnail with background */}
          <div className="w-full h-full relative rounded-xl overflow-hidden bg-white">
            {slide.backgroundImageUrl ? (
              <img
                src={slide.backgroundImageUrl}
                alt={`Slide ${index + 1}`}
                className="w-full h-full object-cover"
                style={{
                  objectPosition: `${slide.backgroundImagePositionX * 100}% ${slide.backgroundImagePositionY * 100}%`,
                  transform: `scale(${slide.backgroundImageZoom})`
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-gray-400" />
              </div>
            )}
            
            {/* Text overlay preview - Show actual text content */}
            <div className="absolute inset-0 pointer-events-none">
              {slide.textBoxes.map((textBox) => {
                // Calculate responsive font size for thumbnail
                const thumbnailFontSize = Math.max(2, Math.min(8, textBox.fontSize * 0.12))
                const isLightText = textBox.color === '#ffffff' || textBox.color === '#fff' || textBox.color.toLowerCase() === 'white'
                
                return (
                  <div
                    key={textBox.id}
                    className="absolute font-medium leading-tight overflow-hidden flex items-center justify-center"
                    style={{
                      left: `${textBox.x * 100}%`,
                      top: `${textBox.y * 100}%`,
                      width: `${textBox.width * 100}%`,
                      height: `${textBox.height * 100}%`,
                      color: textBox.color,
                      fontWeight: textBox.fontWeight === 'bold' ? '700' : '500',
                      fontStyle: textBox.fontStyle,
                      textAlign: textBox.textAlign as any,
                      fontSize: `${thumbnailFontSize}px`,
                      zIndex: textBox.zIndex,
                      textShadow: isLightText ? '0 0 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)' : '0 0 2px rgba(255,255,255,0.8)',
                      wordWrap: 'break-word',
                      hyphens: 'auto'
                    }}
                  >
                    <span className="block max-w-full">{textBox.text}</span>
                  </div>
                )
              })}
            </div>
            
            {/* Slide number badge */}
            <div className="absolute top-1 right-1">
              <div className="bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                {index + 1}
              </div>
            </div>
          </div>
          
          
          {/* Hover effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-black/20 to-transparent rounded-xl" />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem 
          onClick={onDelete}
          disabled={!canDelete}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Slide
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}