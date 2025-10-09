import { useState, useCallback } from 'react'
import * as domtoimage from 'dom-to-image-more'
import JSZip from 'jszip'

interface ExportOptions {
  format?: 'png' | 'jpeg'
  quality?: number
  backgroundColor?: string | null
}

export function useClientSideExport() {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  /**
   * Export a single slide element to PNG/JPEG
   */
  const exportSlideElement = useCallback(async (
    element: HTMLElement,
    options: ExportOptions = {}
  ): Promise<Blob> => {
    const {
      format = 'png',
      quality = 0.95,
      backgroundColor = '#ffffff'
    } = options

    // Use dom-to-image-more which has better CSS support
    const dataUrl = await domtoimage.toPng(element, {
      width: element.offsetWidth,
      height: element.offsetHeight,
      bgcolor: backgroundColor ?? '#ffffff',
      quality,
      scale: 2, // 2x for better quality
      style: {
        // Ensure element is fully visible
        transform: 'none',
        opacity: '1',
      }
    })

    // Convert data URL to blob
    const response = await fetch(dataUrl)
    const blob = await response.blob()

    if (!blob) {
      throw new Error('Failed to generate image blob')
    }

    return blob
  }, [])

  /**
   * Export all slides and download as ZIP
   */
  const exportSlidesAsZip = useCallback(async (
    slideElements: HTMLElement[],
    remixName: string,
    options: ExportOptions = {}
  ) => {
    if (slideElements.length === 0) {
      throw new Error('No slides to export')
    }

    setIsExporting(true)
    setProgress({ current: 0, total: slideElements.length })

    try {
      const zip = new JSZip()
      const { format = 'png' } = options

      // Export each slide
      for (let i = 0; i < slideElements.length; i++) {
        console.log(`📸 [Export] Capturing slide ${i + 1}/${slideElements.length}`)
        
        const blob = await exportSlideElement(slideElements[i], options)
        const filename = `${remixName.replace(/[^a-zA-Z0-9]/g, '_')}_slide_${(i + 1).toString().padStart(2, '0')}.${format}`
        
        zip.file(filename, blob)
        
        setProgress({ current: i + 1, total: slideElements.length })
        
        console.log(`✅ [Export] Slide ${i + 1} captured: ${blob.size} bytes`)
      }

      // Add README
      const readmeContent = `# ${remixName}

Exported slides from Remix Studio

## Details
- Total Slides: ${slideElements.length}
- Export Date: ${new Date().toISOString()}
- Format: ${format.toUpperCase()}

## Files
${slideElements.map((_, i) =>
  `- ${remixName.replace(/[^a-zA-Z0-9]/g, '_')}_slide_${(i + 1).toString().padStart(2, '0')}.${format}`
).join('\n')}

---
Generated with Remix Studio (Client-Side Export)
`

      zip.file('README.md', readmeContent)

      // Generate ZIP
      console.log(`📦 [Export] Generating ZIP...`)
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      console.log(`✅ [Export] ZIP generated: ${zipBlob.size} bytes`)

      // Trigger download
      const url = window.URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${remixName.replace(/[^a-zA-Z0-9]/g, '_')}-export.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      console.log(`🎉 [Export] Export completed successfully!`)
      
      return zipBlob
    } finally {
      setIsExporting(false)
      setProgress({ current: 0, total: 0 })
    }
  }, [exportSlideElement])

  /**
   * Export a single slide and download
   */
  const exportSingleSlide = useCallback(async (
    element: HTMLElement,
    filename: string,
    options: ExportOptions = {}
  ) => {
    setIsExporting(true)

    try {
      const blob = await exportSlideElement(element, options)
      
      // Trigger download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      return blob
    } finally {
      setIsExporting(false)
    }
  }, [exportSlideElement])

  return {
    isExporting,
    progress,
    exportSlideElement,
    exportSlidesAsZip,
    exportSingleSlide
  }
}
