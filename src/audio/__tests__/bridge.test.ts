import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGame, getPhase, startProject, tick } from '../../sim'
import type { GameState } from '../../sim'
import { parseSave, serializeSave } from '../../state/saveFile'
import type { Speed } from '../../state/store'
import { installFakeStorage } from '../../test/fakeStorage'
import { createFakeSound } from '../../test/fakeSound'
import type { FakeSound } from '../../test/fakeSound'
import { DRAFT } from '../../test/fixtures'
import { connectSound } from '../bridge'
import type { SoundEngine } from '../engine'
import { installSound, nullEngine } from '../instance'
import { cuesForTransition } from '../triggers'
import { DEFAULT_SOUND } from '../types'

// The store's save storage and its debounce timer are faked before the store loads, as persist.test.ts does.
vi.useFakeTimers()
const storage = installFakeStorage()
const { useStore } = await import('../../state/store')
/** A fresh install's first game goes to slot 1. */
const SAVE_KEY = 'rising-mangaka-save-1'

const st = () => useStore.getState()

/** The event a fake target hands its listeners: the type, plus whatever a test adds (a pointerType). */
interface Fired { type: string; pointerType?: string }
type Listener = (e: Fired) => void
interface Entry { type: string; fn: Listener; capture: boolean }

/** A stand-in for the window: records its listeners by phase and fires them by hand. */
function fakeTarget() {
  const entries: Entry[] = []
  const find = (type: string, fn: Listener, capture: boolean) =>
    entries.findIndex((e) => e.type === type && e.fn === fn && e.capture === capture)
  return {
    addEventListener(type: string, fn: Listener, capture = false) {
      if (find(type, fn, capture) < 0) entries.push({ type, fn, capture })
    },
    removeEventListener(type: string, fn: Listener, capture = false) {
      const i = find(type, fn, capture)
      if (i >= 0) entries.splice(i, 1)
    },
    listeners(type: string) {
      const of = entries.filter((e) => e.type === type)
      return { capture: of.filter((e) => e.capture).length, bubble: of.filter((e) => !e.capture).length }
    },
    fire(type: string, init: Omit<Fired, 'type'> = {}) {
      for (const e of entries.filter((x) => x.type === type)) e.fn({ type, ...init })
    },
  }
}

/** Listener counts for pointerdown, pointerup and keydown, in that order. */
const gestureListeners = (win: ReturnType<typeof fakeTarget>) =>
  ['pointerdown', 'pointerup', 'keydown'].map((type) => win.listeners(type))
const ONE = { capture: 1, bubble: 0 }
const NONE = { capture: 0, bubble: 0 }

let sound: FakeSound
let disconnect: () => void = () => {}

/** Put `game` in the store at `speed`, then connect a fresh fake engine to it (no page). */
function start(game: GameState | null, speed: Speed = 0) {
  useStore.setState({ game, speed })
  sound = createFakeSound()
  disconnect = connectSound(useStore, sound, null)
}

/** Write a save of `game`, the way the owner tab leaves it in storage: slot 1, open in the index. */
function writeSave(game: GameState) {
  storage.setItem('rising-mangaka-slots', JSON.stringify({ active: 1 }))
  storage.setItem(
    SAVE_KEY,
    JSON.stringify({ version: 2, state: { game, theme: 'auto', resumeSpeed: 1, tutorialStep: 0, sound: DEFAULT_SOUND } }),
  )
}

/** The state one tick before the manuscript is ready. */
function oneTickFromReady(s: GameState): GameState {
  for (let guard = 0; getPhase(tick(s)) !== 'ready'; guard++) {
    if (guard > 400) throw new Error('oneTickFromReady: never ready')
    s = tick(s)
  }
  return s
}

beforeEach(() => {
  useStore.setState({
    game: null, speed: 0, resumeSpeed: 1, modal: 'none', toasts: [], readOnly: false, sound: DEFAULT_SOUND,
    windowHidden: false,
  })
})
afterEach(() => {
  disconnect()
  installSound(nullEngine)
})
afterAll(() => {
  vi.useRealTimers()
})

describe('connectSound: cues', () => {
  it('plays only start when a project starts, though the clock starts with it', () => {
    start(createGame('Rin', 42))
    st().startProject(DRAFT)
    expect(st().speed).toBe(1)
    expect(sound.plays).toEqual(['start'])
  })

  it('plays resume, click and pause for the speed controls', () => {
    start(createGame('Rin', 42))
    st().setSpeed(1)
    st().setSpeed(3)
    st().togglePause()
    expect(sound.plays).toEqual(['resume', 'click', 'pause'])
    // The music started once, when the bridge connected; no speed change touches it.
    expect(sound.music).toEqual(['start'])
  })

  it('plays ready, and no pause, when a tick finishes the manuscript and stops the clock', () => {
    start(oneTickFromReady(startProject(createGame('Rin', 42), DRAFT)), 1)
    st().tick()
    expect(st().speed).toBe(0)
    // The first manuscript's milestone lands on the same tick.
    expect(sound.plays).toEqual(['ready', 'milestone'])
  })

  it('stays silent in a read-only tab, and when a tab turns read-only or back', () => {
    const g = createGame('Rin', 42)
    start(g, 1)
    // The tab lock hands the save to another tab and stops this clock in the same update.
    useStore.setState({ readOnly: true, speed: 0 })
    // The other tab's play arrives as a mirror refresh.
    useStore.setState({ game: startProject(g, DRAFT) })
    // Turning read-only off is silent too, even with a speed change in the same update.
    useStore.setState({ readOnly: false, speed: 1 })
    expect(sound.plays).toEqual([])
    expect(sound.music).toEqual(['start', 'stop', 'start'])
  })

  it('stays silent when the window hides and shows, though hiding stops the clock', () => {
    start(createGame('Rin', 42), 2)
    // setWindowHidden suspends and resumes the shared engine; here that is the fake the bridge follows.
    installSound(sound)
    st().setWindowHidden(true)
    expect(st().speed).toBe(0)
    expect(sound.suspends).toBe(1)
    expect(sound.plays).toEqual([])
    st().setWindowHidden(false)
    expect(sound.resumes).toBe(1)
    expect(st().speed).toBe(0)
    expect(sound.plays).toEqual([])
    // The player's own resume afterwards sounds as usual.
    st().togglePause()
    expect(sound.plays).toEqual(['resume'])
  })

  it('plays nothing for a change made while the window is hidden, nor for one in the update that shows it', () => {
    const g = createGame('Rin', 42)
    start(g)
    useStore.setState({ windowHidden: true })
    // Each of these would sound in a shown window: 'start' for the project, 'resume' for the clock.
    useStore.setState({ game: startProject(g, DRAFT) })
    useStore.setState({ windowHidden: false, speed: 1 })
    expect(sound.plays).toEqual([])
    st().togglePause()
    expect(sound.plays).toEqual(['pause'])
  })

  it('stays silent when a game begins', () => {
    start(null)
    st().newGame('Rin')
    expect(st().game).not.toBeNull()
    expect(sound.plays).toEqual([])
    expect(sound.music).toEqual(['start'])
  })
})

describe('connectSound: loading a save', () => {
  // The same world on the same day with a one-shot started: one step of play apart, so the trigger guards let it
  // through and only the load check keeps it quiet.
  const before = createGame('Rin', 42)
  const saved = startProject(before, DRAFT)

  it('takeOver from a read-only tab restores a same-day save without a sound and starts the music', () => {
    start(before)
    useStore.setState({ readOnly: true, speed: 0 })
    writeSave(saved)
    st().takeOver()
    const loaded = st().game!
    expect(loaded.project?.title).toBe('Blade Club')
    expect(cuesForTransition(before, loaded)).toEqual(['start'])
    expect(sound.plays).toEqual([])
    expect(sound.music).toEqual(['start', 'stop', 'start'])
  })

  it('a save loaded in the owner tab over the same day plays nothing, and play after it sounds again', async () => {
    start(before)
    writeSave(saved)
    await useStore.persist.rehydrate()
    const loaded = st().game!
    expect(loaded.project?.title).toBe('Blade Club')
    expect(cuesForTransition(before, loaded)).toEqual(['start'])
    expect(sound.plays).toEqual([])
    st().setSpeed(1)
    expect(sound.plays).toEqual(['resume'])
  })

  it('a save file loaded over the same day plays nothing, and play after it sounds again', () => {
    start(before)
    const file = parseSave(serializeSave({ game: saved, tutorialStep: -1, resumeSpeed: 1 }))
    if (!file.ok) throw new Error(file.error)
    expect(st().loadSave(file.save)).toBe(true)
    const loaded = st().game!
    expect(loaded.project?.title).toBe('Blade Club')
    expect(cuesForTransition(before, loaded)).toEqual(['start'])
    expect(sound.plays).toEqual([])
    st().setSpeed(1)
    expect(sound.plays).toEqual(['resume'])
  })
})

describe('connectSound: prefs and music', () => {
  it('passes the prefs on, and the music follows mute and the music switch', () => {
    start(createGame('Rin', 42))
    expect(sound.prefs).toEqual([{ muted: false, volume: 0.5, music: true }])
    expect(sound.music).toEqual(['start'])
    st().setSound({ muted: true })
    expect(sound.prefs.at(-1)).toEqual({ muted: true, volume: 0.5, music: true })
    expect(sound.music).toEqual(['start', 'stop'])
    st().setSound({ muted: false })
    st().setSpeed(1)
    st().setSound({ music: false })
    // One setPrefs per prefs change, none for the speed change.
    expect(sound.prefs).toEqual([
      { muted: false, volume: 0.5, music: true },
      { muted: true, volume: 0.5, music: true },
      { muted: false, volume: 0.5, music: true },
      { muted: false, volume: 0.5, music: false },
    ])
    expect(sound.music).toEqual(['start', 'stop', 'start', 'stop'])
  })

  it('stops the music, silently, when the player goes back to the title screen', () => {
    start(createGame('Rin', 42), 1)
    st().backToTitle()
    expect(sound.music).toEqual(['start', 'stop'])
    expect(sound.plays).toEqual([])
  })
})

describe('connectSound: the page', () => {
  /** Connects `engine` (a fresh fake, `sound`, by default) with a fake window. */
  function connectPage(engine?: SoundEngine) {
    const win = fakeTarget()
    sound = createFakeSound()
    disconnect = connectSound(useStore, engine ?? sound, { window: win })
    return { win }
  }

  it('a touch unlocks on pointerup, not pointerdown, and listening goes on until the context runs', () => {
    const { win } = connectPage()
    expect(gestureListeners(win)).toEqual([ONE, ONE, ONE])
    win.fire('pointerdown', { pointerType: 'touch' })
    expect(sound.unlocks).toBe(0)
    win.fire('pointerup', { pointerType: 'touch' })
    expect(sound.unlocks).toBe(1)
    expect(gestureListeners(win)).toEqual([ONE, ONE, ONE])
    // The context runs now: the next gesture unlocks once more and is the last one heard.
    sound.running = true
    win.fire('keydown')
    expect(sound.unlocks).toBe(2)
    expect(gestureListeners(win)).toEqual([NONE, NONE, NONE])
  })

  it('a mouse unlocks on pointerdown', () => {
    const { win } = connectPage()
    win.fire('pointerdown', { pointerType: 'mouse' })
    expect(sound.unlocks).toBe(1)
  })

  it('keeps unlocking on each gesture while the context is not running', () => {
    const { win } = connectPage()
    win.fire('keydown')
    win.fire('keydown')
    expect(sound.unlocks).toBe(2)
    expect(gestureListeners(win)).toEqual([ONE, ONE, ONE])
  })

  it('stops listening after the first gesture when no context can ever exist', () => {
    const { win } = connectPage(nullEngine)
    win.fire('keydown')
    expect(gestureListeners(win)).toEqual([NONE, NONE, NONE])
  })

  it('disconnect stops following the store and the page', () => {
    useStore.setState({ game: createGame('Rin', 42) })
    const { win } = connectPage()
    disconnect()
    st().setSpeed(1)
    expect(sound.plays).toEqual([])
    expect(gestureListeners(win)).toEqual([NONE, NONE, NONE])
  })
})
