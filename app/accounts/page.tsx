'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/context/auth'
import { getTransactions } from '@/lib/queries/accounts'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import { getBudgetCategories, getIncomeSources } from '@/lib/queries/finance'
import { currentMonth, shiftMonth, formatMonthLabel } from '@/lib/utils'
import type { AccountWithBalance, BudgetCategory, IncomeSource } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PlaidLinkButton from '@/components/accounts/PlaidLinkButton'
import AccountCard from '@/components/accounts/AccountCard'
import TransactionList from '@/components/accounts/TransactionList'
import TriageSection from '@/components/accounts/TriageSection'
import { useToast } from '@/components/ui/Toast'

export default function AccountsPage() {
  const { householdId } = useAuth()
  const { toast } = useToast()
  const [month,         setMonth]         = useState(() => currentMonth())
  const [accounts,      setAccounts]      = useState<AccountWithBalance[]>([])
  const [transactions,  setTransactions]  = useState<TransactionWithCategory[]>([])
  const [categories,    setCategories]    = useState<BudgetCategory[]>([])
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [loadingAcct,   setLoadingAcct]   = useState(true)
  const [loadingTx,     setLoadingTx]     = useState(true)
  const [syncing,       setSyncing]       = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [resolvedIds,   setResolvedIds]   = useState<Set<string>>(new Set())
  const [page,          setPage]          = useState(1)
  const [pullIndicator, setPullIndicator] = useState(false)
  const PAGE_SIZE  = 10
  const pullStartY = useRef(0)
  const isPulling  = useRef(false)

  const loadAccounts = useCallback(async () => {
    setLoadingAcct(true)
    try {
      const res  = await fetch('/api/plaid/accounts')
      const data = await res.json()
      setAccounts(data.accounts ?? [])
    } catch {
      setError('Failed to load accounts')
    } finally {
      setLoadingAcct(false)
    }
  }, [])

  const loadTransactions = useCallback(async () => {
    if (!householdId) return
    setLoadingTx(true)
    try {
      const [txs, cats, srcs] = await Promise.all([
        getTransactions(householdId, month),
        getBudgetCategories(month),
        getIncomeSources(month),
      ])
      setTransactions(txs)
      setCategories(cats)
      setIncomeSources(srcs)
    } catch {
      setError('Failed to load transactions')
    } finally {
      setLoadingTx(false)
    }
  }, [householdId, month])

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { loadTransactions() }, [loadTransactions])

  useEffect(() => {
    setPage(1)
    setResolvedIds(new Set())
  }, [month])

  useEffect(() => {
    const THIRTY_MIN = 30 * 60 * 1000
    const last = localStorage.getItem('rov-last-sync')
    if (!last || Date.now() - Number(last) > THIRTY_MIN) {
      handleSync()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      pullStartY.current = e.touches[0].clientY
      isPulling.current  = false
    }
    function onTouchMove(e: TouchEvent) {
      if (window.scrollY !== 0) return
      const delta = e.touches[0].clientY - pullStartY.current
      if (delta > 60) {
        isPulling.current = true
        setPullIndicator(true)
      }
    }
    function onTouchEnd() {
      if (isPulling.current && !syncing) handleSync()
      isPulling.current = false
      setPullIndicator(false)
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: true })
    window.addEventListener('touchend',   onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncing])

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const res  = await fetch('/api/plaid/transactions')
      const data = await res.json()
      const count = data.synced ?? 0
      localStorage.setItem('rov-last-sync', String(Date.now()))
      toast(count === 0 ? 'Already up to date' : `Synced ${count} new transaction${count !== 1 ? 's' : ''}`, 'success')
      await loadTransactions()
    } catch {
      setError('Sync failed — please try again')
    } finally {
      setSyncing(false)
    }
  }

  function handleConnected() {
    loadAccounts()
    loadTransactions()
  }

  function handleResolved(id: string) {
    setResolvedIds(prev => new Set([...prev, id]))
  }

  function addCategory(cat: BudgetCategory) {
    setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const now = currentMonth()

  const accountGroups = (() => {
    const checking   = accounts.filter(a => a.type === 'depository')
    const investment = accounts.filter(a => a.type === 'investment')
    const credit     = accounts.filter(a => a.type === 'credit')
    const other      = accounts.filter(a => !['depository', 'investment', 'credit'].includes(a.type))
    return [
      { label: 'Checking & savings', accounts: checking },
      { label: 'Investments',        accounts: investment },
      { label: 'Credit cards',       accounts: credit },
      { label: 'Other',              accounts: other },
    ].filter(g => g.accounts.length > 0)
  })()

  const uncategorized = transactions.filter(
    t => !t.category_id && !t.income_source_id && !t.is_pending && !t.is_ignored && !resolvedIds.has(t.id)
  )
  const totalPages = Math.ceil(transactions.length / PAGE_SIZE)
  const pagedTxs   = transactions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" style={{ overscrollBehaviorY: 'contain' }}>
      {pullIndicator && (
        <p className="text-center text-[11px] py-1 mb-2" style={{ color: 'var(--color-muted)' }}>
          Release to sync
        </p>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          Accounts
        </h1>
        <div className="flex items-center gap-2">
          {accounts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync'}
            </Button>
          )}
          <PlaidLinkButton onConnected={handleConnected} />
        </div>
      </div>

      {error && (
        <p className="text-[13px] mb-4" style={{ color: 'var(--color-negative)' }}>{error}</p>
      )}

      {loadingAcct ? (
        <div className="flex flex-col gap-2 mb-6">
          {[0, 1].map(i => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--color-surface)' }} />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="mb-6">
          <p className="text-[13px]" style={{ color: 'var(--color-muted)' }}>
            No banks connected yet. Connect your first account to see live balances and your transaction history.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5 mb-6">
          {accountGroups.map(group => (
            <div key={group.label}>
              <p className="text-[11px] font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
                {group.label}
              </p>
              <div className="flex flex-col gap-2">
                {group.accounts.map(acct => (
                  <AccountCard
                    key={acct.account_id}
                    account={acct}
                    onDisconnected={() => { loadAccounts(); loadTransactions() }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div id="transactions" className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          Transactions
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(m => shiftMonth(m, -1))}>←</Button>
          <span className="text-[13px] min-w-[100px] text-center" style={{ color: 'var(--color-foreground-secondary)' }}>
            {formatMonthLabel(month)}
          </span>
          <Button size="sm" variant="ghost" intent="neutral" onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={month >= now}>→</Button>
        </div>
      </div>

      {householdId && (
        <>
          <TriageSection
            transactions={uncategorized}
            categories={categories}
            incomeSources={incomeSources}
            householdId={householdId}
            month={month}
            onCategoryCreated={addCategory}
            onResolved={handleResolved}
          />

          <TransactionList
            transactions={pagedTxs}
            categories={categories}
            incomeSources={incomeSources}
            householdId={householdId}
            month={month}
            loading={loadingTx}
            onCategoryCreated={addCategory}
          />

          {totalPages > 1 && (
            <div
              className="flex items-center justify-between mt-4 pt-3"
              style={{ borderTop: '0.5px solid var(--color-border)' }}
            >
              <Button
                variant="ghost"
                size="sm"
                intent="neutral"
                disabled={page === 1}
                onClick={() => {
                  setPage(p => p - 1)
                  document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                ← Previous
              </Button>
              <span className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                intent="neutral"
                disabled={page === totalPages}
                onClick={() => {
                  setPage(p => p + 1)
                  document.getElementById('transactions')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
