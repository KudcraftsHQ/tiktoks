'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { SlideCard } from '@/components/mobile/SlideCard';
import { ShareButton } from '@/components/mobile/ShareButton';
import { ImagePositionEditor } from '@/components/mobile/ImagePositionEditor';
import { TextOverlayEditor } from '@/components/mobile/TextOverlayEditor';
import { toast } from 'sonner';
import type { RemixSlide } from '@/types/remix';
import type { TextOverlay, TextOverlayStyle, TextOverlayAlignment } from '@/lib/text-overlay-utils';
import { parseTextToOverlays, generateOverlayId } from '@/lib/text-overlay-utils';
import { renderSlideWithOverlays } from '@/lib/mobile-text-renderer';

/**
 * Convert saved textBoxes back to mobile TextOverlay format
 */
function textBoxesToOverlays(textBoxes: any[]): TextOverlay[] {
  if (!Array.isArray(textBoxes) || textBoxes.length === 0) {
    return [];
  }

  return textBoxes.map((box) => ({
    id: box.id || generateOverlayId(),
    text: box.text || '',
    x: box.x ?? 0.5,
    y: box.y ?? 0.5,
    fontSize: box.fontSize ?? 48,
    alignment: (box.textAlign || 'center') as TextOverlayAlignment,
    // Recover mobile style from saved data
    style: (box._mobileStyle || (box.backgroundOpacity > 0 ? 'pill' : 'outline')) as TextOverlayStyle,
    maxWidth: box._mobileMaxWidth ?? box.width ?? 0.6,
  }));
}

export default function MobileDraftDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [draft, setDraft] = useState<any>(null);
  const [slides, setSlides] = useState<RemixSlide[]>([]);
  const [slideUrls, setSlideUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Image position state
  const [imagePositions, setImagePositions] = useState<Map<string, number>>(new Map());
  const [editingPositionSlideId, setEditingPositionSlideId] = useState<string | null>(null);

  // Text overlay state - Map of slideId to TextOverlay[]
  const [slideOverlays, setSlideOverlays] = useState<Map<string, TextOverlay[]>>(new Map());
  const [editingTextSlideId, setEditingTextSlideId] = useState<string | null>(null);
  // Track which slides have been manually edited (vs default parsed state)
  const [editedSlideIds, setEditedSlideIds] = useState<Set<string>>(new Set());

  // Share state
  const [preparedFiles, setPreparedFiles] = useState<File[] | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const preparationAbortRef = useRef<AbortController | null>(null);

  // Initialize text overlays and image positions from saved data or paraphrasedText
  useEffect(() => {
    if (slides.length > 0 && slideOverlays.size === 0) {
      const initialOverlays = new Map<string, TextOverlay[]>();
      const initialPositions = new Map<string, number>();
      const initialEditedIds = new Set<string>();

      slides.forEach((slide: any) => {
        // Check if slide has saved textBoxes (previously edited)
        if (slide.textBoxes && slide.textBoxes.length > 0) {
          initialOverlays.set(slide.id, textBoxesToOverlays(slide.textBoxes));
          initialEditedIds.add(slide.id);
        } else if (slide.paraphrasedText) {
          // Fall back to parsing paraphrasedText
          initialOverlays.set(slide.id, parseTextToOverlays(slide.paraphrasedText));
        } else {
          initialOverlays.set(slide.id, []);
        }

        // Load saved image position if available
        if (slide._mobileImageOffsetY !== undefined) {
          initialPositions.set(slide.id, slide._mobileImageOffsetY);
        }
      });

      setSlideOverlays(initialOverlays);
      setImagePositions(initialPositions);
      setEditedSlideIds(initialEditedIds);
    }
  }, [slides, slideOverlays.size]);

  useEffect(() => {
    async function fetchDraft() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`/api/mobile/drafts/${id}`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setDraft(data);

        // Parse slides
        const parsedSlides = typeof data.slides === 'string'
          ? JSON.parse(data.slides)
          : data.slides;

        setSlides(parsedSlides);

        // Get presigned URLs for all slides
        const cacheAssetIds = parsedSlides
          .map((slide: RemixSlide) => slide.backgroundLayers?.[0]?.cacheAssetId)
          .filter((id: string | undefined): id is string => Boolean(id));

        if (cacheAssetIds.length > 0) {
          const urlsResponse = await fetch('/api/mobile/get-slide-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cacheAssetIds }),
          });

          if (urlsResponse.ok) {
            const { urls } = await urlsResponse.json();
            setSlideUrls(urls);
          }
        }
      } catch (error) {
        console.error('Error fetching draft:', error);
        if (error instanceof Error && error.name === 'AbortError') {
          setError('Request timed out. Please check your network connection.');
        } else {
          setError(error instanceof Error ? error.message : 'Failed to load draft');
        }
        toast.error('Failed to load draft');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDraft();
  }, [id]);

  // Prepare images for sharing (render with text overlays)
  const prepareImagesForShare = useCallback(async () => {
    if (slideUrls.length === 0 || slides.length === 0) return;

    // Cancel any ongoing preparation
    if (preparationAbortRef.current) {
      preparationAbortRef.current.abort();
    }
    preparationAbortRef.current = new AbortController();

    setIsPreparing(true);
    setPreparedFiles(null);

    try {
      const blobs: Blob[] = [];

      // Process slides one at a time
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const url = slideUrls[i];
        const offsetY = imagePositions.get(slide.id) ?? 0.5;
        const overlays = slideOverlays.get(slide.id) ?? [];

        if (!url) {
          throw new Error(`Missing URL for slide ${i + 1}`);
        }

        // Check if aborted
        if (preparationAbortRef.current?.signal.aborted) {
          return;
        }

        // Render slide with overlays
        const blob = await renderSlideWithOverlays(url, offsetY, overlays);
        blobs.push(blob);
      }

      // Check if preparation was aborted
      if (preparationAbortRef.current?.signal.aborted) {
        return;
      }

      // Convert to File objects
      const files = blobs.map(
        (blob, i) =>
          new File([blob], `slide-${i + 1}.png`, { type: 'image/png' })
      );

      // Validate TikTok requirements
      if (files.length > 35) {
        toast.error('TikTok slideshows support maximum 35 images');
        setPreparedFiles(null);
        return;
      }

      setPreparedFiles(files);
    } catch (error) {
      if (preparationAbortRef.current?.signal.aborted) {
        return;
      }
      console.error('Image preparation error:', error);
      toast.error('Failed to prepare images for sharing');
      setPreparedFiles(null);
    } finally {
      setIsPreparing(false);
    }
  }, [slideUrls, slides, imagePositions, slideOverlays]);

  // Prepare images when URLs are available or overlays/positions change
  useEffect(() => {
    if (slideUrls.length > 0 && slides.length > 0 && slideOverlays.size > 0) {
      prepareImagesForShare();
    }
  }, [prepareImagesForShare, slideOverlays.size]);

  // Save overlays and positions to database
  const saveToDatabase = useCallback(async (
    slideId: string,
    overlays: TextOverlay[],
    imageOffsetY?: number
  ) => {
    try {
      const response = await fetch(`/api/mobile/drafts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: [{
            slideId,
            textOverlays: overlays,
            imageOffsetY,
          }],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      return true;
    } catch (error) {
      console.error('Failed to save to database:', error);
      return false;
    }
  }, [id]);

  // Position editor handlers
  const handleEditPosition = (slideId: string) => {
    setEditingPositionSlideId(slideId);
  };

  const handleSavePosition = async (slideId: string, offsetY: number) => {
    // Update local state
    setImagePositions(prev => new Map(prev).set(slideId, offsetY));
    setEditingPositionSlideId(null);

    // Get current overlays for this slide
    const overlays = slideOverlays.get(slideId) ?? [];

    // Save to database
    const saved = await saveToDatabase(slideId, overlays, offsetY);
    if (saved) {
      toast.success('Position saved');
    } else {
      toast.error('Failed to save position');
    }
  };

  const handleCancelPositionEdit = () => {
    setEditingPositionSlideId(null);
  };

  // Text editor handlers
  const handleEditText = (slideId: string) => {
    setEditingTextSlideId(slideId);
  };

  const handleSaveTextOverlays = async (slideId: string, overlays: TextOverlay[]) => {
    // Update local state
    setSlideOverlays(prev => new Map(prev).set(slideId, overlays));
    setEditedSlideIds(prev => new Set(prev).add(slideId));
    setEditingTextSlideId(null);

    // Get current image position for this slide
    const imageOffsetY = imagePositions.get(slideId);

    // Save to database
    const saved = await saveToDatabase(slideId, overlays, imageOffsetY);
    if (saved) {
      toast.success('Text saved');
    } else {
      toast.error('Failed to save text');
    }
  };

  const handleCancelTextEdit = () => {
    setEditingTextSlideId(null);
  };

  // Get data for position editor
  const editingPositionSlide = slides.find(s => s.id === editingPositionSlideId);
  const editingPositionSlideIndex = slides.findIndex(s => s.id === editingPositionSlideId);
  const editingPositionImageUrl = editingPositionSlideIndex >= 0 ? slideUrls[editingPositionSlideIndex] : '';

  // Get data for text editor
  const editingTextSlide = slides.find(s => s.id === editingTextSlideId);
  const editingTextSlideIndex = slides.findIndex(s => s.id === editingTextSlideId);
  const editingTextImageUrl = editingTextSlideIndex >= 0 ? slideUrls[editingTextSlideIndex] : '';
  const editingTextOverlays = editingTextSlideId ? slideOverlays.get(editingTextSlideId) ?? [] : [];
  const editingTextOffsetY = editingTextSlideId ? imagePositions.get(editingTextSlideId) ?? 0.5 : 0.5;

  if (isLoading) {
    return (
      <>
        <MobileHeader title="Loading..." showBack />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Loading draft...</p>
        </main>
      </>
    );
  }

  if (error || !draft) {
    return (
      <>
        <MobileHeader title={error ? 'Error' : 'Not Found'} showBack />
        <main className="flex flex-1 items-center justify-center p-4">
          {error ? (
            <div className="w-full max-w-md rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
              <h2 className="mb-2 text-lg font-semibold text-destructive">Error</h2>
              <p className="text-sm text-destructive/90">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Retry
              </button>
            </div>
          ) : (
            <p className="text-muted-foreground">Draft not found</p>
          )}
        </main>
      </>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        minHeight: '-webkit-fill-available',
      }}
    >
      <MobileHeader title={draft.name} showBack />
      <main className="flex-1 overflow-auto">
        {draft.description && (
          <div className="border-b bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">{draft.description}</p>
          </div>
        )}

        <div className="space-y-4 p-4 pb-4">
          {slides.map((slide, index) => (
            <SlideCard
              key={slide.id}
              slide={slide}
              imageUrl={slideUrls[index] || ''}
              index={index}
              imageOffsetY={imagePositions.get(slide.id) ?? 0.5}
              hasCustomPosition={imagePositions.has(slide.id)}
              textOverlays={slideOverlays.get(slide.id) ?? []}
              hasCustomOverlays={editedSlideIds.has(slide.id)}
              onEditPosition={() => handleEditPosition(slide.id)}
              onEditText={() => handleEditText(slide.id)}
            />
          ))}
        </div>
      </main>
      <ShareButton
        preparedFiles={preparedFiles}
        isPreparing={isPreparing}
      />

      {/* Image Position Editor */}
      {editingPositionSlide && editingPositionImageUrl && (
        <ImagePositionEditor
          imageUrl={editingPositionImageUrl}
          currentOffsetY={imagePositions.get(editingPositionSlide.id) ?? 0.5}
          onSave={(offsetY) => handleSavePosition(editingPositionSlide.id, offsetY)}
          onCancel={handleCancelPositionEdit}
        />
      )}

      {/* Text Overlay Editor */}
      {editingTextSlide && editingTextImageUrl && (
        <TextOverlayEditor
          imageUrl={editingTextImageUrl}
          imageOffsetY={editingTextOffsetY}
          textOverlays={editingTextOverlays}
          onSave={(overlays) => handleSaveTextOverlays(editingTextSlide.id, overlays)}
          onCancel={handleCancelTextEdit}
        />
      )}
    </div>
  );
}
