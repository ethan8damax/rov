'use client'

import { useEffect, useCallback, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import Button from '@/components/ui/Button'

// Separate component so usePlaidLink is only called once we have a real token.
// Calling it with token='' causes silent failure and the hook won't reinitialize.
function PlaidLinkInner({
  token,
  onConnected,
  onExit,
}: {
  token: string
  onConnected: () => void
  onExit: () => void
}) {
  const onSuccess = useCallback(async (
    publicToken: string,
    metadata: { institution: { institution_id: string; name: string } | null },
  ) => {
    if (!metadata.institution) { onExit(); return }
    try {
      const res = await fetch('/api/plaid/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token: publicToken, institution: metadata.institution }),
      })
      if (!res.ok) throw new Error('Failed to connect bank')
      onConnected()
    } catch {
      onExit()
    }
  }, [onConnected, onExit])

  const { open, ready } = usePlaidLink({ token, onSuccess, onExit })

  useEffect(() => {
    if (ready) open()
  }, [ready, open])

  return null
}

export default function PlaidLinkButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [fetching,  setFetching]  = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleClick() {
    setFetching(true)
    setError(null)
    try {
      const res  = await fetch('/api/plaid/link-token', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.link_token) throw new Error(data.error ?? 'Failed to get link token')
      setLinkToken(data.link_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bank connection')
      setFetching(false)
    }
  }

  function handleExit() {
    setLinkToken(null)
    setFetching(false)
  }

  function handleConnected() {
    setLinkToken(null)
    setFetching(false)
    onConnected()
  }

  return (
    <div>
      {linkToken && (
        <PlaidLinkInner token={linkToken} onConnected={handleConnected} onExit={handleExit} />
      )}
      <Button onClick={handleClick} disabled={fetching} size="sm">
        {fetching ? 'Loading…' : 'Connect a bank'}
      </Button>
      {error && (
        <p className="text-[12px] mt-1" style={{ color: 'var(--color-negative)' }}>{error}</p>
      )}
    </div>
  )
}
