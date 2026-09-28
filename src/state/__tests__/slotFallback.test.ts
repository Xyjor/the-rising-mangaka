import { describe, expect, it, vi } from 'vitest'
import { createGame } from '../../sim'
import { installFakeStorage } from '../../test/fakeStorage'

// Slot 1 cannot be written (a full quota, say): the copy fails and the game loads from the old key as before.
vi.useFakeTimers()
const storage = installFakeStorage()
const LEGACY = JSON.stringify({ version: 2, state: { game: createGame('Old Rin', 5), theme: 'dark', resumeSpeed: 1, tutorialStep: 0 } })
storage.setItem('rising-mangaka-save', LEGACY)
const setItem = storage.setItem.getMockImplementation()!
storage.setItem.mockImplementation((k: string, v: string) => {
  if (k === 'rising-mangaka-save-1') throw new Error('QuotaExceededError')
  setItem(k, v)
})
const { useStore, isLegacyFallback } = await import('../store')

describe('the fallback to the old save', () => {
  it('loads the old save exactly as before and leaves the slot keys alone', () => {
    expect(isLegacyFallback()).toBe(true)
    expect(useStore.getState().game?.player.name).toBe('Old Rin')
    expect(useStore.getState().theme).toBe('dark')
    expect(storage.getItem('rising-mangaka-save-1')).toBeNull()
    expect(storage.getItem('rising-mangaka-slots')).toBeNull()
    expect(storage.getItem('rising-mangaka-save')).toBe(LEGACY)
  })

  it('never lets slot 1 (the old save) be deleted', () => {
    expect(useStore.getState().deleteSlot(1)).toBe(false)
    expect(storage.getItem('rising-mangaka-save')).toBe(LEGACY)
  })
})
