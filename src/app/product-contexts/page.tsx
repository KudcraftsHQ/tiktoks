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
  FileText,
  Calendar,
  Clock
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PageLayout } from '@/components/PageLayout'
import { designTokens } from '@/lib/design-tokens'

interface ProductContext {
  id: string
  title: string
  description: string
  createdAt: string
  updatedAt: string
}

export default function ProductContextsPage() {
  const [productContexts, setProductContexts] = useState<ProductContext[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingContext, setEditingContext] = useState<ProductContext | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchProductContexts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/product-contexts')
      const data = await response.json()
      setProductContexts(data)
    } catch (error) {
      console.error('Failed to fetch product contexts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchProductContexts()
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: ''
    })
    setEditingContext(null)
  }

  const handleAddContext = async () => {
    if (!formData.title.trim() || !formData.description.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/product-contexts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim()
        }),
      })

      if (response.ok) {
        setShowAddDialog(false)
        resetForm()
        fetchProductContexts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create product context')
      }
    } catch (error) {
      console.error('Failed to create product context:', error)
      alert('Failed to create product context')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditContext = async () => {
    if (!editingContext || !formData.title.trim() || !formData.description.trim()) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/product-contexts/${editingContext.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim()
        }),
      })

      if (response.ok) {
        setShowEditDialog(false)
        resetForm()
        fetchProductContexts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update product context')
      }
    } catch (error) {
      console.error('Failed to update product context:', error)
      alert('Failed to update product context')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteContext = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product context?')) return

    try {
      const response = await fetch(`/api/product-contexts/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchProductContexts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete product context')
      }
    } catch (error) {
      console.error('Failed to delete product context:', error)
      alert('Failed to delete product context')
    }
  }

  const openEditDialog = (context: ProductContext) => {
    setEditingContext(context)
    setFormData({
      title: context.title,
      description: context.description
    })
    setShowEditDialog(true)
  }

  const filteredContexts = productContexts.filter(context =>
    context.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    context.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    fetchProductContexts()
  }, [])

  return (
    <PageLayout
      title="Product Contexts"
      description="Manage product information and prompt descriptions"
      headerActions={
        <Dialog open={showAddDialog} onOpenChange={(open) => {
          setShowAddDialog(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Product Context
            </Button>
          </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Product Context</DialogTitle>
                  <DialogDescription>
                    Create a new product context with title and prompt description
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Enter product title..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Enter product prompt description..."
                      rows={4}
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
                    onClick={handleAddContext}
                    disabled={!formData.title.trim() || !formData.description.trim() || isSubmitting}
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
                  placeholder="Search product contexts..."
                  className="pl-10"
                />
              </div>
            </form>
          </CardContent>
        </Card>

        {filteredContexts.length === 0 && !isLoading ? (
          <Card>
            <CardContent className={`${designTokens.spacing.cardContent.responsive} text-center py-12`}>
              <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 opacity-50" />
              </div>
              <h3 className="font-medium mb-2">No product contexts yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first product context to store product information and prompts
              </p>
              <Button onClick={() => setShowAddDialog(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Create First Context
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Product Contexts Grid */}
            <div className={`${designTokens.grid.responsive.cols3} gap-6`}>
              {filteredContexts.map((context) => (
                <Card key={context.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">{context.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(context)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteContext(context.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-4">
                      {context.description}
                    </p>

                    <Separator />

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Created: {new Date(context.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Updated: {new Date(context.updatedAt).toLocaleDateString()}</span>
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
            <DialogTitle>Edit Product Context</DialogTitle>
            <DialogDescription>
              Update product context information and prompt description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter product title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter product prompt description..."
                rows={4}
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
              onClick={handleEditContext}
              disabled={!formData.title.trim() || !formData.description.trim() || isSubmitting}
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