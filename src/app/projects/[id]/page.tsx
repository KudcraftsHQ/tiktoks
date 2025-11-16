'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageLayout } from '@/components/PageLayout'
import { Button } from '@/components/ui/button'
import { Sparkles, Pencil, Trash2, FilePlus, Clipboard } from 'lucide-react'
import { toast } from 'sonner'
import { GenerateContentDrawer } from '@/components/GenerateContentDrawer'
import { ProjectPostsTable, ProjectTableRow } from '@/components/ProjectPostsTable'
import { TikTokPost } from '@/components/posts-table-columns'
import { Input } from '@/components/ui/input'
import { RemixPost } from '@/types/remix'
import { RowSelectionState } from '@tanstack/react-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface Project {
  id: string
  name: string
  description: string | null
  posts: Array<{
    id: string
    post: TikTokPost
    addedAt: string
  }>
  remixes: RemixPost[]
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerateDrawerOpen, setIsGenerateDrawerOpen] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)

  // Convert RowSelectionState to Set of IDs for easier processing
  const getSelectedIds = useCallback((rows: ProjectTableRow[], selection: RowSelectionState): Set<string> => {
    const selectedIds = new Set<string>()
    Object.keys(selection).forEach(key => {
      const index = parseInt(key, 10)
      if (selection[key] && rows[index]) {
        selectedIds.add(rows[index].id)
      }
    })
    return selectedIds
  }, [])

  const removePostsFromState = useCallback((postIds: string[]) => {
    if (postIds.length === 0) return

    setProject(prev => {
      if (!prev) return prev
      return {
        ...prev,
        posts: prev.posts.filter(({ post }) => !postIds.includes(post.id))
      }
    })
  }, [])

  const removeDraftsFromState = useCallback((draftIds: string[]) => {
    if (draftIds.length === 0) return

    setProject(prev => {
      if (!prev) return prev
      return {
        ...prev,
        remixes: prev.remixes.filter(remix => !draftIds.includes(remix.id))
      }
    })
  }, [])

  const addDraftToState = useCallback((draft: RemixPost) => {
    setProject(prev => {
      if (!prev) return prev
      return {
        ...prev,
        remixes: [draft, ...prev.remixes]
      }
    })
  }, [])

  const fetchProject = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Project not found')
          router.push('/')
          return
        }
        throw new Error('Failed to fetch project')
      }
      const data = await response.json()
      setProject(data)
      setEditedTitle(data.name)
    } catch (error) {
      console.error('Failed to fetch project:', error)
      toast.error('Failed to load project')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, router])

  useEffect(() => {
    fetchProject()
  }, [fetchProject])

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const handleSaveTitle = async () => {
    if (!project || editedTitle.trim() === project.name || isSavingTitle) {
      setIsEditingTitle(false)
      return
    }

    setIsSavingTitle(true)
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editedTitle.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update project name')
      }

      const updatedProject = await response.json()
      setProject(prev => prev ? { ...prev, name: updatedProject.name } : null)
      toast.success('Project name updated')
    } catch (error) {
      console.error('Failed to update project name:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update project name')
      setEditedTitle(project.name)
    } finally {
      setIsSavingTitle(false)
      setIsEditingTitle(false)
    }
  }

  const handleContentGenerated = (drafts?: any[]) => {
    if (drafts && drafts.length > 0) {
      // Add new drafts to the state instead of refetching
      setProject(prev => {
        if (!prev) return prev
        return {
          ...prev,
          remixes: [...drafts, ...prev.remixes]
        }
      })
      toast.success(`Added ${drafts.length} new draft${drafts.length > 1 ? 's' : ''} to project`)
    } else {
      // Fallback to refetching if no drafts provided
      fetchProject()
    }
  }

  const handleRemoveSelected = async () => {
    if (!project) return
    const selectedIds = getSelectedIds(combinedTableData, rowSelection)
    if (selectedIds.size === 0) return

    // Separate selected IDs into posts and drafts
    const postIds: string[] = []
    const draftIds: string[] = []

    selectedIds.forEach(id => {
      const isPost = project.posts.some(p => p.post.id === id)
      if (isPost) {
        postIds.push(id)
      } else {
        draftIds.push(id)
      }
    })

    const previousProject = project
    const previousSelection = { ...rowSelection }

    // Optimistically update UI
    removePostsFromState(postIds)
    removeDraftsFromState(draftIds)

    setIsRemoving(true)
    try {
      // Remove posts from project if any selected
      if (postIds.length > 0) {
        const response = await fetch(`/api/projects/${projectId}/posts`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            postIds
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to remove posts')
        }
      }

      // Delete drafts if any selected
      if (draftIds.length > 0) {
        await Promise.all(
          draftIds.map(draftId =>
            fetch(`/api/remixes/${draftId}`, {
              method: 'DELETE'
            }).then(res => {
              if (!res.ok) throw new Error('Failed to delete draft')
            })
          )
        )
      }

      const totalRemoved = postIds.length + draftIds.length
      const message = []
      if (postIds.length > 0) message.push(`${postIds.length} post(s)`)
      if (draftIds.length > 0) message.push(`${draftIds.length} draft(s)`)

      toast.success(`Removed ${message.join(' and ')} from project`)
      setShowRemoveDialog(false)
      setRowSelection({})
    } catch (error) {
      console.error('Failed to remove items:', error)
      // Restore previous state on error
      if (previousProject) {
        setProject(previousProject)
      }
      setRowSelection(previousSelection)
      toast.error(error instanceof Error ? error.message : 'Failed to remove items from project')
    } finally {
      setIsRemoving(false)
    }
  }

  const handleCreateNewDraft = async () => {
    setIsCreatingDraft(true)
    try {
      const response = await fetch('/api/remixes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `${project?.name || 'Project'} Draft`,
          description: '',
          bookmarked: false,
          slideCount: 5
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create draft')
      }

      const result = await response.json()
      toast.success('Draft created successfully')

      if (result.remix) {
        addDraftToState(result.remix as RemixPost)

        // Scroll to and focus on the new draft after a short delay to allow DOM update
        setTimeout(() => {
          // Since new drafts are added to the beginning (addDraftToState prepends),
          // and we sort by oldest first, the newest draft will be at the end of the draft section
          // Find all table rows and locate the last draft row
          const tableBody = document.querySelector('tbody')
          if (tableBody) {
            const rows = Array.from(tableBody.querySelectorAll('tr'))
            // Find the last row that has a draft (FileText icon indicates draft)
            const draftRows = rows.filter(row => row.querySelector('[data-lucide="file-text"]'))
            const lastDraftRow = draftRows[draftRows.length - 1]

            if (lastDraftRow) {
              // Scroll the row into view
              lastDraftRow.scrollIntoView({ behavior: 'smooth', block: 'center' })

              // Focus on the first slide's textarea in this row
              const firstSlideTextarea = lastDraftRow.querySelector('textarea') as HTMLTextAreaElement
              if (firstSlideTextarea) {
                setTimeout(() => {
                  firstSlideTextarea.focus()
                  firstSlideTextarea.select()
                }, 500) // Additional delay for smooth scroll to complete
              }
            }
          }
        }, 100)
      }
    } catch (error) {
      console.error('Failed to create draft:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create draft')
    } finally {
      setIsCreatingDraft(false)
    }
  }

  const [isCopyingToClipboard, setIsCopyingToClipboard] = useState(false)

  const handleCopyToClipboard = useCallback(async () => {
    if (!project) return
    const selectedIds = getSelectedIds(combinedTableData, rowSelection)
    if (selectedIds.size === 0) return

    setIsCopyingToClipboard(true)
    try {
      const mainSections: string[] = []

      // Process selected posts
      const selectedPostsData = project.posts
        .filter(({ post }) => selectedIds.has(post.id))
        .map(({ post }) => post)

      if (selectedPostsData.length > 0) {
        const postSections: string[] = []

        // Add Reference Posts header
        postSections.push('# Reference Posts')
        postSections.push('')

        selectedPostsData.forEach((post, index) => {
          const postContent: string[] = []

          // Post counter as H2
          postContent.push(`## Post #${index + 1}`)
          postContent.push('')

          // Description as H3
          if (post.description) {
            postContent.push('### Description')
            postContent.push('')
            postContent.push(post.description)
            postContent.push('')
          }

          // Parse OCR texts
          let ocrTexts: Array<{ imageIndex: number; text: string; success: boolean; error?: string }> = []
          try {
            if (post.ocrTexts) {
              const parsed = typeof post.ocrTexts === 'string'
                ? JSON.parse(post.ocrTexts)
                : post.ocrTexts
              ocrTexts = Array.isArray(parsed) ? parsed : []
            }
          } catch {
            ocrTexts = []
          }

          // Parse slide classifications
          let slideClassifications: Array<{ slideIndex: number; slideType: string; confidence: number }> = []
          try {
            if (post.slideClassifications) {
              const parsed = typeof post.slideClassifications === 'string'
                ? JSON.parse(post.slideClassifications)
                : post.slideClassifications
              slideClassifications = Array.isArray(parsed) ? parsed : []
            }
          } catch {
            slideClassifications = []
          }

          // Content text with slides as H3
          if (post.images && post.images.length > 0) {
            postContent.push('### Content Text')
            postContent.push('')

            post.images.forEach((img, slideIndex) => {
              // Get OCR text by imageIndex
              const ocrResult = ocrTexts.find(ocr => ocr.imageIndex === slideIndex)
              const ocrText = ocrResult?.success ? ocrResult.text : null

              // Get slide type from classifications
              const classification = slideClassifications.find(c => c.slideIndex === slideIndex)
              const slideType = classification?.slideType || 'unknown'

              if (ocrText) {
                postContent.push(`#### Slide ${slideIndex + 1} - ${slideType}`)
                postContent.push('')
                postContent.push(ocrText)
                postContent.push('')
              }
            })
          }

          postSections.push(postContent.join('\n'))
        })

        mainSections.push(postSections.join('\n'))
      }

      // Process selected drafts
      const selectedDraftsData = project.remixes.filter(draft => selectedIds.has(draft.id))

      if (selectedDraftsData.length > 0) {
        const draftSections: string[] = []

        // Add Drafts header
        draftSections.push('# Drafts')
        draftSections.push('')

        selectedDraftsData.forEach((draft, index) => {
          const draftContent: string[] = []

          // Draft counter as H2
          draftContent.push(`## Draft #${index + 1}`)
          draftContent.push('')

          // Description as H3
          if (draft.description) {
            draftContent.push('### Description')
            draftContent.push('')
            draftContent.push(draft.description)
            draftContent.push('')
          }

          // Slides
          if (draft.slides && Array.isArray(draft.slides) && draft.slides.length > 0) {
            draftContent.push('### Content')
            draftContent.push('')

            draft.slides.forEach((slide, slideIndex) => {
              // Get slide classification
              const classification = draft.slideClassifications?.find(c => c.slideIndex === slideIndex)
              const slideType = classification?.type || 'unknown'

              draftContent.push(`#### Slide ${slideIndex + 1} - ${slideType}`)
              draftContent.push('')
              draftContent.push(slide.paraphrasedText || '')
              draftContent.push('')
            })
          }

          draftSections.push(draftContent.join('\n'))
        })

        mainSections.push(draftSections.join('\n'))
      }

      const markdownContent = mainSections.join('\n\n---\n\n')

      // Copy to clipboard
      await navigator.clipboard.writeText(markdownContent)

      const postCount = selectedPostsData.length
      const draftCount = selectedDraftsData.length
      const itemTypes = []
      if (postCount > 0) itemTypes.push(`${postCount} post${postCount !== 1 ? 's' : ''}`)
      if (draftCount > 0) itemTypes.push(`${draftCount} draft${draftCount !== 1 ? 's' : ''}`)

      // Show success toast
      toast.success(`Copied ${itemTypes.join(' and ')} to clipboard`, {
        description: 'Content is ready to paste'
      })
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Failed to copy to clipboard', {
        description: 'Please try again'
      })
    } finally {
      setIsCopyingToClipboard(false)
    }
  }, [project, rowSelection, getSelectedIds])

  // Prepare data before early returns to comply with hooks rules
  const referencePosts = project?.posts || []
  const selectedPostIds = referencePosts.map(p => p.post.id)

  // Convert reference posts to PostPreview format for GenerateContentDrawer
  const selectedPostPreviews = useMemo(() => {
    if (!project) return []
    return project.posts.map(({ post }) => ({
      id: post.id,
      tiktokUrl: post.tiktokUrl,
      contentType: post.contentType,
      description: post.description,
      thumbnailUrl: post.coverUrl,
      authorHandle: post.authorHandle || 'unknown',
      category: post.postCategory ? { id: post.postCategory.id, name: post.postCategory.name } : null,
      viewCount: post.viewCount?.toString() || '0',
      likeCount: post.likeCount || 0
    }))
  }, [project])

  // Combine reference posts and drafts into a single table
  const combinedTableData: ProjectTableRow[] = useMemo(() => {
    if (!project) return []

    const refPosts = project.posts || []
    const drafts = project.remixes || []

    // Sort drafts by createdAt (oldest first)
    const sortedDrafts = [...drafts].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime()
      const dateB = new Date(b.createdAt).getTime()
      return dateA - dateB // Oldest first
    })

    return [
      // Reference posts first
      ...refPosts.map(({ post }): ProjectTableRow => ({
        ...post,
        _rowType: 'post' as const
      })),
      // Drafts after references (sorted oldest first)
      ...sortedDrafts.map((draft): ProjectTableRow => ({
        ...draft,
        _rowType: 'draft' as const
      }))
    ]
  }, [project])

  if (isLoading) {
    return (
      <PageLayout title="Project">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    )
  }

  if (!project) {
    return (
      <PageLayout title="Project Not Found" description="The project you're looking for doesn't exist">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">This project may have been deleted or doesn't exist.</p>
          <Button onClick={() => router.push('/')}>Go to Posts</Button>
        </div>
      </PageLayout>
    )
  }

  return (
    <div className="flex h-screen w-full min-w-0">
      <div className="flex-1 flex flex-col min-w-0">
        <PageLayout
          title={
            isEditingTitle ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={titleInputRef}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleSaveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveTitle()
                    } else if (e.key === 'Escape') {
                      setEditedTitle(project.name)
                      setIsEditingTitle(false)
                    }
                  }}
                  disabled={isSavingTitle}
                  className="text-2xl font-bold h-auto py-0 px-2 border-none shadow-none focus-visible:ring-1"
                  maxLength={100}
                />
              </div>
            ) : (
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setIsEditingTitle(true)}
              >
                <span>{project.name}</span>
                <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )
          }
          headerActions={
            <div className="flex gap-2">
              {(() => {
                const selectedCount = Object.keys(rowSelection).length
                return selectedCount > 0 && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleCopyToClipboard}
                      disabled={isCopyingToClipboard}
                      className="w-full sm:w-auto h-8 px-3 text-xs"
                    >
                      <Clipboard className="h-3 w-3" />
                      {isCopyingToClipboard ? 'Copying...' : 'Copy'} ({selectedCount})
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setShowRemoveDialog(true)}
                      className="w-full sm:w-auto h-8 px-3 text-xs"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove ({selectedCount})
                    </Button>
                  </>
                )
              })()}
              <Button
                variant="outline"
                onClick={handleCreateNewDraft}
                disabled={isCreatingDraft}
                className="w-full sm:w-auto h-8 px-3 text-xs"
              >
                <FilePlus className="h-3 w-3" />
                {isCreatingDraft ? 'Creating...' : 'New Draft'}
              </Button>
              <Button
                variant={isGenerateDrawerOpen ? "default" : "outline"}
                onClick={() => setIsGenerateDrawerOpen(!isGenerateDrawerOpen)}
                className="w-full sm:w-auto h-8 px-3 text-xs"
              >
                <Sparkles className="h-3 w-3" />
                Generate {referencePosts.length > 0 && ` (${referencePosts.length})`}
              </Button>
            </div>
          }
        >
          {combinedTableData.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  No posts or drafts yet. Go to Posts page and add some posts to this project, then generate content.
                </p>
                <Button variant="outline" onClick={() => router.push('/')}>
                  Browse Posts
                </Button>
              </div>
            </div>
          ) : (
            <ProjectPostsTable
              rows={combinedTableData}
              projectId={projectId}
              isLoading={isLoading}
              onRefetchData={fetchProject}
              onPostRemoved={(postId) => removePostsFromState([postId])}
              onDraftRemoved={(draftId) => removeDraftsFromState([draftId])}
              viewMode="content"
              rowSelection={rowSelection}
              onRowSelectionChange={setRowSelection}
              rowClassName={(row) => {
                if (row._rowType === 'post') {
                  return 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800'
                }
                return 'bg-background hover:bg-muted'
              }}
            />
          )}
        </PageLayout>
      </div>

      {/* Generate Content Drawer */}
      <GenerateContentDrawer
        isOpen={isGenerateDrawerOpen}
        onClose={() => setIsGenerateDrawerOpen(false)}
        selectedPostIds={selectedPostIds}
        selectedPosts={selectedPostPreviews}
        onContentGenerated={handleContentGenerated}
        projectId={projectId}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(() => {
                if (!project) return 'Remove items?'
                const selectedIds = getSelectedIds(combinedTableData, rowSelection)
                const postCount = Array.from(selectedIds).filter(id =>
                  project.posts.some(p => p.post.id === id)
                ).length
                const draftCount = selectedIds.size - postCount

                if (draftCount > 0 && postCount > 0) return 'Remove posts and delete drafts?'
                if (draftCount > 0) return 'Delete drafts?'
                return 'Remove posts from project?'
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                if (!project) return 'Are you sure?'
                const selectedIds = getSelectedIds(combinedTableData, rowSelection)
                const postCount = Array.from(selectedIds).filter(id =>
                  project.posts.some(p => p.post.id === id)
                ).length
                const draftCount = selectedIds.size - postCount

                if (draftCount > 0 && postCount > 0) {
                  return (
                    <>
                      Are you sure you want to remove {postCount} post{postCount !== 1 ? 's' : ''} and delete {draftCount} draft{draftCount !== 1 ? 's' : ''}?
                      <br />
                      Posts will only be removed from the project (not deleted), but drafts will be permanently deleted.
                    </>
                  )
                }
                if (draftCount > 0) {
                  return (
                    <>
                      Are you sure you want to delete {draftCount} draft{draftCount !== 1 ? 's' : ''}?
                      This action cannot be undone.
                    </>
                  )
                }
                return (
                  <>
                    Are you sure you want to remove {postCount} post{postCount !== 1 ? 's' : ''} from this project?
                    This will only remove the reference, not delete the posts themselves.
                  </>
                )
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveSelected}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {(() => {
                if (isRemoving) return 'Removing...'
                if (!project) return 'Remove'
                const selectedIds = getSelectedIds(combinedTableData, rowSelection)
                const postCount = Array.from(selectedIds).filter(id =>
                  project.posts.some(p => p.post.id === id)
                ).length
                const draftCount = selectedIds.size - postCount

                return draftCount > 0 && postCount === 0 ? 'Delete' : 'Remove'
              })()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
