import { createHash } from 'crypto';

/**
 * Mobile PIN authentication utilities
 * Uses PIN + secret to generate tokens that can be invalidated server-side
 */

export interface MobileAuthToken {
  token: string;
  expiresAt: string;
}

/**
 * Generate a secure token from PIN and secret
 * Changing MOBILE_PIN_SECRET invalidates all existing tokens
 */
export function generateAuthToken(pin: string): MobileAuthToken {
  const secret = process.env.MOBILE_PIN_SECRET;
  if (!secret) {
    throw new Error('MOBILE_PIN_SECRET environment variable is not set');
  }

  const token = createHash('sha256')
    .update(`${pin}:${secret}`)
    .digest('hex');

  // Token expires in 30 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Validate if the provided PIN is correct
 */
export function validatePin(pin: string): boolean {
  const correctPin = process.env.MOBILE_PIN_CODE;
  if (!correctPin) {
    throw new Error('MOBILE_PIN_CODE environment variable is not set');
  }

  return pin === correctPin;
}

/**
 * Validate if the provided token is valid
 * Returns true if token matches the current PIN + secret combination
 */
export function validateToken(token: string): boolean {
  const correctPin = process.env.MOBILE_PIN_CODE;
  if (!correctPin) {
    throw new Error('MOBILE_PIN_CODE environment variable is not set');
  }

  const expectedToken = generateAuthToken(correctPin).token;
  return token === expectedToken;
}

/**
 * Client-side storage key for auth token
 */
export const MOBILE_AUTH_STORAGE_KEY = 'mobile_auth_token';
export const MOBILE_AUTH_EXPIRES_KEY = 'mobile_auth_expires';
