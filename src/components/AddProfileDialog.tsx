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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { UserPlus, Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AddProfileDialogProps {
  onProfileAdded?: () => void
}

export function AddProfileDialog({ onProfileAdded }: AddProfileDialogProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [input, setInput] = useState('')
  const [bulkInput, setBulkInput] = useState('')
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

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Parse profiles from textarea (one per line)
    const lines = bulkInput.split('\n').filter(line => line.trim())

    if (lines.length === 0) {
      toast.error('No profiles to add', {
        description: 'Please enter at least one profile handle or URL'
      })
      return
    }

    // Extract handles
    const handles = lines.map(line => extractHandle(line)).filter(Boolean)

    if (handles.length === 0) {
      toast.error('No valid profiles found', {
        description: 'Please check your input and try again'
      })
      return
    }

    setLoading(true)

    try {
      // Process profiles in parallel
      const results = await Promise.allSettled(
        handles.map(handle =>
          fetch('/api/tiktok/profiles/add', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              handle,
              isOwnProfile
            })
          }).then(res => res.json())
        )
      )

      // Count successes and failures
      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      if (successful > 0) {
        toast.success(`Added ${successful} profile${successful !== 1 ? 's' : ''}`, {
          description: failed > 0
            ? `${failed} profile${failed !== 1 ? 's' : ''} failed to add`
            : 'All profiles are being processed in the background'
        })
      } else {
        toast.error('Failed to add profiles', {
          description: 'All profiles failed to add. Please try again.'
        })
      }

      setOpen(false)
      setBulkInput('')
      setIsOwnProfile(false)

      if (onProfileAdded) {
        onProfileAdded()
      }
    } catch (err) {
      console.error('Failed to add profiles:', err)
      toast.error('Failed to add profiles', {
        description: err instanceof Error ? err.message : 'An error occurred'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="w-full sm:w-auto h-8 px-3 text-xs">
          <UserPlus className="w-3 h-3 mr-2" />
          Add Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add TikTok Profile</DialogTitle>
          <DialogDescription>
            Add one or multiple TikTok profiles to your database
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'single' | 'bulk')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="gap-2">
              <UserPlus className="w-3 h-3" />
              Single
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Users className="w-3 h-3" />
              Bulk
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single">
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
          </TabsContent>

          <TabsContent value="bulk">
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-input">TikTok Handles or URLs</Label>
                <Textarea
                  id="bulk-input"
                  placeholder="One profile per line:&#10;@username1&#10;@username2&#10;https://www.tiktok.com/@username3"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  disabled={loading}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Enter one profile per line. Supports handles (@username) and URLs.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="bulk-own-profile" className="text-base">
                    Mark all as my profiles
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    These profiles belong to me
                  </p>
                </div>
                <Switch
                  id="bulk-own-profile"
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
                <Button type="submit" disabled={loading || !bulkInput.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Profiles'
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
