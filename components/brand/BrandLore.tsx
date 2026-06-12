export default function BrandLore() {
  return (
    <div className="mt-10 pt-5" style={{ borderTop: '0.5px solid var(--color-border)' }}>
      <p className="font-serif text-[15px] mb-2" style={{ color: 'var(--color-foreground-secondary)' }}>
        Budget with purpose. Live in rov.
      </p>
      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-muted)' }}>
        <span dir="rtl" style={{ color: 'var(--color-harvest)' }}>רוב</span>{' '}(rov) — in ancient Hebrew, an
        overwhelming fullness. Not the anxiety of &ldquo;enough,&rdquo; but the confidence of
        plenty. Zero-based budgeting is an act of abundance thinking: every dollar gets a home,
        nothing is wasted, nothing is forgotten.
      </p>
    </div>
  )
}
