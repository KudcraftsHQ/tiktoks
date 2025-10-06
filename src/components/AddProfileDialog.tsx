'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { UserPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface AddProfileDialogProps {
  onProfileAdded?: () => void
}

export function AddProfileDialog({ onProfileAdded }: AddProfileDialogProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [loading, setLoading] = useState(false)

  const extractHandle = (input: string): string => {
    const trimmed = input.trim()

    // If it's a URL
    if (trimmed.includes('tiktok.com')) {
      const match = trimmed.match(/@([a-zA-Z0-9_.]+)/)
      return match ? match[1] : ''
    }

    // If it starts with @, remove it
    if (trimmed.startsWith('@')) {
      return trimmed.slice(1)
    }

    // Otherwise assume it's just the handle
    return trimmed
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const handle = extractHandle(input)
    if (!handle) {
      toast.error('Invalid input', {
        description: 'Please enter a valid TikTok handle or profile URL'
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/tiktok/profiles/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          handle,
          isOwnProfile
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add profile')
      }

      if (result.processing) {
        // Background processing
        toast.info('Processing profile', {
          description: `Fetching profile @${handle} and posts in the background. This may take a few minutes.`
        })
      } else {
        // Immediate success
        toast.success('Profile added', {
          description: `@${handle} has been added successfully`
        })
      }

      setOpen(false)
      setInput('')
      setIsOwnProfile(false)

      if (onProfileAdded) {
        onProfileAdded()
      }
    } catch (err) {
      console.error('Failed to add profile:', err)
      toast.error('Failed to add profile', {
        description: err instanceof Error ? err.message : 'An error occurred'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="w-full">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add TikTok Profile</DialogTitle>
          <DialogDescription>
            Enter a TikTok handle or profile URL to add it to your database
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-input">TikTok Handle or URL</Label>
            <Input
              id="profile-input"
              placeholder="@username or https://www.tiktok.com/@username"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="own-profile" className="text-base">
                Mark as my profile
              </Label>
              <p className="text-sm text-muted-foreground">
                This profile belongs to me
              </p>
            </div>
            <Switch
              id="own-profile"
              checked={isOwnProfile}
              onCheckedChange={setIsOwnProfile}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !input.trim()}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Profile'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
