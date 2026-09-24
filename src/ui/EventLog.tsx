import { useState } from 'react'
import { describeDate } from '../sim'
import { useStore } from '../state/store'

export function EventLog() {
  const log = useStore((s) => s.game?.log ?? [])
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
        {entries.map((e) => {
          const d = describeDate(e.day)
          return (
            <li key={e.id} data-kind={e.kind}>
              <span className="dot" aria-hidden />
              <span className="day">Y{d.year} M{d.month} W{d.week} D{d.day}</span>
              <span>{e.text}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
