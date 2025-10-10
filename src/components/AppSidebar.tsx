'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, FileText, Users, UserCheck, Sparkles, Star, Search, CloudUpload } from 'lucide-react'
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
import { AddProfileDialog } from '@/components/AddProfileDialog'

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleProfileAdded = () => {
    // Refresh the current page if on profiles pages
    if (pathname.startsWith('/profiles') || pathname === '/my-profiles') {
      router.refresh()
    }
  }

  const mainNavigationItems = [
    {
      title: 'Posts',
      url: '/',
      icon: Home,
    },
    {
      title: 'Upload',
      url: '/upload',
      icon: CloudUpload,
    },
    {
      title: 'TikTok Accounts',
      url: '/tiktok-accounts',
      icon: UserCheck,
    },
  ]

  const profileNavigationItems = [
    {
      title: 'My Profiles',
      url: '/my-profiles',
      icon: Star,
    },
    {
      title: 'All Profiles',
      url: '/profiles',
      icon: Users,
    },
  ]

  const otherNavigationItems = [
    {
      title: 'Product Contexts',
      url: '/product-contexts',
      icon: FileText,
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
        </div>
      </SidebarHeader>


      <SidebarContent>
        <SidebarGroup>
          <AddProfileDialog onProfileAdded={handleProfileAdded} />
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
          <SidebarGroupLabel>TikTok Profiles</SidebarGroupLabel>
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
          <SidebarGroupLabel>Other</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {otherNavigationItems.map((item) => {
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
      </SidebarContent>
    </Sidebar>
  )
}