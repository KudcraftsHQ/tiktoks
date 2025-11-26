'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { InlineEditableTitle } from '@/components/InlineEditableTitle'
import { InlineEditableText } from '@/components/InlineEditableText'
import { Textarea } from '@/components/ui/textarea'
import { ConceptTypeDropdown } from '@/components/ConceptTypeDropdown'
import { ImageGallery } from '@/components/ImageGallery'
import { Trash2, ToggleLeft, ToggleRight, Sparkles, Pencil, Loader2, Copy } from 'lucide-react'
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
import {
  ExampleSelectionProvider,
  useExampleSelection,
  SelectableExampleCard,
  FloatingSelectionBar,
  MoveToConceptDialog,
  NewConceptFromExamplesDialog
} from '@/components/concepts'
import { cn } from '@/lib/utils'

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

// Cell component for examples displayed horizontally with selection support
const ExamplesCell = ({
  concept,
  onAddExample,
  onDeleteExample,
  onOpenGallery,
  onExamplesAdded
}: {
  concept: Concept
  onAddExample: (conceptId: string, text: string) => Promise<void>
  onDeleteExample: (conceptId: string, exampleId: string) => Promise<void>
  onOpenGallery: (images: Array<{ url: string; width: number; height: number }>, initialIndex: number) => void
  onExamplesAdded: (conceptId: string, examples: ConceptExample[]) => void
}) => {
  const [isAdding, setIsAdding] = useState(false)
  const [newExampleText, setNewExampleText] = useState('')
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [deleteConfirmExampleId, setDeleteConfirmExampleId] = useState<string | null>(null)

  const { selectedExamples, selectExample } = useExampleSelection()

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

  const handleSelectExample = (exampleId: string, multiSelect: boolean) => {
    const example = concept.examples.find(e => e.id === exampleId)
    if (!example) return

    selectExample({
      id: exampleId,
      conceptId: concept.id,
      conceptType: concept.type,
      text: example.text
    }, multiSelect)
  }

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-3 pb-2 py-2 max-w-[1100px]">
        {/* Existing examples with selection support */}
        {concept.examples.map((example) => (
          <SelectableExampleCard
            key={example.id}
            example={example}
            conceptId={concept.id}
            isSelected={selectedExamples.has(example.id)}
            onSelect={handleSelectExample}
            onDelete={(exampleId) => setDeleteConfirmExampleId(exampleId)}
            onSlideClick={handleSlideClick}
            formatViewCount={formatViewCount}
          />
        ))}

        {/* Add New Example - dotted border style */}
        <div className="flex-shrink-0 w-52 flex flex-col">
          {/* Spacer to align with existing examples header */}
          <div className="flex items-center justify-between mb-2 h-5"></div>
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
  onReclassify,
  isDeleting,
  isReclassifying
}: {
  concept: Concept
  onToggleActive: (concept: Concept) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onReclassify: (conceptId: string) => Promise<void>
  isDeleting: boolean
  isReclassifying: boolean
}) => {
  const [isCopying, setIsCopying] = useState(false)

  const handleCopyToClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsCopying(true)

    try {
      const sections: string[] = []

      // Concept header as H1
      sections.push(`# ${concept.title}`)
      sections.push('')

      // Core message as blockquote
      if (concept.coreMessage) {
        sections.push(`> ${concept.coreMessage}`)
        sections.push('')
      }

      // Type badge
      sections.push(`**Type:** ${concept.type}`)
      sections.push('')

      // Examples section
      if (concept.examples && concept.examples.length > 0) {
        sections.push('## Examples')
        sections.push('')

        concept.examples.forEach((example, index) => {
          // Example header with slide number and view count if available
          let exampleHeader = `### Example ${index + 1}`

          if (example.sourcePost?.viewCount) {
            exampleHeader += ` (${formatViewCount(example.sourcePost.viewCount)} views)`
          }

          sections.push(exampleHeader)
          sections.push('')
          sections.push(example.text)
          sections.push('')
        })
      } else {
        sections.push('_No examples yet_')
        sections.push('')
      }

      const markdownContent = sections.join('\n')

      // Copy to clipboard
      await navigator.clipboard.writeText(markdownContent)

      // Show success toast
      toast.success('Copied to clipboard', {
        description: `${concept.examples.length} example${concept.examples.length !== 1 ? 's' : ''} ready to paste`
      })
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy to clipboard', {
        description: 'Please try again'
      })
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onReclassify(concept.id)}
              disabled={isReclassifying || concept.examples.length === 0}
              className="h-8 w-8"
            >
              {isReclassifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-purple-500" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Reclassify Examples</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyToClipboard}
              disabled={isCopying}
              className="h-8 w-8"
            >
              {isCopying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Copy All Examples</p>
          </TooltipContent>
        </Tooltip>
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

// Inner table component that uses selection context
function ConceptsTableInner({
  concepts,
  onRefresh,
  onExamplesAdded,
  onExampleDeleted,
  isLoading
}: ConceptsTableProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isReclassifying, setIsReclassifying] = useState<string | null>(null)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [showNewConceptDialog, setShowNewConceptDialog] = useState(false)

  const { selectedExamples, clearSelection } = useExampleSelection()

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

  const handleReclassify = useCallback(async (conceptId: string) => {
    setIsReclassifying(conceptId)

    try {
      const response = await fetch(`/api/concepts/${conceptId}/reclassify`, {
        method: 'POST'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reclassify')
      }

      const result = await response.json()

      // Show toast based on results
      if (result.summary.examplesMoved > 0) {
        toast.success('Reclassification complete', {
          description: `Moved ${result.summary.examplesMoved} example${result.summary.examplesMoved > 1 ? 's' : ''} to ${result.summary.conceptsAffected.length} concept${result.summary.conceptsAffected.length > 1 ? 's' : ''}. ${result.summary.examplesKept} kept in current concept.`
        })
      } else {
        toast.success('Reclassification complete', {
          description: 'All examples remain in current concept (best fit).'
        })
      }

      // Show warning if concept is now empty
      if (result.warnings?.includes('empty')) {
        toast.warning('Concept is now empty', {
          description: 'All examples were moved. Consider deleting or adding new examples.'
        })
      }

      // Refresh table
      onRefresh()
    } catch (err) {
      toast.error('Failed to reclassify', {
        description: err instanceof Error ? err.message : 'Please try again'
      })
    } finally {
      setIsReclassifying(null)
    }
  }, [onRefresh])

  // Move examples to existing concept
  const handleMoveToExisting = useCallback(async (targetConceptId: string) => {
    const exampleIds = Array.from(selectedExamples.keys())

    try {
      const response = await fetch('/api/concepts/examples/move', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exampleIds, targetConceptId })
      })

      if (!response.ok) throw new Error('Failed to move examples')

      toast.success(`Moved ${exampleIds.length} example${exampleIds.length > 1 ? 's' : ''}`)
      clearSelection()
      onRefresh()
    } catch (err) {
      toast.error('Failed to move examples')
    }
  }, [selectedExamples, clearSelection, onRefresh])

  // Create new concept with selected examples
  const handleCreateNewConcept = useCallback(async (data: {
    title?: string
    coreMessage?: string
    type: 'HOOK' | 'CONTENT' | 'CTA'
    autoGenerate: boolean
  }) => {
    const exampleIds = Array.from(selectedExamples.keys())

    try {
      const response = await fetch('/api/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data.title,
          coreMessage: data.coreMessage,
          type: data.type,
          exampleIds,
          autoGenerate: data.autoGenerate
        })
      })

      if (!response.ok) throw new Error('Failed to create concept')

      toast.success('New concept created')
      clearSelection()
      onRefresh()
    } catch (err) {
      toast.error('Failed to create concept')
    }
  }, [selectedExamples, clearSelection, onRefresh])

  // Get exclude concept IDs (concepts that already contain selected examples)
  const excludeConceptIds = Array.from(new Set(
    Array.from(selectedExamples.values()).map(e => e.conceptId)
  ))

  // Get default type from first selected example
  const defaultType = selectedExamples.size > 0
    ? selectedExamples.values().next().value?.conceptType || 'CONTENT'
    : 'CONTENT'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="h-full flex flex-col min-h-0 min-w-0">
        {/* Table Header - Fixed */}
        <div className="flex items-center border-b bg-muted/50 flex-shrink-0">
          <div className="w-[250px] flex-shrink-0 px-4 py-3 text-sm font-medium text-muted-foreground">
            CONCEPT
          </div>
          <div className="w-[100px] flex-shrink-0 px-4 py-3 text-sm font-medium text-muted-foreground">
            TYPE
          </div>
          <div className="flex-1 px-4 py-3 text-sm font-medium text-muted-foreground">
            EXAMPLES
          </div>
          <div className="w-[60px] flex-shrink-0 px-4 py-3 text-sm font-medium text-muted-foreground">
          </div>
        </div>

        {/* Table Body - Scrollable */}
        <div className="flex-1 min-h-0 overflow-auto">
          {concepts.map((concept) => (
            <div
              key={concept.id}
              className={cn(
                'flex items-stretch border-b transition-opacity',
                !concept.isActive && 'opacity-50'
              )}
            >
              {/* Title column */}
              <div className="w-[250px] flex-shrink-0 border-r bg-background sticky left-0 z-[5]">
                <ConceptTitleCell
                  concept={concept}
                  onSave={(field, value) => handleSaveField(concept.id, field, value)}
                />
              </div>

              {/* Type column */}
              <div className="w-[100px] flex-shrink-0 px-4 py-3 flex items-center">
                <ConceptTypeDropdown
                  conceptId={concept.id}
                  currentType={concept.type}
                  onUpdate={(newType) => handleSaveField(concept.id, 'type', newType)}
                />
              </div>

              {/* Examples column */}
              <div className="flex-1 px-4">
                <ExamplesCell
                  concept={concept}
                  onAddExample={handleAddExample}
                  onDeleteExample={handleDeleteExample}
                  onOpenGallery={handleOpenGallery}
                  onExamplesAdded={onExamplesAdded || (() => onRefresh())}
                />
              </div>

              {/* Actions column */}
              <div className="w-[60px] flex-shrink-0 px-2 py-3 flex items-start justify-center bg-background">
                <ActionsCell
                  concept={concept}
                  onToggleActive={handleToggleActive}
                  onDelete={handleDelete}
                  onReclassify={handleReclassify}
                  isDeleting={isDeleting === concept.id}
                  isReclassifying={isReclassifying === concept.id}
                />
              </div>
            </div>
          ))}

          {/* Empty state */}
          {concepts.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              No concepts found
            </div>
          )}
        </div>
      </div>

      {/* Image Gallery Dialog */}
      <ImageGallery
        images={galleryImages}
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
        initialIndex={galleryInitialIndex}
      />

      {/* Floating Selection Bar */}
      <FloatingSelectionBar
        selectedCount={selectedExamples.size}
        onClearSelection={clearSelection}
        onMoveToExisting={() => setShowMoveDialog(true)}
        onMoveToNew={() => setShowNewConceptDialog(true)}
      />

      {/* Move to Existing Concept Dialog */}
      <MoveToConceptDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        concepts={concepts.map(c => ({
          id: c.id,
          title: c.title,
          coreMessage: c.coreMessage,
          type: c.type
        }))}
        selectedCount={selectedExamples.size}
        excludeConceptIds={excludeConceptIds}
        onConfirm={handleMoveToExisting}
      />

      {/* Create New Concept Dialog */}
      <NewConceptFromExamplesDialog
        open={showNewConceptDialog}
        onOpenChange={setShowNewConceptDialog}
        selectedCount={selectedExamples.size}
        defaultType={defaultType}
        onConfirm={handleCreateNewConcept}
      />
    </>
  )
}

export function ConceptsTable({
  concepts,
  onRefresh,
  onExamplesAdded,
  onExampleDeleted,
  isLoading
}: ConceptsTableProps) {
  return (
    <ExampleSelectionProvider>
      <ConceptsTableInner
        concepts={concepts}
        onRefresh={onRefresh}
        onExamplesAdded={onExamplesAdded}
        onExampleDeleted={onExampleDeleted}
        isLoading={isLoading}
      />
    </ExampleSelectionProvider>
  )
}
