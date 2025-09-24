'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Wand, Copy, Edit3 } from 'lucide-react'
import { CarouselImage as CarouselImageType } from '@/generated/prisma'

interface CarouselViewerProps {
  images: CarouselImageType[]
  onOCR?: (imageId: string) => void
  onOCRAll?: () => void
  onTextUpdate?: (imageId: string, text: string) => void
}

export default function CarouselViewer({ 
  images, 
  onOCR, 
  onOCRAll, 
  onTextUpdate 
}: CarouselViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  if (!images.length) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        No images available
      </div>
    )
  }

  const currentImage = images[currentIndex]
  const isLastImage = currentIndex === images.length - 1
  const isFirstImage = currentIndex === 0

  const handlePrev = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(images.length - 1, prev + 1))
  }

  const handleOCR = () => {
    if (onOCR && currentImage.id) {
      onOCR(currentImage.id)
    }
  }

  const handleOCRAll = () => {
    if (onOCRAll) {
      onOCRAll()
    }
  }

  const handleCopyText = async () => {
    if (currentImage.text) {
      await navigator.clipboard.writeText(currentImage.text)
    }
  }

  const startEditing = () => {
    setEditingTextId(currentImage.id)
    setEditingText(currentImage.text || '')
  }

  const saveText = () => {
    if (onTextUpdate && editingTextId) {
      onTextUpdate(editingTextId, editingText)
      setEditingTextId(null)
      setEditingText('')
    }
  }

  const cancelEditing = () => {
    setEditingTextId(null)
    setEditingText('')
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={isFirstImage}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {images.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={isLastImage}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOCR}
            disabled={!currentImage.id}
          >
            <Wand className="h-4 w-4 mr-2" />
            OCR This
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOCRAll}
          >
            <Wand className="h-4 w-4 mr-2" />
            OCR All
          </Button>
        </div>
      </div>

      {/* Image Container - 16:9 Portrait */}
      <div className="relative aspect-[9/16] w-full max-w-md mx-auto bg-muted rounded-lg overflow-hidden">
        {currentImage.imageUrl && (
          <img
            src={currentImage.imageUrl}
            alt={`Carousel image ${currentIndex + 1}`}
            className="object-contain w-full h-full"
          />
        )}
      </div>

      {/* Text Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Text Content</h3>
            <div className="flex gap-2">
              {editingTextId !== currentImage.id && currentImage.text && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyText}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              {editingTextId !== currentImage.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startEditing}
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {editingTextId === currentImage.id ? (
            <div className="space-y-2">
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                placeholder="Enter text content..."
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveText}>
                  Save
                </Button>
                <Button variant="outline" size="sm" onClick={cancelEditing}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="min-h-[100px] p-3 bg-muted rounded-md">
              {currentImage.text || (
                <span className="text-muted-foreground">
                  No text available. Click OCR to extract text.
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}