type Intent = 'primary' | 'positive' | 'negative' | 'neutral'

interface ProgressBarProps {
  value: number     // 0–100
  intent?: Intent
}

const intentColor: Record<Intent, string> = {
  primary:  'var(--color-primary)',
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  neutral:  'var(--color-muted)',
}

export default function ProgressBar({ value, intent = 'primary' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className="w-full"
      style={{ height: '6px', background: 'var(--color-border)', borderRadius: '99px' }}
    >
      <div
        style={{
          height: '100%',
          width: '100%',
          background: intentColor[intent],
          borderRadius: '99px',
          transform: `scaleX(${clamped / 100})`,
          transformOrigin: 'left',
          transition: 'transform 0.3s ease',
        }}
      />
    </div>
  )
}
