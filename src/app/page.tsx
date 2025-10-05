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
  Image as ImageIcon,
} from 'lucide-react'
import { PostsTable } from '@/components/PostsTable'
import { Card, CardContent } from '@/components/ui/card'
import { TikTokPost } from '@/components/posts-table-columns'
import { PageLayout } from '@/components/PageLayout'
import { designTokens } from '@/lib/design-tokens'
import { toast } from 'sonner'

interface PostsResponse {
  posts: TikTokPost[]
  hasMore: boolean
  total: number
  error?: string
}

export default function PostsPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<TikTokPost[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newPostUrl, setNewPostUrl] = useState('')
  const [isAddingPost, setIsAddingPost] = useState(false)

  const fetchPosts = async (page: number, limit: number) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

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
  }

  const handlePageChange = (pageIndex: number, newPageSize: number) => {
    const newPage = pageIndex + 1 // Convert 0-based to 1-based
    setCurrentPage(newPage)
    setPageSize(newPageSize)
    fetchPosts(newPage, newPageSize)
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
        setCurrentPage(1)
        fetchPosts(1, pageSize)
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


  useEffect(() => {
    fetchPosts(1, pageSize)
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
        isLoading={isLoading}
      />
    </PageLayout>
  )
}