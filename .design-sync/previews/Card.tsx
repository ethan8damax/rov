import Card from 'rov/components/ui/Card'

export function Basic() {
  return (
    <Card className="w-[280px]">
      <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>
        Groceries
      </p>
      <p className="text-[12px] mt-1" style={{ color: 'var(--color-muted)' }}>
        $340 of $400 spent this month
      </p>
    </Card>
  )
}

export function WithAction() {
  return (
    <Card className="w-[280px] flex items-center justify-between">
      <div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--color-foreground)' }}>
          Vacation fund
        </p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--color-muted)' }}>
          $1,200 saved
        </p>
      </div>
      <span className="text-[12px]" style={{ color: 'var(--color-positive)' }}>+$150</span>
    </Card>
  )
}
