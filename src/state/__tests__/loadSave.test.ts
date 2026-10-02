import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGame, tickMany } from '../../sim'
import type { GameState } from '../../sim'
import { installFakeStorage } from '../../test/fakeStorage'
import { parseSave, serializeSave } from '../saveFile'
import type { SaveFile } from '../saveFile'

// The save storage and its debounce timer are faked before the store loads, as persist.test.ts does.
vi.useFakeTimers()
const storage = installFakeStorage()
const { useStore } = await import('../store')
/** A fresh install's first game goes to slot 1. */
const SAVE_KEY = 'rising-mangaka-save-1'
const { OWNER_KEY } = await import('../tabLock')

const st = () => useStore.getState()
const saveWrites = () => storage.setItem.mock.calls.filter(([k]) => k === SAVE_KEY)
const lastSave = () =>
  JSON.parse(saveWrites().at(-1)![1]) as { version: number; state: { game: GameState; tutorialStep: number } }

/** A save file of `game` run through the file format and back, as the Load button hands it to the store. */
function fileOf(game: GameState, tutorialStep = -1, resumeSpeed: 1 | 2 | 3 = 2): SaveFile {
  const r = parseSave(serializeSave({ game, tutorialStep, resumeSpeed }, new Date('2026-09-25T12:00:00.000Z')))
  if (!r.ok) throw new Error(r.error)
  return r.save
}

const playing = createGame('Rin', 42)

beforeEach(() => {
  storage.removeItem(OWNER_KEY)
  useStore.setState({
    game: playing, speed: 2, resumeSpeed: 1, modal: 'settings', tutorialStep: 2, readOnly: false,
    toasts: [{ id: 1, kind: 'info', text: 'An old toast' }],
  })
  vi.advanceTimersByTime(800)
  storage.setItem.mockClear()
})
afterAll(() => {
  vi.useRealTimers()
})

describe('loadSave', () => {
  it('resumes the tutorial step against the game it installs, even for a file that skipped parseSave', () => {
    // A leftover step 0 on a played career ends the tutorial; a step of the game's phase stays.
    expect(st().loadSave({ game: tickMany(createGame('Rin', 42), 30), tutorialStep: 0, resumeSpeed: 1 })).toBe(true)
    expect(st().tutorialStep).toBe(-1)
    expect(st().loadSave({ game: tickMany(createGame('Rin', 42), 30), tutorialStep: 9, resumeSpeed: 1 })).toBe(true)
    expect(st().tutorialStep).toBe(9)
  })

  it('installs the game, its tutorial step and speed, stops the clock, closes the modal and toasts', () => {
    const file = fileOf(tickMany(createGame('Rin', 42), 30))
    const loadsBefore = st().saveLoads
    expect(st().loadSave(file)).toBe(true)
    expect(st().game).toBe(file.game)
    expect(st().game?.day).toBe(30)
    expect(st().tutorialStep).toBe(-1)
    expect(st().resumeSpeed).toBe(2)
    expect(st().speed).toBe(0)
    expect(st().modal).toBe('none')
    expect(st().toasts.map((t) => t.text)).toEqual(['Save loaded'])
    expect(st().saveLoads).toBe(loadsBefore + 1)
  })

  it('writes the save once, at once, for a save of the same career', () => {
    // Same world, so the store's replaced-game check does not flush it: loadSave does.
    const file = fileOf(tickMany(createGame('Rin', 42), 30))
    st().loadSave(file)
    expect(saveWrites()).toHaveLength(1)
    expect(lastSave().state.game.day).toBe(30)
    expect(lastSave().state.tutorialStep).toBe(-1)
    vi.advanceTimersByTime(800)
    expect(saveWrites()).toHaveLength(1)
  })

  it('writes the save once, at once, for another career', () => {
    st().loadSave(fileOf(createGame('Aoi', 7)))
    expect(saveWrites()).toHaveLength(1)
    expect(lastSave().state.game.player.name).toBe('Aoi')
    vi.advanceTimersByTime(800)
    expect(saveWrites()).toHaveLength(1)
  })

  it('is refused in a read-only tab', () => {
    useStore.setState({ readOnly: true, speed: 0 })
    storage.setItem.mockClear()
    const before = st()
    expect(st().loadSave(fileOf(createGame('Aoi', 7)))).toBe(false)
    expect(st()).toBe(before)
    vi.advanceTimersByTime(800)
    expect(saveWrites()).toHaveLength(0)
  })

  it('is refused while another tab owns the save', () => {
    storage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'someone-else', at: Date.now() }))
    storage.setItem.mockClear()
    const before = st()
    expect(st().loadSave(fileOf(createGame('Aoi', 7)))).toBe(false)
    expect(st()).toBe(before)
    expect(st().game).toBe(playing)
    vi.advanceTimersByTime(800)
    expect(saveWrites()).toHaveLength(0)
  })
})
