'use client';

import { Share2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareButtonProps {
  preparedFiles: File[] | null;
  isPreparing: boolean;
}

export function ShareButton({ preparedFiles, isPreparing }: ShareButtonProps) {
  const isReady = preparedFiles !== null && preparedFiles.length >= 2;

  // Debug: Download all images as a zip or individually
  const handleDebugDownload = async () => {
    if (!preparedFiles || preparedFiles.length === 0) {
      toast.error('No images to download');
      return;
    }

    try {
      // Download each file individually
      for (let i = 0; i < preparedFiles.length; i++) {
        const file = preparedFiles[i];
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slide-${i + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Small delay between downloads to prevent browser blocking
        if (i < preparedFiles.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      toast.success(`Downloaded ${preparedFiles.length} images`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download images');
    }
  };

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
      <div className="flex gap-2">
        {/* Debug download button */}
        <Button
          onClick={handleDebugDownload}
          disabled={!isReady || isPreparing}
          variant="outline"
          size="lg"
          className="shrink-0"
        >
          <Download className="h-5 w-5" />
        </Button>

        {/* Main share button */}
        <Button
          onClick={handleShare}
          disabled={!isReady || isPreparing}
          className="flex-1"
          size="lg"
        >
          <Share2 className="mr-2 h-5 w-5" />
          {getButtonText()}
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Creates 3:4 portrait slideshow • Works with TikTok app
      </p>
    </div>
  );
}
