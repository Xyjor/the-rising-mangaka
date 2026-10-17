import { describe, expect, it } from 'vitest'
import { breakSeconds, pickTrack } from '../music/playlist'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`)

describe('pickTrack', () => {
  it('stays in the pool and avoids the excluded recent picks over 10k counters', () => {
    for (let size = 2; size <= 6; size++) {
      const pool = ids(size)
      const skip = size >= 4 ? 2 : 1
      const recent: string[] = []
      let bad = 0
      for (let n = 0; n < 10000; n++) {
        const pick = pickTrack(pool, recent, 7, n)
        if (!pool.includes(pick) || recent.slice(-skip).includes(pick)) bad++
        recent.push(pick)
      }
      expect(bad).toBe(0)
    }
  })

  it('returns the only track of a pool of one, even when it just played', () => {
    expect(pickTrack(['solo'], ['solo', 'solo'], 3, 5)).toBe('solo')
  })

  it('shares the picks fairly: each between half and double its even share', () => {
    for (let size = 2; size <= 6; size++) {
      const pool = ids(size)
      const counts = new Map<string, number>()
      const recent: string[] = []
      const total = 10000
      for (let n = 0; n < total; n++) {
        const pick = pickTrack(pool, recent, 11, n)
        counts.set(pick, (counts.get(pick) ?? 0) + 1)
        recent.push(pick)
      }
      for (const id of pool) {
        const share = (counts.get(id) ?? 0) / total
        expect(share).toBeGreaterThanOrEqual(0.5 / size)
        expect(share).toBeLessThanOrEqual(2 / size)
      }
    }
  })

  it('ignores recent ids outside the pool and is deterministic', () => {
    const pool = ids(3)
    expect(pickTrack(pool, ['x', 'y'], 1, 4)).toBe(pickTrack(pool, ['x', 'y'], 1, 4))
  })

  it('falls back to the whole pool when exclusion empties it', () => {
    expect(['a', 'a']).toContain(pickTrack(['a', 'a'], ['a'], 1, 0))
  })

  it('throws on an empty pool', () => {
    expect(() => pickTrack([], [], 1, 0)).toThrow()
  })
})

describe('breakSeconds', () => {
  it('lies in [8, 20], is deterministic and varies', () => {
    const seen = new Set<number>()
    for (let n = 0; n < 200; n++) {
      const s = breakSeconds(5, n)
      expect(s).toBeGreaterThanOrEqual(8)
      expect(s).toBeLessThanOrEqual(20)
      expect(breakSeconds(5, n)).toBe(s)
      seen.add(s)
    }
    expect(seen.size).toBeGreaterThanOrEqual(5)
  })
})
