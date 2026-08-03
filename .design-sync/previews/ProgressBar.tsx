import ProgressBar from 'rov/components/ui/ProgressBar'

export function Intents() {
  return (
    <div className="flex flex-col gap-3 w-[240px]">
      <ProgressBar value={65} intent="primary" />
      <ProgressBar value={40} intent="positive" />
      <ProgressBar value={92} intent="negative" />
      <ProgressBar value={20} intent="neutral" />
    </div>
  )
}

export function Values() {
  return (
    <div className="flex flex-col gap-3 w-[240px]">
      <ProgressBar value={0} />
      <ProgressBar value={50} />
      <ProgressBar value={100} />
    </div>
  )
}
