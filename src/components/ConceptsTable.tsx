'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { InlineEditableTitle } from '@/components/InlineEditableTitle'
import { InlineEditableText } from '@/components/InlineEditableText'
import { Textarea } from '@/components/ui/textarea'
import { ConceptTypeDropdown } from '@/components/ConceptTypeDropdown'
import { ImageGallery } from '@/components/ImageGallery'
import { ColumnDef } from '@tanstack/react-table'
import { Trash2, ToggleLeft, ToggleRight, Plus, Eye, Sparkles, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { getProxiedImageUrlById } from '@/lib/image-proxy'
import { GenerateExampleDialog } from '@/components/GenerateExampleDialog'

interface SourcePost {
  id: string
  viewCount: number | null
  images: any // JSON field
}

export interface ConceptExample {
  id: string
  text: string
  sourceType: string
  sourcePostId: string | null
  sourceSlideIndex: number | null
  createdAt: string
  sourcePost?: SourcePost | null
}

export interface Concept {
  id: string
  title: string
  coreMessage: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
  timesUsed: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  examples: ConceptExample[]
  _count: {
    examples: number
  }
}

interface ConceptsTableProps {
  concepts: Concept[]
  onRefresh: () => void
  onExamplesAdded?: (conceptId: string, examples: ConceptExample[]) => void
  onExampleDeleted?: (conceptId: string, exampleId: string) => void
  isLoading?: boolean
}

// Helper to format view count
const formatViewCount = (count: number | null | undefined): string => {
  if (!count) return '0'
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toString()
}

// Cell component for inline editable title with core message
const ConceptTitleCell = ({
  concept,
  onSave
}: {
  concept: Concept
  onSave: (field: string, value: string) => Promise<void>
}) => {
  return (
    <div className="flex flex-col gap-1 py-2 pl-4">
      <InlineEditableTitle
        value={concept.title}
        onSave={(value) => onSave('title', value)}
        placeholder="Concept title"
        className="text-sm font-medium"
      />
      <InlineEditableText
        value={concept.coreMessage}
        onSave={(value) => onSave('coreMessage', value)}
        placeholder="Core message..."
        className="text-xs text-muted-foreground"
        rows={2}
      />
    </div>
  )
}

// Cell component for examples displayed horizontally like ProjectPostsTable slides
const ExamplesCell = ({
  concept,
  onAddExample,
  onUpdateExample,
  onDeleteExample,
  onOpenGallery,
  onExamplesAdded
}: {
  concept: Concept
  onAddExample: (conceptId: string, text: string) => Promise<void>
  onUpdateExample: (conceptId: string, exampleId: string, text: string) => Promise<void>
  onDeleteExample: (conceptId: string, exampleId: string) => Promise<void>
  onOpenGallery: (images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => void
  onExamplesAdded: (conceptId: string, examples: ConceptExample[]) => void
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [newExampleText, setNewExampleText] = useState('')
  const [editingExampleId, setEditingExampleId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [deleteConfirmExampleId, setDeleteConfirmExampleId] = useState<string | null>(null)

  const handleStartEditing = (example: ConceptExample) => {
    if (example.sourceType !== 'MANUAL') return
    setEditingExampleId(example.id)
    setEditingText(example.text)
  }

  const handleSaveEdit = async () => {
    if (!editingExampleId || !editingText.trim()) return
    try {
      await onUpdateExample(concept.id, editingExampleId, editingText)
      setEditingExampleId(null)
      setEditingText('')
    } catch {
      // Error handled in parent
    }
  }

  const handleCancelEdit = () => {
    setEditingExampleId(null)
    setEditingText('')
  }

  const handleAddExample = async () => {
    if (!newExampleText.trim()) return
    setIsAdding(true)
    try {
      await onAddExample(concept.id, newExampleText)
      setNewExampleText('')
    } finally {
      setIsAdding(false)
    }
  }

  const handleSlideClick = (example: ConceptExample) => {
    if (!example.sourcePost?.images || example.sourceSlideIndex === null) return

    // Parse images from JSON
    let images: Array<{ cacheAssetId?: string; url?: string; width: number; height: number }> = []
    try {
      images = typeof example.sourcePost.images === 'string'
        ? JSON.parse(example.sourcePost.images)
        : example.sourcePost.images || []
    } catch {
      return
    }

    if (!Array.isArray(images) || images.length === 0) return

    // Convert to gallery format with proxied URLs
    const galleryImages = images.map(img => ({
      url: img.cacheAssetId ? getProxiedImageUrlById(img.cacheAssetId) : img.url || '',
      width: img.width || 1080,
      height: img.height || 1920
    }))

    onOpenGallery(galleryImages, example.sourceSlideIndex)
  }

  return (
    <TooltipProvider>
      <div className="flex gap-3 overflow-x-auto pb-2 py-2">
        {/* Existing examples */}
        {concept.examples.map((example) => {
          const isEditing = editingExampleId === example.id
          const isManual = example.sourceType === 'MANUAL'

          return (
            <div key={example.id} className="flex-shrink-0 w-52 flex flex-col">
              {/* Example header - views on left, slide number and delete on right */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {formatViewCount(example.sourcePost?.viewCount)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {example.sourcePostId && example.sourceSlideIndex !== null && (
                    <button
                      onClick={() => handleSlideClick(example)}
                      className="text-[10px] text-primary hover:underline cursor-pointer"
                    >
                      Slide {(example.sourceSlideIndex ?? 0) + 1}
                    </button>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setDeleteConfirmExampleId(example.id)}
                        className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>Delete example</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              {/* Example text */}
              <div className="h-32 overflow-y-auto">
                {isEditing ? (
                  <div className="h-full flex flex-col gap-2">
                    <Textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="flex-1 resize-none text-[12px] leading-tight"
                      autoFocus
                    />
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                        className="h-6 px-2 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={!editingText.trim()}
                        className="h-6 px-2 text-xs"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Textarea
                    value={example.text}
                    readOnly
                    onClick={() => isManual && handleStartEditing(example)}
                    className={`h-full resize-none text-[12px] leading-tight whitespace-pre-wrap break-words overflow-y-auto bg-muted/30 ${
                      isManual ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'
                    }`}
                    style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                  />
                )}
              </div>
            </div>
          )
        })}

        {/* Add New Example - dotted border style like ProjectPostsTable add slide */}
        <div className="flex-shrink-0 w-52 flex flex-col">
          {/* Spacer to align with existing examples header */}
          <div className="flex items-center justify-between mb-2 h-4"></div>
          <div className="h-32">
            {newExampleText || isAdding ? (
              <div className="h-full flex flex-col gap-2">
                <Textarea
                  value={newExampleText}
                  onChange={(e) => setNewExampleText(e.target.value)}
                  placeholder="Add example copy..."
                  className="flex-1 resize-none text-[12px] leading-tight"
                  autoFocus
                />
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setNewExampleText('')}
                    className="h-6 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddExample}
                    disabled={isAdding || !newExampleText.trim()}
                    className="h-6 px-2 text-xs"
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg gap-2 p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs w-full"
                  onClick={() => setNewExampleText(' ')}
                >
                  <Pencil className="h-3 w-3 mr-1.5" />
                  Add Manually
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs w-full"
                  onClick={() => setShowGenerateDialog(true)}
                >
                  <Sparkles className="h-3 w-3 mr-1.5 text-purple-500" />
                  Generate with AI
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Generate Example Dialog */}
      <GenerateExampleDialog
        concept={{
          id: concept.id,
          title: concept.title,
          coreMessage: concept.coreMessage,
          type: concept.type,
          examples: concept.examples.map(ex => ({ id: ex.id, text: ex.text }))
        }}
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        onExamplesAdded={onExamplesAdded}
      />

      {/* Delete Example Confirmation Dialog */}
      <AlertDialog open={deleteConfirmExampleId !== null} onOpenChange={(open) => !open && setDeleteConfirmExampleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Example</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this example? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmExampleId) {
                  onDeleteExample(concept.id, deleteConfirmExampleId)
                  setDeleteConfirmExampleId(null)
                }
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}


// Actions cell component
const ActionsCell = ({
  concept,
  onToggleActive,
  onDelete,
  isDeleting
}: {
  concept: Concept
  onToggleActive: (concept: Concept) => Promise<void>
  onDelete: (id: string) => Promise<void>
  isDeleting: boolean
}) => {
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onToggleActive(concept)}
              className="h-8 w-8"
            >
              {concept.isActive ? (
                <ToggleRight className="h-4 w-4 text-green-600" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-gray-400" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>{concept.isActive ? 'Disable' : 'Enable'}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(concept.id)}
              disabled={isDeleting}
              className="h-8 w-8 text-red-500 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Delete</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}

export function ConceptsTable({ concepts, onRefresh, onExamplesAdded, onExampleDeleted, isLoading }: ConceptsTableProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  // Image gallery state
  const [galleryImages, setGalleryImages] = useState<Array<{ url: string; width: number; height: number }>>([])
  const [showGallery, setShowGallery] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)

  const handleOpenGallery = useCallback((images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => {
    setGalleryImages(images)
    setGalleryInitialIndex(initialIndex)
    setShowGallery(true)
  }, [])

  const handleSaveField = useCallback(async (conceptId: string, field: string, value: string) => {
    try {
      const response = await fetch(`/api/concepts/${conceptId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null })
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success('Concept updated')
      onRefresh()
    } catch (err) {
      toast.error('Failed to update concept')
      throw err
    }
  }, [onRefresh])

  const handleAddExample = useCallback(async (conceptId: string, text: string) => {
    try {
      const response = await fetch(`/api/concepts/${conceptId}/examples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceType: 'MANUAL' })
      })

      if (!response.ok) throw new Error('Failed to add example')

      toast.success('Example added')
      onRefresh()
    } catch (err) {
      toast.error('Failed to add example')
      throw err
    }
  }, [onRefresh])

  const handleUpdateExample = useCallback(async (conceptId: string, exampleId: string, text: string) => {
    try {
      const response = await fetch(`/api/concepts/${conceptId}/examples`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exampleId, text })
      })

      if (!response.ok) throw new Error('Failed to update example')

      toast.success('Example updated')
      onRefresh()
    } catch (err) {
      toast.error('Failed to update example')
      throw err
    }
  }, [onRefresh])

  const handleDeleteExample = useCallback(async (conceptId: string, exampleId: string) => {
    // Optimistically update
    if (onExampleDeleted) {
      onExampleDeleted(conceptId, exampleId)
    }

    try {
      const response = await fetch(`/api/concepts/${conceptId}/examples?exampleId=${exampleId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete example')
      }

      toast.success('Example deleted')
    } catch (err) {
      toast.error('Failed to delete example')
      // Refresh to restore the original state on error
      onRefresh()
    }
  }, [onExampleDeleted, onRefresh])

  const handleToggleActive = useCallback(async (concept: Concept) => {
    try {
      const response = await fetch(`/api/concepts/${concept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !concept.isActive })
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success(`Concept ${concept.isActive ? 'disabled' : 'enabled'}`)
      onRefresh()
    } catch (err) {
      toast.error('Failed to update concept')
    }
  }, [onRefresh])

  const handleDelete = useCallback(async (id: string) => {
    setIsDeleting(id)
    try {
      const response = await fetch(`/api/concepts/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete')

      toast.success('Concept deleted')
      onRefresh()
    } catch (err) {
      toast.error('Failed to delete concept')
    } finally {
      setIsDeleting(null)
    }
  }, [onRefresh])

  const columns: ColumnDef<Concept>[] = useMemo(() => [
    {
      accessorKey: 'title',
      header: 'Concept',
      cell: ({ row }) => (
        <ConceptTitleCell
          concept={row.original}
          onSave={(field, value) => handleSaveField(row.original.id, field, value)}
        />
      ),
      size: 250,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <ConceptTypeDropdown
          conceptId={row.original.id}
          currentType={row.original.type}
          onUpdate={(newType) => handleSaveField(row.original.id, 'type', newType)}
        />
      ),
      size: 100,
    },
    {
      accessorKey: 'examples',
      header: 'Examples',
      cell: ({ row }) => (
        <ExamplesCell
          concept={row.original}
          onAddExample={handleAddExample}
          onUpdateExample={handleUpdateExample}
          onDeleteExample={handleDeleteExample}
          onOpenGallery={handleOpenGallery}
          onExamplesAdded={onExamplesAdded || (() => onRefresh())}
        />
      ),
      size: 600,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <ActionsCell
          concept={row.original}
          onToggleActive={handleToggleActive}
          onDelete={handleDelete}
          isDeleting={isDeleting === row.original.id}
        />
      ),
      size: 50,
    },
  ], [handleSaveField, handleAddExample, handleUpdateExample, handleDeleteExample, handleOpenGallery, handleToggleActive, handleDelete, isDeleting, onRefresh, onExamplesAdded])

  return (
    <>
      <div className="h-full flex flex-col min-h-0 min-w-0">
        <DataTable
          columns={columns}
          data={concepts}
          enableSorting={true}
          enablePagination={true}
          pageSize={25}
          isLoading={isLoading}
          fullWidth={true}
          leftStickyColumnsCount={1}
          rightStickyColumnsCount={1}
          rowClassName={(row) => row.isActive ? '' : 'opacity-50'}
        />
      </div>

      {/* Image Gallery Dialog */}
      <ImageGallery
        images={galleryImages}
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        initialIndex={galleryInitialIndex}
      />
    </>
  )
}
