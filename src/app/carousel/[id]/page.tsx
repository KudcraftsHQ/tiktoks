'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Clock, User, Images, Plus, RotateCcw, Save, Scan, Copy } from 'lucide-react'
import { Carousel as CarouselType } from '@/generated/prisma'
import { CarouselVariationCard } from '@/components/CarouselVariationCard'
import { SidebarLayout } from '@/components/SidebarLayout'

interface CarouselDetailProps {
  params: { id: string }
}

interface CarouselVariation {
  id: string
  name: string
  description?: string | null
  isOriginal: boolean
  generationType?: string | null
  createdAt: Date
  slides: Array<{
    id: string
    backgroundImageUrl?: string | null
    displayOrder: number
  }>
}

export default function CarouselDetail({ params }: CarouselDetailProps) {
  const router = useRouter()
  const [carousel, setCarousel] = useState<CarouselType & {
    images: Array<{
      id: string
      imageUrl: string
      text?: string | null
      displayOrder: number
    }>
  } | null>(null)
  const [variations, setVariations] = useState<CarouselVariation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingVariation, setIsCreatingVariation] = useState(false)
  // Original OCR functionality state
  const [imageTexts, setImageTexts] = useState<Record<string, string>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [ocrLoading, setOcrLoading] = useState<Record<string, boolean>>({})
  const [isOcrAllLoading, setIsOcrAllLoading] = useState(false)

  const fetchCarousel = async () => {
    try {
      const response = await fetch(`/api/carousels/${params.id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch carousel')
      }
      const data = await response.json()
      setCarousel(data)
      
      // Initialize image texts with existing text
      const initialTexts: Record<string, string> = {}
      data.images.forEach((image: any) => {
        initialTexts[image.id] = image.text || ''
      })
      setImageTexts(initialTexts)
    } catch (error) {
      console.error('Failed to fetch carousel:', error)
      setError('Failed to load carousel')
    }
  }

  const fetchVariations = async () => {
    try {
      const response = await fetch(`/api/carousels/${params.id}/variations`)
      if (!response.ok) {
        throw new Error('Failed to fetch variations')
      }
      const data = await response.json()
      setVariations(data)
    } catch (error) {
      console.error('Failed to fetch variations:', error)
      setError('Failed to load variations')
    }
  }

  const fetchData = async () => {
    setIsLoading(true)
    await Promise.all([fetchCarousel(), fetchVariations()])
    setIsLoading(false)
  }

  const handleDesign = (variationId: string) => {
    router.push(`/carousel/${params.id}/edit/${variationId}`)
  }

  const handleDuplicate = async (variationId: string) => {
    setIsCreatingVariation(true)
    try {
      const variation = variations.find(v => v.id === variationId)
      const response = await fetch(`/api/carousels/${params.id}/variations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${variation?.name} Copy`,
          description: 'Duplicated variation',
          generationType: 'duplicate',
          sourceVariationId: variationId
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to duplicate variation')
      }

      await fetchVariations()
    } catch (error) {
      console.error('Failed to duplicate variation:', error)
      setError('Failed to duplicate variation')
    } finally {
      setIsCreatingVariation(false)
    }
  }

  const handleRephrase = async (variationId: string) => {
    setIsCreatingVariation(true)
    try {
      const variation = variations.find(v => v.id === variationId)
      const response = await fetch(`/api/carousels/${params.id}/variations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${variation?.name} (AI Rephrased)`,
          description: 'AI-generated variation with rephrased content',
          generationType: 'ai_rephrase',
          sourceVariationId: variationId
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create AI variation')
      }

      await fetchVariations()
    } catch (error) {
      console.error('Failed to create AI variation:', error)
      setError('Failed to create AI variation')
    } finally {
      setIsCreatingVariation(false)
    }
  }

  const handleDelete = async (variationId: string) => {
    if (!confirm('Are you sure you want to delete this variation?')) return

    try {
      const response = await fetch(`/api/carousels/${params.id}/variations/${variationId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete variation')
      }

      await fetchVariations()
    } catch (error) {
      console.error('Failed to delete variation:', error)
      setError('Failed to delete variation')
    }
  }

  const handleCreateNew = async () => {
    setIsCreatingVariation(true)
    try {
      const response = await fetch(`/api/carousels/${params.id}/variations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `New Variation ${variations.length + 1}`,
          description: 'Custom variation',
          generationType: 'manual'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create variation')
      }

      const newVariation = await response.json()
      router.push(`/carousel/${params.id}/edit/${newVariation.id}`)
    } catch (error) {
      console.error('Failed to create variation:', error)
      setError('Failed to create variation')
    } finally {
      setIsCreatingVariation(false)
    }
  }

  const handleDuplicateFromOriginal = async () => {
    setIsCreatingVariation(true)
    try {
      // First, ensure we have an original variation to copy from
      await ensureOriginalVariation()
      
      const original = variations.find(v => v.isOriginal)
      if (!original) {
        throw new Error('Original variation not found')
      }

      const response = await fetch(`/api/carousels/${params.id}/variations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${carousel?.title || 'Carousel'} Copy`,
          description: 'Duplicated from original',
          generationType: 'duplicate',
          sourceVariationId: original.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to duplicate variation')
      }

      await fetchVariations()
    } catch (error) {
      console.error('Failed to duplicate from original:', error)
      setError('Failed to create copy')
    } finally {
      setIsCreatingVariation(false)
    }
  }

  const handleRephraseFromOriginal = async () => {
    setIsCreatingVariation(true)
    try {
      // First, ensure we have an original variation to copy from
      await ensureOriginalVariation()
      
      const original = variations.find(v => v.isOriginal)
      if (!original) {
        throw new Error('Original variation not found')
      }

      const response = await fetch(`/api/carousels/${params.id}/variations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${carousel?.title || 'Carousel'} (AI Rephrased)`,
          description: 'AI-generated variation with rephrased content',
          generationType: 'ai_rephrase',
          sourceVariationId: original.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create AI variation')
      }

      await fetchVariations()
    } catch (error) {
      console.error('Failed to create AI variation:', error)
      setError('Failed to create AI variation')
    } finally {
      setIsCreatingVariation(false)
    }
  }

  const ensureOriginalVariation = async () => {
    if (!carousel || variations.find(v => v.isOriginal)) return

    // Create original variation from carousel images
    const response = await fetch(`/api/carousels/${params.id}/variations/create-original`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageTexts: imageTexts
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create original variation')
    }

    await fetchVariations()
  }

  // Original OCR Functions
  const handleTextChange = (imageId: string, text: string) => {
    setImageTexts(prev => ({
      ...prev,
      [imageId]: text
    }))
    setHasChanges(true)
  }

  const performOCR = async (imageId: string, imageUrl: string) => {
    setOcrLoading(prev => ({ ...prev, [imageId]: true }))
    
    try {
      const response = await fetch(`/api/carousels/${params.id}/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageId }),
      })

      if (!response.ok) {
        throw new Error('Failed to perform OCR')
      }

      const data = await response.json()
      
      // Clean up the OCR text (remove extra whitespace and newlines)
      const cleanedText = data.text.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ')
      
      setImageTexts(prev => ({
        ...prev,
        [imageId]: cleanedText
      }))
      setHasChanges(true)
    } catch (error) {
      console.error('OCR failed:', error)
      setError('Failed to extract text from image')
    } finally {
      setOcrLoading(prev => ({ ...prev, [imageId]: false }))
    }
  }

  const performOCRAll = async () => {
    if (!carousel) return
    
    setIsOcrAllLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/carousels/${params.id}/ocr-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to perform batch OCR')
      }

      const data = await response.json()
      
      // Extract successful results and update local state
      const newImageTexts: Record<string, string> = {}
      if (data.results) {
        data.results.forEach((result: any) => {
          if (result.success) {
            const cleanedText = result.text.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ')
            newImageTexts[result.imageId] = cleanedText
          }
        })
      }
      
      setImageTexts(prev => ({
        ...prev,
        ...newImageTexts
      }))
      
      if (Object.keys(newImageTexts).length > 0) {
        setHasChanges(true)
      }
    } catch (error) {
      console.error('Batch OCR failed:', error)
      setError('Failed to extract text from images')
    } finally {
      setIsOcrAllLoading(false)
    }
  }

  const saveImageTexts = async () => {
    if (!carousel || !hasChanges) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/carousels/${params.id}/images`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageTexts: imageTexts
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save image texts')
      }

      setHasChanges(false)
      
      // Update local carousel state with saved texts
      setCarousel(prev => prev ? {
        ...prev,
        images: prev.images.map(img => ({
          ...img,
          text: imageTexts[img.id] || img.text
        }))
      } : prev)
    } catch (error) {
      console.error('Failed to save image texts:', error)
      setError('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [params.id])

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date))
  }

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Loading carousel...</span>
          </div>
        </div>
      </SidebarLayout>
    )
  }

  if (error || !carousel) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-4">
            <p className="text-destructive">{error || 'Carousel not found'}</p>
            <Button onClick={() => router.push('/')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b sticky top-0 bg-background z-50">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => router.push('/')} 
                variant="ghost" 
                size="sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold line-clamp-2">
                  {carousel.title || 'Untitled Carousel'}
                </h1>
                <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                  {carousel.author && (
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{carousel.author}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{formatDate(carousel.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Images className="h-4 w-4" />
                    <span>{carousel.images.length} images</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={saveImageTexts}
                  disabled={!hasChanges || isSaving}
                  variant="outline"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  onClick={handleCreateNew}
                  disabled={isCreatingVariation}
                  variant="default"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {isCreatingVariation ? 'Creating...' : 'Create New'}
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-8">
          {/* Original Carousel Images */}
          <div className="space-y-6 sticky top-0 bg-background z-10 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">🔸 Original Carousel</h2>
              <div className="flex gap-2">
                <Button
                  onClick={performOCRAll}
                  disabled={isOcrAllLoading}
                  variant="outline"
                  size="sm"
                >
                  {isOcrAllLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Scan className="h-4 w-4 mr-2" />
                      Get All Texts
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleDuplicateFromOriginal()}
                  disabled={isCreatingVariation}
                  variant="outline" 
                  size="sm"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button
                  onClick={() => handleRephraseFromOriginal()}
                  disabled={isCreatingVariation}
                  variant="outline"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  AI Rephrase
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="flex gap-4 pb-4">
                {carousel.images.map((image, index) => (
                  <div
                    key={image.id}
                    className="flex flex-col gap-3 flex-shrink-0 w-60"
                  >
                    <div className="relative flex bg-muted rounded-sm overflow-hidden aspect-[9/15] items-center w-full h-auto group">
                      <img
                        src={image.imageUrl}
                        alt={`Image ${index + 1}`}
                        className="w-full h-auto"
                      />
                      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {index + 1}
                      </div>
                    </div>
                    <div className="w-60 relative">
                      <Button
                        onClick={() => performOCR(image.id, image.imageUrl)}
                        disabled={ocrLoading[image.id]}
                        size="sm"
                        variant="outline"
                        className="absolute top-2 right-2 z-10 h-6 w-6 p-0"
                      >
                        {ocrLoading[image.id] ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                        ) : (
                          <Scan className="h-3 w-3" />
                        )}
                      </Button>
                      <Textarea
                        placeholder={`Text for image ${index + 1}...`}
                        value={imageTexts[image.id] || ''}
                        onChange={(e) => handleTextChange(image.id, e.target.value)}
                        className="h-[200px] resize-none text-sm w-full pr-10"
                        rows={3}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Carousel Variations */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">🎯 Carousel Variations</h2>
              <Button
                onClick={() => {
                  // Generate AI variation from the original
                  const original = variations.find(v => v.isOriginal)
                  if (original) handleRephrase(original.id)
                }}
                disabled={isCreatingVariation}
                variant="outline"
                size="sm"
              >
                {isCreatingVariation ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Generate AI Variation
                  </>
                )}
              </Button>
            </div>

            {variations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Images className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No variations yet. Create your first variation!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {variations.map((variation) => (
                  <CarouselVariationCard
                    key={variation.id}
                    variation={variation}
                    onDesign={handleDesign}
                    onDuplicate={handleDuplicate}
                    onRephrase={handleRephrase}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
    </SidebarLayout>
  )
}