import { type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost'
type Intent  = 'primary' | 'positive' | 'negative' | 'neutral'
type Size    = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  intent?:  Intent
  size?:    Size
}

const intentVar: Record<Intent, string> = {
  primary:  'var(--color-primary)',
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  neutral:  'var(--color-foreground)',
}

export default function Button({
  variant = 'primary', intent = 'primary', size = 'md',
  className = '', children, style, ...props
}: ButtonProps) {
  const color = intentVar[intent]
  const sizeClass = size === 'sm' ? 'h-7 px-3 text-[12px]' : 'h-9 px-4 text-[13px]'
  const base = 'inline-flex items-center justify-center rounded-lg font-normal transition-opacity disabled:opacity-40 cursor-pointer'

  return (
    <button
      className={`${base} ${sizeClass} ${className}`}
      style={{
        ...(variant === 'primary' ? { background: color, color: '#fff' } : { color, background: 'transparent' }),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}
