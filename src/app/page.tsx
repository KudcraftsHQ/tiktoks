'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  Eye,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
  Users
} from 'lucide-react'

interface TikTokPost {
  id: string
  tiktokUrl: string
  contentType: string
  title?: string
  description?: string
  authorNickname?: string
  authorHandle?: string
  images: Array<{ cacheAssetId: string; width: number; height: number; url?: string }>
  ocrStatus: string
  ocrProcessedAt?: string
  ocrTexts: Array<{ imageIndex: number; text: string; success: boolean; error?: string }>
  viewCount: bigint
  likeCount: number
  shareCount: number
  commentCount: number
  publishedAt?: string
  createdAt: string
  _count: {
    remixes: number
  }
  profile: {
    handle: string
    nickname?: string
    avatarId?: string
  }
}

interface PostsResponse {
  posts: TikTokPost[]
  hasMore: boolean
  total: number
}

export default function PostsPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newPostUrl, setNewPostUrl] = useState('')
  const [isAddingPost, setIsAddingPost] = useState(false)

  const fetchPosts = async (pageNum: number, query: string = '') => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
        ...(query && { search: query })
      })

      const response = await fetch(`/api/tiktok/posts?${params}`)
      const data: PostsResponse = await response.json()

      if (pageNum === 1) {
        setPosts(data.posts)
      } else {
        setPosts(prev => [...prev, ...data.posts])
      }

      setHasMore(data.hasMore)
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchPosts(1, searchQuery)
  }

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchPosts(nextPage, searchQuery)
    }
  }

  const handleAddPost = async () => {
    if (!newPostUrl.trim()) return

    setIsAddingPost(true)
    try {
      const response = await fetch('/api/tiktok/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: newPostUrl.trim() }),
      })

      if (response.ok) {
        setShowAddDialog(false)
        setNewPostUrl('')
        setPage(1)
        fetchPosts(1, searchQuery)
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to add post')
      }
    } catch (error) {
      console.error('Failed to add post:', error)
      alert('Failed to add post')
    } finally {
      setIsAddingPost(false)
    }
  }


  useEffect(() => {
    fetchPosts(1)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-background relative">
      {/* Header - Sticky, outside scroll */}
      <header className="border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">TikTok Posts</h1>
              <p className="text-muted-foreground">
                Manage your imported TikTok content and create remixes
              </p>
            </div>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Import TikTok Post
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Import TikTok Post</DialogTitle>
                  <DialogDescription>
                    Enter a TikTok URL to import the post and create remixes from it
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={newPostUrl}
                    onChange={(e) => setNewPostUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@username/video/..."
                    className="w-full"
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                    disabled={isAddingPost}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddPost}
                    disabled={!newPostUrl.trim() || isAddingPost}
                  >
                    {isAddingPost ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Import Post
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search posts..."
                className="pl-10"
              />
            </div>
          </form>
        </div>
      </header>

      {/* Main Content Container - This handles all scrolling */}
      <div className="flex-1 overflow-auto">
        {posts.length === 0 && !isLoading ? (
          <div className="text-center py-12">
            <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="h-8 w-8 opacity-50" />
            </div>
            <h3 className="font-medium mb-2">No posts yet</h3>
            <p className="text-muted-foreground mb-4">
              Import your first TikTok post to get started with creating remixes
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Import First Post
            </Button>
          </div>
        ) : (
          <>
            {/* Posts Table Layout */}
            <div className="min-w-max">

                  {/* Header Row with Slide Numbers */}
                  <div className="flex border-b bg-background sticky top-0 z-1000">
                    {/* Post Information Column Header */}
                    <div className="w-80 border-r bg-foreground-primary p-4 flex-shrink-0 sticky left-0 bg-background">
                      <h3 className="font-semibold text-sm">Posts & Details</h3>
                    </div>

                    {/* Dynamic Slides Header Columns */}
                    {posts.length > 0 && (
                      <div className="flex">
                        {Array.from({ length: Math.max(...posts.map(post => post.images.length)) }).map((_, index) => (
                          <div key={index} className="w-72 border-r p-4 text-center">
                            <p className="text-sm font-medium">Slide {index + 1}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions Column Header */}
                    <div className="w-48 p-4 flex-shrink-0 sticky right-0 bg-background">
                      <h3 className="font-semibold text-sm">Actions</h3>
                    </div>
                  </div>
                  {posts.map((post) => {
                    const maxSlidesCount = Math.max(post.images.length, 1)

                    const originalSlides = post.contentType === 'photo' && post.images ? post.images.map((image, index) => {
                      const ocrTexts = typeof post.ocrTexts === 'string'
                        ? JSON.parse(post.ocrTexts || '[]')
                        : post.ocrTexts || []
                      const ocrResult = Array.isArray(ocrTexts)
                        ? ocrTexts.find(ocr => ocr.imageIndex === index)
                        : null
                      return {
                        image: image,
                        text: ocrResult?.success ? ocrResult.text : 'No text',
                        slideNumber: index + 1
                      }
                    }) : []

                    return (
                      <div key={post.id} className="flex border-b">
                        {/* Post Information Column */}
                        <div className="w-80 border-r p-4 bg-background flex-shrink-0 sticky left-0 z-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="h-4 w-4 text-blue-500" />
                            <h3 className="font-semibold text-sm">
                              {post.authorNickname || post.authorHandle}
                            </h3>
                          </div>

                          <div className="space-y-3 text-xs">
                            {/* Badges */}
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant={post.contentType === 'photo' ? 'default' : 'secondary'} className="text-xs">
                                {post.contentType}
                              </Badge>
                              <Badge variant={post.ocrStatus === 'completed' ? 'default' :
                                            post.ocrStatus === 'processing' ? 'secondary' : 'outline'} className="text-xs">
                                {post.ocrStatus}
                              </Badge>
                            </div>

                            {/* Caption */}
                            {post.description && (
                              <div>
                                <p className="text-muted-foreground">Caption</p>
                                <p className="text-xs leading-relaxed">{post.description}</p>
                              </div>
                            )}

                            {/* Stats */}
                            <div>
                              <p className="text-muted-foreground">Slides</p>
                              <p className="font-medium">{post.images.length} slides</p>
                            </div>

                            <div>
                              <p className="text-muted-foreground">Remixes</p>
                              <p className="font-medium">{post._count.remixes} remixes</p>
                            </div>

                            {/* TikTok Link */}
                            <div>
                              <a
                                href={post.tiktokUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline text-xs"
                              >
                                View Original on TikTok →
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Image Columns */}
                        <div className="flex">
                          {Array.from({ length: maxSlidesCount }).map((_, slideIndex) => {
                            const slide = originalSlides[slideIndex]
                            return (
                              <div key={slideIndex} className="w-72 border-r p-4">
                                {slide ? (
                                  <div className="space-y-3">
                                    {/* Image */}
                                    <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden border">
                                      {slide.image.url ? (
                                        <img
                                          src={slide.image.url}
                                          alt={`Slide ${slide.slideNumber}`}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                          Image unavailable
                                        </div>
                                      )}
                                    </div>
                                    {/* Text Content */}
                                    <div className="bg-muted/30 rounded p-2 text-xs">
                                      <p className="text-foreground leading-relaxed">
                                        {slide.text ? slide.text.substring(0, 150) + (slide.text.length > 150 ? '...' : '') : 'No text available'}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                                    No slide
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>

                        {/* Actions Column */}
                        <div className="w-48 p-4 flex-shrink-0 sticky right-0 bg-background">
                          <div className="space-y-2">
                            <Button
                              onClick={() => router.push(`/posts/${post.id}/remix`)}
                              size="sm"
                              variant="outline"
                              className="w-full"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View
                            </Button>
                            {post.contentType === 'photo' && post.ocrStatus === 'completed' && (
                              <Button
                                size="sm"
                                onClick={() => router.push(`/posts/${post.id}/remix`)}
                                className="w-full"
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                Remix
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(post.tiktokUrl, '_blank')}
                              className="w-full"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              TikTok
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="text-center py-8">
                <Button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  variant="outline"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    'Load More Posts'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}