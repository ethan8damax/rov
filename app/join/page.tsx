'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { redeemInvite } from '@/lib/queries/households'
import Button from '@/components/ui/Button'

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
        const { error: signUpErr } = await supabase.auth.signUp({ email, password })
        if (signUpErr) throw signUpErr
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
        if (signInErr) throw signInErr
      }
      await redeemInvite(token, displayName || email.split('@')[0])
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <span className="text-[18px] font-medium">Rov</span>
      </div>

      <h1 className="text-[20px] font-medium mb-2">Join household</h1>
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
