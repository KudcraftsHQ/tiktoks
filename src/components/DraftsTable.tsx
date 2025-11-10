'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { createDraftTableColumns, DraftTableRow } from '@/components/draft-table-columns'
import {
  Loader2,
  FileText
} from 'lucide-react'
import type { RemixPost } from '@/types/remix'

interface DraftsTableProps {
  drafts: RemixPost[]
  isLoading?: boolean
  onRefetch?: () => void
}

export function DraftsTable({
  drafts,
  isLoading = false,
  onRefetch
}: DraftsTableProps) {
  const router = useRouter()

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

      toast.success('Saved')

      // Trigger refetch if provided
      if (onRefetch) {
        onRefetch()
      }
    } catch (error) {
      console.error('Update failed:', error)
      throw error
    }
  }

  const updateDescription = async (
    remixId: string,
    newDescription: string
  ) => {
    try {
      const response = await fetch(`/api/remixes/${remixId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newDescription })
      })

      if (!response.ok) throw new Error('Failed to update description')

      toast.success('Description saved')

      // Trigger refetch if provided
      if (onRefetch) {
        onRefetch()
      }
    } catch (error) {
      console.error('Failed to update description:', error)
      toast.error('Failed to update description')
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

      toast.success('Draft deleted')

      // Trigger refetch if provided
      if (onRefetch) {
        onRefetch()
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('Failed to delete draft')
    }
  }

  const editDraft = (draftId: string) => {
    router.push(`/remix/${draftId}/edit`)
  }

  // Transform RemixPost data to DraftTableRow
  const draftsAsTableRows: DraftTableRow[] = useMemo(() => {
    const maxSlides = Math.max(...drafts.map(r => r.slides.length), 0)
    
    return drafts.map(draft => ({
      ...draft,
      _slideColumns: Array.from({ length: maxSlides }, (_, index) => {
        const slide = draft.slides[index]
        const classification = draft.slideClassifications?.[index]
        
        return {
          slideIndex: index,
          text: slide?.paraphrasedText || '',
          classification: classification?.type
        }
      })
    }))
  }, [drafts])

  // Create columns with handlers
  const columns = useMemo(() => {
    return createDraftTableColumns({
      onUpdateSlideText: updateSlideText,
      onUpdateDescription: updateDescription,
      onDeleteDraft: deleteDraft,
      onEditDraft: editDraft,
      onRefetch: onRefetch || (() => {})
    })
  }, [onRefetch, updateSlideText, updateDescription, deleteDraft, editDraft])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (drafts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-center">
        <div>
          <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 opacity-50" />
          </div>
          <h3 className="font-medium mb-2">No drafts yet</h3>
          <p className="text-sm text-muted-foreground">
            Generate content from posts to create drafts
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <DataTable
        columns={columns}
        data={draftsAsTableRows}
        getRowId={(draft) => draft.id}
        showPagination={false}
        enableColumnPinning={true}
      />
    </div>
  )
}
