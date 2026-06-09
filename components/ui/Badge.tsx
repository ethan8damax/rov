type Intent = 'primary' | 'positive' | 'negative' | 'neutral'

interface BadgeProps {
  intent?: Intent
  children: React.ReactNode
}

const intentStyles: Record<Intent, { bg: string; color: string }> = {
  primary:  { bg: 'var(--color-primary-subtle)',  color: 'var(--color-primary)' },
  positive: { bg: 'var(--color-positive-subtle)', color: 'var(--color-positive)' },
  negative: { bg: 'var(--color-negative-subtle)', color: 'var(--color-negative)' },
  neutral:  { bg: 'var(--color-border)',          color: 'var(--color-foreground-secondary)' },
}

export default function Badge({ intent = 'neutral', children }: BadgeProps) {
  const { bg, color } = intentStyles[intent]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-normal"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  )
}
