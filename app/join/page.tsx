'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { redeemInviteAction } from '@/app/actions/invites'
import Button from '@/components/ui/Button'
import RovWordmark from '@/components/brand/RovWordmark'
import BrandLore from '@/components/brand/BrandLore'

const inputCls = 'w-full h-10 px-3 rounded-lg focus:outline-none transition-colors'
const inputStyle = {
  fontSize: '16px',
  background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)',
  color: 'var(--color-foreground)',
}

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(!token ? 'Invalid invite link — no token found.' : null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    setLoading(true)
    const supabase = createClient()

    try {
      if (mode === 'signup') {
        const { data, error: signUpErr } = await supabase.auth.signUp({ email, password })
        if (signUpErr) throw signUpErr
        if (!data.session) {
          // No session until the confirmation link is clicked — the name typed here
          // would otherwise be lost, since the "Sign in" tab doesn't ask for it again.
          if (displayName) localStorage.setItem('rov-pending-join-name', displayName)
          setError('Check your inbox and click the confirmation link, then come back here and sign in.')
          setLoading(false)
          return
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) throw signInErr
      }
      const pendingName = localStorage.getItem('rov-pending-join-name')
      const result = await redeemInviteAction(token, displayName || pendingName || email.split('@')[0])
      if (result.error) {
        if (result.error === 'not_authenticated') {
          setError('Sign in first, then come back to this link to join.')
        } else {
          setError(result.error)
        }
        setLoading(false)
        return
      }
      localStorage.removeItem('rov-pending-join-name')
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <RovWordmark />

      <h1 className="font-serif text-[24px] mb-2">Join household</h1>
      <p className="text-[13px] mb-6" style={{ color: 'var(--color-muted)' }}>
        {mode === 'signup' ? "You've been invited. Create an account to join." : "You've been invited. Sign in to join."}
      </p>

      {/* Mode toggle */}
      <div className="flex gap-4 mb-5">
        <button
          onClick={() => setMode('signup')}
          className="text-[13px] pb-1 transition-colors"
          style={{
            color: mode === 'signup' ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: mode === 'signup' ? '1px solid var(--color-primary)' : 'none',
          }}
        >
          Create account
        </button>
        <button
          onClick={() => setMode('login')}
          className="text-[13px] pb-1 transition-colors"
          style={{
            color: mode === 'login' ? 'var(--color-primary)' : 'var(--color-muted)',
            borderBottom: mode === 'login' ? '1px solid var(--color-primary)' : 'none',
          }}
        >
          Sign in
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === 'signup' && (
          <input
            type="text"
            placeholder="Your name"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className={inputCls}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className={inputCls}
          style={inputStyle}
        />
        {error && <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>}
        <Button type="submit" disabled={loading || !token} className="w-full h-10 mt-1">
          {loading ? 'Joining…' : 'Join household'}
        </Button>
      </form>

      <BrandLore />
    </div>
  )
}

export default function JoinPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-[13px]" style={{ color: 'var(--color-muted)' }}>Loading…</div>}>
        <JoinForm />
      </Suspense>
    </div>
  )
}
