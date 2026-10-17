import { describe, expect, it } from 'vitest'
import { levelsFor } from '../music/levels'
import type { MusicScene } from '../music/types'

const track = { tone: 3100, space: 0.3, mix: { keys: 0.9, bass: 0.8, lead: 0.7, drums: 0.5 } }
const scene = (mood: MusicScene['mood'], calm = false): MusicScene => ({ mood, season: 'spring', calm })

describe('levelsFor', () => {
  it('uses the track tone and space in the studio', () => {
    const l = levelsFor(scene('studio'), track)
    expect(l.tone).toBe(3100)
    expect(l.space).toBe(0.3)
    expect(l.parts).toEqual(track.mix)
  })

  it('darkens the title to 2000 and the calm moment to 1300', () => {
    expect(levelsFor(scene('title'), track).tone).toBe(2000)
    expect(levelsFor(scene('studio', true), track).tone).toBe(1300)
    expect(levelsFor(scene('title', true), track).tone).toBe(1300)
  })

  it('silences the drums and softens the lead in a calm moment, keys and bass unchanged', () => {
    const p = levelsFor(scene('studio', true), track).parts
    expect(p.drums).toBe(0)
    expect(p.lead).toBeCloseTo(0.42)
    expect(p.keys).toBe(0.9)
    expect(p.bass).toBe(0.8)
  })

  it('falls back to defaults between tracks', () => {
    expect(levelsFor(scene('studio'), null)).toEqual({
      tone: 2600, space: 0.22, parts: { keys: 1, bass: 1, lead: 1, drums: 1 },
    })
    expect(levelsFor(scene('studio', true), null).parts).toEqual({ keys: 1, bass: 1, lead: 0.6, drums: 0 })
  })
})
