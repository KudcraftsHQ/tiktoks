'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Home, FileText, Users, UserCheck, Sparkles, Star, Search, CloudUpload, BookmarkCheck, Edit, Library, Tag, ImageIcon, ScanText, CogIcon, BookText } from 'lucide-react'
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
import { ThemeToggle } from '@/components/theme-toggle'

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const mainNavigationItems = [
    {
      title: 'Posts',
      url: '/',
      icon: Home,
    },
    {
      title: 'Contents',
      url: '/?view=content',
      icon: BookText,
    },
    {
      title: 'Drafts',
      url: '/drafts',
      icon: Edit,
    },
    {
      title: 'Bookmarks',
      url: '/bookmarks',
      icon: BookmarkCheck,
    },
    {
      title: 'Assets',
      url: '/assets',
      icon: ImageIcon
    }
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

  const contentNavigationItems = [
    {
      title: 'Content Library',
      url: '/content-ideas/library',
      icon: Library,
    },
  ]

  const profileNavigationItems = [
    {
      title: 'Profiles',
      url: '/profiles',
      icon: Users,
    },
  ]

  const otherNavigationItems = [
    {
      title: 'Post Categories',
      url: '/post-categories',
      icon: Tag,
    },
    {
      title: 'Product Contexts',
      url: '/product-contexts',
      icon: FileText,
    },
  ]

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
          <SidebarGroupLabel>Content</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {contentNavigationItems.map((item) => {
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
    </Sidebar>
  )
}