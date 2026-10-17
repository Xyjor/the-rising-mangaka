import { afterEach, describe, expect, it } from 'vitest'
import { createSoundEngine } from '../engine'
import { createFakeSound } from '../../test/fakeSound'
import { getSound, holdDuck, installSound, nullEngine } from '../instance'

describe('shared sound engine', () => {
  afterEach(() => installSound(nullEngine))

  it('is the silent null engine until one is installed', () => {
    expect(getSound()).toBe(nullEngine)
    expect(nullEngine.unlocked).toBe(false)
    nullEngine.unlock()
    expect(nullEngine.unlocked).toBe(false)
    expect(nullEngine.running).toBe(false)
    const stop = nullEngine.play('fanfare', { pitch: 3 })
    stop()
    nullEngine.setPrefs({ muted: true, volume: 1, music: false })
    nullEngine.startMusic()
    nullEngine.stopMusic()
    nullEngine.setMusicScene({ mood: 'studio', season: 'winter', calm: true })
    nullEngine.pinMusicTrack('kotatsu')
    nullEngine.pinMusicTrack(null)
    nullEngine.duck(0.2)
    nullEngine.suspend()
    nullEngine.resume()
    nullEngine.dispose()
    expect(nullEngine.levels()).toEqual({ master: 0, fx: 0, music: 0 })
  })

  it('a fake sound records each music scene and pin it is given, in order', () => {
    const fake = createFakeSound()
    const scene = { mood: 'studio', season: 'autumn', calm: false } as const
    fake.setMusicScene(scene)
    fake.pinMusicTrack('screentone')
    fake.pinMusicTrack(null)
    expect(fake.scenes).toEqual([{ mood: 'studio', season: 'autumn', calm: false }])
    expect(fake.scenes[0]).not.toBe(scene)
    expect(fake.pins).toEqual(['screentone', null])
  })

  it('returns the installed engine', () => {
    const engine = createSoundEngine({ createContext: () => null, now: () => 0 })
    installSound(engine)
    expect(getSound()).toBe(engine)
  })
})

describe('holdDuck', () => {
  afterEach(() => installSound(nullEngine))

  it('ducks while held and restores on release', () => {
    const fake = createFakeSound()
    installSound(fake)
    const release = holdDuck(0.6)
    expect(fake.ducks).toEqual([0.6])
    release()
    expect(fake.ducks).toEqual([0.6, 1])
  })

  it('lets the deepest nested hold win', () => {
    const fake = createFakeSound()
    installSound(fake)
    const a = holdDuck(0.6)
    const b = holdDuck(0.3)
    expect(fake.ducks).toEqual([0.6, 0.3])
    b()
    expect(fake.ducks).toEqual([0.6, 0.3, 0.6])
    a()
    expect(fake.ducks).toEqual([0.6, 0.3, 0.6, 1])
  })

  it('keeps the deeper hold when the outer one is released first', () => {
    const fake = createFakeSound()
    installSound(fake)
    const a = holdDuck(0.6)
    const b = holdDuck(0.3)
    a()
    expect(fake.ducks).toEqual([0.6, 0.3, 0.3])
    b()
    expect(fake.ducks).toEqual([0.6, 0.3, 0.3, 1])
  })

  it('ignores a second release', () => {
    const fake = createFakeSound()
    installSound(fake)
    const release = holdDuck(0.6)
    release()
    release()
    expect(fake.ducks).toEqual([0.6, 1])
  })
})
