import { isDesktop } from '../platform/env'
import { shortDate } from '../sim'
import { useStore } from '../state/store'
import { useSaveFile } from './useSaveFile'
import type { SaveFileNotice } from './useSaveFile'

/** The Settings section that exports the career to a file and loads one back. */
export function SaveFileSection() {
  const readOnly = useStore((s) => s.readOnly)
  const { notice, pending, exportFile, pickFile, confirmLoad, cancelLoad } = useSaveFile()

  return (
    <section className="col" style={{ gap: 8 }}>
      <div>
        <div style={{ fontWeight: 800 }}>Save file</div>
        <div className="tiny faint">
          {isDesktop()
            ? 'Back up your career, or carry it to another computer.'
            : 'Your career lives in this browser. Export it to back it up or move it to the desktop app.'}
        </div>
      </div>
      {pending ? (
        <div className="row wrap">
          <span className="small">
            Load {pending.game.player.name}'s save ({shortDate(pending.game.day)})? It replaces the game you are playing.
          </span>
          <button className="btn ghost sm" onClick={cancelLoad}>Keep playing</button>
          <button className="btn primary sm" onClick={confirmLoad}>Load this save</button>
        </div>
      ) : (
        <div className="row wrap">
          <button className="btn sm" onClick={() => void exportFile()}>Export save file</button>
          <button className="btn sm" disabled={readOnly} onClick={() => void pickFile()}>Load save file…</button>
        </div>
      )}
      {readOnly && <div className="tiny muted">Take over this tab to load a save.</div>}
      <SaveFileNoticeLine notice={notice} />
    </section>
  )
}

/** An export's result as a status line, a refusal as an alert. */
export function SaveFileNoticeLine({ notice }: { notice: SaveFileNotice | null }) {
  if (!notice) return null
  return notice.kind === 'error'
    ? <div className="small warn-text" role="alert">{notice.text}</div>
    : <div className="small muted" role="status">{notice.text}</div>
}
