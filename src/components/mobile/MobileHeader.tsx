'use client';

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function MobileHeader({ title, showBack = false, onBack }: MobileHeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
      {showBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <h1 className="truncate text-lg font-semibold">{title}</h1>
    </header>
  );
}
