'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  Sparkles,
  Loader2,
  Plus,
  Minus,
  Wand2,
  GripVertical,
  ChevronDown,
  AlertCircle,
  Lightbulb,
  RefreshCw,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Types
interface Concept {
  id: string
  title: string
  coreMessage: string
  type: 'HOOK' | 'CONTENT' | 'CTA'
  timesUsed: number
  _count: { examples: number }
  examples?: ConceptExample[]
}

interface ConceptExample {
  id: string
  text: string
  sourceType: string
}

interface GroupedConcepts {
  HOOK: Concept[]
  CONTENT: Concept[]
  CTA: Concept[]
}

interface SlideConceptSelection {
  slideIndex: number
  type: 'HOOK' | 'CONTENT' | 'CTA'
  conceptId: string | null // null means "Let AI decide"
  conceptTitle?: string
}

interface DefaultSlideStructure {
  slideIndex: number
  type: 'HOOK' | 'CONTENT' | 'CTA'
}

interface TopicSuggestion {
  topic: string
  angle: string
  description: string
}

interface ConceptDraftBuilderProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onDraftCreated?: (draft: any) => void
  referencePostCount?: number // Number of reference posts in the project
  defaultSlideStructure?: DefaultSlideStructure[] | null // Structure from first reference post
}

export function ConceptDraftBuilder({
  isOpen,
  onClose,
  projectId,
  onDraftCreated,
  referencePostCount = 0,
  defaultSlideStructure
}: ConceptDraftBuilderProps) {
  // Loading states
  const [isLoadingConcepts, setIsLoadingConcepts] = useState(false)
  const [isSuggestingConcepts, setIsSuggestingConcepts] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSuggestingTopics, setIsSuggestingTopics] = useState(false)

  // Topic suggestions
  const [topicSuggestions, setTopicSuggestions] = useState<TopicSuggestion[]>([])
  const [showTopicSuggestions, setShowTopicSuggestions] = useState(false)

  // Data
  const [groupedConcepts, setGroupedConcepts] = useState<GroupedConcepts>({
    HOOK: [],
    CONTENT: [],
    CTA: []
  })

  // Form state
  const [topic, setTopic] = useState('')
  const [slideSelections, setSlideSelections] = useState<SlideConceptSelection[]>([
    { slideIndex: 0, type: 'HOOK', conceptId: null },
    { slideIndex: 1, type: 'CONTENT', conceptId: null },
    { slideIndex: 2, type: 'CONTENT', conceptId: null },
    { slideIndex: 3, type: 'CTA', conceptId: null }
  ])
  const [languageStyle, setLanguageStyle] = useState('follow the reference content language style')

  // Build default slide selections based on reference or fallback
  const getDefaultSlideSelections = useCallback((): SlideConceptSelection[] => {
    if (defaultSlideStructure && defaultSlideStructure.length > 0) {
      // Use first reference post's structure
      return defaultSlideStructure.map(s => ({
        slideIndex: s.slideIndex,
        type: s.type,
        conceptId: null
      }))
    }
    // Fallback to default 4-slide structure
    return [
      { slideIndex: 0, type: 'HOOK', conceptId: null },
      { slideIndex: 1, type: 'CONTENT', conceptId: null },
      { slideIndex: 2, type: 'CONTENT', conceptId: null },
      { slideIndex: 3, type: 'CTA', conceptId: null }
    ]
  }, [defaultSlideStructure])

  // Fetch concepts when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchConcepts()
      // Reset form with default structure from reference post
      setTopic('')
      setSlideSelections(getDefaultSlideSelections())
      setLanguageStyle('follow the reference content language style')
    }
  }, [isOpen, getDefaultSlideSelections])

  const fetchConcepts = async () => {
    setIsLoadingConcepts(true)
    try {
      const response = await fetch('/api/concepts?isActive=true')
      if (!response.ok) throw new Error('Failed to fetch concepts')
      const data = await response.json()
      setGroupedConcepts(data.grouped || { HOOK: [], CONTENT: [], CTA: [] })
    } catch (error) {
      console.error('Failed to fetch concepts:', error)
      toast.error('Failed to load concepts')
    } finally {
      setIsLoadingConcepts(false)
    }
  }

  // Add a slide at the end
  const addSlide = () => {
    if (slideSelections.length >= 10) {
      toast.error('Maximum 10 slides allowed')
      return
    }

    // Add a CONTENT slide at the end
    const newIndex = slideSelections.length
    setSlideSelections([
      ...slideSelections,
      {
        slideIndex: newIndex,
        type: 'CONTENT',
        conceptId: null
      }
    ])
  }

  // Remove a slide (can remove any slide except first if it would leave < 3 slides)
  const removeSlide = (index: number) => {
    if (slideSelections.length <= 3) {
      toast.error('Minimum 3 slides required')
      return
    }

    const newSelections = slideSelections
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, slideIndex: i }))
    setSlideSelections(newSelections)
  }

  // Update slide type
  const updateSlideType = (slideIndex: number, newType: 'HOOK' | 'CONTENT' | 'CTA') => {
    setSlideSelections(prev =>
      prev.map(s => {
        if (s.slideIndex === slideIndex) {
          return { ...s, type: newType, conceptId: null, conceptTitle: undefined }
        }
        return s
      })
    )
  }

  // Update concept selection for a slide
  const updateSlideConceptId = (slideIndex: number, conceptId: string | null) => {
    setSlideSelections(prev =>
      prev.map(s => {
        if (s.slideIndex === slideIndex) {
          const concept = conceptId
            ? [...groupedConcepts.HOOK, ...groupedConcepts.CONTENT, ...groupedConcepts.CTA].find(c => c.id === conceptId)
            : null
          return {
            ...s,
            conceptId,
            conceptTitle: concept?.title
          }
        }
        return s
      })
    )
  }

  // Let AI suggest concepts for all slides
  const handleAISuggest = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic first')
      return
    }

    setIsSuggestingConcepts(true)
    try {
      const response = await fetch('/api/concepts/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          slideCount: slideSelections.length,
          projectId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get AI suggestions')
      }

      const data = await response.json()

      // Update slide selections with AI suggestions
      if (data.suggestions && Array.isArray(data.suggestions)) {
        setSlideSelections(prev =>
          prev.map((slide, index) => {
            const suggestion = data.suggestions.find((s: any) => s.slideIndex === index)
            if (suggestion) {
              const concept = [...groupedConcepts.HOOK, ...groupedConcepts.CONTENT, ...groupedConcepts.CTA]
                .find(c => c.id === suggestion.conceptId)
              return {
                ...slide,
                conceptId: suggestion.conceptId,
                conceptTitle: concept?.title || suggestion.conceptTitle
              }
            }
            return slide
          })
        )
        toast.success('AI suggested concepts for all slides')
      }
    } catch (error) {
      console.error('Failed to get AI suggestions:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to get AI suggestions')
    } finally {
      setIsSuggestingConcepts(false)
    }
  }

  // Fetch topic suggestions from AI based on reference posts
  const handleSuggestTopics = async () => {
    if (referencePostCount === 0) {
      toast.error('Add reference posts to get topic suggestions')
      return
    }

    setIsSuggestingTopics(true)
    try {
      const response = await fetch('/api/topics/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          count: 3
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get topic suggestions')
      }

      const data = await response.json()

      if (data.suggestions && Array.isArray(data.suggestions)) {
        setTopicSuggestions(data.suggestions)
        setShowTopicSuggestions(true)
      }
    } catch (error) {
      console.error('Failed to get topic suggestions:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to get topic suggestions')
    } finally {
      setIsSuggestingTopics(false)
    }
  }

  // Select a topic suggestion
  const handleSelectTopic = (suggestion: TopicSuggestion) => {
    setTopic(suggestion.topic)
    setShowTopicSuggestions(false)
    toast.success('Topic selected')
  }

  // Generate the draft
  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic')
      return
    }

    // Check if at least some concepts are selected
    const selectedCount = slideSelections.filter(s => s.conceptId).length
    if (selectedCount === 0) {
      // All slides set to "Let AI decide" - that's OK, but warn
      toast.info('All slides set to "Let AI decide" - generating with AI-selected concepts')
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/remixes/generate-with-concepts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          topic: topic.trim(),
          languageStyle,
          slides: slideSelections.map(s => ({
            slideIndex: s.slideIndex,
            type: s.type,
            conceptId: s.conceptId // null means AI decides
          }))
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate draft')
      }

      const data = await response.json()

      toast.success('Draft created successfully!')
      onClose()

      if (onDraftCreated && data.remix) {
        onDraftCreated(data.remix)
      }
    } catch (error) {
      console.error('Failed to generate draft:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate draft')
    } finally {
      setIsGenerating(false)
    }
  }

  // Get concepts for a slide type
  const getConceptsForType = (type: 'HOOK' | 'CONTENT' | 'CTA') => {
    return groupedConcepts[type] || []
  }

  // Check if we have any concepts
  const hasAnyConcepts = groupedConcepts.HOOK.length > 0 ||
    groupedConcepts.CONTENT.length > 0 ||
    groupedConcepts.CTA.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Create Draft with Concepts
          </DialogTitle>
          <DialogDescription>
            Select concepts for each slide, then generate a cohesive draft.
            {referencePostCount > 0 && (
              <span className="ml-1">
                Using {referencePostCount} reference post{referencePostCount !== 1 ? 's' : ''} for style.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6 pb-4">
            {/* Topic Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="topic">Topic / Angle *</Label>
                <Popover open={showTopicSuggestions} onOpenChange={setShowTopicSuggestions}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSuggestTopics}
                      disabled={isSuggestingTopics || referencePostCount === 0}
                      className="h-7 text-xs gap-1.5"
                    >
                      {isSuggestingTopics ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Thinking...
                        </>
                      ) : (
                        <>
                          <Lightbulb className="h-3 w-3" />
                          AI Suggest
                        </>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-96 p-0" align="end">
                    <div className="p-3 border-b flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Topic Suggestions</p>
                        <p className="text-xs text-muted-foreground">Based on your reference posts</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSuggestTopics}
                        disabled={isSuggestingTopics}
                        className="h-7 w-7 p-0"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", isSuggestingTopics && "animate-spin")} />
                      </Button>
                    </div>
                    <div className="p-2 space-y-2 max-h-[300px] overflow-y-auto">
                      {topicSuggestions.length === 0 && !isSuggestingTopics && (
                        <p className="text-sm text-muted-foreground p-2 text-center">
                          Click to generate suggestions
                        </p>
                      )}
                      {isSuggestingTopics && (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {!isSuggestingTopics && topicSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          className={cn(
                            "w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors",
                            "hover:border-primary/30"
                          )}
                          onClick={() => handleSelectTopic(suggestion)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-tight">{suggestion.topic}</p>
                              {suggestion.angle && (
                                <Badge variant="secondary" className="mt-1.5 text-xs">
                                  {suggestion.angle}
                                </Badge>
                              )}
                              {suggestion.description && (
                                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                                  {suggestion.description}
                                </p>
                              )}
                            </div>
                            <Check className="h-4 w-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Textarea
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What is this carousel about? e.g., '5 ways to grow your LinkedIn following' or 'Why most people fail at building habits'"
                rows={2}
              />
              {referencePostCount === 0 && (
                <p className="text-xs text-muted-foreground">
                  Add reference posts to enable AI topic suggestions
                </p>
              )}
            </div>

            {/* AI Suggest Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleAISuggest}
                disabled={isSuggestingConcepts || !topic.trim() || !hasAnyConcepts}
                className="flex-1"
              >
                {isSuggestingConcepts ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    AI is suggesting...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Let AI Suggest All Concepts
                  </>
                )}
              </Button>
            </div>

            {/* No Concepts Warning */}
            {!hasAnyConcepts && !isLoadingConcepts && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">No concepts in your bank yet</p>
                  <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                    Add concepts to your Concept Bank first, or let AI decide all slides.
                  </p>
                </div>
              </div>
            )}

            {/* Slide Concept Selections */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Slide Structure ({slideSelections.length} slides)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSlide}
                  disabled={slideSelections.length >= 10}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Slide
                </Button>
              </div>

              <div className="space-y-2">
                {slideSelections.map((slide, index) => {
                  const concepts = getConceptsForType(slide.type)
                  const selectedConcept = slide.conceptId
                    ? concepts.find(c => c.id === slide.conceptId)
                    : null
                  // Can remove any slide as long as we have more than 3
                  const canRemove = slideSelections.length > 3

                  return (
                    <div
                      key={slide.slideIndex}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border",
                        slide.conceptId ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                      )}
                    >
                      {/* Slide Number */}
                      <div className="flex items-center gap-1 w-12 flex-shrink-0">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">#{index + 1}</span>
                      </div>

                      {/* Slide Type Selector */}
                      <Select
                        value={slide.type}
                        onValueChange={(value) => updateSlideType(slide.slideIndex, value as 'HOOK' | 'CONTENT' | 'CTA')}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOOK">
                            <span className="text-blue-600 font-medium">HOOK</span>
                          </SelectItem>
                          <SelectItem value="CONTENT">
                            <span className="text-green-600 font-medium">CONTENT</span>
                          </SelectItem>
                          <SelectItem value="CTA">
                            <span className="text-orange-600 font-medium">CTA</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Concept Selector */}
                      <div className="flex-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-between h-auto py-2"
                              disabled={isLoadingConcepts}
                            >
                              <span className={cn(
                                "text-left truncate",
                                !slide.conceptId && "text-muted-foreground"
                              )}>
                                {slide.conceptId
                                  ? (selectedConcept?.title || slide.conceptTitle || 'Selected')
                                  : 'Let AI decide'
                                }
                              </span>
                              <ChevronDown className="h-4 w-4 ml-2 flex-shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-0" align="start">
                            <div className="p-2 border-b">
                              <p className="text-sm font-medium">Select {slide.type} Concept</p>
                            </div>
                            <ScrollArea className="h-[250px]">
                              <div className="p-2 space-y-1">
                                {/* AI Decide Option */}
                                <button
                                  className={cn(
                                    "w-full text-left p-2 rounded-md hover:bg-muted transition-colors",
                                    !slide.conceptId && "bg-muted"
                                  )}
                                  onClick={() => updateSlideConceptId(slide.slideIndex, null)}
                                >
                                  <div className="flex items-center gap-2">
                                    <Wand2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Let AI decide</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 ml-6">
                                    AI will choose the best concept for this slide
                                  </p>
                                </button>

                                {concepts.length === 0 ? (
                                  <p className="text-sm text-muted-foreground p-2">
                                    No {slide.type.toLowerCase()} concepts available
                                  </p>
                                ) : (
                                  concepts.map(concept => (
                                    <button
                                      key={concept.id}
                                      className={cn(
                                        "w-full text-left p-2 rounded-md hover:bg-muted transition-colors",
                                        slide.conceptId === concept.id && "bg-primary/10 border border-primary/20"
                                      )}
                                      onClick={() => updateSlideConceptId(slide.slideIndex, concept.id)}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium truncate">{concept.title}</span>
                                        <Badge variant="outline" className="text-xs ml-2">
                                          {concept._count.examples} ex
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                        {concept.coreMessage}
                                      </p>
                                    </button>
                                  ))
                                )}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Remove Button */}
                      {canRemove ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSlide(index)}
                          className="h-8 w-8 flex-shrink-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Language Style */}
            <div className="space-y-2">
              <Label htmlFor="languageStyle">Language Style</Label>
              <Input
                id="languageStyle"
                value={languageStyle}
                onChange={(e) => setLanguageStyle(e.target.value)}
                placeholder="e.g., casual, formal, emoji-heavy"
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !topic.trim()}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Draft
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
