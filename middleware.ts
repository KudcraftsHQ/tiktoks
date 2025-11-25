import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for mobile route handling
 * - Mobile detection happens client-side (see app/layout.tsx)
 * - PIN authentication handled client-side by PinGate component
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all /mobile/* routes to pass through
  if (pathname.startsWith('/mobile')) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
