import { useEffect } from 'react'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import type { IconName } from './Icon'

const ICON: Record<string, IconName> = {
  info: 'info', success: 'check', warn: 'alert', money: 'yen', levelup: 'star', series: 'book', staff: 'people', trip: 'map',
}

function ToastItem({ id, kind, text }: { id: number; kind: string; text: string }) {
  const dismiss = useStore((s) => s.dismissToast)
  useEffect(() => {
    const t = window.setTimeout(() => dismiss(id), 5500)
    return () => window.clearTimeout(t)
  }, [id, dismiss])
  return (
    <div className="toast" data-kind={kind} role="status">
      <span className="ico"><Icon name={ICON[kind] ?? 'info'} /></span>
      <span>{text}</span>
      <button onClick={() => dismiss(id)} aria-label="Dismiss"><Icon name="close" size={14} /></button>
    </div>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  if (!toasts.length) return null
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <ToastItem key={t.id} {...t} />)}
    </div>
  )
}
