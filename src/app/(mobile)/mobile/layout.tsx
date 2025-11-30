import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Poppins } from 'next/font/google';
import '../../globals.css';
import { Toaster } from '@/components/ui/sonner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mobile Sharing',
  description: 'Share carousel drafts to TikTok',
  icons: {
    icon: '/icon.png',
  },
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

          /* Text overlay styles - outline only, pill is rendered differently */
          .text-overlay-outline {
            font-family: var(--font-poppins), Poppins, sans-serif;
            font-weight: 700;
            color: #ffffff;
            line-height: 1.6;
            text-shadow:
              -2px -2px 0 #000,
              2px -2px 0 #000,
              -2px 2px 0 #000,
              2px 2px 0 #000,
              -2px 0 0 #000,
              2px 0 0 #000,
              0 -2px 0 #000,
              0 2px 0 #000;
          }
        `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} antialiased dark theme-mono touch-pan-x touch-pan-y min-h-screen bg-background`}
      >
        <div className="flex min-h-screen flex-col">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
