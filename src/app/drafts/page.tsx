'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { InlineEditableText } from '@/components/InlineEditableText'
import { SlideClassificationBadge } from '@/components/SlideClassificationBadge'
import {
  ArrowLeft,
  Edit,
  Download,
  Trash2,
  Search,
  Loader2,
  FileText
} from 'lucide-react'
import { toast } from 'sonner'
import { PageLayout } from '@/components/PageLayout'
import type { RemixPost } from '@/types/remix'

export default function DraftsPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<RemixPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [generationTypeFilter, setGenerationTypeFilter] = useState<string>('all')

  useEffect(() => {
    fetchDrafts()
  }, [generationTypeFilter])

  const fetchDrafts = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '100'
      })

      if (generationTypeFilter !== 'all') {
        params.append('generationType', generationTypeFilter)
      }

      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/remixes/drafts?${params}`)
      if (!response.ok) throw new Error('Failed to fetch drafts')

      const data = await response.json()
      setDrafts(data.remixes || [])
    } catch (error) {
      console.error('Failed to fetch drafts:', error)
      toast.error('Failed to load drafts')
    } finally {
      setIsLoading(false)
    }
  }

  const updateSlideText = async (
    remixId: string,
    slideIndex: number,
    newValue: string
  ) => {
    try {
      const remix = drafts.find(r => r.id === remixId)
      if (!remix) throw new Error('Remix not found')

      const updatedSlides = remix.slides.map((slide, index) =>
        index === slideIndex
          ? { ...slide, paraphrasedText: newValue }
          : slide
      )

      const response = await fetch(`/api/remixes/${remixId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides: updatedSlides })
      })

      if (!response.ok) throw new Error('Failed to update')

      setDrafts(prev =>
        prev.map(r =>
          r.id === remixId ? { ...r, slides: updatedSlides } : r
        )
      )

      toast.success('Saved')
    } catch (error) {
      console.error('Update failed:', error)
      throw error
    }
  }

  const deleteDraft = async (draftId: string) => {
    if (!confirm('Delete this draft?')) return

    try {
      const response = await fetch(`/api/remixes/${draftId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete')

      setDrafts(prev => prev.filter(r => r.id !== draftId))
      toast.success('Draft deleted')
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete draft')
    }
  }

  const maxSlidesCount = Math.max(
    ...drafts.map(r => r.slides.length),
    1
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
              Back to Posts
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">Draft Posts</h1>
              <p className="text-sm text-muted-foreground">
                {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search drafts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
              <Button onClick={fetchDrafts} size="sm">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-col h-[calc(100vh-80px)]">
        <div className="flex-1 overflow-auto">
          <div style={{ width: `max(calc(100vw - 16rem), ${80 + (maxSlidesCount * 72) + 48}px)` }}>

            {/* Header Row */}
            <div className="flex border-b bg-background sticky top-0 z-20">
              <div className="w-64 border-r bg-foreground-primary p-4 flex-shrink-0 sticky left-0 bg-background z-10">
                <h3 className="font-semibold text-sm">Session</h3>
              </div>
              <div className="w-80 border-r bg-foreground-primary p-4 flex-shrink-0 bg-background z-10">
                <h3 className="font-semibold text-sm">Draft Information</h3>
              </div>
              <div className="flex">
                {Array.from({ length: maxSlidesCount }).map((_, index) => (
                  <div key={index} className="w-72 border-r p-4 text-center">
                    <p className="text-sm font-medium">Slide {index + 1}</p>
                  </div>
                ))}
              </div>
              <div className="w-48 p-4 flex-shrink-0 sticky right-0 bg-background z-10 border-l">
                <h3 className="font-semibold text-sm">Actions</h3>
              </div>
            </div>

            {/* Draft Rows */}
            {drafts.map((draft) => (
              <div key={draft.id} className="flex border-b">
                {/* Session Column */}
                <div className="w-64 border-r p-4 bg-background flex-shrink-0 sticky left-0 z-10">
                  {draft.session ? (
                    <Button
                      variant="link"
                      onClick={() => router.push(`/drafts/${draft.session?.id}`)}
                      className="p-0 h-auto font-normal text-sm hover:underline"
                    >
                      {draft.session.name}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">No session</span>
                  )}
                </div>

                {/* Draft Info Column */}
                <div className="w-80 border-r p-4 bg-background flex-shrink-0 z-10">
                  <h3 className="font-semibold text-sm mb-2">{draft.name}</h3>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{draft.slides.length} slides</p>
                    <p>{new Date(draft.createdAt).toLocaleDateString()}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {draft.generationType}
                      </Badge>
                      {draft.productContext && (
                        <Badge variant="secondary" className="text-xs">
                          {draft.productContext.title}
                        </Badge>
                      )}
                      {draft.sourcePostIds.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {draft.sourcePostIds.length} sources
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Slide Columns */}
                <div className="flex">
                  {Array.from({ length: maxSlidesCount }).map((_, slideIndex) => {
                    const slide = draft.slides[slideIndex]
                    const classification = draft.slideClassifications?.[slideIndex]

                    return (
                      <div key={slideIndex} className="w-72 border-r p-4">
                        {slide ? (
                          <div className="space-y-2">
                            {classification && (
                              <SlideClassificationBadge
                                type={classification.type as any}
                                categoryName={classification.categoryName}
                              />
                            )}
                            <InlineEditableText
                              value={slide.paraphrasedText}
                              onSave={(newValue) =>
                                updateSlideText(draft.id, slideIndex, newValue)
                              }
                              placeholder="Enter text content..."
                              rows={4}
                            />
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

                {/* Actions Column */}
                <div className="w-48 p-4 flex-shrink-0 sticky right-0 bg-background z-10 border-l">
                  <div className="space-y-2">
                    <Button
                      onClick={() => router.push(`/remix/${draft.id}/edit`)}
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                    <div className="flex gap-1">
                      <Button
                        onClick={() => {/* TODO: Download */}}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        title="Download"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => deleteDraft(draft.id)}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {drafts.length === 0 && (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <FileText className="h-8 w-8 opacity-50" />
                  </div>
                  <h3 className="font-medium mb-2">No drafts yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Generate content from posts to create drafts
                  </p>
                  <Button
                    onClick={() => router.push('/')}
                    variant="outline"
                    className="mt-4"
                  >
                    Go to Posts
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
