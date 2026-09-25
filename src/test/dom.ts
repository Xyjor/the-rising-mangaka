/**
 * Shared setup for happy-dom UI tests. Import this (for its side effects) from every test file
 * that starts with `// @vitest-environment happy-dom`; globals are off, so there is no global
 * setup file to do this automatically.
 */
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// happy-dom implements these already (that is why it was chosen over jsdom, which does not
// implement <dialog>). These are defensive fallbacks only, in case a future happy-dom version
// drops one of them; they keep UI tests from crashing rather than emulating full behaviour.
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

if (typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.getContext !== 'function') {
  HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement['getContext']
}

/**
 * Replace `window.matchMedia` so every query reports `on`, for components that check
 * `prefers-reduced-motion`. Returns a function that restores the original.
 */
export function stubReducedMotion(on: boolean): () => void {
  const original = window.matchMedia
  window.matchMedia = ((query: string) =>
    ({
      matches: on,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}
