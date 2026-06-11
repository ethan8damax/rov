'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import Button from '@/components/ui/Button'

interface PlaidLinkButtonProps {
  onConnected: () => void
}

export default function PlaidLinkButton({ onConnected }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [fetching,  setFetching]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const onSuccess = useCallback(async (publicToken: string, metadata: { institution: { institution_id: string; name: string } | null }) => {
    if (!metadata.institution) return
    try {
      const res = await fetch('/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: publicToken,
          institution:  metadata.institution,
        }),
      })
      if (!res.ok) throw new Error('Failed to connect bank')
      onConnected()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [onConnected])

  const { open, ready } = usePlaidLink({
    token:  linkToken ?? '',
    onSuccess,
    onExit: useCallback(() => setLinkToken(null), []),
  })

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  async function handleClick() {
    setFetching(true)
    setError(null)
    try {
      const res  = await fetch('/api/plaid/link-token', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.link_token) throw new Error(data.error ?? 'Failed to get link token')
      setLinkToken(data.link_token)
      setFetching(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bank connection')
      setFetching(false)
    }
  }

  return (
    <div>
      <Button onClick={handleClick} disabled={fetching} size="sm">
        {fetching ? 'Loading…' : 'Connect a bank'}
      </Button>
      {error && (
        <p className="text-[12px] mt-1" style={{ color: 'var(--color-negative)' }}>{error}</p>
      )}
    </div>
  )
}
