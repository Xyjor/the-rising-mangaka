import { describe, expect, it } from 'vitest'
import { GENRES, MAGAZINES, createGame } from '../../sim'
import { GENRE_TONE, LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE, MAG_TONE, TONES } from '../looks'

/** WCAG relative luminance of a #rrggbb colour: sRGB linearised, weighted 0.2126 / 0.7152 / 0.0722. */
function relLum(hex: string): number {
  const lin = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5)
}

describe('shared look palette', () => {
  it('has one hair colour per shirt colour', () => {
    expect(LOOK_HAIRS.length).toBe(LOOK_SHIRTS.length)
    expect(LOOK_SHIRTS.length).toBeGreaterThan(0)
  })

  it('uses distinct colours so every look reads differently', () => {
    expect(new Set(LOOK_SHIRTS).size).toBe(LOOK_SHIRTS.length)
    expect(new Set(LOOK_HAIRS).size).toBe(LOOK_HAIRS.length)
  })

  it('gives every hair and shirt a darker shade', () => {
    expect(LOOK_HAIRS_SHADE.length).toBe(LOOK_HAIRS.length)
    expect(LOOK_SHIRTS_SHADE.length).toBe(LOOK_SHIRTS.length)
    LOOK_HAIRS.forEach((c, i) => expect(relLum(LOOK_HAIRS_SHADE[i]), c).toBeLessThan(relLum(c)))
    LOOK_SHIRTS.forEach((c, i) => expect(relLum(LOOK_SHIRTS_SHADE[i]), c).toBeLessThan(relLum(c)))
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
