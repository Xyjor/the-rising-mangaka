import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import type { IconName } from './Icon'

const ICON: Record<string, IconName> = {
  info: 'info', success: 'check', warn: 'alert', money: 'yen', levelup: 'star', series: 'book', staff: 'people', trip: 'map',
  event: 'sparkle',
}

function ToastItem({ id, kind, text }: { id: number; kind: string; text: string }) {
  const dismiss = useStore((s) => s.dismissToast)
  // Hovering or focusing a toast holds it open; the timer restarts once the pointer leaves.
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (held) return
    const t = window.setTimeout(() => dismiss(id), 5500)
    return () => window.clearTimeout(t)
  }, [id, dismiss, held])
  return (
    <div
      className="toast"
      data-kind={kind}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <span className="ico"><Icon name={ICON[kind] ?? 'info'} /></span>
      <span>{text}</span>
      <button onClick={() => dismiss(id)} aria-label="Dismiss"><Icon name="close" size={14} /></button>
    </div>
  )
}

/** The live region is always mounted so screen readers announce the first toast too. */
export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts" role="status" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => <ToastItem key={t.id} {...t} />)}
    </div>
  )
}
