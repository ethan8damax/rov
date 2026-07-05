import { formatMonthLabel, fmtWhole } from '@/lib/utils'
import type { BudgetCategory, SavingsPod } from '@/types'

interface MonthSummaryPrintProps {
  month: string
  ownerNames: string[]
  totalIncome: number
  totalBudgeted: number
  totalActual: number
  leftover: number
  leftToSpend: number
  categories: BudgetCategory[]
  pastCategories: BudgetCategory[]
  pastMonths: string[]
  pods: SavingsPod[]
}

const ink = { color: '#1a1a1a' }
const muted = { color: '#6b7280' }
const border = { borderColor: '#dce4f0' }
const positive = '#2d9e6b'
const negative = '#e8553a'
const primary = '#3b6ef8'
const harvest = '#9c7b3c'

function Bar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className="w-full" style={{ height: '5px', background: '#ece9e3', borderRadius: '99px' }}>
      <div style={{ height: '100%', width: `${clamped}%`, background: color, borderRadius: '99px' }} />
    </div>
  )
}

// Categories over budget in >=2 of the last 3 prior months — worth raising next month.
function recurringOverspends(categories: BudgetCategory[], pastCategories: BudgetCategory[], recentMonths: string[]) {
  return categories
    .filter(c => c.expected > 0)
    .map(c => {
      const hits = recentMonths.filter(m =>
        pastCategories.some(p => p.month === m && p.name.toLowerCase() === c.name.toLowerCase() && p.actual > p.expected && p.expected > 0)
      ).length
      return { category: c, hits }
    })
    .filter(x => x.hits >= 2)
}

export default function MonthSummaryPrint({
  month, ownerNames, totalIncome, totalBudgeted, totalActual, leftover, leftToSpend,
  categories, pastCategories, pastMonths, pods,
}: MonthSummaryPrintProps) {
  const overBudget = categories.filter(c => c.expected > 0 && c.actual > c.expected)
    .sort((a, b) => (b.actual - b.expected) - (a.actual - a.expected))
  const underspent = categories.filter(c => c.expected > 0 && c.expected - c.actual > 50)
    .sort((a, b) => (b.expected - b.actual) - (a.expected - a.actual))
    .slice(0, 3)
  const recentMonths = pastMonths.filter(m => m !== month).slice(-3)
  const recurring = recurringOverspends(categories, pastCategories, recentMonths)
  const totalAllotted = pods.reduce((s, p) => s + p.allotted, 0)
  const totalGoal = pods.reduce((s, p) => s + p.goal, 0)
  const maxTotal = Math.max(totalIncome, totalBudgeted, totalActual, 1)

  const suggestions: string[] = []
  recurring.forEach(({ category }) =>
    suggestions.push(`"${category.name}" has gone over budget ${recurring.find(r => r.category.id === category.id)!.hits} of the last 3 months — consider raising it from ${fmtWhole(category.expected)}.`)
  )
  if (leftToSpend < 0) {
    const worst = overBudget[0]
    suggestions.push(`You're ${fmtWhole(Math.abs(leftToSpend))} over for the month${worst ? ` — "${worst.name}" is the biggest overage` : ''}.`)
  }
  if (leftover > 0) {
    suggestions.push(`${fmtWhole(leftover)} of income is unallocated — assign it to a category or a savings pod.`)
  }
  if (suggestions.length === 0) {
    suggestions.push('Nothing needs attention — the plan is on track.')
  }

  return (
    <div className="hidden print:block" style={{ ...ink, fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '11px', lineHeight: 1.4 }}>
      <div className="flex items-baseline justify-between mb-4" style={{ borderBottom: '2px solid #1a1a1a', paddingBottom: '8px' }}>
        <div>
          <p style={{ fontSize: '18px', fontWeight: 500 }}>Month summary</p>
          <p style={{ ...muted, fontSize: '11px' }}>{formatMonthLabel(month)}{ownerNames.length > 0 ? ` · ${ownerNames.join(' & ')}` : ''}</p>
        </div>
        <p style={{ ...muted, fontSize: '10px' }}>Generated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
      </div>

      {/* Top metrics + at-a-glance bars */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Income', value: totalIncome, color: primary },
          { label: 'Budgeted', value: totalBudgeted, color: primary },
          { label: 'Spent', value: totalActual, color: totalActual > totalBudgeted ? negative : primary },
          { label: leftToSpend < 0 ? 'Over budget' : 'Left to spend', value: Math.abs(leftToSpend), color: leftToSpend < 0 ? negative : positive },
        ].map(m => (
          <div key={m.label} style={{ border: `0.5px solid #dce4f0`, borderRadius: '8px', padding: '8px 10px' }}>
            <p style={{ ...muted, fontSize: '9px', marginBottom: '4px' }}>{m.label}</p>
            <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '5px' }}>{fmtWhole(m.value)}</p>
            <Bar pct={(m.value / maxTotal) * 100} color={m.color} />
          </div>
        ))}
      </div>

      {/* Category table */}
      <p style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Categories</p>
      <div style={{ ...border, borderTop: '0.5px solid #dce4f0', borderBottom: '0.5px solid #dce4f0' }}>
        {categories.map(c => {
          const over = c.expected > 0 && c.actual > c.expected
          const pct = c.expected > 0 ? (c.actual / c.expected) * 100 : 0
          return (
            <div key={c.id} className="flex items-center gap-2" style={{ padding: '3px 0', borderBottom: '0.5px solid #ece9e3' }}>
              <span className="flex-1" style={{ fontSize: '10.5px' }}>{c.name}</span>
              <div style={{ width: '90px' }}><Bar pct={pct} color={over ? negative : primary} /></div>
              <span style={{ width: '110px', textAlign: 'right', fontSize: '10.5px', color: over ? negative : '#1a1a1a' }}>
                {fmtWhole(c.actual)} / {fmtWhole(c.expected)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-6 mt-4">
        {/* Worth discussing */}
        <div>
          <p style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Worth discussing</p>
          <ul style={{ fontSize: '10.5px', paddingLeft: '14px', listStyle: 'disc' }}>
            {overBudget.map(c => (
              <li key={c.id} style={{ color: negative, marginBottom: '2px' }}>
                {c.name} — {fmtWhole(c.actual - c.expected)} over
              </li>
            ))}
            {underspent.map(c => (
              <li key={c.id} style={{ marginBottom: '2px' }}>
                {c.name} — {fmtWhole(c.expected - c.actual)} left unspent
              </li>
            ))}
            {overBudget.length === 0 && underspent.length === 0 && (
              <li style={muted}>Everything tracked close to plan.</li>
            )}
          </ul>
        </div>

        {/* For next month */}
        <div>
          <p style={{ fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>For next month</p>
          <ul style={{ fontSize: '10.5px', paddingLeft: '14px', listStyle: 'disc' }}>
            {suggestions.map((s, i) => <li key={i} style={{ marginBottom: '2px' }}>{s}</li>)}
          </ul>
        </div>
      </div>

      {/* Savings goals */}
      {pods.length > 0 && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1">
            <p style={{ fontSize: '12px', fontWeight: 500 }}>Savings goals</p>
            <p style={{ ...muted, fontSize: '10px' }}>{fmtWhole(totalAllotted)} of {fmtWhole(totalGoal)} total</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {pods.map(p => (
              <div key={p.id}>
                <div className="flex items-baseline justify-between">
                  <span style={{ fontSize: '10.5px' }}>{p.name}</span>
                  <span style={{ ...muted, fontSize: '10px' }}>{fmtWhole(p.allotted)} / {fmtWhole(p.goal)}</span>
                </div>
                <Bar pct={p.goal > 0 ? (p.allotted / p.goal) * 100 : 0} color={harvest} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
