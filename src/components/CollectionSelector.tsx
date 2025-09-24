'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Folder, Loader2, Check } from 'lucide-react'

interface Collection {
  id: string
  name: string
  description?: string
  color?: string
  isDefault: boolean
  _count: {
    posts: number
  }
}

interface CollectionSelectorProps {
  onSelect: (collectionId: string) => void
  onCancel: () => void
}

export function CollectionSelector({ onSelect, onCancel }: CollectionSelectorProps) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [newCollectionColor, setNewCollectionColor] = useState('#3b82f6')

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/collections')

      if (!response.ok) {
        throw new Error('Failed to fetch collections')
      }

      const data = await response.json()
      setCollections(data.collections)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load collections')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newCollectionName.trim()) {
      return
    }

    try {
      setCreating(true)
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newCollectionName.trim(),
          description: newCollectionDescription.trim() || undefined,
          color: newCollectionColor
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create collection')
      }

      const newCollection = await response.json()

      // Add the new collection to the list
      setCollections(prev => [newCollection, ...prev])

      // Reset form
      setNewCollectionName('')
      setNewCollectionDescription('')
      setNewCollectionColor('#3b82f6')
      setShowCreateForm(false)

      // Select the newly created collection
      onSelect(newCollection.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection')
    } finally {
      setCreating(false)
    }
  }

  const predefinedColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#f97316', '#06b6d4', '#84cc16',
    '#ec4899', '#6b7280'
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading collections...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-4">
        <p className="text-red-600 mb-4">{error}</p>
        <div className="flex space-x-2">
          <Button onClick={fetchCollections} variant="outline">
            Try Again
          </Button>
          <Button onClick={onCancel} variant="outline">
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Create New Collection Form */}
      {showCreateForm ? (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <Input
                  placeholder="Collection name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div>
                <Input
                  placeholder="Description (optional)"
                  value={newCollectionDescription}
                  onChange={(e) => setNewCollectionDescription(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="flex space-x-2">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCollectionColor(color)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        newCollectionColor === color ? 'border-gray-400' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {newCollectionColor === color && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  type="submit"
                  disabled={creating || !newCollectionName.trim()}
                  className="flex-1"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create & Select
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setShowCreateForm(true)}
          variant="outline"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Collection
        </Button>
      )}

      {!showCreateForm && (
        <>
          <Separator />

          {/* Existing Collections */}
          {collections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No collections yet</p>
              <p className="text-sm">Create your first collection above</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {collections.map((collection) => (
                <Card
                  key={collection.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onSelect(collection.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: collection.color || '#6b7280' }}
                        />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{collection.name}</span>
                            {collection.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                          {collection.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {collection.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {collection._count.posts} posts
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Separator />

          <div className="flex justify-end">
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  )
}