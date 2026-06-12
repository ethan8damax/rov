'use client'

import { useState, useEffect } from 'react'
import { createIncomeSource, updateIncomeSource, deleteIncomeSource } from '@/lib/queries/finance'
import { fmtWhole } from '@/lib/utils'
import type { IncomeSource } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

const inputCls = 'h-8 px-3 rounded-lg focus:outline-none transition-colors'
const inputStyle = { fontSize: '16px', background: 'var(--color-background)', border: '0.5px solid var(--color-border)', color: 'var(--color-foreground)' }
const numCls = 'w-[88px] h-7 px-2 rounded-md tabular-nums text-right focus:outline-none transition-colors'

export default function IncomeTab({ month, incomes, setIncomes, owners }: {
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
  const [exp,           setExp]           = useState(String(source.expected))
  const [act,           setAct]           = useState(String(source.actual))
  const [savedField,    setSavedField]    = useState<'expected' | 'actual' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
      {confirmDelete ? (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onDelete(source.id)} className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--color-negative-subtle)', color: 'var(--color-negative)' }}>Delete</button>
          <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirmDelete(true)} className="w-5 text-[16px] leading-none opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Delete ${source.name}`} style={{ color: 'var(--color-muted)' }}>×</button>
      )}
    </div>
  )
}
