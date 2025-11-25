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

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch('/api/projects?limit=100');
        if (!response.ok) throw new Error('Failed to fetch projects');
        const data = await response.json();
        setProjects(data.projects || []);
      } catch (error) {
        console.error('Error fetching projects:', error);
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
        {projectsWithDrafts.length === 0 ? (
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
