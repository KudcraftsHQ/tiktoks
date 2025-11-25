'use client';

import { ReactNode } from 'react';
import { MobileHeader } from './MobileHeader';

interface MobilePageLayoutProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  children: ReactNode;
  bottomAction?: ReactNode;
  description?: string;
}

export function MobilePageLayout({
  title,
  showBack = false,
  onBack,
  children,
  bottomAction,
  description,
}: MobilePageLayoutProps) {
  return (
    <div className="flex h-[100dvh] flex-col">
      <MobileHeader title={title} showBack={showBack} onBack={onBack} />
      <main className="flex-1 overflow-auto">
        {description && (
          <div className="border-b bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        )}
        {children}
      </main>
      {bottomAction}
    </div>
  );
}
