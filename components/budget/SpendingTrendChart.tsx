'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface TrendPoint {
  month: string
  label: string
  actual: number
}

interface SpendingTrendChartProps {
  data: TrendPoint[]
  currentMonth: string
}

export function buildTrendPoints(
  categoryName: string,
  months: string[],
  allCategories: { name: string; month: string; actual: number }[],
): TrendPoint[] {
  return months.map(m => {
    const row = allCategories.find(
      c => c.month === m && c.name.toLowerCase() === categoryName.toLowerCase(),
    )
    const [y, mo] = m.split('-').map(Number)
    const label = new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short' })
    return { month: m, label, actual: row?.actual ?? 0 }
  })
}

export default function SpendingTrendChart({ data, currentMonth }: SpendingTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          cursor={false}
          contentStyle={{
            background:   'var(--color-surface)',
            border:       '0.5px solid var(--color-border)',
            borderRadius: '8px',
            fontSize:     '12px',
            color:        'var(--color-foreground)',
          }}
          formatter={(value) => [`$${Number(value ?? 0).toFixed(0)}`, 'Spent']}
        />
        <Bar dataKey="actual" radius={[3, 3, 0, 0]}>
          {data.map(entry => (
            <Cell
              key={entry.month}
              fill={entry.month === currentMonth
                ? 'var(--color-primary)'
                : 'var(--color-border)'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
