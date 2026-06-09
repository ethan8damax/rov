import type { HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement>

export default function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--border-radius-lg)',
      }}
      {...props}
    >
      {children}
    </div>
  )
}
