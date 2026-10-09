// A sprite map as SVG rects (for DOM portraits such as the staff avatar): the same run-length rows drawSprite paints.
import type { SpriteMap } from './sprites'

/** The staff portrait's window: the rig head, rows 0-21 and cols 0-23 (24x22). */
export const AVATAR_CROP: { rows: [number, number]; cols: [number, number] } = { rows: [0, 21], cols: [0, 23] }

export interface SvgRect { x: number; y: number; w: number; h: number; fill: string }

/** Run-length rects of `map` inside rows [r0, r1] and cols [c0, c1] (inclusive), origin at (c0, r0). */
export function spriteRects(
  map: SpriteMap, pal: Record<string, string>, win: { rows: [number, number]; cols: [number, number] },
): SvgRect[] {
  const [r0, r1] = win.rows
  const [c0, c1] = win.cols
  const out: SvgRect[] = []
  for (let r = r0; r <= r1 && r < map.length; r++) {
    const line = map[r]
    const end = Math.min(c1, line.length - 1)
    let c = c0
    while (c <= end) {
      const ch = line[c]
      let len = 1
      while (c + len <= end && line[c + len] === ch) len++
      if (ch !== '.') out.push({ x: c - c0, y: r - r0, w: len, h: 1, fill: pal[ch] ?? '#f0f' })
      c += len
    }
  }
  return out
}
