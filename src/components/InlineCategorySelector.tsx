'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, ChevronDown, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Category {
  id: string
  name: string
}

interface InlineCategorySelectorProps {
  postId: string
  currentCategory: { id: string; name: string } | null
  onUpdate?: () => void
}

export function InlineCategorySelector({
  postId,
  currentCategory,
  onUpdate
}: InlineCategorySelectorProps) {
  const [open, setOpen] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  // Fetch categories when popover opens
  useEffect(() => {
    if (open && categories.length === 0) {
      fetchCategories()
    }
  }, [open])

  const fetchCategories = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/post-categories')
      if (!response.ok) throw new Error('Failed to fetch categories')

      const data = await response.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      toast.error('Failed to load categories')
    } finally {
      setIsLoading(false)
    }
  }

  const updatePostCategory = async (categoryId: string | null) => {
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/tiktok/posts/${postId}/category`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ categoryId })
      })

      if (!response.ok) throw new Error('Failed to update category')

      toast.success('Category updated successfully')
      onUpdate?.()
      setOpen(false)
    } catch (error) {
      console.error('Failed to update category:', error)
      toast.error('Failed to update category')
    } finally {
      setIsUpdating(false)
    }
  }

  const createNewCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name cannot be empty')
      return
    }

    setIsCreatingNew(true)
    try {
      const response = await fetch('/api/post-categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newCategoryName.trim() })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create category')
      }

      const data = await response.json()
      if (data.success) {
        // Add to categories list
        setCategories([...categories, data.data])
        // Update the post with the new category
        await updatePostCategory(data.data.id)
        setNewCategoryName('')
        toast.success('Category created and applied')
      }
    } catch (error) {
      console.error('Failed to create category:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create category')
    } finally {
      setIsCreatingNew(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 hover:bg-transparent"
        >
          <Badge
            variant="secondary"
            className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
          >
            {currentCategory?.name || 'No category'}
            <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[250px] p-0"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Command>
          <CommandInput
            placeholder="Search or create category..."
            value={newCategoryName}
            onValueChange={setNewCategoryName}
          />
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="py-2">
                    <p className="text-sm text-muted-foreground mb-2">No category found.</p>
                    {newCategoryName.trim() && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={createNewCategory}
                        disabled={isCreatingNew || isUpdating}
                      >
                        {isCreatingNew ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-3 w-3" />
                            Create "{newCategoryName.trim()}"
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CommandEmpty>

                <CommandGroup>
                  {/* Option to remove category */}
                  <CommandItem
                    value="__none__"
                    onSelect={() => updatePostCategory(null)}
                    disabled={isUpdating}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        !currentCategory ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="text-muted-foreground italic">No category</span>
                  </CommandItem>

                  {categories.map((category) => (
                    <CommandItem
                      key={category.id}
                      value={category.name}
                      onSelect={() => updatePostCategory(category.id)}
                      disabled={isUpdating}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          currentCategory?.id === category.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {category.name}
                    </CommandItem>
                  ))}
                </CommandGroup>

                {newCategoryName.trim() &&
                 !categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase()) && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={createNewCategory}
                        disabled={isCreatingNew || isUpdating}
                      >
                        {isCreatingNew ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Create "{newCategoryName.trim()}"
                          </>
                        )}
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
