// The desktop app's window behaviour. main.tsx loads this with a dynamic import only when isDesktop(), so the browser
// build keeps the Tauri API out of its main chunk. Only src/platform/ imports @tauri-apps/*.
import { getCurrentWindow } from '@tauri-apps/api/window'
import { flushSave, useStore } from '../state/store'
import { isBrowserShortcut, isEditableTarget } from './keys'

/** The part of Tauri's window the shell uses; a test passes a fake. */
export interface ShellWindow {
  /** Tauri destroys the window once the handler settles (it needs `core:window:allow-destroy`). */
  onCloseRequested(handler: () => void | Promise<void>): Promise<() => void>
  onResized(handler: () => void): Promise<() => void>
  isMinimized(): Promise<boolean>
  isFullscreen(): Promise<boolean>
  setFullscreen(fullscreen: boolean): Promise<void>
}

/**
 * Wires the window: the save is written when it closes (leaving full screen first, so the remembered size stays the
 * windowed one), F11 toggles full screen, minimising pauses the clock and the sound (restoring resumes the sound only),
 * and in a release build the browser engine's own shortcuts (reload, print, back) are cancelled everywhere and its
 * context menu everywhere but text fields. Returns a function that undoes it all.
 *
 * "Release" is a production build of the page (`import.meta.env.PROD`): every `tauri build`, `--debug` included, runs
 * `npm run build`. Only `npm run tauri dev` keeps the browser's keys and menu.
 */
export async function installDesktopShell(
  win: ShellWindow = getCurrentWindow(),
  release: boolean = import.meta.env.PROD,
): Promise<() => void> {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'F11') {
      e.preventDefault()
      if (!e.repeat) toggleFullscreen(win).catch(warn('could not toggle full screen'))
    } else if (release && isBrowserShortcut(e)) {
      e.preventDefault()
    }
  }
  const onContextMenu = (e: MouseEvent) => {
    if (!isEditableTarget(e.target)) e.preventDefault()
  }
  // Capture phase: the shell hears a key before any component could stop it.
  window.addEventListener('keydown', onKey, true)
  if (release) window.addEventListener('contextmenu', onContextMenu, true)

  // Minimising reports as a resize. Only a change of minimised state reaches the store: an ordinary resize must not
  // show a window the page itself reported hidden. Only the latest resize's answer counts: a minimise and a restore
  // inside one round trip could otherwise answer out of order and leave a visible window marked hidden.
  let minimized = false
  let latest = 0
  const onResized = async () => {
    const mine = ++latest
    const now = await win.isMinimized()
    if (mine !== latest || now === minimized) return
    minimized = now
    useStore.getState().setWindowHidden(now)
  }

  const onClose = async () => {
    flushSave()
    // The window-state plugin would otherwise remember the full-screen size as the window's size for the next run.
    // A handler that throws would keep the window open, so a failure here is only reported and the window closes.
    try {
      if (await win.isFullscreen()) await win.setFullscreen(false)
    } catch (err) {
      warn('could not leave full screen before closing')(err)
    }
  }

  const unlisten = await Promise.all([
    win.onCloseRequested(onClose),
    win.onResized(() => void onResized().catch(warn('could not tell whether the window is minimised'))),
  ])

  return () => {
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('contextmenu', onContextMenu, true)
    for (const stop of unlisten) stop()
  }
}

/** A console warning for a window call that failed: the game goes on without it. */
function warn(what: string): (err: unknown) => void {
  return (err) => console.warn(`The Rising Mangaka: ${what}.`, err)
}

async function toggleFullscreen(win: ShellWindow): Promise<void> {
  await win.setFullscreen(!(await win.isFullscreen()))
}
