import { describe, expect, it } from 'vitest'
import { createGame } from '../../sim'
import type { GameState } from '../../sim'
import { PROFILE_KEY, mergeProfile, readProfile, recordProfile } from '../profile'

function memory(init: Record<string, string> = {}, fail = false) {
  const map = new Map(Object.entries(init))
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (fail) throw new Error('QuotaExceededError')
      map.set(k, v)
    },
  }
}

function withBadges(name: string, badges: GameState['badges']): GameState {
  return { ...createGame(name, 1), badges }
}

describe('the cross-save profile', () => {
  it('records each badge with its day, slot and pen name', () => {
    const s = memory()
    recordProfile(s, withBadges('Rin', [{ id: 'millionaire', day: 40 }]), 2)
    expect(readProfile(s).badges).toEqual([{ id: 'millionaire', day: 40, slot: 2, penName: 'Rin' }])
  })

  it('keeps the earliest record of a badge across careers', () => {
    const s = memory()
    recordProfile(s, withBadges('Rin', [{ id: 'millionaire', day: 400 }]), 1)
    recordProfile(s, withBadges('Aoi', [{ id: 'millionaire', day: 20 }, { id: 'century', day: 30 }]), 2)
    expect(readProfile(s).badges).toEqual([
      { id: 'millionaire', day: 400, slot: 1, penName: 'Rin' },
      { id: 'century', day: 30, slot: 2, penName: 'Aoi' },
    ])
    const p = readProfile(s)
    expect(mergeProfile(p, withBadges('Aoi', [{ id: 'century', day: 1 }]), 3)).toBe(p)
  })

  it('ignores garbage in the key and replaces it safely', () => {
    for (const junk of ['not json', '[]', '{"badges":7}', '{"badges":[{"id":"nope","day":1,"slot":1,"penName":"x"}]}']) {
      const s = memory({ [PROFILE_KEY]: junk })
      expect(readProfile(s)).toEqual({ badges: [] })
      recordProfile(s, withBadges('Rin', [{ id: 'century', day: 5 }]), 1)
      expect(JSON.parse(s.map.get(PROFILE_KEY)!)).toEqual({ badges: [{ id: 'century', day: 5, slot: 1, penName: 'Rin' }] })
    }
  })

  it('swallows a storage failure', () => {
    expect(() => recordProfile(memory({}, true), withBadges('Rin', [{ id: 'century', day: 5 }]), 1)).not.toThrow()
    expect(readProfile(null)).toEqual({ badges: [] })
  })
})
