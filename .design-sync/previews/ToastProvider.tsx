import { useEffect } from 'react'
import { ToastProvider, useToast } from 'rov'

// min-height matters: the capture harness gives fixed-position overlays a
// transformed ancestor as their containing block (CSS: `transform` on an
// ancestor redefines `position: fixed` to be relative to it, not the
// viewport). Without real height here, that ancestor shrinks to fit this
// line of text and the toast's `bottom-20` computes against a ~20px box —
// rendering off-screen instead of visible.
function Trigger({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) {
  const { toast } = useToast()
  useEffect(() => {
    toast(message, type, { duration: 60_000 })
  }, [])
  return (
    <div className="text-[12px]" style={{ color: 'var(--color-muted)', minHeight: '260px' }}>
      Toast shown below
    </div>
  )
}

export function Success() {
  return (
    <ToastProvider>
      <Trigger message="Category saved" type="success" />
    </ToastProvider>
  )
}

export function ErrorState() {
  return (
    <ToastProvider>
      <Trigger message="Couldn't connect to bank" type="error" />
    </ToastProvider>
  )
}

export function WithAction() {
  return (
    <ToastProvider>
      <UndoTrigger />
    </ToastProvider>
  )
}

function UndoTrigger() {
  const { toast } = useToast()
  useEffect(() => {
    toast('Carried over last month’s budget', 'info', {
      duration: 60_000,
      action: { label: 'Undo', onPress: () => {} },
    })
  }, [])
  return (
    <div className="text-[12px]" style={{ color: 'var(--color-muted)', minHeight: '260px' }}>
      Toast shown below
    </div>
  )
}
