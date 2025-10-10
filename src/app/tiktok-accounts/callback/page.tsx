'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

function TikTokCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code from URL
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        // Check for errors from TikTok
        if (errorParam) {
          setStatus('error')
          setError(errorDescription || `Authorization failed: ${errorParam}`)
          return
        }

        if (!code) {
          setStatus('error')
          setError('No authorization code received')
          return
        }

        // Exchange code for token and save account
        const response = await fetch('/api/tiktok-accounts/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to connect account')
        }

        setStatus('success')

        // Redirect to accounts page after 2 seconds
        setTimeout(() => {
          router.push('/tiktok-accounts')
        }, 2000)
      } catch (err) {
        console.error('Callback error:', err)
        setStatus('error')
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
      }
    }

    handleCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Connecting your TikTok account...</h1>
            <p className="text-muted-foreground">
              Please wait while we complete the authorization process.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-green-500">Successfully Connected!</h1>
            <p className="text-muted-foreground">
              Your TikTok account has been connected successfully.
              Redirecting you to your accounts...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-destructive">Connection Failed</h1>
            <p className="text-muted-foreground">{error}</p>
            <div className="flex gap-4 justify-center pt-4">
              <Button
                onClick={() => router.push('/tiktok-accounts/connect')}
                variant="default"
              >
                Try Again
              </Button>
              <Button
                onClick={() => router.push('/tiktok-accounts')}
                variant="outline"
              >
                Go to Accounts
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function TikTokCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold">Loading...</h1>
          </div>
        </div>
      }
    >
      <TikTokCallbackContent />
    </Suspense>
  )
}
