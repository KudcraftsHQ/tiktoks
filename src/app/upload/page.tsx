'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Upload,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  Image as ImageIcon,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface UploadedPhoto {
  id: string
  file: File
  preview: string
  cacheAssetId: string | null
  isUploading: boolean
  error: string | null
}

interface TikTokAccount {
  id: string
  openId: string
  displayName: string | null
  status: string
  isExpired: boolean
}

function SortablePhoto({
  photo,
  onDelete,
}: {
  photo: UploadedPhoto
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-shrink-0 w-32 sm:w-36 group"
      {...attributes}
      {...listeners}
    >
      <div className="relative bg-muted rounded-lg overflow-hidden border-2 border-transparent hover:border-primary/50 transition-all aspect-[9/16] cursor-grab active:cursor-grabbing">
        {photo.isUploading ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : photo.error ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-destructive/10 p-2">
            <AlertCircle className="h-6 w-6 text-destructive mb-1" />
            <p className="text-xs text-destructive text-center">{photo.error}</p>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <img
              src={photo.preview}
              alt={photo.file.name}
              className="w-full h-auto"
              draggable={false}
            />
          </div>
        )}

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute top-1 right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Success Indicator */}
        {photo.cacheAssetId && !photo.isUploading && (
          <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center">
            <CheckCircle className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      {/* Filename */}
      <p className="text-xs text-muted-foreground mt-1 truncate px-1">
        {photo.file.name}
      </p>
    </div>
  )
}

export default function UploadPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [accounts, setAccounts] = useState<TikTokAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null
    message: string
  }>({ type: null, message: '' })
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/tiktok-accounts')
      if (response.ok) {
        const data = await response.json()
        const activeAccounts = data.accounts.filter(
          (acc: TikTokAccount) => !acc.isExpired && acc.status === 'ACTIVE'
        )
        setAccounts(activeAccounts)
        if (activeAccounts.length > 0) {
          setSelectedAccountId(activeAccounts[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)

    // Check total count
    if (photos.length + fileArray.length > 10) {
      alert('Maximum 10 photos allowed')
      return
    }

    // Filter image files
    const imageFiles = fileArray.filter((file) =>
      file.type.startsWith('image/')
    )

    if (imageFiles.length === 0) {
      alert('Please select image files only')
      return
    }

    // Create photo objects
    const newPhotos: UploadedPhoto[] = imageFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      cacheAssetId: null,
      isUploading: true,
      error: null,
    }))

    setPhotos([...photos, ...newPhotos])

    // Upload each photo
    for (const photo of newPhotos) {
      await uploadPhoto(photo)
    }
  }

  const uploadPhoto = async (photo: UploadedPhoto) => {
    try {
      const formData = new FormData()
      formData.append('file', photo.file)
      formData.append('folder', 'tiktok-uploads')

      const response = await fetch('/api/cache-assets/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                cacheAssetId: data.cacheAssetId,
                isUploading: false,
                error: null,
              }
            : p
        )
      )
    } catch (error) {
      console.error('Failed to upload photo:', error)
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, isUploading: false, error: 'Upload failed' }
            : p
        )
      )
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (active.id !== over?.id) {
      setPhotos((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over?.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSubmit = async () => {
    if (!selectedAccountId) {
      alert('Please select a TikTok account')
      return
    }

    if (photos.length < 2) {
      alert('Please upload at least 2 photos')
      return
    }

    const uploadedPhotos = photos.filter((p) => p.cacheAssetId && !p.error)
    if (uploadedPhotos.length < 2) {
      alert('Please wait for photos to finish uploading')
      return
    }

    setIsSubmitting(true)
    setSubmitStatus({ type: null, message: '' })

    try {
      const response = await fetch('/api/tiktok/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountId: selectedAccountId,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          photoIds: uploadedPhotos.map((p) => p.cacheAssetId),
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setSubmitStatus({
          type: 'success',
          message: data.message || 'Successfully uploaded to TikTok!',
        })

        // Clear form after 3 seconds
        setTimeout(() => {
          setPhotos([])
          setTitle('')
          setDescription('')
          setSubmitStatus({ type: null, message: '' })
        }, 3000)
      } else {
        setSubmitStatus({
          type: 'error',
          message: data.error || 'Failed to upload to TikTok',
        })
      }
    } catch (error) {
      console.error('Submit error:', error)
      setSubmitStatus({
        type: 'error',
        message: 'An error occurred while uploading',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const activePhoto = photos.find((p) => p.id === activeId)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">Upload to TikTok</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload carousel photos as drafts to your TikTok account
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Account Selector */}
          <div className="bg-card border rounded-lg p-4 sm:p-6">
            <Label htmlFor="account" className="text-base font-semibold">
              TikTok Account
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Select which account to upload to
            </p>

            {isLoadingAccounts ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="text-muted-foreground mb-3">
                  No connected accounts. Please connect a TikTok account first.
                </p>
                <Button
                  onClick={() => router.push('/tiktok-accounts/connect')}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Account
                </Button>
              </div>
            ) : (
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger id="account">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.displayName ||
                        `TikTok User (${account.openId.substring(0, 8)}...)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Photo Upload */}
          <div className="bg-card border rounded-lg p-4 sm:p-6">
            <Label className="text-base font-semibold">
              Photos ({photos.length}/10)
            </Label>
            <p className="text-sm text-muted-foreground mb-4">
              Upload 2-10 photos. Drag to reorder.
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(event) => setActiveId(event.active.id as string)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveId(null)}
            >
              <div className="space-y-4">
                {/* Photos Grid */}
                {photos.length > 0 && (
                  <SortableContext
                    items={photos.map((p) => p.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                      {photos.map((photo) => (
                        <SortablePhoto
                          key={photo.id}
                          photo={photo}
                          onDelete={() =>
                            setPhotos(photos.filter((p) => p.id !== photo.id))
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                )}

                {/* Upload Button */}
                {photos.length < 10 && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileSelect(e.target.files)}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Add Photos
                    </Button>
                  </div>
                )}
              </div>

              <DragOverlay>
                {activePhoto ? (
                  <div className="w-32 sm:w-36 opacity-90">
                    <div className="aspect-[9/16] bg-white rounded-lg overflow-hidden border-2 border-primary shadow-lg">
                      <img
                        src={activePhoto.preview}
                        alt={activePhoto.file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>

          {/* Title */}
          <div className="bg-card border rounded-lg p-4 sm:p-6">
            <Label htmlFor="title" className="text-base font-semibold">
              Title (Optional)
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Max 90 characters
            </p>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value.substring(0, 90))}
              placeholder="Enter a catchy title..."
              maxLength={90}
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {title.length}/90
            </p>
          </div>

          {/* Description */}
          <div className="bg-card border rounded-lg p-4 sm:p-6">
            <Label htmlFor="description" className="text-base font-semibold">
              Caption / Description
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Add hashtags and description. Max 4000 characters
            </p>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value.substring(0, 4000))}
              placeholder="Write your caption here... Don't forget hashtags! #viral #fyp"
              rows={6}
              maxLength={4000}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {description.length}/4000
            </p>
          </div>

          {/* Submit Button */}
          <div className="sticky bottom-0 bg-background pt-4 pb-6 border-t">
            <div className="space-y-4">
              {submitStatus.type && (
                <div
                  className={`p-4 rounded-lg ${
                    submitStatus.type === 'success'
                      ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                      : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {submitStatus.type === 'success' ? (
                      <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm">{submitStatus.message}</p>
                  </div>
                </div>
              )}

              <Button
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  !selectedAccountId ||
                  photos.length < 2 ||
                  photos.some((p) => p.isUploading || p.error)
                }
                size="lg"
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading to TikTok...
                  </>
                ) : (
                  'Submit as Draft'
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Your carousel will be uploaded as a draft to your TikTok inbox.
                <br />
                You can review and publish it from the TikTok app.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
