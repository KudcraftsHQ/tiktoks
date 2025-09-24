'use client'

import { useState } from 'react'
import { Home, Plus, Search, Settings, Library, Loader2, LayoutGrid, Users, UserCheck } from 'lucide-react'
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
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface AppSidebarProps {
  onAddCarousel?: (url: string) => Promise<void>
  isAddingCarousel?: boolean
}

export function AppSidebar({ onAddCarousel, isAddingCarousel = false }: AppSidebarProps) {
  const [newCarouselUrl, setNewCarouselUrl] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCarouselUrl.trim() || !onAddCarousel) return
    
    await onAddCarousel(newCarouselUrl.trim())
    setNewCarouselUrl('')
  }

  const navigationItems = [
    {
      title: 'Dashboard',
      url: '/',
      icon: Home,
    },
    {
      title: 'Library',
      url: '/',
      icon: Library,
    },
    {
      title: 'All Slides',
      url: '/slides',
      icon: LayoutGrid,
    },
    {
      title: 'Profile Explorer',
      url: '/profile-explorer',
      icon: Users,
    },
    {
      title: 'Profiles',
      url: '/profiles',
      icon: UserCheck,
    },
    {
      title: 'Search',
      url: '/',
      icon: Search,
    },
  ]

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex flex-col space-y-2">
          <h2 className="text-lg font-semibold">TikTok Carousel</h2>
          <p className="text-sm text-muted-foreground">Organize your collection</p>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="p-3">
              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  type="url"
                  placeholder="Paste TikTok URL..."
                  value={newCarouselUrl}
                  onChange={(e) => setNewCarouselUrl(e.target.value)}
                  className="w-full"
                  required
                />
                <Button 
                  type="submit" 
                  disabled={isAddingCarousel || !newCarouselUrl.trim()}
                  className="w-full"
                  size="sm"
                >
                  {isAddingCarousel ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Carousel
                    </>
                  )}
                </Button>
              </form>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}