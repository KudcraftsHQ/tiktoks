'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { 
  Folder, 
  FolderPlus, 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  Upload,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Check,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface RemixFolder {
  id: string
  name: string
  _count: { assets: number }
}

interface RemixAsset {
  id: string
  folderId: string | null
  cacheAssetId: string
  name: string | null
  url: string
  width: number | null
  height: number | null
}

interface RemixUploadsManagerProps {
  remixId: string
  onSelectImage: (url: string, cacheAssetId: string) => void
}

export function RemixUploadsManager({ remixId, onSelectImage }: RemixUploadsManagerProps) {
  const [folders, setFolders] = useState<RemixFolder[]>([])
  const [assets, setAssets] = useState<RemixAsset[]>([])
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{ type: 'folder' | 'asset'; id: string } | null>(null)
  const [draggedAsset, setDraggedAsset] = useState<string | null>(null)
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null)
  const [openFolderId, setOpenFolderId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchFolders()
    fetchAssets()
  }, [remixId])

  // Handle paste from clipboard
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            files.push(file)
          }
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
  }, [remixId, assets])

  const fetchFolders = async () => {
    try {
      const response = await fetch(`/api/remixes/${remixId}/folders`)
      if (response.ok) {
        const data = await response.json()
        setFolders(data)
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error)
    }
  }

  const fetchAssets = async () => {
    try {
      console.log('📥 [RemixUploadsManager] Fetching assets for remix:', remixId)
      const response = await fetch(`/api/remixes/${remixId}/assets`)
      if (response.ok) {
        const data = await response.json()
        console.log('✅ [RemixUploadsManager] Fetched assets:', data.length, data)
        setAssets(data)
      } else {
        console.error('❌ [RemixUploadsManager] Failed to fetch assets:', response.status)
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error)
    }
  }

  const handleCreateFolder = async () => {
    try {
      const response = await fetch(`/api/remixes/${remixId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Folder' })
      })

      if (response.ok) {
        const newFolder = await response.json()
        setFolders([...folders, newFolder])
        setEditingFolderId(newFolder.id)
        setEditingFolderName(newFolder.name)
      }
    } catch (error) {
      console.error('Failed to create folder:', error)
    }
  }

  const handleRenameFolder = async () => {
    if (!editingFolderId || !editingFolderName.trim()) return

    try {
      const response = await fetch(`/api/remixes/${remixId}/folders/${editingFolderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingFolderName.trim() })
      })

      if (response.ok) {
        const updatedFolder = await response.json()
        setFolders(folders.map(f => f.id === editingFolderId ? updatedFolder : f))
        setEditingFolderId(null)
        setEditingFolderName('')
      }
    } catch (error) {
      console.error('Failed to rename folder:', error)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      const response = await fetch(`/api/remixes/${remixId}/folders/${folderId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setFolders(folders.filter(f => f.id !== folderId))
        // Refresh assets to reflect folder removal
        fetchAssets()
        setShowDeleteDialog(false)
        setItemToDelete(null)
      }
    } catch (error) {
      console.error('Failed to delete folder:', error)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    try {
      const response = await fetch(`/api/remixes/${remixId}/assets/${assetId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setAssets(assets.filter(a => a.id !== assetId))
        fetchFolders() // Refresh folder counts
        setShowDeleteDialog(false)
        setItemToDelete(null)
      }
    } catch (error) {
      console.error('Failed to delete asset:', error)
    }
  }

  const handleFileUpload = async (files: FileList | null, folderId?: string) => {
    if (!files || files.length === 0) return

    setIsUploading(true)

    try {
      for (const file of Array.from(files)) {
        // Upload to R2
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', `remix/${remixId}/uploads`)

        const uploadResponse = await fetch('/api/cache-assets/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadResponse.ok) {
          console.error('Upload failed:', await uploadResponse.text())
          continue
        }

        const uploadResult = await uploadResponse.json()
        console.log('✅ Upload result:', uploadResult)
        const { cacheAssetId } = uploadResult

        // Get image dimensions
        const img = new Image()
        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
          img.onload = () => resolve({ width: img.width, height: img.height })
          img.src = URL.createObjectURL(file)
        })

        // Create remix asset
        const assetResponse = await fetch(`/api/remixes/${remixId}/assets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cacheAssetId,
            folderId: folderId || null,
            name: file.name,
            width: dimensions.width,
            height: dimensions.height
          })
        })

        if (assetResponse.ok) {
          const newAsset = await assetResponse.json()
          console.log('Created new asset:', newAsset)
          setAssets(prev => [newAsset, ...prev])
        }
      }

      // Refresh both assets and folders to get updated counts
      await fetchAssets()
      await fetchFolders()
    } catch (error) {
      console.error('Failed to upload files:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent, folderId?: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    setDropTargetFolder(null)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      // If we're in folder view, upload to that folder
      const targetFolderId = folderId || openFolderId
      handleFileUpload(files, targetFolderId || undefined)
    }
  }, [openFolderId])

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

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedAsset) {
      setDropTargetFolder(folderId)
    }
  }

  const handleFolderDragLeave = (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear if we're leaving this specific folder
    const relatedTarget = e.relatedTarget as HTMLElement
    const currentTarget = e.currentTarget as HTMLElement
    if (!currentTarget.contains(relatedTarget)) {
      if (dropTargetFolder === folderId) {
        setDropTargetFolder(null)
      }
    }
  }

  const handleFolderDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDropTargetFolder(null)

    if (draggedAsset) {
      // Move asset to folder
      try {
        const response = await fetch(`/api/remixes/${remixId}/assets/${draggedAsset}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folderId })
        })

        if (response.ok) {
          fetchAssets()
          fetchFolders()
        }
      } catch (error) {
        console.error('Failed to move asset:', error)
      }
      setDraggedAsset(null)
    }
  }

  const handleDownloadAsset = async (asset: RemixAsset) => {
    try {
      const response = await fetch(asset.url)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = asset.name || 'image.png'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Failed to download asset:', error)
    }
  }

  const openFolder = (folderId: string) => {
    setOpenFolderId(folderId)
  }

  const closeFolder = () => {
    setOpenFolderId(null)
  }

  const getAssetsForFolder = (folderId: string | null) => {
    return assets.filter(a => a.folderId === folderId)
  }

  const openedFolder = openFolderId ? folders.find(f => f.id === openFolderId) : null
  const folderAssets = openFolderId ? getAssetsForFolder(openFolderId) : []

  // If a folder is open, show folder detail view
  if (openedFolder) {
    return (
      <div 
        className={cn(
          "space-y-3 h-full transition-all relative flex flex-col",
          isDraggingOver && "bg-primary/5"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Drag overlay indicator */}
        {isDraggingOver && (
          <div className="absolute inset-0 border-4 border-dashed border-primary rounded-lg pointer-events-none z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
            <div className="text-center">
              <Upload className="h-20 w-20 mx-auto mb-4 text-primary animate-bounce" />
              <p className="text-xl font-semibold text-primary">Drop to add to folder</p>
              <p className="text-sm text-primary/70 mt-1">{openedFolder.name}</p>
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold">Uploads</h2>

        {/* Back Navigation */}
        <Button
          variant="ghost"
          size="sm"
          onClick={closeFolder}
          className="w-full justify-start h-8"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Folders
        </Button>

        {/* Folder Header */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <div className="w-10 h-10 bg-muted/50 rounded flex items-center justify-center flex-shrink-0">
            <Folder className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{openedFolder.name}</h3>
            <p className="text-xs text-muted-foreground">
              {openedFolder._count.assets} {openedFolder._count.assets === 1 ? 'item' : 'items'}
            </p>
          </div>
        </div>

        {/* Folder Assets */}
        {folderAssets.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Folder className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p className="text-sm">This folder is empty</p>
            <p className="text-xs mt-1">Drag images here to add them</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {folderAssets.map((asset) => (
              <ContextMenu key={asset.id}>
                <ContextMenuTrigger>
                  <div
                    className={cn(
                      "aspect-[4/3] bg-muted rounded overflow-hidden border cursor-move hover:border-primary transition-all relative group",
                      draggedAsset === asset.id && "opacity-50 scale-95"
                    )}
                    draggable
                    onDragStart={() => handleAssetDragStart(asset.id)}
                    onDragEnd={handleAssetDragEnd}
                    onClick={() => onSelectImage(asset.url, asset.cacheAssetId)}
                  >
                    <img
                      src={asset.url}
                      alt={asset.name || ''}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <ImageIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onClick={() => onSelectImage(asset.url, asset.cacheAssetId)}>
                    Use as Background
                  </ContextMenuItem>
                  <ContextMenuItem onClick={() => handleDownloadAsset(asset)}>
                    <Download className="h-3 w-3 mr-2" />
                    Download
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setItemToDelete({ type: 'asset', id: asset.id })
                      setShowDeleteDialog(true)
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )}

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Image?</AlertDialogTitle>
              <AlertDialogDescription>
                This image will be permanently deleted. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowDeleteDialog(false)
                  setItemToDelete(null)
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (itemToDelete?.type === 'asset') {
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

  // Default view: folder list and uncategorized assets
  return (
    <div 
      className={cn(
        "space-y-3 h-full transition-all relative flex flex-col",
        isDraggingOver && "bg-primary/5"
      )}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay indicator */}
      {isDraggingOver && (
        <div className="absolute inset-0 border-4 border-dashed border-primary rounded-lg pointer-events-none z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <div className="text-center">
            <Upload className="h-20 w-20 mx-auto mb-4 text-primary animate-bounce" />
            <p className="text-xl font-semibold text-primary">Drop images to upload</p>
            <p className="text-sm text-primary/70 mt-1">Images will be added to your library</p>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold">Uploads</h2>

      {/* Upload Button */}
      <Button
        onClick={() => fileInputRef.current?.click()}
        variant="outline"
        size="sm"
        className="w-full justify-start h-8"
        disabled={isUploading}
      >
        <Upload className="h-3.5 w-3.5 mr-2" />
        {isUploading ? 'Uploading...' : 'Upload Images'}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFileUpload(e.target.files)}
      />

      {/* Add New Folder Button */}
      <Button
        onClick={handleCreateFolder}
        variant="outline"
        size="sm"
        className="w-full justify-start h-8"
      >
        <FolderPlus className="h-3.5 w-3.5 mr-2" />
        Add New Folder
      </Button>

      {/* Folders and Assets */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Folders</h3>
        </div>

        <div className="space-y-1">
          {folders.map((folder) => {
            const isDropTarget = dropTargetFolder === folder.id
            const isEditing = editingFolderId === folder.id

            return (
              <ContextMenu key={folder.id}>
                <ContextMenuTrigger>
                  <div
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg transition-all",
                      draggedAsset ? "cursor-move" : "cursor-pointer hover:bg-muted/50",
                      isDropTarget && "bg-primary/10 ring-2 ring-primary scale-[1.02] shadow-lg"
                    )}
                    onClick={() => !draggedAsset && openFolder(folder.id)}
                    onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                    onDragLeave={(e) => handleFolderDragLeave(e, folder.id)}
                    onDrop={(e) => handleFolderDrop(e, folder.id)}
                  >
                    {/* Folder Icon */}
                    <div className="w-12 h-12 bg-muted/50 rounded flex items-center justify-center flex-shrink-0">
                      <Folder className="h-6 w-6 text-muted-foreground" />
                    </div>
                    
                    {/* Folder Name and Count */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <Input
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          onBlur={() => {
                            if (editingFolderName.trim()) {
                              handleRenameFolder()
                            } else {
                              setEditingFolderId(null)
                              setEditingFolderName('')
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation()
                              if (editingFolderName.trim()) {
                                handleRenameFolder()
                              }
                            } else if (e.key === 'Escape') {
                              e.stopPropagation()
                              setEditingFolderId(null)
                              setEditingFolderName('')
                            }
                          }}
                        />
                      ) : (
                        <>
                          <p className="text-sm font-medium truncate">
                            {folder.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {folder._count.assets} {folder._count.assets === 1 ? 'item' : 'items'}
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
                    <Trash2 className="h-3 w-3 mr-2" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>

        {/* Uncategorized Assets */}
        {getAssetsForFolder(null).length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mt-4">Uncategorized</h3>
            <div className="grid grid-cols-2 gap-2">
              {getAssetsForFolder(null).map((asset) => (
                <ContextMenu key={asset.id}>
                  <ContextMenuTrigger>
                    <div
                      className={cn(
                        "aspect-[4/3] bg-muted rounded overflow-hidden border cursor-move hover:border-primary transition-all relative group",
                        draggedAsset === asset.id && "opacity-50 scale-95"
                      )}
                      draggable
                      onDragStart={() => handleAssetDragStart(asset.id)}
                      onDragEnd={handleAssetDragEnd}
                      onClick={() => onSelectImage(asset.url, asset.cacheAssetId)}
                    >
                      <img
                        src={asset.url}
                        alt={asset.name || ''}
                        className="w-full h-full object-cover pointer-events-none"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <ImageIcon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => onSelectImage(asset.url, asset.cacheAssetId)}>
                      Use as Background
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleDownloadAsset(asset)}>
                      <Download className="h-3 w-3 mr-2" />
                      Download
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        setItemToDelete({ type: 'asset', id: asset.id })
                        setShowDeleteDialog(true)
                      }}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3 w-3 mr-2" />
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {itemToDelete?.type === 'folder' ? 'Folder' : 'Image'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'folder' 
                ? 'Deleting this folder will move all its images to uncategorized. This action cannot be undone.'
                : 'This image will be permanently deleted. This action cannot be undone.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowDeleteDialog(false)
                setItemToDelete(null)
              }}
            >
              Cancel
            </AlertDialogCancel>
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
