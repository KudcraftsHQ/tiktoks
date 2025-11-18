'use client'

import { ImageOff } from 'lucide-react'
import { useState, useEffect, ImgHTMLAttributes, memo } from 'react'

interface SmartImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string
  fallback?: React.ReactNode
  loadingClassName?: string
}

/**
 * SmartImage component that handles HEIC images on the client side
 *
 * Behavior:
 * 1. Tries to load the image directly first
 * 2. If loading fails and URL looks like HEIC, attempts client-side conversion
 * 3. Shows loading state during conversion
 * 4. Falls back to placeholder on complete failure
 */
const SmartImageComponent = ({
  src,
  fallback,
  loadingClassName,
  className,
  alt = '',
  ...props
}: SmartImageProps) => {
  const [imageSrc, setImageSrc] = useState<string>(src)
  const [isConverting, setIsConverting] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [conversionAttempted, setConversionAttempted] = useState(false)

  // Reset state when src changes
  useEffect(() => {
    setImageSrc(src)
    setHasError(false)
    setIsConverting(false)
    setConversionAttempted(false)
  }, [src])

  const isHeicUrl = (url: string): boolean => {
    const lower = url.toLowerCase()
    return lower.includes('.heic') || lower.includes('.heif')
  }

  const handleError = async () => {
    // If we've already tried conversion or the URL doesn't look like HEIC, just show error
    if (conversionAttempted || !isHeicUrl(src)) {
      console.error('❌ [SmartImage] Image failed to load:', {
        src,
        reason: conversionAttempted ? 'Conversion already attempted' : 'Not a HEIC URL',
        timestamp: new Date().toISOString()
      })
      setHasError(true)
      return
    }

    // Mark that we're attempting conversion
    setConversionAttempted(true)
    setIsConverting(true)

    console.log('🔍 [SmartImage] Image load failed, attempting HEIC conversion...', {
      src,
      timestamp: new Date().toISOString()
    })

    try {
      // Fetch the image as blob
      const response = await fetch(src)
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`)
      }

      const blob = await response.blob()
      console.log('📦 [SmartImage] Blob fetched:', {
        type: blob.type,
        size: blob.size,
        src
      })

      // Only convert if the blob type is actually HEIC/HEIF
      if (blob.type === 'image/heic' || blob.type === 'image/heif') {
        console.log('🔄 [SmartImage] Converting HEIC image on client side...', {
          blobType: blob.type,
          blobSize: blob.size
        })

        // Dynamically import heic2any to avoid SSR issues
        const { default: heic2any } = await import('heic2any')

        const convertedBlob = await heic2any({
          blob,
          toType: 'image/jpeg',
          quality: 0.92
        })

        // heic2any can return Blob or Blob[]
        const finalBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
        const objectUrl = URL.createObjectURL(finalBlob)

        setImageSrc(objectUrl)
        setIsConverting(false)
        console.log('✅ [SmartImage] HEIC conversion successful', {
          originalSize: blob.size,
          convertedSize: finalBlob.size,
          objectUrl
        })
      } else {
        // Not actually HEIC, just a regular load error
        console.warn('⚠️ [SmartImage] Blob type is not HEIC, showing error state:', {
          expectedTypes: ['image/heic', 'image/heif'],
          actualType: blob.type,
          src
        })
        setHasError(true)
        setIsConverting(false)
      }
    } catch (error) {
      console.error('❌ [SmartImage] Client-side HEIC conversion failed:', {
        error: error instanceof Error ? error.message : String(error),
        src,
        stack: error instanceof Error ? error.stack : undefined
      })
      setHasError(true)
      setIsConverting(false)
    }
  }

  // Show loading state during conversion
  if (isConverting) {
    return (
      <div className={loadingClassName || className}>
        <div className="flex items-center justify-center w-full h-full bg-muted animate-pulse">
          <span className="text-xs text-muted-foreground">Converting...</span>
        </div>
      </div>
    )
  }

  // Show fallback if there's an error
  if (hasError && fallback) {
    return <>{fallback}</>
  }

  // Show broken image placeholder if error and no fallback
  if (hasError) {
    return (
      <div className={className}>
        <div className="flex items-center justify-center w-full aspect-[9/16] bg-muted">
          <ImageOff className='w-4 h-4'/>
        </div>
      </div>
    )
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={handleError}
      {...props}
    />
  )
}

// Memoize to prevent unnecessary re-renders when parent re-renders
export const SmartImage = memo(SmartImageComponent)
