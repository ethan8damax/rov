'use client'

import { useState, useEffect, useCallback } from 'react'
import { getMerchantRules, deleteMerchantRule } from '@/lib/queries/accounts'
import { getHouseholdMemberNames, createInvite } from '@/lib/queries/households'
import { useAuth } from '@/lib/context/auth'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

export default function SettingsPage() {
  const { householdId, loading: authLoading, displayName } = useAuth()
  const [owners,    setOwners]    = useState<string[]>([])
  const [rules,     setRules]     = useState<{ id: string; merchant_name: string; category_name: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [inviting,  setInviting]  = useState(false)

  const load = useCallback(async () => {
    if (authLoading) return
    setLoading(true); setError(null)
    try {
      const [names, rls] = await Promise.all([
        getHouseholdMemberNames(),
        householdId ? getMerchantRules(householdId) : Promise.resolve([]),
      ])
      setOwners(names); setRules(rls)
    } catch (err) {
      setError(err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to load')
    } finally { setLoading(false) }
  }, [householdId, authLoading])

  useEffect(() => { load() }, [load])

  async function handleGenerateInvite() {
    if (!householdId) return
    setInviting(true)
    try {
      const token = await createInvite(householdId)
      const url = `${window.location.origin}/join?token=${token}`
      setInviteUrl(url)
    } finally { setInviting(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-[20px] font-medium mb-5" style={{ color: 'var(--color-foreground)' }}>Settings</h1>

      {error && <p className="text-[13px] mb-4" style={{ color: 'var(--color-negative)' }}>{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-4"><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      ) : (
        <>
          <p className="text-[13px] mb-8" style={{ color: 'var(--color-muted)' }}>
            Income and recurring payments now live on the Budget page.
          </p>

          {/* Merchant rules */}
          {rules.length > 0 && (
            <MerchantRulesSection rules={rules} setRules={setRules} />
          )}

          {/* Invite / partner status */}
          <section className="mb-8">
            <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Household members</h2>
            {owners.length >= 2 ? (
              <Card>
                <div className="flex flex-col gap-2">
                  {owners.map(name => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{name}</span>
                      {name === displayName && (
                        <span className="text-[11px] px-1.5 py-px rounded-md" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
                          you
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <Card>
                <p className="text-[13px] mb-4" style={{ color: 'var(--color-muted)' }}>
                  Generate a one-time link to share with your partner. The link expires in 7 days.
                </p>
                <Button onClick={handleGenerateInvite} disabled={inviting} size="sm">
                  {inviting ? 'Generating…' : 'Generate invite link'}
                </Button>
                {inviteUrl && (
                  <div className="mt-4">
                    <p className="text-[12px] mb-2" style={{ color: 'var(--color-muted)' }}>Share this link:</p>
                    <div className="flex gap-2">
                      <input
                        readOnly value={inviteUrl}
                        className="flex-1 h-8 px-3 rounded-lg text-[12px] focus:outline-none"
                        style={{ background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }}
                      />
                      <Button size="sm" variant="ghost" intent="neutral" onClick={() => navigator.clipboard.writeText(inviteUrl)}>
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  )
}

// ── Merchant rules ────────────────────────────────────────────────────────────

function MerchantRulesSection({ rules, setRules }: {
  rules: { id: string; merchant_name: string; category_name: string }[]
  setRules: React.Dispatch<React.SetStateAction<{ id: string; merchant_name: string; category_name: string }[]>>
}) {
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  return (
    <section className="mb-8">
      <h2 className="text-[14px] font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>Merchant rules</h2>
      <p className="text-[12px] mb-3" style={{ color: 'var(--color-muted)' }}>
        Auto-categorization rules saved from your transaction history. Remove a rule to stop it from applying.
      </p>
      <Card>
        {rules.map(rule => (
          <div key={rule.id} className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
            <span className="flex-1 text-[13px] truncate" title={rule.merchant_name} style={{ color: 'var(--color-foreground)' }}>{rule.merchant_name}</span>
            <span className="text-[12px]" style={{ color: 'var(--color-muted)' }}>→</span>
            <span className="text-[13px] truncate max-w-[120px]" style={{ color: 'var(--color-foreground-secondary)' }}>{rule.category_name}</span>
            {pendingDeleteId === rule.id ? (
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => { setRules(prev => prev.filter(r => r.id !== rule.id)); deleteMerchantRule(rule.id); setPendingDeleteId(null) }} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-negative-subtle)', color: 'var(--color-negative)' }}>Remove</button>
                <button type="button" onClick={() => setPendingDeleteId(null)} className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setPendingDeleteId(rule.id)} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Remove rule for ${rule.merchant_name}`} style={{ color: 'var(--color-muted)' }}>×</button>
            )}
          </div>
        ))}
      </Card>
    </section>
  )
}
