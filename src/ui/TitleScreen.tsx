import { useState } from 'react'
import { isDesktop } from '../platform/env'
import { useStore } from '../state/store'
import { ReadOnlyHint, SaveFileNoticeLine } from './SaveFileSection'
import { TabBanner } from './TabBanner'
import { useSaveFile } from './useSaveFile'

export function TitleScreen() {
  const newGame = useStore((s) => s.newGame)
  const readOnly = useStore((s) => s.readOnly)
  const [name, setName] = useState('')
  // With no game to replace, a picked save loads straight away.
  const { notice, pickFile } = useSaveFile()

  const start = () => newGame(name.trim() || 'Rookie')

  return (
    <div className="title-screen">
      <div className="title-card card">
        {/* A read-only tab can take over from here too: the game shell, with its banner, is not open yet. */}
        <TabBanner />
        <div>
          <div className="chip accent" style={{ marginBottom: 10 }}>A manga career sim</div>
          <h1>THE RISING <span>MANGAKA</span></h1>
        </div>
        <p className="muted">
          Plan a manga, draw it page by page, and pitch it to a magazine. Learn what readers love,
          level up your craft, and climb the polls.
        </p>
        <form
          className="col"
          onSubmit={(e) => { e.preventDefault(); start() }}
        >
          <label className="col" style={{ textAlign: 'left', gap: 6 }}>
            <span className="small" style={{ fontWeight: 800 }}>Your pen name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rin Hoshino"
              maxLength={24}
              autoFocus
            />
          </label>
          <button className="btn primary lg block" type="submit">Open your studio</button>
        </form>
        <div className="col" style={{ gap: 6 }}>
          <button className="btn ghost block" disabled={readOnly} onClick={() => void pickFile()}>Load a save file</button>
          <ReadOnlyHint readOnly={readOnly} notice={notice} />
          <SaveFileNoticeLine notice={notice} />
        </div>
        <p className="tiny faint">
          {isDesktop() ? 'Saves automatically on this computer.' : 'Saves automatically in this browser (one tab at a time).'}
        </p>
      </div>
    </div>
  )
}
