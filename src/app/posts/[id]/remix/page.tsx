'use client'

import React, { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InlineEditableText } from '@/components/InlineEditableText'
import { CreateRemixDialog } from '@/components/CreateRemixDialog'
import {
  ArrowLeft,
  Sparkles,
  Edit,
  Download,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Bookmark
} from 'lucide-react'
import { toast } from 'sonner'

interface TikTokPost {
  id: string
  tiktokUrl: string
  contentType: string
  title?: string
  description?: string
  authorNickname?: string
  authorHandle?: string
  images: Array<{ cacheAssetId: string; width: number; height: number; url?: string }>
  ocrStatus: string
  ocrProcessedAt?: string
  ocrTexts: Array<{ imageIndex: number; text: string; success: boolean; error?: string }>
}

interface RemixPost {
  id: string
  name: string
  description?: string
  generationType: string
  bookmarked: boolean
  createdAt: string
  productContext?: {
    id: string
    title: string
    description: string
  }
  slides: Array<{
    id: string
    displayOrder: number
    paraphrasedText: string
    textBoxes: Array<{
      id: string
      text: string
    }>
  }>
}

interface RemixPageProps {
  params: Promise<{ id: string }>
}

export default function RemixPage({ params }: RemixPageProps) {
  const router = useRouter()
  const resolvedParams = use(params)
  const [post, setPost] = useState<TikTokPost | null>(null)
  const [remixes, setRemixes] = useState<RemixPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRunningOCR, setIsRunningOCR] = useState(false)
  const [isRemixDialogOpen, setIsRemixDialogOpen] = useState(false)

  useEffect(() => {
    fetchPostAndRemixes()
  }, [resolvedParams.id])

  const fetchPostAndRemixes = async (showLoader = true) => {
    if (showLoader) {
      setIsLoading(true)
    }
    try {
      // Fetch post details
      const postResponse = await fetch(`/api/tiktok/posts/${resolvedParams.id}`)
      if (!postResponse.ok) {
        throw new Error('Failed to fetch post')
      }
      const postData = await postResponse.json()
      setPost(postData)

      // Fetch existing remixes
      const remixResponse = await fetch(`/api/tiktok/posts/${resolvedParams.id}/remix`)
      if (remixResponse.ok) {
        const remixData = await remixResponse.json()
        setRemixes(remixData.remixes || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setError('Failed to load post data')
    } finally {
      if (showLoader) {
        setIsLoading(false)
      }
    }
  }


  const runOCR = async () => {
    if (!post) return

    // Show confirmation dialog if OCR is already completed
    if (post.ocrStatus === 'completed') {
      if (!confirm('This will re-run OCR processing and replace existing text. Continue?')) {
        return
      }
    }

    setIsRunningOCR(true)
    try {
      const response = await fetch(`/api/tiktok/posts/${post.id}/ocr`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('OCR processing failed')
      }

      // Refresh the post data to get updated OCR status (no full screen loader)
      await fetchPostAndRemixes(false)
      toast.success('OCR processing completed')
    } catch (error) {
      console.error('OCR failed:', error)
      setError('Failed to run OCR processing')
      toast.error('Failed to run OCR processing')
    } finally {
      setIsRunningOCR(false)
    }
  }

  const handleRemixCreated = async () => {
    // Refresh data (no full screen loader)
    await fetchPostAndRemixes(false)
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

      // Optimistically update UI
      setRemixes(prevRemixes => prevRemixes.filter(r => r.id !== remixId))
      toast.success('Remix deleted successfully')
    } catch (error) {
      console.error('Failed to delete remix:', error)
      const errorMessage = 'Failed to delete remix'
      setError(errorMessage)
      toast.error(errorMessage)
      // Refresh on error to restore state
      await fetchPostAndRemixes(false)
    }
  }

  const toggleBookmark = async (remixId: string) => {
    try {
      const response = await fetch(`/api/remixes/${remixId}/bookmark`, {
        method: 'PATCH'
      })

      if (!response.ok) {
        throw new Error('Failed to toggle bookmark')
      }

      const data = await response.json()

      // Optimistically update UI
      setRemixes(prevRemixes =>
        prevRemixes.map(r =>
          r.id === remixId ? { ...r, bookmarked: data.bookmarked } : r
        )
      )
      toast.success(data.bookmarked ? 'Bookmarked' : 'Bookmark removed')
    } catch (error) {
      console.error('Failed to toggle bookmark:', error)
      toast.error('Failed to toggle bookmark')
      // Refresh on error to restore state
      await fetchPostAndRemixes(false)
    }
  }

  const updateSlideText = async (
    remixId: string,
    slideIndex: number,
    field: 'paraphrasedText',
    newValue: string
  ) => {
    try {
      // Find the remix in the current state
      const remix = remixes.find(r => r.id === remixId)
      if (!remix) {
        throw new Error('Remix not found')
      }

      // Update the specific slide field
      const updatedSlides = remix.slides.map((slide, index) => {
        if (index === slideIndex) {
          return {
            ...slide,
            [field]: newValue
          }
        }
        return slide
      })

      // Send the update to the API
      const response = await fetch(`/api/remixes/${remixId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slides: updatedSlides
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update slide')
      }

      // Update local state
      setRemixes(prevRemixes =>
        prevRemixes.map(r =>
          r.id === remixId
            ? { ...r, slides: updatedSlides }
            : r
        )
      )

      toast.success('Saved successfully')
    } catch (error) {
      console.error('Failed to update slide:', error)
      throw error // Re-throw to be handled by InlineEditableText
    }
  }

  const downloadRemix = async (remixId: string) => {
    try {
      console.log(`📦 Starting download for remix: ${remixId}`)

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

      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `remix-${remixId}-export.zip`

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      window.URL.revokeObjectURL(url)

      console.log(`✅ Download completed for remix: ${remixId}`)
    } catch (error) {
      console.error('Failed to download remix:', error)
      setError('Failed to download remix')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span>Loading remix studio...</span>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'Post not found'}</p>
          <Button onClick={() => router.push('/')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Posts
          </Button>
        </div>
      </div>
    )
  }

  const getOCRStatusIcon = () => {
    switch (post.ocrStatus) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const canCreateRemix = post.contentType === 'photo' && post.ocrStatus === 'completed'

  // Organize slides by post (original + each remix gets its own row)
  const originalSlides = post.contentType === 'photo' && post.images ? post.images.map((image, index) => {
    const ocrTexts = typeof post.ocrTexts === 'string'
      ? JSON.parse(post.ocrTexts || '[]')
      : post.ocrTexts || []
    const ocrResult = Array.isArray(ocrTexts)
      ? ocrTexts.find(ocr => ocr.imageIndex === index)
      : null
    return {
      type: 'original',
      postId: post.id,
      postName: 'Original',
      slideIndex: index,
      image: image,
      text: ocrResult?.success ? ocrResult.text : 'No text',
      slideNumber: index + 1
    }
  }) : []

  const remixRows = remixes.map(remix => ({
    remix,
    slides: (Array.isArray(remix.slides) ? remix.slides : []).map((slide, index) => ({
      type: 'remix',
      postId: remix.id,
      postName: remix.name,
      slideIndex: index,
      slide: slide,
      text: slide.paraphrasedText,
      slideNumber: index + 1
    }))
  }))

  const maxSlidesCount = Math.max(
    originalSlides.length,
    ...remixRows.map(row => row.slides.length),
    1
  )

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
              Back to Posts
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">
                Remix Studio
              </h1>
              <p className="text-sm text-muted-foreground">
                Create variations of "{post.authorNickname || post.authorHandle}"'s content
              </p>
            </div>
            <div className="flex items-center gap-2">
              {post.contentType === 'photo' && (
                <>
                  <Button
                    onClick={runOCR}
                    disabled={isRunningOCR || post.ocrStatus === 'processing'}
                    variant="outline"
                    size="sm"
                  >
                    {getOCRStatusIcon()}
                    <span className="ml-2">
                      {post.ocrStatus === 'completed' ? 'Redo OCR' :
                       post.ocrStatus === 'processing' ? 'Processing...' :
                       isRunningOCR ? 'Running OCR...' : 'Run OCR'}
                    </span>
                  </Button>
                  <Button
                    onClick={() => setIsRemixDialogOpen(true)}
                    disabled={!canCreateRemix}
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Remix
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container with proper scrolling */}
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="flex-1 overflow-auto">
          <div style={{ width: `max(calc(100vw - 16rem), ${80 + (maxSlidesCount * 72) + 48}px)` }}>

            {/* Header Row with Slide Numbers and Actions */}
            <div className="flex border-b bg-background sticky top-0 z-20">
              {/* Post Information Column Header */}
              <div className="w-80 border-r bg-foreground-primary p-4 flex-shrink-0 sticky left-0 bg-background z-10">
                <h3 className="font-semibold text-sm">Posts & Remixes</h3>
              </div>

              {/* Slides Header Columns */}
              <div className="flex">
                {Array.from({ length: maxSlidesCount }).map((_, index) => (
                  <div key={index} className="w-72 border-r p-4 text-center">
                    <p className="text-sm font-medium">Slide {index + 1}</p>
                  </div>
                ))}
              </div>

              {/* Actions Column */}
              <div className="w-48 p-4 flex-shrink-0 sticky right-0 bg-background z-10 border-l">
                <h3 className="font-semibold text-sm">Actions</h3>
              </div>
            </div>

            {/* Original Post Row */}
            {originalSlides.length > 0 && (
              <div className="flex border-b">
                {/* Post Information Column */}
                <div className="w-80 border-r p-4 bg-background flex-shrink-0 sticky left-0 z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye className="h-4 w-4 text-blue-500" />
                    <h3 className="font-semibold text-sm">Original Post</h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Author */}
                    <div>
                      <p className="text-muted-foreground">Author</p>
                      <p className="font-medium">{post.authorNickname || post.authorHandle}</p>
                    </div>

                    {/* Badges */}
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={post.contentType === 'photo' ? 'default' : 'secondary'} className="text-xs">
                        {post.contentType}
                      </Badge>
                      <Badge variant={post.ocrStatus === 'completed' ? 'default' :
                                    post.ocrStatus === 'processing' ? 'secondary' : 'outline'} className="text-xs">
                        {post.ocrStatus}
                      </Badge>
                    </div>

                    {/* Caption */}
                    {post.description && (
                      <div>
                        <p className="text-muted-foreground">Caption</p>
                        <p className="text-xs leading-relaxed">{post.description}</p>
                      </div>
                    )}

                    {/* Stats */}
                    <div>
                      <p className="text-muted-foreground">Slides</p>
                      <p className="font-medium">{originalSlides.length} slides</p>
                    </div>

                    {/* TikTok Link */}
                    <div>
                      <a
                        href={post.tiktokUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline text-xs"
                      >
                        View Original on TikTok →
                      </a>
                    </div>
                  </div>
                </div>

                {/* Slide Columns */}
                <div className="flex">
                  {Array.from({ length: maxSlidesCount }).map((_, slideIndex) => {
                    const slide = originalSlides[slideIndex]
                    return (
                      <div key={slideIndex} className="w-72 border-r p-4">
                        {slide ? (
                          <div className="space-y-3">
                            {/* Image */}
                            <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden border">
                              {slide.image.url ? (
                                <img
                                  src={slide.image.url}
                                  alt={`Slide ${slide.slideNumber}`}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                  Image unavailable
                                </div>
                              )}
                            </div>
                            {/* Text Content */}
                            <div className="bg-muted/30 rounded p-2 text-xs">
                              <p className="text-foreground leading-relaxed">
                                {slide.text ? slide.text.substring(0, 150) + (slide.text.length > 150 ? '...' : '') : 'No text available'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                            No slide
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Actions for this row */}
                <div className="w-48 p-4 flex-shrink-0 sticky right-0 bg-background z-10 border-l">
                  <div className="text-xs text-muted-foreground">
                    Original content
                  </div>
                </div>
              </div>
            )}

            {/* Remix Rows */}
            {remixRows.map((remixRow) => (
              <div key={remixRow.remix.id} className="flex border-b">
                {/* Post Name Column */}
                <div className="w-80 border-r p-4 bg-background flex-shrink-0 sticky left-0 z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <h3 className="font-semibold text-sm">{remixRow.remix.name}</h3>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{remixRow.slides.length} slides</p>
                    <p>{new Date(remixRow.remix.createdAt).toLocaleDateString()}</p>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {remixRow.remix.generationType}
                      </Badge>
                      {remixRow.remix.productContext && (
                        <Badge variant="secondary" className="text-xs">
                          {remixRow.remix.productContext.title}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Slide Columns */}
                <div className="flex">
                  {Array.from({ length: maxSlidesCount }).map((_, slideIndex) => {
                    const slide = remixRow.slides[slideIndex]
                    return (
                      <div key={slideIndex} className="w-72 border-r p-4">
                        {slide ? (
                          <div className="space-y-2">
                            <div>
                              <InlineEditableText
                                value={slide.text}
                                onSave={(newValue) =>
                                  updateSlideText(
                                    remixRow.remix.id,
                                    slideIndex,
                                    'paraphrasedText',
                                    newValue
                                  )
                                }
                                placeholder="Enter text content..."
                                rows={4}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                            No slide
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Actions for this row */}
                <div className="w-48 p-4 flex-shrink-0 sticky right-0 bg-background z-10 border-l">
                  <div className="space-y-2">
                    <Button
                      onClick={() => toggleBookmark(remixRow.remix.id)}
                      size="sm"
                      variant={remixRow.remix.bookmarked ? "default" : "outline"}
                      className="w-full"
                      title={remixRow.remix.bookmarked ? "Remove bookmark" : "Bookmark"}
                    >
                      <Bookmark className={`h-3 w-3 mr-1 ${remixRow.remix.bookmarked ? 'fill-current' : ''}`} />
                      {remixRow.remix.bookmarked ? 'Bookmarked' : 'Bookmark'}
                    </Button>
                    <Button
                      onClick={() => router.push(`/remix/${remixRow.remix.id}/edit`)}
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <div className="flex gap-1">
                      <Button
                        onClick={() => downloadRemix(remixRow.remix.id)}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => deleteRemix(remixRow.remix.id)}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {originalSlides.length === 0 && remixes.length === 0 && (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 opacity-50" />
                  </div>
                  <h3 className="font-medium mb-2">No content yet</h3>
                  <p className="text-sm text-muted-foreground">
                    {!canCreateRemix
                      ? 'Complete OCR processing to create remixes'
                      : 'Create your first remix variation'
                    }
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Create Remix Dialog */}
      <CreateRemixDialog
        open={isRemixDialogOpen}
        onOpenChange={setIsRemixDialogOpen}
        postId={resolvedParams.id}
        onRemixCreated={handleRemixCreated}
      />
    </div>
  )
}