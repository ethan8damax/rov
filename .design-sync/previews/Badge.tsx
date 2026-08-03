import Badge from 'rov/components/ui/Badge'

export function Intents() {
  return (
    <div className="flex items-center gap-2">
      <Badge intent="primary">Recurring</Badge>
      <Badge intent="positive">On track</Badge>
      <Badge intent="negative">Over budget</Badge>
      <Badge intent="neutral">Uncategorized</Badge>
    </div>
  )
}

// Rov is dark-first (--color-foreground is white) and the capture harness's
// page background is plain white — an explicit dark backdrop is needed here
// or foreground-colored text renders invisibly (white-on-white).
export function InContext() {
  return (
    <div
      className="flex items-center gap-2 text-[13px] p-3 rounded-lg"
      style={{ color: 'var(--color-foreground)', background: 'var(--color-background)' }}
    >
      <span>Groceries</span>
      <Badge intent="negative">$60 over</Badge>
    </div>
  )
}
