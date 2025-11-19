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

interface ProfileGroup {
  id: string
  name: string
}

interface InlineProfileGroupSelectorProps {
  profileId: string
  currentGroup: { id: string; name: string } | null
  onUpdate?: () => void
}

export function InlineProfileGroupSelector({
  profileId,
  currentGroup,
  onUpdate
}: InlineProfileGroupSelectorProps) {
  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState<ProfileGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  // Fetch groups when popover opens
  useEffect(() => {
    if (open && groups.length === 0) {
      fetchGroups()
    }
  }, [open])

  const fetchGroups = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/profile-groups')
      if (!response.ok) throw new Error('Failed to fetch groups')

      const data = await response.json()
      if (data.success) {
        setGroups(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error)
      toast.error('Failed to load groups')
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfileGroup = async (groupId: string | null) => {
    setIsUpdating(true)
    try {
      const response = await fetch(`/api/tiktok/profiles/${profileId}/group`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ groupId })
      })

      if (!response.ok) throw new Error('Failed to update group')

      toast.success('Group updated successfully')
      onUpdate?.()
      setOpen(false)
    } catch (error) {
      console.error('Failed to update group:', error)
      toast.error('Failed to update group')
    } finally {
      setIsUpdating(false)
    }
  }

  const createNewGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error('Group name cannot be empty')
      return
    }

    setIsCreatingNew(true)
    try {
      const response = await fetch('/api/profile-groups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newGroupName.trim() })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create group')
      }

      const data = await response.json()
      if (data.success) {
        // Add to groups list
        setGroups([...groups, data.data])
        // Update the profile with the new group
        await updateProfileGroup(data.data.id)
        setNewGroupName('')
        toast.success('Group created and applied')
      }
    } catch (error) {
      console.error('Failed to create group:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create group')
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
            {currentGroup?.name || 'No group'}
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
            placeholder="Search or create group..."
            value={newGroupName}
            onValueChange={setNewGroupName}
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
                    <p className="text-sm text-muted-foreground mb-2">No group found.</p>
                    {newGroupName.trim() && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={createNewGroup}
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
                            Create "{newGroupName.trim()}"
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CommandEmpty>

                <CommandGroup>
                  {/* Option to remove group */}
                  <CommandItem
                    value="__none__"
                    onSelect={() => updateProfileGroup(null)}
                    disabled={isUpdating}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        !currentGroup ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="text-muted-foreground italic">No group</span>
                  </CommandItem>

                  {groups.map((group) => (
                    <CommandItem
                      key={group.id}
                      value={group.name}
                      onSelect={() => updateProfileGroup(group.id)}
                      disabled={isUpdating}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          currentGroup?.id === group.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {group.name}
                    </CommandItem>
                  ))}
                </CommandGroup>

                {newGroupName.trim() &&
                 !groups.some(g => g.name.toLowerCase() === newGroupName.trim().toLowerCase()) && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        onSelect={createNewGroup}
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
                            Create "{newGroupName.trim()}"
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
