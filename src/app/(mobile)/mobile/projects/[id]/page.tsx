'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { FileText } from 'lucide-react';

interface Draft {
  id: string;
  name: string;
  description: string | null;
  slides: any;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  remixes: Draft[];
}

export default function MobileProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProject() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`/api/mobile/projects/${id}`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setProject(data);
      } catch (error) {
        console.error('Error fetching project:', error);
        if (error instanceof Error && error.name === 'AbortError') {
          setError('Request timed out. Please check your network connection.');
        } else {
          setError(error instanceof Error ? error.message : 'Failed to load project');
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchProject();
  }, [id]);

  if (isLoading) {
    return (
      <>
        <MobileHeader title="Loading..." showBack />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="text-sm text-muted-foreground">Loading project...</p>
          </div>
        </main>
      </>
    );
  }

  if (error || !project) {
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
            <p className="text-muted-foreground">Project not found</p>
          )}
        </main>
      </>
    );
  }

  const drafts = project.remixes || [];

  return (
    <>
      <MobileHeader title={project.name} showBack />
      <main className="flex-1 overflow-auto p-4">
        {project.description && (
          <p className="mb-4 text-sm text-muted-foreground">
            {project.description}
          </p>
        )}

        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
          Drafts ({drafts.length})
        </h2>

        {drafts.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No drafts found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map((draft) => {
              const slides = typeof draft.slides === 'string'
                ? JSON.parse(draft.slides)
                : draft.slides;
              const slideCount = slides?.length || 0;

              return (
                <Link
                  key={draft.id}
                  href={`/mobile/drafts/${draft.id}`}
                  className="block"
                >
                  <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <h3 className="font-semibold">{draft.name}</h3>
                        {draft.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {draft.description}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                          {slideCount} slide{slideCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
