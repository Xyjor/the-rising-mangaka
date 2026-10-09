import { describe, expect, it } from 'vitest'
import { AVATAR_CROP, spriteRects } from '../spriteSvg'
import { ASSISTANT_PALS } from '../sprites'
import { NEUTRAL_FACE, headWith } from '../rig/head'

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
  it('crops the avatar to the rig head, rows 0-21 and cols 0-23', () => {
    expect(AVATAR_CROP).toEqual({ rows: [0, 21], cols: [0, 23] })
  })
  it('draws the rig head inside 24x22, its crown the head\'s own row 0', () => {
    const map = headWith(NEUTRAL_FACE)
    const rects = spriteRects(map, ASSISTANT_PALS[0], AVATAR_CROP)
    expect(rects.filter((q) => q.y === 0)).toEqual(spriteRects([map[0]], ASSISTANT_PALS[0], { rows: [0, 0], cols: [0, 23] }))
    for (const q of rects) {
      expect(q.x).toBeGreaterThanOrEqual(0); expect(q.y).toBeGreaterThanOrEqual(0)
      expect(q.x + q.w).toBeLessThanOrEqual(24); expect(q.y + q.h).toBeLessThanOrEqual(22)
    }
  })
})
