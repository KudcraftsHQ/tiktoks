/**
 * Design System Tokens
 * Centralized spacing, layout, and responsive design constants
 */

export const designTokens = {
  // Layout spacing
  spacing: {
    page: {
      desktop: 'px-6 py-8',
      mobile: 'px-4 py-6',
      responsive: 'px-4 py-3 md:px-6',
    },
    header: {
      desktop: 'px-6 py-4',
      mobile: 'px-4 py-3',
      responsive: 'px-4 py-3 md:px-6 md:py-4',
    },
    card: {
      desktop: 'p-6',
      mobile: 'p-4',
      responsive: 'p-4 md:p-6',
    },
    cardContent: {
      desktop: 'p-6',
      mobile: 'p-4',
      responsive: 'p-4 md:p-6',
    },
  },

  // Container widths
  container: {
    full: 'w-full',
  },

  // Typography
  typography: {
    pageTitle: {
      desktop: 'text-2xl',
      mobile: 'text-xl',
      responsive: 'text-xl md:text-2xl',
    },
    sectionTitle: {
      desktop: 'text-xl',
      mobile: 'text-lg',
      responsive: 'text-lg md:text-xl',
    },
    subtitle: 'text-sm text-muted-foreground',
  },

  // Common layout classes
  header: {
    sticky: 'border-b sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
  },

  // Grid layouts
  grid: {
    responsive: {
      cols1: 'grid grid-cols-1',
      cols2: 'grid grid-cols-1 md:grid-cols-2',
      cols3: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      cols4: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    },
  },
} as const

// Helper function to combine tokens
export function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}
