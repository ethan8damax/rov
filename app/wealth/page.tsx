'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/context/auth'
import {
  getSavingsPods, createSavingsPod, updateSavingsPod, deleteSavingsPod,
  getAssets, createAsset, updateAsset, deleteAsset,
  getDebts, createDebt, updateDebt, deleteDebt,
  getNetWorthSnapshots, createNetWorthSnapshot, deleteNetWorthSnapshot,
  syncPlaidBalances,
} from '@/lib/queries/wealth'
import { getSavingsPodAccounts, setSavingsPodAccount } from '@/lib/queries/accounts'
import { currentMonth, fmtWhole, sanitizeError } from '@/lib/utils'
import type { SavingsPod, Asset, Debt, NetWorthSnapshot, AssetUpdate, DebtUpdate, SavingsPodUpdate } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import ProgressBar from '@/components/ui/ProgressBar'
import MetricCard from '@/components/ui/MetricCard'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

function InlineDelete({ onDelete, label }: { onDelete: () => void; label: string }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onDelete} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-negative-subtle)', color: 'var(--color-negative)' }}>Delete</button>
      <button type="button" onClick={() => setConfirming(false)} className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Cancel</button>
    </div>
  )
  return (
    <button type="button" onClick={() => setConfirming(true)} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Delete ${label}`} style={{ color: 'var(--color-muted)' }}>×</button>
  )
}

function SnapshotDeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onDelete} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-negative-subtle)', color: 'var(--color-negative)' }}>Delete</button>
      <button type="button" onClick={() => setConfirming(false)} className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Cancel</button>
    </div>
  )
  return (
    <button onClick={() => setConfirming(true)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[12px]" aria-label={`Delete ${label} snapshot`} style={{ color: 'var(--color-muted)' }}>×</button>
  )
}

const inputCls = 'h-8 px-3 rounded-lg focus:outline-none transition-colors'
const inputStyle = { fontSize: '16px', background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }
const numCls = 'w-[88px] h-7 px-2 rounded-md tabular-nums text-right focus:outline-none transition-colors'

// ── Net worth sparkline ───────────────────────────────────────────────────────

function NetWorthChart({ snapshots }: { snapshots: NetWorthSnapshot[] }) {
  if (snapshots.length < 2) return (
    <p className="text-[12px] py-2" style={{ color: 'var(--color-muted)' }}>
      Take two monthly snapshots to start seeing your net worth trend.
    </p>
  )
  const values = snapshots.map(s => s.net_worth)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const W = 500, H = 64
  const pts = snapshots.map((s, i) => {
    const x = (i / (snapshots.length - 1)) * W
    const y = H - ((s.net_worth - min) / range) * (H - 8) - 4
    return `${x},${y}`
  }).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
        <polyline points={pts} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {snapshots.map((s, i) => {
          const x = (i / (snapshots.length - 1)) * W
          const y = H - ((s.net_worth - min) / range) * (H - 8) - 4
          return <circle key={s.id} cx={x} cy={y} r={3} fill="var(--color-primary)" />
        })}
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{snapshots[0].month}</span>
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{snapshots[snapshots.length - 1].month}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WealthPage() {
  const { loading: authLoading, householdId } = useAuth()
  const [pods,       setPods]      = useState<SavingsPod[]>([])
  const [assets,     setAssets]    = useState<Asset[]>([])
  const [debts,      setDebts]     = useState<Debt[]>([])
  const [snapshots,  setSnapshots] = useState<NetWorthSnapshot[]>([])
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState<string | null>(null)
  const [savingSnap,         setSavingSnap]         = useState(false)
  const [confirmReplaceSnap, setConfirmReplaceSnap] = useState(false)
  const [syncing,            setSyncing]            = useState(false)
  const [syncMsg,            setSyncMsg]            = useState<string | null>(null)

  const [podAccounts, setPodAccounts] = useState<PodAccount[]>([])

  const load = useCallback(async () => {
    if (authLoading) return
    setLoading(true); setError(null)
    try {
      const podFetch = householdId ? getSavingsPodAccounts(householdId) : Promise.resolve([])
      const [p, a, d, s, pods] = await Promise.all([getSavingsPods(), getAssets(), getDebts(), getNetWorthSnapshots(), podFetch])
      setPods(p); setAssets(a); setDebts(d); setSnapshots(s); setPodAccounts(pods)
    } catch (err) {
      setError(sanitizeError(err))
    } finally { setLoading(false) }
  }, [authLoading, householdId])

  useEffect(() => { load() }, [load])

  const totalAssets   = useMemo(() => assets.reduce((s, a) => s + a.balance, 0), [assets])
  const totalDebt     = useMemo(() => debts.reduce((s, d) => s + d.amount_owed, 0), [debts])
  const netWorth      = totalAssets - totalDebt
  const totalAllotted = useMemo(() => pods.reduce((s, p) => s + p.allotted, 0), [pods])
  const totalPodGoal  = useMemo(() => pods.reduce((s, p) => s + p.goal, 0), [pods])
  const podAccountIds = useMemo(
    () => new Set(podAccounts.filter(a => a.is_savings_pod).map(a => a.account_id)),
    [podAccounts]
  )
  const savingsBalance = useMemo(() =>
    podAccountIds.size > 0
      ? assets.filter(a => a.plaid_account_id != null && podAccountIds.has(a.plaid_account_id)).reduce((s, a) => s + a.balance, 0)
      : assets.filter(a => a.type === 'savings').reduce((s, a) => s + a.balance, 0),
    [assets, podAccountIds]
  )

  async function handleBalanceSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/plaid/accounts')
      const data = await res.json()
      const accounts = data.accounts ?? []
      if (accounts.length === 0) {
        setSyncMsg('No bank accounts connected yet.')
        return
      }
      const { assets: updatedAssets, debts: updatedDebts } = await syncPlaidBalances(accounts)
      setAssets(prev => {
        const next = [...prev]
        for (const a of updatedAssets) {
          const idx = next.findIndex(x => x.id === a.id)
          if (idx >= 0) next[idx] = a; else next.push(a)
        }
        return next.sort((a, b) => a.name.localeCompare(b.name))
      })
      setDebts(prev => {
        const next = [...prev]
        for (const d of updatedDebts) {
          const idx = next.findIndex(x => x.id === d.id)
          if (idx >= 0) next[idx] = d; else next.push(d)
        }
        return next.sort((a, b) => a.owner.localeCompare(b.owner))
      })
      const count = updatedAssets.length + updatedDebts.length
      setSyncMsg(`Synced ${count} account${count !== 1 ? 's' : ''} from bank`)
    } catch {
      setSyncMsg('Sync failed — please try again')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 4000)
    }
  }

  async function handleSnapshot() {
    const month = currentMonth()
    const existing = snapshots.find(s => s.month === month)
    if (existing && !confirmReplaceSnap) {
      setConfirmReplaceSnap(true)
      return
    }
    setConfirmReplaceSnap(false)
    setSavingSnap(true)
    try {
      const snap = await createNetWorthSnapshot({
        month, total_assets: totalAssets, total_debt: totalDebt, net_worth: netWorth,
      })
      setSnapshots(prev => [...prev.filter(s => s.month !== snap.month), snap].sort((a, b) => a.month.localeCompare(b.month)))
    } finally { setSavingSnap(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[20px] font-medium" style={{ color: 'var(--color-foreground)' }}>Wealth</h1>
        <Button variant="ghost" size="sm" onClick={handleBalanceSync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync from bank'}
        </Button>
      </div>
      {syncMsg && (
        <p className="text-[13px] mb-4" style={{ color: syncMsg.includes('fail') ? 'var(--color-negative)' : 'var(--color-positive)' }}>
          {syncMsg}
        </p>
      )}

      {error ? (
        <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></div>
      ) : (
        <>
          {/* Net worth summary */}
          <section className="mb-8">
            <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Net worth</h2>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <MetricCard label="Assets"    value={fmtWhole(totalAssets)} />
              <MetricCard label="Debt"      value={fmtWhole(totalDebt)} />
              <MetricCard
                label="Net worth"
                value={(netWorth < 0 ? '−' : '') + fmtWhole(Math.abs(netWorth))}
                valueColor={netWorth < 0 ? 'var(--color-negative)' : undefined}
              />
            </div>
            <NetWorthChart snapshots={snapshots} />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Updated monthly</span>
              {confirmReplaceSnap ? (
                <div className="flex items-center gap-2">
                  <span className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
                    Replace {currentMonth()} snapshot?
                  </span>
                  <Button size="sm" intent="negative" onClick={handleSnapshot}>Replace</Button>
                  <Button size="sm" variant="ghost" intent="neutral" onClick={() => setConfirmReplaceSnap(false)}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" intent="primary" onClick={handleSnapshot} disabled={savingSnap}>
                  {savingSnap ? 'Saving…' : 'Record snapshot'}
                </Button>
              )}
            </div>
            {snapshots.length > 0 && (
              <div className="mt-2 pt-2" style={{ borderTop: '0.5px solid var(--color-border)' }}>
                {snapshots.slice(-3).reverse().map(s => (
                  <div key={s.id} className="group flex items-center gap-3 py-1 text-[11px]">
                    <span className="w-[60px]" style={{ color: 'var(--color-muted)' }}>{s.month}</span>
                    <span
                      className="flex-1 tabular-nums font-medium"
                      style={{ color: s.net_worth < 0 ? 'var(--color-negative)' : 'var(--color-positive)' }}
                    >
                      {s.net_worth < 0 ? '−' : '+'}{fmtWhole(Math.abs(s.net_worth))}
                    </span>
                    <SnapshotDeleteButton
                      label={s.month}
                      onDelete={() => { setSnapshots(prev => prev.filter(x => x.id !== s.id)); deleteNetWorthSnapshot(s.id) }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <SavingsSection
            pods={pods} setPods={setPods}
            totalAllotted={totalAllotted} totalPodGoal={totalPodGoal}
            savingsBalance={savingsBalance}
            podAccounts={podAccounts}
            onPodAccountToggle={(accountId, value) => {
              setSavingsPodAccount(accountId, value)
              setPodAccounts(prev => prev.map(a => a.account_id === accountId ? { ...a, is_savings_pod: value } : a))
            }}
          />
          <AssetsSection assets={assets} setAssets={setAssets} />
          <DebtsSection debts={debts} setDebts={setDebts} />
        </>
      )}
    </div>
  )
}

// ── Savings pods ──────────────────────────────────────────────────────────────

const DEFAULT_PODS = ['Emergency fund', 'Down payment', 'Adventures', 'General savings']

type PodAccount = { account_id: string; name: string; mask: string; is_savings_pod: boolean }

function SavingsSection({ pods, setPods, totalAllotted, totalPodGoal, savingsBalance, podAccounts, onPodAccountToggle }: {
  pods: SavingsPod[]
  setPods: React.Dispatch<React.SetStateAction<SavingsPod[]>>
  totalAllotted: number
  totalPodGoal: number
  savingsBalance: number
  podAccounts: PodAccount[]
  onPodAccountToggle: (accountId: string, value: boolean) => void
}) {
  const [newName,           setNewName]           = useState('')
  const [adding,            setAdding]            = useState(false)
  const [showAdd,           setShowAdd]           = useState(false)
  const [showAccountConfig, setShowAccountConfig] = useState(false)
  const unallocated = savingsBalance - totalAllotted

  async function handleAdd(name: string) {
    if (!name.trim()) return
    setAdding(true)
    try {
      const created = await createSavingsPod({ name: name.trim(), allotted: 0, goal: 0 })
      setPods(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    } finally { setAdding(false) }
  }

  async function handleUpdate(id: string, field: 'allotted' | 'goal', raw: string) {
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) return
    const updated = await updateSavingsPod(id, { [field]: val } as SavingsPodUpdate)
    setPods(prev => prev.map(p => p.id === id ? updated : p))
  }

  return (
    <section className="mb-8">
      <h2 className="text-[14px] font-medium mb-1" style={{ color: 'var(--color-foreground)' }}>Savings pods</h2>
      <p className="text-[12px] mb-3" style={{ color: 'var(--color-muted)' }}>Every dollar saved has a home.</p>
      <div className="rounded-xl px-5 py-4 mb-4" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
        <div className="flex items-center gap-4 flex-wrap">
          <MetricCard label="Savings balance" value={fmtWhole(savingsBalance)} />
          <MetricCard label="Allotted" value={fmtWhole(totalAllotted)} />
          <MetricCard
            label={unallocated >= 0 ? 'Unallocated' : 'Over-allotted'}
            value={fmtWhole(Math.abs(unallocated))}
            valueColor={unallocated < 0 ? 'var(--color-negative)' : undefined}
          />
          <MetricCard label="Total goal" value={fmtWhole(totalPodGoal)} />
        </div>
        {podAccounts.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
            <button
              type="button"
              onClick={() => setShowAccountConfig(v => !v)}
              className="text-[11px]"
              style={{ color: 'var(--color-muted)' }}
            >
              Configure accounts {showAccountConfig ? '▴' : '▾'}
            </button>
            {showAccountConfig && (
              <div
                className="mt-2 rounded-lg overflow-hidden"
                style={{ border: '0.5px solid var(--color-border)', background: 'var(--color-background)' }}
              >
                {podAccounts.map(acct => (
                  <label
                    key={acct.account_id}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                    style={{ borderBottom: '0.5px solid var(--color-border)' }}
                  >
                    <input
                      type="checkbox"
                      checked={acct.is_savings_pod}
                      onChange={e => onPodAccountToggle(acct.account_id, e.target.checked)}
                    />
                    <span className="text-[12px] flex-1" style={{ color: 'var(--color-foreground)' }}>
                      {acct.name}
                      {acct.mask && <span style={{ color: 'var(--color-muted)' }}> ···{acct.mask}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <Card>
        <div className="flex items-center gap-2 pb-2 mb-1" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
          <span className="flex-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>Pod</span>
          <span className="w-[80px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Allotted</span>
          <span className="w-[80px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Goal</span>
          <span className="w-5" />
        </div>
        {pods.length === 0 ? (
          <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No savings pods yet — add one to start tracking where your money is going.</p>
        ) : pods.map(p => (
          <SavingsPodRow
            key={p.id} pod={p}
            onUpdate={handleUpdate}
            onDelete={async (id) => { setPods(prev => prev.filter(x => x.id !== id)); await deleteSavingsPod(id) }}
          />
        ))}
        {showAdd ? (
          <div className="mt-4 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
            <form onSubmit={e => { e.preventDefault(); handleAdd(newName) }} className="flex gap-2 mb-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Pod name" autoFocus className={`flex-1 min-w-0 ${inputCls}`} style={inputStyle} />
              <Button type="submit" size="sm" disabled={!newName.trim() || adding}>Add</Button>
              <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={() => setShowAdd(false)}>Cancel</Button>
            </form>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_PODS.filter(n => !pods.find(p => p.name.toLowerCase() === n.toLowerCase())).map(n => (
                <button key={n} type="button" onClick={() => handleAdd(n)} className="px-2 py-[3px] rounded-md text-[11px] hover:opacity-80 transition-opacity" style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>{n}</button>
              ))}
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowAdd(true)} className="mt-3 text-[13px]" style={{ color: 'var(--color-muted)' }}>+ New pod</button>
        )}
      </Card>
    </section>
  )
}

function SavingsPodRow({ pod, onUpdate, onDelete }: {
  pod: SavingsPod
  onUpdate: (id: string, f: 'allotted' | 'goal', v: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [allotted, setAllotted] = useState(String(pod.allotted))
  const [goal,     setGoal]     = useState(String(pod.goal))
  const [savedField, setSavedField] = useState<'allotted' | 'goal' | null>(null)

  useEffect(() => { setAllotted(String(pod.allotted)) }, [pod.allotted])
  useEffect(() => { setGoal(String(pod.goal)) }, [pod.goal])

  async function handleSave(field: 'allotted' | 'goal', raw: string) {
    await onUpdate(pod.id, field, raw)
    setSavedField(field)
    setTimeout(() => setSavedField(null), 1200)
  }

  function fieldStyle(field: 'allotted' | 'goal') {
    return {
      fontSize: '16px',
      background: 'var(--color-background)',
      border: `0.5px solid ${savedField === field ? 'var(--color-positive)' : 'var(--color-border)'}`,
      color: 'var(--color-foreground)',
      transition: 'border-color 0.4s ease',
    }
  }

  return (
    <div className="flex flex-col group py-2" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[13px] truncate" style={{ color: 'var(--color-foreground)' }}>{pod.name}</span>
        <input type="number" min="0" step="0.01" value={allotted} onChange={e => setAllotted(e.target.value)} onBlur={e => handleSave('allotted', e.target.value)} className={numCls} style={fieldStyle('allotted')} />
        <input type="number" min="0" step="0.01" value={goal}     onChange={e => setGoal(e.target.value)}     onBlur={e => handleSave('goal',     e.target.value)} className={numCls} style={fieldStyle('goal')} />
        <InlineDelete onDelete={() => onDelete(pod.id)} label={pod.name} />
      </div>
      {pod.goal > 0 && <div className="mt-1 mb-1"><ProgressBar value={Math.min(100, (pod.allotted / pod.goal) * 100)} intent="harvest" /></div>}
    </div>
  )
}

// ── Assets ────────────────────────────────────────────────────────────────────

const ASSET_TYPES = ['checking', 'savings', 'credit_card', 'investment', 'property', 'other']

function AssetsSection({ assets, setAssets }: { assets: Asset[]; setAssets: React.Dispatch<React.SetStateAction<Asset[]>> }) {
  const [newName,    setNewName]    = useState('')
  const [newType,    setNewType]    = useState('checking')
  const [newBalance, setNewBalance] = useState('')
  const [adding,     setAdding]     = useState(false)
  const [showAdd,    setShowAdd]    = useState(false)
  const [savedId,    setSavedId]    = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const balance = parseFloat(newBalance)
    if (!newName.trim() || isNaN(balance)) return
    setAdding(true)
    try {
      const created = await createAsset({ name: newName.trim(), type: newType, balance })
      setAssets(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName(''); setNewBalance('')
    } finally { setAdding(false) }
  }

  return (
    <section className="mb-8">
      <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Assets</h2>
      <Card>
        {assets.length === 0 ? (
          <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No assets yet — add accounts, investments, or property.</p>
        ) : assets.map(a => (
          <AssetRow
            key={a.id} asset={a}
            saved={savedId === a.id}
            onSave={async val => {
              const updated = await updateAsset(a.id, { balance: val } as AssetUpdate)
              setAssets(prev => prev.map(x => x.id === a.id ? updated : x))
              setSavedId(a.id)
              setTimeout(() => setSavedId(prev => prev === a.id ? null : prev), 1200)
            }}
            onDelete={() => { setAssets(prev => prev.filter(x => x.id !== a.id)); deleteAsset(a.id) }}
          />
        ))}
        {showAdd ? (
          <form onSubmit={handleAdd} className="flex gap-2 flex-wrap mt-4 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Account name" autoFocus className={`flex-1 min-w-[120px] ${inputCls}`} style={inputStyle} />
            <select value={newType} onChange={e => setNewType(e.target.value)} className={`w-[120px] ${inputCls}`} style={inputStyle}>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <input type="number" min="0" step="0.01" value={newBalance} onChange={e => setNewBalance(e.target.value)} placeholder="Balance" className={`w-[96px] ${inputCls}`} style={inputStyle} />
            <Button type="submit" size="sm" disabled={!newName.trim() || !newBalance || adding}>Add</Button>
            <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={() => setShowAdd(false)}>Cancel</Button>
          </form>
        ) : (
          <button type="button" onClick={() => setShowAdd(true)} className="mt-3 text-[13px]" style={{ color: 'var(--color-muted)' }}>+ Add asset</button>
        )}
      </Card>
    </section>
  )
}

function AssetRow({ asset, saved, onSave, onDelete }: {
  asset: Asset
  saved: boolean
  onSave: (val: number) => Promise<void>
  onDelete: () => void
}) {
  const [bal, setBal] = useState(String(asset.balance))
  useEffect(() => { setBal(String(asset.balance)) }, [asset.balance])

  return (
    <div className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <span className="flex-1 text-[13px]" style={{ color: 'var(--color-foreground)' }}>{asset.name}</span>
      <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{asset.type.replace('_', ' ')}</span>
      <input
        type="number" min="0" step="0.01"
        value={bal}
        onChange={e => setBal(e.target.value)}
        onBlur={async e => {
          const val = parseFloat(e.target.value)
          if (!isNaN(val)) await onSave(val)
        }}
        className={numCls}
        style={{ ...inputStyle, border: `0.5px solid ${saved ? 'var(--color-positive)' : 'var(--color-border)'}`, transition: 'border-color 0.4s ease' }}
      />
      <InlineDelete onDelete={onDelete} label={asset.name} />
    </div>
  )
}

// ── Debts ─────────────────────────────────────────────────────────────────────

function DebtsSection({ debts, setDebts }: { debts: Debt[]; setDebts: React.Dispatch<React.SetStateAction<Debt[]>> }) {
  const [newName,   setNewName]   = useState('')
  const [newOwner,  setNewOwner]  = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [adding,    setAdding]    = useState(false)
  const [showAdd,   setShowAdd]   = useState(false)
  const [savedId,   setSavedId]   = useState<string | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(newAmount)
    if (!newName.trim() || !newOwner.trim() || isNaN(amount)) return
    setAdding(true)
    try {
      const created = await createDebt({ name: newName.trim(), owner: newOwner.trim(), amount_owed: amount, interest_rate: 0 })
      setDebts(prev => [...prev, created].sort((a, b) => a.owner.localeCompare(b.owner)))
      setNewName(''); setNewOwner(''); setNewAmount('')
    } finally { setAdding(false) }
  }

  return (
    <section className="mb-8">
      <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Debts</h2>
      <Card>
        {debts.length === 0 ? (
          <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No debts recorded — add loans or credit card balances.</p>
        ) : debts.map(d => (
          <DebtRow
            key={d.id} debt={d}
            saved={savedId === d.id}
            onSave={async val => {
              const updated = await updateDebt(d.id, { amount_owed: val } as DebtUpdate)
              setDebts(prev => prev.map(x => x.id === d.id ? updated : x))
              setSavedId(d.id)
              setTimeout(() => setSavedId(prev => prev === d.id ? null : prev), 1200)
            }}
            onDelete={() => { setDebts(prev => prev.filter(x => x.id !== d.id)); deleteDebt(d.id) }}
          />
        ))}
        {showAdd ? (
          <form onSubmit={handleAdd} className="flex gap-2 flex-wrap mt-4 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
            <input value={newName}   onChange={e => setNewName(e.target.value)}   placeholder="Debt name" autoFocus className={`flex-1 min-w-[100px] ${inputCls}`} style={inputStyle} />
            <input value={newOwner}  onChange={e => setNewOwner(e.target.value)}  placeholder="Owner"     className={`w-[80px] ${inputCls}`} style={inputStyle} />
            <input type="number" min="0" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Amount" className={`w-[96px] ${inputCls}`} style={inputStyle} />
            <Button type="submit" size="sm" disabled={!newName.trim() || !newOwner.trim() || !newAmount || adding}>Add</Button>
            <Button type="button" size="sm" variant="ghost" intent="neutral" onClick={() => setShowAdd(false)}>Cancel</Button>
          </form>
        ) : (
          <button type="button" onClick={() => setShowAdd(true)} className="mt-3 text-[13px]" style={{ color: 'var(--color-muted)' }}>+ Add debt</button>
        )}
      </Card>
    </section>
  )
}

function DebtRow({ debt, saved, onSave, onDelete }: {
  debt: Debt
  saved: boolean
  onSave: (val: number) => Promise<void>
  onDelete: () => void
}) {
  const [amt, setAmt] = useState(String(debt.amount_owed))
  useEffect(() => { setAmt(String(debt.amount_owed)) }, [debt.amount_owed])

  return (
    <div className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <span className="flex-1 text-[13px]" style={{ color: 'var(--color-foreground)' }}>{debt.name}</span>
      <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{debt.owner}</span>
      <input
        type="number" min="0" step="0.01"
        value={amt}
        onChange={e => setAmt(e.target.value)}
        onBlur={async e => {
          const val = parseFloat(e.target.value)
          if (!isNaN(val)) await onSave(val)
        }}
        className={numCls}
        style={{ ...inputStyle, color: 'var(--color-negative)', border: `0.5px solid ${saved ? 'var(--color-positive)' : 'var(--color-border)'}`, transition: 'border-color 0.4s ease' }}
      />
      <InlineDelete onDelete={onDelete} label={debt.name} />
    </div>
  )
}
