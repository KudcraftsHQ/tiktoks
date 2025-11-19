'use client'

import { useState } from 'react'
import { SlideEditor } from '@/components/SlideEditor'
import type { SlideData } from '@/lib/satori-renderer'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function TestEditorPage() {
  const [isExporting, setIsExporting] = useState(false)

  // Initial slide data with new effect examples
  const [slideData, setSlideData] = useState<SlideData>({
    canvas: {
      width: 1080,
      height: 1920,
    },
    backgroundLayers: [
      {
        id: 'bg-1',
        type: 'gradient',
        gradient: {
          type: 'linear',
          colors: ['#ff9a9e', '#fad0c4'],
          angle: 135,
        },
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        opacity: 1,
        zIndex: 0,
      },
    ],
    textBoxes: [
      {
        id: 'text-hugging',
        text: 'TikTok Style\nHugging Background\n✨ Works with Emojis 🚀',
        x: 0.1,
        y: 0.2,
        width: 0.8,
        height: 0.2, // Will be auto-calculated
        fontSize: 64,
        fontFamily: 'Poppins',
        fontWeight: 'bold',
        fontStyle: 'normal',
        textDecoration: 'none',
        color: '#ffffff',
        textAlign: 'center',
        zIndex: 10,
        paddingTop: 24,
        paddingRight: 32,
        paddingBottom: 24,
        paddingLeft: 32,
        lineHeight: 1.2,
        enableBlobBackground: true,
        blobColor: '#000000',
        blobOpacity: 0.8,
        blobSpread: 30,
        blobRoundness: 0.6,
      },
      {
        id: 'text-outline',
        text: 'Outline Effect\nWith Emojis 🎨\nLooks Crisp!',
        x: 0.1,
        y: 0.55,
        width: 0.8,
        height: 0.2, // Will be auto-calculated
        fontSize: 64,
        fontFamily: 'Poppins',
        fontWeight: 800,
        fontStyle: 'italic',
        textDecoration: 'none',
        color: '#ffffff',
        textAlign: 'center',
        zIndex: 11,
        paddingTop: 24,
        paddingRight: 32,
        paddingBottom: 24,
        paddingLeft: 32,
        lineHeight: 1.2,
        outlineWidth: 4,
        outlineColor: '#000000',
      },
    ],
  })

  const handleExport = async () => {
    setIsExporting(true)

    try {
      const response = await fetch('/api/test-satori/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slide: slideData,
          options: {
            format: 'png',
            quality: 0.95,
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Export failed')
      }

      // Download the image
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `slide-export-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Slide exported successfully!')
    } catch (error) {
      console.error('Export error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to export slide')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-white z-10">
        <div>
          <h1 className="text-2xl font-bold">New Carousel Editor</h1>
          <p className="text-sm text-muted-foreground">Testing improved text effects and renderer parity</p>
        </div>
        <div className="flex gap-4">
           <Button variant="outline" onClick={() => window.location.reload()}>
            Reset
          </Button>
          <Button variant="secondary" onClick={handleExport} disabled={isExporting}>
            Backend Export
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export PNG'}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <SlideEditor slideData={slideData} onSlideDataChange={setSlideData} />
      </div>
    </div>
  )
}
