import type { RemixSlideType } from '@/lib/validations/remix-schema'

interface ExportOptions {
  format: 'png' | 'jpg'
  quality: number
  scale?: number
}

/**
 * Export a slide as an image using Konva canvas (server-side)
 */
export async function exportSlideAsImage(
  slide: RemixSlideType,
  backgroundImageUrls: Record<string, string>,
  options: ExportOptions = { format: 'png', quality: 0.95 }
): Promise<string> {
  // Import Konva only on server side
  const Konva = await import('konva')

  return new Promise((resolve, reject) => {
    // Create a temporary stage for export (server-side)
    const stage = new Konva.Stage({
      width: slide.canvas.width,
      height: slide.canvas.height
    })

    const layer = new Konva.Layer()
    stage.add(layer)

    let loadedImages = 0
    const totalImages = slide.backgroundLayers?.filter(l => l.type === 'image').length || 0

    // Function to check if all images are loaded
    const checkAllLoaded = () => {
      loadedImages++
      if (loadedImages === totalImages) {
        // All images loaded, export the stage
        try {
          const dataURL = stage.toDataURL({
            mimeType: options.format === 'png' ? 'image/png' : 'image/jpeg',
            quality: options.quality,
            pixelRatio: options.scale || 2
          })

          // Clean up
          stage.destroy()
          resolve(dataURL)
        } catch (error) {
          stage.destroy()
          reject(error)
        }
      }
    }

    // Add background layers
    slide.backgroundLayers?.forEach((bgLayer) => {
      if (bgLayer.type === 'image' && bgLayer.imageId) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const konvaImage = new Konva.Image({
            image: img,
            x: bgLayer.x * slide.canvas.width,
            y: bgLayer.y * slide.canvas.height,
            width: slide.canvas.width * bgLayer.width,
            height: slide.canvas.height * bgLayer.height,
            opacity: bgLayer.opacity
          })
          layer.add(konvaImage)
          checkAllLoaded()
        }
        img.onerror = () => {
          console.error('Failed to load image for export:', bgLayer.imageId)
          checkAllLoaded()
        }
        img.src = backgroundImageUrls[bgLayer.imageId] || `/api/assets/${bgLayer.imageId}`
      } else if (bgLayer.type === 'color') {
        const rect = new Konva.Rect({
          x: 0,
          y: 0,
          width: slide.canvas.width,
          height: slide.canvas.height,
          fill: bgLayer.color,
          opacity: bgLayer.opacity
        })
        layer.add(rect)
      } else if (bgLayer.type === 'gradient') {
        // For gradients, we'll use a simple fallback color for now
        const rect = new Konva.Rect({
          x: 0,
          y: 0,
          width: slide.canvas.width,
          height: slide.canvas.height,
          fill: bgLayer.gradient?.colors?.[0] || '#ffffff',
          opacity: bgLayer.opacity
        })
        layer.add(rect)
      }
    })

    // Add text boxes
    slide.textBoxes.forEach((textBox) => {
      const text = new Konva.Text({
        x: textBox.x * slide.canvas.width,
        y: textBox.y * slide.canvas.height,
        width: textBox.width * slide.canvas.width,
        height: textBox.height * slide.canvas.height,
        text: textBox.text,
        fontSize: textBox.fontSize,
        fontFamily: textBox.fontFamily,
        fontStyle: textBox.fontStyle,
        fontWeight: textBox.fontWeight,
        textDecoration: textBox.textDecoration,
        fill: textBox.color,
        align: textBox.textAlign as any,
        verticalAlign: textBox.textAlign === 'center' ? 'middle' : 'top',
        lineHeight: textBox.lineHeight || 1.2,
        letterSpacing: textBox.letterSpacing,
        wrap: textBox.textWrap === 'wrap' ? 'word' : 'none',
        ellipsis: textBox.textWrap === 'ellipsis',
        padding: {
          top: textBox.paddingTop,
          right: textBox.paddingRight,
          bottom: textBox.paddingBottom,
          left: textBox.paddingLeft
        },
        stroke: textBox.outlineWidth && textBox.outlineWidth > 0 ? textBox.outlineColor : undefined,
        strokeWidth: textBox.outlineWidth || 0,
        shadowColor: textBox.enableShadow ? textBox.shadowColor : undefined,
        shadowBlur: textBox.enableShadow ? textBox.shadowBlur : 0,
        shadowOffsetX: textBox.enableShadow ? textBox.shadowOffsetX : 0,
        shadowOffsetY: textBox.enableShadow ? textBox.shadowOffsetY : 0,
        shadowOpacity: textBox.enableShadow ? 1 : 0
      })
      layer.add(text)
    })

    // If no images to load, export immediately
    if (totalImages === 0) {
      try {
        const dataURL = stage.toDataURL({
          mimeType: options.format === 'png' ? 'image/png' : 'image/jpeg',
          quality: options.quality,
          pixelRatio: options.scale || 2
        })

        // Clean up
        stage.destroy()
        resolve(dataURL)
      } catch (error) {
        stage.destroy()
        reject(error)
      }
    }
  })
}

/**
 * Export multiple slides as a ZIP file (server-side)
 */
export async function exportSlidesAsZip(
  slides: RemixSlideType[],
  backgroundImageUrls: Record<string, string>,
  options: ExportOptions = { format: 'png', quality: 0.95 }
): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  // Export each slide
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const dataURL = await exportSlideAsImage(slide, backgroundImageUrls, options)

    // Convert dataURL to buffer
    const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Add to zip
    zip.file(`slide_${i + 1}.${options.format}`, buffer)
  }

  // Generate ZIP file
  return zip.generateAsync({ type: 'blob' })
}