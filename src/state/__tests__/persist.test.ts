import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGame, tick as simTick } from '../../sim'
import type { GameState } from '../../sim'
import { DEFAULT_SOUND } from '../../audio/types'
import type { SoundPrefs } from '../../audio/types'
import { installFakeStorage } from '../../test/fakeStorage'

vi.useFakeTimers()
const storage = installFakeStorage()
const { SAVE_KEY, useStore } = await import('../store')
const { OWNER_KEY } = await import('../tabLock')
const { upgradeSave } = await import('../../sim/migrate')

const saveWrites = () => storage.setItem.mock.calls.filter(([k]) => k === SAVE_KEY)
const lastSave = () =>
  JSON.parse(saveWrites().at(-1)![1]) as { version: number; state: { game: GameState | null; sound: SoundPrefs } }

describe('persistence', () => {
  beforeAll(() => { vi.useFakeTimers() })
  afterAll(() => { vi.useRealTimers() })
  beforeEach(() => { storage.setItem.mockClear() })

  it('does not write when only UI state changes', () => {
    useStore.setState({ modal: 'stats' })
    expect(saveWrites()).toHaveLength(0)
  })

  it('writes immediately when a game starts', () => {
    useStore.setState({ game: createGame('A', 1) })
    expect(saveWrites()).toHaveLength(1)
    expect(lastSave().state.game?.player.name).toBe('A')
  })

  it('debounces ticks into one write that trims the log', () => {
    for (let i = 0; i < 5; i++) useStore.getState().tick()
    expect(saveWrites()).toHaveLength(0)
    vi.advanceTimersByTime(800)
    expect(saveWrites()).toHaveLength(1)
    const saved = lastSave()
    expect(saved.state.game?.day).toBe(5)
    expect(saved.state.game!.log.length).toBeLessThanOrEqual(80)
    expect(useStore.getState().game?.day).toBe(5)
  })

  it('keeps the log trim to the save, not the live state', () => {
    let g = useStore.getState().game!
    for (let i = 0; i < 120; i++) g = simTick(g)
    useStore.setState({ game: g })
    vi.advanceTimersByTime(800)
    expect(lastSave().state.game!.log.length).toBeLessThanOrEqual(80)
    expect(useStore.getState().game!.log.length).toBe(g.log.length)
  })

  it('never writes while another tab owns the save', () => {
    storage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'someone-else', at: Date.now() }))
    storage.setItem.mockClear()
    useStore.getState().tick()
    vi.advanceTimersByTime(800)
    expect(saveWrites()).toHaveLength(0)
    storage.removeItem(OWNER_KEY)
  })

  it('debounces a sound-only change into one write', () => {
    useStore.getState().setSound({ muted: true })
    expect(saveWrites()).toHaveLength(0)
    vi.advanceTimersByTime(800)
    expect(saveWrites()).toHaveLength(1)
    expect(lastSave().state.sound).toEqual({ muted: true, volume: 0.5, music: true })
  })

  it('fills fields an older save lacks on rehydrate', async () => {
    const original = createGame('Old', 9)
    const stale = { ...original } as Partial<GameState>
    delete stale.recovering
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, state: { game: stale, theme: 'auto', resumeSpeed: 1, tutorialStep: 0 } }))
    await useStore.persist.rehydrate()
    const game = useStore.getState().game!
    expect(game.recovering).toBe(false)
    expect(game).toEqual(original)
  })

  it('defaults sound prefs when a v2 save has none', async () => {
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, state: { game: null, theme: 'auto', resumeSpeed: 1, tutorialStep: 0 } }))
    await useStore.persist.rehydrate()
    expect(useStore.getState().sound).toEqual(DEFAULT_SOUND)
  })

  it('clamps an out-of-range saved volume on rehydrate', async () => {
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 2,
        state: { game: null, theme: 'auto', resumeSpeed: 1, tutorialStep: 0, sound: { muted: false, volume: 7, music: true } },
      }),
    )
    await useStore.persist.rehydrate()
    expect(useStore.getState().sound.volume).toBe(1)
  })
})

describe('upgradeSave', () => {
  it('keeps every field the save has and defaults the ones it lacks', () => {
    const g = createGame('Keep', 3)
    const played = { ...simTick(simTick(g)), recovering: true }
    const partial = { ...played } as Partial<GameState>
    delete partial.recovering
    delete partial.trip
    const partialPlayer = { ...played.player } as Partial<GameState['player']>
    delete partialPlayer.fans
    partial.player = partialPlayer as GameState['player']
    const up = upgradeSave(partial as GameState)
    expect(up.recovering).toBe(false)
    expect(up.trip).toBeNull()
    expect(up.player.fans).toBe(0)
    for (const key of Object.keys(partial) as (keyof GameState)[]) {
      if (key === 'player') continue
      expect(up[key]).toEqual(partial[key])
    }
    for (const key of Object.keys(partialPlayer) as (keyof GameState['player'])[]) {
      expect(up.player[key]).toEqual(partialPlayer[key])
    }
    // The live RNG seed and world seed come from the save, never from createGame('', 0).
    expect(up.seed).toBe(played.seed)
    expect(up.worldSeed).toBe(played.worldSeed)
    expect(up.player.name).toBe('Keep')
  })
})
