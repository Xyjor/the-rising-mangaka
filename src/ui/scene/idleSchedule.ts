// The idle schedule (0.11.0): when a character's next idle moment comes and which one, seeded by the game day, the
// character and how many moments it has had that day. Pure integer hashing: no Math.random, no clock. The hash, `mix`,
// lives in the sim's rng (0.13.0, shared with the music) and is re-exported here.
import { mix } from '../../sim/rng'

export { mix }

/** The shortest wait between two idle moments, and how much longer it may be (ms). */
export const IDLE_MIN_MS = 6000
export const IDLE_SPAN_MS = 8000

/**
 * The n-th idle moment of the day for character `who` (0 the mangaka, 1-3 the assistants' seats): the wait before it,
 * IDLE_MIN_MS to IDLE_MIN_MS + IDLE_SPAN_MS - 1, and a pick the caller takes modulo its pool's length.
 */
export function nextIdle(day: number, who: number, n: number): { gapMs: number; pick: number } {
  const h = mix(day, who, n)
  return { gapMs: IDLE_MIN_MS + (h % IDLE_SPAN_MS), pick: h >>> 16 }
}
