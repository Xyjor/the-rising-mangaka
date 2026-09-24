import { useState } from 'react'
import { shortDate } from '../sim'
import { useStore } from '../state/store'

const EMPTY: never[] = []

export function EventLog() {
  const log = useStore((s) => s.game?.log ?? EMPTY)
  const [open, setOpen] = useState(false)
  const entries = open ? log.slice(-80).reverse() : log.slice(-1)

  return (
    <section className={`log ${open ? '' : 'collapsed'}`} aria-label="Studio log">
      <div className="log-head">
        <span className="small muted" style={{ fontWeight: 700 }}>Studio log</span>
        <button className="btn ghost sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide' : 'Show all'}
        </button>
      </div>
      <ul>
        {entries.map((e) => (
          <li key={e.id} data-kind={e.kind}>
            <span className="dot" aria-hidden />
            <span className="day">{shortDate(e.day, { week: true })}</span>
            <span>{e.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
