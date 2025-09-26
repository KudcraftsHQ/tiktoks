import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, Download, Sparkles } from 'lucide-react'

interface RemixSlide {
  id: string
  displayOrder: number
  paraphrasedText: string
  imageDescription?: string
  suggestedBackgroundConcept?: string
  textBoxes: Array<{
    id: string
    text: string
  }>
}

interface RemixCardProps {
  remix: {
    id: string
    name: string
    description?: string
    generationType: string
    createdAt: string
    slides: RemixSlide[]
  }
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onDownload: (id: string) => void
}

export function RemixCard({ remix, onEdit, onDelete, onDownload }: RemixCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {remix.name}
            </CardTitle>
            {remix.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {remix.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Button
              onClick={() => onEdit(remix.id)}
              size="sm"
              variant="outline"
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              onClick={() => onDelete(remix.id)}
              size="sm"
              variant="outline"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Slide Previews */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">Remix Slides</p>
          <div className="overflow-x-auto remix-slides-container">
            <div className="flex gap-2 min-w-max pb-2">
              {(Array.isArray(remix.slides) ? remix.slides : []).map((slide, index) => (
                <div key={slide.id} className="flex-shrink-0 w-24 space-y-1">
                  <div className="aspect-[9/16] bg-gradient-to-br from-blue-50 to-purple-50 rounded border flex flex-col justify-between p-1">
                    <div className="text-[6px] text-muted-foreground text-center">
                      {slide.suggestedBackgroundConcept || 'Concept'}
                    </div>
                    <div className="text-[6px] leading-tight text-center text-gray-700 bg-white/80 rounded px-1 py-0.5">
                      {slide.paraphrasedText.substring(0, 40)}...
                    </div>
                  </div>
                  <p className="text-[8px] text-center text-muted-foreground">
                    Slide {index + 1}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{(Array.isArray(remix.slides) ? remix.slides : []).length} slides</span>
            <Badge variant="outline" className="text-xs">
              {remix.generationType}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground">
            Created {new Date(remix.createdAt).toLocaleDateString()}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => onEdit(remix.id)}
            size="sm"
            className="flex-1"
          >
            <Edit className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDownload(remix.id)}
          >
            <Download className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}