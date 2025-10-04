import React from 'react'
import { designTokens } from '@/lib/design-tokens'

interface PageLayoutProps {
  children: React.ReactNode
  title: string
  description?: string
  headerActions?: React.ReactNode
}

export function PageLayout({
  children,
  title,
  description,
  headerActions,
}: PageLayoutProps) {
  return (
    <div className="h-screen bg-background grid grid-rows-[84px_1fr]">
      {/* Header - Fixed height */}
      <header>
        <div className={`${designTokens.container.full} ${designTokens.spacing.header.responsive}`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className={`${designTokens.typography.pageTitle.responsive} font-semibold`}>
                {title}
              </h1>
              {description && (
                <p className={designTokens.typography.subtitle}>
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
      <main className="flex flex-col h-full min-h-0">
        <div className={`${designTokens.container.full} ${designTokens.spacing.page.responsive} h-full flex flex-col min-h-0`}>
          {children}
        </div>
      </main>
    </div>
  )
}
