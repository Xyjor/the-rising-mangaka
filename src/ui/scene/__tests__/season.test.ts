// The window's seasons, asserted through what render paints into the recording context (src/test/fakeCanvas.ts).
// Pure drawing, no DOM: the default node environment.
import { describe, expect, it } from 'vitest'
import { fakeContext, sceneSnapshot } from '../../../test/fakeCanvas'
import type { FillCall } from '../../../test/fakeCanvas'
import { render } from '../render'
import { seasonOf } from '../season'
import type { Season } from '../season'

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter']
const PETALS = ['#f7b6c8', '#f29bb4']
const LEAVES = ['#e2733a', '#c9442e', '#e8a33d']
const SNOW = '#f4f8ff'
const FIREFLY = '#e8ff8a'
const PARTICLE_COLOURS = [...PETALS, ...LEAVES, SNOW, FIREFLY]
/** Winter's snow: the sill's top row (the sill is x 114-165, y 45-47) and two drifts at y 44 on the frame's bottom. */
const SILL_SNOW = [
  { style: SNOW, x: 114, y: 45, w: 52, h: 1 },
  { style: SNOW, x: 117, y: 44, w: 7, h: 1 },
  { style: SNOW, x: 148, y: 44, w: 10, h: 1 },
]
const NIGHT_OVERLAY = 'rgba(20, 24, 60, 0.28)'
/** A colour only each season's pane art uses: its petals, its canopy's dark green, its falling leaves, its snow. */
const SEASON_MARK: Record<Season, string[]> = {
  spring: PETALS,
  summer: ['#2f7a3a'],
  autumn: LEAVES,
  winter: [SNOW],
}

function paint(season: Season, t: number, frame: number): FillCall[] {
  const { ctx, log } = fakeContext()
  render(ctx, sceneSnapshot({ season }), t, frame)
  return log
}

/** Inside the window pane: x 118-161, y 12-43. */
function inPane(c: FillCall): boolean {
  return c.x >= 118 && c.x + c.w <= 162 && c.y >= 12 && c.y + c.h <= 44
}

function isSillSnow(c: FillCall): boolean {
  return SILL_SNOW.some((s) => s.style === c.style && s.x === c.x && s.y === c.y && s.w === c.w && s.h === c.h)
}

/** The 1x1 (or, for leaves, 2x1) moving particles of one colour set; the static art uses wider rects. */
function particles(log: FillCall[], colours: string[], w = 1): FillCall[] {
  return log.filter((c) => colours.includes(c.style) && c.w === w && c.h === 1 && inPane(c))
}

describe('seasonOf', () => {
  it('opens the year in spring and turns every three months of 28 days', () => {
    expect(seasonOf(0)).toBe('spring')
    expect(seasonOf(83)).toBe('spring')
    expect(seasonOf(84)).toBe('summer')
    expect(seasonOf(167)).toBe('summer')
    expect(seasonOf(168)).toBe('autumn')
    expect(seasonOf(251)).toBe('autumn')
    expect(seasonOf(252)).toBe('winter')
    expect(seasonOf(335)).toBe('winter')
    expect(seasonOf(336)).toBe('spring')
    expect(seasonOf(336 + 252)).toBe('winter')
  })
})

describe('the season layer', () => {
  it('keeps every season particle inside the window pane for frames 0 to 2000, by day and by night', () => {
    for (const season of SEASONS) {
      for (const t of [0.3, 0.9]) {
        for (let frame = 0; frame <= 2000; frame += 13) {
          for (const c of paint(season, t, frame)) {
            if (!PARTICLE_COLOURS.includes(c.style) || isSillSnow(c)) continue
            expect(inPane(c), `${season} t ${t} frame ${frame}: ${JSON.stringify(c)}`).toBe(true)
          }
        }
      }
    }
  })

  it('paints no magenta in any season, by day or by night', () => {
    for (const season of SEASONS) {
      for (const t of [0.3, 0.9]) expect(paint(season, t, 100).some((c) => c.style === '#f0f')).toBe(false)
    }
  })

  it('shows spring as 12 falling petals in two pinks', () => {
    const log = paint('spring', 0.3, 100)
    expect(particles(log, PETALS)).toHaveLength(12)
    expect(log.some((c) => c.style === PETALS[0])).toBe(true)
    expect(log.some((c) => c.style === PETALS[1])).toBe(true)
    expect(log.some((c) => c.style === SNOW || LEAVES.includes(c.style))).toBe(false)
  })

  it('shows autumn as 12 falling leaves, 2 pixels wide', () => {
    const log = paint('autumn', 0.3, 100)
    expect(particles(log, LEAVES, 2)).toHaveLength(12)
    expect(log.some((c) => c.style === SNOW || PETALS.includes(c.style))).toBe(false)
  })

  it('shows winter as 16 snowflakes and snow on the sill, drawn over the sill', () => {
    const log = paint('winter', 0.3, 100)
    expect(particles(log, [SNOW])).toHaveLength(16)
    const sill = log.findIndex((c) => c.x === 114 && c.y === 45 && c.w === 52 && c.h === 3)
    for (const snow of SILL_SNOW) {
      const at = log.findIndex((c) => isSillSnow(c) && c.x === snow.x && c.y === snow.y)
      expect(at).toBeGreaterThan(sill)
    }
    // the sill snow does not move with the frame
    expect(paint('winter', 0.3, 700).filter(isSillSnow)).toEqual(log.filter(isSillSnow))
    expect(paint('spring', 0.3, 100).some(isSillSnow)).toBe(false)
  })

  it('shows 5 summer fireflies at night (t 0.9), after the night overlay, and none by day (t 0.3)', () => {
    const night = paint('summer', 0.9, 100)
    const flies = night.filter((c) => c.style === FIREFLY)
    expect(flies).toHaveLength(5)
    const overlay = night.findIndex((c) => c.style === NIGHT_OVERLAY)
    expect(overlay).toBeGreaterThan(-1)
    expect(night.findIndex((c) => c.style === FIREFLY)).toBeGreaterThan(overlay)
    expect(paint('summer', 0.3, 100).some((c) => c.style === FIREFLY)).toBe(false)
    for (const season of ['spring', 'autumn', 'winter'] as const) {
      expect(paint(season, 0.9, 100).some((c) => c.style === FIREFLY)).toBe(false)
    }
  })

  it('draws the pane art after the sky and before the window bars (the frame sits on top), all inside the pane', () => {
    for (const season of SEASONS) {
      for (const t of [0.3, 0.9]) {
        const log = paint(season, t, 100)
        const sky = log.findIndex((c) => c.x === 118 && c.y === 12 && c.w === 44 && c.h === 32)
        const bar = log.findIndex((c) => c.x === 139 && c.y === 12 && c.w === 2 && c.h === 32)
        expect(sky, season).toBeGreaterThan(-1)
        expect(bar, season).toBeGreaterThan(sky)
        // the sun or moon and stars, the clouds and the season's art: everything between the sky and the bars
        for (const c of log.slice(sky + 1, bar)) expect(inPane(c), `${season} t ${t}: ${JSON.stringify(c)}`).toBe(true)
        const marks = log.flatMap((c, i) => (SEASON_MARK[season].includes(c.style) && !isSillSnow(c) ? [i] : []))
        expect(marks.length, season).toBeGreaterThan(0)
        for (const i of marks) {
          expect(i, season).toBeGreaterThan(sky)
          expect(i, season).toBeLessThan(bar)
        }
      }
    }
  })

  it('keeps the fireflies off the window bars and above the sill: rows 18-25 and 29-36, never columns 139-140', () => {
    let seen = 0
    const rows = new Set<number>()
    const cols = new Set<number>()
    for (let frame = 0; frame <= 2000; frame += 13) {
      for (const c of paint('summer', 0.9, frame)) {
        if (c.style !== FIREFLY) continue
        seen++
        rows.add(c.y)
        cols.add(c.x)
        const where = `frame ${frame}: ${JSON.stringify(c)}`
        expect(c.y >= 18 && c.y <= 36, where).toBe(true)
        expect(c.y !== 27 && c.y !== 28, where).toBe(true)
        expect(c.x !== 139 && c.x !== 140, where).toBe(true)
      }
    }
    // frames 0, 13, ..., 1989: 154 frames of 5 fireflies
    expect(seen).toBe(154 * 5)
    // the wander reaches both edges of both bands and passes the bar, so the limits above are really tested
    for (const y of [18, 25, 29, 36]) expect(rows.has(y), `row ${y}`).toBe(true)
    for (const x of [138, 141]) expect(cols.has(x), `column ${x}`).toBe(true)
  })

  it('moves the particles with the frame and holds them still when the frame holds still', () => {
    for (const season of SEASONS) {
      const t = season === 'summer' ? 0.9 : 0.3
      const colours = season === 'summer' ? [FIREFLY] : PARTICLE_COLOURS
      const w = season === 'autumn' ? 2 : 1
      const at0 = particles(paint(season, t, 0), colours, w)
      expect(particles(paint(season, t, 0), colours, w), season).toEqual(at0)
      expect(particles(paint(season, t, 400), colours, w), season).not.toEqual(at0)
    }
  })

  it('renders frame 0 the same way twice in every season', () => {
    for (const season of SEASONS) expect(paint(season, 0.9, 0)).toEqual(paint(season, 0.9, 0))
  })

  it('paints each season differently', () => {
    const logs = SEASONS.map((season) => JSON.stringify(paint(season, 0.3, 100)))
    expect(new Set(logs).size).toBe(4)
  })
})
