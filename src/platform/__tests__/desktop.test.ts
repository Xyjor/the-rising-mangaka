// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { installSound, nullEngine } from '../../audio/instance'
import { createGame } from '../../sim'
import type { GameState } from '../../sim'
import { OWNER_KEY } from '../../state/tabLock'
import { createFakeSound } from '../../test/fakeSound'
import type { ShellWindow } from '../desktop'

// The desktop app: Tauri sets isTauri before any page script runs, and an earlier run left an owner stamp behind
// (a fresh one, as a crash within the last few seconds would). The store loads after both.
const g = globalThis as { isTauri?: unknown }
g.isTauri = true
localStorage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'an-earlier-run', at: Date.now() }))
const { SAVE_KEY, useStore } = await import('../../state/store')
const { installDesktopShell } = await import('../desktop')

const st = () => useStore.getState()

/** A stand-in for Tauri's window: records what the shell asks of it and lets a test close, resize or minimise it. */
function fakeWindow() {
  let close: (() => void | Promise<void>) | null = null
  let resized: (() => void) | null = null
  const win = {
    fullscreen: false,
    minimized: false,
    /** How many of the shell's window listeners are still registered. */
    listening: 0,
    onCloseRequested: async (handler: () => void | Promise<void>) => {
      close = handler
      win.listening++
      return () => void win.listening--
    },
    onResized: async (handler: () => void) => {
      resized = handler
      win.listening++
      return () => void win.listening--
    },
    isMinimized: async () => win.minimized,
    isFullscreen: async () => win.fullscreen,
    setFullscreen: async (on: boolean) => {
      win.fullscreen = on
    },
    /** The player closes the window: Tauri runs the handler and destroys the window once it settles. */
    requestClose: async () => {
      await close?.()
    },
    /** The window is resized, minimised or restored: Tauri reports each as a resize. */
    resize: () => resized?.(),
  }
  const typed: ShellWindow = win
  return Object.assign(typed, win)
}

/** Dispatches a cancelable keydown on `target` and says whether the shell cancelled it. */
function keyBlocked(key: string, mods: KeyboardEventInit = {}, target: EventTarget = document.body): boolean {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods })
  target.dispatchEvent(e)
  return e.defaultPrevented
}

/** Dispatches a cancelable contextmenu on `target` and says whether the shell cancelled it. */
function menuBlocked(target: Element): boolean {
  const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  target.dispatchEvent(e)
  return e.defaultPrevented
}

function append(html: string): Element {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host.firstElementChild!
}

let uninstall: () => void = () => {}
let win: ReturnType<typeof fakeWindow>

beforeEach(() => {
  win = fakeWindow()
  useStore.setState({ game: createGame('Rin', 42), speed: 0, resumeSpeed: 1, modal: 'none', windowHidden: false })
})
afterEach(() => {
  uninstall()
  installSound(nullEngine)
  document.body.innerHTML = ''
})

describe('the store in the desktop app', () => {
  it('owns the save without a tab lock: the stale stamp is gone and the window is not read-only', () => {
    expect(localStorage.getItem(OWNER_KEY)).toBeNull()
    expect(st().readOnly).toBe(false)
  })
})

describe('installDesktopShell', () => {
  it('writes the waiting save when the window closes, before the debounce would', async () => {
    vi.useFakeTimers()
    try {
      uninstall = await installDesktopShell(win, true)
      const savedDay = () => (JSON.parse(localStorage.getItem(SAVE_KEY)!) as { state: { game: GameState } }).state.game.day
      useStore.setState({ game: createGame('Kai', 7) })
      expect(savedDay()).toBe(0)
      // A day passes and the player closes the window straight away, well inside the 800 ms debounce.
      st().tick()
      vi.advanceTimersByTime(400)
      expect(savedDay()).toBe(0)
      const closing = win.requestClose()
      expect(savedDay()).toBe(1)
      await closing
    } finally {
      vi.useRealTimers()
    }
  })

  it('leaves full screen before the window closes, so the windowed size is the one remembered', async () => {
    uninstall = await installDesktopShell(win, true)
    win.fullscreen = true
    await win.requestClose()
    expect(win.fullscreen).toBe(false)
  })

  it('still lets the window close when leaving full screen fails', async () => {
    uninstall = await installDesktopShell(win, true)
    win.isFullscreen = async () => {
      throw new Error('not allowed')
    }
    // Tauri destroys the window only when the handler settles without throwing.
    await expect(win.requestClose()).resolves.toBeUndefined()
  })

  it('F11 toggles full screen, in debug builds too, and the browser never sees it', async () => {
    uninstall = await installDesktopShell(win, false)
    expect(keyBlocked('F11')).toBe(true)
    await vi.waitFor(() => expect(win.fullscreen).toBe(true))
    expect(keyBlocked('F11')).toBe(true)
    await vi.waitFor(() => expect(win.fullscreen).toBe(false))
  })

  it('a held F11 toggles once', async () => {
    uninstall = await installDesktopShell(win, true)
    keyBlocked('F11')
    await vi.waitFor(() => expect(win.fullscreen).toBe(true))
    expect(keyBlocked('F11', { repeat: true })).toBe(true)
    await new Promise((r) => setTimeout(r, 10))
    expect(win.fullscreen).toBe(true)
  })

  it('in a release build, cancels browser shortcuts everywhere and leaves the rest alone', async () => {
    uninstall = await installDesktopShell(win, true)
    const input = append('<input>')
    expect(keyBlocked('F5')).toBe(true)
    expect(keyBlocked('r', { ctrlKey: true })).toBe(true)
    expect(keyBlocked('p', { ctrlKey: true }, input)).toBe(true)
    expect(keyBlocked('ArrowLeft', { altKey: true })).toBe(true)
    expect(keyBlocked('c', { ctrlKey: true }, input)).toBe(false)
    expect(keyBlocked('r')).toBe(false)
    expect(keyBlocked(' ')).toBe(false)
    expect(keyBlocked('Escape')).toBe(false)
  })

  it('in a release build, keeps the context menu for text fields only', async () => {
    uninstall = await installDesktopShell(win, true)
    expect(menuBlocked(append('<div>studio</div>'))).toBe(true)
    expect(menuBlocked(append('<input type="range">'))).toBe(true)
    expect(menuBlocked(append('<input>'))).toBe(false)
    expect(menuBlocked(append('<textarea></textarea>'))).toBe(false)
  })

  it('in a debug build, leaves the shortcuts and the context menu to the browser', async () => {
    uninstall = await installDesktopShell(win, false)
    expect(keyBlocked('F5')).toBe(false)
    expect(keyBlocked('r', { ctrlKey: true })).toBe(false)
    expect(menuBlocked(append('<div>studio</div>'))).toBe(false)
  })

  it('minimising stops the clock and suspends the sound; restoring resumes the sound only', async () => {
    const sound = createFakeSound()
    installSound(sound)
    uninstall = await installDesktopShell(win, true)
    st().setSpeed(2)
    win.minimized = true
    win.resize()
    await vi.waitFor(() => expect(st().windowHidden).toBe(true))
    expect(st().speed).toBe(0)
    expect(sound.suspends).toBe(1)
    win.minimized = false
    win.resize()
    await vi.waitFor(() => expect(st().windowHidden).toBe(false))
    expect(st().speed).toBe(0)
    expect([sound.suspends, sound.resumes]).toEqual([1, 1])
  })

  it('a resize that neither minimises nor restores leaves the hidden flag to the page', async () => {
    uninstall = await installDesktopShell(win, true)
    // The page reported itself hidden (the store's visibility listener); an ordinary resize must not undo that.
    st().setWindowHidden(true)
    win.resize()
    await new Promise((r) => setTimeout(r, 10))
    expect(st().windowHidden).toBe(true)
  })

  it('uninstalling stops listening to the keyboard, the context menu and the window', async () => {
    uninstall = await installDesktopShell(win, true)
    expect(win.listening).toBe(2)
    uninstall()
    uninstall = () => {}
    expect(win.listening).toBe(0)
    expect(keyBlocked('F5')).toBe(false)
    expect(keyBlocked('F11')).toBe(false)
    expect(menuBlocked(append('<div>studio</div>'))).toBe(false)
  })
})
