// The scene's render is a pure function of (snapshot, time of day, frame) onto a 2D context: no DOM needed, so this
// runs in the default node environment against the recording context from src/test/fakeCanvas.ts.
import { describe, expect, it } from 'vitest'
import { fakeContext, sceneSnapshot } from '../../../test/fakeCanvas'
import type { FillCall } from '../../../test/fakeCanvas'
import { H, SKY_LUT, W, render, skyColor } from '../render'
import type { Season } from '../season'

/**
 * fillRect calls for one frame of the reference scene (`sceneSnapshot()`: drawing phase, working, running, speed 1,
 * one assistant) at t = 0.3 (day, the sun up) and frame 100, measured on the split-only render (Task 28, before the
 * season layer) by rendering it into the recording context and reading `log.length`: 290. By hand it is wall 18,
 * floor 16, window 8 (frame, pane, sun, two cloud rects, two bars, sill), bookshelf 34, poster 4, bed 5, the
 * assistant 89 (84 sprite pixels, arm, 4 desk rects), chair 3, the player 92 (90 sprite pixels, arm, pen) and the
 * desk 21 (7 wood, lamp 2 and its glow, the 5-page stack 4 and its 2 lines, ink pot 2, mug 2 and its steam).
 * Clipping the sun and clouds to the pane (fix round 1) keeps it: at t 0.3, frame 100 the sun and both clouds are whole.
 * Every scene must stay under 1.5 times this.
 */
const BASELINE_FILLS = 290
const BUDGET = BASELINE_FILLS * 1.5

describe('render', () => {
  it('paints every pixel from a palette (an unknown sprite key would paint magenta)', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 100)
    expect(log.length).toBeGreaterThan(0)
    expect(log.some((c) => c.style === '#f0f')).toBe(false)
  })

  it('keeps every fillRect inside the 192x108 canvas', () => {
    expect([W, H]).toEqual([192, 108])
    for (const t of [0.3, 0.9]) {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot(), t, 100)
      for (const c of log) {
        expect(c.x).toBeGreaterThanOrEqual(0)
        expect(c.y).toBeGreaterThanOrEqual(0)
        expect(c.x + c.w).toBeLessThanOrEqual(192)
        expect(c.y + c.h).toBeLessThanOrEqual(108)
      }
    }
  })

  it('renders frame 0 the same way twice (a pure function of its inputs)', () => {
    const a = fakeContext()
    const b = fakeContext()
    render(a.ctx, sceneSnapshot(), 0.3, 0)
    render(b.ctx, sceneSnapshot(), 0.3, 0)
    expect(b.log).toEqual(a.log)
  })

  it('stays under 1.5 times the measured baseline of fillRect calls in every season, by day and by night', () => {
    expect(BUDGET).toBe(435)
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
      for (const t of [0.3, 0.9]) {
        const { ctx, log } = fakeContext()
        render(ctx, sceneSnapshot({ season }), t, 100)
        expect(log.length, `${season} t ${t}`).toBeLessThan(BUDGET)
      }
    }
  })
})

describe('the window', () => {
  /** The two cloud rects, found by their exact rows: '#fff' is also the poster, the mug and the stars. */
  function isCloud(c: FillCall, colour: string): boolean {
    return c.style === colour && ((c.y === 20 && c.h === 3) || (c.y === 18 && c.h === 2))
  }

  it('keeps the clouds inside the window pane (x 118-161) for frames 0 to 2000, by day and by night', () => {
    let seen = 0
    for (const [t, cloud] of [[0.3, '#fff'], [0.9, '#3a4470']] as const) {
      for (let frame = 0; frame <= 2000; frame += 13) {
        const { ctx, log } = fakeContext()
        render(ctx, sceneSnapshot(), t, frame)
        for (const c of log) {
          if (!isCloud(c, cloud)) continue
          seen++
          expect(c.x >= 118 && c.x + c.w <= 162, `t ${t} frame ${frame}: ${JSON.stringify(c)}`).toBe(true)
        }
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('shows the whole cloud at the left edge of the pane on frame 0 (reduced motion)', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 0)
    expect(log.filter((c) => isCloud(c, '#fff'))).toEqual([
      { style: '#fff', x: 118, y: 20, w: 10, h: 3 },
      { style: '#fff', x: 120, y: 18, w: 6, h: 2 },
    ])
  })

  it('clips a cloud sliding out behind the frame to the pane', () => {
    // frame 360: cx = (54 + 10) mod 60 - 10 = -6, so the big rect starts at 112 (cut to 118-121) and the small one at
    // 114 (cut to 118-119)
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 360)
    expect(log.filter((c) => isCloud(c, '#fff'))).toEqual([
      { style: '#fff', x: 118, y: 20, w: 4, h: 3 },
      { style: '#fff', x: 118, y: 18, w: 2, h: 2 },
    ])
  })

  it('keeps the sun inside the pane all day, from t 0.13 to 0.659', () => {
    const times = [0.659]
    for (let i = 13; i <= 65; i++) times.push(i / 100)
    for (const t of times) {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot(), t, 100)
      const sun = log.filter((c) => c.style === '#ffe47a')
      expect(sun, `t ${t}`).toHaveLength(1)
      const c = sun[0]
      expect(c.x >= 118 && c.x + c.w <= 162 && c.y >= 12 && c.y + c.h <= 44, `t ${t}: ${JSON.stringify(c)}`).toBe(true)
    }
    // at t 0.659 the sun (5 px from x 159.73) is cut at the pane's right edge, x 162
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.659, 100)
    const late = log.find((c) => c.style === '#ffe47a')
    expect(late?.x).toBeCloseTo(159.73, 2)
    expect(late?.w).toBeCloseTo(2.27, 2)
  })
})

describe('the sky', () => {
  it('reads the time of day from a 256-entry table of rgb() strings', () => {
    expect(SKY_LUT).toHaveLength(256)
    // entry i is t = i / 255: t 0 is dawn pink, t 0.4 (entry 102) the midday blue between the 0.25 and 0.55 stops
    expect(SKY_LUT[0]).toBe('rgb(246,166,160)')
    expect(SKY_LUT[Math.round(0.4 * 255)]).toBe('rgb(143,211,255)')
    // entry 209 is t 0.8196, 0.9967 of the way from dusk (242,163,90) to night (28,35,82): 242 - 213.3, 163 - 127.6,
    // 90 - 8.0, rounded
    expect(SKY_LUT[209]).toBe('rgb(29,35,82)')
    expect(SKY_LUT[255]).toBe('rgb(246,166,160)')
  })

  it('clamps t to [0, 1] and rounds it to the nearest entry', () => {
    expect(skyColor(0.4)).toBe('rgb(143,211,255)')
    expect(skyColor(0.82)).toBe('rgb(29,35,82)')
    expect(skyColor(-0.5)).toBe('rgb(246,166,160)')
    expect(skyColor(1.5)).toBe('rgb(246,166,160)')
  })

  it('paints the window pane in the sky colour', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.82, 0)
    expect(log).toContainEqual({ style: 'rgb(29,35,82)', x: 118, y: 12, w: 44, h: 32 })
  })
})
