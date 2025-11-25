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

  useEffect(() => {
    async function fetchDraft() {
      try {
        const response = await fetch(`/api/remixes/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch draft');
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

  if (!draft) {
    return (
      <>
        <MobileHeader title="Not Found" showBack />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Draft not found</p>
        </main>
      </>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col">
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
