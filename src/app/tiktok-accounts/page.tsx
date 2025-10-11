'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface TikTokAccount {
  id: string
  openId: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED'
  connectedAt: string
  lastUsedAt: string | null
  tokenExpiresAt: string
  isExpired: boolean
}

export default function TikTokAccountsPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<TikTokAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/tiktok-accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.accounts)
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (accountId: string) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tiktok-accounts/${accountId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setAccounts(accounts.filter((acc) => acc.id !== accountId))
        setDeleteAccountId(null)
      } else {
        alert('Failed to remove account')
      }
    } catch (error) {
      console.error('Failed to delete account:', error)
      alert('Failed to remove account')
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">TikTok Accounts</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your connected TikTok upload destinations
              </p>
            </div>
            <Button onClick={() => router.push('/tiktok-accounts/connect')}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Connect Account</span>
              <span className="sm:hidden">Connect</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-muted rounded-2xl mx-auto flex items-center justify-center mb-4">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-10 h-10 text-muted-foreground"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2">No Connected Accounts</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Connect your TikTok account to start uploading carousel content as drafts.
            </p>
            <Button onClick={() => router.push('/tiktok-accounts/connect')}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Your First Account
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 max-w-4xl mx-auto">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-card border rounded-lg p-4 sm:p-6 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                      {account.avatarUrl ? (
                        <img
                          src={account.avatarUrl}
                          alt={account.displayName || 'TikTok User'}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="white"
                          className="w-7 h-7 sm:w-8 sm:h-8"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                        </svg>
                      )}
                    </div>

                    {/* Account Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">
                          {account.displayName || account.username || `TikTok User (${account.openId.substring(0, 8)}...)`}
                        </h3>
                        {account.isExpired || account.status === 'EXPIRED' ? (
                          <span className="flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full flex-shrink-0">
                            <XCircle className="h-3 w-3" />
                            Expired
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-600/10 px-2 py-0.5 rounded-full flex-shrink-0">
                            <CheckCircle className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        {account.username && (
                          <p className="font-medium">@{account.username}</p>
                        )}
                        <p>Connected: {formatDate(account.connectedAt)}</p>
                        {account.lastUsedAt && (
                          <p>Last used: {formatDate(account.lastUsedAt)}</p>
                        )}
                        {account.isExpired && (
                          <p className="text-destructive text-xs">
                            Token expired - please reconnect this account
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteAccountId(account.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteAccountId}
        onOpenChange={(open) => !open && setDeleteAccountId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove TikTok Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will disconnect your TikTok account. You'll need to reconnect it to
              upload content again. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAccountId && handleDelete(deleteAccountId)}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove Account'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
