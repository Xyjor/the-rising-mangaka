import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGame } from '../../sim'
import type { GameState } from '../../sim'
import { installFakeStorage } from '../../test/fakeStorage'

vi.useFakeTimers()
const storage = installFakeStorage()
// An install from before the slots: the one old save, with its theme.
const LEGACY = JSON.stringify({
  version: 2,
  state: { game: createGame('Old Rin', 5), theme: 'dark', resumeSpeed: 2, tutorialStep: -1 },
})
storage.setItem('rising-mangaka-save', LEGACY)
const { useStore, slotRaw } = await import('../store')
const { OWNER_KEY } = await import('../tabLock')
const { LEGACY_SAVE_KEY, SLOT_INDEX_KEY, slotKey } = await import('../slots')

const st = () => useStore.getState()
const saved = (n: 1 | 2 | 3) => (JSON.parse(storage.getItem(slotKey(n))!) as { state: { game: GameState } }).state.game

describe('store slots', () => {
  beforeEach(() => {
    storage.removeItem(OWNER_KEY)
    useStore.setState({ readOnly: false })
  })

  it('opens the old save from slot 1 at startup, and the old key stays as it was', () => {
    expect(st().activeSlot).toBe(1)
    expect(st().game?.player.name).toBe('Old Rin')
    expect(st().theme).toBe('dark')
    expect(storage.getItem(slotKey(1))).toBe(LEGACY)
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(LEGACY)
  })

  it('startInSlot writes a new career to an empty slot and refuses a filled one', () => {
    expect(st().startInSlot(1, 'Nope')).toBe(false)
    expect(st().startInSlot(2, 'Aoi')).toBe(true)
    expect(st().activeSlot).toBe(2)
    expect(saved(2).player.name).toBe('Aoi')
    expect(JSON.parse(storage.getItem(SLOT_INDEX_KEY)!)).toEqual({ active: 2 })
    expect(storage.getItem(slotKey(1))).toBe(LEGACY)
  })

  it('openSlot flushes the waiting write into the old slot before switching', () => {
    st().tick()
    st().tick()
    const day = st().game!.day
    expect(saved(2).day).toBeLessThan(day) // still waiting on the debounce
    expect(st().openSlot(1)).toBe(true)
    expect(saved(2).day).toBe(day)
    expect(st().game?.player.name).toBe('Old Rin')
    vi.advanceTimersByTime(2000)
    expect(saved(2).day).toBe(day)
    expect(saved(1).player.name).toBe('Old Rin')
    expect(st().activeSlot).toBe(1)
  })

  it('openSlot refuses an empty slot', () => {
    expect(st().openSlot(3)).toBe(false)
    expect(st().activeSlot).toBe(1)
  })

  it('backToTitle keeps the career in its slot', () => {
    st().tick()
    const day = st().game!.day
    expect(st().backToTitle()).toBe(true)
    expect(st().game).toBeNull()
    expect(st().activeSlot).toBeNull()
    expect(saved(1).day).toBe(day)
    expect(JSON.parse(storage.getItem(SLOT_INDEX_KEY)!)).toEqual({ active: null })
  })

  it('loadSaveIntoSlot writes another slot without opening it', () => {
    expect(st().loadSaveIntoSlot(3, { game: createGame('File', 9), tutorialStep: 0, resumeSpeed: 1 })).toBe(true)
    expect(saved(3).player.name).toBe('File')
    expect(st().game).toBeNull()
    expect(slotRaw(3)).not.toBeNull()
  })

  it('deleteSlot removes a slot, never the old key and never the open slot', () => {
    expect(st().deleteSlot(1)).toBe(true)
    expect(storage.getItem(slotKey(1))).toBeNull()
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(LEGACY)
    expect(st().openSlot(2)).toBe(true)
    expect(st().deleteSlot(2)).toBe(false)
    expect(storage.getItem(slotKey(2))).not.toBeNull()
  })

  it('a read-only tab cannot open, start, delete or leave a slot', () => {
    storage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'someone-else', at: Date.now() }))
    useStore.setState({ readOnly: true })
    expect(st().openSlot(3)).toBe(false)
    expect(st().startInSlot(1, 'X')).toBe(false)
    expect(st().deleteSlot(3)).toBe(false)
    expect(st().backToTitle()).toBe(false)
    expect(st().loadSaveIntoSlot(3, { game: createGame('Y', 1), tutorialStep: 0, resumeSpeed: 1 })).toBe(false)
    expect(st().activeSlot).toBe(2)
    expect(saved(3).player.name).toBe('File')
  })
})
