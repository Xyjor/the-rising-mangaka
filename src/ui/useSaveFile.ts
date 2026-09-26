import { useState } from 'react'
import { exportSave, importSave } from '../platform/saveTransfer'
import { parseSave, saveFileName, serializeSave } from '../state/saveFile'
import type { SaveFile, SaveFileError } from '../state/saveFile'
import { useStore } from '../state/store'

/** What the player is told about a refused file, each saying what to do next. */
export const SAVE_FILE_ERRORS: Record<SaveFileError, string> = {
  'not-json': 'That file is not a Rising Mangaka save. Pick a .json file made with Export save file.',
  'not-a-save': 'That file is not a Rising Mangaka save. Pick a .json file made with Export save file.',
  'too-old': 'That save comes from an older version of the game and cannot be loaded.',
  'too-new': 'That save comes from a newer version of the game. Update the game, then load it again.',
  damaged: 'That save file is damaged. Try another export.',
}
export const READ_FAILED = 'Could not read that file. Try again, or pick another file.'
export const WRITE_FAILED = 'Could not write the file. Pick another folder and try again.'

/** The line under the buttons: what an export did, or why a file was not loaded. */
export interface SaveFileNotice { kind: 'done' | 'error'; text: string }

/**
 * Export and load for the Save file section and the title screen. Loading over a game in play waits in `pending` for
 * the player to confirm; with no game it loads at once.
 */
export function useSaveFile() {
  const [notice, setNotice] = useState<SaveFileNotice | null>(null)
  const [pending, setPending] = useState<SaveFile | null>(null)

  const exportFile = async () => {
    const { game, tutorialStep, resumeSpeed } = useStore.getState()
    if (!game) return
    setNotice(null)
    const fileName = saveFileName(game.player.name, game.day)
    try {
      const result = await exportSave(fileName, serializeSave({ game, tutorialStep, resumeSpeed }))
      if (result === 'saved') setNotice({ kind: 'done', text: `Exported ${fileName}.` })
    } catch {
      setNotice({ kind: 'error', text: WRITE_FAILED })
    }
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
    if (useStore.getState().game) setPending(parsed.save)
    else useStore.getState().loadSave(parsed.save)
  }

  const confirmLoad = () => {
    if (pending) useStore.getState().loadSave(pending)
    setPending(null)
  }

  const cancelLoad = () => setPending(null)

  return { notice, pending, exportFile, pickFile, confirmLoad, cancelLoad }
}
