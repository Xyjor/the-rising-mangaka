import { useState } from 'react'
import { isDesktop } from '../platform/env'
import { importSave } from '../platform/saveTransfer'
import { shortDate } from '../sim'
import { parseSave, slotSummary, storedSaveFile } from '../state/saveFile'
import type { SaveFile } from '../state/saveFile'
import { SLOT_IDS } from '../state/slots'
import type { SlotId } from '../state/slots'
import { slotRaw, useStore } from '../state/store'
import { TITLE_ART } from './art/registry'
import { ConfirmRow } from './ConfirmRow'
import { compact, money } from './format'
import { ReadOnlyHint, SaveFileNoticeLine } from './SaveFileSection'
import { TabBanner } from './TabBanner'
import { READ_FAILED, SAVE_FILE_ERRORS, TAKE_OVER_TO_LOAD, exportNotice } from './useSaveFile'
import type { SaveFileNotice } from './useSaveFile'

export function TitleScreen() {
  const readOnly = useStore((s) => s.readOnly)
  // Bumped after a slot changes in storage (a delete, a load), so the cards read their slots again.
  const [, setVersion] = useState(0)
  const refresh = () => setVersion((v) => v + 1)
  const firstEmpty = SLOT_IDS.find((n) => slotRaw(n) === null)

  return (
    <div className="title-screen has-hero">
      <img
        src={TITLE_ART.src}
        width={TITLE_ART.w}
        height={TITLE_ART.h}
        alt="A mangaka's rooftop at golden hour"
        loading="eager"
        decoding="async"
        draggable={false}
        className="pixel-art title-hero"
      />
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
        <ol className="slot-list" aria-label="Careers">
          {SLOT_IDS.map((n) => (
            <SlotCard key={n} n={n} readOnly={readOnly} autoFocus={n === firstEmpty} onChanged={refresh} />
          ))}
        </ol>
        <ReadOnlyHint readOnly={readOnly} notice={null} />
        <p className="tiny faint">
          {isDesktop() ? 'Saves automatically on this computer.' : 'Saves automatically in this browser (one tab at a time).'}
        </p>
      </div>
    </div>
  )
}

/** One career slot: its summary and what can be done with it, or a new career's pen name. */
function SlotCard({ n, readOnly, autoFocus, onChanged }: {
  n: SlotId
  readOnly: boolean
  autoFocus: boolean
  onChanged: () => void
}) {
  const openSlot = useStore((s) => s.openSlot)
  const startInSlot = useStore((s) => s.startInSlot)
  const deleteSlot = useStore((s) => s.deleteSlot)
  const loadSaveIntoSlot = useStore((s) => s.loadSaveIntoSlot)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<SaveFileNotice | null>(null)
  const [pending, setPending] = useState<SaveFile | null>(null)
  const raw = slotRaw(n)
  const summary = slotSummary(raw)
  const refused = () => setNotice({ kind: 'error', text: TAKE_OVER_TO_LOAD })

  const write = (save: SaveFile) => {
    if (loadSaveIntoSlot(n, save)) {
      setNotice({ kind: 'done', text: `Loaded ${save.game.player.name}'s save into slot ${n}.` })
      onChanged()
    } else refused()
  }

  const pickFile = async () => {
    setNotice(null)
    setPending(null)
    let text: string | null
    try {
      text = await importSave()
    } catch {
      setNotice({ kind: 'error', text: READ_FAILED })
      return
    }
    if (text === null) return
    const parsed = parseSave(text)
    if (!parsed.ok) {
      setNotice({ kind: 'error', text: SAVE_FILE_ERRORS[parsed.error] })
      return
    }
    // A filled slot asks first: the file replaces the career in it.
    if (slotRaw(n) !== null) setPending(parsed.save)
    else write(parsed.save)
  }

  const exportFile = async () => {
    setNotice(null)
    const file = storedSaveFile(slotRaw(n))
    if (file) setNotice(await exportNotice(file.fileName, file.text))
  }

  const remove = () => {
    if (deleteSlot(n)) {
      setNotice(null)
      onChanged()
    } else refused()
  }

  const confirmPending = () => {
    const save = pending
    setPending(null)
    if (save) write(save)
  }

  // An unreadable slot is still a filled one: it can be exported, replaced or deleted, never started over blindly.
  const filled = raw !== null
  return (
    <li className="slot card flat" aria-label={`Slot ${n}`}>
      <div className="lbl">Slot {n}</div>
      {filled ? (
        <>
          {summary ? (
            <div className="col" style={{ gap: 2 }}>
              <div className="slot-name">{summary.penName}</div>
              <div className="small muted">
                {summary.dateLabel}, {money(summary.money)}, {compact(summary.fans)} fans
              </div>
              <div className="small muted">
                {summary.serialTitle ? `Serialising ${summary.serialTitle}` : 'No serial running'}
              </div>
            </div>
          ) : (
            <div className="small warn-text">This slot cannot be read. Export it to keep a copy, or delete it.</div>
          )}
          {pending ? (
            <div className="row wrap">
              <span className="small">
                Load {pending.game.player.name}'s save ({shortDate(pending.game.day)}) into this slot? It replaces
                {summary ? ` ${summary.penName}'s career.` : ' the career here.'}
              </span>
              <button className="btn ghost sm" onClick={() => setPending(null)}>Keep this career</button>
              <button className="btn primary sm" disabled={readOnly} onClick={confirmPending}>Yes, replace it</button>
            </div>
          ) : (
            <div className="row wrap">
              {summary && (
                <button className="btn primary sm" disabled={readOnly} onClick={() => { if (!openSlot(n)) refused() }}>
                  Continue
                </button>
              )}
              <button className="btn sm" onClick={() => void exportFile()}>Export save file</button>
              <button className="btn sm" disabled={readOnly} onClick={() => void pickFile()}>
                Load a save file into this slot
              </button>
              {!readOnly && (
                <ConfirmRow
                  label="Delete this career"
                  confirmLabel="Yes, delete this career"
                  cancelLabel="Keep it"
                  hint="Deletes this slot's save. There is no undo."
                  className="btn ghost sm"
                  onConfirm={remove}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <form
            className="col"
            style={{ gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault()
              if (!startInSlot(n, name)) refused()
            }}
          >
            <label className="col" style={{ gap: 6 }}>
              <span className="small" style={{ fontWeight: 800 }}>Your pen name</span>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rin Hoshino"
                maxLength={24}
                autoFocus={autoFocus}
              />
            </label>
            <button className="btn primary block" type="submit" disabled={readOnly}>Start a new career here</button>
          </form>
          <button className="btn ghost sm" disabled={readOnly} onClick={() => void pickFile()}>
            Load a save file into this slot
          </button>
        </>
      )}
      <SaveFileNoticeLine notice={notice} />
    </li>
  )
}
