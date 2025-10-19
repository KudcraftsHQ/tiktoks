'use client'

import React, { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ApprovalToggleProps {
  remixId: string
  initialApproved: boolean
  onApprovalChange?: (approved: boolean) => void
}

export function ApprovalToggle({
  remixId,
  initialApproved,
  onApprovalChange
}: ApprovalToggleProps) {
  const [approved, setApproved] = useState(initialApproved)
  const [isUpdating, setIsUpdating] = useState(false)

  const toggleApproval = async () => {
    setIsUpdating(true)
    const newApprovalStatus = !approved

    // Optimistic update
    setApproved(newApprovalStatus)

    try {
      const response = await fetch(`/api/remixes/${remixId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approved: newApprovalStatus
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update approval status')
      }

      const data = await response.json()

      // Call callback if provided
      if (onApprovalChange) {
        onApprovalChange(data.approved)
      }

      toast.success(data.approved ? 'Approved' : 'Approval removed')
    } catch (error) {
      console.error('Failed to toggle approval:', error)
      // Revert optimistic update
      setApproved(!newApprovalStatus)
      toast.error('Failed to update approval status')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <button
      onClick={toggleApproval}
      disabled={isUpdating}
      className={`
        flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium
        transition-all duration-200
        ${
          approved
            ? 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20'
            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
        }
        ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={approved ? 'Click to unapprove' : 'Click to approve'}
    >
      <CheckCircle
        className={`h-3.5 w-3.5 ${approved ? 'fill-green-600 dark:fill-green-500 text-white' : ''}`}
      />
      <span>{approved ? 'Approved' : 'Approve'}</span>
    </button>
  )
}
