import MetricCard from 'rov/components/ui/MetricCard'

export function Neutral() {
  return <MetricCard label="Net worth" value="$48,210" sub="as of this month" />
}

export function Positive() {
  return <MetricCard label="Savings rate" value="+18%" sub="vs. last month" valueColor="var(--color-positive)" />
}

export function Negative() {
  return <MetricCard label="Over budget" value="-$212" sub="dining out" valueColor="var(--color-negative)" />
}

export function Row() {
  return (
    <div className="flex gap-3">
      <MetricCard label="Income" value="$6,400" />
      <MetricCard label="Expenses" value="$4,850" />
      <MetricCard label="Left to budget" value="$1,550" valueColor="var(--color-positive)" />
    </div>
  )
}
