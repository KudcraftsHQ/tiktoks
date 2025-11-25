import { NextRequest, NextResponse } from 'next/server';
import { validateToken } from '@/lib/mobile-auth';

/**
 * POST /api/mobile/auth/validate
 * Validates if a token is still valid
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { valid: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Check if token is valid
    const isValid = validateToken(token);

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
