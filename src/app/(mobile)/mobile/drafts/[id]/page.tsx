'use client';

import { use, useEffect, useState } from 'react';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { SlideCard } from '@/components/mobile/SlideCard';
import { ShareButton } from '@/components/mobile/ShareButton';
import { toast } from 'sonner';
import type { RemixSlide } from '@/types/remix';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MobileDraftDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [draft, setDraft] = useState<any>(null);
  const [slides, setSlides] = useState<RemixSlide[]>([]);
  const [slideUrls, setSlideUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      className="flex h-[100dvh] flex-col"
      style={{
        height: '100dvh',
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
            />
          ))}
        </div>
      </main>
      <ShareButton slides={slides} draftName={draft.name} />
    </div>
  );
}
