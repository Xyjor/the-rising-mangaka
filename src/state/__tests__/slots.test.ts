import { describe, expect, it } from 'vitest'
import { LEGACY_SAVE_KEY, PREFS_KEY, SLOT_INDEX_KEY, migrateLegacy, readIndex, slotKey } from '../slots'

function memory(init: Record<string, string> = {}, failOn: (key: string) => boolean = () => false) {
  const map = new Map(Object.entries(init))
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failOn(k)) throw new Error('QuotaExceededError')
      map.set(k, v)
    },
    removeItem: (k: string) => { map.delete(k) },
  }
}

const LEGACY = JSON.stringify({
  version: 2,
  state: { game: { player: { name: 'Rin' }, day: 40 }, theme: 'dark', resumeSpeed: 2, tutorialStep: -1,
    sound: { muted: true, volume: 0.3, music: false } },
})

describe('migrateLegacy', () => {
  it('copies the old save into slot 1 byte for byte, keeps the old key, and opens slot 1', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY })
    expect(migrateLegacy(s)).toEqual({ active: 1, legacy: false })
    expect(s.map.get(slotKey(1))).toBe(LEGACY)
    expect(s.map.get(LEGACY_SAVE_KEY)).toBe(LEGACY)
    expect(readIndex(s)).toBe(1)
    expect(JSON.parse(s.map.get(PREFS_KEY)!)).toEqual({ theme: 'dark', sound: { muted: true, volume: 0.3, music: false } })
  })

  it('keeps prefs that already exist', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY, [PREFS_KEY]: '{"theme":"light"}' })
    migrateLegacy(s)
    expect(s.map.get(PREFS_KEY)).toBe('{"theme":"light"}')
  })

  it('never overwrites a filled slot 1', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY, [slotKey(1)]: 'mine' })
    expect(migrateLegacy(s).legacy).toBe(false)
    expect(s.map.get(slotKey(1))).toBe('mine')
    expect(s.map.get(LEGACY_SAVE_KEY)).toBe(LEGACY)
  })

  it('does not copy again once the slots are set up (a deleted slot 1 stays deleted)', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY, [SLOT_INDEX_KEY]: '{"active":2}' })
    expect(migrateLegacy(s)).toEqual({ active: 2, legacy: false })
    expect(s.map.has(slotKey(1))).toBe(false)
  })

  it('leaves everything as it was and falls back to the old key when a write throws', () => {
    for (const bad of [slotKey(1), PREFS_KEY, SLOT_INDEX_KEY]) {
      const s = memory({ [LEGACY_SAVE_KEY]: LEGACY }, (k) => k === bad)
      expect(migrateLegacy(s)).toEqual({ active: 1, legacy: true })
      expect([...s.map.entries()]).toEqual([[LEGACY_SAVE_KEY, LEGACY]])
    }
  })

  it('falls back when the read-back differs', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY })
    const setItem = s.setItem
    s.setItem = (k, v) => setItem(k, k === slotKey(1) ? v.slice(1) : v)
    expect(migrateLegacy(s).legacy).toBe(true)
    expect([...s.map.entries()]).toEqual([[LEGACY_SAVE_KEY, LEGACY]])
  })

  it('a fresh install has no open slot and no slots', () => {
    const s = memory()
    expect(migrateLegacy(s)).toEqual({ active: null, legacy: false })
    expect(s.map.size).toBe(0)
  })
})
