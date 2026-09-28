// mood.ts is pure TypeScript (no DOM), so this runs in the default node environment.
import { describe, expect, it } from 'vitest'
import { LOW_STAMINA_THRESHOLD } from '../../../sim'
import { CHEER_MS, catFrame, cheersFor, idleFrame, moodOf } from '../mood'
import { FACES, PAL } from '../sprites'

describe('moodOf', () => {
  const base = { home: true, editorHere: false, cheer: false, stamina: 80, lateNight: false }

  it('is neutral by default', () => {
    expect(moodOf(base)).toBe('neutral')
  })

  it('puts surprised ahead of everything else: the editor visiting a mangaka who is home', () => {
    expect(moodOf({ ...base, editorHere: true, cheer: true, stamina: 5 })).toBe('surprised')
  })

  it('puts happy (cheer) ahead of tired', () => {
    expect(moodOf({ ...base, cheer: true, stamina: 5 })).toBe('happy')
  })

  it('is tired below the low-stamina threshold, neutral at or above it', () => {
    expect(moodOf({ ...base, stamina: LOW_STAMINA_THRESHOLD - 1 })).toBe('tired')
    expect(moodOf({ ...base, stamina: LOW_STAMINA_THRESHOLD })).toBe('neutral')
  })

  it('is sleepy working late at night, but tired still wins below the low-stamina threshold, and happy over both', () => {
    expect(moodOf({ ...base, lateNight: true })).toBe('sleepy')
    expect(moodOf({ ...base, lateNight: false })).toBe('neutral')
    expect(moodOf({ ...base, lateNight: true, stamina: LOW_STAMINA_THRESHOLD - 1 })).toBe('tired')
    expect(moodOf({ ...base, lateNight: true, cheer: true })).toBe('happy')
  })

  it('is never surprised when the mangaka is not home', () => {
    expect(moodOf({ ...base, home: false, editorHere: true })).toBe('neutral')
  })
})

describe('cheersFor', () => {
  // Fix round 1: cheersFor now reads the pops themselves (not just their kinds), so it can tell a level-up ('xp' with
  // levelUp: true) apart from an ordinary xp gain ('xp' with no levelUp field) — plain xp accrues continuously, so it
  // must not cheer on its own.
  it('is false for money alone or plain xp, true for fans or a level-up', () => {
    expect(cheersFor([{ kind: 'money' }])).toBe(false)
    expect(cheersFor([{ kind: 'xp' }])).toBe(false)
    expect(cheersFor([{ kind: 'money' }, { kind: 'fans' }])).toBe(true)
    expect(cheersFor([{ kind: 'xp', levelUp: true }])).toBe(true)
  })
})

describe('CHEER_MS', () => {
  it('is 2400', () => {
    expect(CHEER_MS).toBe(2400)
  })
})

describe('idleFrame', () => {
  it('cycles breathe (0-239), stretch (240-299) and sip (300-359) over a 360-frame period', () => {
    expect(idleFrame(0)).toEqual({ set: 'breathe', index: 0 })
    expect(idleFrame(16)).toEqual({ set: 'breathe', index: 1 })
    expect(idleFrame(239)).toEqual({ set: 'breathe', index: 0 })
    expect(idleFrame(240)).toEqual({ set: 'stretch', index: 0 })
    expect(idleFrame(255)).toEqual({ set: 'stretch', index: 1 })
    expect(idleFrame(300)).toEqual({ set: 'sip', index: 0 })
    expect(idleFrame(315)).toEqual({ set: 'sip', index: 1 })
    expect(idleFrame(360)).toEqual({ set: 'breathe', index: 0 })
  })

  it('returns the same object for the same pose (nothing allocated per call)', () => {
    expect(idleFrame(0)).toBe(idleFrame(32))
    expect(idleFrame(240)).toBe(idleFrame(240))
  })
})

describe('catFrame', () => {
  it('cycles sit (0-359), groom (360-419) and stretch (420-479) over a 480-frame period', () => {
    expect(catFrame(0)).toEqual({ set: 'sit', index: 0 })
    expect(catFrame(360)).toEqual({ set: 'groom', index: 0 })
    expect(catFrame(375)).toEqual({ set: 'groom', index: 1 })
    expect(catFrame(420)).toEqual({ set: 'stretch', index: 0 })
    expect(catFrame(480)).toEqual({ set: 'sit', index: 0 })
  })

  it('returns the same object for the same pose (nothing allocated per call)', () => {
    expect(catFrame(0)).toBe(catFrame(480))
    expect(catFrame(360)).toBe(catFrame(360))
  })
})

describe('FACES', () => {
  it('is 14 wide and 4 tall for every mood, every key in PAL', () => {
    for (const mood of ['happy', 'tired', 'surprised', 'sleepy'] as const) {
      const map = FACES[mood]
      expect(map, mood).toHaveLength(4)
      for (const row of map) {
        expect(row, mood).toHaveLength(14)
        for (const ch of row) expect(ch === '.' || ch in PAL, `${mood} ${ch}`).toBe(true)
      }
    }
  })
})
