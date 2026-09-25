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
