'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { createHousehold } from '@/lib/queries/households'
import Button from '@/components/ui/Button'
import RovWordmark from '@/components/brand/RovWordmark'
import BrandLore from '@/components/brand/BrandLore'

const inputStyle = {
  background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)',
  color: 'var(--color-foreground)',
  fontSize: '16px',
}

export default function SignupPage() {
  const router = useRouter()
  const [displayName,   setDisplayName]   = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [error,         setError]         = useState<string | null>(null)
  const [loading,       setLoading]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error: signUpErr } = await supabase.auth.signUp({ email, password })
    if (signUpErr) {
      setError(signUpErr.message)
      setLoading(false)
      return
    }
    try {
      await createHousehold(
        householdName || `${displayName}'s Household`,
        displayName,
      )
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create household')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <RovWordmark />

        <h1 className="font-serif text-[24px] mb-2">Create account</h1>
        <p className="text-[13px] mb-6" style={{ color: 'var(--color-muted)' }}>
          You&apos;re setting up the household. Your partner joins via invite.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Your name (e.g. Ethan)"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-lg focus:outline-none transition-colors"
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Household name (e.g. The Levines)"
            value={householdName}
            onChange={e => setHouseholdName(e.target.value)}
            className="w-full h-10 px-3 rounded-lg focus:outline-none transition-colors"
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-lg focus:outline-none transition-colors"
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-lg focus:outline-none transition-colors"
            style={inputStyle}
          />
          {error && (
            <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full h-10 mt-1">
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-[13px] mt-4 text-center" style={{ color: 'var(--color-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--color-primary)' }}>Sign in</Link>
        </p>

        <BrandLore />
      </div>
    </div>
  )
}
