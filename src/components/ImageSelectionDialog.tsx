'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { 
  Image as ImageIcon, 
  Search, 
  Sparkles, 
  Upload,
  Library
} from 'lucide-react'

interface ImageSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectImage: (imageUrl: string) => void
}

// Placeholder images for demo - in real app these would come from Pinterest API, AI, etc.
const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=600&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=600&fit=crop'
]

export function ImageSelectionDialog({ 
  open, 
  onOpenChange, 
  onSelectImage 
}: ImageSelectionDialogProps) {
  const [activeTab, setActiveTab] = useState<'pinterest' | 'ai' | 'upload' | 'library'>('pinterest')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerateAI = async () => {
    setIsGenerating(true)
    // Simulate AI generation delay
    setTimeout(() => {
      setIsGenerating(false)
      // In real app, this would call AI image generation API
      console.log('Generate AI image with prompt:', searchQuery)
    }, 2000)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string
        setSelectedImage(imageUrl)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSelect = () => {
    if (selectedImage) {
      onSelectImage(selectedImage)
      onOpenChange(false)
      setSelectedImage(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>🖼️ Select Background Image</DialogTitle>
          <DialogDescription>
            Choose an image from Pinterest, generate with AI, upload your own, or select from library.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b">
          {[
            { id: 'pinterest', label: '📌 Pinterest', icon: Search },
            { id: 'ai', label: '🎨 AI Generate', icon: Sparkles },
            { id: 'upload', label: '📁 Upload', icon: Upload },
            { id: 'library', label: '🗃️ Library', icon: Library }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* Search/Prompt Input */}
          {(activeTab === 'pinterest' || activeTab === 'ai') && (
            <div className="flex gap-2">
              <Input
                placeholder={
                  activeTab === 'pinterest' 
                    ? 'Search Pinterest images...' 
                    : 'Describe the image you want to generate...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              {activeTab === 'ai' && (
                <Button 
                  onClick={handleGenerateAI}
                  disabled={!searchQuery.trim() || isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b border-current mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Upload Area */}
          {activeTab === 'upload' && (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-medium">Click to upload an image</span>
                <span className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</span>
              </label>
            </div>
          )}

          {/* Image Grid */}
          {(activeTab === 'pinterest' || activeTab === 'library') && (
            <div className="grid grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {PLACEHOLDER_IMAGES.map((imageUrl, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(imageUrl)}
                  className={`aspect-[3/4] rounded-lg overflow-hidden border-2 transition-colors ${
                    selectedImage === imageUrl
                      ? 'border-primary'
                      : 'border-transparent hover:border-muted-foreground/50'
                  }`}
                >
                  <img
                    src={imageUrl}
                    alt={`Option ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Generated/Uploaded Image Preview */}
          {activeTab === 'ai' && isGenerating && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Generating your image...</p>
              </div>
            </div>
          )}

          {selectedImage && (activeTab === 'upload' || activeTab === 'ai') && (
            <div className="flex justify-center">
              <div className="w-48 aspect-[3/4] rounded-lg overflow-hidden border-2 border-primary">
                <img
                  src={selectedImage}
                  alt="Selected"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Empty States */}
          {activeTab === 'pinterest' && !searchQuery && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Search Pinterest for images</p>
            </div>
          )}

          {activeTab === 'ai' && !searchQuery && !isGenerating && (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Describe the image you want to create</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSelect}
            disabled={!selectedImage}
          >
            Select Image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}