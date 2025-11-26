'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { SlideCard } from '@/components/mobile/SlideCard';
import { ShareButton } from '@/components/mobile/ShareButton';
import { ImagePositionEditor } from '@/components/mobile/ImagePositionEditor';
import { toast } from 'sonner';
import type { RemixSlide } from '@/types/remix';

export default function MobileDraftDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [draft, setDraft] = useState<any>(null);
  const [slides, setSlides] = useState<RemixSlide[]>([]);
  const [slideUrls, setSlideUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imagePositions, setImagePositions] = useState<Map<string, number>>(new Map());
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);

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

  const handleEditPosition = (slideId: string) => {
    setEditingSlideId(slideId);
  };

  const handleSavePosition = (slideId: string, offsetY: number) => {
    setImagePositions(prev => new Map(prev).set(slideId, offsetY));
    setEditingSlideId(null);
    toast.success('Position saved');
  };

  const handleCancelEdit = () => {
    setEditingSlideId(null);
  };

  const editingSlide = slides.find(s => s.id === editingSlideId);
  const editingSlideIndex = slides.findIndex(s => s.id === editingSlideId);
  const editingImageUrl = editingSlideIndex >= 0 ? slideUrls[editingSlideIndex] : '';

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
              hasCustomPosition={imagePositions.has(slide.id)}
              onEditPosition={() => handleEditPosition(slide.id)}
            />
          ))}
        </div>
      </main>
      <ShareButton
        slides={slides}
        draftName={draft.name}
        imagePositions={imagePositions}
      />

      {/* Image Position Editor */}
      {editingSlide && editingImageUrl && (
        <ImagePositionEditor
          imageUrl={editingImageUrl}
          currentOffsetY={imagePositions.get(editingSlide.id) ?? 0.5}
          onSave={(offsetY) => handleSavePosition(editingSlide.id, offsetY)}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}
