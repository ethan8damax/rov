'use client'

import { useEffect, useCallback, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import Button from '@/components/ui/Button'

// Inner component: only mounts once we have a real token so the hook initializes cleanly.
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

  // Safety valve: if the Plaid SDK never signals ready (blocked by browser, network issue,
  // etc.) reset after 25s so the button doesn't stay stuck forever.
  useEffect(() => {
    if (ready) return
    const id = setTimeout(onExit, 25_000)
    return () => clearTimeout(id)
  }, [ready, onExit])

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
      setFetching(false)
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

  const busy = fetching || linkToken !== null

  return (
    <div>
      {linkToken && (
        <PlaidLinkInner token={linkToken} onConnected={handleConnected} onExit={handleExit} />
      )}
      <Button onClick={handleClick} disabled={busy} size="sm">
        {fetching ? 'Loading…' : 'Connect a bank'}
      </Button>
      {busy && !fetching && (
        <button
          onClick={handleExit}
          className="block text-[11px] mt-1 underline"
          style={{ color: 'var(--color-muted)' }}
        >
          Cancel
        </button>
      )}
      {error && (
        <p className="text-[12px] mt-1" style={{ color: 'var(--color-negative)' }}>{error}</p>
      )}
    </div>
  )
}
