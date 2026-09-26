import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installSound, nullEngine } from '../../audio/instance'
import { createGame } from '../../sim'
import { createFakeSound } from '../../test/fakeSound'
import type { FakeSound } from '../../test/fakeSound'
import { useStore } from '../store'

const st = () => useStore.getState()
let sound: FakeSound

beforeEach(() => {
  sound = createFakeSound()
  installSound(sound)
  useStore.setState({ game: createGame('Rin', 42), speed: 0, resumeSpeed: 1, modal: 'none', windowHidden: false })
})
afterEach(() => installSound(nullEngine))

describe('setWindowHidden', () => {
  it('hiding stops the clock and suspends the sound; showing resumes the sound and leaves the clock stopped', () => {
    st().setSpeed(2)
    st().setWindowHidden(true)
    expect(st().speed).toBe(0)
    expect(st().windowHidden).toBe(true)
    expect([sound.suspends, sound.resumes]).toEqual([1, 0])

    st().setWindowHidden(false)
    expect(st().speed).toBe(0)
    expect(st().windowHidden).toBe(false)
    expect([sound.suspends, sound.resumes]).toEqual([1, 1])
  })

  it('keeps the running speed for Space, so the player resumes where they were', () => {
    // A clock started by setState (as an auto-resume can) leaves resumeSpeed behind; hiding takes the live speed.
    useStore.setState({ speed: 3, resumeSpeed: 1 })
    st().setWindowHidden(true)
    expect(st().resumeSpeed).toBe(3)
    st().setWindowHidden(false)
    st().togglePause()
    expect(st().speed).toBe(3)
  })

  it('hiding a stopped clock keeps its resumeSpeed', () => {
    useStore.setState({ speed: 0, resumeSpeed: 2 })
    st().setWindowHidden(true)
    expect(st().speed).toBe(0)
    expect(st().resumeSpeed).toBe(2)
  })

  it('a second call with the same value changes nothing', () => {
    st().setSpeed(1)
    st().setWindowHidden(true)
    const hidden = st()
    st().setWindowHidden(true)
    expect(st()).toBe(hidden)
    expect(sound.suspends).toBe(1)

    st().setWindowHidden(false)
    const shown = st()
    st().setWindowHidden(false)
    expect(st()).toBe(shown)
    expect(sound.resumes).toBe(1)
  })

  it('showing a window that was never hidden changes nothing', () => {
    st().setSpeed(2)
    const before = st()
    st().setWindowHidden(false)
    expect(st()).toBe(before)
    expect([sound.suspends, sound.resumes]).toEqual([0, 0])
  })
})
