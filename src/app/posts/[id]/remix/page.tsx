'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Sparkles,
  Edit,
  Download,
  Trash2,
  Eye,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  Palette,
  Users,
  Target
} from 'lucide-react'
import { cacheAssetService } from '@/lib/cache-asset-service'

interface TikTokPost {
  id: string
  tiktokUrl: string
  contentType: string
  title?: string
  description?: string
  authorNickname?: string
  authorHandle?: string
  images: Array<{ cacheAssetId: string; width: number; height: number }>
  ocrStatus: string
  ocrProcessedAt?: string
  ocrTexts: Array<{ imageIndex: number; text: string; success: boolean; error?: string }>
}

interface RemixPost {
  id: string
  name: string
  description?: string
  generationType: string
  createdAt: string
  slides: Array<{
    id: string
    displayOrder: number
    textBoxes: Array<{
      id: string
      text: string
    }>
  }>
}

interface RemixPageProps {
  params: { id: string }
}

export default function RemixPage({ params }: RemixPageProps) {
  const router = useRouter()
  const [post, setPost] = useState<TikTokPost | null>(null)
  const [remixes, setRemixes] = useState<RemixPost[]>([])
  const [originalImageUrls, setOriginalImageUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingRemix, setIsCreatingRemix] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isRunningOCR, setIsRunningOCR] = useState(false)

  // Form states
  const [remixName, setRemixName] = useState('')
  const [remixDescription, setRemixDescription] = useState('')
  const [remixTheme, setRemixTheme] = useState('')
  const [remixStyle, setRemixStyle] = useState<'casual' | 'professional' | 'trendy' | 'educational' | 'humorous'>('casual')
  const [targetAudience, setTargetAudience] = useState('')

  useEffect(() => {
    fetchPostAndRemixes()
  }, [params.id])

  useEffect(() => {
    if (post?.images.length) {
      loadOriginalImages()
    }
  }, [post])

  const fetchPostAndRemixes = async () => {
    setIsLoading(true)
    try {
      // Fetch post details
      const postResponse = await fetch(`/api/tiktok/posts/${params.id}`)
      if (!postResponse.ok) {
        throw new Error('Failed to fetch post')
      }
      const postData = await postResponse.json()
      setPost(postData)

      // Fetch existing remixes
      const remixResponse = await fetch(`/api/tiktok/posts/${params.id}/remix`)
      if (remixResponse.ok) {
        const remixData = await remixResponse.json()
        setRemixes(remixData.remixes || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      setError('Failed to load post data')
    } finally {
      setIsLoading(false)
    }
  }

  const loadOriginalImages = async () => {
    if (!post?.images.length) return

    try {
      const cacheAssetIds = post.images.map(img => img.cacheAssetId)
      const urls = await cacheAssetService.getUrls(cacheAssetIds)
      setOriginalImageUrls(urls)
    } catch (error) {
      console.error('Failed to load original images:', error)
    }
  }

  const runOCR = async () => {
    if (!post) return

    setIsRunningOCR(true)
    try {
      const response = await fetch(`/api/tiktok/posts/${post.id}/ocr`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('OCR processing failed')
      }

      // Refresh the post data to get updated OCR status
      await fetchPostAndRemixes()
    } catch (error) {
      console.error('OCR failed:', error)
      setError('Failed to run OCR processing')
    } finally {
      setIsRunningOCR(false)
    }
  }

  const createRemix = async () => {
    if (!post || !remixName.trim()) return

    setIsCreatingRemix(true)
    try {
      const response = await fetch(`/api/tiktok/posts/${post.id}/remix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: remixName.trim(),
          description: remixDescription.trim() || undefined,
          options: {
            theme: remixTheme.trim() || undefined,
            style: remixStyle,
            targetAudience: targetAudience.trim() || undefined
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || 'Failed to create remix')
      }

      const result = await response.json()
      console.log('✅ Remix created successfully:', result)

      // Close dialog and refresh data
      setShowCreateDialog(false)
      setRemixName('')
      setRemixDescription('')
      setRemixTheme('')
      setTargetAudience('')
      await fetchPostAndRemixes()

    } catch (error) {
      console.error('Failed to create remix:', error)
      setError(error instanceof Error ? error.message : 'Failed to create remix')
    } finally {
      setIsCreatingRemix(false)
    }
  }

  const deleteRemix = async (remixId: string) => {
    if (!confirm('Are you sure you want to delete this remix?')) return

    try {
      const response = await fetch(`/api/remixes/${remixId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete remix')
      }

      await fetchPostAndRemixes()
    } catch (error) {
      console.error('Failed to delete remix:', error)
      setError('Failed to delete remix')
    }
  }

  const downloadRemix = async (remixId: string) => {
    try {
      console.log(`📦 Starting download for remix: ${remixId}`)

      const response = await fetch(`/api/remixes/${remixId}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format: 'png',
          quality: 0.95
        })
      })

      if (!response.ok) {
        throw new Error('Failed to export remix')
      }

      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `remix-${remixId}-export.zip`

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      window.URL.revokeObjectURL(url)

      console.log(`✅ Download completed for remix: ${remixId}`)
    } catch (error) {
      console.error('Failed to download remix:', error)
      setError('Failed to download remix')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          <span>Loading remix studio...</span>
        </div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error || 'Post not found'}</p>
          <Button onClick={() => router.push('/posts')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Posts
          </Button>
        </div>
      </div>
    )
  }

  const getOCRStatusIcon = () => {
    switch (post.ocrStatus) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'processing':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const canCreateRemix = post.contentType === 'photo' && post.ocrStatus === 'completed'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push('/posts')}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Posts
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">
                Remix Studio
              </h1>
              <p className="text-sm text-muted-foreground">
                Create variations of "{post.authorNickname || post.authorHandle}"'s content
              </p>
            </div>
            <div className="flex items-center gap-2">
              {post.contentType === 'photo' && (
                <>
                  <Button
                    onClick={runOCR}
                    disabled={isRunningOCR || post.ocrStatus === 'processing'}
                    variant="outline"
                    size="sm"
                  >
                    {getOCRStatusIcon()}
                    <span className="ml-2">
                      {post.ocrStatus === 'completed' ? 'OCR Complete' :
                       post.ocrStatus === 'processing' ? 'Processing...' :
                       isRunningOCR ? 'Running OCR...' : 'Run OCR'}
                    </span>
                  </Button>
                  <Button
                    onClick={() => setShowCreateDialog(true)}
                    disabled={!canCreateRemix}
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Remix
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Original Post Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Original Post
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={post.contentType === 'photo' ? 'default' : 'secondary'}>
                  {post.contentType}
                </Badge>
                <Badge variant={post.ocrStatus === 'completed' ? 'default' :
                              post.ocrStatus === 'processing' ? 'secondary' : 'outline'}>
                  OCR: {post.ocrStatus}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Post Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Author</p>
                <p className="font-medium">{post.authorNickname || post.authorHandle}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">TikTok URL</p>
                <a
                  href={post.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:underline"
                >
                  View Original
                </a>
              </div>
            </div>

            {post.description && (
              <div>
                <p className="text-sm text-muted-foreground">Caption</p>
                <p className="text-sm">{post.description}</p>
              </div>
            )}

            {/* Original Images */}
            {post.contentType === 'photo' && originalImageUrls.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Original Images ({originalImageUrls.length})</p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {originalImageUrls.map((url, index) => (
                    <div key={index} className="flex-shrink-0">
                      <div className="w-32 h-48 bg-muted rounded-lg overflow-hidden border">
                        {url ? (
                          <img
                            src={url}
                            alt={`Original ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            Loading...
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-center mt-1 text-muted-foreground">
                        Slide {index + 1}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* OCR Results */}
            {post.ocrTexts.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">Extracted Text</p>
                <div className="space-y-2">
                  {post.ocrTexts.map((ocr, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">Slide {ocr.imageIndex + 1}</span>
                        <Badge variant={ocr.success ? 'default' : 'destructive'} className="text-xs">
                          {ocr.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                      {ocr.success ? (
                        <p className="text-sm">{ocr.text}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {ocr.error || 'OCR extraction failed'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Remixes Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Remixes ({remixes.length})
              </CardTitle>
              {canCreateRemix && (
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create New Remix
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {remixes.length === 0 ? (
              <div className="text-center py-12">
                <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 opacity-50" />
                </div>
                <h3 className="font-medium mb-2">No remixes yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {!canCreateRemix
                    ? 'Complete OCR processing to create your first remix'
                    : 'Create your first remix variation of this content'
                  }
                </p>
                {canCreateRemix && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create First Remix
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {remixes.map((remix) => (
                  <div key={remix.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{remix.name}</h4>
                        {remix.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {remix.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          onClick={() => router.push(`/remix/${remix.id}/edit`)}
                          size="sm"
                          variant="outline"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={() => deleteRemix(remix.id)}
                          size="sm"
                          variant="outline"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{remix.slides.length} slides</span>
                        <Badge variant="outline" className="text-xs">
                          {remix.generationType}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Created {new Date(remix.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => router.push(`/remix/${remix.id}/edit`)}
                        size="sm"
                        className="flex-1"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadRemix(remix.id)}
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Remix Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Create New Remix
            </DialogTitle>
            <DialogDescription>
              Generate AI-powered variations of the original content with custom styling and themes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Remix Name</label>
              <Input
                value={remixName}
                onChange={(e) => setRemixName(e.target.value)}
                placeholder="e.g., Professional Version"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={remixDescription}
                onChange={(e) => setRemixDescription(e.target.value)}
                placeholder="Brief description of this remix variation..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Palette className="h-3 w-3" />
                  Writing Style
                </label>
                <Select value={remixStyle} onValueChange={setRemixStyle as (value: string) => void}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="trendy">Trendy</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="humorous">Humorous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Theme (optional)
                </label>
                <Input
                  value={remixTheme}
                  onChange={(e) => setRemixTheme(e.target.value)}
                  placeholder="e.g., Minimalist"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium flex items-center gap-1">
                <Users className="h-3 w-3" />
                Target Audience (optional)
              </label>
              <Input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Young professionals"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreatingRemix}
            >
              Cancel
            </Button>
            <Button
              onClick={createRemix}
              disabled={!remixName.trim() || isCreatingRemix}
            >
              {isCreatingRemix ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Create Remix
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}