import RovWordmark from 'rov/components/brand/RovWordmark'
import Card from 'rov/components/ui/Card'

// dark backdrop needed — the wordmark text uses --color-foreground (white in
// Rov's dark-first default) and the capture harness's page is plain white.
export function Standalone() {
  return (
    <div className="p-4 rounded-lg" style={{ background: 'var(--color-background)' }}>
      <RovWordmark />
    </div>
  )
}

export function InSidebar() {
  return (
    <Card className="w-[220px] p-4">
      <RovWordmark />
      <p className="text-[12px]" style={{ color: 'var(--color-muted)' }}>
        Rov — Hebrew for plenty
      </p>
    </Card>
  )
}
