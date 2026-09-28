// mood.ts is pure TypeScript (no DOM), so this runs in the default node environment.
import { describe, expect, it } from 'vitest'
import { LOW_STAMINA_THRESHOLD } from '../../../sim'
import { CHEER_MS, cheersFor, moodOf } from '../mood'
import { FACES, PAL } from '../sprites'

describe('moodOf', () => {
  const base = { home: true, editorHere: false, cheer: false, stamina: 80, resting: false, night: false }

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

  it('is sleepy only resting at night', () => {
    expect(moodOf({ ...base, resting: true, night: true })).toBe('sleepy')
    expect(moodOf({ ...base, resting: true, night: false })).toBe('neutral')
  })

  it('is never surprised when the mangaka is not home', () => {
    expect(moodOf({ ...base, home: false, editorHere: true })).toBe('neutral')
  })
})

describe('cheersFor', () => {
  // Deviation from the brief's literal `cheersFor(['level'])`: PopKind (Pops.tsx) is 'money' | 'fans' | 'xp' — a
  // level-up is carried as kind 'xp' with a "Level N" text, not a distinct 'level' kind, and Pops.tsx is out of scope
  // for this task. 'xp' stands in for the brief's 'level' case.
  it('is true for a fans or xp (level) pop, false for money alone', () => {
    expect(cheersFor(['money'])).toBe(false)
    expect(cheersFor(['money', 'fans'])).toBe(true)
    expect(cheersFor(['xp'])).toBe(true)
  })
})

describe('CHEER_MS', () => {
  it('is 2400', () => {
    expect(CHEER_MS).toBe(2400)
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
