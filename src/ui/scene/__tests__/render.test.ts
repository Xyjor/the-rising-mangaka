// The scene's render is a pure function of (snapshot, time of day, frame) onto a 2D context: no DOM needed, so this
// runs in the default node environment against the recording context from src/test/fakeCanvas.ts.
import { describe, expect, it } from 'vitest'
import { fakeContext, sceneSnapshot } from '../../../test/fakeCanvas'
import { H, W, render } from '../render'

/**
 * fillRect calls for one frame of the reference scene (`sceneSnapshot()`: drawing phase, working, running, speed 1,
 * one assistant) at t = 0.3 (day, the sun up) and frame 100, measured on the split-only render (Task 28, before the
 * season layer) by rendering it into the recording context and reading `log.length`: 290. By hand it is wall 18,
 * floor 16, window 8 (frame, pane, sun, two cloud rects, two bars, sill), bookshelf 34, poster 4, bed 5, the
 * assistant 89 (84 sprite pixels, arm, 4 desk rects), chair 3, the player 92 (90 sprite pixels, arm, pen) and the
 * desk 21 (7 wood, lamp 2 and its glow, the 5-page stack 4 and its 2 lines, ink pot 2, mug 2 and its steam).
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

  it('stays under 1.5 times the measured baseline of fillRect calls, by day and by night', () => {
    for (const t of [0.3, 0.9]) {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot(), t, 100)
      expect(log.length).toBeLessThan(BUDGET)
    }
  })
})
