'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { getProxiedImageUrl } from '@/lib/image-proxy'

interface Image {
  url: string
  width: number
  height: number
}

interface ImageGalleryProps {
  images: Image[]
  isOpen: boolean
  onClose: () => void
  initialIndex?: number
}

export function ImageGallery({ images, isOpen, onClose, initialIndex = 0 }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  // Reset index when gallery opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
    }
  }, [isOpen, initialIndex])

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1)
  }, [images.length])

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1)
  }, [images.length])

  // Keyboard navigation
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault()
          goToPrevious()
          break
        case 'ArrowRight':
          e.preventDefault()
          goToNext()
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeydown)
      return () => document.removeEventListener('keydown', handleKeydown)
    }
  }, [isOpen, goToPrevious, goToNext, onClose])

  if (!images.length) return null

  const currentImage = images[currentIndex]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[95vw] w-fit max-h-[95vh] p-4 bg-black/95 border-0 overflow-hidden"
        hideClose
      >
        <div className="relative flex flex-col items-center gap-4 max-h-[calc(95vh-2rem)]">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 z-10 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                onClick={goToPrevious}
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
                onClick={goToNext}
              >
                <ChevronRight className="w-6 h-6" />
              </Button>
            </>
          )}

          {/* Main image container */}
          <div className="flex-1 min-h-0 flex items-center justify-center px-10">
            <img
              src={getProxiedImageUrl(currentImage.url)}
              alt={`Image ${currentIndex + 1} of ${images.length}`}
              className="max-w-full max-h-[calc(95vh-8rem)] w-auto h-auto object-contain"
            />
          </div>

          {/* Thumbnails or counter */}
          <div className="flex-shrink-0 flex items-center justify-center h-16">
            {images.length > 1 && images.length <= 10 ? (
              <div className="flex space-x-2">
                {images.map((image, index) => (
                  <button
                    key={index}
                    className={`w-8 h-12 sm:w-10 sm:h-14 rounded border-2 overflow-hidden transition-colors ${
                      index === currentIndex ? 'border-white' : 'border-white/30 hover:border-white/60'
                    }`}
                    onClick={() => setCurrentIndex(index)}
                  >
                    <img
                      src={getProxiedImageUrl(image.url)}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : images.length > 1 ? (
              <div className="bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} / {images.length}
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}