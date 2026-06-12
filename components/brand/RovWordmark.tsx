export default function RovWordmark() {
  return (
    <div className="flex items-center gap-2.5 mb-8">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--color-primary-subtle)' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 512 512" className="w-4 h-4">
          <path
            d="M155 171h158q44 0 44 44v126"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="52"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="font-serif text-[20px]" style={{ color: 'var(--color-foreground)' }}>
        Rov
      </span>
    </div>
  )
}
