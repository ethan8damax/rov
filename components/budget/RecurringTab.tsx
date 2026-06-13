'use client'

import { useState, useEffect } from 'react'
import {
  createRecurringPayment, updateRecurringPaymentCascade, deleteRecurringPaymentCascade,
} from '@/lib/queries/finance'
import { fmtWhole } from '@/lib/utils'
import type { RecurringPayment } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

const inputCls = 'h-8 px-3 rounded-lg focus:outline-none transition-colors'
const inputStyle = { fontSize: '16px', background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }
const numCls = 'w-[88px] h-7 px-2 rounded-md tabular-nums text-right focus:outline-none transition-colors'

export default function RecurringTab({ recurrings, setRecurrings, onChanged }: {
  recurrings: RecurringPayment[]
  setRecurrings: React.Dispatch<React.SetStateAction<RecurringPayment[]>>
  onChanged: () => void
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
      onChanged()
    } finally { setAdding(false) }
  }

  async function handleUpdateAmount(id: string, amount: number) {
    const updated = await updateRecurringPaymentCascade(id, { amount })
    setRecurrings(prev => prev.map(r => r.id === id ? updated : r))
    onChanged()
  }

  async function handleDelete(id: string) {
    setRecurrings(prev => prev.filter(r => r.id !== id))
    await deleteRecurringPaymentCascade(id)
    onChanged()
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>Monthly bills</span>
        {total > 0 && <span className="text-[13px] font-medium tabular-nums" style={{ color: 'var(--color-foreground-secondary)' }}>{fmtWhole(total)}/mo</span>}
      </div>
      <p className="text-[12px] mb-3" style={{ color: 'var(--color-muted)' }}>
        Applies to every month. Each bill shows up under fixed bills in Spending.
      </p>
      {recurrings.length === 0 ? (
        <p className="text-[13px] py-2" style={{ color: 'var(--color-muted)' }}>No recurring payments yet — add bills you pay every month.</p>
      ) : recurrings.map(r => (
        <RecurringRow key={r.id} payment={r} onUpdateAmount={handleUpdateAmount} onDelete={handleDelete} />
      ))}
      <form onSubmit={handleAdd} className="flex gap-2 mt-4 pt-3" style={{ borderTop: '0.5px solid var(--color-border)' }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. Rent)" className={`flex-1 min-w-0 ${inputCls}`} style={inputStyle} />
        <input type="number" min="0.01" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="Amount" className={`w-[96px] ${inputCls}`} style={inputStyle} />
        <Button type="submit" size="sm" disabled={!newName.trim() || !(parseFloat(newAmount) > 0) || adding}>Add</Button>
      </form>
    </Card>
  )
}

function RecurringRow({ payment, onUpdateAmount, onDelete }: {
  payment: RecurringPayment
  onUpdateAmount: (id: string, amount: number) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [amt,           setAmt]           = useState(String(payment.amount))
  const [saved,         setSaved]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setAmt(String(payment.amount)) }, [payment.amount])

  async function handleSave(raw: string) {
    const val = parseFloat(raw)
    if (isNaN(val) || val <= 0 || val === payment.amount) return
    await onUpdateAmount(payment.id, val)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  return (
    <div className="flex items-center gap-2 py-2 group" style={{ borderBottom: '0.5px solid var(--color-border)' }}>
      <span className="flex-1 text-[13px]" style={{ color: 'var(--color-foreground)' }}>{payment.name}</span>
      <input
        type="number" min="0.01" step="0.01" value={amt}
        onChange={e => setAmt(e.target.value)}
        onBlur={e => handleSave(e.target.value)}
        className={numCls}
        style={{ fontSize: '16px', background: 'var(--color-background)', border: `0.5px solid ${saved ? 'var(--color-positive)' : 'var(--color-border)'}`, color: 'var(--color-foreground)', transition: 'border-color 0.4s ease' }}
      />
      {confirmDelete ? (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onDelete(payment.id)} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-negative-subtle)', color: 'var(--color-negative)' }}>Delete</button>
          <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Cancel</button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Delete ${payment.name}`}
          style={{ color: 'var(--color-muted)' }}
        >×</button>
      )}
    </div>
  )
}
