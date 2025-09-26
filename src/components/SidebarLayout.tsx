'use client'

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'

interface SidebarLayoutProps {
  children: React.ReactNode
  onAddCarousel?: (url: string) => Promise<void>
  isAddingCarousel?: boolean
}

export function SidebarLayout({ children, onAddCarousel, isAddingCarousel }: SidebarLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar {...(onAddCarousel ? { onAddCarousel, isAddingCarousel } : {}) as any} />
      <div className="flex-1 h-screen">
        {/* Scrollable Main Content */}
        <main className="overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}