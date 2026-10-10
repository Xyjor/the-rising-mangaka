// The idle schedule is pure integer hashing: node environment, literal values.
import { describe, expect, it } from 'vitest'
import { IDLE_MIN_MS, IDLE_SPAN_MS, mix, nextIdle } from '../idleSchedule'

describe('the idle schedule', () => {
  it('hashes three integers to one unsigned 32-bit integer, every input moving it', () => {
    expect([mix(0, 0, 0), mix(1, 0, 0), mix(0, 1, 0), mix(0, 0, 1)]).toEqual([2409258929, 3753189852, 2503628413, 2510855047])
  })

  it('gives each moment of the day a wait of 6 to 14 s and a pick, seeded by the day, the character and the count', () => {
    expect(nextIdle(0, 0, 0)).toEqual({ gapMs: 8929, pick: 36762 })
    expect(nextIdle(12, 0, 0)).toEqual({ gapMs: 9238, pick: 61578 })
    expect(nextIdle(12, 0, 1)).toEqual({ gapMs: 6758, pick: 4921 })
    expect(nextIdle(12, 0, 2)).toEqual({ gapMs: 6814, pick: 2131 })
    expect(nextIdle(12, 2, 0)).toEqual({ gapMs: 9817, pick: 9292 })
    expect(nextIdle(400, 3, 7)).toEqual({ gapMs: 13475, pick: 46130 })
  })

  it('stays inside its range over a year, and repeats exactly for the same inputs', () => {
    expect([IDLE_MIN_MS, IDLE_SPAN_MS]).toEqual([6000, 8000])
    let lo = Infinity
    let hi = -Infinity
    for (let day = 0; day < 336; day++) {
      for (let who = 0; who < 4; who++) {
        for (let n = 0; n < 20; n++) {
          const { gapMs } = nextIdle(day, who, n)
          lo = Math.min(lo, gapMs)
          hi = Math.max(hi, gapMs)
        }
      }
    }
    expect([lo, hi]).toEqual([6000, 13999])
    expect(nextIdle(77, 1, 5)).toEqual(nextIdle(77, 1, 5))
  })
})
