import { Fragment } from 'react'
import { getSound } from '../../audio/instance'
import { isDesktop } from '../../platform/env'
import { useStore } from '../../state/store'
import { ConfirmRow } from '../ConfirmRow'
import { Icon } from '../Icon'
import { SaveFileSection } from '../SaveFileSection'
import { Modal } from '../components'

const KEYS: [string, string][] = [
  ['Space', 'Pause or resume'], ['1 2 3', 'Speed'], ['N', 'New manga'], ['M', 'Pitch to a magazine'],
  ['W', 'Draw'], ['R', 'Rest'], ['J', 'Part-time job'], ['B', 'Notebook'], ['S', 'Stats'], ['A', 'Staff'],
  ['T', 'Trips'], ['H', 'History'], ['Esc', 'Close'],
]
/** The desktop app's own key; a browser keeps F11 for itself. */
const DESKTOP_KEYS: [string, string][] = [['F11', 'Full screen']]

export function SettingsModal() {
  const closeModal = useStore((s) => s.closeModal)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const sound = useStore((s) => s.sound)
  const setSound = useStore((s) => s.setSound)
  const backToTitle = useStore((s) => s.backToTitle)
  const readOnly = useStore((s) => s.readOnly)

  const keys = isDesktop() ? [...KEYS, ...DESKTOP_KEYS] : KEYS
  const volumePct = Math.round(sound.volume * 100)
  const volumeReadout = sound.muted ? 'Off' : `${volumePct}%`

  return (
    <Modal title="Settings" onClose={closeModal} narrow>
      <div className="col settings">
        <section className="settings-section row between">
          <span style={{ fontWeight: 800 }}>Appearance</span>
          <div className="seg sm" role="group" aria-label="Appearance">
            <button aria-pressed={theme === 'auto'} onClick={() => setTheme('auto')}>Auto</button>
            <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
            <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
          </div>
        </section>

        <section className="settings-section row between">
          <span style={{ fontWeight: 800 }}>Sound</span>
          <div className="row">
            <button
              className="btn ghost icon"
              aria-pressed={sound.muted}
              aria-label="Mute sound"
              title="Mute sound"
              onClick={() => setSound({ muted: !sound.muted })}
            >
              <Icon name={sound.muted ? 'mute' : 'sound'} />
            </button>
            <input
              className="range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={volumePct}
              aria-label="Volume"
              aria-valuetext={volumeReadout}
              onChange={(e) => {
                setSound({ volume: Number(e.target.value) / 100, muted: false })
                getSound().play('click')
              }}
            />
            <span className="tiny num" style={{ minWidth: 32, textAlign: 'right' }}>{volumeReadout}</span>
          </div>
        </section>

        <section className="settings-section row between">
          <span style={{ fontWeight: 800 }}>Music</span>
          <div className="seg sm" role="group" aria-label="Music">
            <button aria-pressed={sound.music} onClick={() => setSound({ music: true })}>On</button>
            <button aria-pressed={!sound.music} onClick={() => setSound({ music: false })}>Off</button>
          </div>
        </section>

        <section className="settings-section">
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Keyboard</div>
          <div className="kbd-grid">
            {keys.map(([k, v]) => (
              <Fragment key={k}><span className="kbd">{k}</span><span className="muted">{v}</span></Fragment>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <SaveFileSection />
        </section>

        <section className="settings-section row between wrap">
          <div>
            <div style={{ fontWeight: 800 }}>Title screen</div>
            <div className="tiny faint">Your career stays saved in its slot. Open it again from the title screen.</div>
          </div>
          {!readOnly && (
            <ConfirmRow
              label="Back to the title screen"
              confirmLabel="Yes, go to the title screen"
              cancelLabel="Keep playing"
              onConfirm={() => void backToTitle()}
            />
          )}
        </section>
      </div>
    </Modal>
  )
}
