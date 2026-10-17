// The music's playlist (0.13.0): which track of a pool plays next, and how long the crackle break between two tracks
// lasts. Pure and seeded, no state of its own: the player keeps the recent picks and the counter.
import { mix } from '../../sim'

const PICK_SALT = 0x51ab
const BREAK_SALT = 0x6c1d

/**
 * The next track of `pool`. The last two of `recent` are skipped in a pool of four or more, the last one in a pool of
 * two or three, none in a pool of one; the rest are chosen by hash of the seed and the counter. Should the skip
 * leave nothing (duplicate pool entries only), the whole pool is used. Throws on an empty pool.
 */
export function pickTrack<T extends string>(pool: readonly T[], recent: readonly T[], seed: number, n: number): T {
  if (pool.length === 0) throw new Error('pickTrack: the pool is empty')
  const skip = pool.length >= 4 ? 2 : pool.length >= 2 ? 1 : 0
  const avoid = skip > 0 ? recent.slice(-skip) : []
  const left = pool.filter((id) => !avoid.includes(id))
  const from = left.length > 0 ? left : pool
  return from[mix(seed, n, PICK_SALT) % from.length]
}

/** The crackle break after the n-th track, in seconds: 8 to 20, in thousandths. */
export function breakSeconds(seed: number, n: number): number {
  return 8 + (mix(seed, n, BREAK_SALT) % 12001) / 1000
}
