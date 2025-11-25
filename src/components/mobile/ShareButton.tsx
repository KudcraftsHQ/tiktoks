'use client';

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { RemixSlide } from '@/types/remix';

interface ShareButtonProps {
  slides: RemixSlide[];
  draftName: string;
}

export function ShareButton({ slides, draftName }: ShareButtonProps) {
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

      // 2. Get presigned URLs
      const urlsResponse = await fetch('/api/mobile/get-slide-urls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheAssetIds }),
      });

      if (!urlsResponse.ok) {
        throw new Error('Failed to get image URLs');
      }

      const { urls } = await urlsResponse.json();

      // 3. Fetch images as blobs
      toast.loading('Loading images...');
      const imageBlobs = await Promise.all(
        urls.map(async (url: string) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error('Failed to fetch image');
          }
          return response.blob();
        })
      );

      // 4. Convert to File objects
      const files = imageBlobs.map(
        (blob, i) =>
          new File([blob], `${draftName}-slide-${i + 1}.png`, {
            type: 'image/png',
          })
      );

      toast.dismiss();

      // 5. Check if sharing is supported
      if (!navigator.canShare) {
        toast.error('Web Share API not supported on this device');
        return;
      }

      if (!navigator.canShare({ files })) {
        toast.error('Sharing files not supported on this device');
        return;
      }

      // 6. Share via Web Share API
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
        Creates a slideshow • Works with TikTok app
      </p>
    </div>
  );
}
