'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Client-side mobile detection and redirect
 * Redirects to /mobile interface if:
 * - Screen width <= 768px (mobile/tablet breakpoint)
 * - User agent indicates mobile device
 * - User is on the root path or other main app routes
 */
export function MobileRedirect() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Skip if already on /mobile routes
    if (pathname.startsWith('/mobile')) {
      return;
    }

    // Check screen size (mobile breakpoint: 768px)
    const isMobileScreenSize = window.innerWidth <= 768;

    // Check user agent
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileUserAgent = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent.toLowerCase()
    );

    // Redirect if either condition is true
    const shouldRedirect = isMobileScreenSize || isMobileUserAgent;

    if (shouldRedirect && pathname === '/') {
      router.replace('/mobile');
    }
  }, [pathname, router]);

  return null;
}
