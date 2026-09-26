// The keys and targets the desktop shell leaves to the page or takes from the browser engine.

/** The part of a KeyboardEvent the checks read. */
export interface KeyCombo {
  readonly key: string
  readonly ctrlKey: boolean
  readonly shiftKey: boolean
  readonly altKey: boolean
  readonly metaKey: boolean
}

/** Reload, print, find and caret browsing, on their own or with any modifier (Ctrl+F5, Shift+F3). */
const BROWSER_KEYS = new Set(['F3', 'F5', 'F7', 'BrowserBack', 'BrowserForward', 'BrowserRefresh'])
/** With Ctrl (Cmd on a Mac), Shift or not: reload, print, save page, view source, find and find next. */
const BROWSER_LETTERS = new Set(['r', 'p', 's', 'u', 'f', 'g'])

/**
 * True for a key the browser engine would act on, reloading, printing, navigating or opening one of its own bars, which
 * a game window should not do. Editing keys (Ctrl+C, Ctrl+V, Ctrl+A), zoom (Ctrl+=, Ctrl+-, Ctrl+0), the game's own
 * letter keys and F11 are not.
 */
export function isBrowserShortcut(e: KeyCombo): boolean {
  if (BROWSER_KEYS.has(e.key)) return true
  if ((e.ctrlKey || e.metaKey) && !e.altKey && BROWSER_LETTERS.has(e.key.toLowerCase())) return true
  return e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
}

/** Input types that take typed text, where the context menu's cut, copy and paste belong. */
const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

/** True when `target` is a place to type: a text input, a textarea, or inside a contenteditable element. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) return TEXT_INPUTS.has(target.type)
  return target.isContentEditable
}
