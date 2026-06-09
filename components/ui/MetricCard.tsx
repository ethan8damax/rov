interface MetricCardProps {
  label: string
  value: string
  sub?: string
  valueColor?: string
}

export default function MetricCard({ label, value, sub, valueColor }: MetricCardProps) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ background: 'var(--color-surface)', borderRadius: 'var(--border-radius-md)' }}
    >
      <p className="text-[11px] mb-1" style={{ color: 'var(--color-muted)' }}>{label}</p>
      <p
        className="text-[16px] font-medium tabular-nums"
        style={{ color: valueColor ?? 'var(--color-foreground)' }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>{sub}</p>
      )}
    </div>
  )
}
