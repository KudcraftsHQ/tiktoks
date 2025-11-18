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
  Search
} from 'lucide-react'
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
}

interface AssetFolder {
  id: string
  name: string
  _count: { assets: number }
}

interface AssetPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (asset: AssetItem) => void
  title?: string
  description?: string
}

export function AssetPicker({
  open,
  onClose,
  onSelect,
  title = 'Choose Background Image',
  description = 'Select an image from your assets or upload new ones'
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
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      fetchFolders()
      fetchAssets()
      setSearchQuery('')
      setSelectedAssetId(null)
    }
  }, [open, currentFolderId])

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
    const selected = assets.find(a => a.id === selectedAssetId)
    if (selected) {
      onSelect(selected)
      onClose()
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
                  const isSelected = selectedAssetId === asset.id

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
                          onClick={() => setSelectedAssetId(asset.id)}
                        >
                          {isSelected && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center z-10">
                              <div className="bg-primary text-primary-foreground rounded-full p-2">
                                <Check className="h-5 w-5" />
                              </div>
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

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-background flex-shrink-0">
            <p className="text-sm text-muted-foreground">
              {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} available
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSelect} disabled={!selectedAssetId}>
                Select
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
