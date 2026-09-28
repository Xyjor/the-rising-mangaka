import { describe, expect, it, vi } from 'vitest'
import { createGame } from '../../sim'
import { installFakeStorage } from '../../test/fakeStorage'

// Another tab owns the save and is still playing the old single save (a fallback run): this tab must not migrate.
vi.useFakeTimers()
const storage = installFakeStorage()
const LEGACY = JSON.stringify({ version: 2, state: { game: createGame('Old Rin', 5), theme: 'dark', resumeSpeed: 1, tutorialStep: 0 } })
storage.setItem('rising-mangaka-save', LEGACY)
storage.setItem('rising-mangaka-owner', JSON.stringify({ tabId: 'the-owner', at: Date.now() }))
storage.setItem.mockClear()
const { useStore } = await import('../store')

describe('a tab that does not own the save at its start', () => {
  it('mirrors the old save and writes nothing', () => {
    expect(useStore.getState().game?.player.name).toBe('Old Rin')
    expect(storage.setItem.mock.calls.filter(([k]) => k !== 'rising-mangaka-owner')).toEqual([])
    expect(storage.getItem('rising-mangaka-slots')).toBeNull()
  })

  it('migrates once it takes over', () => {
    useStore.setState({ readOnly: true })
    useStore.getState().takeOver()
    expect(storage.getItem('rising-mangaka-save-1')).toBe(LEGACY)
    expect(JSON.parse(storage.getItem('rising-mangaka-slots')!).active).toBe(1)
    expect(useStore.getState().activeSlot).toBe(1)
    expect(useStore.getState().game?.player.name).toBe('Old Rin')
    expect(storage.getItem('rising-mangaka-save')).toBe(LEGACY)
  })
})
