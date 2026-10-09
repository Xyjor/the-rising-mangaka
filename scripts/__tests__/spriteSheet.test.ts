import { describe, expect, it } from 'vitest'
import { blitFace, cellOrEmpty, hcat, layoutRow, markKey, paintOver, rasterize, shelve, vcat } from '../lib/spriteSheet'

// The contact sheet's pure parts (scripts/spriteSheet.ts draws and writes the PNG with sharp; these build its pixels).
const PAL3 = { L: '#102030', S: '#f4cfa5', s: '#dba57d' }

function pixel(img: { width: number; data: Uint8ClampedArray }, x: number, y: number): number[] {
  const i = (y * img.width + x) * 4
  return Array.from(img.data.slice(i, i + 4))
}

describe('the sprite contact sheet', () => {
  it('rasterizes a string map at a scale, transparent where clear, mirrored when flipped', () => {
    const img = rasterize(['LS.', '.sL'], PAL3, 2)
    expect([img.width, img.height, img.data.length]).toEqual([6, 4, 6 * 4 * 4])
    expect(pixel(img, 0, 0)).toEqual([0x10, 0x20, 0x30, 255])
    expect(pixel(img, 1, 1)).toEqual([0x10, 0x20, 0x30, 255])
    for (const [x, y] of [[4, 0], [5, 0], [4, 1], [5, 1]]) expect(pixel(img, x, y)[3]).toBe(0)
    expect(pixel(img, 2, 2)).toEqual([0xdb, 0xa5, 0x7d, 255])
    const flipped = rasterize(['LS.', '.sL'], PAL3, 2, true)
    expect(pixel(flipped, 4, 0)).toEqual([0x10, 0x20, 0x30, 255])
    expect(pixel(flipped, 0, 0)[3]).toBe(0)
    // an unknown key is magenta
    expect(pixel(rasterize(['#'], PAL3, 1), 0, 0)).toEqual([255, 0, 255, 255])
  })

  it('paints one image over another, skipping clear pixels and clipping at the edges', () => {
    const dst = rasterize(['SSS', 'SSS'], PAL3, 1)
    paintOver(dst, rasterize(['.L', 'LL'], PAL3, 1), 2, 0)
    expect(pixel(dst, 2, 0)).toEqual([0xf4, 0xcf, 0xa5, 255]) // the clear cell left the S
    expect(pixel(dst, 2, 1)).toEqual([0x10, 0x20, 0x30, 255])
    paintOver(dst, rasterize(['L'], PAL3, 1), -1, -1) // wholly outside: nothing, no throw
    expect(pixel(dst, 0, 0)).toEqual([0xf4, 0xcf, 0xa5, 255])
  })

  it('draws a frame in its palette, or an empty cell its size and a note when the palette is missing', () => {
    const notes = new Set<string>()
    const drawn = cellOrEmpty(['LS.', '.sL'], PAL3, 2, notes, 'note: no PAL3')
    expect(drawn).toEqual(rasterize(['LS.', '.sL'], PAL3, 2))
    expect([...notes]).toEqual([])
    // no palette (a working tree without that outfit or look): no fallback palette, no throw
    const empty = cellOrEmpty(['LS.', '.sL'], undefined, 2, notes, 'note: no OUTFIT_PALS.cardigan')
    expect([empty.width, empty.height]).toEqual([6, 4])
    expect(empty.data.every((v) => v === 0)).toBe(true)
    expect([...notes]).toEqual(['note: no OUTFIT_PALS.cardigan'])
    // the note is said once however many cells miss the palette
    cellOrEmpty(['L'], undefined, 1, notes, 'note: no OUTFIT_PALS.cardigan')
    expect(notes.size).toBe(1)
  })

  it('lays a row out left to right with the gap and reports its height', () => {
    const row = layoutRow([{ w: 24, h: 32 }, { w: 30, h: 14 }, { w: 12, h: 8 }], 2)
    expect(row.cells.map((c) => c.x)).toEqual([0, 26, 58])
    expect(row.cells.map((c) => [c.w, c.h])).toEqual([[24, 32], [30, 14], [12, 8]])
    expect(row.height).toBe(32)
    expect(row.width).toBe(70)
  })

  it('lays images side by side bottom-aligned, and stacks them left-aligned', () => {
    const a = rasterize(['LL', 'LL'], PAL3, 1)
    const b = rasterize(['S'], PAL3, 1)
    const row = hcat([a, b], 1)
    expect([row.width, row.height]).toEqual([4, 2])
    expect(pixel(row, 3, 1)).toEqual([0xf4, 0xcf, 0xa5, 255]) // b on the row's floor
    expect(pixel(row, 3, 0)[3]).toBe(0)
    const col = vcat([b, a], 1)
    expect([col.width, col.height]).toEqual([2, 4])
    expect(pixel(col, 0, 0)).toEqual([0xf4, 0xcf, 0xa5, 255])
  })

  it('shelves images left to right, wrapping before one would pass the width, each shelf top-aligned', () => {
    const tall = rasterize(['L', 'L', 'L'], PAL3, 1)
    const wide = rasterize(['SSSS'], PAL3, 1)
    const dot = rasterize(['s'], PAL3, 1)
    // tall (1) + gap + wide (4) = 6 fits in 6; dot would make 8, so it wraps; wider than the width, an image has a shelf alone
    const out = shelve([tall, wide, dot, rasterize(['LLLLLLL'], PAL3, 1)], 6, 1)
    expect([out.width, out.height]).toEqual([7, 3 + 1 + 1 + 1 + 1])
    expect(pixel(out, 2, 0)).toEqual([0xf4, 0xcf, 0xa5, 255]) // wide on the first shelf's top, after tall and the gap
    expect(pixel(out, 2, 2)[3]).toBe(0)
    expect(pixel(out, 0, 4)).toEqual([0xdb, 0xa5, 0x7d, 255]) // dot opens the second shelf
    expect(pixel(out, 6, 6)).toEqual([0x10, 0x20, 0x30, 255]) // the wide one alone on the third
    expect(shelve([], 6, 1)).toEqual({ width: 0, height: 0, data: new Uint8ClampedArray(0) })
  })

  it('blits a face over rows 9-12 (+headDy) and the mark over the head, with 2 rows of headroom', () => {
    const frame = Array.from({ length: 32 }, (_, r) => (r === 0 ? 'L'.repeat(24) : 'S'.repeat(24)))
    const face = ['EEEEEEEEEEEEEE', 'WWWWWWWWWWWWWW', 'MMMMMMMMMMMMMM', 'BBBBBBBBBBBBBB']
    const mark = ['.L.', 'LWL', '.L.', '...', '.L.']
    const out = blitFace(frame, face, mark, 0)
    expect(out).toHaveLength(34)
    expect(out.every((row) => row.length === 24)).toBe(true)
    // the frame's row 0 at the result's row 2 (the mark's row 2 over col 21)
    expect(out[2]).toBe('L'.repeat(21) + markKey('L') + 'LL')
    // the face's row 0 at the result's row 11, col 4 (headDy 0), its last row at 14
    expect(out[11].slice(4, 18)).toBe(face[0])
    expect(out[14].slice(4, 18)).toBe(face[3])
    expect([out[11][3], out[11][18]]).toEqual(['S', 'S'])
    // headDy 1: row 12
    expect(blitFace(frame, face, mark, 1)[12].slice(4, 18)).toBe(face[0])
    // the mark's row 0 at the result's row 0, cols 20-22, in the mark key space; its clear cells leave what was there
    expect(out[0].slice(20, 23)).toBe('.' + markKey('L') + '.')
    expect(out[1].slice(20, 23)).toBe(markKey('L') + markKey('W') + markKey('L'))
    expect(out[0].slice(0, 20)).toBe('.'.repeat(20))
    expect(out[3][20]).toBe('S')
  })
})
