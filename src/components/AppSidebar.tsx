'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { FileText, Users, BookmarkCheck, Edit, Library, Tag, ImageIcon, CogIcon, FolderPlus, Folder, Check, X, Trash2, GalleryHorizontalEnd, LibraryIcon, SquareLibrary, Lightbulb } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Project {
  id: string
  name: string
  description: string | null
  _count: {
    posts: number
    remixes: number
  }
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')

  const mainNavigationItems = [
    {
      title: 'Posts',
      url: '/',
      icon: GalleryHorizontalEnd,
    },
    {
      title: 'Drafts',
      url: '/drafts',
      icon: LibraryIcon,
    },
    {
      title: 'Concepts',
      url: '/concepts',
      icon: Lightbulb,
    },
    {
      title: 'Assets',
      url: '/assets',
      icon: ImageIcon
    },
    {
      title: 'Contexts',
      url: '/product-contexts',
      icon: SquareLibrary,
    },
    // Hidden for now
    // {
    //   title: 'Upload',
    //   url: '/upload',
    //   icon: CloudUpload,
    // },
    // {
    //   title: 'TikTok Accounts',
    //   url: '/tiktok-accounts',
    //   icon: UserCheck,
    // },
  ]

  const profileNavigationItems = [
    {
      title: 'Profiles',
      url: '/profiles',
      icon: Users,
    },
  ]

  // Fetch projects on mount
  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    setIsLoadingProjects(true)
    try {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      toast.error('Failed to load projects')
    } finally {
      setIsLoadingProjects(false)
    }
  }

  const handleStartCreatingProject = () => {
    setIsCreatingNew(true)
    setNewProjectName('')
  }

  const handleCancelCreatingProject = () => {
    setIsCreatingNew(false)
    setNewProjectName('')
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('Project name cannot be empty')
      return
    }

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName })
      })
      if (!response.ok) throw new Error('Failed to create project')
      const newProject = await response.json()
      setProjects(prev => [newProject, ...prev])
      setIsCreatingNew(false)
      setNewProjectName('')
      toast.success('Project created')
    } catch (error) {
      console.error('Failed to create project:', error)
      toast.error('Failed to create project')
    }
  }

  const handleStartEditing = (project: Project) => {
    setEditingProjectId(project.id)
    setEditingProjectName(project.name)
  }

  const handleCancelEditing = () => {
    setEditingProjectId(null)
    setEditingProjectName('')
  }

  const handleSaveProjectName = async (projectId: string) => {
    if (!editingProjectName.trim()) {
      toast.error('Project name cannot be empty')
      return
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingProjectName })
      })
      if (!response.ok) throw new Error('Failed to update project')
      const updatedProject = await response.json()
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p))
      setEditingProjectId(null)
      setEditingProjectName('')
      toast.success('Project renamed')
    } catch (error) {
      console.error('Failed to update project:', error)
      toast.error('Failed to rename project')
    }
  }

  const handleDeleteProject = async () => {
    if (!projectToDelete) return

    try {
      const response = await fetch(`/api/projects/${projectToDelete}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete project')
      setProjects(prev => prev.filter(p => p.id !== projectToDelete))
      toast.success('Project deleted')

      // If we're currently on the deleted project page, redirect to home
      if (pathname === `/projects/${projectToDelete}`) {
        router.push('/')
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
      toast.error('Failed to delete project')
    } finally {
      setProjectToDelete(null)
    }
  }

  return (
    <Sidebar>
      <SidebarHeader className="p-4 h-[56px]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-2">
            <h2 className="text-lg font-semibold">TikTok Carousel</h2>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavigationItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Monitoring</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-2">
            <SidebarMenu>
              {profileNavigationItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Projects</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={handleStartCreatingProject}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isCreatingNew && (
                <SidebarMenuItem>
                  <div className="flex items-center gap-1.5 px-2 py-1">
                    <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="h-7 text-sm flex-1"
                      placeholder="Project name"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateProject()
                        if (e.key === 'Escape') handleCancelCreatingProject()
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={handleCreateProject}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={handleCancelCreatingProject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </SidebarMenuItem>
              )}
              {isLoadingProjects ? (
                <SidebarMenuItem>
                  <div className="text-sm text-muted-foreground px-2 py-1.5">Loading...</div>
                </SidebarMenuItem>
              ) : projects.length === 0 && !isCreatingNew ? (
                <SidebarMenuItem>
                  <div className="text-sm text-muted-foreground px-2 py-1.5">No projects yet</div>
                </SidebarMenuItem>
              ) : (
                projects.map((project) => {
                  const isActive = pathname === `/projects/${project.id}`
                  const isEditing = editingProjectId === project.id

                  return (
                    <SidebarMenuItem key={project.id}>
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 px-2 py-1">
                          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <Input
                            value={editingProjectName}
                            onChange={(e) => setEditingProjectName(e.target.value)}
                            className="h-7 text-sm flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveProjectName(project.id)
                              if (e.key === 'Escape') handleCancelEditing()
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => handleSaveProjectName(project.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={handleCancelEditing}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <SidebarMenuButton asChild isActive={isActive}>
                              <Link href={`/projects/${project.id}`}>
                                <Folder className="h-4 w-4" />
                                <span className="truncate flex-1">{project.name}</span>
                                <Badge variant="secondary" className="h-5 text-[10px] px-1.5 shrink-0">
                                  {(project._count?.posts || 0) + (project._count?.remixes || 0)}
                                </Badge>
                              </Link>
                            </SidebarMenuButton>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-48">
                            <ContextMenuItem
                              onClick={() => handleStartEditing(project)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Rename
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              onClick={() => setProjectToDelete(project.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      )}
                    </SidebarMenuItem>
                  )
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/settings'}>
              <Link href="/settings">
                <CogIcon className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone and will remove all associated posts and remixes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  )
}