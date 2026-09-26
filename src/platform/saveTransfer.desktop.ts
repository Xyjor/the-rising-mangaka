// The desktop app's save file transfer: the system's save and open dialogs, then the fs plugin. saveTransfer.ts loads
// this by dynamic import only in the desktop app. Each path the player picks joins the fs scope for the session (the
// dialog plugin does that), so the capabilities need no standing fs scope.
import { documentDir, join } from '@tauri-apps/api/path'
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

const FILTERS = [{ name: 'Rising Mangaka save', extensions: ['json'] }]

/** The Save dialog opens in Documents with the file name filled in; with no Documents folder, on the name alone. */
async function defaultPath(fileName: string): Promise<string> {
  try {
    return await join(await documentDir(), fileName)
  } catch {
    return fileName
  }
}

export async function exportSave(fileName: string, text: string): Promise<'saved' | 'cancelled'> {
  const path = await save({ title: 'Export save file', defaultPath: await defaultPath(fileName), filters: FILTERS })
  if (path === null) return 'cancelled'
  await writeTextFile(path, text)
  return 'saved'
}

export async function importSave(): Promise<string | null> {
  const path = await open({ title: 'Load save file', multiple: false, directory: false, filters: FILTERS })
  return path === null ? null : readTextFile(path)
}
