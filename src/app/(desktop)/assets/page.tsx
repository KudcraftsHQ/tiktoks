'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
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
  Image as ImageIcon,
  Trash2,
  Upload,
  ChevronRight,
  ArrowLeft,
  Check,
  X,
  Loader2,
  User,
  UserX,
  ScanFace
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useUpload } from '@/lib/upload-context'
import { OptimisticAssetCard } from '@/components/upload/OptimisticAssetCard'
import { AssetGridSkeleton, FolderSkeleton } from '@/components/assets/AssetSkeleton'

interface AssetFolder {
  id: string
  name: string
  _count: { assets: number }
}

interface Asset {
  id: string
  folderId: string | null
  cacheAssetId: string
  name: string | null
  url: string
  width: number | null
  height: number | null
  hasFace: boolean | null
  faceAnalyzedAt: string | null
}

export default function AssetsPage() {
  const router = useRouter()
  const { addFiles, queue, isUploading } = useUpload()
  const [folders, setFolders] = useState<AssetFolder[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoadingFolders, setIsLoadingFolders] = useState(true)
  const [isLoadingAssets, setIsLoadingAssets] = useState(true)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: 'folder' | 'asset'; id: string } | null>(null)
  const [draggedAsset, setDraggedAsset] = useState<string | null>(null)
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [isAnalyzingFaces, setIsAnalyzingFaces] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFolders()
    fetchAssets()
  }, [currentFolderId])

  // Listen for completed uploads to update assets list
  useEffect(() => {
    const handleAssetUploaded = (e: CustomEvent) => {
      // Check if the uploaded asset belongs to the current folder
      if (e.detail.folderId === currentFolderId || (!e.detail.folderId && !currentFolderId)) {
        setAssets(prev => [e.detail, ...prev])
      }
      fetchFolders() // Update folder counts
    }

    window.addEventListener('asset-uploaded', handleAssetUploaded as EventListener)
    return () => window.removeEventListener('asset-uploaded', handleAssetUploaded as EventListener)
  }, [currentFolderId])

  // Trigger hash backfill for assets without hashes on initial load
  useEffect(() => {
    const checkAndBackfillHashes = async () => {
      try {
        // Check if there are assets without hashes
        const response = await fetch('/api/assets/backfill-hashes')
        if (response.ok) {
          const data = await response.json()
          if (data.stats.assetsWithoutHash > 0) {
            console.log(`🔑 Found ${data.stats.assetsWithoutHash} assets without hashes, queuing backfill...`)
            // Trigger backfill (limit to 50 at a time to avoid overwhelming the queue)
            await fetch('/api/assets/backfill-hashes?limit=50', { method: 'POST' })
          }
        }
      } catch (error) {
        console.error('Failed to check/backfill hashes:', error)
        // Silent fail - don't interrupt user experience
      }
    }

    checkAndBackfillHashes()
  }, []) // Run only once on mount

  // Handle paste from clipboard
  useEffect(() => {
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
  }, [currentFolderId])

  const fetchFolders = async () => {
    try {
      setIsLoadingFolders(true)
      const response = await fetch('/api/assets/folders')
      if (response.ok) {
        const data = await response.json()
        setFolders(data)
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    } finally {
      setIsLoadingFolders(false)
    }
  }

  const fetchAssets = async () => {
    try {
      setIsLoadingAssets(true)
      const params = new URLSearchParams()
      if (currentFolderId) {
        params.append('folderId', currentFolderId)
      } else {
        params.append('folderId', 'null')
      }

      const response = await fetch(`/api/assets?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAssets(data)
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error)
    } finally {
      setIsLoadingAssets(false)
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
        selectedAssets.delete(assetId)
        setSelectedAssets(new Set(selectedAssets))
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

  const handleDeleteSelected = async () => {
    if (selectedAssets.size === 0) return

    if (!confirm(`Delete ${selectedAssets.size} selected asset(s)?`)) return

    try {
      const deletePromises = Array.from(selectedAssets).map(id =>
        fetch(`/api/assets/${id}`, { method: 'DELETE' })
      )

      await Promise.all(deletePromises)

      setAssets(assets.filter(a => !selectedAssets.has(a.id)))
      setSelectedAssets(new Set())
      fetchFolders()
      toast.success(`Deleted ${selectedAssets.size} asset(s)`)
    } catch (error) {
      console.error('Failed to delete assets:', error)
      toast.error('Failed to delete assets')
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    // Use new upload context
    await addFiles(Array.from(files), currentFolderId)
  }

  const handleDrop = useCallback((e: React.DragEvent, targetFolderId?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    setDropTargetFolder(null)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      // Check if dragging files (not assets)
      const hasFiles = Array.from(files).some(file => file.type.startsWith('image/') || file.name.match(/\.(heic|heif)$/i))
      if (hasFiles) {
        handleFileUpload(files)
      }
    }
  }, [currentFolderId])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Only show drag overlay if dragging files (not assets)
    const items = e.dataTransfer.items
    if (items && items.length > 0) {
      // Check if any item is a file
      const hasFiles = Array.from(items).some(item => item.kind === 'file')
      if (hasFiles && !draggedAsset) {
        setIsDraggingOver(true)
      }
    }
  }, [draggedAsset])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Only hide if leaving the page container
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false)
    }
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

  const toggleAssetSelection = (assetId: string) => {
    const newSelected = new Set(selectedAssets)
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId)
    } else {
      newSelected.add(assetId)
    }
    setSelectedAssets(newSelected)
  }

  const handleAnalyzeSelectedFaces = async () => {
    if (selectedAssets.size === 0) return

    setIsAnalyzingFaces(true)
    try {
      const response = await fetch('/api/assets/bulk-analyze-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: Array.from(selectedAssets) })
      })

      if (response.ok) {
        const result = await response.json()
        // Update assets with new face detection results
        setAssets(assets.map(a => {
          const updated = result.assets.find((ua: Asset) => ua.id === a.id)
          return updated || a
        }))
        toast.success(`Analyzed ${result.processed} asset(s)`)
      } else {
        throw new Error('Failed to analyze faces')
      }
    } catch (error) {
      console.error('Failed to analyze faces:', error)
      toast.error('Failed to analyze faces')
    } finally {
      setIsAnalyzingFaces(false)
    }
  }

  const handleAnalyzeAllUnanalyzed = async () => {
    const unanalyzedAssets = assets.filter(a => a.hasFace === null)
    if (unanalyzedAssets.length === 0) {
      toast.info('All assets have been analyzed')
      return
    }

    setIsAnalyzingFaces(true)
    try {
      const response = await fetch('/api/assets/bulk-analyze-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds: unanalyzedAssets.map(a => a.id) })
      })

      if (response.ok) {
        const result = await response.json()
        // Update assets with new face detection results
        setAssets(assets.map(a => {
          const updated = result.assets.find((ua: Asset) => ua.id === a.id)
          return updated || a
        }))
        toast.success(`Analyzed ${result.processed} asset(s)`)
      } else {
        throw new Error('Failed to analyze faces')
      }
    } catch (error) {
      console.error('Failed to analyze faces:', error)
      toast.error('Failed to analyze faces')
    } finally {
      setIsAnalyzingFaces(false)
    }
  }

  const currentFolder = folders.find(f => f.id === currentFolderId)
  const unanalyzedCount = assets.filter(a => a.hasFace === null).length

  return (
    <div className="h-full bg-background relative">
      {/* Full content area drag overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 left-[var(--sidebar-width)] z-50 pointer-events-none">
          <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/95 backdrop-blur-md rounded-2xl p-12 border-2 border-dashed border-primary shadow-2xl">
              <Upload className="h-16 w-16 mx-auto mb-4 text-primary" />
              <p className="text-2xl font-semibold text-center mb-2">Drop files to upload</p>
              <p className="text-muted-foreground text-center">
                Supports images and HEIC files
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b sticky top-0 z-40 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
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
              <h1 className="text-xl font-semibold">Assets</h1>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
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
            </div>
            {unanalyzedCount > 0 && (
              <Button
                onClick={handleAnalyzeAllUnanalyzed}
                disabled={isAnalyzingFaces}
                variant="outline"
              >
                {isAnalyzingFaces ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ScanFace className="h-4 w-4 mr-2" />
                    Analyze All ({unanalyzedCount})
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
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
        </div>
      </header>

      {/* Main Content */}
      <div
        className={cn(
          "container mx-auto px-4 py-6",
          isDraggingOver && "bg-primary/5"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Bulk Actions */}
        {selectedAssets.size > 0 && (
          <div className="mb-4 p-4 bg-muted rounded-lg flex items-center gap-2">
            <span className="text-sm">{selectedAssets.size} selected</span>
            <Button
              onClick={handleAnalyzeSelectedFaces}
              disabled={isAnalyzingFaces}
              variant="secondary"
              size="sm"
            >
              {isAnalyzingFaces ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <ScanFace className="h-4 w-4 mr-1" />
                  Analyze Faces
                </>
              )}
            </Button>
            <Button onClick={handleDeleteSelected} variant="destructive" size="sm">
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Selected
            </Button>
            <Button
              onClick={() => setSelectedAssets(new Set())}
              variant="outline"
              size="sm"
            >
              Clear
            </Button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {/* Loading skeletons for folders */}
          {isLoadingFolders && !currentFolderId && <FolderSkeleton count={3} />}

          {/* Show folders only in root view */}
          {!isLoadingFolders && !currentFolderId && folders.map((folder) => (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger>
                <div
                  className={cn(
                    "relative aspect-[3/4] border-2 rounded-lg p-4 cursor-pointer transition-colors",
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
                    <Folder className="h-12 w-12 mb-2 text-muted-foreground" />
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
                          className="text-sm text-center"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-center truncate w-full">
                          {folder.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
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

          {/* Loading skeletons for assets */}
          {isLoadingAssets && <AssetGridSkeleton count={12} />}

          {/* Optimistic upload items - show items being uploaded in current folder */}
          {!isLoadingAssets && queue
            .filter((item) =>
              (item.folderId === currentFolderId || (!item.folderId && !currentFolderId)) &&
              (item.status === 'pending' || item.status === 'uploading' || item.status === 'processing')
            )
            .map((item) => (
              <OptimisticAssetCard key={item.id} item={item} />
            ))
          }

          {/* Assets */}
          {!isLoadingAssets && assets.map((asset) => {
            // Calculate object-fit based on aspect ratio
            const isPortrait = asset.height && asset.width && asset.height > asset.width
            const objectFit = isPortrait ? 'object-contain' : 'object-cover'

            return (
              <ContextMenu key={asset.id}>
                <ContextMenuTrigger>
                  <div
                    className={cn(
                      "relative aspect-[3/4] border rounded-lg overflow-hidden cursor-pointer transition-all bg-muted/50",
                      "hover:border-primary",
                      selectedAssets.has(asset.id) && "ring-2 ring-primary"
                    )}
                    draggable
                    onDragStart={() => handleAssetDragStart(asset.id)}
                    onDragEnd={handleAssetDragEnd}
                    onClick={() => toggleAssetSelection(asset.id)}
                  >
                    {selectedAssets.has(asset.id) && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className="w-6 h-6 rounded bg-primary border-2 border-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                    {/* Face detection indicator */}
                    {asset.hasFace !== null && (
                      <div className="absolute top-2 right-2 z-10">
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center",
                          asset.hasFace
                            ? "bg-green-500/90"
                            : "bg-gray-500/90"
                        )}>
                          {asset.hasFace ? (
                            <User className="h-3 w-3 text-white" />
                          ) : (
                            <UserX className="h-3 w-3 text-white" />
                          )}
                        </div>
                      </div>
                    )}
                    <img
                      src={asset.url}
                      alt={asset.name || ''}
                      className={cn("w-full h-full", objectFit)}
                    />
                  </div>
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
          {!isLoadingFolders && !currentFolderId && (
            <button
              onClick={handleCreateFolder}
              className="aspect-[3/4] border-2 border-dashed rounded-lg p-4 hover:border-primary hover:bg-accent transition-colors flex flex-col items-center justify-center"
            >
              <FolderPlus className="h-12 w-12 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">New Folder</p>
            </button>
          )}
        </div>

        {/* Empty State - only show when not loading */}
        {!isLoadingAssets && !isLoadingFolders && assets.length === 0 && folders.length === 0 && !currentFolderId && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-16 w-16 mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-2">No assets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Upload images or paste from clipboard (Ctrl+V)
            </p>
          </div>
        )}

        {!isLoadingAssets && assets.length === 0 && currentFolderId && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Folder className="h-16 w-16 mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-medium mb-2">Folder is empty</h3>
            <p className="text-sm text-muted-foreground">
              Drop files here to add them to this folder
            </p>
          </div>
        )}
      </div>

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
    </div>
  )
}
