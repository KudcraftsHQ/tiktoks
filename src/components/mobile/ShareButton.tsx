'use client';

import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareButtonProps {
  preparedFiles: File[] | null;
  isPreparing: boolean;
}

export function ShareButton({ preparedFiles, isPreparing }: ShareButtonProps) {
  const isReady = preparedFiles !== null && preparedFiles.length >= 2;

  const handleShare = async () => {
    if (!preparedFiles || preparedFiles.length < 2) {
      toast.error('TikTok slideshows require at least 2 images');
      return;
    }

    try {
      // Check if sharing is supported
      if (!navigator.canShare) {
        toast.error('Web Share API not supported on this device');
        return;
      }

      if (!navigator.canShare({ files: preparedFiles })) {
        toast.error('Sharing files not supported on this device');
        return;
      }

      // Share via Web Share API immediately
      // IMPORTANT: On iOS, use files ONLY (no title or text)
      await navigator.share({ files: preparedFiles });

      toast.success('Shared successfully');
    } catch (error: any) {
      // User cancelled share
      if (error.name === 'AbortError') {
        return;
      }

      console.error('Share error:', error);
      toast.error(error.message || 'Failed to share');
    }
  };

  const getButtonText = () => {
    if (isPreparing) return 'Preparing images...';
    if (!isReady) return 'No images to share';
    return 'Share to TikTok';
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
        disabled={!isReady || isPreparing}
        className="w-full"
        size="lg"
      >
        <Share2 className="mr-2 h-5 w-5" />
        {getButtonText()}
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Creates 3:4 portrait slideshow • Works with TikTok app
      </p>
    </div>
  );
}
