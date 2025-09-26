'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, FileText, Users, UserCheck, Sparkles } from 'lucide-react'
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
  const pathname = usePathname()

  const navigationItems = [
    {
      title: 'Posts',
      url: '/',
      icon: Home,
    },
    {
      title: 'Profiles',
      url: '/profiles',
      icon: UserCheck,
    },
    {
      title: 'Profile Explorer',
      url: '/profile-explorer',
      icon: Users,
    },
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
          <ThemeToggle />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
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