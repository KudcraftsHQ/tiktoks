'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

export interface SelectedExample {
  id: string
  conceptId: string
  conceptType: 'HOOK' | 'CONTENT' | 'CTA'
  text: string
}

interface ExampleSelectionContextValue {
  selectedExamples: Map<string, SelectedExample>
  selectExample: (example: SelectedExample, multiSelect: boolean) => void
  clearSelection: () => void
  isSelecting: boolean
}

const ExampleSelectionContext = createContext<ExampleSelectionContextValue | null>(null)

export function useExampleSelection() {
  const context = useContext(ExampleSelectionContext)
  if (!context) {
    throw new Error('useExampleSelection must be used within ExampleSelectionProvider')
  }
  return context
}

interface ExampleSelectionProviderProps {
  children: React.ReactNode
}

export function ExampleSelectionProvider({ children }: ExampleSelectionProviderProps) {
  const [selectedExamples, setSelectedExamples] = useState<Map<string, SelectedExample>>(new Map())

  const selectExample = useCallback((example: SelectedExample, _multiSelect: boolean) => {
    setSelectedExamples(prev => {
      const next = new Map(prev)

      if (next.has(example.id)) {
        next.delete(example.id)
      } else {
        next.set(example.id, example)
      }

      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedExamples(new Map())
  }, [])

  const contextValue: ExampleSelectionContextValue = {
    selectedExamples,
    selectExample,
    clearSelection,
    isSelecting: selectedExamples.size > 0
  }

  return (
    <ExampleSelectionContext.Provider value={contextValue}>
      {children}
    </ExampleSelectionContext.Provider>
  )
}
