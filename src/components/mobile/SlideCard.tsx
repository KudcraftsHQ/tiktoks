'use client';

import { useState } from 'react';
import { Copy, Check, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { RemixSlide } from '@/types/remix';

interface SlideCardProps {
  slide: RemixSlide;
  imageUrl: string;
  index: number;
  hasCustomPosition?: boolean;
  onEditPosition?: () => void;
}

export function SlideCard({
  slide,
  imageUrl,
  index,
  hasCustomPosition = false,
  onEditPosition
}: SlideCardProps) {
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Slide Image */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Slide ${index + 1}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">No image</p>
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex gap-2">
          <div className="rounded bg-black/70 px-2 py-1 text-xs text-white">
            Slide {index + 1}
          </div>
          {hasCustomPosition && (
            <div className="rounded bg-blue-500/90 px-2 py-1 text-xs text-white">
              Edited
            </div>
          )}
        </div>
      </div>

      {/* Slide Text and Actions */}
      <div className="space-y-2 p-4">
        {slide.paraphrasedText && (
          <p className="whitespace-pre-wrap text-sm">{slide.paraphrasedText}</p>
        )}
        <div className="flex gap-2">
          {onEditPosition && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditPosition}
              className="flex-1"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Position
            </Button>
          )}
          {slide.paraphrasedText && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Text
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
