import Button from 'rov/components/ui/Button'

export function Variants() {
  return (
    <div className="flex items-center gap-3">
      <Button variant="primary">Save changes</Button>
      <Button variant="ghost">Cancel</Button>
    </div>
  )
}

export function Intents() {
  return (
    <div className="flex items-center gap-3">
      <Button intent="primary">Add category</Button>
      <Button intent="positive">Mark paid</Button>
      <Button intent="negative">Delete pod</Button>
      <Button intent="neutral" variant="ghost">Skip</Button>
    </div>
  )
}

export function Sizes() {
  return (
    <div className="flex items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
    </div>
  )
}

export function Disabled() {
  return (
    <div className="flex items-center gap-3">
      <Button disabled>Save changes</Button>
      <Button variant="ghost" disabled>Cancel</Button>
    </div>
  )
}
