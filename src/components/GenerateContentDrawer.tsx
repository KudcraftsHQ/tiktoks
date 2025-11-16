'use client'

import React, { useState, useEffect } from 'react'
import { X, Sparkles, Loader2, Package, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PostPreview {
  id: string
  tiktokUrl: string
  contentType: string
  description?: string | null
  thumbnailUrl: string | null
  authorHandle: string
  category?: { id: string; name: string } | null
  viewCount: string
  likeCount: number
}

interface ProductContext {
  id: string
  title: string
  description: string
}

interface GenerateContentDrawerProps {
  isOpen: boolean
  onClose: () => void
  selectedPostIds: string[]
  selectedPosts?: PostPreview[] // Optional: if provided, skips fetching
  onContentGenerated?: (drafts?: any[]) => void
  projectId?: string // Optional: associates generated remixes with a project
}

export function GenerateContentDrawer({
  isOpen,
  onClose,
  selectedPostIds,
  selectedPosts,
  onContentGenerated,
  projectId
}: GenerateContentDrawerProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingPosts, setIsLoadingPosts] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)

  // Post previews
  const [postPreviews, setPostPreviews] = useState<PostPreview[]>([])

  // Product contexts
  const [productContexts, setProductContexts] = useState<ProductContext[]>([])

  // Form state
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [generationStrategy, setGenerationStrategy] = useState<'remix' | 'inspired'>('remix')
  const [languageStyle, setLanguageStyle] = useState('follow the reference content language style')
  const [contentIdeas, setContentIdeas] = useState('')
  const [variationCount, setVariationCount] = useState<number | ''>('')
  const [minSlides, setMinSlides] = useState<number | ''>('')
  const [maxSlides, setMaxSlides] = useState<number | ''>('')

  // Fetch post previews when drawer opens or selectedPostIds changes (only if not provided)
  useEffect(() => {
    if (isOpen && selectedPostIds.length > 0) {
      if (selectedPosts && selectedPosts.length > 0) {
        // Use provided posts instead of fetching
        setPostPreviews(selectedPosts)
        setIsLoadingPosts(false)
      } else {
        // Fetch from API
        fetchPostPreviews()
      }
    }
  }, [isOpen, selectedPostIds, selectedPosts])

  // Fetch product contexts when drawer opens
  useEffect(() => {
    if (isOpen) {
      fetchProductContexts()
    }
  }, [isOpen])

  // Reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setSelectedProductId('')
      setGenerationStrategy('remix')
      setLanguageStyle('follow the reference content language style')
      setContentIdeas('')
      setVariationCount('')
      setMinSlides('')
      setMaxSlides('')
    }
  }, [isOpen])

  const fetchPostPreviews = async () => {
    setIsLoadingPosts(true)
    try {
      const response = await fetch('/api/tiktok/posts/batch-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postIds: selectedPostIds })
      })

      if (!response.ok) {
        throw new Error('Failed to fetch post previews')
      }

      const data = await response.json()
      setPostPreviews(data.posts || [])
    } catch (error) {
      console.error('Failed to fetch post previews:', error)
      toast.error('Failed to load post previews')
    } finally {
      setIsLoadingPosts(false)
    }
  }

  const fetchProductContexts = async () => {
    setIsLoadingProducts(true)
    try {
      const response = await fetch('/api/product-contexts')

      if (!response.ok) {
        throw new Error('Failed to fetch product contexts')
      }

      const data = await response.json()
      setProductContexts(data.productContexts || data || [])
    } catch (error) {
      console.error('Failed to fetch product contexts:', error)
      toast.error('Failed to load product contexts')
    } finally {
      setIsLoadingProducts(false)
    }
  }

  const handleGenerate = async () => {
    if (selectedPostIds.length === 0) {
      toast.error('Please select at least one post')
      return
    }

    // Ensure defaults are applied
    const finalVariationCount = variationCount === '' ? 5 : variationCount
    const finalMinSlides = minSlides === '' ? 5 : minSlides
    const finalMaxSlides = maxSlides === '' ? 8 : maxSlides

    setIsGenerating(true)
    try {
      const response = await fetch('/api/remixes/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedPostIds,
          productContextId: selectedProductId || undefined,
          projectId: projectId || undefined,
          generationStrategy,
          languageStyle,
          contentIdeas: contentIdeas.trim() || undefined,
          variationCount: finalVariationCount,
          slidesRange: {
            min: finalMinSlides,
            max: finalMaxSlides
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Generation failed')
      }

      const data = await response.json()

      toast.success(`Generated ${data.count} draft variations!`)

      // Close drawer
      onClose()

      // Optional callback - pass drafts to parent
      if (onContentGenerated) {
        onContentGenerated(data.drafts)
      }
    } catch (error) {
      console.error('Generation failed:', error)
      toast.error('Failed to generate content', {
        description: error instanceof Error ? error.message : 'Please try again'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const formatNumber = (num: string | number): string => {
    const n = typeof num === 'string' ? parseInt(num) : num
    if (n >= 1000000) {
      return `${(n / 1000000).toFixed(1)}M`
    } else if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}K`
    }
    return n.toString()
  }

  return (
    <div
      className={cn(
        "h-screen flex-shrink-0 bg-card border-l border-border flex flex-col",
        "transition-all duration-300 ease-in-out",
        isOpen ? "w-[420px]" : "w-0 border-l-0 overflow-hidden"
      )}
    >
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Generate Content</h2>
            {selectedPostIds.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedPostIds.length} selected
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Post Previews Section */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-medium">Selected Posts</h3>
              <Badge variant="secondary">{selectedPostIds.length}</Badge>
            </div>
            {isLoadingPosts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {postPreviews.map((post) => (
                  <div
                    key={post.id}
                    className="flex gap-3 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {post.thumbnailUrl && (
                      <img
                        src={post.thumbnailUrl}
                        alt="Post thumbnail"
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        @{post.authorHandle}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {post.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {post.category && (
                          <Badge variant="outline" className="text-xs truncate max-w-[120px]">
                            {post.category.name}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatNumber(post.viewCount)} views
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Generation Configuration */}
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium">Generation Settings</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure how AI generates content
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Product Context */}
              <div>
                <Label htmlFor="productContext">Product Context (Optional)</Label>
                <select
                  id="productContext"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isLoadingProducts}
                >
                  <option value="">None</option>
                  {productContexts.map((pc) => (
                    <option key={pc.id} value={pc.id}>
                      {pc.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Generation Strategy */}
              <div>
                <Label>Generation Strategy</Label>
                <RadioGroup
                  value={generationStrategy}
                  onValueChange={(value) => setGenerationStrategy(value as 'remix' | 'inspired')}
                  className="mt-2 space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="remix" id="remix" />
                    <Label htmlFor="remix" className="font-normal cursor-pointer">
                      Remix/Paraphrase (keep structure & themes)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="inspired" id="inspired" />
                    <Label htmlFor="inspired" className="font-normal cursor-pointer">
                      Create New (inspired by references)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Language Style */}
              <div>
                <Label htmlFor="languageStyle">Language Style</Label>
                <Input
                  id="languageStyle"
                  value={languageStyle}
                  onChange={(e) => setLanguageStyle(e.target.value)}
                  placeholder="e.g., casual, formal, emoji-heavy"
                  className="mt-1.5"
                />
              </div>

              {/* Content Ideas */}
              <div>
                <Label htmlFor="contentIdeas">Content Ideas (Optional)</Label>
                <Textarea
                  id="contentIdeas"
                  value={contentIdeas}
                  onChange={(e) => setContentIdeas(e.target.value)}
                  placeholder="Add any specific themes, angles, or ideas you want to explore..."
                  className="mt-1.5"
                  rows={3}
                />
              </div>

              {/* Variation Count */}
              <div>
                <Label htmlFor="variations">Number of Variations</Label>
                <Input
                  id="variations"
                  type="text"
                  inputMode="numeric"
                  value={variationCount}
                  onChange={(e) => {
                    const value = e.target.value
                    // Allow empty string or digits only
                    if (value === '' || /^\d+$/.test(value)) {
                      if (value === '') {
                        setVariationCount('')
                      } else {
                        const num = parseInt(value)
                        // Allow any number while typing (will be validated on blur)
                        setVariationCount(num)
                      }
                    }
                  }}
                  onBlur={() => {
                    // Set to default (5) if empty on blur
                    if (variationCount === '') {
                      setVariationCount(5)
                    } else {
                      // Enforce min/max constraints
                      const num = typeof variationCount === 'number' ? variationCount : parseInt(String(variationCount))
                      setVariationCount(Math.min(Math.max(num, 1), 50))
                    }
                  }}
                  className="mt-1.5"
                />
              </div>

              {/* Slides Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="minSlides">Min Slides</Label>
                  <Input
                    id="minSlides"
                    type="text"
                    inputMode="numeric"
                    value={minSlides}
                    onChange={(e) => {
                      const value = e.target.value
                      // Allow empty string or digits only
                      if (value === '' || /^\d+$/.test(value)) {
                        if (value === '') {
                          setMinSlides('')
                        } else {
                          const num = parseInt(value)
                          // Allow any number while typing (will be validated on blur)
                          setMinSlides(num)
                        }
                      }
                    }}
                    onBlur={() => {
                      // Set to default (5) if empty on blur
                      if (minSlides === '') {
                        setMinSlides(5)
                        // Also update maxSlides if it's empty or less than 5
                        if (maxSlides === '' || maxSlides < 5) {
                          setMaxSlides(8)
                        }
                      } else {
                        // Enforce min/max constraints
                        const num = typeof minSlides === 'number' ? minSlides : parseInt(String(minSlides))
                        const validMin = Math.min(Math.max(num, 3), 15)
                        setMinSlides(validMin)
                        // Ensure maxSlides is >= minSlides
                        if (maxSlides !== '' && validMin > maxSlides) {
                          setMaxSlides(validMin)
                        } else if (maxSlides === '') {
                          setMaxSlides(Math.max(validMin, 8))
                        }
                      }
                    }}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="maxSlides">Max Slides</Label>
                  <Input
                    id="maxSlides"
                    type="text"
                    inputMode="numeric"
                    value={maxSlides}
                    onChange={(e) => {
                      const value = e.target.value
                      // Allow empty string or digits only
                      if (value === '' || /^\d+$/.test(value)) {
                        if (value === '') {
                          setMaxSlides('')
                        } else {
                          const num = parseInt(value)
                          // Allow any number while typing (will be validated on blur)
                          setMaxSlides(num)
                        }
                      }
                    }}
                    onBlur={() => {
                      // Set to default (8) if empty on blur
                      if (maxSlides === '') {
                        setMaxSlides(8)
                        // Also update minSlides if it's empty or greater than 8
                        if (minSlides === '' || minSlides > 8) {
                          setMinSlides(5)
                        }
                      } else {
                        // Enforce min/max constraints
                        const num = typeof maxSlides === 'number' ? maxSlides : parseInt(String(maxSlides))
                        const effectiveMin = minSlides === '' ? 5 : minSlides
                        const validMax = Math.min(Math.max(num, effectiveMin), 20)
                        setMaxSlides(validMax)
                      }
                    }}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Generate Button - Fixed at bottom */}
      <div className="px-4 py-3 border-t border-border bg-background flex-shrink-0">
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || selectedPostIds.length === 0}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating {variationCount === '' ? 5 : variationCount} Variations...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate {variationCount === '' ? 5 : variationCount} Variations
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
