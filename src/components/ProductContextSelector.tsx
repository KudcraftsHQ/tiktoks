'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface ProductContext {
  id: string
  title: string
  description?: string
}

interface ProductContextSelectorProps {
  value: string | null
  onChange: (productContextId: string | null) => void
  disabled?: boolean
}

export function ProductContextSelector({
  value,
  onChange,
  disabled = false
}: ProductContextSelectorProps) {
  const [productContexts, setProductContexts] = useState<ProductContext[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchProductContexts() {
      try {
        const response = await fetch('/api/product-contexts')
        if (!response.ok) throw new Error('Failed to fetch')
        const data = await response.json()
        setProductContexts(data)
      } catch (error) {
        console.error('Error fetching product contexts:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProductContexts()
  }, [])

  if (isLoading) {
    return (
      <div className="w-[200px] h-9 bg-muted animate-pulse rounded-md" />
    )
  }

  return (
    <Select
      value={value || 'none'}
      onValueChange={(val) => onChange(val === 'none' ? null : val)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select product..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No Product</SelectItem>
        {productContexts.map((pc) => (
          <SelectItem key={pc.id} value={pc.id}>
            {pc.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
