'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ConceptsTable, Concept, ConceptExample } from '@/components/ConceptsTable'
import { Button } from '@/components/ui/button'
import { RefreshCw, Plus, Filter } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageLayout } from '@/components/PageLayout'
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SlideClassificationBadge } from '@/components/SlideClassificationBadge'

interface ConceptsResponse {
  concepts: Concept[]
  totalCount: number
  typeCounts: Record<string, number>
}

const typeOptions = [
  { value: 'HOOK', label: 'Hook', description: 'Opening slide patterns' },
  { value: 'CONTENT', label: 'Content', description: 'Body slide lessons' },
  { value: 'CTA', label: 'CTA', description: 'Closing slide patterns' },
]

export default function ConceptsPage() {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({})

  // Multi-select type filter
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['HOOK', 'CONTENT', 'CTA']))
  const [searchQuery, setSearchQuery] = useState('')

  const toggleType = (type: string) => {
    const newSelected = new Set(selectedTypes)
    if (newSelected.has(type)) {
      // Don't allow deselecting all types
      if (newSelected.size > 1) {
        newSelected.delete(type)
      }
    } else {
      newSelected.add(type)
    }
    setSelectedTypes(newSelected)
  }

  const allTypesSelected = selectedTypes.size === 3

  // Add concept dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newConcept, setNewConcept] = useState({
    title: '',
    coreMessage: '',
    type: 'CONTENT',
    exampleText: '',
  })

  const fetchConcepts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      // Fetch all concepts (no type filter in API call)
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/concepts?${params}`)
      const result: ConceptsResponse = await response.json()

      if (!response.ok) {
        throw new Error('Failed to fetch concepts')
      }

      setConcepts(result.concepts)
      setTotalCount(result.totalCount)
      setTypeCounts(result.typeCounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setConcepts([])
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  const handleRefresh = useCallback(() => {
    fetchConcepts()
  }, [fetchConcepts])

  // Optimistically update concepts when new examples are added
  const handleExamplesAdded = useCallback((conceptId: string, newExamples: ConceptExample[]) => {
    setConcepts(prevConcepts =>
      prevConcepts.map(concept =>
        concept.id === conceptId
          ? {
              ...concept,
              examples: [...concept.examples, ...newExamples],
              _count: {
                ...concept._count,
                examples: concept._count.examples + newExamples.length
              }
            }
          : concept
      )
    )
  }, [])

  // Optimistically update concepts when an example is deleted
  const handleExampleDeleted = useCallback((conceptId: string, exampleId: string) => {
    setConcepts(prevConcepts =>
      prevConcepts.map(concept =>
        concept.id === conceptId
          ? {
              ...concept,
              examples: concept.examples.filter(ex => ex.id !== exampleId),
              _count: {
                ...concept._count,
                examples: Math.max(0, concept._count.examples - 1)
              }
            }
          : concept
      )
    )
  }, [])

  const handleAddConcept = async () => {
    if (!newConcept.title || !newConcept.coreMessage) {
      toast.error('Title and core message are required')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newConcept.title,
          coreMessage: newConcept.coreMessage,
          type: newConcept.type,
          exampleText: newConcept.exampleText || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create concept')
      }

      toast.success('Concept created successfully')
      setIsAddDialogOpen(false)
      setNewConcept({
        title: '',
        coreMessage: '',
        type: 'CONTENT',
        exampleText: '',
      })
      fetchConcepts()
    } catch (err) {
      toast.error('Failed to create concept')
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    fetchConcepts()
  }, [fetchConcepts])

  // Filter concepts by selected types for display
  const filteredConcepts = concepts.filter(c => selectedTypes.has(c.type))

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-2">
          <span>Concept Bank</span>
          <Input
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[200px] h-8 text-xs"
          />
        </div>
      }
      headerActions={
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
          {/* Type Multi-Select Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5">
                <Filter className="h-3 w-3" />
                {allTypesSelected ? (
                  <span>All Types</span>
                ) : (
                  <div className="flex items-center gap-1">
                    {selectedTypes.has('HOOK') && <SlideClassificationBadge type="HOOK" className="text-[10px] px-1.5 py-0" />}
                    {selectedTypes.has('CONTENT') && <SlideClassificationBadge type="CONTENT" className="text-[10px] px-1.5 py-0" />}
                    {selectedTypes.has('CTA') && <SlideClassificationBadge type="CTA" className="text-[10px] px-1.5 py-0" />}
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuCheckboxItem
                checked={selectedTypes.has('HOOK')}
                onCheckedChange={() => toggleType('HOOK')}
              >
                <div className="flex items-center gap-2">
                  <SlideClassificationBadge type="HOOK" />
                  <span className="text-xs text-muted-foreground">({typeCounts['HOOK'] || 0})</span>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={selectedTypes.has('CONTENT')}
                onCheckedChange={() => toggleType('CONTENT')}
              >
                <div className="flex items-center gap-2">
                  <SlideClassificationBadge type="CONTENT" />
                  <span className="text-xs text-muted-foreground">({typeCounts['CONTENT'] || 0})</span>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={selectedTypes.has('CTA')}
                onCheckedChange={() => toggleType('CTA')}
              >
                <div className="flex items-center gap-2">
                  <SlideClassificationBadge type="CTA" />
                  <span className="text-xs text-muted-foreground">({typeCounts['CTA'] || 0})</span>
                </div>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Concept */}
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="w-full sm:w-auto h-8 px-3 text-xs"
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Add Concept
          </Button>

          {/* Refresh */}
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="outline"
            size="sm"
            className="w-full sm:w-auto h-8 px-3 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      {error ? (
        <Card className="border-red-200 bg-red-50 mx-4">
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : loading && filteredConcepts.length === 0 ? (
        <div className="mx-4">
          {/* Skeleton Table Header */}
          <div className="rounded-md border">
            <div className="border-b bg-muted/50 px-4 py-3">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-24" />
                <div className="flex-1" />
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
            {/* Skeleton Table Rows */}
            {[...Array(6)].map((_, rowIndex) => (
              <div key={rowIndex} className="border-b last:border-b-0 px-4 py-4">
                <div className="flex items-start gap-4">
                  {/* Concept column skeleton */}
                  <div className="w-[200px] flex-shrink-0 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                  {/* Type column skeleton */}
                  <div className="w-[80px] flex-shrink-0">
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  {/* Examples column skeleton - horizontal cards */}
                  <div className="flex-1 flex gap-3 overflow-hidden">
                    {[...Array(4)].map((_, cardIndex) => (
                      <div key={cardIndex} className="w-52 flex-shrink-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-3 w-12" />
                          <Skeleton className="h-3 w-10" />
                        </div>
                        <Skeleton className="h-32 w-full rounded-md" />
                      </div>
                    ))}
                  </div>
                  {/* Actions column skeleton */}
                  <div className="w-[50px] flex-shrink-0 flex flex-col gap-1">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ConceptsTable
          concepts={filteredConcepts}
          onRefresh={handleRefresh}
          onExamplesAdded={handleExamplesAdded}
          onExampleDeleted={handleExampleDeleted}
          isLoading={loading}
        />
      )}

      {/* Add Concept Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add New Concept</DialogTitle>
            <DialogDescription>
              Create a reusable content pattern for your carousels
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newConcept.title}
                onChange={(e) => setNewConcept({ ...newConcept, title: e.target.value })}
                placeholder="e.g., Story over niche"
              />
            </div>

            <div className="space-y-2">
              <Label>Core Message *</Label>
              <Textarea
                value={newConcept.coreMessage}
                onChange={(e) => setNewConcept({ ...newConcept, coreMessage: e.target.value })}
                rows={2}
                placeholder="One sentence summary: e.g., People follow people, not topics"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={newConcept.type}
                onValueChange={(value) => setNewConcept({ ...newConcept, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Example Copy (optional)</Label>
              <Textarea
                value={newConcept.exampleText}
                onChange={(e) => setNewConcept({ ...newConcept, exampleText: e.target.value })}
                rows={4}
                placeholder="Add an example of how this concept is written in a slide..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddConcept} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Concept'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
