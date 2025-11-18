'use client'

import React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Edit,
  Download,
  Trash2,
  MoreHorizontal,
  FileText
} from 'lucide-react'
import { SlideClassificationBadge } from '@/components/SlideClassificationBadge'
import { RemixSlideTypeDropdown } from '@/components/RemixSlideTypeDropdown'
import { InlineEditableText } from '@/components/InlineEditableText'
import type { RemixPost } from '@/types/remix'

// Extend RemixPost to include additional fields needed for the table
export interface DraftTableRow extends RemixPost {
  _slideColumns: Array<{
    slideIndex: number
    text: string
    classification?: any
  }>
  _rowType?: 'reference' | 'draft'
  _referencePost?: any
}

interface DraftTableColumnsProps {
  onUpdateSlideText: (remixId: string, slideIndex: number, newText: string) => Promise<void>
  onUpdateDescription: (remixId: string, newDescription: string) => Promise<void>
  onDeleteDraft: (draftId: string) => void
  onEditDraft: (draftId: string) => void
  onRefetch: () => void
  onOpenImageGallery?: (images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => void
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

const formatDateTime = (dateString: string): { date: string; time: string } => {
  const date = new Date(dateString)

  // Use user's locale for date formatting (will show in their local timezone)
  const dateStr = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)

  const timeStr = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)

  return { date: dateStr, time: timeStr }
}

export const createDraftTableColumns = ({
  onUpdateSlideText,
  onUpdateDescription,
  onDeleteDraft,
  onEditDraft,
  onRefetch,
  onOpenImageGallery
}: DraftTableColumnsProps): ColumnDef<DraftTableRow>[] => {
  const columns: ColumnDef<DraftTableRow>[] = [
    {
      accessorKey: 'draftInfo',
      header: 'Draft Information',
      size: 280,
      meta: {
        pinned: 'left'
      },
      cell: ({ row }) => {
        const draft = row.original
        const isReference = draft._rowType === 'reference'
        const referencePost = draft._referencePost

        // Reference post rendering
        if (isReference && referencePost) {
          const images = referencePost.images || []
          const maxDisplay = 5
          const displayImages = images.slice(0, maxDisplay)
          const remainingCount = images.length - maxDisplay

          return (
            <div className="flex items-center space-x-3 min-w-[260px]">
              {/* Profile avatar */}
              {referencePost.authorAvatarUrl ? (
                <img
                  src={referencePost.authorAvatarUrl}
                  alt={referencePost.authorHandle || 'Profile'}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-semibold">
                    {referencePost.authorHandle?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}

              {/* Profile info and images */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {referencePost.authorNickname || referencePost.authorHandle || 'Unknown'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  @{referencePost.authorHandle || 'unknown'}
                </p>

                {/* Image thumbnails */}
                {images.length > 0 && (
                  <div className="flex space-x-1 mt-2">
                    {displayImages.map((image: any, index: number) => {
                      const isLast = index === displayImages.length - 1
                      const showOverlay = isLast && remainingCount > 0

                      return (
                        <div key={index} className="relative">
                          <img
                            src={image.url}
                            alt={`Photo ${index + 1}`}
                            className="w-10 aspect-[9/16] rounded object-cover cursor-pointer hover:opacity-80 border"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenImageGallery?.(
                                images.map((img: any) => ({
                                  url: img.url,
                                  width: img.width,
                                  height: img.height
                                })),
                                index
                              )
                            }}
                          />
                          {showOverlay && (
                            <div
                              className="absolute inset-0 bg-black/70 rounded flex items-center justify-center cursor-pointer hover:bg-black/80 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenImageGallery?.(
                                  images.map((img: any) => ({
                                    url: img.url,
                                    width: img.width,
                                    height: img.height
                                  })),
                                  index
                                )
                              }}
                            >
                              <span className="text-white text-xs font-bold">
                                +{remainingCount}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        }

        // Draft rendering (existing logic)
        const { date } = formatDateTime(draft.createdAt)

        return (
          <div className="flex items-center space-x-3 min-w-[260px]">
            {/* Avatar/icon */}
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{draft.name}</p>
              <p className="text-xs text-muted-foreground truncate">{date} • {draft.slides.length} slides</p>
              <div className="flex flex-wrap gap-1 mt-1">
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
        )
      }
    },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 288,
      cell: ({ row }) => {
        const draft = row.original
        
        return (
          <div className="min-w-[250px] max-w-[288px]">
            <div className="h-48 overflow-y-auto">
              <InlineEditableText
                value={draft.description || ''}
                onSave={(newValue) =>
                  onUpdateDescription(draft.id, newValue)
                }
                placeholder="Add description..."
                rows={8}
                fixedHeight={true}
                heightClass="h-48"
                className="text-[12px]"
              />
            </div>
          </div>
        )
      }
    },
    {
      accessorKey: 'content',
      header: 'Content',
      cell: ({ row }) => {
        const draft = row.original
        
        return (
          <div className="w-full">
            {draft.slides.length === 0 ? (
              <div className="text-muted-foreground text-sm italic">
                No slides
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {draft.slides.map((slide, index) => {
                  const classification = draft.slideClassifications?.[index]
                  const slideType = classification?.type
                  return (
                    <div key={index} className="flex-shrink-0 w-52 flex flex-col">
                      {/* Slide number badge */}
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className="bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded">
                          Slide {index + 1}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <RemixSlideTypeDropdown
                            remixId={draft.id}
                            slideIndex={index}
                            currentType={slideType as 'hook' | 'content' | 'cta' | null}
                            onUpdate={onRefetch}
                          />
                        </div>
                      </div>
                      {/* Inline editable text - fixed height with scroll */}
                      <div className="h-48 overflow-y-auto">
                        <InlineEditableText
                          value={slide.paraphrasedText}
                          onSave={(newValue) =>
                            onUpdateSlideText(draft.id, index, newValue)
                          }
                          placeholder="Enter text content..."
                          rows={8}
                          fixedHeight={true}
                          heightClass="h-48"
                          className="text-[12px]"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      }
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 80,
      meta: {
        pinned: 'right'
      },
      cell: ({ row }) => {
        const draft = row.original
        const isReference = draft._rowType === 'reference'

        // Don't show actions for reference posts
        if (isReference) {
          return null
        }

        return (
          <div className="flex items-center justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 p-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditDraft(draft.id)
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Draft
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    // TODO: Download functionality
                  }}
                  disabled
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteDraft(draft.id)
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Draft
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      }
    }
  ]

  return columns
}
