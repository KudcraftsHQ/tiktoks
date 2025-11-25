import { NextRequest, NextResponse } from 'next/server';
import { generateAuthToken, validatePin } from '@/lib/mobile-auth';

/**
 * POST /api/mobile/auth
 * Validates PIN and returns auth token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      );
    }

    // Validate PIN
    if (!validatePin(pin)) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      );
    }

    // Generate token
    const authToken = generateAuthToken(pin);

    return NextResponse.json(authToken);
  } catch (error) {
    console.error('Mobile auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
