'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { PageLayout } from '@/components/PageLayout'
import { DraftSessionTable } from '@/components/DraftSessionTable'
import { Button } from '@/components/ui/button'
import { InlineEditableTitle } from '@/components/InlineEditableTitle'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Calendar,
  FileText
} from 'lucide-react'
import type { DraftSessionWithData } from '@/types/remix'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

export default function DraftSessionPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string

  const [session, setSession] = useState<DraftSessionWithData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [variationCount, setVariationCount] = useState(5)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const fetchSession = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/draft-sessions/${sessionId}`)
      if (!response.ok) throw new Error('Failed to fetch session')

      const data = await response.json()
      setSession(data)
    } catch (error) {
      console.error('Failed to fetch session:', error)
      toast.error('Failed to load draft session')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const handleUpdateSessionName = async (newName: string) => {
    if (!session) return

    try {
      const response = await fetch(`/api/draft-sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })

      if (!response.ok) throw new Error('Failed to update session name')

      const updatedSession = await response.json()
      setSession({ ...session, name: updatedSession.name })
      toast.success('Session name updated')
    } catch (error) {
      console.error('Failed to update session name:', error)
      toast.error('Failed to update session name')
      throw error
    }
  }

  const handleGenerateMoreVariations = async () => {
    if (!session) return

    setIsGenerating(true)
    setIsDialogOpen(false)

    try {
      const response = await fetch(`/api/draft-sessions/${sessionId}/variations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variationCount })
      })

      if (!response.ok) throw new Error('Failed to generate variations')

      const data = await response.json()
      toast.success(`Generated ${data.count} new variation${data.count !== 1 ? 's' : ''}`)

      // Refresh session data
      fetchSession()
    } catch (error) {
      console.error('Failed to generate variations:', error)
      toast.error('Failed to generate variations')
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <PageLayout title="Loading...">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageLayout>
    )
  }

  if (!session) {
    return (
      <PageLayout title="Session Not Found">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="rounded-full bg-muted/50 w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 opacity-50" />
          </div>
          <h3 className="font-medium mb-2">Draft session not found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            The session you're looking for doesn't exist
          </p>
          <Button onClick={() => router.push('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </PageLayout>
    )
  }

  const formattedDate = new Date(session.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <InlineEditableTitle
            value={session.name}
            onSave={handleUpdateSessionName}
            className="text-lg font-semibold flex-1 min-w-0"
            placeholder="Session Name"
          />
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formattedDate}
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {session.referencePosts.length} ref
            </div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {session.drafts.length} draft{session.drafts.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      }
      description={undefined}
      headerActions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Add More Variations
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate More Variations</DialogTitle>
              <DialogDescription>
                Create additional content variations using the same reference posts and settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="variationCount">Number of Variations</Label>
                <Input
                  id="variationCount"
                  type="number"
                  min={1}
                  max={50}
                  value={variationCount}
                  onChange={(e) => setVariationCount(parseInt(e.target.value) || 5)}
                />
                <p className="text-xs text-muted-foreground">
                  Using: {session.generationStrategy} strategy, {session.languageStyle} style
                </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleGenerateMoreVariations}>
                Generate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <DraftSessionTable
        referencePosts={session.referencePosts}
        drafts={session.drafts}
        isLoading={false}
        onRefetch={fetchSession}
      />
    </PageLayout>
  )
}
