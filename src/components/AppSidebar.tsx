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
} from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'

export function AppSidebar() {
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
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-2">
            <h2 className="text-lg font-semibold">TikTok Carousel</h2>
            <p className="text-sm text-muted-foreground">Organize your collection</p>
          </div>
          <ThemeToggle />
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
      </SidebarContent>
    </Sidebar>
  )
}