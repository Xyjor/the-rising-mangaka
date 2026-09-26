// Pure timeline module: no DOM needed, so this runs in the default node environment (no docblock).
import { describe, expect, it } from 'vitest'
import { barPitch, countUp, progressAt, revealCues, revealPlan, TIER_JINGLE } from '../panels/reveal'

describe('revealPlan', () => {
  it('lays out bars, score, stamp, jingle and rewards from named constants', () => {
    const p = revealPlan({ bars: 5, rewards: 3, reduced: false })
    expect(p.reduced).toBe(false)
    expect(p.drumrollAt).toBe(150)
    expect(p.barStart).toEqual([350, 600, 850, 1100, 1350])
    expect(p.barDur).toBe(400)
    expect(p.scoreStart).toBe(1750)
    expect(p.scoreDur).toBe(450)
    expect(p.stampAt).toBe(2300)
    expect(p.jingleAt).toBe(2420)
    expect(p.rewardStart).toEqual([2550, 2700, 2850])
    expect(p.end).toBe(3250)
  })

  it('collapses every time to zero, and sets reduced, when reduced is requested', () => {
    const p = revealPlan({ bars: 5, rewards: 3, reduced: true })
    expect(p.reduced).toBe(true)
    expect(p.drumrollAt).toBe(0)
    expect(p.barStart).toEqual([0, 0, 0, 0, 0])
    expect(p.barDur).toBe(0)
    expect(p.scoreStart).toBe(0)
    expect(p.scoreDur).toBe(0)
    expect(p.stampAt).toBe(0)
    expect(p.jingleAt).toBe(0)
    expect(p.rewardStart).toEqual([0, 0, 0])
    expect(p.end).toBe(0)
  })
})

describe('progressAt', () => {
  it('eases the fraction of the window elapsed with easeOutCubic', () => {
    expect(progressAt(550, 350, 400)).toBeCloseTo(0.875, 5)
  })

  it('is 0 before the window opens', () => {
    expect(progressAt(100, 350, 400)).toBe(0)
  })

  it('is 1 once the window has fully elapsed', () => {
    expect(progressAt(900, 350, 400)).toBe(1)
  })

  it('is 1 for a zero-duration window once its start has passed, as in a reduced plan', () => {
    expect(progressAt(0, 0, 0)).toBe(1)
  })
})

describe('countUp', () => {
  it('rounds value times the eased progress', () => {
    expect(countUp(72, 550, 350, 400)).toBe(63)
  })

  it('jumps straight to the value across a zero-duration window', () => {
    expect(countUp(1234, 0, 0, 0)).toBe(1234)
  })
})

describe('barPitch', () => {
  it('maps a 0-100 value onto 0-12 semitones', () => {
    expect(barPitch(72)).toBe(9)
  })

  it('floors at 0', () => {
    expect(barPitch(0)).toBe(0)
  })

  it('caps at 12', () => {
    expect(barPitch(100)).toBe(12)
  })
})

describe('revealCues', () => {
  const p = revealPlan({ bars: 5, rewards: 3, reduced: false })

  it('fires the drumroll and the first bar inside the opening window', () => {
    expect(revealCues(p, -1, 400, false)).toEqual([
      { kind: 'drumroll', at: 150 },
      { kind: 'bar', at: 350, index: 0 },
    ])
  })

  it('fires the stamp alone at its own instant', () => {
    expect(revealCues(p, 2200, 2300, false)).toEqual([{ kind: 'stamp', at: 2300 }])
  })

  it('fires the jingle together with the first reward coin', () => {
    expect(revealCues(p, 2300, 2600, false)).toEqual([
      { kind: 'jingle', at: 2420 },
      { kind: 'coin', at: 2550, index: 0 },
    ])
  })

  it('when skipped, fires only the stamp and jingle across a wide window', () => {
    expect(revealCues(p, 500, 3250, true)).toEqual([
      { kind: 'stamp', at: 2300 },
      { kind: 'jingle', at: 2420 },
    ])
  })

  it('when skipped, still withholds an event that falls before the window', () => {
    expect(revealCues(p, 2350, 3250, true)).toEqual([{ kind: 'jingle', at: 2420 }])
  })

  it('a reduced plan behaves as skipped: stamp then jingle at time zero, even when skipped is false', () => {
    const reduced = revealPlan({ bars: 5, rewards: 3, reduced: true })
    expect(revealCues(reduced, -1, 0, false)).toEqual([
      { kind: 'stamp', at: 0 },
      { kind: 'jingle', at: 0 },
    ])
  })
})

describe('TIER_JINGLE', () => {
  it('maps every rank tier to its jingle cue', () => {
    expect(TIER_JINGLE).toEqual({
      first: 'fanfare',
      podium: 'jingle-up',
      mid: 'jingle-mid',
      weak: 'jingle-down',
    })
  })
})
