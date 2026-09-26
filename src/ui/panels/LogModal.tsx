// The studio log, newest first. Opening it (and closing it) marks every entry as seen.
import { useEffect } from 'react'
import { shortDate } from '../../sim'
import { markLogSeen } from '../../state/clock'
import { useStore } from '../../state/store'
import { Modal } from '../components'

export function LogModal() {
  const log = useStore((s) => s.game!.log)
  const nextLogId = useStore((s) => s.game!.nextLogId)
  const closeModal = useStore((s) => s.closeModal)
  useEffect(() => {
    markLogSeen(nextLogId)
    return () => markLogSeen(nextLogId)
  }, [nextLogId])
  const entries = log.slice(-80).reverse()
  return (
    <Modal title="Studio log" narrow onClose={closeModal}>
      {entries.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <ul className="log-list" aria-label="Studio log entries">
          {entries.map((e) => (
            <li key={e.id} data-kind={e.kind}>
              <span className="dot" aria-hidden />
              <span className="day">{shortDate(e.day, { week: true })}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
