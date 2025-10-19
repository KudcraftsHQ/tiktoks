'use client'

import React, { useState } from 'react'
import { Link as LinkIcon, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface OriginalPostLinkerProps {
  remixId: string
  onLinked?: (linkedPost: any) => void
}

export function OriginalPostLinker({
  remixId,
  onLinked
}: OriginalPostLinkerProps) {
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [isLinking, setIsLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLink = async () => {
    if (!tiktokUrl.trim()) {
      setError('Please enter a TikTok URL')
      return
    }

    setIsLinking(true)
    setError(null)

    try {
      const response = await fetch(`/api/remixes/${remixId}/link-original`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tiktokUrl: tiktokUrl.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to link original post')
      }

      const data = await response.json()

      toast.success('Original post linked successfully!')

      if (onLinked) {
        onLinked(data.remix.originalPost)
      }

      // Refresh the page to show updated data
      window.location.reload()
    } catch (error) {
      console.error('Failed to link original post:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to link original post'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <LinkIcon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold">Link to Original Post</p>
      </div>

      <input
        type="url"
        value={tiktokUrl}
        onChange={(e) => {
          setTiktokUrl(e.target.value)
          setError(null)
        }}
        placeholder="https://www.tiktok.com/@user/video/..."
        className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
        disabled={isLinking}
      />

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md">
          <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <Button
        onClick={handleLink}
        disabled={isLinking || !tiktokUrl.trim()}
        size="sm"
        className="w-full"
      >
        {isLinking ? (
          <>
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-2"></div>
            Linking...
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5 mr-2" />
            Link Original Post
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        Note: The TikTok post must already be in your database before linking.
      </p>
    </div>
  )
}
