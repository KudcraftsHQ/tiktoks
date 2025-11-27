'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
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
import {
  Folder,
  FolderPlus,
  ImageIcon,
  Trash2,
  Upload,
  ChevronRight,
  Check,
  Loader2,
  Search,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react'
import type { RemixSlideType } from '@/lib/validations/remix-schema'
import { getProxiedImageUrlById } from '@/lib/image-proxy'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface AssetItem {
  id: string
  cacheAssetId: string
  name: string | null
  width: number | null
  height: number | null
  url: string
  folderId: string | null
  hasFace?: boolean | null
}

export type FaceFilter = 'all' | 'with-face' | 'no-face'

interface AssetFolder {
  id: string
  name: string
  _count: { assets: number }
}

// Slide assignment for slideMode
export interface SlideAssignment {
  slideIndex: number
  asset: AssetItem | null
}

// Slide mode configuration
export interface SlideMode {
  slides: RemixSlideType[]
  initialActiveSlideIndex?: number
}

interface AssetPickerProps {
  open: boolean
  onClose: () => void
  onSelect?: (asset: AssetItem) => void
  onSelectMultiple?: (assets: AssetItem[]) => void
  // New: For slide-aware assignment mode
  onSlideAssignments?: (assignments: SlideAssignment[]) => void
  title?: string
  description?: string
  multiSelect?: boolean
  maxSelections?: number
  // New: Slide mode for draft image assignment
  slideMode?: SlideMode
}

export function AssetPicker({
  open,
  onClose,
  onSelect,
  onSelectMultiple,
  onSlideAssignments,
  title = 'Choose Background Image',
  description = 'Select an image from your assets or upload new ones',
  multiSelect = false,
  maxSelections,
  slideMode
}: AssetPickerProps) {
  const [folders, setFolders] = useState<AssetFolder[]>([])
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: 'folder' | 'asset'; id: string } | null>(null)
  const [draggedAsset, setDraggedAsset] = useState<string | null>(null)
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  // Multi-select: ordered array of selected assets
  const [selectedAssets, setSelectedAssets] = useState<AssetItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [faceFilter, setFaceFilter] = useState<FaceFilter>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Slide mode state: Map of slideIndex -> AssetItem (or null for cleared)
  const [slideAssignments, setSlideAssignments] = useState<Map<number, AssetItem | null>>(new Map())
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery('')
      setFaceFilter('all')
      setSelectedAssetId(null)
      setSelectedAssets([])

      // Initialize slide mode state
      if (slideMode) {
        setSlideAssignments(new Map())
        // Set active slide to initialActiveSlideIndex or first slide without background
        const initialActive = slideMode.initialActiveSlideIndex ??
          slideMode.slides.findIndex(slide => {
            const hasImage = slide.backgroundLayers?.some(
              layer => layer.type === 'image' && layer.cacheAssetId
            )
            return !hasImage
          })
        setActiveSlideIndex(initialActive >= 0 ? initialActive : 0)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slideMode?.initialActiveSlideIndex])

  // Fetch assets when folder or face filter changes
  useEffect(() => {
    if (open) {
      fetchFolders()
      fetchAssets()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentFolderId, faceFilter])

  // Handle paste from clipboard
  useEffect(() => {
    if (!open) return

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) files.push(file)
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        const fileList = new DataTransfer()
        files.forEach(file => fileList.items.add(file))
        await handleFileUpload(fileList.files)
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [open, currentFolderId])

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/assets/folders')
      if (response.ok) {
        const data = await response.json()
        setFolders(data)
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    }
  }

  const fetchAssets = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (currentFolderId) {
        params.append('folderId', currentFolderId)
      } else {
        params.append('folderId', 'null')
      }

      // Add face filter if not 'all'
      if (faceFilter === 'with-face') {
        params.append('hasFace', 'true')
      } else if (faceFilter === 'no-face') {
        params.append('hasFace', 'false')
      }

      const response = await fetch(`/api/assets?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAssets(data)
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    try {
      const response = await fetch('/api/assets/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Folder' })
      })

      if (response.ok) {
        const newFolder = await response.json()
        setFolders([...folders, newFolder])
        setEditingFolderId(newFolder.id)
        setEditingFolderName(newFolder.name)
        toast.success('Folder created')
      }
    } catch (error) {
      console.error('Failed to create folder:', error)
      toast.error('Failed to create folder')
    }
  }

  const handleRenameFolder = async () => {
    if (!editingFolderId || !editingFolderName.trim()) return

    try {
      const response = await fetch(`/api/assets/folders/${editingFolderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingFolderName.trim() })
      })

      if (response.ok) {
        const updatedFolder = await response.json()
        setFolders(folders.map(f => f.id === editingFolderId ? updatedFolder : f))
        setEditingFolderId(null)
        setEditingFolderName('')
        toast.success('Folder renamed')
      }
    } catch (error) {
      console.error('Failed to rename folder:', error)
      toast.error('Failed to rename folder')
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const response = await fetch(`/api/assets/folders/${folderId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setFolders(folders.filter(f => f.id !== folderId))
        fetchAssets()
        setShowDeleteDialog(false)
        setItemToDelete(null)
        toast.success('Folder deleted')
      }
    } catch (error) {
      console.error('Failed to delete folder:', error)
      toast.error('Failed to delete folder')
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    try {
      const response = await fetch(`/api/assets/${assetId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAssets(assets.filter(a => a.id !== assetId))
        fetchFolders()
        setShowDeleteDialog(false)
        setItemToDelete(null)
        toast.success('Asset deleted')
      }
    } catch (error) {
      console.error('Failed to delete asset:', error)
      toast.error('Failed to delete asset')
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      Array.from(files).forEach(file => formData.append('files', file))
      if (currentFolderId) {
        formData.append('folderId', currentFolderId)
      }

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      setAssets([...result.assets, ...assets])
      await fetchFolders()
      toast.success(`Uploaded ${files.length} file(s)`)
    } catch (error) {
      console.error('Failed to upload files:', error)
      toast.error('Failed to upload files')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    setDropTargetFolder(null)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }, [currentFolderId])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }, [])

  const handleAssetDragStart = (assetId: string) => {
    setDraggedAsset(assetId)
  }

  const handleAssetDragEnd = () => {
    setDraggedAsset(null)
    setDropTargetFolder(null)
  }

  const handleFolderDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTargetFolder(null)

    if (!draggedAsset) return

    try {
      const response = await fetch(`/api/assets/${draggedAsset}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId: targetFolderId })
      })

      if (response.ok) {
        setAssets(assets.filter(a => a.id !== draggedAsset))
        await fetchFolders()
        toast.success('Moved to folder')
      }
    } catch (error) {
      console.error('Failed to move asset:', error)
      toast.error('Failed to move asset')
    }

    setDraggedAsset(null)
  }

  const handleSelect = () => {
    // Handle slide mode
    if (slideMode && onSlideAssignments) {
      const assignments: SlideAssignment[] = []
      for (const [slideIndex, asset] of slideAssignments.entries()) {
        assignments.push({ slideIndex, asset })
      }
      if (assignments.length > 0) {
        onSlideAssignments(assignments)
        onClose()
      }
      return
    }

    if (multiSelect) {
      if (selectedAssets.length > 0 && onSelectMultiple) {
        onSelectMultiple(selectedAssets)
        onClose()
      }
    } else {
      const selected = assets.find(a => a.id === selectedAssetId)
      if (selected && onSelect) {
        onSelect(selected)
        onClose()
      }
    }
  }

  // Handle clicking on an asset
  const handleAssetClick = (asset: AssetItem) => {
    // Slide mode takes priority
    if (slideMode) {
      handleSlideAssetClick(asset)
      return
    }

    if (multiSelect) {
      const existingIndex = selectedAssets.findIndex(a => a.id === asset.id)
      if (existingIndex !== -1) {
        // Deselect: remove from array
        setSelectedAssets(selectedAssets.filter(a => a.id !== asset.id))
      } else {
        // Select: add to array (if under max limit)
        if (maxSelections && selectedAssets.length >= maxSelections) {
          toast.error(`Maximum ${maxSelections} images can be selected`)
          return
        }
        setSelectedAssets([...selectedAssets, asset])
      }
    } else {
      setSelectedAssetId(asset.id)
    }
  }

  // Get selection index for multi-select mode (1-based for display)
  const getSelectionIndex = (assetId: string): number => {
    return selectedAssets.findIndex(a => a.id === assetId) + 1
  }

  // Move selected asset up in order
  const moveSelectionUp = (index: number) => {
    if (index <= 0) return
    const newSelected = [...selectedAssets]
    const temp = newSelected[index - 1]
    newSelected[index - 1] = newSelected[index]
    newSelected[index] = temp
    setSelectedAssets(newSelected)
  }

  // Move selected asset down in order
  const moveSelectionDown = (index: number) => {
    if (index >= selectedAssets.length - 1) return
    const newSelected = [...selectedAssets]
    const temp = newSelected[index + 1]
    newSelected[index + 1] = newSelected[index]
    newSelected[index] = temp
    setSelectedAssets(newSelected)
  }

  // Remove from selection
  const removeFromSelection = (assetId: string) => {
    setSelectedAssets(selectedAssets.filter(a => a.id !== assetId))
  }

  // ========== SLIDE MODE FUNCTIONS ==========

  // Check if a slide has a background image (either existing or pending assignment)
  const slideHasImage = (slideIndex: number): boolean => {
    // Check pending assignments first
    if (slideAssignments.has(slideIndex)) {
      return slideAssignments.get(slideIndex) !== null
    }
    // Check existing background
    if (slideMode) {
      const slide = slideMode.slides[slideIndex]
      return slide?.backgroundLayers?.some(
        layer => layer.type === 'image' && layer.cacheAssetId
      ) || false
    }
    return false
  }

  // Get the assigned asset for a slide (pending assignment takes precedence)
  const getSlideAssignment = (slideIndex: number): AssetItem | null => {
    if (slideAssignments.has(slideIndex)) {
      return slideAssignments.get(slideIndex) || null
    }
    return null
  }

  // Get which slide index an asset is assigned to (returns -1 if not assigned)
  // Checks both pending assignments AND existing slide backgrounds
  const getAssetSlideIndex = (assetId: string, cacheAssetId?: string): number => {
    // First check pending assignments
    for (const [slideIndex, asset] of slideAssignments.entries()) {
      if (asset?.id === assetId) {
        return slideIndex
      }
    }

    // Then check existing slide backgrounds (if not cleared)
    if (slideMode && cacheAssetId) {
      for (let i = 0; i < slideMode.slides.length; i++) {
        // Skip if this slide has a pending assignment (either new image or cleared)
        if (slideAssignments.has(i)) continue

        const slide = slideMode.slides[i]
        const existingImageLayer = slide.backgroundLayers?.find(
          layer => layer.type === 'image' && layer.cacheAssetId
        )
        if (existingImageLayer?.cacheAssetId === cacheAssetId) {
          return i
        }
      }
    }

    return -1
  }

  // Find the next empty slide index starting from a given index
  const findNextEmptySlide = (startIndex: number): number => {
    if (!slideMode) return 0
    const slideCount = slideMode.slides.length

    // Search from startIndex to end
    for (let i = startIndex; i < slideCount; i++) {
      if (!slideHasImage(i)) return i
    }
    // Search from beginning to startIndex
    for (let i = 0; i < startIndex; i++) {
      if (!slideHasImage(i)) return i
    }
    // All slides have images, return current
    return startIndex
  }

  // Assign an asset to a slide
  const assignAssetToSlide = (asset: AssetItem, slideIndex: number) => {
    const newAssignments = new Map(slideAssignments)

    // Remove this asset from any other pending assignment first (1:1 mapping)
    for (const [idx, assignedAsset] of newAssignments.entries()) {
      if (assignedAsset?.id === asset.id) {
        newAssignments.delete(idx)
      }
    }

    // Also check if this asset is already used in an existing slide background
    // If so, we need to clear that slide
    if (slideMode && asset.cacheAssetId) {
      for (let i = 0; i < slideMode.slides.length; i++) {
        if (i === slideIndex) continue // Skip the target slide
        if (newAssignments.has(i)) continue // Already handled by pending assignments

        const slide = slideMode.slides[i]
        const existingImageLayer = slide.backgroundLayers?.find(
          layer => layer.type === 'image' && layer.cacheAssetId
        )
        if (existingImageLayer?.cacheAssetId === asset.cacheAssetId) {
          // Clear the existing slide that has this asset
          newAssignments.set(i, null)
          break // Asset can only be in one slide
        }
      }
    }

    // Assign to new slide
    newAssignments.set(slideIndex, asset)
    setSlideAssignments(newAssignments)

    // Auto-advance to next empty slide
    const nextEmpty = findNextEmptySlide(slideIndex + 1)
    setActiveSlideIndex(nextEmpty)
  }

  // Clear a slide assignment
  const clearSlideAssignment = (slideIndex: number) => {
    const newAssignments = new Map(slideAssignments)
    // Set to null to indicate "clear existing"
    newAssignments.set(slideIndex, null)
    setSlideAssignments(newAssignments)

    // Make this slide active since it's now empty
    setActiveSlideIndex(slideIndex)
  }

  // Handle asset click in slide mode
  const handleSlideAssetClick = (asset: AssetItem) => {
    const existingSlideIndex = getAssetSlideIndex(asset.id, asset.cacheAssetId)

    if (existingSlideIndex !== -1) {
      // Already assigned - remove it (or clear if it's an existing background)
      const newAssignments = new Map(slideAssignments)
      // Check if this is an existing background (not a pending assignment)
      const isPendingAssignment = slideAssignments.has(existingSlideIndex) && slideAssignments.get(existingSlideIndex)?.id === asset.id
      if (isPendingAssignment) {
        // Remove pending assignment
        newAssignments.delete(existingSlideIndex)
      } else {
        // Clear existing background
        newAssignments.set(existingSlideIndex, null)
      }
      setSlideAssignments(newAssignments)
    } else {
      // Assign to active slide
      assignAssetToSlide(asset, activeSlideIndex)
    }
  }

  const currentFolder = folders.find(f => f.id === currentFolderId)

  const filteredAssets = assets.filter(asset => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return asset.name?.toLowerCase().includes(query)
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[85vh] p-0 gap-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm text-muted-foreground pt-2">
              <button
                onClick={() => setCurrentFolderId(null)}
                className="hover:text-foreground"
              >
                All Assets
              </button>
              {currentFolder && (
                <>
                  <ChevronRight className="h-4 w-4" />
                  <span>{currentFolder.name}</span>
                </>
              )}
            </div>
          </DialogHeader>

          {/* Toolbar */}
          <div className="px-6 py-3 border-b flex-shrink-0 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Face Filter */}
            <div className="flex items-center border rounded-md">
              <button
                onClick={() => setFaceFilter('all')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  faceFilter === 'all'
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                All
              </button>
              <button
                onClick={() => setFaceFilter('with-face')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors border-l",
                  faceFilter === 'with-face'
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                With Face
              </button>
              <button
                onClick={() => setFaceFilter('no-face')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors border-l",
                  faceFilter === 'no-face'
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                No Face
              </button>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              size="sm"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Slide Preview Panel - Only shown in slide mode */}
          {slideMode && (
            <div className="px-6 py-3 border-b bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">Slide Assignment</span>
                <span className="text-xs text-muted-foreground">
                  (click a slide to target it, then pick an image)
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {slideMode.slides.map((slide, index) => {
                  const isActive = activeSlideIndex === index
                  const pendingAsset = getSlideAssignment(index)

                  // Find existing image layer and get URL from cacheAssetId
                  const existingImageLayer = slide.backgroundLayers?.find(
                    layer => layer.type === 'image' && layer.cacheAssetId
                  )
                  const hasExistingImage = !!existingImageLayer
                  const existingImageUrl = existingImageLayer?.cacheAssetId
                    ? getProxiedImageUrlById(existingImageLayer.cacheAssetId)
                    : null

                  const isCleared = slideAssignments.has(index) && slideAssignments.get(index) === null

                  // Determine what to show
                  let showImage: string | null = null

                  if (pendingAsset) {
                    // Show pending assignment
                    showImage = pendingAsset.url
                  } else if (isCleared) {
                    // Explicitly cleared - show empty
                    showImage = null
                  } else if (hasExistingImage && existingImageUrl) {
                    // Show existing background
                    showImage = existingImageUrl
                  }

                  return (
                    <div
                      key={slide.id || index}
                      className="relative flex-shrink-0 group"
                    >
                      <button
                        onClick={() => setActiveSlideIndex(index)}
                        className={cn(
                          "w-12 h-16 rounded-md overflow-hidden border-2 transition-all",
                          isActive
                            ? "border-primary ring-2 ring-primary ring-offset-1"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {showImage ? (
                          <img
                            src={showImage}
                            alt={`Slide ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                            <span className="text-[10px] text-muted-foreground">Empty</span>
                          </div>
                        )}
                      </button>

                      {/* Slide number badge */}
                      <div className={cn(
                        "absolute -top-1 -left-1 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-foreground/80 text-background"
                      )}>
                        {index + 1}
                      </div>

                      {/* Clear button - show when has image (pending or existing) */}
                      {(pendingAsset || (hasExistingImage && !isCleared)) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            clearSlideAssignment(index)
                          }}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}

                      {/* Pending indicator */}
                      {pendingAsset && (
                        <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-[8px] text-center py-0.5">
                          New
                        </div>
                      )}

                      {/* Cleared indicator */}
                      {isCleared && hasExistingImage && (
                        <div className="absolute bottom-0 left-0 right-0 bg-destructive/90 text-destructive-foreground text-[8px] text-center py-0.5">
                          Clear
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Asset Grid - Scrollable */}
          <div
            className={cn(
              "flex-1 overflow-y-auto px-6 py-4 min-h-0",
              isDraggingOver && "bg-primary/5"
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {/* Show folders only in root view */}
                {!currentFolderId && folders.map((folder) => (
                  <ContextMenu key={folder.id}>
                    <ContextMenuTrigger>
                      <div
                        className={cn(
                          "relative aspect-square border-2 rounded-lg p-3 cursor-pointer transition-colors",
                          "hover:border-primary hover:bg-accent",
                          dropTargetFolder === folder.id && "border-primary bg-primary/5"
                        )}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDropTargetFolder(folder.id)
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setDropTargetFolder(null)
                        }}
                        onDrop={(e) => handleFolderDrop(e, folder.id)}
                        onClick={() => {
                          if (editingFolderId !== folder.id) {
                            setCurrentFolderId(folder.id)
                          }
                        }}
                        onDoubleClick={() => {
                          setEditingFolderId(folder.id)
                          setEditingFolderName(folder.name)
                        }}
                      >
                        <div className="flex flex-col items-center justify-center h-full">
                          <Folder className="h-10 w-10 mb-2 text-muted-foreground" />
                          {editingFolderId === folder.id ? (
                            <div className="w-full" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={editingFolderName}
                                onChange={(e) => setEditingFolderName(e.target.value)}
                                onBlur={handleRenameFolder}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleRenameFolder()
                                  if (e.key === 'Escape') {
                                    setEditingFolderId(null)
                                    setEditingFolderName('')
                                  }
                                }}
                                className="text-xs text-center h-7"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <>
                              <p className="text-xs font-medium text-center truncate w-full">
                                {folder.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {folder._count.assets} item{folder._count.assets !== 1 ? 's' : ''}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem
                        onClick={() => {
                          setEditingFolderId(folder.id)
                          setEditingFolderName(folder.name)
                        }}
                      >
                        Rename
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => {
                          setItemToDelete({ type: 'folder', id: folder.id })
                          setShowDeleteDialog(true)
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}

                {/* Assets */}
                {filteredAssets.map((asset) => {
                  // Slide mode selection - check both pending assignments and existing backgrounds
                  const slideIndex = slideMode ? getAssetSlideIndex(asset.id, asset.cacheAssetId) : -1
                  const isSlideSelected = slideIndex !== -1

                  // Multi-select / single select mode
                  const isSelected = slideMode
                    ? isSlideSelected
                    : multiSelect
                      ? selectedAssets.some(a => a.id === asset.id)
                      : selectedAssetId === asset.id
                  const selectionIndex = multiSelect ? getSelectionIndex(asset.id) : 0

                  return (
                    <ContextMenu key={asset.id}>
                      <ContextMenuTrigger>
                        <button
                          className={cn(
                            "relative aspect-square border-2 rounded-lg overflow-hidden transition-all",
                            "hover:border-primary",
                            isSelected && "border-primary ring-2 ring-primary"
                          )}
                          draggable
                          onDragStart={() => handleAssetDragStart(asset.id)}
                          onDragEnd={handleAssetDragEnd}
                          onClick={() => handleAssetClick(asset)}
                        >
                          {/* Slide mode: Show slide index badge (S1, S2...) */}
                          {slideMode && isSlideSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center z-10">
                              <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                                S{slideIndex + 1}
                              </div>
                            </div>
                          )}

                          {/* Multi-select / single select mode */}
                          {!slideMode && isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center z-10">
                              {multiSelect ? (
                                <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                                  {selectionIndex}
                                </div>
                              ) : (
                                <div className="bg-primary text-primary-foreground rounded-full p-2">
                                  <Check className="h-5 w-5" />
                                </div>
                              )}
                            </div>
                          )}
                          <img
                            src={asset.url}
                            alt={asset.name || ''}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          onClick={() => {
                            setItemToDelete({ type: 'asset', id: asset.id })
                            setShowDeleteDialog(true)
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}

                {/* Create Folder Button (only in root) */}
                {!currentFolderId && (
                  <button
                    onClick={handleCreateFolder}
                    className="aspect-square border-2 border-dashed rounded-lg p-3 hover:border-primary hover:bg-accent transition-colors flex flex-col items-center justify-center"
                  >
                    <FolderPlus className="h-10 w-10 mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">New Folder</p>
                  </button>
                )}
              </div>
            )}

            {/* Empty State */}
            {!isLoading && assets.length === 0 && folders.length === 0 && !currentFolderId && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="h-16 w-16 mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No assets yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload images, paste from clipboard (Ctrl+V), or drag & drop files
                </p>
              </div>
            )}

            {!isLoading && assets.length === 0 && currentFolderId && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Folder className="h-16 w-16 mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">Folder is empty</h3>
                <p className="text-sm text-muted-foreground">
                  Drop files here to add them to this folder
                </p>
              </div>
            )}
          </div>

          {/* Multi-select Preview Panel */}
          {multiSelect && selectedAssets.length > 0 && (
            <div className="px-6 py-3 border-t bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium">
                  Selected: {selectedAssets.length}{maxSelections ? ` / ${maxSelections}` : ''}
                </span>
                <span className="text-xs text-muted-foreground">(drag or use arrows to reorder)</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedAssets.map((asset, index) => (
                  <div
                    key={asset.id}
                    className="relative flex-shrink-0 w-16 group"
                  >
                    <div className="aspect-square rounded-md overflow-hidden border-2 border-primary">
                      <img
                        src={asset.url}
                        alt={asset.name || ''}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Index badge */}
                    <div className="absolute -top-1 -left-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    {/* Reorder controls */}
                    <div className="absolute -right-1 top-0 bottom-0 flex flex-col justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveSelectionUp(index)}
                        disabled={index === 0}
                        className={cn(
                          "bg-background border rounded p-0.5",
                          index === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-accent"
                        )}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => moveSelectionDown(index)}
                        disabled={index === selectedAssets.length - 1}
                        className={cn(
                          "bg-background border rounded p-0.5",
                          index === selectedAssets.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:bg-accent"
                        )}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => removeFromSelection(asset.id)}
                      className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-background flex-shrink-0">
            <p className="text-sm text-muted-foreground">
              {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} available
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSelect}
                disabled={
                  slideMode
                    ? slideAssignments.size === 0
                    : multiSelect
                      ? selectedAssets.length === 0
                      : !selectedAssetId
                }
              >
                {slideMode
                  ? `Apply ${slideAssignments.size > 0 ? `(${slideAssignments.size} slide${slideAssignments.size !== 1 ? 's' : ''})` : ''}`
                  : multiSelect
                    ? `Apply ${selectedAssets.length > 0 ? `(${selectedAssets.length})` : ''}`
                    : 'Select'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'folder'
                ? 'This will delete the folder. Assets inside will be moved to the root level.'
                : 'This will permanently delete this asset from storage.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemToDelete?.type === 'folder') {
                  handleDeleteFolder(itemToDelete.id)
                } else if (itemToDelete?.type === 'asset') {
                  handleDeleteAsset(itemToDelete.id)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
