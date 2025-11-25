'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import {
  MOBILE_AUTH_STORAGE_KEY,
  MOBILE_AUTH_EXPIRES_KEY,
} from '@/lib/mobile-auth';

interface PinGateProps {
  children: React.ReactNode;
}

export function PinGate({ children }: PinGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateStoredToken = useCallback(async () => {
    const token = localStorage.getItem(MOBILE_AUTH_STORAGE_KEY);
    const expiresAt = localStorage.getItem(MOBILE_AUTH_EXPIRES_KEY);

    if (!token || !expiresAt) {
      setIsValidating(false);
      return;
    }

    // Check if token is expired
    if (new Date(expiresAt) < new Date()) {
      localStorage.removeItem(MOBILE_AUTH_STORAGE_KEY);
      localStorage.removeItem(MOBILE_AUTH_EXPIRES_KEY);
      setIsValidating(false);
      return;
    }

    // Validate token with server
    try {
      const response = await fetch('/api/mobile/auth/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (data.valid) {
        setIsAuthenticated(true);
      } else {
        // Token invalid (secret changed), clear storage
        localStorage.removeItem(MOBILE_AUTH_STORAGE_KEY);
        localStorage.removeItem(MOBILE_AUTH_EXPIRES_KEY);
      }
    } catch (error) {
      console.error('Token validation error:', error);
    } finally {
      setIsValidating(false);
    }
  }, []);

  useEffect(() => {
    validateStoredToken();
  }, [validateStoredToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length !== 6) {
      toast.error('PIN must be 6 digits');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/mobile/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Invalid PIN');
        setPin('');
        return;
      }

      // Store token
      localStorage.setItem(MOBILE_AUTH_STORAGE_KEY, data.token);
      localStorage.setItem(MOBILE_AUTH_EXPIRES_KEY, data.expiresAt);

      setIsAuthenticated(true);
      toast.success('Authenticated successfully');
    } catch (error) {
      console.error('Auth error:', error);
      toast.error('Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <LockKeyhole className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Validating...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-start overflow-auto p-4 pt-16">
        <div className="w-full max-w-sm space-y-6 text-center">
          <LockKeyhole className="mx-auto h-16 w-16 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Enter PIN Code</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your 6-digit PIN to access mobile sharing
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest"
              disabled={isSubmitting}
              autoFocus
              autoComplete="off"
            />
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || pin.length !== 6}
            >
              {isSubmitting ? 'Validating...' : 'Submit'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
