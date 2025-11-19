'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Check, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface ProfileGroup {
  id: string
  name: string
}

interface BulkGroupAssignDialogProps {
  isOpen: boolean
  onClose: () => void
  selectedProfileIds: string[]
  onSuccess: () => void
}

export function BulkGroupAssignDialog({
  isOpen,
  onClose,
  selectedProfileIds,
  onSuccess
}: BulkGroupAssignDialogProps) {
  const [groups, setGroups] = useState<ProfileGroup[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [newGroupName, setNewGroupName] = useState('')
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  // Fetch groups when dialog opens
  useEffect(() => {
    if (isOpen && groups.length === 0) {
      fetchGroups()
    }
  }, [isOpen])

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
        // Select the new group
        setSelectedGroup(data.data.id)
        setNewGroupName('')
        toast.success('Group created')
      }
    } catch (error) {
      console.error('Failed to create group:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create group')
    } finally {
      setIsCreatingNew(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedGroup) {
      toast.error('Please select a group')
      return
    }

    setIsAssigning(true)
    try {
      // Bulk update all selected profiles
      const updatePromises = selectedProfileIds.map(profileId =>
        fetch(`/api/tiktok/profiles/${profileId}/group`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ groupId: selectedGroup })
        })
      )

      await Promise.all(updatePromises)

      toast.success(`Assigned ${selectedProfileIds.length} profile${selectedProfileIds.length > 1 ? 's' : ''} to group`)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to assign profiles to group:', error)
      toast.error('Failed to assign profiles to group')
    } finally {
      setIsAssigning(false)
    }
  }

  const handleRemoveFromGroup = async () => {
    setIsAssigning(true)
    try {
      // Bulk update all selected profiles to remove group
      const updatePromises = selectedProfileIds.map(profileId =>
        fetch(`/api/tiktok/profiles/${profileId}/group`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ groupId: null })
        })
      )

      await Promise.all(updatePromises)

      toast.success(`Removed ${selectedProfileIds.length} profile${selectedProfileIds.length > 1 ? 's' : ''} from group`)
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to remove profiles from group:', error)
      toast.error('Failed to remove profiles from group')
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Group</DialogTitle>
          <DialogDescription>
            Assign {selectedProfileIds.length} profile{selectedProfileIds.length > 1 ? 's' : ''} to a group
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
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
                          disabled={isCreatingNew || isAssigning}
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
                    {groups.map((group) => (
                      <CommandItem
                        key={group.id}
                        value={group.name}
                        onSelect={() => setSelectedGroup(group.id)}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedGroup === group.id ? 'opacity-100' : 'opacity-0'
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
                          disabled={isCreatingNew || isAssigning}
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
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleRemoveFromGroup}
            disabled={isAssigning}
          >
            Remove from Group
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedGroup || isAssigning}
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign to Group'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
