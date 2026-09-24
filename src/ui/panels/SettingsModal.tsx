import { Fragment, useState } from 'react'
import { useStore } from '../../state/store'
import { Modal } from '../components'

const KEYS: [string, string][] = [
  ['Space', 'Pause or resume'], ['1 2 3', 'Speed'], ['N', 'New manga'], ['M', 'Pitch to a magazine'],
  ['W', 'Draw'], ['R', 'Rest'], ['J', 'Part-time job'], ['B', 'Notebook'], ['S', 'Stats'], ['A', 'Staff'],
  ['T', 'Trips'], ['H', 'History'], ['Esc', 'Close'],
]

export function SettingsModal() {
  const closeModal = useStore((s) => s.closeModal)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const abandon = useStore((s) => s.abandonGame)
  const [confirm, setConfirm] = useState(false)

  return (
    <Modal title="Settings" onClose={closeModal} narrow>
      <div className="col" style={{ gap: 18 }}>
        <div className="row between">
          <span style={{ fontWeight: 800 }}>Appearance</span>
          <div className="seg sm">
            <button aria-pressed={theme === 'auto'} onClick={() => setTheme('auto')}>Auto</button>
            <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
            <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
          </div>
        </div>

        <section>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Keyboard</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 13 }}>
            {KEYS.map(([k, v]) => (
              <Fragment key={k}><span className="kbd">{k}</span><span className="muted">{v}</span></Fragment>
            ))}
          </div>
        </section>

        <div className="divider" />

        <div className="row between wrap">
          <div>
            <div style={{ fontWeight: 800 }}>Start over</div>
            <div className="tiny faint">Deletes this save. There is no undo.</div>
          </div>
          {confirm
            ? <div className="row"><button className="btn ghost sm" onClick={() => setConfirm(false)}>Keep playing</button><button className="btn primary sm" onClick={abandon}>Yes, delete save</button></div>
            : <button className="btn sm" onClick={() => setConfirm(true)}>New game…</button>}
        </div>
      </div>
    </Modal>
  )
}
