'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  getBudgetCategories, createBudgetCategory, updateBudgetCategory, deleteBudgetCategory,
  getIncomeSources, getRecurringPayments, getBudgetCategoriesPastMonths,
  ensureMonthSetup, undoCarryover, type CarryoverResult,
} from '@/lib/queries/finance'
import { getHouseholdMemberNames } from '@/lib/queries/households'
import { getTransactionSumsByCategory } from '@/lib/queries/accounts'
import { currentMonth, shiftMonth, formatMonthLabel, fmtWhole, getPastMonths, sanitizeError } from '@/lib/utils'
import type { BudgetCategory, IncomeSource, RecurringPayment } from '@/types'
import { useAuth } from '@/lib/context/auth'
import { useToast } from '@/components/ui/Toast'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import ProgressBar from '@/components/ui/ProgressBar'
import IncomeTab from '@/components/budget/IncomeTab'
import RecurringTab from '@/components/budget/RecurringTab'
import SpendingTrendChart, { buildTrendPoints } from '@/components/budget/SpendingTrendChart'

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ background: 'var(--color-surface)' }} />
}

const DEFAULT_CATEGORIES = [
  'Savings', 'Rent', 'Groceries', 'Gas', 'Restaurants',
  'Coffee', 'Shopping', 'Subscriptions', 'Fun money',
]

type BudgetTab = 'spending' | 'income' | 'recurring'

const TABS: { key: BudgetTab; label: string }[] = [
  { key: 'spending',  label: 'Spending' },
  { key: 'income',    label: 'Income' },
  { key: 'recurring', label: 'Recurring' },
]

export default function BudgetPage() {
  const { householdId, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [month,          setMonth]          = useState(() => currentMonth())
  const [tab,            setTab]            = useState<BudgetTab>('spending')
  const [categories,     setCategories]     = useState<BudgetCategory[]>([])
  const [incomes,        setIncomes]        = useState<IncomeSource[]>([])
  const [recurrings,     setRecurrings]     = useState<RecurringPayment[]>([])
  const [owners,         setOwners]         = useState<string[]>([])
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [newName,        setNewName]        = useState('')
  const [addingCat,      setAddingCat]      = useState(false)
  const [pastCategories, setPastCategories] = useState<BudgetCategory[]>([])
  const [bankSums,       setBankSums]       = useState<{ category_id: string; total: number }[]>([])
  const [showTrends,     setShowTrends]     = useState(false)
  const [syncing,        setSyncing]        = useState(false)
  const loadRef = useRef<() => void>(() => {})

  const showCarryoverToast = useCallback((copied: CarryoverResult, forMonth: string) => {
    const parts: string[] = []
    if (copied.categoryIds.length > 0) parts.push(`${copied.categoryIds.length} ${copied.categoryIds.length === 1 ? 'category' : 'categories'}`)
    if (copied.incomeIds.length > 0)   parts.push(`${copied.incomeIds.length} income ${copied.incomeIds.length === 1 ? 'source' : 'sources'}`)
    toast(`Copied ${parts.join(' and ')} from ${formatMonthLabel(copied.fromMonth)}`, 'info', {
      duration: 8000,
      action: {
        label: 'Undo',
        onPress: async () => {
          localStorage.setItem(`rov-skip-carryover-${forMonth}`, '1')
          await undoCarryover(copied.categoryIds, copied.incomeIds)
          loadRef.current()
        },
      },
    })
  }, [toast])

  const load = useCallback(async () => {
    if (authLoading) return
    setLoading(true); setError(null)
    try {
      const skip = localStorage.getItem(`rov-skip-carryover-${month}`) === '1'
      const copied = await ensureMonthSetup(month, skip)
      const trendMonths = getPastMonths(month, 6)
      const [cats, incs, recs, names, pastCats, sums] = await Promise.all([
        getBudgetCategories(month),
        getIncomeSources(month),
        getRecurringPayments(),
        getHouseholdMemberNames(),
        getBudgetCategoriesPastMonths(trendMonths),
        householdId ? getTransactionSumsByCategory(householdId, month) : Promise.resolve([]),
      ])
      setCategories(cats)
      setIncomes(incs)
      setRecurrings(recs)
      setOwners(names)
      setPastCategories(pastCats)
      setBankSums(sums)
      if (copied) showCarryoverToast(copied, month)
    } catch (err) {
      setError(sanitizeError(err))
    } finally {
      setLoading(false)
    }
  }, [month, householdId, authLoading, showCarryoverToast])

  useEffect(() => { loadRef.current = load }, [load])
  useEffect(() => { load() }, [load])

  const totalIncome   = useMemo(() => incomes.reduce((s, i) => s + i.expected, 0), [incomes])
  const totalBudgeted = useMemo(() => categories.reduce((s, c) => s + c.expected, 0), [categories])
  const totalActual   = useMemo(() => categories.reduce((s, c) => s + c.actual,   0), [categories])
  const leftover      = Math.round(totalIncome - totalBudgeted)
  const leftToSpend   = Math.round(totalIncome - totalActual)

  const flexible = useMemo(() => categories.filter(c => !c.recurring_payment_id), [categories])
  const fixed    = useMemo(() => categories.filter(c => c.recurring_payment_id),  [categories])

  const hasBankSums = bankSums.some(b => b.total > 0 && flexible.some(f => f.id === b.category_id))

  async function handleAddCategory(name: string) {
    if (!name.trim()) return
    setAddingCat(true)
    try {
      if (categories.find(c => c.name.toLowerCase() === name.trim().toLowerCase())) return
      const created = await createBudgetCategory({ name: name.trim(), month, expected: 0, actual: 0 })
      setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
    } finally { setAddingCat(false); setNewName('') }
  }

  async function handleUpdateField(id: string, field: 'expected' | 'actual' | 'name', raw: string) {
    if (field === 'name') {
      const trimmed = raw.trim()
      if (!trimmed) return
      const updated = await updateBudgetCategory(id, { name: trimmed })
      setCategories(prev => prev.map(c => c.id === id ? updated : c))
      return
    }
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) return
    const updated = await updateBudgetCategory(id, { [field]: val })
    setCategories(prev => prev.map(c => c.id === id ? updated : c))
  }

  async function handleDelete(id: string) {
    setCategories(prev => prev.filter(c => c.id !== id))
    await deleteBudgetCategory(id)
  }

  async function handleSyncActuals() {
    setSyncing(true)
    try {
      const toSync = flexible.filter(c => (bankSums.find(b => b.category_id === c.id)?.total ?? 0) > 0)
      const updated = await Promise.all(
        toSync.map(c => updateBudgetCategory(c.id, { actual: bankSums.find(b => b.category_id === c.id)!.total }))
      )
      setCategories(prev => prev.map(c => updated.find(u => u.id === c.id) ?? c))
      toast(`Updated ${updated.length} ${updated.length === 1 ? 'category' : 'categories'} from bank`, 'success')
    } catch {
      toast('Failed to sync — please try again', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const overBudget    = categories.filter(c => c.expected > 0 && c.actual > c.expected)
  const leftoverColor = leftover < 0
    ? 'var(--color-negative)'
    : leftover === 0 && totalIncome > 0
      ? 'var(--color-positive)'
      : totalIncome > 0
        ? 'var(--color-warning)'
        : 'var(--color-foreground)'
  const leftToSpendColor = leftToSpend < 0 && totalIncome > 0
    ? 'var(--color-negative)'
    : totalIncome > 0
      ? 'var(--color-positive)'
      : 'var(--color-foreground)'
  const trendMonths   = getPastMonths(month, 6)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-[20px] font-medium mb-5" style={{ color: 'var(--color-foreground)' }}>
        Budget
      </h1>

      {error ? (
        <p className="text-[13px]" style={{ color: 'var(--color-negative)' }}>{error}</p>
      ) : loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <>
          {/* Month nav */}
          <div className="flex items-center gap-2 mb-5">
            <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(shiftMonth(month, -1))}>←</Button>
            <span className="text-[13px] min-w-[100px] text-center" style={{ color: 'var(--color-foreground-secondary)' }}>
              {formatMonthLabel(month)}
            </span>
            <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(shiftMonth(month, 1))}>→</Button>
          </div>

          {/* Over-budget warning */}
          {overBudget.length > 0 && (
            <div className="rounded-xl px-5 py-4 mb-5" style={{ background: 'var(--color-negative-subtle)' }}>
              <p className="text-[13px] font-medium mb-2" style={{ color: 'var(--color-negative)' }}>
                Over budget on {overBudget.length} {overBudget.length === 1 ? 'category' : 'categories'}
              </p>
              {overBudget.map(c => (
                <div key={c.id} className="flex items-center py-1">
                  <span className="flex-1 text-[12px]" style={{ color: 'var(--color-negative)' }}>{c.name}</span>
                  <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--color-negative)' }}>
                    +{fmtWhole(c.actual - c.expected)} over
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--color-foreground-secondary)' }}>Unallocated</p>
              <p className="text-[22px] font-medium tabular-nums" style={{ color: leftoverColor }}>
                {leftover < 0 ? '−' : ''}{fmtWhole(Math.abs(leftover))}
              </p>
              {leftover === 0 && totalIncome > 0 && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-positive)' }}>Every dollar allocated</p>
              )}
            </div>
            <div className="rounded-xl px-4 py-3" style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)' }}>
              <p className="text-[11px] mb-1" style={{ color: 'var(--color-foreground-secondary)' }}>
                {leftToSpend < 0 && totalIncome > 0 ? 'Over budget' : 'Left to spend'}
              </p>
              <p className="text-[22px] font-medium tabular-nums" style={{ color: leftToSpendColor }}>
                {leftToSpend < 0 && totalIncome > 0 ? '−' : ''}{fmtWhole(Math.abs(leftToSpend))}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
            <span>Income: {fmtWhole(totalIncome)}</span>
            <span>·</span>
            <span>Budgeted: {fmtWhole(totalBudgeted)}</span>
            {totalActual > 0 && <><span>·</span><span>Spent: {fmtWhole(totalActual)}</span></>}
          </div>
          {totalIncome > 0 && (
            <div className="mb-5">
              <ProgressBar value={Math.min(100, (totalBudgeted / totalIncome) * 100)} intent="primary" />
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-4 mb-5" role="tablist" aria-label="Budget sections">
            {TABS.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className="text-[13px] pb-1 transition-colors"
                style={{
                  color: tab === t.key ? 'var(--color-primary)' : 'var(--color-muted)',
                  borderBottom: tab === t.key ? '1px solid var(--color-primary)' : '1px solid transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'income' && (
            <IncomeTab month={month} incomes={incomes} setIncomes={setIncomes} owners={owners} />
          )}

          {tab === 'recurring' && (
            <RecurringTab recurrings={recurrings} setRecurrings={setRecurrings} onChanged={() => load()} />
          )}

          {tab === 'spending' && (
            <>
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>
                    Budget categories
                  </p>
                  {hasBankSums && (
                    <button
                      type="button"
                      onClick={handleSyncActuals}
                      disabled={syncing}
                      className="text-[11px] disabled:opacity-40"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      {syncing ? 'Syncing…' : 'Sync from bank'}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pb-2 mb-1" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
                  <span className="flex-1 text-[11px]" style={{ color: 'var(--color-muted)' }}>Category</span>
                  <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Expected</span>
                  <span className="w-[88px] text-[11px] text-right" style={{ color: 'var(--color-muted)' }}>Actual</span>
                  <span className="w-5" />
                </div>

                {categories.length === 0 ? (
                  <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>
                    No categories yet — add one below to get started.
                  </p>
                ) : (
                  <>
                    {flexible.map(c => (
                      <BudgetCategoryRow
                        key={c.id} category={c}
                        onUpdate={handleUpdateField} onDelete={handleDelete}
                      />
                    ))}
                    {fixed.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 pt-3 pb-1">
                          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Fixed bills</span>
                          <span className="text-[11px] ml-auto" style={{ color: 'var(--color-muted)' }}>edit in Recurring</span>
                        </div>
                        {fixed.map(c => (
                          <BudgetCategoryRow
                            key={c.id} category={c} fixed
                            onUpdate={handleUpdateField} onDelete={handleDelete}
                          />
                        ))}
                      </>
                    )}
                    <div className="flex items-center gap-2 pt-3 mt-1" style={{ borderTop: '0.5px solid var(--color-border)' }}>
                      <span className="flex-1 text-[12px] font-medium" style={{ color: 'var(--color-foreground)' }}>Total</span>
                      <span className="w-[88px] text-[12px] font-medium tabular-nums text-right" style={{ color: 'var(--color-foreground)' }}>{fmtWhole(totalBudgeted)}</span>
                      <span className="w-[88px] text-[12px] font-medium tabular-nums text-right" style={{ color: 'var(--color-foreground)' }}>{fmtWhole(totalActual)}</span>
                      <span className="w-5" />
                    </div>
                  </>
                )}

                {/* Add category */}
                <div className="mt-4 pt-4" style={{ borderTop: '0.5px solid var(--color-border)' }}>
                  <form onSubmit={e => { e.preventDefault(); handleAddCategory(newName) }} className="flex gap-2">
                    <input
                      value={newName} onChange={e => setNewName(e.target.value)}
                      placeholder="Category name" autoComplete="off"
                      className="flex-1 min-w-0 h-8 px-3 rounded-lg focus:outline-none transition-colors"
                      style={{ fontSize: '16px', background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }}
                    />
                    <Button type="submit" size="sm" disabled={!newName.trim() || addingCat}>Add</Button>
                  </form>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {DEFAULT_CATEGORIES
                      .filter(n => !categories.find(c => c.name.toLowerCase() === n.toLowerCase()))
                      .map(n => (
                        <button
                          key={n} type="button" onClick={() => handleAddCategory(n)}
                          className="px-2 py-[3px] rounded-md text-[11px] transition-opacity hover:opacity-80"
                          style={{ background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}
                        >
                          {n}
                        </button>
                      ))}
                  </div>
                </div>
              </Card>

              {/* Spending trends */}
              {categories.length > 0 && (
                <div className="mt-8">
                  <button
                    className="flex items-center gap-2 text-[13px] mb-4"
                    style={{ color: 'var(--color-foreground-secondary)' }}
                    onClick={() => setShowTrends(t => !t)}
                  >
                    <span>{showTrends ? '▾' : '▸'}</span>
                    Spending trends
                  </button>
                  {showTrends && (
                    <div className="flex flex-col gap-6">
                      {categories
                        .filter(c => c.expected > 0)
                        .map(c => {
                          const data = buildTrendPoints(c.name, trendMonths, pastCategories)
                          if (!data.some(d => d.actual > 0)) return null
                          return (
                            <div key={c.id}>
                              <p className="text-[12px] mb-2" style={{ color: 'var(--color-muted)' }}>{c.name}</p>
                              <SpendingTrendChart data={data} currentMonth={month} />
                            </div>
                          )
                        })
                        .filter(Boolean)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function BudgetCategoryRow({
  category, onUpdate, onDelete, fixed = false,
}: {
  category: BudgetCategory
  onUpdate: (id: string, field: 'expected' | 'actual' | 'name', raw: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  fixed?: boolean
}) {
  const [exp, setExp] = useState(String(category.expected))
  const [act, setAct] = useState(String(category.actual))
  const [savingField,    setSavingField]    = useState<'expected' | 'actual' | null>(null)
  const [savedField,     setSavedField]     = useState<'expected' | 'actual' | null>(null)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [editingName,  setEditingName]  = useState(false)
  const [draftName,    setDraftName]    = useState(category.name)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setExp(String(category.expected)) }, [category.expected])
  useEffect(() => { setAct(String(category.actual))   }, [category.actual])
  useEffect(() => { setDraftName(category.name) }, [category.name])

  async function handleSave(field: 'expected' | 'actual', raw: string) {
    const val = parseFloat(raw)
    if (isNaN(val) || val < 0) return
    setSavingField(field)
    try {
      await onUpdate(category.id, field, raw)
      setSavedField(field)
      setTimeout(() => setSavedField(null), 1200)
    } finally {
      setSavingField(null)
    }
  }

  async function handleNameSave() {
    const trimmed = draftName.trim()
    setEditingName(false)
    if (!trimmed || trimmed === category.name) return
    await onUpdate(category.id, 'name', trimmed)
  }

  const isOver  = category.expected > 0 && category.actual > category.expected
  const pct     = category.expected > 0 ? Math.min(100, (category.actual / category.expected) * 100) : 0

  const numInput = 'h-7 px-2 rounded-md tabular-nums text-right focus:outline-none transition-colors'

  function fieldBorder(field: 'expected' | 'actual') {
    if (savedField === field) return 'var(--color-positive)'
    if (field === 'actual' && isOver) return 'var(--color-negative)'
    return 'var(--color-border)'
  }

  const baseStyle = { fontSize: '16px', background: 'var(--color-background)', color: 'var(--color-foreground)' }

  return (
    <div className="flex flex-col group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <div className="flex items-center gap-2 py-2">
        {!fixed && editingName ? (
          <input
            ref={nameInputRef}
            value={draftName}
            onChange={e => setDraftName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') { setDraftName(category.name); setEditingName(false) }
            }}
            className="flex-1 text-[13px] bg-transparent border-b outline-none min-w-0"
            style={{ color: 'var(--color-foreground)', borderColor: 'var(--color-primary)', fontSize: '16px' }}
          />
        ) : (
          <span
            className="flex-1 text-[13px] truncate"
            style={{ color: 'var(--color-foreground)', cursor: fixed ? 'default' : 'pointer' }}
            onClick={fixed ? undefined : () => {
              setEditingName(true)
              setTimeout(() => nameInputRef.current?.select(), 0)
            }}
          >
            {category.name}
          </span>
        )}
        {fixed ? (
          <span className="w-[88px] h-7 flex items-center justify-end text-[13px] tabular-nums" style={{ color: 'var(--color-foreground-secondary)' }}>
            {fmtWhole(category.expected)}
          </span>
        ) : (
          <input
            type="number" min="0" step="0.01" value={exp}
            onChange={e => setExp(e.target.value)}
            onBlur={e => handleSave('expected', e.target.value)}
            className={`w-[88px] ${numInput}`}
            style={{ ...baseStyle, border: `0.5px solid ${fieldBorder('expected')}`, transition: 'border-color 0.4s ease' }}
          />
        )}
        <input
          type="number" min="0" step="0.01" value={act}
          onChange={e => setAct(e.target.value)}
          onBlur={e => handleSave('actual', e.target.value)}
          className={`w-[88px] ${numInput}`}
          style={{
            ...baseStyle,
            border: `0.5px solid ${fieldBorder('actual')}`,
            color: isOver ? 'var(--color-negative)' : 'var(--color-foreground)',
            transition: 'border-color 0.4s ease',
          }}
        />
        {fixed ? (
          <span className="w-5" />
        ) : confirmDelete ? (
          <div className="flex items-center gap-1.5 ml-1">
            <button type="button" onClick={() => onDelete(category.id)} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-negative-subtle)', color: 'var(--color-negative)' }}>Delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Cancel</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Delete ${category.name}`}
            style={{ color: 'var(--color-muted)' }}
          >×</button>
        )}
      </div>
      {isOver && (
        <p className="text-[11px] pb-1 text-right" style={{ color: 'var(--color-negative)' }}>
          +{fmtWhole(category.actual - category.expected)} over
        </p>
      )}
      {category.expected > 0 && (
        <div className="pb-2 flex items-center gap-2">
          <div className="flex-1">
            <ProgressBar value={pct} intent={isOver ? 'negative' : 'primary'} />
          </div>
          <span
            className="text-[10px] tabular-nums flex-shrink-0 w-7 text-right"
            style={{ color: isOver ? 'var(--color-negative)' : 'var(--color-muted)' }}
          >
            {Math.round(pct)}%
          </span>
        </div>
      )}
    </div>
  )
}
