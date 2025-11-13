'use client'

import React from 'react'

interface HighlightedTextProps {
  text: string
  searchTerms: string[]
  className?: string
}

/**
 * Component that highlights search terms in text with yellow background
 * Supports multiple space-separated search terms
 */
export function HighlightedText({ text, searchTerms, className = '' }: HighlightedTextProps) {
  // If no search terms, return plain text
  if (!searchTerms || searchTerms.length === 0 || !text) {
    return <span className={className}>{text}</span>
  }

  // Filter out empty terms and escape special regex characters
  const validTerms = searchTerms
    .filter(term => term.trim().length > 0)
    .map(term => term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  if (validTerms.length === 0) {
    return <span className={className}>{text}</span>
  }

  // Create regex pattern that matches any of the search terms (case-insensitive)
  const pattern = new RegExp(`(${validTerms.join('|')})`, 'gi')

  // Split text by matches while preserving the matched terms
  const parts = text.split(pattern)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if this part matches any search term (case-insensitive)
        const isMatch = validTerms.some(term =>
          part.toLowerCase() === term.toLowerCase()
        )

        if (isMatch) {
          return (
            <mark
              key={index}
              className="bg-yellow-200 dark:bg-yellow-800 text-inherit font-normal rounded-sm px-0.5"
            >
              {part}
            </mark>
          )
        }

        return <React.Fragment key={index}>{part}</React.Fragment>
      })}
    </span>
  )
}
