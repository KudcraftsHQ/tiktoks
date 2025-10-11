'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ConnectTikTokPage() {
  const router = useRouter()
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    try {
      setIsConnecting(true)

      // Get authorization URL from API
      const response = await fetch('/api/tiktok-accounts/oauth/url', {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get authorization URL')
      }

      const data = await response.json()

      console.log('Redirecting to TikTok OAuth:', data.url)

      // Redirect to TikTok OAuth
      window.location.href = data.url
    } catch (error) {
      console.error('Connection error:', error)
      const message = error instanceof Error ? error.message : 'Failed to start connection. Please try again.'
      alert(message)
      setIsConnecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push('/tiktok-accounts')}
              variant="ghost"
              size="icon"
              className="rounded-full"
              disabled={isConnecting}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">Connect TikTok Account</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border rounded-lg p-6 sm:p-8 space-y-6">
            {/* TikTok Logo & Title */}
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-black rounded-2xl mx-auto flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="white"
                  className="w-12 h-12"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Connect Your TikTok Account</h2>
                <p className="text-muted-foreground mt-2">
                  Upload carousel content directly to your TikTok account as drafts
                </p>
              </div>
            </div>

            {/* Features List */}
            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold">What you can do:</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-3 h-3 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span>
                    Upload photo carousels (2-10 images) to your TikTok account
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-3 h-3 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span>
                    Content is uploaded as drafts to your TikTok inbox for review
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-3 h-3 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span>
                    You publish manually from TikTok app with full control over privacy and settings
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg
                      className="w-3 h-3 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <span>
                    Secure OAuth 2.0 authentication - we never see your password
                  </span>
                </li>
              </ul>
            </div>

            {/* Privacy Notice */}
            <div className="border-t pt-6">
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-2">Privacy & Security</p>
                <p>
                  Your account will be securely connected using TikTok's official OAuth system.
                  We only request permission to upload content as drafts. You maintain full
                  control over what gets published on your account.
                </p>
              </div>
            </div>

            {/* Connect Button */}
            <div className="border-t pt-6">
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                size="lg"
                className="w-full"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect TikTok Account'
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
