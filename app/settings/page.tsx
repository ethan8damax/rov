'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getIncomeSources, createIncomeSource, updateIncomeSource, deleteIncomeSource,
  getRecurringPayments, createRecurringPayment, deleteRecurringPayment,
} from '@/lib/queries/finance'
import { getHouseholdMemberNames, createInvite } from '@/lib/queries/households'
import { useAuth } from '@/lib/context/auth'
import { currentMonth, shiftMonth, formatMonthLabel, fmtWhole } from '@/lib/utils'
import type { IncomeSource, RecurringPayment } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

const inputCls = 'h-8 px-3 rounded-lg focus:outline-none transition-colors'
const inputStyle = { fontSize: '16px', background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }
const numCls = 'w-[88px] h-7 px-2 rounded-md tabular-nums text-right focus:outline-none transition-colors'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

export default function SettingsPage() {
  const { householdId, loading: authLoading } = useAuth()
  const [month,      setMonth]      = useState(() => currentMonth())
  const [incomes,    setIncomes]    = useState<IncomeSource[]>([])
  const [recurrings, setRecurrings] = useState<RecurringPayment[]>([])
  const [owners,     setOwners]     = useState<string[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [inviteUrl,  setInviteUrl]  = useState<string | null>(null)
  const [inviting,   setInviting]   = useState(false)

  const load = useCallback(async () => {
    if (authLoading) return
    setLoading(true); setError(null)
    try {
      const [inc, rec, names] = await Promise.all([
        getIncomeSources(month),
        getRecurringPayments(),
        getHouseholdMemberNames(),
      ])
      setIncomes(inc); setRecurrings(rec); setOwners(names)
    } catch (err) {
      setError(err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to load')
    } finally { setLoading(false) }
  }, [month, authLoading])

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
          {/* Income sources */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-[14px] font-medium flex-1" style={{ color: 'var(--color-foreground)' }}>Income sources</h2>
              <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(shiftMonth(month, -1))}>←</Button>
              <span className="text-[12px] min-w-[120px] text-center" style={{ color: 'var(--color-foreground-secondary)' }}>{formatMonthLabel(month)}</span>
              <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(shiftMonth(month, 1))}>→</Button>
            </div>
            <IncomeSection month={month} incomes={incomes} setIncomes={setIncomes} owners={owners} />
          </section>

          {/* Recurring payments */}
          <section className="mb-8">
            <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Recurring payments</h2>
            <RecurringSection recurrings={recurrings} setRecurrings={setRecurrings} />
          </section>

          {/* Invite */}
          <section className="mb-8">
            <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Invite your partner</h2>
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
          </section>
        </>
      )}
    </div>
  )
}

// ── Income section ────────────────────────────────────────────────────────────

function IncomeSection({ month, incomes, setIncomes, owners }: {
  month: string
  incomes: IncomeSource[]
  setIncomes: React.Dispatch<React.SetStateAction<IncomeSource[]>>
  owners: string[]
}) {
  const [newOwner, setNewOwner] = useState('')
  const [newName,  setNewName]  = useState('')
  const [adding,   setAdding]   = useState(false)

  useEffect(() => { if (owners.length > 0 && !newOwner) setNewOwner(owners[0]) }, [owners, newOwner])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    try {
      const created = await createIncomeSource({ owner: newOwner, name: newName.trim(), month, expected: 0, actual: 0 })
      setIncomes(prev => [...prev, created])
      setNewName('')
    } finally { setAdding(false) }
  }

  async function handleUpdate(id: string, field: 'expected' | 'actual', raw: string) {
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) return
    const updated = await updateIncomeSource(id, { [field]: val })
    setIncomes(prev => prev.map(i => i.id === id ? updated : i))
  }

  const total = incomes.reduce((s, i) => s + i.expected, 0)

  return (
    <Card>
      <div className="flex items-center gap-2 pb-2 mb-1" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
        <span className="flex-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>Source</span>
        <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Expected</span>
        <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Actual</span>
        <span className="w-5" />
      </div>
      {incomes.length === 0 ? (
        <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No income sources for this month yet — add one below.</p>
      ) : (
        <>
          {incomes.map(inc => (
            <IncomeRow
              key={inc.id} source={inc}
              onUpdate={handleUpdate}
              onDelete={async (id) => { setIncomes(prev => prev.filter(i => i.id !== id)); await deleteIncomeSource(id) }}
            />
          ))}
          <div className="flex items-center gap-2 pt-2 mt-1" style={{ borderTop: '0.5px solid var(--color-border)' }}>
            <span className="flex-1 text-[12px] font-medium" style={{ color: 'var(--color-foreground)' }}>Total expected</span>
            <span className="w-[88px] text-[12px] font-medium tabular-nums text-right" style={{ color: 'var(--color-foreground)' }}>{fmtWhole(total)}</span>
            <span className="w-[88px]" /><span className="w-5" />
          </div>
        </>
      )}
      <form onSubmit={handleAdd} className="flex gap-2 mt-4 pt-3 flex-wrap" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        {owners.length > 0 && (
          <select value={newOwner} onChange={e => setNewOwner(e.target.value)} className={`w-[96px] ${inputCls}`} style={inputStyle}>
            {owners.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Source name" className={`flex-1 min-w-0 ${inputCls}`} style={inputStyle} />
        <Button type="submit" size="sm" disabled={!newName.trim() || adding}>Add</Button>
      </form>
    </Card>
  )
}

function IncomeRow({ source, onUpdate, onDelete }: {
  source: IncomeSource
  onUpdate: (id: string, f: 'expected' | 'actual', v: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [exp, setExp] = useState(String(source.expected))
  const [act, setAct] = useState(String(source.actual))
  const [savedField, setSavedField] = useState<'expected' | 'actual' | null>(null)

  useEffect(() => { setExp(String(source.expected)) }, [source.expected])
  useEffect(() => { setAct(String(source.actual))   }, [source.actual])

  async function handleSave(field: 'expected' | 'actual', raw: string) {
    await onUpdate(source.id, field, raw)
    setSavedField(field)
    setTimeout(() => setSavedField(null), 1200)
  }

  function fieldStyle(field: 'expected' | 'actual') {
    return {
      fontSize: '16px',
      background: 'var(--color-background)',
      border: `0.5px solid ${savedField === field ? 'var(--color-positive)' : 'var(--color-border)'}`,
      color: 'var(--color-foreground)',
      transition: 'border-color 0.4s ease',
    }
  }

  return (
    <div className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="flex-1 min-w-0">
        <span className="text-[13px]" style={{ color: 'var(--color-foreground)' }}>{source.name}</span>
        <span className="ml-2 text-[11px]" style={{ color: 'var(--color-muted)' }}>{source.owner}</span>
      </div>
      <input type="number" min="0" step="0.01" value={exp} onChange={e => setExp(e.target.value)} onBlur={e => handleSave('expected', e.target.value)} className={numCls} style={fieldStyle('expected')} />
      <input type="number" min="0" step="0.01" value={act} onChange={e => setAct(e.target.value)} onBlur={e => handleSave('actual',   e.target.value)} className={numCls} style={fieldStyle('actual')} />
      <button type="button" onClick={() => { if (window.confirm(`Delete "${source.name}"?`)) onDelete(source.id) }} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Delete ${source.name}`} style={{ color: 'var(--color-muted)' }}>×</button>
    </div>
  )
}

// ── Recurring section ─────────────────────────────────────────────────────────

function RecurringSection({ recurrings, setRecurrings }: {
  recurrings: RecurringPayment[]
  setRecurrings: React.Dispatch<React.SetStateAction<RecurringPayment[]>>
}) {
  const [newName,   setNewName]   = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [adding,    setAdding]    = useState(false)
  const total = recurrings.reduce((s, r) => s + r.amount, 0)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(newAmount)
    if (!newName.trim() || !(amount > 0)) return
    setAdding(true)
    try {
      const created = await createRecurringPayment({ name: newName.trim(), amount })
      setRecurrings(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName(''); setNewAmount('')
    } finally { setAdding(false) }
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Monthly bills</span>
        {total > 0 && <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--color-foreground-secondary)' }}>{fmtWhole(total)}/mo</span>}
      </div>
      {recurrings.length === 0 ? (
        <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No recurring payments yet — add bills you pay every month.</p>
      ) : recurrings.map(r => (
        <div key={r.id} className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          <span className="flex-1 text-[13px]" style={{ color: 'var(--color-foreground)' }}>{r.name}</span>
          <span className="text-[13px] tabular-nums" style={{ color: 'var(--color-foreground-secondary)' }}>{fmtWhole(r.amount)}</span>
          <button
            type="button"
            onClick={() => { if (!window.confirm(`Delete "${r.name}"?`)) return; setRecurrings(prev => prev.filter(x => x.id !== r.id)); deleteRecurringPayment(r.id) }}
            className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Delete ${r.name}`}
            style={{ color: 'var(--color-muted)' }}
          >×</button>
        </div>
      ))}
      <form onSubmit={handleAdd} className="flex gap-2 mt-4 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. Spotify)" className={`flex-1 min-w-0 ${inputCls}`} style={inputStyle} />
        <input type="number" min="0.01" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Amount" className={`w-[96px] ${inputCls}`} style={inputStyle} />
        <Button type="submit" size="sm" disabled={!newName.trim() || !(parseFloat(newAmount) > 0) || adding}>Add</Button>
      </form>
    </Card>
  )
}
