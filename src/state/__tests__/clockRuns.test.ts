import { describe, expect, it } from 'vitest'
import { clockRuns } from '../clockRuns'
import type { ClockInputs } from '../clockRuns'

/** Every condition met: a game open with nothing pending, speed 1, no modal, the owner tab. */
const RUNNING: ClockInputs = { game: { pendingResult: null, pendingOffer: null }, speed: 1, modal: 'none', readOnly: false }

describe('clockRuns', () => {
  it('runs when every condition is met', () => {
    expect(clockRuns(RUNNING)).toBe(true)
  })

  it.each<[string, Partial<ClockInputs>]>([
    ['no game is open', { game: null }],
    ['the clock is paused', { speed: 0 }],
    ['a modal is open', { modal: 'settings' }],
    ['a result is pending', { game: { pendingResult: { score: 50 }, pendingOffer: null } }],
    ['an offer is pending', { game: { pendingResult: null, pendingOffer: { magazine: 'x' } } }],
    ['the tab is read-only', { readOnly: true }],
  ])('stops when %s', (_, patch) => {
    expect(clockRuns({ ...RUNNING, ...patch })).toBe(false)
  })
})
