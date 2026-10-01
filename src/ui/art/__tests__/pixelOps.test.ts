import { describe, expect, it } from 'vitest'
import {
  addOutline,
  alphaBoundingBox,
  despeckle,
  downsampleArea,
  downsampleNearest,
  findBlobs,
  flipHorizontal,
  floodTransparentFromEdges,
  makeImage,
  nearestPaletteIndex,
  padToAspect,
  reduceColors,
  remapSeam,
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

  it('keeps the hue over the lightness when the lightness weight is below 1 (a dusty teal wall stays teal)', () => {
    // the flat's raw wallpaper teal is nearer a grey by plain OKLab distance, but the lighter palette teal shares its hue
    const teal = toOklabPalette(['#8a8a96', '#8fb5ac'])
    expect(nearestPaletteIndex(0x6b, 0x97, 0x8e, teal)).toBe(0)
    expect(nearestPaletteIndex(0x6b, 0x97, 0x8e, teal, 1)).toBe(0)
    expect(nearestPaletteIndex(0x6b, 0x97, 0x8e, teal, 0.25)).toBe(1)
    const img = makeImage(1, 1)
    setPixel(img, 0, 0, 0x6b, 0x97, 0x8e)
    expect(snapToPalette(img, ['#8a8a96', '#8fb5ac']).data[0]).toBe(0x8a)
    expect(snapToPalette(img, ['#8a8a96', '#8fb5ac'], 0.25).data[0]).toBe(0x8f)
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

  it('re-snaps a dropped colour with the same lightness weight', () => {
    // two grey pixels and two teal ones are kept; the one darker teal goes to the grey by plain distance, the teal at 0.25
    const img = makeImage(5, 1)
    setPixel(img, 0, 0, 0x8a, 0x8a, 0x96)
    setPixel(img, 1, 0, 0x8a, 0x8a, 0x96)
    setPixel(img, 2, 0, 0x8f, 0xb5, 0xac)
    setPixel(img, 3, 0, 0x8f, 0xb5, 0xac)
    setPixel(img, 4, 0, 0x6b, 0x97, 0x8e)
    expect(reduceColors(img, 2).data[16]).toBe(0x8a)
    expect(reduceColors(img, 2, 0.25).data[16]).toBe(0x8f)
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

describe('findBlobs', () => {
  function sheet() {
    const img = makeImage(40, 20)
    fill(img, 200, 200, 200)
    for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) setPixel(img, x, y, 10, 10, 10)
    // a detached sparkle 2px right of the first object
    setPixel(img, 10, 3, 250, 220, 0)
    for (let y = 5; y < 15; y++) for (let x = 25; x < 35; x++) setPixel(img, x, y, 200, 0, 0)
    // a lone speck far from anything
    setPixel(img, 18, 18, 0, 0, 0)
    return img
  }

  it('finds each object, merging blobs within the gap and dropping tiny specks', () => {
    const boxes = findBlobs(sheet(), { tolerance: 24, mergeGap: 3, minArea: 4 })
    expect(boxes).toEqual([
      { x: 2, y: 2, width: 9, height: 6 },
      { x: 25, y: 5, width: 10, height: 10 },
    ])
  })

  it('keeps a far sparkle separate when the gap is small', () => {
    const boxes = findBlobs(sheet(), { tolerance: 24, mergeGap: 1, minArea: 1 })
    expect(boxes).toHaveLength(4)
  })

  it('returns nothing for a flat background', () => {
    const img = makeImage(5, 5)
    fill(img, 200, 200, 200)
    expect(findBlobs(img, { tolerance: 24, mergeGap: 2, minArea: 1 })).toEqual([])
  })
})

describe('remapSeam', () => {
  /** A width x height image: rows above `seam` one colour (the wall), rows from it another (the floor). */
  function twoBands(width: number, height: number, seam: number) {
    const img = makeImage(width, height)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (y < seam) setPixel(img, x, y, 200, 100, 50)
      else setPixel(img, x, y, 20, 60, 120)
    }
    return img
  }
  const rowColour = (img: ReturnType<typeof makeImage>, y: number) => {
    const i = y * img.width * 4
    return [img.data[i], img.data[i + 1], img.data[i + 2]]
  }

  for (const sample of ['area', 'nearest'] as const) {
    it(`lands the source seam exactly on the destination seam row (${sample})`, () => {
      // a seam at 87% of the source height must still land on row 114 of 180 (63%)
      const src = twoBands(64, 200, 174)
      const out = remapSeam(src, 174, 32, 180, 114, sample)
      expect(out.width).toBe(32)
      expect(out.height).toBe(180)
      for (let y = 0; y < 114; y++) expect(rowColour(out, y), `row ${y}`).toEqual([200, 100, 50])
      for (let y = 114; y < 180; y++) expect(rowColour(out, y), `row ${y}`).toEqual([20, 60, 120])
    })
  }

  it('area-averages within each side of the seam, never across it', () => {
    // above the seam: rows alternate black and white, so every wall row averages to grey; the floor stays flat
    const src = makeImage(4, 40)
    for (let y = 0; y < 40; y++) for (let x = 0; x < 4; x++) {
      const v = y < 30 ? (y % 2 ? 255 : 0) : 90
      setPixel(src, x, y, v, v, v)
    }
    const out = remapSeam(src, 30, 2, 20, 15, 'area')
    for (let y = 0; y < 15; y++) expect(rowColour(out, y)[0], `row ${y}`).toBeCloseTo(127.5, -1)
    for (let y = 15; y < 20; y++) expect(rowColour(out, y)).toEqual([90, 90, 90])
  })

  it('stretches each side piecewise-linearly: a source mark halfway down the wall lands halfway to the seam', () => {
    const src = twoBands(8, 100, 80)
    for (let x = 0; x < 8; x++) setPixel(src, x, 40, 255, 255, 255)
    for (let x = 0; x < 8; x++) setPixel(src, x, 41, 255, 255, 255)
    const out = remapSeam(src, 80, 8, 60, 40, 'nearest')
    const white = [...Array(60).keys()].filter((y) => rowColour(out, y)[0] === 255)
    expect(white).toEqual([20])
  })

  it('refuses a seam outside the image', () => {
    const src = twoBands(4, 10, 5)
    expect(() => remapSeam(src, 0, 4, 10, 5, 'area')).toThrow()
    expect(() => remapSeam(src, 10, 4, 10, 5, 'area')).toThrow()
    expect(() => remapSeam(src, 5, 4, 10, 10, 'area')).toThrow()
  })
})

describe('flipHorizontal', () => {
  it('mirrors every row left to right, alpha included, and leaves the source alone', () => {
    const src = makeImage(3, 2)
    setPixel(src, 0, 0, 255, 0, 0)
    setPixel(src, 1, 0, 0, 255, 0, 128)
    setPixel(src, 2, 1, 0, 0, 255)
    const out = flipHorizontal(src)
    expect([out.width, out.height]).toEqual([3, 2])
    expect(Array.from(out.data.slice(8, 12))).toEqual([255, 0, 0, 255])
    expect(Array.from(out.data.slice(4, 8))).toEqual([0, 255, 0, 128])
    expect(Array.from(out.data.slice(0, 4))).toEqual([0, 0, 0, 0])
    expect(Array.from(out.data.slice(12, 16))).toEqual([0, 0, 255, 255])
    expect(Array.from(src.data.slice(0, 4))).toEqual([255, 0, 0, 255])
  })

  it('is its own inverse', () => {
    const src = makeImage(5, 3)
    for (let i = 0; i < src.data.length; i++) src.data[i] = (i * 37) % 256
    expect(Array.from(flipHorizontal(flipHorizontal(src)).data)).toEqual(Array.from(src.data))
  })
})
