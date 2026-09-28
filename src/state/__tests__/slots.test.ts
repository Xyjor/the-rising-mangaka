import { describe, expect, it } from 'vitest'
import { LEGACY_SAVE_KEY, PREFS_KEY, SLOT_INDEX_KEY, fingerprint, migrateLegacy, readIndex, slotKey, viewSlots, writeIndex } from '../slots'

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

  it('never overwrites a filled slot 1, and with no index does not trust it: the old key is read', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY, [slotKey(1)]: 'mine' })
    expect(migrateLegacy(s)).toEqual({ active: 1, legacy: true })
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

  it('records the copy in the index, and the index keeps it across slot changes', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY })
    migrateLegacy(s)
    writeIndex(s, 3)
    expect(JSON.parse(s.map.get(SLOT_INDEX_KEY)!)).toEqual({ active: 3, migratedFrom: fingerprint(LEGACY) })
  })

  it('refreshes an untouched slot 1 from an old save a fallback run kept playing', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY })
    migrateLegacy(s)
    const later = LEGACY.replace('"day":40', '"day":90')
    s.map.set(LEGACY_SAVE_KEY, later)
    expect(migrateLegacy(s)).toEqual({ active: 1, legacy: false })
    expect(s.map.get(slotKey(1))).toBe(later)
    expect(s.map.get(LEGACY_SAVE_KEY)).toBe(later)
    expect(JSON.parse(s.map.get(SLOT_INDEX_KEY)!).migratedFrom).toBe(fingerprint(later))
  })

  it('never refreshes a slot 1 that has been played since the copy', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY })
    migrateLegacy(s)
    s.map.set(slotKey(1), 'played on')
    s.map.set(LEGACY_SAVE_KEY, LEGACY + ' ')
    expect(migrateLegacy(s)).toEqual({ active: 1, legacy: false })
    expect(s.map.get(slotKey(1))).toBe('played on')
  })

  it('a failed refresh puts slot 1 back and reads the old key for this run', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY })
    migrateLegacy(s)
    const later = LEGACY + ' '
    s.map.set(LEGACY_SAVE_KEY, later)
    const setItem = s.setItem
    s.setItem = (k, v) => setItem(k, k === slotKey(1) && v === later ? v.slice(1) : v)
    expect(migrateLegacy(s)).toEqual({ active: 1, legacy: true })
    expect(s.map.get(slotKey(1))).toBe(LEGACY)
    expect(s.map.get(LEGACY_SAVE_KEY)).toBe(later)
  })

  it('an unverified copy whose rollback failed is never shown: the next start reads the old key', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY })
    const setItem = s.setItem
    s.setItem = (k, v) => setItem(k, k === slotKey(1) ? v.slice(1) : v)
    s.removeItem = () => { throw new Error('storage gone') }
    expect(migrateLegacy(s).legacy).toBe(true)
    expect(s.map.get(slotKey(1))).toBe(LEGACY.slice(1))
    expect(migrateLegacy(s)).toEqual({ active: 1, legacy: true })
    expect(s.map.get(LEGACY_SAVE_KEY)).toBe(LEGACY)
  })

  it('a tab that does not own the save only looks', () => {
    const s = memory({ [LEGACY_SAVE_KEY]: LEGACY })
    expect(viewSlots(s)).toEqual({ active: 1, legacy: true })
    expect(s.map.size).toBe(1)
    s.map.set(SLOT_INDEX_KEY, '{"active":2}')
    expect(viewSlots(s)).toEqual({ active: 2, legacy: false })
  })
})
