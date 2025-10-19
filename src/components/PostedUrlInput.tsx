'use client'

import React, { useState } from 'react'
import { Link as LinkIcon, X, Check, ExternalLink, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface LinkedPost {
  id: string
  tiktokUrl: string
  viewCount: string
  likeCount: number
  shareCount: number
  commentCount: number
  saveCount: number
  profile: {
    isOwnProfile: boolean
  }
}

interface PostedUrlInputProps {
  remixId: string
  initialPostedUrl?: string | null
  initialLinkedPost?: LinkedPost | null
  onUrlChange?: (url: string | null, linkedPost: LinkedPost | null) => void
}

export function PostedUrlInput({
  remixId,
  initialPostedUrl,
  initialLinkedPost,
  onUrlChange
}: PostedUrlInputProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [postedUrl, setPostedUrl] = useState(initialPostedUrl || '')
  const [linkedPost, setLinkedPost] = useState<LinkedPost | null>(initialLinkedPost || null)
  const [inputValue, setInputValue] = useState(initialPostedUrl || '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const response = await fetch(`/api/remixes/${remixId}/posted`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postedUrl: inputValue || null
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update posted URL')
      }

      const data = await response.json()

      setPostedUrl(data.postedUrl || '')
      setLinkedPost(data.linkedPost || null)
      setIsEditing(false)

      if (onUrlChange) {
        onUrlChange(data.postedUrl, data.linkedPost)
      }

      if (data.linkedPost) {
        toast.success('Posted URL saved and linked to existing post')
      } else if (data.postedUrl) {
        toast.success('Posted URL saved')
      } else {
        toast.success('Posted URL cleared')
      }
    } catch (error) {
      console.error('Failed to save posted URL:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save posted URL')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setInputValue(postedUrl)
    setIsEditing(false)
  }

  const handleClear = async () => {
    setInputValue('')
    await handleSave()
  }

  if (!isEditing && !postedUrl) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-all"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        Add Posted URL
      </button>
    )
  }

  if (!isEditing && postedUrl) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-all group">
          <a
            href={postedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex-1 truncate font-medium flex items-center gap-1.5"
          >
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            View Posted
          </a>
          <button
            onClick={() => setIsEditing(true)}
            className="opacity-0 group-hover:opacity-100 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all"
            title="Edit URL"
          >
            <Edit className="h-3 w-3" />
          </button>
          <button
            onClick={handleClear}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
            title="Remove URL"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
        {linkedPost && linkedPost.profile.isOwnProfile && (
          <div className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1 px-2">
            <Check className="h-2.5 w-2.5" />
            <span>Linked to own post</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <input
        type="url"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="https://www.tiktok.com/@user/video/..."
        className="w-full px-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isSaving}
      />
      <div className="flex gap-1">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          size="sm"
          className="flex-1 text-xs"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          onClick={handleCancel}
          disabled={isSaving}
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
