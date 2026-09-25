import { afterEach, describe, expect, it } from 'vitest'
import { createSoundEngine } from '../engine'
import { getSound, installSound, nullEngine } from '../instance'

describe('shared sound engine', () => {
  afterEach(() => installSound(nullEngine))

  it('is the silent null engine until one is installed', () => {
    expect(getSound()).toBe(nullEngine)
    expect(nullEngine.unlocked).toBe(false)
    nullEngine.unlock()
    expect(nullEngine.unlocked).toBe(false)
    const stop = nullEngine.play('fanfare', { pitch: 3 })
    stop()
    nullEngine.setPrefs({ muted: true, volume: 1, music: false })
    nullEngine.startMusic()
    nullEngine.stopMusic()
    nullEngine.duck(0.2)
    nullEngine.suspend()
    nullEngine.resume()
    nullEngine.dispose()
    expect(nullEngine.levels()).toEqual({ master: 0, fx: 0, music: 0 })
  })

  it('returns the installed engine', () => {
    const engine = createSoundEngine({ createContext: () => null, now: () => 0 })
    installSound(engine)
    expect(getSound()).toBe(engine)
  })
})
