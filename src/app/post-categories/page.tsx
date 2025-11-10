'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Tag,
  Calendar,
  TrendingUp,
  Sparkles,
  User
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PageLayout } from '@/components/PageLayout'
import { designTokens } from '@/lib/design-tokens'

interface PostCategory {
  id: string
  name: string
  description: string | null
  aiGenerated: boolean
  postCount: number
  createdAt: string
  updatedAt: string
}

export default function PostCategoriesPage() {
  const [categories, setCategories] = useState<PostCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<PostCategory | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchCategories = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/post-categories')
      const result = await response.json()
      if (result.success) {
        setCategories(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch post categories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCategories()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: ''
    })
    setEditingCategory(null)
  }

  const handleAddCategory = async () => {
    if (!formData.name.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/post-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setShowAddDialog(false)
        resetForm()
        fetchCategories()
      } else {
        alert(result.error || 'Failed to create category')
      }
    } catch (error) {
      console.error('Failed to create category:', error)
      alert('Failed to create category')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditCategory = async () => {
    if (!editingCategory || !formData.name.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/post-categories/${editingCategory.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setShowEditDialog(false)
        resetForm()
        fetchCategories()
      } else {
        alert(result.error || 'Failed to update category')
      }
    } catch (error) {
      console.error('Failed to update category:', error)
      alert('Failed to update category')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCategory = async (id: string, postCount: number) => {
    if (postCount > 0) {
      alert(`Cannot delete category with ${postCount} associated posts. Reassign posts first.`)
      return
    }

    if (!confirm('Are you sure you want to delete this category?')) return

    try {
      const response = await fetch(`/api/post-categories/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok) {
        fetchCategories()
      } else {
        alert(result.error || 'Failed to delete category')
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
      alert('Failed to delete category')
    }
  }

  const openEditDialog = (category: PostCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || ''
    })
    setShowEditDialog(true)
  }

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  useEffect(() => {
    fetchCategories()
  }, [])

  return (
    <PageLayout
      title="Post Categories"
      description="Manage TikTok post content categories"
      headerActions={
        <Dialog open={showAddDialog} onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Post Category</DialogTitle>
              <DialogDescription>
                Create a new category for classifying TikTok posts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., tips&tricks, lessons, tutorial..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what types of posts fit this category..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddCategory}
                disabled={!formData.name.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        {/* Search Bar */}
        <Card>
          <CardContent className={designTokens.spacing.cardContent.responsive}>
            <form onSubmit={handleSearch}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search categories..."
                  className="pl-10"
                />
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Categories</p>
                  <p className="text-2xl font-bold">{categories.length}</p>
                </div>
                <Tag className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">AI Generated</p>
                  <p className="text-2xl font-bold">
                    {categories.filter(c => c.aiGenerated).length}
                  </p>
                </div>
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Manual Created</p>
                  <p className="text-2xl font-bold">
                    {categories.filter(c => !c.aiGenerated).length}
                  </p>
                </div>
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {filteredCategories.length === 0 && !isLoading ? (
          <Card>
            <CardContent className={`${designTokens.spacing.cardContent.responsive} text-center py-12`}>
              <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Tag className="h-8 w-8 opacity-50" />
              </div>
              <h3 className="font-medium mb-2">No categories yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first category or let AI generate them automatically during OCR processing
              </p>
              <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create First Category
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Categories Grid */}
            <div className={`${designTokens.grid.responsive.cols3} gap-6`}>
              {filteredCategories.map((category) => (
                <Card key={category.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <CardTitle className="text-lg truncate">{category.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(category)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteCategory(category.id, category.postCount)}
                          disabled={category.postCount > 0}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {category.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {category.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {category.aiGenerated ? (
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          AI Generated
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <User className="h-3 w-3 mr-1" />
                          Manual
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {category.postCount} posts
                      </Badge>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(category.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open)
          if (!open) resetForm()
        }}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
              <DialogDescription>
                Update category name and description
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Category Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., tips&tricks, lessons, tutorial..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (Optional)</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what types of posts fit this category..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditCategory}
                disabled={!formData.name.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  'Update'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageLayout>
  )
}
