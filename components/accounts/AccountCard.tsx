'use client'

import { useState, useRef } from 'react'
import type { AccountWithBalance } from '@/types'
import { fmt } from '@/lib/utils'
import { updateAccountName } from '@/lib/queries/accounts'

interface AccountCardProps {
  account:         AccountWithBalance
  onDisconnected?: () => void
}

const INSTITUTION_COLORS: Record<string, string> = {
  'navy federal': '#003087',
  'chase':        '#117ACA',
  'discover':     '#F76D00',
  'bank of america': '#E31837',
  'wells fargo':  '#D71E28',
  'capital one':  '#004977',
  'american express': '#2E77BC',
  'citi':         '#003B8E',
  'us bank':      '#0C4DA2',
  'td bank':      '#34B233',
  'ally':         '#7030A0',
  'schwab':       '#00A9CE',
  'fidelity':     '#387E38',
  'vanguard':     '#8B0000',
}

function institutionColor(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, color] of Object.entries(INSTITUTION_COLORS)) {
    if (lower.includes(key)) return color
  }
  return 'var(--color-primary)'
}

function typeLabel(type: string, subtype: string): string {
  const label = subtype || type
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, ' ')
}

export default function AccountCard({ account, onDisconnected }: AccountCardProps) {
  const [name,              setName]              = useState(account.name)
  const [editing,           setEditing]           = useState(false)
  const [draft,             setDraft]             = useState(account.name)
  const [disconnecting,     setDisconnecting]     = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isCredit = account.type === 'credit'
  const balance  = isCredit
    ? account.balances.current ?? account.balances.available
    : account.balances.available ?? account.balances.current
  const dotColor = institutionColor(account.institution_name)
  const initial  = account.institution_name.charAt(0).toUpperCase()

  async function handleDisconnect() {
    setConfirmDisconnect(false)
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
      setName(name)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', borderRadius: '12px' }}
    >
      {/* Institution dot */}
      <div
        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-medium"
        style={{ background: dotColor, color: '#fff' }}
      >
        {initial}
      </div>

      <div className="flex-1 min-w-0 mr-3">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            className="text-[13px] font-medium w-full bg-transparent outline-none border-b"
            style={{ color: 'var(--color-foreground)', borderColor: 'var(--color-primary)', fontSize: '16px' }}
          />
        ) : (
          <button onClick={startEdit} className="text-left w-full" title="Click to rename">
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-foreground)' }}>
              {name}
              {account.mask && <span style={{ color: 'var(--color-muted)' }}> ···{account.mask}</span>}
            </p>
          </button>
        )}
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
          {account.institution_name} · {typeLabel(account.type, account.subtype)}
          {' · '}
          {confirmDisconnect ? (
            <>
              <button onClick={handleDisconnect} disabled={disconnecting} className="underline disabled:opacity-40" style={{ color: 'var(--color-negative)' }}>
                {disconnecting ? 'Removing…' : 'Confirm remove'}
              </button>
              {!disconnecting && (
                <button onClick={() => setConfirmDisconnect(false)} className="ml-2 underline" style={{ color: 'var(--color-muted)' }}>Cancel</button>
              )}
            </>
          ) : (
            <button onClick={() => setConfirmDisconnect(true)} className="underline" style={{ color: 'var(--color-muted)' }}>
              Remove
            </button>
          )}
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
      </div>
    </div>
  )
}
