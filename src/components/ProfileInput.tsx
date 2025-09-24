'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2 } from 'lucide-react'

interface ProfileInputProps {
  onSubmit: (handle: string) => void
  loading?: boolean
  placeholder?: string
}

export function ProfileInput({ onSubmit, loading = false, placeholder }: ProfileInputProps) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const extractHandle = (input: string): string | null => {
    const trimmed = input.trim()

    if (!trimmed) {
      return null
    }

    // If it's already a handle (starts with @)
    if (trimmed.startsWith('@')) {
      const handle = trimmed.slice(1)
      if (/^[a-zA-Z0-9._-]+$/.test(handle)) {
        return handle
      }
      return null
    }

    // If it's a TikTok URL, extract the handle
    const urlPatterns = [
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9._-]+)/i,
      /(?:https?:\/\/)?(?:vm\.)?tiktok\.com\/([a-zA-Z0-9._-]+)/i,
      /(?:https?:\/\/)?(?:m\.)?tiktok\.com\/@([a-zA-Z0-9._-]+)/i
    ]

    for (const pattern of urlPatterns) {
      const match = trimmed.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }

    // If it's just a plain handle without @
    if (/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
      return trimmed
    }

    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const handle = extractHandle(input)

    if (!handle) {
      setError('Please enter a valid TikTok handle or profile URL')
      return
    }

    onSubmit(handle)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex space-x-2">
        <div className="flex-1">
          <Input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              if (error) setError(null)
            }}
            placeholder={placeholder || "Enter TikTok handle or profile URL"}
            disabled={loading}
            className={error ? 'border-red-300 focus:border-red-500' : ''}
          />
          {error && (
            <p className="text-sm text-red-600 mt-1">{error}</p>
          )}
        </div>
        <Button type="submit" disabled={loading || !input.trim()}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              Explore
            </>
          )}
        </Button>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Supported formats:</strong></p>
        <ul className="list-disc list-inside space-y-0.5 ml-2">
          <li>Handle: username or @username</li>
          <li>Profile URL: https://www.tiktok.com/@username</li>
          <li>Mobile URL: https://vm.tiktok.com/username</li>
        </ul>
      </div>
    </form>
  )
}