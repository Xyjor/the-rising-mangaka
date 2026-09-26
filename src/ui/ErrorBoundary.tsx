import { Component, useState } from 'react'
import type { ReactNode } from 'react'
import { exportSave } from '../platform/saveTransfer'
import { storedSaveFile } from '../state/saveFile'
import { SAVE_KEY, flushSave, useStore } from '../state/store'
import { isOwner } from '../state/tabLock'
import { ConfirmRow } from './ConfirmRow'
import { SaveFileNoticeLine } from './SaveFileSection'
import { WRITE_FAILED } from './useSaveFile'
import type { SaveFileNotice } from './useSaveFile'

/** The save kept in storage, read raw: after a crash the store's state may be what broke. */
function storedSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY)
  } catch {
    return null
  }
}

/**
 * Deletes the save and reloads into the title screen. The store drops its game first, so neither a write still waiting
 * on the debounce (flushed as the page goes) nor any later update can bring the old save back. A read-only tab only
 * reloads: the save belongs to the tab that owns it, which is still playing.
 */
function startOver() {
  if (isOwner()) {
    try {
      useStore.setState({ game: null, speed: 0 })
    } catch {
      /* the store is past helping: the key still goes */
    }
    try {
      localStorage.removeItem(SAVE_KEY)
    } catch {
      /* storage unavailable: there is nothing to delete */
    }
  }
  window.location.reload()
}

/** The screen a crash leaves: what happened, the save exported to keep it safe, and a fresh start. */
function RecoveryScreen({ error }: { error: unknown }) {
  const [hasSave] = useState(() => storedSaveFile(storedSave()) !== null)
  const [notice, setNotice] = useState<SaveFileNotice | null>(null)
  const message = error instanceof Error ? error.message : String(error)

  const exportFile = async () => {
    setNotice(null)
    // Write any change still waiting on the debounce, so the file has the latest day.
    flushSave()
    const file = storedSaveFile(storedSave())
    if (!file) return
    try {
      if ((await exportSave(file.fileName, file.text)) === 'saved') {
        setNotice({ kind: 'done', text: `Exported ${file.fileName}.` })
      }
    } catch {
      setNotice({ kind: 'error', text: WRITE_FAILED })
    }
  }

  return (
    <div className="title-screen">
      <div className="title-card card">
        <h2>Something went wrong</h2>
        <p className="muted">
          {hasSave
            ? 'The game stopped on an error. Your career is still saved: export it to keep a copy, then reopen the game. If the error comes back, start over.'
            : 'The game stopped on an error. Reopen the game to try again. If the error comes back, start over.'}
        </p>
        <p className="tiny faint">Error: {message}</p>
        <div className="col" style={{ gap: 10, alignItems: 'center' }}>
          {hasSave && <button className="btn primary" onClick={() => void exportFile()}>Export save file</button>}
          <ConfirmRow
            label="Start over"
            confirmLabel="Yes, delete save"
            cancelLabel="Keep the save"
            hint="Deletes this save. There is no undo."
            onConfirm={startOver}
          />
          <SaveFileNoticeLine notice={notice} />
        </div>
      </div>
    </div>
  )
}

interface Props { children: ReactNode }
interface State { crashed: boolean; error: unknown }

/** Catches a crash while the game renders and shows the recovery screen in place of the game. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false, error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { crashed: true, error }
  }

  render() {
    return this.state.crashed ? <RecoveryScreen error={this.state.error} /> : this.props.children
  }
}
