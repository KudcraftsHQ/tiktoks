'use client'

import { useState, useRef } from 'react'
import { SlideEditor } from '@/components/SlideEditor'
import type { SlideData } from '@/lib/satori-renderer'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import html2canvas from 'html2canvas-pro'

export default function TestEditorPage() {
  const [isExporting, setIsExporting] = useState(false)
  const previewContainerRef = useRef<HTMLDivElement>(null)

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
    if (!previewContainerRef.current) {
      toast.error('Preview container not found')
      return
    }

    setIsExporting(true)

    try {
      console.log('🚀 Starting frontend export with html2canvas-pro...')

      // Find the canvas element inside the preview container
      const canvasElement = previewContainerRef.current.querySelector('[data-slide-canvas]')

      if (!canvasElement) {
        throw new Error('Slide canvas not found')
      }

      const currentWidth = (canvasElement as HTMLElement).offsetWidth
      const currentHeight = (canvasElement as HTMLElement).offsetHeight
      const targetWidth = slideData.canvas.width
      const targetHeight = slideData.canvas.height
      const scaleRatio = targetWidth / currentWidth

      console.log('📸 Canvas element found:', {
        tagName: canvasElement.tagName,
        currentWidth,
        currentHeight,
        targetWidth,
        targetHeight,
        scaleRatio,
        childrenCount: canvasElement.children.length,
      })

      console.log('📸 Capturing canvas element at full resolution...')

      // Use html2canvas-pro to capture the canvas element directly
      // html2canvas-pro supports modern CSS colors like oklch/lab
      // Set width/height to render at full size (1080x1920) instead of preview size (432x768)
      const canvas = await html2canvas(canvasElement as HTMLElement, {
        backgroundColor: '#ffffff',
        width: targetWidth,
        height: targetHeight,
        scale: 1, // No additional scaling needed since we're specifying exact dimensions
        logging: true, // Enable logging to debug
        useCORS: true, // Handle cross-origin images
        allowTaint: true, // Allow tainted canvas for now
      })

      console.log('✅ Canvas captured:', {
        width: canvas.width,
        height: canvas.height
      })

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Failed to create image blob')
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `slide-export-${Date.now()}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        console.log('✅ Export completed successfully')
        toast.success('Slide exported successfully!')
        setIsExporting(false)
      }, 'image/png', 0.95)

    } catch (error) {
      console.error('💥 Export error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to export slide')
      setIsExporting(false)
    }
  }

  return (
    <div className="w-full min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-background z-10">
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
      <div ref={previewContainerRef} className="flex-1 overflow-hidden">
        <SlideEditor slideData={slideData} onSlideDataChange={setSlideData} />
      </div>
    </div>
  )
}
