import { useState } from 'react'
import { isDesktop } from '../platform/env'
import { useStore } from '../state/store'

export function TitleScreen() {
  const newGame = useStore((s) => s.newGame)
  const [name, setName] = useState('')

  const start = () => newGame(name.trim() || 'Rookie')

  return (
    <div className="title-screen">
      <div className="title-card card">
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
        <p className="tiny faint">
          {isDesktop() ? 'Saves automatically on this computer.' : 'Saves automatically in this browser (one tab at a time).'}
        </p>
      </div>
    </div>
  )
}
