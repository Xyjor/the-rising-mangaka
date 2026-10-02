import { describe, expect, it } from 'vitest'
import { GAP, MARGIN, TAIL_INSET, placeBubble } from '../tutorialPlace'

const VIEW = { w: 1280, h: 800 }
const BUBBLE = { bw: 340, bh: 150 }

describe('placeBubble', () => {
  it('sits above the control, centred on it, with the tail pointing at its middle', () => {
    const ring = { left: 500, top: 600, width: 200, height: 50 }
    const p = placeBubble(ring, BUBBLE, VIEW, false)
    expect(p.side).toBe('above')
    expect(p.y).toBe(600 - GAP - 150)
    expect(p.x).toBe(600 - 170)
    expect(p.tail).toBe(170)
  })

  it('goes below when there is no room above', () => {
    const ring = { left: 1000, top: 20, width: 120, height: 40 }
    const p = placeBubble(ring, BUBBLE, VIEW, false)
    expect(p.side).toBe('below')
    expect(p.y).toBe(20 + 40 + GAP)
  })

  it('stays MARGIN inside the edges, and the tail still points at the control', () => {
    const ring = { left: 1200, top: 20, width: 70, height: 40 }
    const p = placeBubble(ring, BUBBLE, VIEW, false)
    expect(p.x).toBe(1280 - 340 - MARGIN)
    expect(p.tail).toBe(Math.min(1235 - p.x, 340 - TAIL_INSET))
  })

  it('beside the control when it is too tall for above or below', () => {
    const ring = { left: 8, top: 100, width: 66, height: 600 }
    const p = placeBubble(ring, BUBBLE, VIEW, false)
    expect(p.side).toBe('right')
    expect(p.x).toBe(8 + 66 + GAP)
    expect(p.y).toBe(400 - 75)
    expect(p.tail).toBe(75)
  })

  it('beside first when asked (the vertical rail), so the bubble never covers the next buttons', () => {
    const ring = { left: 8, top: 200, width: 66, height: 60 }
    expect(placeBubble(ring, BUBBLE, VIEW, true).side).toBe('right')
    expect(placeBubble(ring, BUBBLE, VIEW, false).side).toBe('above')
  })

  it('with no side that fits, takes the roomier of above and below, clamped', () => {
    const small = { w: 400, h: 300 }
    const ring = { left: 20, top: 40, width: 360, height: 200 }
    const p = placeBubble(ring, BUBBLE, small, false)
    expect(p.side).toBe('below')
    expect(p.y).toBe(300 - 150 - MARGIN)
    expect(p.x).toBe(200 - 170)
  })
})
