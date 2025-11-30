'use client';

import { useState, useRef, useEffect } from 'react';
import { Copy, Check, Edit, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { RemixSlide } from '@/types/remix';
import type { TextOverlay } from '@/lib/text-overlay-utils';
import { TextOverlayRender } from './TextOverlayBox';

interface SlideCardProps {
  slide: RemixSlide;
  imageUrl: string;
  index: number;
  imageOffsetY?: number;
  hasCustomPosition?: boolean;
  textOverlays?: TextOverlay[];
  hasCustomOverlays?: boolean;
  onEditPosition?: () => void;
  onEditText?: () => void;
}

export function SlideCard({
  slide,
  imageUrl,
  index,
  imageOffsetY = 0.5,
  hasCustomPosition = false,
  textOverlays = [],
  hasCustomOverlays = false,
  onEditPosition,
  onEditText,
}: SlideCardProps) {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Update container size for text overlay scaling
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(slide.paraphrasedText || '');
      setCopied(true);
      toast.success('Text copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Failed to copy text');
    }
  };

  // Calculate object position for background image
  const getObjectPosition = () => {
    const yPercent = imageOffsetY * 100;
    return `50% ${yPercent}%`;
  };

  const hasTextOverlays = textOverlays.length > 0;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Slide Image with Overlays */}
      <div
        ref={containerRef}
        className="relative aspect-[3/4] w-full overflow-hidden bg-muted"
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={`Slide ${index + 1}`}
              className="h-full w-full object-cover"
              style={{
                objectPosition: getObjectPosition(),
              }}
            />
            {/* Text overlays */}
            {hasTextOverlays &&
              containerSize.width > 0 &&
              textOverlays.map((overlay) => (
                <TextOverlayRender
                  key={overlay.id}
                  overlay={overlay}
                  containerWidth={containerSize.width}
                  containerHeight={containerSize.height}
                />
              ))}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No image</p>
          </div>
        )}

        {/* Badges */}
        <div className="absolute bottom-2 left-2 flex gap-2">
          <div className="rounded bg-black/70 px-2 py-1 text-xs text-white">
            Slide {index + 1}
          </div>
          {hasCustomPosition && (
            <div className="rounded bg-blue-500/90 px-2 py-1 text-xs text-white">
              Position
            </div>
          )}
          {hasCustomOverlays && (
            <div className="rounded bg-purple-500/90 px-2 py-1 text-xs text-white">
              Text
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 p-4">
        {/* Show original text if no overlays */}
        {!hasTextOverlays && slide.paraphrasedText && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {slide.paraphrasedText}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {onEditText && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditText}
              className="flex-1"
            >
              <Type className="mr-2 h-4 w-4" />
              Edit Text
            </Button>
          )}
          {onEditPosition && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditPosition}
              className="flex-1"
            >
              <Edit className="mr-2 h-4 w-4" />
              Position
            </Button>
          )}
          {slide.paraphrasedText && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className={onEditText || onEditPosition ? 'flex-1' : 'w-full'}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
