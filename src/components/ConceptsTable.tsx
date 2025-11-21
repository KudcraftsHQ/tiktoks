'use client'

import { useState, useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { Trash2, Edit, ToggleLeft, ToggleRight, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface Concept {
  id: string
  concept: string
  insiderTerm: string | null
  explanation: string
  consequence: string | null
  viralAngle: string | null
  proofPhrase: string | null
  credibilitySource: string | null
  category: string
  source: string
  freshness: string
  timesUsed: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ConceptsTableProps {
  concepts: Concept[]
  onRefresh: () => void
  isLoading?: boolean
}

const categoryColors: Record<string, string> = {
  ALGORITHM_MECHANICS: 'bg-purple-100 text-purple-800',
  ENGAGEMENT: 'bg-blue-100 text-blue-800',
  CONTENT_STRATEGY: 'bg-green-100 text-green-800',
  MISTAKES: 'bg-red-100 text-red-800',
  MINDSET: 'bg-yellow-100 text-yellow-800',
  HIDDEN_FEATURES: 'bg-pink-100 text-pink-800',
}

const categoryLabels: Record<string, string> = {
  ALGORITHM_MECHANICS: 'Algorithm',
  ENGAGEMENT: 'Engagement',
  CONTENT_STRATEGY: 'Content',
  MISTAKES: 'Mistakes',
  MINDSET: 'Mindset',
  HIDDEN_FEATURES: 'Features',
}

const freshnessColors: Record<string, string> = {
  HIGH: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-red-100 text-red-800',
}

const sourceLabels: Record<string, string> = {
  EXTRACTED: 'Extracted',
  CURATED: 'Curated',
  WEB_SCRAPED: 'Web',
}

export function ConceptsTable({ concepts, onRefresh, isLoading }: ConceptsTableProps) {
  const [editingConcept, setEditingConcept] = useState<Concept | null>(null)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  const handleToggleActive = useCallback(async (concept: Concept) => {
    try {
      const response = await fetch(`/api/concepts/${concept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !concept.isActive })
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success(`Concept ${concept.isActive ? 'disabled' : 'enabled'}`)
      onRefresh()
    } catch (err) {
      toast.error('Failed to update concept')
    }
  }, [onRefresh])

  const handleDelete = useCallback(async (id: string) => {
    setIsDeleting(id)
    try {
      const response = await fetch(`/api/concepts/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete')

      toast.success('Concept deleted')
      onRefresh()
    } catch (err) {
      toast.error('Failed to delete concept')
    } finally {
      setIsDeleting(null)
    }
  }, [onRefresh])

  const handleSaveEdit = useCallback(async () => {
    if (!editingConcept) return

    try {
      const response = await fetch(`/api/concepts/${editingConcept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: editingConcept.concept,
          insiderTerm: editingConcept.insiderTerm,
          explanation: editingConcept.explanation,
          consequence: editingConcept.consequence,
          viralAngle: editingConcept.viralAngle,
          proofPhrase: editingConcept.proofPhrase,
          credibilitySource: editingConcept.credibilitySource,
          category: editingConcept.category
        })
      })

      if (!response.ok) throw new Error('Failed to update')

      toast.success('Concept updated')
      setEditingConcept(null)
      onRefresh()
    } catch (err) {
      toast.error('Failed to update concept')
    }
  }, [editingConcept, onRefresh])

  const columns: ColumnDef<Concept>[] = useMemo(() => [
    {
      accessorKey: 'concept',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Concept
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <div className="font-medium truncate">{row.original.concept}</div>
          {row.original.insiderTerm && (
            <div className="text-xs text-muted-foreground italic">"{row.original.insiderTerm}"</div>
          )}
        </div>
      ),
      size: 200,
    },
    {
      accessorKey: 'explanation',
      header: 'Explanation',
      cell: ({ row }) => (
        <div className="max-w-[300px] text-sm text-muted-foreground line-clamp-2">
          {row.original.explanation}
        </div>
      ),
      size: 300,
    },
    {
      accessorKey: 'viralAngle',
      header: 'Viral Angle',
      cell: ({ row }) => (
        <div className="max-w-[200px] text-sm italic line-clamp-2">
          {row.original.viralAngle || '-'}
        </div>
      ),
      size: 200,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <Badge className={categoryColors[row.original.category] || 'bg-gray-100'}>
          {categoryLabels[row.original.category] || row.original.category}
        </Badge>
      ),
      size: 100,
    },
    {
      accessorKey: 'freshness',
      header: 'Fresh',
      cell: ({ row }) => (
        <Badge variant="outline" className={freshnessColors[row.original.freshness]}>
          {row.original.freshness}
        </Badge>
      ),
      size: 80,
    },
    {
      accessorKey: 'timesUsed',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Used
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center">{row.original.timesUsed}</div>
      ),
      size: 60,
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <Badge variant="secondary">
          {sourceLabels[row.original.source] || row.original.source}
        </Badge>
      ),
      size: 80,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditingConcept(row.original)}
            className="h-8 w-8"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleToggleActive(row.original)}
            className="h-8 w-8"
          >
            {row.original.isActive ? (
              <ToggleRight className="h-4 w-4 text-green-600" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-gray-400" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(row.original.id)}
            disabled={isDeleting === row.original.id}
            className="h-8 w-8 text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      size: 120,
    },
  ], [handleToggleActive, handleDelete, isDeleting])

  return (
    <>
      <DataTable
        columns={columns}
        data={concepts}
        enableSorting={true}
        enablePagination={true}
        pageSize={20}
        isLoading={isLoading}
        rowClassName={(row) => row.isActive ? '' : 'opacity-50'}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editingConcept} onOpenChange={() => setEditingConcept(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Concept</DialogTitle>
            <DialogDescription>
              Update the concept details below
            </DialogDescription>
          </DialogHeader>

          {editingConcept && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Concept Name</Label>
                  <Input
                    value={editingConcept.concept}
                    onChange={(e) => setEditingConcept({ ...editingConcept, concept: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Insider Term</Label>
                  <Input
                    value={editingConcept.insiderTerm || ''}
                    onChange={(e) => setEditingConcept({ ...editingConcept, insiderTerm: e.target.value })}
                    placeholder="e.g., 'draft decay'"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Explanation</Label>
                <Textarea
                  value={editingConcept.explanation}
                  onChange={(e) => setEditingConcept({ ...editingConcept, explanation: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Consequence</Label>
                <Textarea
                  value={editingConcept.consequence || ''}
                  onChange={(e) => setEditingConcept({ ...editingConcept, consequence: e.target.value })}
                  rows={2}
                  placeholder="What happens as a result"
                />
              </div>

              <div className="space-y-2">
                <Label>Viral Angle</Label>
                <Textarea
                  value={editingConcept.viralAngle || ''}
                  onChange={(e) => setEditingConcept({ ...editingConcept, viralAngle: e.target.value })}
                  rows={2}
                  placeholder="How to phrase in a slide (casual, lowercase)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proof Phrase</Label>
                  <Input
                    value={editingConcept.proofPhrase || ''}
                    onChange={(e) => setEditingConcept({ ...editingConcept, proofPhrase: e.target.value })}
                    placeholder="e.g., 'this one shocked me'"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Credibility Source</Label>
                  <Input
                    value={editingConcept.credibilitySource || ''}
                    onChange={(e) => setEditingConcept({ ...editingConcept, credibilitySource: e.target.value })}
                    placeholder="e.g., 'we tracked this internally'"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editingConcept.category}
                  onValueChange={(value) => setEditingConcept({ ...editingConcept, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALGORITHM_MECHANICS">Algorithm Mechanics</SelectItem>
                    <SelectItem value="ENGAGEMENT">Engagement</SelectItem>
                    <SelectItem value="CONTENT_STRATEGY">Content Strategy</SelectItem>
                    <SelectItem value="MISTAKES">Mistakes</SelectItem>
                    <SelectItem value="MINDSET">Mindset</SelectItem>
                    <SelectItem value="HIDDEN_FEATURES">Hidden Features</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConcept(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
