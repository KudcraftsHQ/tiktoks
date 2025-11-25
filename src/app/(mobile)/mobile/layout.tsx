import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '../../globals.css';
import { PinGate } from '@/components/mobile/PinGate';
import { Toaster } from '@/components/ui/sonner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Mobile Sharing',
  description: 'Share carousel drafts to TikTok',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          /* Mobile-optimized touch handling */
          html, body {
            touch-action: pan-x pan-y;
            -webkit-user-select: none;
            user-select: none;
          }
        `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased dark theme-mono touch-pan-x touch-pan-y min-h-screen bg-background`}
      >
        <PinGate>
          <div className="flex min-h-screen flex-col">{children}</div>
        </PinGate>
        <Toaster />
      </body>
    </html>
  );
}
