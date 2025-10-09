'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Image as ImageIcon,
} from 'lucide-react'
import { PostsTable } from '@/components/PostsTable'
import { Card, CardContent } from '@/components/ui/card'
import { TikTokPost } from '@/components/posts-table-columns'
import { PageLayout } from '@/components/PageLayout'
import { designTokens } from '@/lib/design-tokens'
import { toast } from 'sonner'
import { SortingState } from '@tanstack/react-table'

interface PostsResponse {
  posts: TikTokPost[]
  hasMore: boolean
  total: number
  error?: string
}

function PostsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialize state from URL params
  const initialPage = parseInt(searchParams.get('page') || '1', 10)

  // Parse sorting from URL
  const sortBy = searchParams.get('sortBy')
  const sortOrder = searchParams.get('sortOrder')
  const initialSorting: SortingState = sortBy && sortOrder
    ? [{ id: sortBy, desc: sortOrder === 'desc' }]
    : []

  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const [pageSize, setPageSize] = useState(25)
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newPostUrl, setNewPostUrl] = useState('')
  const [isAddingPost, setIsAddingPost] = useState(false)

  // Update URL with current state
  const updateURL = useCallback((page: number, sort: SortingState) => {
    const params = new URLSearchParams()

    if (page > 1) {
      params.set('page', page.toString())
    }

    if (sort.length > 0 && sort[0]?.id) {
      params.set('sortBy', sort[0].id)
      params.set('sortOrder', sort[0].desc ? 'desc' : 'asc')
    }

    const queryString = params.toString()
    const newUrl = queryString ? `?${queryString}` : '/'

    // Use shallow routing to avoid full page reload
    router.push(newUrl, { scroll: false })
  }, [router])

  const fetchPosts = useCallback(async (page: number, limit: number, sort: SortingState) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      // Add sorting parameters
      if (sort.length > 0 && sort[0]?.id) {
        params.append('sortBy', sort[0].id)
        params.append('sortOrder', sort[0].desc ? 'desc' : 'asc')
      }

      const response = await fetch(`/api/tiktok/posts?${params}`)
      const data: PostsResponse = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch posts')
      }

      setPosts(data.posts || [])
    } catch (error) {
      console.error('Failed to fetch posts:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to fetch posts')
      setPosts([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle sorting change with URL update
  const handleSortingChange = useCallback((updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
    setSorting(prevSorting => {
      const newSorting = typeof updaterOrValue === 'function'
        ? updaterOrValue(prevSorting)
        : updaterOrValue

      // Update URL and fetch with new sorting
      updateURL(currentPage, newSorting)
      fetchPosts(currentPage, pageSize, newSorting)

      return newSorting
    })
  }, [currentPage, pageSize, updateURL, fetchPosts])

  // Handle page change with URL update
  const handlePageChange = useCallback((pageIndex: number, newPageSize: number) => {
    const newPage = pageIndex + 1 // Convert 0-based to 1-based
    setCurrentPage(newPage)
    setPageSize(newPageSize)

    setSorting(currentSorting => {
      updateURL(newPage, currentSorting)
      fetchPosts(newPage, newPageSize, currentSorting)
      return currentSorting
    })
  }, [updateURL, fetchPosts])

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
        setCurrentPage(1)
        fetchPosts(1, pageSize, sorting)
        toast.success('Post imported successfully')
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to add post')
      }
    } catch (error) {
      console.error('Failed to add post:', error)
      toast.error('Failed to add post')
    } finally {
      setIsAddingPost(false)
    }
  }


  // Sync state from URL params (for browser back/forward)
  useEffect(() => {
    const sortBy = searchParams.get('sortBy')
    const sortOrder = searchParams.get('sortOrder')
    const urlSorting: SortingState = sortBy && sortOrder
      ? [{ id: sortBy, desc: sortOrder === 'desc' }]
      : []

    // Check if URL sorting is different from current state
    const isDifferent = JSON.stringify(urlSorting) !== JSON.stringify(sorting)

    if (isDifferent) {
      setSorting(urlSorting)
      fetchPosts(currentPage, pageSize, urlSorting)
    }
  }, [searchParams])

  // Initial fetch
  useEffect(() => {
    fetchPosts(initialPage, pageSize, initialSorting)
  }, [])

  return (
    <PageLayout
      title="TikTok Posts"
      description="Manage your imported TikTok content and create remixes"
      headerActions={
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
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
      }
    >
      <PostsTable
        posts={posts}
        onPageChange={handlePageChange}
        onSortingChange={handleSortingChange}
        sorting={sorting}
        enableServerSideSorting={true}
        isLoading={isLoading}
      />
    </PageLayout>
  )
}

export default function PostsPage() {
  return (
    <Suspense fallback={
      <PageLayout title="TikTok Posts" description="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    }>
      <PostsPageContent />
    </Suspense>
  )
}