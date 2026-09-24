import { useState } from 'react'

/** A button that arms an inline confirm instead of a browser dialog. */
export function ConfirmRow({ label, confirmLabel, cancelLabel = 'Cancel', onConfirm, className = 'btn sm', hint }: {
  label: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  className?: string
  hint?: string
}) {
  const [armed, setArmed] = useState(false)
  if (!armed) return <button className={className} onClick={() => setArmed(true)}>{label}</button>
  return (
    <div className="row wrap">
      {hint && <span className="tiny muted">{hint}</span>}
      <button className="btn ghost sm" onClick={() => setArmed(false)}>{cancelLabel}</button>
      <button className="btn primary sm" onClick={onConfirm}>{confirmLabel}</button>
    </div>
  )
}
