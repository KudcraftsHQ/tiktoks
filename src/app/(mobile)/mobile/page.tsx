'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { FolderOpen } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  _count: {
    posts: number;
    remixes: number;
  };
}

export default function MobileProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch('/api/mobile/projects?limit=100', {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error('Error fetching projects:', error);
        if (error instanceof Error && error.name === 'AbortError') {
          setError('Request timed out after 10 seconds. Please check your network connection.');
        } else {
          setError(error instanceof Error ? error.message : 'Failed to load projects');
        }
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const projectsWithDrafts = projects.filter(
    (project) => project._count.remixes > 0
  );

  if (isLoading) {
    return (
      <>
        <MobileHeader title="Projects" />
        <main className="flex-1 overflow-auto p-4">
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Loading projects...</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <MobileHeader title="Projects" />
      <main className="flex-1 overflow-auto p-4">
        {error ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
            <div className="w-full max-w-md rounded-lg border border-destructive/50 bg-destructive/10 p-6">
              <h2 className="mb-2 text-lg font-semibold text-destructive">Error Loading Projects</h2>
              <p className="text-sm text-destructive/90">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Retry
              </button>
            </div>
          </div>
        ) : projectsWithDrafts.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            <FolderOpen className="mb-4 h-16 w-16 text-muted-foreground" />
            <h2 className="mb-2 text-lg font-semibold">No Projects Found</h2>
            <p className="text-sm text-muted-foreground">
              No projects with drafts available for sharing
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projectsWithDrafts.map((project) => (
              <Link
                key={project.id}
                href={`/mobile/projects/${project.id}`}
                className="block"
              >
                <div className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent">
                  <h3 className="font-semibold">{project.name}</h3>
                  {project.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {project._count.remixes} draft
                    {project._count.remixes !== 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
