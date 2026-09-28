import { describe, expect, it } from 'vitest'
import {
  addOutline,
  alphaBoundingBox,
  despeckle,
  downsampleArea,
  downsampleNearest,
  floodTransparentFromEdges,
  makeImage,
  nearestPaletteIndex,
  padToAspect,
  reduceColors,
  rgbToOklab,
  snapToPalette,
  toOklabPalette,
} from '../pixelOps'

function fill(img: ReturnType<typeof makeImage>, r: number, g: number, b: number, a = 255) {
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = r
    img.data[i + 1] = g
    img.data[i + 2] = b
    img.data[i + 3] = a
  }
}

function setPixel(img: ReturnType<typeof makeImage>, x: number, y: number, r: number, g: number, b: number, a = 255) {
  const i = (y * img.width + x) * 4
  img.data[i] = r
  img.data[i + 1] = g
  img.data[i + 2] = b
  img.data[i + 3] = a
}

describe('downsampleArea', () => {
  it('averages a flat block down to a single colour', () => {
    const src = makeImage(4, 4)
    fill(src, 100, 150, 200)
    const out = downsampleArea(src, 2, 2)
    expect(out.width).toBe(2)
    expect(out.height).toBe(2)
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(100)
      expect(out.data[i + 1]).toBe(150)
      expect(out.data[i + 2]).toBe(200)
      expect(out.data[i + 3]).toBe(255)
    }
  })

  it('averages two differently coloured halves of a block', () => {
    const src = makeImage(2, 1)
    setPixel(src, 0, 0, 0, 0, 0)
    setPixel(src, 1, 0, 100, 100, 100)
    const out = downsampleArea(src, 1, 1)
    expect(out.data[0]).toBe(50)
    expect(out.data[1]).toBe(50)
    expect(out.data[2]).toBe(50)
    expect(out.data[3]).toBe(255)
  })

  it('marks a destination cell transparent when under half its source pixels are opaque', () => {
    const src = makeImage(4, 1)
    setPixel(src, 0, 0, 200, 200, 200, 255)
    setPixel(src, 1, 0, 200, 200, 200, 0)
    setPixel(src, 2, 0, 200, 200, 200, 0)
    setPixel(src, 3, 0, 200, 200, 200, 0)
    const out = downsampleArea(src, 1, 1)
    expect(out.data[3]).toBe(0)
  })

  it('keeps a destination cell opaque when at least half its source pixels are opaque', () => {
    const src = makeImage(4, 1)
    setPixel(src, 0, 0, 200, 200, 200, 255)
    setPixel(src, 1, 0, 200, 200, 200, 255)
    setPixel(src, 2, 0, 200, 200, 200, 0)
    setPixel(src, 3, 0, 200, 200, 200, 0)
    const out = downsampleArea(src, 1, 1)
    expect(out.data[3]).toBe(255)
  })
})

describe('nearestPaletteIndex / snapToPalette', () => {
  const palette = ['#000000', '#ffffff', '#ff0000']
  const lab = toOklabPalette(palette)

  it('picks the exact match when present', () => {
    expect(nearestPaletteIndex(255, 0, 0, lab)).toBe(2)
    expect(nearestPaletteIndex(0, 0, 0, lab)).toBe(0)
    expect(nearestPaletteIndex(255, 255, 255, lab)).toBe(1)
  })

  it('picks the perceptually nearest colour for an in-between value', () => {
    // Very dark grey should land on black, not white or red.
    expect(nearestPaletteIndex(10, 10, 10, lab)).toBe(0)
  })

  it('snaps every opaque pixel and leaves transparent pixels alone', () => {
    const img = makeImage(2, 1)
    setPixel(img, 0, 0, 250, 5, 5, 255) // near red
    setPixel(img, 1, 0, 1, 1, 1, 0) // transparent
    const out = snapToPalette(img, palette)
    expect(out.data[0]).toBe(0xff)
    expect(out.data[1]).toBe(0)
    expect(out.data[2]).toBe(0)
    expect(out.data[7]).toBe(0) // still transparent
  })

  it('rgbToOklab produces distinct coordinates for distinct colours', () => {
    const black = rgbToOklab(0, 0, 0)
    const white = rgbToOklab(255, 255, 255)
    expect(black[0]).toBeLessThan(white[0])
  })
})

describe('reduceColors', () => {
  it('caps the palette to the most-used colours and re-snaps the rest', () => {
    const img = makeImage(4, 1)
    // 3 pixels of red (most used), 1 of blue (rare), all snapped colours already.
    setPixel(img, 0, 0, 255, 0, 0)
    setPixel(img, 1, 0, 255, 0, 0)
    setPixel(img, 2, 0, 255, 0, 0)
    setPixel(img, 3, 0, 0, 0, 255)
    const out = reduceColors(img, 1)
    // every opaque pixel should now be red (the only kept colour)
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(255)
      expect(out.data[i + 1]).toBe(0)
      expect(out.data[i + 2]).toBe(0)
    }
  })

  it('leaves the image untouched when already within the cap', () => {
    const img = makeImage(2, 1)
    setPixel(img, 0, 0, 255, 0, 0)
    setPixel(img, 1, 0, 0, 0, 255)
    const out = reduceColors(img, 16)
    expect(out).toBe(img)
  })
})

describe('floodTransparentFromEdges', () => {
  it('clears a flat background reachable from the edges', () => {
    const img = makeImage(3, 3)
    fill(img, 255, 255, 255)
    const out = floodTransparentFromEdges(img, 10)
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i + 3]).toBe(0)
    }
  })

  it('does not clear a subject in the middle that differs from the corner colour', () => {
    const img = makeImage(3, 3)
    fill(img, 255, 255, 255)
    setPixel(img, 1, 1, 0, 0, 0) // centre subject pixel, far from white
    const out = floodTransparentFromEdges(img, 10)
    const centre = (1 * 3 + 1) * 4
    expect(out.data[centre + 3]).toBe(255)
    expect(out.data[centre]).toBe(0)
    // corners still cleared
    expect(out.data[3]).toBe(0)
  })

  it('does not clear a background-coloured patch that never touches an edge and is walled off', () => {
    const img = makeImage(5, 5)
    fill(img, 255, 255, 255)
    // Ring of black around a white-coloured "hole" in the centre, disconnecting it from the edges.
    for (let x = 1; x <= 3; x++) {
      setPixel(img, x, 1, 0, 0, 0)
      setPixel(img, x, 3, 0, 0, 0)
    }
    setPixel(img, 1, 2, 0, 0, 0)
    setPixel(img, 3, 2, 0, 0, 0)
    setPixel(img, 2, 2, 255, 255, 255) // enclosed pixel, same colour as background but unreachable
    const out = floodTransparentFromEdges(img, 10)
    const centre = (2 * 5 + 2) * 4
    expect(out.data[centre + 3]).toBe(255)
  })
})

describe('alphaBoundingBox', () => {
  it('finds the tight box around opaque pixels', () => {
    const img = makeImage(5, 5)
    setPixel(img, 2, 1, 10, 10, 10)
    setPixel(img, 3, 3, 10, 10, 10)
    const box = alphaBoundingBox(img)
    expect(box).toEqual({ x: 2, y: 1, width: 2, height: 3 })
  })

  it('returns null for a fully transparent image', () => {
    const img = makeImage(3, 3)
    expect(alphaBoundingBox(img)).toBeNull()
  })
})

describe('padToAspect', () => {
  it('widens a too-tall rect to hit the target aspect ratio', () => {
    const rect = { x: 10, y: 10, width: 10, height: 20 } // 0.5 ratio
    const out = padToAspect(rect, 16, 9, 100, 100) // target ~1.78
    expect(out.width / out.height).toBeCloseTo(16 / 9, 1)
    expect(out.height).toBe(20)
  })

  it('heightens a too-wide rect to hit the target aspect ratio', () => {
    const rect = { x: 10, y: 10, width: 40, height: 10 } // 4.0 ratio
    const out = padToAspect(rect, 16, 9, 100, 100)
    expect(out.width / out.height).toBeCloseTo(16 / 9, 1)
    expect(out.width).toBe(40)
  })

  it('clamps to bounds', () => {
    const rect = { x: 0, y: 0, width: 5, height: 20 }
    const out = padToAspect(rect, 16, 9, 10, 100)
    expect(out.x).toBeGreaterThanOrEqual(0)
    expect(out.x + out.width).toBeLessThanOrEqual(10)
  })
})

describe('addOutline', () => {
  it('rings a single opaque pixel with the outline colour', () => {
    const img = makeImage(3, 3)
    setPixel(img, 1, 1, 200, 200, 200)
    const out = addOutline(img, '#1c1a26')
    // the 4 orthogonal neighbours should now be outline-coloured
    const positions: [number, number][] = [
      [1, 0],
      [1, 2],
      [0, 1],
      [2, 1],
    ]
    for (const [x, y] of positions) {
      const i = (y * 3 + x) * 4
      expect(out.data[i]).toBe(0x1c)
      expect(out.data[i + 1]).toBe(0x1a)
      expect(out.data[i + 2]).toBe(0x26)
      expect(out.data[i + 3]).toBe(255)
    }
    // diagonal neighbour untouched
    expect(out.data[3]).toBe(0)
    // the original opaque pixel is unchanged
    const centre = (1 * 3 + 1) * 4
    expect(out.data[centre]).toBe(200)
  })

  it('does not outline an already-opaque pixel', () => {
    const img = makeImage(2, 1)
    setPixel(img, 0, 0, 10, 10, 10)
    setPixel(img, 1, 0, 20, 20, 20)
    const out = addOutline(img, '#1c1a26')
    expect(out.data[0]).toBe(10)
    expect(out.data[4]).toBe(20)
  })
})

describe('downsampleNearest', () => {
  it('picks the source pixel at each destination cell centre, no averaging', () => {
    const src = makeImage(2, 1)
    setPixel(src, 0, 0, 0, 0, 0)
    setPixel(src, 1, 0, 100, 100, 100)
    const out = downsampleNearest(src, 2, 1)
    // 1:1 mapping should reproduce the source exactly (no blending).
    expect(out.data[0]).toBe(0)
    expect(out.data[4]).toBe(100)
  })

  it('does not blend a block the way downsampleArea would', () => {
    const src = makeImage(4, 1)
    setPixel(src, 0, 0, 0, 0, 0)
    setPixel(src, 1, 0, 0, 0, 0)
    setPixel(src, 2, 0, 200, 200, 200)
    setPixel(src, 3, 0, 200, 200, 200)
    const out = downsampleNearest(src, 2, 1)
    // Each destination cell samples a single source pixel: no 100-in-between average like area sampling would give.
    expect(out.data[0]).toBe(0)
    expect(out.data[4]).toBe(200)
  })

  it('preserves alpha of the sampled pixel', () => {
    const src = makeImage(2, 1)
    setPixel(src, 0, 0, 200, 200, 200, 0)
    setPixel(src, 1, 0, 200, 200, 200, 255)
    const out = downsampleNearest(src, 2, 1)
    expect(out.data[3]).toBe(0)
    expect(out.data[7]).toBe(255)
  })
})

describe('despeckle', () => {
  it('clears an isolated single-pixel speck surrounded by one flat colour', () => {
    const img = makeImage(3, 3)
    fill(img, 200, 100, 50) // flat field
    setPixel(img, 1, 1, 10, 10, 10) // centre speck, a different colour
    const out = despeckle(img)
    const centre = (1 * 3 + 1) * 4
    expect(out.data[centre]).toBe(200)
    expect(out.data[centre + 1]).toBe(100)
    expect(out.data[centre + 2]).toBe(50)
  })

  it('leaves a pixel whose neighbours are not unanimous', () => {
    const img = makeImage(3, 3)
    fill(img, 200, 100, 50)
    setPixel(img, 1, 1, 10, 10, 10) // centre
    setPixel(img, 0, 1, 30, 30, 30) // one neighbour disagrees with the rest
    const out = despeckle(img)
    const centre = (1 * 3 + 1) * 4
    expect(out.data[centre]).toBe(10)
  })

  it('leaves an edge pixel untouched (missing a neighbour)', () => {
    const img = makeImage(3, 3)
    fill(img, 200, 100, 50)
    setPixel(img, 0, 0, 10, 10, 10) // corner, missing two neighbours
    const out = despeckle(img)
    expect(out.data[0]).toBe(10)
  })

  it('does not touch a pixel already matching its neighbours', () => {
    const img = makeImage(3, 3)
    fill(img, 200, 100, 50)
    const out = despeckle(img)
    for (let i = 0; i < out.data.length; i += 4) {
      expect(out.data[i]).toBe(200)
    }
  })

  it('leaves a pixel with a transparent neighbour untouched', () => {
    const img = makeImage(3, 3)
    fill(img, 200, 100, 50)
    setPixel(img, 1, 1, 10, 10, 10) // centre speck
    setPixel(img, 1, 0, 0, 0, 0, 0) // one neighbour transparent
    const out = despeckle(img)
    const centre = (1 * 3 + 1) * 4
    expect(out.data[centre]).toBe(10) // unanimous check fails, so left alone
  })
})
