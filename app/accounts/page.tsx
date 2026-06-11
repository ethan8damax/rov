'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/context/auth'
import { getTransactions } from '@/lib/queries/accounts'
import type { TransactionWithCategory } from '@/lib/queries/accounts'
import { getBudgetCategories } from '@/lib/queries/finance'
import { currentMonth, shiftMonth, formatMonthLabel } from '@/lib/utils'
import type { AccountWithBalance, BudgetCategory } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import PlaidLinkButton from '@/components/accounts/PlaidLinkButton'
import AccountCard from '@/components/accounts/AccountCard'
import TransactionList from '@/components/accounts/TransactionList'

export default function AccountsPage() {
  const { householdId } = useAuth()
  const [month,        setMonth]        = useState(() => currentMonth())
  const [accounts,     setAccounts]     = useState<AccountWithBalance[]>([])
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([])
  const [categories,   setCategories]   = useState<BudgetCategory[]>([])
  const [loadingAcct,  setLoadingAcct]  = useState(true)
  const [loadingTx,    setLoadingTx]    = useState(true)
  const [syncing,      setSyncing]      = useState(false)
  const [syncMsg,      setSyncMsg]      = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)

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
      const [txs, cats] = await Promise.all([
        getTransactions(householdId, month),
        getBudgetCategories(month),
      ])
      setTransactions(txs)
      setCategories(cats)
    } catch {
      setError('Failed to load transactions')
    } finally {
      setLoadingTx(false)
    }
  }, [householdId, month])

  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { loadTransactions() }, [loadTransactions])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    setError(null)
    try {
      const res  = await fetch('/api/plaid/transactions')
      const data = await res.json()
      setSyncMsg(`Synced ${data.synced ?? 0} new transactions`)
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

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
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
      {syncMsg && (
        <p className="text-[13px] mb-4" style={{ color: 'var(--color-positive)' }}>{syncMsg}</p>
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

      {/* Transactions section with month nav */}
      <div className="flex items-center justify-between mb-3">
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
        <TransactionList
          transactions={transactions}
          categories={categories}
          householdId={householdId}
          month={month}
          loading={loadingTx}
          onCategoryCreated={cat => setCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}
    </div>
  )
}
