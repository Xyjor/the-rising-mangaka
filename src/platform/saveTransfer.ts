// Moving a save file in and out of the game. In a browser: a download and a file picker. The desktop app uses its own
// dialogs (saveTransfer.desktop.ts), loaded by dynamic import only there, so the browser build carries no Tauri code.
import { isDesktop } from './env'

/** How long the download's object URL lives: long enough for the browser to start the download. */
const REVOKE_AFTER_MS = 1000

/**
 * The most of a picked file the browser reads. UTF-8 spends at most 3 bytes on each UTF-16 unit (a malformed byte
 * decodes to one replacement character), so these bytes hold any save parseSave accepts (at most 5,000,000
 * characters, its MAX_SAVE_FILE_CHARS), and from any longer file they decode to more than 5,000,000 characters, which
 * parseSave refuses as not a save. (With a leading byte-order mark, which decoding drops, the cut text can land on
 * exactly 5,000,000; cut short, it then fails as JSON, which reads the same to the player.) A huge file is refused
 * without being read whole.
 */
export const MAX_READ_BYTES = 15_000_003

/**
 * Writes `text` to a file the player keeps, offered as `fileName`. Resolves 'cancelled' when the player closes the
 * dialog (the desktop app; a browser download cannot tell), and rejects when the file cannot be written.
 */
export async function exportSave(fileName: string, text: string): Promise<'saved' | 'cancelled'> {
  if (isDesktop()) return (await import('./saveTransfer.desktop')).exportSave(fileName, text)
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
  return 'saved'
}

/**
 * Asks the player for a save file and resolves its text, or null when they cancel. Rejects when the file cannot be
 * read. In a browser the picker opens within the click that called this, which the browser requires.
 */
export async function importSave(): Promise<string | null> {
  if (isDesktop()) return (await import('./saveTransfer.desktop')).importSave()
  return new Promise<string | null>((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) resolve(null)
      else file.slice(0, MAX_READ_BYTES).text().then(resolve, reject)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
