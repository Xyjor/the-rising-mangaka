import { describe, expect, it, vi } from 'vitest'
import { createGame } from '../../sim'
import { installFakeStorage } from '../../test/fakeStorage'

vi.useFakeTimers()
const storage = installFakeStorage()
const { useStore } = await import('../store')
const { OWNER_KEY } = await import('../tabLock')
const { PROFILE_KEY, readProfile } = await import('../profile')

const rich = () => {
  const g = createGame('Rin', 7)
  return { ...g, player: { ...g.player, money: 1_000_000 } }
}

describe('the store and the profile', () => {
  it('the owner tab records a badge earned on a tick', () => {
    expect(useStore.getState().startInSlot(1, 'Rin')).toBe(true)
    useStore.setState({ game: rich() })
    useStore.getState().tick()
    expect(readProfile(storage).badges).toEqual([
      expect.objectContaining({ id: 'millionaire', slot: 1, penName: 'Rin' }),
    ])
  })

  it('a read-only tab never writes the profile', () => {
    storage.removeItem(PROFILE_KEY)
    storage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'the-owner', at: Date.now() }))
    useStore.setState({ readOnly: true, game: rich() })
    useStore.getState().tick()
    expect(useStore.getState().game!.badges.map((b) => b.id)).toContain('millionaire')
    expect(storage.getItem(PROFILE_KEY)).toBeNull()
  })
})
