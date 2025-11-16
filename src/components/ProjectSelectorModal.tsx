'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Plus, Folder, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

interface Project {
  id: string
  name: string
  _count: {
    posts: number
    remixes: number
  }
}

interface ProjectSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (projectId: string) => void | Promise<void>
}

export function ProjectSelectorModal({
  isOpen,
  onClose,
  onSelect
}: ProjectSelectorModalProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchProjects()
    }
  }, [isOpen])

  const fetchProjects = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      toast.error('Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Project name cannot be empty')
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName })
      })
      if (!response.ok) throw new Error('Failed to create project')
      const newProject = await response.json()

      // Select the newly created project
      setSelectedProjectId(newProject.id)
      setNewProjectName('')
      setShowCreateForm(false)

      // Refresh projects list
      await fetchProjects()
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error('Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId)
  }

  const handleSubmit = async () => {
    if (!selectedProjectId) return

    setIsSubmitting(true)
    try {
      await onSelect(selectedProjectId)
      setSelectedProjectId(null)
      onClose()
    } catch (error) {
      console.error('Failed to add posts to project:', error)
      // Error toast is handled in parent component
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setSelectedProjectId(null)
    setShowCreateForm(false)
    setNewProjectName('')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to Project</DialogTitle>
          <DialogDescription>
            Select a project to add the selected posts to, or create a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {showCreateForm ? (
            <div className="space-y-2">
              <Input
                placeholder="New project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateProject()
                  if (e.key === 'Escape') {
                    setShowCreateForm(false)
                    setNewProjectName('')
                  }
                }}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateProject}
                  disabled={isCreating || !newProjectName.trim()}
                  className="flex-1"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false)
                    setNewProjectName('')
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowCreateForm(true)}
              disabled={isSubmitting}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Project
            </Button>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No projects yet. Create one to get started.
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    disabled={isSubmitting}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                      selectedProjectId === project.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-accent'
                    } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium truncate">{project.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {(project._count?.posts || 0) + (project._count?.remixes || 0)}
                      </Badge>
                      {selectedProjectId === project.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting || isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedProjectId || isSubmitting || isCreating}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Add to Project'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
