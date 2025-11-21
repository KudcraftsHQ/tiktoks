'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { ConceptsTable, Concept } from '@/components/ConceptsTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Lightbulb, Plus, Sparkles, Filter } from 'lucide-react'
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

interface ConceptsResponse {
  concepts: Concept[]
  totalCount: number
  stats: Record<string, number>
}

const categoryOptions = [
  { value: 'ALGORITHM_MECHANICS', label: 'Algorithm Mechanics' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'CONTENT_STRATEGY', label: 'Content Strategy' },
  { value: 'MISTAKES', label: 'Mistakes' },
  { value: 'MINDSET', label: 'Mindset' },
  { value: 'HIDDEN_FEATURES', label: 'Hidden Features' },
]

const sourceOptions = [
  { value: 'EXTRACTED', label: 'Extracted' },
  { value: 'CURATED', label: 'Curated' },
  { value: 'WEB_SCRAPED', label: 'Web Scraped' },
]

const freshnessOptions = [
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]

export default function ConceptsPage() {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [stats, setStats] = useState<Record<string, number>>({})

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [freshnessFilter, setFreshnessFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Add concept dialog
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newConcept, setNewConcept] = useState({
    concept: '',
    insiderTerm: '',
    explanation: '',
    consequence: '',
    viralAngle: '',
    proofPhrase: '',
    credibilitySource: '',
    category: 'ALGORITHM_MECHANICS',
  })

  const fetchConcepts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      if (categoryFilter && categoryFilter !== 'all') {
        params.append('category', categoryFilter)
      }
      if (sourceFilter && sourceFilter !== 'all') {
        params.append('source', sourceFilter)
      }
      if (freshnessFilter && freshnessFilter !== 'all') {
        params.append('freshness', freshnessFilter)
      }
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
      setStats(result.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setConcepts([])
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, sourceFilter, freshnessFilter, searchQuery])

  const handleRefresh = useCallback(() => {
    fetchConcepts()
  }, [fetchConcepts])

  const handleAddConcept = async () => {
    if (!newConcept.concept || !newConcept.explanation) {
      toast.error('Concept name and explanation are required')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newConcept,
          insiderTerm: newConcept.insiderTerm || null,
          consequence: newConcept.consequence || null,
          viralAngle: newConcept.viralAngle || null,
          proofPhrase: newConcept.proofPhrase || null,
          credibilitySource: newConcept.credibilitySource || null,
        }),
      })

      if (response.status === 409) {
        const data = await response.json()
        toast.error('A similar concept already exists')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to create concept')
      }

      toast.success('Concept created successfully')
      setIsAddDialogOpen(false)
      setNewConcept({
        concept: '',
        insiderTerm: '',
        explanation: '',
        consequence: '',
        viralAngle: '',
        proofPhrase: '',
        credibilitySource: '',
        category: 'ALGORITHM_MECHANICS',
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

  // Calculate stats summary
  const totalStats = useMemo(() => {
    return Object.values(stats).reduce((sum, count) => sum + count, 0)
  }, [stats])

  return (
    <PageLayout
      title={
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <span>Concept Bank</span>
          <Badge variant="secondary" className="ml-2">
            {totalCount} concepts
          </Badge>
        </div>
      }
      description="Viral content insights extracted from TikTok posts"
      headerActions={
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
          {/* Search */}
          <Input
            placeholder="Search concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[200px] h-8 text-xs"
          />

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[150px] h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categoryOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Source Filter */}
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sourceOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Freshness Filter */}
          <Select value={freshnessFilter} onValueChange={setFreshnessFilter}>
            <SelectTrigger className="w-full sm:w-[120px] h-8 text-xs">
              <SelectValue placeholder="Freshness" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Freshness</SelectItem>
              {freshnessOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 px-4 pt-4">
            {categoryOptions.map((cat) => (
              <div
                key={cat.value}
                className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setCategoryFilter(categoryFilter === cat.value ? 'all' : cat.value)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground truncate">{cat.label}</span>
                  {categoryFilter === cat.value && (
                    <Filter className="h-3 w-3 text-primary" />
                  )}
                </div>
                <div className="text-xl font-bold">{stats[cat.value] || 0}</div>
              </div>
            ))}
          </div>

          {/* Concepts Table */}
          {concepts.length > 0 ? (
            <div className="px-4 pb-4">
              <ConceptsTable
                concepts={concepts}
                onRefresh={handleRefresh}
                isLoading={loading}
              />
            </div>
          ) : loading ? (
            <Card className="mx-4">
              <CardContent className="flex items-center justify-center py-12">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Loading concepts...</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="mx-4">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No concepts found</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  {searchQuery || categoryFilter !== 'all' || sourceFilter !== 'all' || freshnessFilter !== 'all'
                    ? 'No concepts match your filters. Try adjusting your search criteria.'
                    : 'Start by extracting concepts from TikTok posts or add them manually.'}
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Concept
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Add Concept Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Concept</DialogTitle>
            <DialogDescription>
              Manually add a viral content insight to your concept bank
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Concept Name *</Label>
                <Input
                  value={newConcept.concept}
                  onChange={(e) => setNewConcept({ ...newConcept, concept: e.target.value })}
                  placeholder="e.g., Draft Timestamp Penalty"
                />
              </div>
              <div className="space-y-2">
                <Label>Insider Term</Label>
                <Input
                  value={newConcept.insiderTerm}
                  onChange={(e) => setNewConcept({ ...newConcept, insiderTerm: e.target.value })}
                  placeholder="e.g., 'draft decay'"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Explanation *</Label>
              <Textarea
                value={newConcept.explanation}
                onChange={(e) => setNewConcept({ ...newConcept, explanation: e.target.value })}
                rows={2}
                placeholder="How this insight works"
              />
            </div>

            <div className="space-y-2">
              <Label>Consequence</Label>
              <Textarea
                value={newConcept.consequence}
                onChange={(e) => setNewConcept({ ...newConcept, consequence: e.target.value })}
                rows={2}
                placeholder="What happens as a result"
              />
            </div>

            <div className="space-y-2">
              <Label>Viral Angle</Label>
              <Textarea
                value={newConcept.viralAngle}
                onChange={(e) => setNewConcept({ ...newConcept, viralAngle: e.target.value })}
                rows={2}
                placeholder="How to phrase in a slide (casual, lowercase)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Proof Phrase</Label>
                <Input
                  value={newConcept.proofPhrase}
                  onChange={(e) => setNewConcept({ ...newConcept, proofPhrase: e.target.value })}
                  placeholder="e.g., 'this one shocked me'"
                />
              </div>
              <div className="space-y-2">
                <Label>Credibility Source</Label>
                <Input
                  value={newConcept.credibilitySource}
                  onChange={(e) => setNewConcept({ ...newConcept, credibilitySource: e.target.value })}
                  placeholder="e.g., 'we tracked this internally'"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newConcept.category}
                onValueChange={(value) => setNewConcept({ ...newConcept, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
