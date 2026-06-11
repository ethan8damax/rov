export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function shiftMonth(m: string, delta: 1 | -1): string {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function formatMonthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function fmt(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtWhole(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? ''
  if (!msg) return 'Something went wrong. Please try again.'
  if (/violated|constraint|duplicate|JSON object requested|multiple.*rows|no rows|syntax error|relation|column|schema|pgrst|supabase|postgres/i.test(msg)) {
    return 'Something went wrong. Please try again.'
  }
  return msg
}

export function getPastMonths(currentMonth: string, count: number): string[] {
  const months: string[] = []
  let [y, mo] = currentMonth.split('-').map(Number)
  for (let i = 0; i < count; i++) {
    months.unshift(`${y}-${pad(mo)}`)
    mo -= 1
    if (mo === 0) { mo = 12; y -= 1 }
  }
  return months
}
