import React from 'react'
import { designTokens } from '@/lib/design-tokens'

interface PageLayoutProps {
  children: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  headerActions?: React.ReactNode
}

export function PageLayout({
  children,
  title,
  description,
  headerActions,
}: PageLayoutProps) {
  return (
    <div className="h-screen bg-background grid grid-rows-[auto_1fr]">
      {/* Header - Dashboard Style */}
      <header className="border-b bg-card">
        <div className={`${designTokens.container.full} py-2 px-4 sm:py-3`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              {typeof title === 'string' ? (
                <h1 className="text-base sm:text-lg font-semibold">
                  {title}
                </h1>
              ) : (
                <div className="text-base sm:text-lg font-semibold">
                  {title}
                </div>
              )}
              {description && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {headerActions && (
              <div className="flex items-center gap-2 flex-shrink-0">
                {headerActions}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex flex-col h-full min-h-0 min-w-0">
        <div className={`${designTokens.container.full} h-full flex flex-col min-h-0 min-w-0 space-y-4`}>
          {children}
        </div>
      </main>
    </div>
  )
}
