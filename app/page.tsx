'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/context/auth'
import { createClient } from '@/lib/supabase/client'
import { getBudgetCategories, getIncomeSources } from '@/lib/queries/finance'
import { getSavingsPods } from '@/lib/queries/wealth'
import { getUncategorizedCount } from '@/lib/queries/accounts'
import { currentMonth, fmtWhole, sanitizeError } from '@/lib/utils'
import type { BudgetCategory, SavingsPod } from '@/types'
import MetricCard from '@/components/ui/MetricCard'
import ProgressBar from '@/components/ui/ProgressBar'
import Card from '@/components/ui/Card'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

export default function HomePage() {
  const { loading: authLoading, householdId, displayName, user } = useAuth()
  const month = currentMonth()

  const [categories,         setCategories]         = useState<BudgetCategory[]>([])
  const [pods,               setPods]               = useState<SavingsPod[]>([])
  const [totalIncome,        setTotalIncome]        = useState(0)
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [loading,            setLoading]            = useState(true)
  const [error,              setError]              = useState<string | null>(null)
  const [partnerName,        setPartnerName]        = useState<string | null>(null)

  useEffect(() => {
    if (!householdId || !user) return
    const supabase = createClient()
    supabase
      .from('household_members')
      .select('display_name')
      .eq('household_id', householdId)
      .neq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setPartnerName(data?.display_name ?? null))
  }, [householdId, user?.id])

  const load = useCallback(async () => {
    if (authLoading) return
    setLoading(true); setError(null)
    try {
      const [cats, incs, p, uncatCount] = await Promise.all([
        getBudgetCategories(month),
        getIncomeSources(month),
        getSavingsPods(),
        householdId ? getUncategorizedCount(householdId, month) : Promise.resolve(0),
      ])
      setCategories(cats)
      setTotalIncome(incs.reduce((sum, i) => sum + i.expected, 0))
      setPods(p)
      setUncategorizedCount(uncatCount)
    } catch (err) {
      setError(sanitizeError(err))
    } finally { setLoading(false) }
  }, [month, authLoading, householdId])

  useEffect(() => { load() }, [load])

  const totalBudgeted  = useMemo(() => categories.reduce((s, c) => s + c.expected, 0), [categories])
  const totalActual    = useMemo(() => categories.reduce((s, c) => s + c.actual,   0), [categories])
  const leftToSpend    = totalIncome - totalActual
  const unallocated    = totalIncome - totalBudgeted
  const totalAllotted  = useMemo(() => pods.reduce((s, p) => s + p.allotted, 0), [pods])
  const totalPodGoal   = useMemo(() => pods.reduce((s, p) => s + p.goal,     0), [pods])

  const topCategories = useMemo(
    () => [...categories].filter(c => c.actual > 0).sort((a, b) => b.actual - a.actual).slice(0, 5),
    [categories],
  )
  const overBudget = categories.filter(c => c.expected > 0 && c.actual > c.expected)

  const today       = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysLeft    = daysInMonth - today.getDate()
  const dailyRate   = daysLeft > 0 && leftToSpend > 0 && totalIncome > 0 ? leftToSpend / daysLeft : null

  const greeting = (() => {
    const hour  = today.getHours()
    const first = displayName?.split(' ')[0] ?? ''
    const partnerFirst = partnerName?.split(' ')[0] ?? ''
    const names = first && partnerFirst ? `${first} & ${partnerFirst}` : first || partnerFirst
    const suffix = names ? `, ${names}` : ''
    if (hour < 12) return `Good morning${suffix}`
    if (hour < 17) return `Good afternoon${suffix}`
    return `Good evening${suffix}`
  })()

  const todayLabel = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const heroColor = leftToSpend < 0
    ? 'var(--color-negative)'
    : totalIncome > 0
      ? 'var(--color-positive)'
      : 'var(--color-foreground)'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[20px] font-medium" style={{ color: 'var(--color-foreground)' }}>{greeting}</h1>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {todayLabel}{daysLeft > 0 ? ` · ${daysLeft} days left in ${today.toLocaleDateString('en-US', { month: 'long' })}` : ''}
        </p>
      </div>

      {!loading && !error && uncategorizedCount > 0 && (
        <a
          href="/accounts"
          className="flex items-center justify-between mb-5 rounded-xl px-4 py-3"
          style={{ background: 'var(--color-primary-subtle)', border: '0.5px solid var(--color-primary)' }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="text-[12px] font-medium tabular-nums px-1.5 py-0.5 rounded-md"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              {uncategorizedCount}
            </span>
            <span className="text-[13px]" style={{ color: 'var(--color-primary)' }}>
              transaction{uncategorizedCount !== 1 ? 's' : ''} need{uncategorizedCount === 1 ? 's' : ''} a category
            </span>
          </div>
          <span className="text-[13px]" style={{ color: 'var(--color-primary)' }}>→</span>
        </a>
      )}

      {error ? (
        <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : (
        <>
          {/* Left to spend hero */}
          <section className="mb-6">
            <div className="rounded-xl px-5 py-4" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
              <p className="text-[12px] mb-1" style={{ color: 'var(--color-muted)' }}>
                {leftToSpend < 0 ? 'Over budget' : 'Left to spend'}
              </p>
              <p className="text-[32px] font-medium tabular-nums" style={{ color: heroColor }}>
                {leftToSpend < 0 ? '−' : ''}{fmtWhole(Math.abs(leftToSpend))}
              </p>
              {dailyRate !== null && (
                <p className="text-[13px] mt-1" style={{ color: 'var(--color-muted)' }}>
                  ~{fmtWhole(dailyRate)}/day left to spend · {daysLeft} days left
                </p>
              )}
              {totalIncome > 0 && (
                <div className="mt-3">
                  <ProgressBar value={Math.min(100, (totalActual / totalIncome) * 100)} intent={leftToSpend < 0 ? 'negative' : 'primary'} />
                </div>
              )}
              <div className="flex items-center gap-3 mt-2 text-[12px]" style={{ color: 'var(--color-muted)' }}>
                <span>Income {fmtWhole(totalIncome)}</span>
                <span>·</span>
                <span>Spent {fmtWhole(totalActual)}</span>
              </div>
            </div>
          </section>

          {overBudget.length > 0 && (
            <div className="rounded-xl px-4 py-3 mb-5" style={{ background: 'var(--color-negative-subtle)' }}>
              <p className="text-[12px]" style={{ color: 'var(--color-negative)' }}>
                Over budget on {overBudget.length} {overBudget.length === 1 ? 'category' : 'categories'}: {overBudget.map(c => c.name).join(', ')}
              </p>
            </div>
          )}

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
                        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>/ {fmtWhole(c.expected)}</span>
                      )}
                    </div>
                  )
                })}
              </Card>
            </section>
          )}

          {categories.length === 0 && pods.length === 0 && (
            <div className="py-10">
              <p className="text-[15px] font-medium mb-2" style={{ color: 'var(--color-foreground)' }}>Nothing set up yet</p>
              <p className="text-[13px] mb-5" style={{ color: 'var(--color-muted)' }}>
                Add this month's budget categories and income to see your household's picture here.
              </p>
              <a href="/budget" className="text-[13px] font-medium" style={{ color: 'var(--color-primary)' }}>
                Set up this month's budget →
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
