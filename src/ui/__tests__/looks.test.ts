import { describe, expect, it } from 'vitest'
import { GENRES, MAGAZINES, createGame } from '../../sim'
import { GENRE_TONE, LOOK_HAIRS, LOOK_SHIRTS, MAG_TONE, TONES } from '../looks'

describe('shared look palette', () => {
  it('has one hair colour per shirt colour', () => {
    expect(LOOK_HAIRS.length).toBe(LOOK_SHIRTS.length)
    expect(LOOK_SHIRTS.length).toBeGreaterThan(0)
  })

  it('uses distinct colours so every look reads differently', () => {
    expect(new Set(LOOK_SHIRTS).size).toBe(LOOK_SHIRTS.length)
    expect(new Set(LOOK_HAIRS).size).toBe(LOOK_HAIRS.length)
  })

  it('covers every look index the engine can draw', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const c of createGame('Rin', seed).candidates) {
        expect(c.look).toBeGreaterThanOrEqual(0)
        expect(c.look).toBeLessThan(LOOK_SHIRTS.length)
      }
    }
  })
})

describe('genre and magazine tones', () => {
  it('gives every genre a tone', () => {
    for (const g of GENRES) expect(TONES).toContain(GENRE_TONE[g.id])
  })

  it('gives every magazine a tone', () => {
    for (const m of MAGAZINES) expect(TONES).toContain(MAG_TONE[m.id])
  })
})
