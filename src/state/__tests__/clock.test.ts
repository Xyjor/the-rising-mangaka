import { beforeEach, describe, expect, it } from 'vitest'
import {
  advanceClock, isNight, markLogSeen, syncClockToDay, unreadLogCount, useClock, weekT,
} from '../clock'

beforeEach(() => {
  useClock.setState({ day: 0, fraction: 0, t: 0, logSeenId: 0 })
})

describe('weekT', () => {
  it('is day plus fraction over 7', () => {
    expect(weekT(3, 0.5)).toBe(0.5)
  })

  it('wraps a week boundary to 0', () => {
    expect(weekT(7, 0)).toBe(0)
  })

  it('a day near the end of the week with a near-full fraction stays under 1', () => {
    expect(weekT(6, 0.999)).toBeCloseTo(0.99986, 5)
  })
})

describe('isNight', () => {
  it('is true after NIGHT_AFTER', () => {
    expect(isNight(0.8)).toBe(true)
  })

  it('is true before NIGHT_UNTIL', () => {
    expect(isNight(0.05)).toBe(true)
  })

  it('is true at 0', () => {
    expect(isNight(0)).toBe(true)
  })

  it('is false at midday', () => {
    expect(isNight(0.5)).toBe(false)
  })

  it('is false exactly at NIGHT_AFTER', () => {
    expect(isNight(0.72)).toBe(false)
  })

  it('is false exactly at NIGHT_UNTIL', () => {
    expect(isNight(0.06)).toBe(false)
  })
})

describe('advanceClock', () => {
  it('advances fraction and t at speed 1', () => {
    syncClockToDay(3)
    advanceClock(500, 1)
    expect(useClock.getState().fraction).toBe(0.5)
    expect(useClock.getState().t).toBe(0.5)
  })

  it('caps fraction at FRACTION_MAX at higher speed', () => {
    syncClockToDay(3)
    advanceClock(500, 1)
    advanceClock(110, 3)
    expect(useClock.getState().fraction).toBe(0.999)
    expect(useClock.getState().t).toBeCloseTo(3.999 / 7, 5)
  })

  it('ignores a zero dt, leaving the same state object', () => {
    syncClockToDay(3)
    const before = useClock.getState()
    advanceClock(0, 1)
    expect(useClock.getState()).toBe(before)
  })

  it('ignores a negative dt, leaving the same state object', () => {
    syncClockToDay(3)
    const before = useClock.getState()
    advanceClock(-5, 1)
    expect(useClock.getState()).toBe(before)
  })
})

describe('syncClockToDay', () => {
  it('resets fraction to 0 and sets t for the new day', () => {
    syncClockToDay(4)
    expect(useClock.getState().fraction).toBe(0)
    expect(useClock.getState().t).toBeCloseTo(4 / 7, 5)
  })

  it('is a no-op (same state object) when called again with the same day', () => {
    syncClockToDay(4)
    const before = useClock.getState()
    syncClockToDay(4)
    expect(useClock.getState()).toBe(before)
  })

  it('wraps a week boundary day to t 0', () => {
    syncClockToDay(7)
    expect(useClock.getState().t).toBe(0)
  })
})

describe('markLogSeen', () => {
  it('sets logSeenId', () => {
    markLogSeen(12)
    expect(useClock.getState().logSeenId).toBe(12)
  })
})

describe('unreadLogCount', () => {
  it('counts entries with id >= seenId', () => {
    expect(unreadLogCount([{ id: 1 }, { id: 2 }, { id: 3 }], 2)).toBe(2)
  })

  it('is 0 once seenId is past every entry', () => {
    expect(unreadLogCount([{ id: 1 }, { id: 2 }, { id: 3 }], 4)).toBe(0)
  })

  it('is 0 for an empty log', () => {
    expect(unreadLogCount([], 0)).toBe(0)
  })
})
