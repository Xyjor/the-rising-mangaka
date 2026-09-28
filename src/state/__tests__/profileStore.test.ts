import { describe, expect, it, vi } from 'vitest'
import { createGame } from '../../sim'
import type { GameState } from '../../sim'
import { installFakeStorage } from '../../test/fakeStorage'

vi.useFakeTimers()
const storage = installFakeStorage()
const { useStore } = await import('../store')
const { OWNER_KEY } = await import('../tabLock')
const { PROFILE_KEY, readProfile } = await import('../profile')
const { SAVE_VERSION } = await import('../saveFile')

const rich = () => {
  const g = createGame('Rin', 7)
  return { ...g, player: { ...g.player, money: 1_000_000 } }
}

/** A fresh install's first game goes to slot 1. */
const SAVE_KEY = 'rising-mangaka-save-1'

/** Writes a career straight into the slot's save key, as an earlier session (or an old save on disk) left it. */
function writeCareer(game: GameState) {
  storage.setItem(SAVE_KEY, JSON.stringify({
    state: { game, theme: 'auto', resumeSpeed: 1, tutorialStep: -1, sound: undefined }, version: SAVE_VERSION,
  }))
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

  it('records a badge an old save already had, quietly granted by upgradeSave, as soon as this tab hydrates it', () => {
    storage.removeItem(PROFILE_KEY)
    storage.removeItem(OWNER_KEY)
    useStore.setState({ readOnly: false, game: null })
    writeCareer({ ...rich(), badges: [{ id: 'century', day: 5 }] })
    void useStore.persist.rehydrate()
    expect(readProfile(storage).badges).toContainEqual(
      expect.objectContaining({ id: 'century', slot: 1, penName: 'Rin' }),
    )
  })

  it('a read-only tab never records badges from hydration either', () => {
    storage.removeItem(PROFILE_KEY)
    storage.setItem(OWNER_KEY, JSON.stringify({ tabId: 'the-owner', at: Date.now() }))
    useStore.setState({ readOnly: true })
    writeCareer({ ...rich(), badges: [{ id: 'century', day: 5 }] })
    void useStore.persist.rehydrate()
    expect(storage.getItem(PROFILE_KEY)).toBeNull()
  })
})
