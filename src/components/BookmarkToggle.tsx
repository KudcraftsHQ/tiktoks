'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button as DialogButton } from '@/components/ui/button'
import { CollectionSelector } from '@/components/CollectionSelector'
import { Bookmark, BookmarkCheck, Loader2, X } from 'lucide-react'

interface Collection {
  id: string
  name: string
  color?: string
  isDefault: boolean
}

interface BookmarkToggleProps {
  postId: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
  showText?: boolean
  className?: string
}

export function BookmarkToggle({
  postId,
  size = 'sm',
  variant = 'default',
  showText = false,
  className = ''
}: BookmarkToggleProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [showCollectionDialog, setShowCollectionDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null)

  useEffect(() => {
    fetchCollectionStatus()
  }, [postId])

  const fetchCollectionStatus = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/posts/${postId}/collections`)

      if (!response.ok) {
        throw new Error('Failed to fetch collection status')
      }

      const data = await response.json()
      setCollections(data.collections || [])
      setIsBookmarked(data.isBookmarked || false)
    } catch (error) {
      console.error('Failed to fetch collection status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBookmarkClick = () => {
    if (isBookmarked && collections.length > 0) {
      // If bookmarked and has collections, show remove confirmation
      if (collections.length === 1) {
        setSelectedCollection(collections[0])
        setShowRemoveDialog(true)
      } else {
        // Multiple collections - show collection list with remove options
        setShowCollectionDialog(true)
      }
    } else {
      // Not bookmarked, show add to collection dialog
      setShowCollectionDialog(true)
    }
  }

  const handleAddToCollection = async (collectionId: string) => {
    try {
      setActing(true)
      const response = await fetch(`/api/collections/${collectionId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ postId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to add to collection')
      }

      await fetchCollectionStatus()
      setShowCollectionDialog(false)
    } catch (error) {
      console.error('Failed to add to collection:', error)
    } finally {
      setActing(false)
    }
  }

  const handleRemoveFromCollection = async (collectionId: string) => {
    try {
      setActing(true)
      const response = await fetch(`/api/collections/${collectionId}/posts/${postId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to remove from collection')
      }

      await fetchCollectionStatus()
      setShowRemoveDialog(false)
    } catch (error) {
      console.error('Failed to remove from collection:', error)
    } finally {
      setActing(false)
    }
  }

  const getButtonProps = () => {
    const baseProps = {
      variant: isBookmarked ? 'default' : variant,
      size,
      onClick: handleBookmarkClick,
      disabled: loading || acting,
      className: `${isBookmarked ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : ''} ${className}`,
      title: isBookmarked ? `Saved in ${collections.length} collection${collections.length !== 1 ? 's' : ''}` : 'Add to collection'
    }
    return baseProps
  }

  if (loading) {
    return (
      <Button {...getButtonProps() as any}>
        <Loader2 className="w-3 h-3 animate-spin" />
        {showText && <span className="ml-2">Loading...</span>}
      </Button>
    )
  }

  return (
    <>
      <Button {...getButtonProps() as any}>
        {isBookmarked ? (
          <BookmarkCheck className="w-3 h-3" />
        ) : (
          <Bookmark className="w-3 h-3" />
        )}
        {showText && (
          <span className="ml-2">
            {isBookmarked ? `Saved (${collections.length})` : 'Save'}
          </span>
        )}
      </Button>

      {/* Add to Collection Dialog */}
      <Dialog open={showCollectionDialog && !isBookmarked} onOpenChange={(open) => {
        if (!acting) setShowCollectionDialog(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Collection</DialogTitle>
            <DialogDescription>
              Select a collection to save this post to.
            </DialogDescription>
          </DialogHeader>

          <CollectionSelector
            onSelect={handleAddToCollection}
            onCancel={() => setShowCollectionDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Manage Collections Dialog */}
      <Dialog open={showCollectionDialog && isBookmarked} onOpenChange={(open) => {
        if (!acting) setShowCollectionDialog(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Collections</DialogTitle>
            <DialogDescription>
              This post is saved in {collections.length} collection{collections.length !== 1 ? 's' : ''}. Click to remove from a collection or add to another.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current Collections */}
            <div>
              <h4 className="text-sm font-medium mb-2">Currently saved in:</h4>
              <div className="space-y-2">
                {collections.map((collection) => (
                  <div
                    key={collection.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: collection.color || '#6b7280' }}
                      />
                      <span className="font-medium">{collection.name}</span>
                      {collection.isDefault && (
                        <Badge variant="secondary" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCollection(collection)
                        setShowRemoveDialog(true)
                      }}
                      disabled={acting}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add to Another Collection */}
            <div>
              <h4 className="text-sm font-medium mb-2">Add to another collection:</h4>
              <CollectionSelector
                onSelect={handleAddToCollection}
                onCancel={() => setShowCollectionDialog(false)}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={(open) => {
        if (!acting) setShowRemoveDialog(open)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this post from "{selectedCollection?.name}"?
              You can always add it back later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowRemoveDialog(false)} disabled={acting}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedCollection && handleRemoveFromCollection(selectedCollection.id)}
              disabled={acting}
              className="bg-red-600 hover:bg-red-700"
            >
              {acting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}