'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { RemixSlide } from '@/types/remix';
import { cropImageTo3x4 } from '@/lib/mobile-image-cropper';

interface ShareButtonProps {
  slides: RemixSlide[];
  draftName: string;
  imagePositions: Map<string, number>;
}

export function ShareButton({ slides, draftName, imagePositions }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);

    try {
      // 1. Extract cacheAssetIds from slide backgrounds
      const cacheAssetIds = slides
        .map((slide) => slide.backgroundLayers?.[0]?.cacheAssetId)
        .filter((id): id is string => Boolean(id));

      if (cacheAssetIds.length === 0) {
        toast.error('No images to share');
        return;
      }

      if (cacheAssetIds.length < 2) {
        toast.error('TikTok slideshows require at least 2 images');
        return;
      }

      if (cacheAssetIds.length > 35) {
        toast.error('TikTok slideshows support maximum 35 images');
        return;
      }

      // 2. Generate cropped 4:3 images sequentially
      const croppedBlobs: Blob[] = [];
      const totalSlides = slides.length;

      for (let i = 0; i < totalSlides; i++) {
        const slide = slides[i];
        const cacheAssetId = slide.backgroundLayers?.[0]?.cacheAssetId;

        if (!cacheAssetId) continue;

        // Show progress
        toast.loading(`Preparing slide ${i + 1} of ${totalSlides}...`);

        // Get presigned URL for this slide
        const urlsResponse = await fetch('/api/mobile/get-slide-urls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cacheAssetIds: [cacheAssetId] }),
        });

        if (!urlsResponse.ok) {
          throw new Error(`Failed to get image URL for slide ${i + 1}`);
        }

        const { urls } = await urlsResponse.json();
        const imageUrl = urls[0];

        // Get position offset (default 0.5 for center)
        const offsetY = imagePositions.get(slide.id) ?? 0.5;

        // Crop to 3:4 portrait
        const blob = await cropImageTo3x4(imageUrl, offsetY);
        croppedBlobs.push(blob);
      }

      // 3. Convert to File objects
      const files = croppedBlobs.map(
        (blob, i) =>
          new File([blob], `${draftName}-slide-${i + 1}.png`, {
            type: 'image/png',
          })
      );

      toast.dismiss();

      // 4. Check if sharing is supported
      if (!navigator.canShare) {
        toast.error('Web Share API not supported on this device');
        return;
      }

      if (!navigator.canShare({ files })) {
        toast.error('Sharing files not supported on this device');
        return;
      }

      // 5. Share via Web Share API
      // IMPORTANT: On iOS, use files ONLY (no title or text)
      await navigator.share({ files });

      toast.success('Shared successfully');
    } catch (error: any) {
      // User cancelled share
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Share error:', error);
      toast.error(error.message || 'Failed to share');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      className="border-t bg-background p-4"
      style={{
        paddingBottom: `calc(1rem + var(--safe-area-inset-bottom))`,
      }}
    >
      <Button
        onClick={handleShare}
        disabled={isSharing}
        className="w-full"
        size="lg"
      >
        <Share2 className="mr-2 h-5 w-5" />
        {isSharing ? 'Preparing...' : 'Share to TikTok'}
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Creates 3:4 portrait slideshow • Works with TikTok app
      </p>
    </div>
  );
}
