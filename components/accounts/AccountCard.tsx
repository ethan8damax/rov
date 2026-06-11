'use client'

import { useState, useRef } from 'react'
import type { AccountWithBalance } from '@/types'
import { fmt } from '@/lib/utils'
import { updateAccountName } from '@/lib/queries/accounts'

interface AccountCardProps {
  account:          AccountWithBalance
  onDisconnected?:  () => void
}

function typeLabel(type: string, subtype: string): string {
  const label = subtype || type
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, ' ')
}

export default function AccountCard({ account, onDisconnected }: AccountCardProps) {
  const [name,         setName]         = useState(account.name)
  const [editing,      setEditing]      = useState(false)
  const [draft,        setDraft]        = useState(account.name)
  const [disconnecting, setDisconnecting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const balance  = account.balances.current ?? account.balances.available
  const isCredit = account.type === 'credit'

  async function handleDisconnect() {
    if (!window.confirm(`Disconnect ${name}? This will remove all transactions from this bank.`)) return
    setDisconnecting(true)
    try {
      await fetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: account.account_id }),
      })
      onDisconnected?.()
    } finally {
      setDisconnecting(false)
    }
  }

  function startEdit() {
    setDraft(name)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitRename() {
    const trimmed = draft.trim()
    setEditing(false)
    if (!trimmed || trimmed === name) return
    setName(trimmed)
    try {
      await updateAccountName(account.account_id, trimmed)
    } catch {
      setName(name) // revert on failure
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-3"
      style={{
        background:   'var(--color-surface)',
        border:       '0.5px solid var(--color-border)',
        borderRadius: '12px',
      }}
    >
      <div className="flex-1 min-w-0 mr-3">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            className="text-[13px] font-medium w-full bg-transparent outline-none border-b"
            style={{
              color:       'var(--color-foreground)',
              borderColor: 'var(--color-primary)',
              fontSize:    '16px',
            }}
          />
        ) : (
          <button
            onClick={startEdit}
            className="text-left w-full"
            title="Click to rename"
          >
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
              {name}
              {account.mask && (
                <span style={{ color: 'var(--color-muted)' }}> ···{account.mask}</span>
              )}
            </p>
          </button>
        )}
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {account.institution_name} · {typeLabel(account.type, account.subtype)}
          {' · '}
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="underline disabled:opacity-40"
            style={{ color: 'var(--color-muted)' }}
          >
            {disconnecting ? 'Removing…' : 'Remove'}
          </button>
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        {balance != null ? (
          <p
            className="text-[15px] font-medium tabular-nums"
            style={{ color: isCredit ? 'var(--color-negative)' : 'var(--color-foreground)' }}
          >
            {isCredit && balance > 0 ? '−' : ''}{fmt(Math.abs(balance))}
          </p>
        ) : (
          <p className="text-[13px]" style={{ color: 'var(--color-muted)' }}>—</p>
        )}
        {!isCredit && account.balances.available != null && (
          <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
            {fmt(account.balances.available)} available
          </p>
        )}
      </div>
    </div>
  )
}
