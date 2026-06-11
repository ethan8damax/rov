'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/context/auth'
import { getBudgetCategories, getIncomeSources } from '@/lib/queries/finance'
import { getSavingsPods, getAssets, getDebts, getNetWorthSnapshots } from '@/lib/queries/wealth'
import { getUncategorizedCount } from '@/lib/queries/accounts'
import { currentMonth, fmtWhole } from '@/lib/utils'
import type { BudgetCategory, SavingsPod, Asset, Debt, NetWorthSnapshot } from '@/types'
import MetricCard from '@/components/ui/MetricCard'
import ProgressBar from '@/components/ui/ProgressBar'
import Card from '@/components/ui/Card'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

export default function HomePage() {
  const { loading: authLoading, householdId } = useAuth()
  const month = currentMonth()

  const [categories,         setCategories]         = useState<BudgetCategory[]>([])
  const [pods,               setPods]               = useState<SavingsPod[]>([])
  const [assets,             setAssets]             = useState<Asset[]>([])
  const [debts,              setDebts]              = useState<Debt[]>([])
  const [snapshots,          setSnapshots]          = useState<NetWorthSnapshot[]>([])
  const [totalIncome,        setTotalIncome]        = useState(0)
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [loading,            setLoading]            = useState(true)
  const [error,              setError]              = useState<string | null>(null)

  const load = useCallback(async () => {
    if (authLoading) return
    setLoading(true); setError(null)
    try {
      const [cats, incs, p, a, d, s, uncatCount] = await Promise.all([
        getBudgetCategories(month),
        getIncomeSources(month),
        getSavingsPods(),
        getAssets(),
        getDebts(),
        getNetWorthSnapshots(),
        householdId ? getUncategorizedCount(householdId, month) : Promise.resolve(0),
      ])
      setCategories(cats)
      setTotalIncome(incs.reduce((sum, i) => sum + i.expected, 0))
      setPods(p); setAssets(a); setDebts(d); setSnapshots(s)
      setUncategorizedCount(uncatCount)
    } catch (err) {
      setError(err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to load')
    } finally { setLoading(false) }
  }, [month, authLoading, householdId])

  useEffect(() => { load() }, [load])

  const totalBudgeted  = useMemo(() => categories.reduce((s, c) => s + c.expected, 0), [categories])
  const leftover       = totalIncome - totalBudgeted
  const totalAssets    = useMemo(() => assets.reduce((s, a) => s + a.balance, 0), [assets])
  const totalDebt      = useMemo(() => debts.reduce((s, d) => s + d.amount_owed, 0), [debts])
  const netWorth       = totalAssets - totalDebt
  const totalAllotted  = useMemo(() => pods.reduce((s, p) => s + p.allotted, 0), [pods])
  const totalPodGoal   = useMemo(() => pods.reduce((s, p) => s + p.goal, 0), [pods])

  const topCategories = useMemo(
    () => [...categories].filter(c => c.actual > 0).sort((a, b) => b.actual - a.actual).slice(0, 5),
    [categories],
  )

  const overBudget = categories.filter(c => c.expected > 0 && c.actual > c.expected)

  const latestSnap   = snapshots[snapshots.length - 1]
  const previousSnap = snapshots[snapshots.length - 2]
  const nwDelta = latestSnap && previousSnap ? latestSnap.net_worth - previousSnap.net_worth : null

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
        <h1 className="text-[20px] font-medium" style={{ color: 'var(--color-foreground)' }}>Rov</h1>
        <span className="text-[13px] ml-1" style={{ color: 'var(--color-muted)' }}>
          {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* Uncategorized transactions nudge */}
      {!loading && !error && uncategorizedCount > 0 && (
        <a href="/accounts" className="block mb-5 rounded-xl px-4 py-3" style={{ background: 'var(--color-primary-subtle)', border: '0.5px solid var(--color-primary)' }}>
          <p className="text-[13px]" style={{ color: 'var(--color-primary)' }}>
            {uncategorizedCount} transaction{uncategorizedCount !== 1 ? 's' : ''} this month {uncategorizedCount !== 1 ? 'need' : 'needs'} a category →
          </p>
        </a>
      )}

      {error ? (
        <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {/* Net worth hero */}
          <section className="mb-6">
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
              <p className="text-[12px] mb-1" style={{ color: 'var(--color-muted)' }}>Net worth</p>
              <p className="text-[32px] font-medium tabular-nums" style={{ color: 'var(--color-foreground)' }}>
                {netWorth < 0 ? '−' : ''}{fmtWhole(Math.abs(netWorth))}
              </p>
              {nwDelta !== null && (
                <p className="text-[13px] mt-1" style={{ color: nwDelta >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
                  {nwDelta >= 0 ? '↑' : '↓'} {fmtWhole(Math.abs(nwDelta))} since last snapshot
                </p>
              )}
            </div>
          </section>

          {/* Budget health */}
          <section className="mb-6">
            <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Budget this month</h2>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <MetricCard label="Income"   value={fmtWhole(totalIncome)} />
              <MetricCard label="Budgeted" value={fmtWhole(totalBudgeted)} />
              <MetricCard
                label="Unallocated"
                value={(leftover < 0 ? '−' : '') + fmtWhole(Math.abs(leftover))}
                valueColor={leftover < 0 ? 'var(--color-negative)' : undefined}
              />
            </div>
            {totalIncome > 0 && (
              <ProgressBar value={Math.min(100, (totalBudgeted / totalIncome) * 100)} intent="primary" />
            )}
            {overBudget.length > 0 && (
              <div className="mt-3 rounded-xl px-4 py-3" style={{ background: 'var(--color-negative-subtle)' }}>
                <p className="text-[12px]" style={{ color: 'var(--color-negative)' }}>
                  Over budget on {overBudget.length} {overBudget.length === 1 ? 'category' : 'categories'}: {overBudget.map(c => c.name).join(', ')}
                </p>
              </div>
            )}
          </section>

          {/* Savings */}
          {pods.length > 0 && (
            <section className="mb-6">
              <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Savings</h2>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Total allotted" value={fmtWhole(totalAllotted)} />
                <MetricCard label="Total goal"     value={fmtWhole(totalPodGoal)} />
              </div>
              {totalPodGoal > 0 && (
                <div className="mt-2">
                  <ProgressBar value={Math.min(100, (totalAllotted / totalPodGoal) * 100)} intent="positive" />
                </div>
              )}
            </section>
          )}

          {/* Top spending */}
          {topCategories.length > 0 && (
            <section className="mb-6">
              <h2 className="text-[14px] font-medium mb-3" style={{ color: 'var(--color-foreground)' }}>Top spending</h2>
              <Card>
                {topCategories.map(c => {
                  const isOver = c.expected > 0 && c.actual > c.expected
                  return (
                    <div key={c.id} className="flex items-center gap-3 py-2" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
                      <span className="flex-1 text-[13px]" style={{ color: 'var(--color-foreground)' }}>{c.name}</span>
                      <span
                        className="text-[13px] tabular-nums font-medium"
                        style={{ color: isOver ? 'var(--color-negative)' : 'var(--color-foreground)' }}
                      >
                        {fmtWhole(c.actual)}
                      </span>
                      {c.expected > 0 && (
                        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                          / {fmtWhole(c.expected)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </Card>
            </section>
          )}

          {/* Empty state */}
          {categories.length === 0 && pods.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[15px] font-medium mb-2" style={{ color: 'var(--color-foreground)' }}>Welcome to Rov</p>
              <p className="text-[13px]" style={{ color: 'var(--color-muted)' }}>
                Start by setting up your budget categories and income sources.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
