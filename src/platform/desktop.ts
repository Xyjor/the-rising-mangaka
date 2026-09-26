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
 * and in a release build the browser engine's own shortcuts (reload, print, back) and its context menu are cancelled,
 * except the menu in text fields. Returns a function that undoes it all.
 */
export async function installDesktopShell(
  win: ShellWindow = getCurrentWindow(),
  release: boolean = import.meta.env.PROD,
): Promise<() => void> {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'F11') {
      e.preventDefault()
      if (!e.repeat) void toggleFullscreen(win)
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
  // show a window the page itself reported hidden.
  let minimized = false
  const onResized = async () => {
    const now = await win.isMinimized()
    if (now === minimized) return
    minimized = now
    useStore.getState().setWindowHidden(now)
  }

  const onClose = async () => {
    flushSave()
    // The window-state plugin would otherwise remember the full-screen size as the window's size for the next run.
    // A handler that throws would keep the window open, so a failure here is swallowed and the window closes.
    try {
      if (await win.isFullscreen()) await win.setFullscreen(false)
    } catch {
      /* close anyway */
    }
  }

  const unlisten = await Promise.all([win.onCloseRequested(onClose), win.onResized(() => void onResized())])

  return () => {
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('contextmenu', onContextMenu, true)
    for (const stop of unlisten) stop()
  }
}

async function toggleFullscreen(win: ShellWindow): Promise<void> {
  await win.setFullscreen(!(await win.isFullscreen()))
}
