'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import RovWordmark from '@/components/brand/RovWordmark'
import BrandLore from '@/components/brand/BrandLore'

const inputStyle = {
  background: 'var(--color-surface)',
  border: '0.5px solid var(--color-border)',
  color: 'var(--color-foreground)',
}

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <RovWordmark />

        <h1 className="font-serif text-[24px] mb-6">Sign in</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-lg focus:outline-none transition-colors"
            style={{ ...inputStyle, fontSize: '16px' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full h-10 px-3 rounded-lg focus:outline-none transition-colors"
            style={{ ...inputStyle, fontSize: '16px' }}
          />
          {error && (
            <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full h-10 mt-1">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="text-[13px] mt-4 text-center" style={{ color: 'var(--color-muted)' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--color-primary)' }}>
            Create one
          </Link>
        </p>

        <BrandLore />
      </div>
    </div>
  )
}
