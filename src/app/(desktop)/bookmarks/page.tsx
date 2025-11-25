'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InlineEditableText } from '@/components/InlineEditableText'
import { ApprovalToggle } from '@/components/ApprovalToggle'
import { PostedUrlInput } from '@/components/PostedUrlInput'
import { RemixStatsCard } from '@/components/RemixStatsCard'
import { OriginalPostLinker } from '@/components/OriginalPostLinker'
import {
  ArrowLeft,
  Edit,
  Download,
  Trash2,
  BookmarkCheck,
  ExternalLink,
  Plus,
  Copy,
  PlusCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { formatCompactNumber, normalizeBigInt } from '@/lib/stats-calculator'

interface RemixSlide {
  id: string
  displayOrder: number
  canvas?: {
    width: number
    height: number
    unit?: string
  }
  backgroundLayers?: Array<{
    id?: string
    type: 'image' | 'color' | 'gradient'
    imageId?: string
    x: number
    y: number
    width: number
    height: number
    rotation: number
    fitMode: string
    color?: string
    opacity: number
    blendMode: string
    zIndex: number
  }>
  originalImageIndex?: number
  paraphrasedText: string
  originalText?: string
  textBoxes: Array<{
    id: string
    text: string
    [key: string]: any
  }>
}

interface RemixPost {
  id: string
  name: string
  description?: string
  generationType: string
  bookmarked: boolean
  approved: boolean
  postedUrl?: string | null
  postedAt?: string | null
  createdAt: string
  updatedAt: string
  slideCount: number
  productContext?: {
    id: string
    title: string
    description: string
  }
  originalPost?: {
    id: string
    tiktokUrl: string
    authorNickname?: string
    authorHandle?: string
    contentType: string
    viewCount: string
    likeCount: number
    shareCount: number
    commentCount: number
    saveCount: number
    ocrTexts?: any // Array of OCR text data
    profile: {
      isOwnProfile: boolean
    }
  } | null
  linkedPostStats?: {
    id: string
    tiktokUrl: string
    viewCount: string
    likeCount: number
    shareCount: number
    commentCount: number
    saveCount: number
    profile: {
      isOwnProfile: boolean
    }
  } | null
  slides: RemixSlide[]
}

export default function BookmarksPage() {
  const router = useRouter()
  const [remixes, setRemixes] = useState<RemixPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingRemix, setIsCreatingRemix] = useState(false)

  useEffect(() => {
    fetchBookmarkedRemixes()
  }, [])

  const fetchBookmarkedRemixes = async (showLoader = true) => {
    if (showLoader) {
      setIsLoading(true)
    }
    try {
      const response = await fetch('/api/remixes/bookmarked?limit=100')
      if (!response.ok) {
        throw new Error('Failed to fetch bookmarked remixes')
      }
      const data = await response.json()
      setRemixes(data.remixes || [])
    } catch (error) {
      console.error('Failed to fetch bookmarked remixes:', error)
      setError('Failed to load bookmarked remixes')
    } finally {
      if (showLoader) {
        setIsLoading(false)
      }
    }
  }

  const updateSlideText = async (
    remixId: string,
    slideIndex: number,
    field: 'paraphrasedText',
    newValue: string
  ) => {
    try {
      console.log(`🔤 [Client] Updating slide text for remix: ${remixId}, slide: ${slideIndex}, field: ${field}`)
      console.log(`🔤 [Client] New value: "${newValue}"`)

      const remix = remixes.find(r => r.id === remixId)
      if (!remix) {
        throw new Error('Remix not found')
      }

      console.log(`🔤 [Client] Total slides: ${remix.slides.length}`)

      // Use the dedicated update-slide endpoint - much simpler!
      const response = await fetch(`/api/remixes/${remixId}/update-slide`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slideIndex,
          field,
          value: newValue
        })
      })

      console.log(`🔤 [Client] Response status: ${response.status}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(`🔤 [Client] Error response:`, errorData)
        throw new Error(errorData.error || 'Failed to update slide')
      }

      const data = await response.json()
      console.log('Slide updated successfully:', data)

      // Update local state to match the change
      setRemixes(prevRemixes =>
        prevRemixes.map(r => {
          if (r.id === remixId) {
            const updatedSlides = [...r.slides]
            updatedSlides[slideIndex] = {
              ...updatedSlides[slideIndex],
              [field]: newValue
            }
            return { ...r, slides: updatedSlides }
          }
          return r
        })
      )

      toast.success('Saved successfully')
    } catch (error) {
      console.error('Failed to update slide:', error)
      throw error
    }
  }

  const deleteRemix = async (remixId: string) => {
    if (!confirm('Are you sure you want to delete this remix?')) return

    try {
      const response = await fetch(`/api/remixes/${remixId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete remix')
      }

      setRemixes(prevRemixes => prevRemixes.filter(r => r.id !== remixId))
      toast.success('Remix deleted successfully')
    } catch (error) {
      console.error('Failed to delete remix:', error)
      toast.error('Failed to delete remix')
      await fetchBookmarkedRemixes(false)
    }
  }

  const duplicateRemix = async (remixId: string) => {
    try {
      const remix = remixes.find(r => r.id === remixId)
      if (!remix) {
        throw new Error('Remix not found')
      }

      // Step 1: Create a new remix with one empty slide first
      const createResponse = await fetch('/api/remixes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${remix.name} (Copy)`,
          description: remix.description,
          bookmarked: true,
          slideCount: 1 // Create with minimal slides first
        })
      })

      if (!createResponse.ok) {
        throw new Error('Failed to create remix copy')
      }

      const createData = await createResponse.json()
      const newRemixId = createData.remix.id

      // Step 2: Link original post first (if it exists)
      let originalPostLinked = false
      if (remix.originalPost) {
        const linkResponse = await fetch(`/api/remixes/${newRemixId}/link-original`, {
          method: 'PUT', // Use PUT as specified in the API
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            tiktokUrl: remix.originalPost.tiktokUrl
          })
        })

        if (linkResponse.ok) {
          originalPostLinked = true
          console.log('Original post linked successfully')
        } else {
          console.warn('Failed to link original post to duplicate')
        }
      }

      // Step 3: Update the new remix with complete slide data
      const updateResponse = await fetch(`/api/remixes/${newRemixId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slides: remix.slides.map((slide, index) => ({
            id: `slide_${Date.now()}_${index}`,
            displayOrder: slide.displayOrder,
            canvas: slide.canvas || { width: 1080, height: 1920 }, // Default if missing
            backgroundLayers: slide.backgroundLayers || [],
            originalImageIndex: slide.originalImageIndex ?? index,
            paraphrasedText: slide.paraphrasedText || '',
            originalText: slide.originalText || '',
            textBoxes: slide.textBoxes || []
          }))
        })
      })

      if (!updateResponse.ok) {
        throw new Error('Failed to update remix copy with slide data')
      }

      // Refresh the list
      await fetchBookmarkedRemixes(false)

      const successMessage = originalPostLinked 
        ? 'Remix duplicated successfully with original post'
        : 'Remix duplicated successfully (original post not linked)'
      
      toast.success(successMessage)
    } catch (error) {
      console.error('Failed to duplicate remix:', error)
      toast.error('Failed to duplicate remix')
    }
  }

  const addSlideToRemix = async (remixId: string) => {
    try {
      const remix = remixes.find(r => r.id === remixId)
      if (!remix) {
        throw new Error('Remix not found')
      }

      // Use the dedicated add-slide endpoint - much simpler!
      const response = await fetch(`/api/remixes/${remixId}/add-slide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error Response:', errorData)
        throw new Error(errorData.error || 'Failed to add slide')
      }

      const data = await response.json()
      console.log('Slide added successfully:', data)

      // Refresh the list to get the updated slides
      await fetchBookmarkedRemixes(false)

      toast.success('Slide added successfully')
    } catch (error) {
      console.error('Failed to add slide:', error)
      toast.error('Failed to add slide')
    }
  }

  const createNewRemix = async () => {
    setIsCreatingRemix(true)
    try {
      const response = await fetch('/api/remixes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `Untitled Remix ${new Date().toLocaleDateString()}`,
          description: '',
          bookmarked: true,
          slideCount: 5
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create remix')
      }

      const data = await response.json()

      // Refresh the list
      await fetchBookmarkedRemixes(false)

      toast.success('New remix created!')

      // Optionally navigate to editor
      // router.push(`/remix/${data.remix.id}/edit`)
    } catch (error) {
      console.error('Failed to create remix:', error)
      toast.error('Failed to create remix')
    } finally {
      setIsCreatingRemix(false)
    }
  }

  const downloadRemix = async (remixId: string) => {
    try {
      const response = await fetch(`/api/remixes/${remixId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format: 'png',
          quality: 0.95
        })
      })

      if (!response.ok) {
        throw new Error('Failed to export remix')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `remix-${remixId}-export.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('Download started')
    } catch (error) {
      console.error('Failed to download remix:', error)
      toast.error('Failed to download remix')
    }
  }

  const maxSlidesCount = Math.max(
    ...remixes.map(r => r.slides.length),
    1
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span>Loading bookmarked remixes...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => router.push('/')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 w-full">
        <div className="w-full px-4 py-4">
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
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <BookmarkCheck className="h-5 w-5 text-primary" />
                Bookmarked Remixes
              </h1>
            </div>
            <Button
              onClick={createNewRemix}
              disabled={isCreatingRemix}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isCreatingRemix ? 'Creating...' : 'New Remix'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <div className="flex-1 overflow-hidden">
          {/* Table Container with Horizontal Scroll */}
          <div className="overflow-x-auto h-full">
            <div className="inline-block min-w-full">
              {/* Header Row */}
              <div className="flex border-b bg-background sticky top-0 z-20">
                <div className="w-96 border-r bg-background p-4 flex-shrink-0 sticky left-0 z-10">
                  <h3 className="font-semibold text-sm">Remix Details</h3>
                </div>
                <div className="flex">
                  {Array.from({ length: maxSlidesCount }).map((_, index) => (
                    <div key={index} className="w-72 border-r p-4 text-center flex-shrink-0">
                      <p className="text-sm font-medium">Slide {index + 1}</p>
                    </div>
                  ))}
                </div>
                <div className="w-20 border-r p-4 text-center flex-shrink-0 sticky right-0 z-10 bg-background">
                  <p className="text-xs font-medium">Add</p>
                </div>
              </div>

              {/* Remix Rows */}
              {remixes.map((remix) => (
                <div key={remix.id} className="flex border-b">
                  {/* Remix Details Column - Contains everything except slides */}
                  <div className="w-96 border-r bg-background flex-shrink-0 sticky left-0 z-10 overflow-y-auto" style={{ maxHeight: '600px' }}>
                    {/* Remix Title */}
                    <div className="p-4 border-b">
                      <InlineEditableText
                        value={remix.name}
                        onSave={async (newValue) => {
                          try {
                            const response = await fetch(`/api/remixes/${remix.id}`, {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                name: newValue
                              })
                            })

                            if (!response.ok) {
                              throw new Error('Failed to update remix name')
                            }

                            setRemixes(prevRemixes =>
                              prevRemixes.map(r =>
                                r.id === remix.id ? { ...r, name: newValue } : r
                              )
                            )

                            toast.success('Remix name updated')
                          } catch (error) {
                            console.error('Failed to update remix name:', error)
                            throw error
                          }
                        }}
                        placeholder="Enter remix name..."
                        rows={1}
                        className="font-semibold text-base"
                      />
                      {remix.postedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Posted on {new Date(remix.postedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </p>
                      )}
                    </div>

                    {/* Original Post */}
                    {remix.originalPost ? (
                      <>
                        <div className="p-4 border-b space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Original Post</p>
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">
                                {remix.originalPost.authorNickname || remix.originalPost.authorHandle}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {remix.slides.length} slides
                              </p>
                            </div>
                            <a
                              href={remix.originalPost.tiktokUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 transition-colors flex-shrink-0 ml-2"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>

                        {/* Performance Stats */}
                        <div className="p-4 border-b space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Performance</p>

                          {/* Original Stats - Horizontal Cards */}
                          <div>
                            <p className="text-xs font-medium mb-1.5">Original</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              <div className="bg-muted/30 rounded px-2 py-1.5">
                                <p className="text-[10px] text-muted-foreground">Views</p>
                                <p className="text-xs font-semibold">{formatCompactNumber(normalizeBigInt(remix.originalPost.viewCount))}</p>
                              </div>
                              <div className="bg-muted/30 rounded px-2 py-1.5">
                                <p className="text-[10px] text-muted-foreground">Likes</p>
                                <p className="text-xs font-semibold">{formatCompactNumber(remix.originalPost.likeCount)}</p>
                              </div>
                              <div className="bg-muted/30 rounded px-2 py-1.5">
                                <p className="text-[10px] text-muted-foreground">Shares</p>
                                <p className="text-xs font-semibold">{formatCompactNumber(remix.originalPost.shareCount)}</p>
                              </div>
                            </div>
                          </div>

                          {/* Posted Stats - Horizontal Cards */}
                          {remix.linkedPostStats && (
                            <div className="pt-1">
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-xs font-medium">Posted</p>
                                <a
                                  href={remix.postedUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:text-blue-700 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                              <div className="grid grid-cols-3 gap-1.5">
                                <div className="bg-muted/30 rounded px-2 py-1.5">
                                  <p className="text-[10px] text-muted-foreground">Views</p>
                                  <p className="text-xs font-semibold">{formatCompactNumber(normalizeBigInt(remix.linkedPostStats.viewCount))}</p>
                                </div>
                                <div className="bg-muted/30 rounded px-2 py-1.5">
                                  <p className="text-[10px] text-muted-foreground">Likes</p>
                                  <p className="text-xs font-semibold">{formatCompactNumber(remix.linkedPostStats.likeCount)}</p>
                                </div>
                                <div className="bg-muted/30 rounded px-2 py-1.5">
                                  <p className="text-[10px] text-muted-foreground">Shares</p>
                                  <p className="text-xs font-semibold">{formatCompactNumber(remix.linkedPostStats.shareCount)}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="p-4 border-b">
                        <OriginalPostLinker
                          remixId={remix.id}
                          onLinked={(linkedPost) => {
                            // Update local state
                            setRemixes(prevRemixes =>
                              prevRemixes.map(r =>
                                r.id === remix.id
                                  ? { ...r, originalPost: linkedPost }
                                  : r
                              )
                            )
                          }}
                        />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="p-4 space-y-3">
                      {/* Approval & Posted Status - One Row */}
                      <div className="grid grid-cols-2 gap-2">
                        <ApprovalToggle
                          remixId={remix.id}
                          initialApproved={remix.approved}
                          onApprovalChange={(approved) => {
                            setRemixes(prevRemixes =>
                              prevRemixes.map(r =>
                                r.id === remix.id ? { ...r, approved } : r
                              )
                            )
                          }}
                        />
                        <PostedUrlInput
                          remixId={remix.id}
                          initialPostedUrl={remix.postedUrl}
                          initialLinkedPost={remix.linkedPostStats}
                          onUrlChange={(url, linkedPost) => {
                            setRemixes(prevRemixes =>
                              prevRemixes.map(r =>
                                r.id === remix.id
                                  ? { ...r, postedUrl: url, linkedPostStats: linkedPost }
                                  : r
                              )
                            )
                          }}
                        />
                      </div>

                      {/* Primary Actions */}
                      <div className="pt-2 border-t">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => router.push(`/remix/${remix.id}/edit`)}
                            variant="outline"
                            size="sm"
                            title="Edit remix"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => duplicateRemix(remix.id)}
                            variant="outline"
                            size="sm"
                            title="Duplicate remix"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => downloadRemix(remix.id)}
                            variant="outline"
                            size="sm"
                            title="Export remix"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => deleteRemix(remix.id)}
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Delete remix"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Slide Columns - Horizontally Scrollable */}
                  <div className="flex items-stretch">
                    {Array.from({ length: maxSlidesCount }).map((_, slideIndex) => {
                      const slide = remix.slides[slideIndex]

                      // Get original text from OCR if available
                      let originalText = ''
                      if (remix.originalPost) {
                        try {
                          const ocrTexts = Array.isArray(remix.originalPost.ocrTexts)
                            ? remix.originalPost.ocrTexts
                            : JSON.parse(remix.originalPost.ocrTexts || '[]')
                          const ocrData = ocrTexts.find((ocr: any) => ocr.imageIndex === slideIndex)
                          originalText = ocrData?.text || ''
                        } catch (e) {
                          console.warn('Failed to parse OCR texts:', e)
                        }
                      }

                      return (
                        <div key={slideIndex} className="w-72 border-r flex-shrink-0">
                          {slide ? (
                            <div className="flex flex-col" style={{ height: '400px' }}>
                              {/* Original Text - Top Half (Disabled but with copy) */}
                              {remix.originalPost && (
                                <div className="border-b p-4 h-1/2">
                                  <InlineEditableText
                                    value={originalText}
                                    onSave={async () => {}} // No-op since it's disabled
                                    placeholder="No original text"
                                    disabled={true}
                                    disabledMessage="Original text from TikTok (read-only)"
                                    fixedHeight={true}
                                  />
                                </div>
                              )}

                              {/* Remix Text - Bottom Half */}
                              <div className={`p-4 ${remix.originalPost ? 'h-1/2' : 'h-full'}`}>
                                <InlineEditableText
                                  value={slide.paraphrasedText}
                                  onSave={(newValue) =>
                                    updateSlideText(
                                      remix.id,
                                      slideIndex,
                                      'paraphrasedText',
                                      newValue
                                    )
                                  }
                                  placeholder="Enter text content..."
                                  disabled={remix.approved}
                                  disabledMessage="Editing is disabled - Remix is approved. Unapprove to edit."
                                  fixedHeight={true}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="h-96 flex items-center justify-center text-muted-foreground text-xs">
                              No slide
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Add Slide Button - Sticky on Right */}
                  <div className="w-20 flex items-center justify-center border-r sticky right-0 z-10 bg-background">
                    <button
                      onClick={() => addSlideToRemix(remix.id)}
                      className="flex flex-col items-center justify-center gap-2 p-4 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all rounded group"
                      title="Add new slide"
                    >
                      <PlusCircle className="h-6 w-6 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-medium">Add Slide</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Empty State */}
              {remixes.length === 0 && (
                <div className="flex items-center justify-center h-64 text-center">
                  <div>
                    <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <BookmarkCheck className="h-8 w-8 opacity-50" />
                    </div>
                    <h3 className="font-medium mb-2">No bookmarked remixes</h3>
                    <p className="text-sm text-muted-foreground">
                      Bookmark some remixes to see them here
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
