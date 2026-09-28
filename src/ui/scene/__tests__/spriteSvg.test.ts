import { describe, expect, it } from 'vitest'
import { spriteRects } from '../spriteSvg'
import { ASSISTANT_PALS, MANGAKA_IDLE } from '../sprites'

const r = (x: number, y: number, w: number, h: number, fill: string) => ({ x, y, w, h, fill })

describe('spriteRects', () => {
  const pal = { A: '#111', B: '#222' }
  it('run-lengths each row, skipping clear pixels', () => {
    expect(spriteRects(['.AAB', 'BB..'], pal, { rows: [0, 1], cols: [0, 3] }))
      .toEqual([r(1, 0, 2, 1, '#111'), r(3, 0, 1, 1, '#222'), r(0, 1, 2, 1, '#222')])
  })
  it('clips to the window, origin at its top left', () => {
    expect(spriteRects(['.AAB', 'BB..'], pal, { rows: [1, 1], cols: [1, 3] })).toEqual([r(0, 0, 1, 1, '#222')])
  })
  it('draws the anchor head inside 16x16', () => {
    const rects = spriteRects(MANGAKA_IDLE[0], ASSISTANT_PALS[0], { rows: [0, 15], cols: [4, 19] })
    // the chibi anchor's row 0 crown is cols 6-15; the crop starts at col 4, so x 2, 10 wide (the crop itself moves
    // to cols 2-19 in a later task)
    expect(rects.filter((q) => q.y === 0)).toEqual([r(2, 0, 10, 1, '#1c1a26')])
    for (const q of rects) {
      expect(q.x).toBeGreaterThanOrEqual(0); expect(q.y).toBeGreaterThanOrEqual(0)
      expect(q.x + q.w).toBeLessThanOrEqual(16); expect(q.y + q.h).toBeLessThanOrEqual(16)
    }
  })
})
