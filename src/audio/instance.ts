// The one shared sound engine. Everything that makes a sound calls getSound(); the app installs the real engine at
// startup and tests install a fake. Until then it is the silent nullEngine.
import type { SoundEngine } from './engine'

const noop = () => {}

export const nullEngine: SoundEngine = Object.freeze({
  unlocked: false,
  running: false,
  unlock: noop,
  play: () => noop,
  setPrefs: noop,
  levels: () => ({ master: 0, fx: 0, music: 0 }),
  startMusic: noop,
  stopMusic: noop,
  duck: noop,
  suspend: noop,
  resume: noop,
  dispose: noop,
})

let current: SoundEngine = nullEngine

export function getSound(): SoundEngine {
  return current
}

export function installSound(engine: SoundEngine): void {
  current = engine
}

// The duck stack. Each open modal (and the results reveal) holds a duck level; the deepest hold wins, and the music
// comes back to full once the last hold is released. Every push and release calls duck() once.
const holds: { level: number }[] = []

function applyDuck(): void {
  getSound().duck(holds.length ? Math.min(...holds.map((h) => h.level)) : 1)
}

/** Duck the music to `level` until the returned release is called. A second release does nothing. */
export function holdDuck(level: number): () => void {
  const hold = { level }
  holds.push(hold)
  applyDuck()
  return () => {
    const i = holds.indexOf(hold)
    if (i < 0) return
    holds.splice(i, 1)
    applyDuck()
  }
}
