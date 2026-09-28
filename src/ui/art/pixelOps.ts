// Pure pixel operations for the art pipeline (no sharp import, so these are unit-tested directly). All images are
// plain RGBA buffers: { width, height, data } where data.length === width * height * 4, one byte per channel,
// straight (non-premultiplied) alpha. scripts/pixelate.ts does the file IO and sharp calls; this module does the math.

export interface RgbaImage {
  readonly width: number
  readonly height: number
  /** width * height * 4 bytes, RGBA, straight alpha. */
  readonly data: Uint8ClampedArray
}

export function makeImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) }
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

// --- sRGB -> OKLab, for perceptual nearest-colour matching. ---

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

/** [L, a, b] in OKLab space for an 8-bit sRGB triple. */
export function rgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}

/** Index of the nearest palette entry (by OKLab Euclidean distance) to an 8-bit sRGB triple. */
export function nearestPaletteIndex(r: number, g: number, b: number, paletteLab: readonly [number, number, number][]): number {
  const [l, a, bb] = rgbToOklab(r, g, b)
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < paletteLab.length; i++) {
    const [pl, pa, pb] = paletteLab[i]
    const dl = l - pl
    const da = a - pa
    const db = bb - pb
    const dist = dl * dl + da * da + db * db
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

/** Precomputes OKLab coordinates for a hex palette, once, for repeated nearestPaletteIndex calls. */
export function toOklabPalette(palette: readonly string[]): [number, number, number][] {
  return palette.map((hex) => {
    const [r, g, b] = hexToRgb(hex)
    return rgbToOklab(r, g, b)
  })
}

/**
 * Area-average downsample from src to exactly dstW x dstH. Each destination pixel averages the block of source
 * pixels that map to it (nearest-neighbour block boundaries). A destination pixel is transparent (alpha 0, colour
 * left black) when under half of its source block's pixels are opaque (alpha > 0); otherwise its RGB is the
 * alpha-weighted average of the block's opaque pixels and alpha is fully opaque (255).
 */
export function downsampleArea(src: RgbaImage, dstW: number, dstH: number): RgbaImage {
  const out = makeImage(dstW, dstH)
  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor((dy * src.height) / dstH)
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * src.height) / dstH))
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor((dx * src.width) / dstW)
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * src.width) / dstW))
      let rSum = 0
      let gSum = 0
      let bSum = 0
      let opaqueCount = 0
      let total = 0
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * src.width + sx) * 4
          const a = src.data[i + 3]
          total++
          if (a > 0) {
            opaqueCount++
            rSum += src.data[i]
            gSum += src.data[i + 1]
            bSum += src.data[i + 2]
          }
        }
      }
      const oi = (dy * dstW + dx) * 4
      if (opaqueCount * 2 >= total && opaqueCount > 0) {
        out.data[oi] = rSum / opaqueCount
        out.data[oi + 1] = gSum / opaqueCount
        out.data[oi + 2] = bSum / opaqueCount
        out.data[oi + 3] = 255
      } else {
        out.data[oi] = 0
        out.data[oi + 1] = 0
        out.data[oi + 2] = 0
        out.data[oi + 3] = 0
      }
    }
  }
  return out
}

/** Snaps every opaque pixel to the nearest palette colour (OKLab distance), no dithering. Transparent pixels pass through untouched. */
export function snapToPalette(img: RgbaImage, palette: readonly string[]): RgbaImage {
  const lab = toOklabPalette(palette)
  const out = makeImage(img.width, img.height)
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3]
    if (a === 0) {
      out.data[i + 3] = 0
      continue
    }
    const idx = nearestPaletteIndex(img.data[i], img.data[i + 1], img.data[i + 2], lab)
    const [r, g, b] = hexToRgb(palette[idx])
    out.data[i] = r
    out.data[i + 1] = g
    out.data[i + 2] = b
    out.data[i + 3] = 255
  }
  return out
}

/**
 * Reduces the image to at most maxColors distinct colours: keeps the maxColors most-used opaque colours and
 * re-snaps every other opaque pixel to the nearest kept colour (OKLab distance). Assumes the image is already
 * snapped to a fixed palette (so "distinct colours" is a small, countable set).
 */
export function reduceColors(img: RgbaImage, maxColors: number): RgbaImage {
  const counts = new Map<string, number>()
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue
    const hex = rgbToHex(img.data[i], img.data[i + 1], img.data[i + 2])
    counts.set(hex, (counts.get(hex) ?? 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex)
  if (sorted.length <= maxColors) return img
  const kept = sorted.slice(0, maxColors)
  const keptLab = toOklabPalette(kept)
  const out = makeImage(img.width, img.height)
  out.data.set(img.data)
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue
    const hex = rgbToHex(img.data[i], img.data[i + 1], img.data[i + 2])
    if (kept.includes(hex)) continue
    const idx = nearestPaletteIndex(img.data[i], img.data[i + 1], img.data[i + 2], keptLab)
    const [r, g, b] = hexToRgb(kept[idx])
    out.data[i] = r
    out.data[i + 1] = g
    out.data[i + 2] = b
  }
  return out
}

/** Euclidean distance in 8-bit RGB space between two colours. */
function rgbDist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * Flood-fills transparent starting from the four edges, over pixels whose colour is within `tolerance` (0-441.7,
 * the max possible RGB distance) of the top-left corner's colour. Only spreads through connected near-corner-colour
 * pixels, so a same-coloured subject that doesn't touch an edge survives.
 */
export function floodTransparentFromEdges(img: RgbaImage, tolerance: number): RgbaImage {
  const { width, height, data } = img
  const out = makeImage(width, height)
  out.data.set(data)
  const cr = data[0]
  const cg = data[1]
  const cb = data[2]
  const visited = new Uint8Array(width * height)
  const stack: number[] = []
  const seed = (x: number, y: number) => {
    const idx = y * width + x
    if (visited[idx]) return
    const i = idx * 4
    if (data[i + 3] === 0) return
    if (rgbDist(data[i], data[i + 1], data[i + 2], cr, cg, cb) <= tolerance) {
      visited[idx] = 1
      stack.push(idx)
    }
  }
  for (let x = 0; x < width; x++) {
    seed(x, 0)
    seed(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    seed(0, y)
    seed(width - 1, y)
  }
  while (stack.length > 0) {
    const idx = stack.pop() as number
    const x = idx % width
    const y = Math.floor(idx / width)
    const i = idx * 4
    out.data[i] = 0
    out.data[i + 1] = 0
    out.data[i + 2] = 0
    out.data[i + 3] = 0
    const neighbours: [number, number][] = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ]
    for (const [nx, ny] of neighbours) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const nIdx = ny * width + nx
      if (visited[nIdx]) continue
      const ni = nIdx * 4
      if (data[ni + 3] === 0) continue
      if (rgbDist(data[ni], data[ni + 1], data[ni + 2], cr, cg, cb) <= tolerance) {
        visited[nIdx] = 1
        stack.push(nIdx)
      }
    }
  }
  return out
}

/** The smallest rectangle containing every pixel with alpha > 0, or null if the image is fully transparent. */
export function alphaBoundingBox(img: RgbaImage): { x: number; y: number; width: number; height: number } | null {
  let minX = img.width
  let minY = img.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4
      if (img.data[i + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/**
 * Pads a source rect (crop position/size within a larger image) out to match a target aspect ratio (targetW /
 * targetH), growing symmetrically and clamped to stay within [0, boundsW) x [0, boundsH). Used after trimming to
 * the alpha bbox, before downsampling to `native`, so a cutout subject doesn't get stretched.
 */
export function padToAspect(
  rect: { x: number; y: number; width: number; height: number },
  targetW: number,
  targetH: number,
  boundsW: number,
  boundsH: number,
): { x: number; y: number; width: number; height: number } {
  const targetRatio = targetW / targetH
  const currentRatio = rect.width / rect.height
  let { x, y, width, height } = rect
  if (currentRatio < targetRatio) {
    // too tall/narrow: widen
    const newWidth = Math.min(boundsW, Math.round(height * targetRatio))
    x = Math.max(0, Math.min(boundsW - newWidth, Math.round(x - (newWidth - width) / 2)))
    width = Math.min(newWidth, boundsW - x)
  } else if (currentRatio > targetRatio) {
    // too wide/short: heighten
    const newHeight = Math.min(boundsH, Math.round(width / targetRatio))
    y = Math.max(0, Math.min(boundsH - newHeight, Math.round(y - (newHeight - height) / 2)))
    height = Math.min(newHeight, boundsH - y)
  }
  return { x, y, width, height }
}

/** Draws a 1px outline colour on transparent pixels that are 4-adjacent (not diagonal) to an opaque pixel. */
export function addOutline(img: RgbaImage, outlineHex: string): RgbaImage {
  const [r, g, b] = hexToRgb(outlineHex)
  const out = makeImage(img.width, img.height)
  out.data.set(img.data)
  const { width, height, data } = img
  const isOpaque = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false
    return data[(y * width + x) * 4 + 3] > 0
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] > 0) continue
      if (isOpaque(x - 1, y) || isOpaque(x + 1, y) || isOpaque(x, y - 1) || isOpaque(x, y + 1)) {
        out.data[i] = r
        out.data[i + 1] = g
        out.data[i + 2] = b
        out.data[i + 3] = 255
      }
    }
  }
  return out
}
