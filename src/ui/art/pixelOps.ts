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

/**
 * Index of the nearest palette entry (by OKLab Euclidean distance) to an 8-bit sRGB triple. `lightness` weighs the
 * squared L difference (1, the default, is plain distance): below 1 a colour keeps its hue and chroma at the cost of
 * its lightness, so a shaded wall snaps to a lighter or darker entry of its own hue instead of a grey.
 */
export function nearestPaletteIndex(
  r: number, g: number, b: number, paletteLab: readonly [number, number, number][], lightness = 1,
): number {
  const [l, a, bb] = rgbToOklab(r, g, b)
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < paletteLab.length; i++) {
    const [pl, pa, pb] = paletteLab[i]
    const dl = l - pl
    const da = a - pa
    const db = bb - pb
    const dist = dl * dl * lightness + da * da + db * db
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

/**
 * Nearest-neighbour downsample from src to exactly dstW x dstH: each destination pixel takes the single source
 * pixel at its cell's centre (no averaging), for a raw sheet slice where a clean 1:1 or exact-block pixel-art source
 * shouldn't be blurred by area-averaging.
 */
export function downsampleNearest(src: RgbaImage, dstW: number, dstH: number): RgbaImage {
  const out = makeImage(dstW, dstH)
  for (let dy = 0; dy < dstH; dy++) {
    const sy0 = Math.floor((dy * src.height) / dstH)
    const sy1 = Math.max(sy0 + 1, Math.floor(((dy + 1) * src.height) / dstH))
    const sy = Math.min(src.height - 1, Math.floor((sy0 + sy1) / 2))
    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor((dx * src.width) / dstW)
      const sx1 = Math.max(sx0 + 1, Math.floor(((dx + 1) * src.width) / dstW))
      const sx = Math.min(src.width - 1, Math.floor((sx0 + sx1) / 2))
      const si = (sy * src.width + sx) * 4
      const oi = (dy * dstW + dx) * 4
      out.data[oi] = src.data[si]
      out.data[oi + 1] = src.data[si + 1]
      out.data[oi + 2] = src.data[si + 2]
      out.data[oi + 3] = src.data[si + 3]
    }
  }
  return out
}

/**
 * Snaps every opaque pixel to the nearest palette colour (OKLab distance, `lightness` as in nearestPaletteIndex), no
 * dithering. Transparent pixels pass through untouched.
 */
export function snapToPalette(img: RgbaImage, palette: readonly string[], lightness = 1): RgbaImage {
  const lab = toOklabPalette(palette)
  const out = makeImage(img.width, img.height)
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3]
    if (a === 0) {
      out.data[i + 3] = 0
      continue
    }
    const idx = nearestPaletteIndex(img.data[i], img.data[i + 1], img.data[i + 2], lab, lightness)
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
 * snapped to a fixed palette (so "distinct colours" is a small, countable set). `lightness` as in nearestPaletteIndex.
 */
export function reduceColors(img: RgbaImage, maxColors: number, lightness = 1): RgbaImage {
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
    const idx = nearestPaletteIndex(img.data[i], img.data[i + 1], img.data[i + 2], keptLab, lightness)
    const [r, g, b] = hexToRgb(kept[idx])
    out.data[i] = r
    out.data[i + 1] = g
    out.data[i + 2] = b
  }
  return out
}

/**
 * Single-pass despeckle: an opaque pixel whose four orthogonal neighbours are all in-bounds, all opaque, and all one
 * other colour (a colour different from the pixel itself) takes that colour. Run after reduceColors and before
 * addOutline, to clear isolated single-pixel colour specks (stray snapped colours surrounded by a flat field) before
 * they get an outline ring of their own. A pixel on the image edge (missing a neighbour) or whose neighbours are not
 * unanimous is left untouched; transparent pixels are never touched or counted as neighbours.
 */
export function despeckle(img: RgbaImage): RgbaImage {
  const { width, height, data } = img
  const out = makeImage(width, height)
  out.data.set(data)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] === 0) continue
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) continue
      const neighbours: [number, number][] = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      let common: string | null = null
      let unanimous = true
      for (const [nx, ny] of neighbours) {
        const ni = (ny * width + nx) * 4
        if (data[ni + 3] === 0) {
          unanimous = false
          break
        }
        const hex = rgbToHex(data[ni], data[ni + 1], data[ni + 2])
        if (common === null) {
          common = hex
        } else if (common !== hex) {
          unanimous = false
          break
        }
      }
      if (!unanimous || common === null) continue
      const selfHex = rgbToHex(data[i], data[i + 1], data[i + 2])
      if (selfHex === common) continue
      const [r, g, b] = hexToRgb(common)
      out.data[i] = r
      out.data[i + 1] = g
      out.data[i + 2] = b
    }
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
 * pixels, so a same-coloured subject that doesn't touch an edge survives. `holes` are extra seed points [x, y] for
 * background walled off inside the subject (a chair's backrest opening), cleared by the same rule; a seed on a pixel
 * that is not near the corner colour clears nothing.
 */
export function floodTransparentFromEdges(
  img: RgbaImage, tolerance: number, holes: readonly (readonly [number, number])[] = [],
): RgbaImage {
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
  for (const [x, y] of holes) if (x >= 0 && y >= 0 && x < width && y < height) seed(x, y)
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

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Finds the bounding boxes of the objects on a flat-background sheet. Background is any pixel within `tolerance` of
 * the top-left corner's colour; the rest is labelled into 4-connected blobs. Blobs whose boxes are at most `mergeGap`
 * px apart merge (so a detached sparkle stays with its object), then merged boxes covering fewer than `minArea`
 * foreground pixels are dropped as specks. Sorted top-to-bottom, then left-to-right. Used by `pixelate --measure` to
 * derive the crops committed to art/manifest.json.
 */
export function findBlobs(img: RgbaImage, opts: { tolerance: number; mergeGap: number; minArea: number }): Box[] {
  const { width, height, data } = img
  const cr = data[0]
  const cg = data[1]
  const cb = data[2]
  const fg = new Uint8Array(width * height)
  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    fg[p] = data[i + 3] > 0 && rgbDist(data[i], data[i + 1], data[i + 2], cr, cg, cb) > opts.tolerance ? 1 : 0
  }
  const seen = new Uint8Array(width * height)
  let blobs: { x0: number; y0: number; x1: number; y1: number; area: number }[] = []
  for (let start = 0; start < width * height; start++) {
    if (!fg[start] || seen[start]) continue
    const b = { x0: width, y0: height, x1: -1, y1: -1, area: 0 }
    const stack = [start]
    seen[start] = 1
    while (stack.length > 0) {
      const p = stack.pop() as number
      const x = p % width
      const y = (p - x) / width
      b.area++
      if (x < b.x0) b.x0 = x
      if (x > b.x1) b.x1 = x
      if (y < b.y0) b.y0 = y
      if (y > b.y1) b.y1 = y
      const visit = (q: number) => {
        if (fg[q] && !seen[q]) {
          seen[q] = 1
          stack.push(q)
        }
      }
      if (x > 0) visit(p - 1)
      if (x < width - 1) visit(p + 1)
      if (y > 0) visit(p - width)
      if (y < height - 1) visit(p + width)
    }
    blobs.push(b)
  }
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        const a = blobs[i]
        const c = blobs[j]
        const gapX = Math.max(0, Math.max(a.x0, c.x0) - Math.min(a.x1, c.x1) - 1)
        const gapY = Math.max(0, Math.max(a.y0, c.y0) - Math.min(a.y1, c.y1) - 1)
        if (Math.max(gapX, gapY) <= opts.mergeGap) {
          blobs[i] = {
            x0: Math.min(a.x0, c.x0),
            y0: Math.min(a.y0, c.y0),
            x1: Math.max(a.x1, c.x1),
            y1: Math.max(a.y1, c.y1),
            area: a.area + c.area,
          }
          blobs = blobs.filter((_, k) => k !== j)
          merged = true
          break outer
        }
      }
    }
  }
  return blobs
    .filter((b) => b.area >= opts.minArea)
    .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
    .map((b) => ({ x: b.x0, y: b.y0, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1 }))
}

/** Rows [y0, y1) of an image, copied out. */
function rowsOf(img: RgbaImage, y0: number, y1: number): RgbaImage {
  const out = makeImage(img.width, y1 - y0)
  out.data.set(img.data.subarray(y0 * img.width * 4, y1 * img.width * 4))
  return out
}

/**
 * Resamples a room shell to dstW x dstH so its wall/floor seam lands exactly on destination row `seamDst`: source rows
 * above `seamSrc` (the wall) fill destination rows 0 to seamDst - 1 and source rows from `seamSrc` (the floor) fill
 * seamDst to dstH - 1, each side scaled on its own (piecewise-linear vertically, uniform horizontally) with `sample`'s
 * downsample, so no destination row ever mixes wall and floor. A seam must leave at least one row on each side.
 */
export function remapSeam(
  src: RgbaImage, seamSrc: number, dstW: number, dstH: number, seamDst: number, sample: 'area' | 'nearest',
): RgbaImage {
  if (!(seamSrc > 0 && seamSrc < src.height) || !(seamDst > 0 && seamDst < dstH)) {
    throw new Error(`remapSeam: seam ${seamSrc} -> ${seamDst} must leave a row on each side (${src.height} -> ${dstH})`)
  }
  const down = sample === 'nearest' ? downsampleNearest : downsampleArea
  const wall = down(rowsOf(src, 0, seamSrc), dstW, seamDst)
  const floor = down(rowsOf(src, seamSrc, src.height), dstW, dstH - seamDst)
  const out = makeImage(dstW, dstH)
  out.data.set(wall.data, 0)
  out.data.set(floor.data, wall.data.length)
  return out
}

/**
 * A room's wall alone, for a room whose floor the scene draws in code: source rows 0 to `seamSrc` - 1 (the wall, the
 * floor below the seam dropped) resampled to dstW x dstH with `sample`'s downsample, as `remapSeam` does for its wall
 * side. The seam may be the image's height (no floor in the raw), never 0.
 */
export function wallOnly(src: RgbaImage, seamSrc: number, dstW: number, dstH: number, sample: 'area' | 'nearest'): RgbaImage {
  if (!(seamSrc > 0 && seamSrc <= src.height)) {
    throw new Error(`wallOnly: seam ${seamSrc} must leave a wall row and lie inside the image (height ${src.height})`)
  }
  const down = sample === 'nearest' ? downsampleNearest : downsampleArea
  return down(rowsOf(src, 0, seamSrc), dstW, dstH)
}

/**
 * Flattens a wall's plaster: every opaque pixel within `radius` (OKLab Euclidean distance) of the image's modal opaque
 * colour (exact RGB counts) becomes that colour exactly; every other pixel, and the alpha, stays. For a generated wall
 * whose prompt asked for flat lighting and got a vignette: the pool and its edges collapse to the one plaster the
 * palette snap then reads, while the wood, far from the mode, keeps its shading. Radius 0 changes nothing; an image
 * with no opaque pixel comes back as a copy.
 */
export function flattenToMode(img: RgbaImage, radius: number): RgbaImage {
  const out = makeImage(img.width, img.height)
  out.data.set(img.data)
  const counts = new Map<number, number>()
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue
    const key = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let mode = -1
  let best = 0
  for (const [key, n] of counts) if (n > best) { mode = key; best = n }
  if (mode < 0 || radius <= 0) return out
  const mr = mode >> 16, mg = (mode >> 8) & 255, mb = mode & 255
  const [ml, ma, mbb] = rgbToOklab(mr, mg, mb)
  const r2 = radius * radius
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] === 0) continue
    const [l, a, b] = rgbToOklab(out.data[i], out.data[i + 1], out.data[i + 2])
    const dl = l - ml, da = a - ma, db = b - mbb
    if (dl * dl + da * da + db * db <= r2) {
      out.data[i] = mr
      out.data[i + 1] = mg
      out.data[i + 2] = mb
    }
  }
  return out
}

/**
 * Mirrors an image left to right (a new image; the source is untouched). For a sheet object drawn facing the wrong way
 * for its place in the scene, such as the arm lamp, whose shade must lean left over the page.
 */
export function flipHorizontal(src: RgbaImage): RgbaImage {
  const out = makeImage(src.width, src.height)
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const from = (y * src.width + x) * 4
      const to = (y * src.width + (src.width - 1 - x)) * 4
      out.data.set(src.data.subarray(from, from + 4), to)
    }
  }
  return out
}

// --- The `--sprite` mode: a generated pose cell becomes a string-map frame (src/ui/scene/sprites.ts's format). ---

/**
 * Pads a cutout (already trimmed to its alpha box) with transparency out to the frame's aspect (frameW / frameH):
 * a too-narrow subject is widened and centred horizontally (the extra column, when odd, on the right); a too-wide one
 * is heightened with every added row on top, so the feet stay on the last row once it is downsampled.
 */
export function padBottomCentred(img: RgbaImage, frameW: number, frameH: number): RgbaImage {
  const w = Math.max(img.width, Math.round((img.height * frameW) / frameH))
  const h = Math.max(img.height, Math.round((img.width * frameH) / frameW))
  const out = makeImage(w, h)
  const ox = Math.floor((w - img.width) / 2)
  const oy = h - img.height
  for (let y = 0; y < img.height; y++) {
    out.data.set(img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4), ((oy + y) * w + ox) * 4)
  }
  return out
}

/**
 * Snaps every opaque pixel to the nearest (OKLab) colour among `keys`' PAL colours and returns the frame as string-map
 * rows ('.' where transparent). Only the listed keys can come out; PAL repeats some hex values (the collar K is the
 * hoodie J), so on a tie the first listed key wins.
 */
export function snapToKeys(img: RgbaImage, keys: string, pal: Record<string, string>): string[] {
  for (const k of keys) if (!(k in pal)) throw new Error(`snapToKeys: key ${k} is not in the palette`)
  const lab = toOklabPalette([...keys].map((k) => pal[k]))
  const rows: string[] = []
  for (let y = 0; y < img.height; y++) {
    let row = ''
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4
      row += img.data[i + 3] === 0 ? '.' : keys[nearestPaletteIndex(img.data[i], img.data[i + 1], img.data[i + 2], lab)]
    }
    rows.push(row)
  }
  return rows
}

/**
 * The palette a sprite entry snaps against (0.11.0 C2): `pal` (PAL) with each anchored key compared against the sheet
 * colour it stands for instead (a light grey hoodie anchors J, navy hair anchors H), so the snap follows the sheet's own
 * colours while only listed keys come out. A new object; `pal` is never changed. An anchor for a key the entry does not
 * list, or a colour that is not `#rrggbb`, throws.
 */
export function anchoredPalette(
  pal: Record<string, string>, keys: string, anchors: Record<string, string> = {},
): Record<string, string> {
  for (const [k, hex] of Object.entries(anchors)) {
    if (!keys.includes(k)) throw new Error(`anchoredPalette: anchor ${k} is not one of the keys ${keys}`)
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`anchoredPalette: anchor ${k} is ${hex}, not #rrggbb`)
  }
  return { ...pal, ...anchors }
}

/**
 * A grid smaller than the frame placed on the frame's last rows, centred (the extra column, when odd, on the right):
 * the manifest's `fit` box (a body fitted under the anchor head, rows 16-31). A grid larger than the frame throws.
 */
export function placeInFrame(rows: readonly string[], frameW: number, frameH: number): string[] {
  const w = rows[0]?.length ?? 0
  if (w > frameW || rows.length > frameH) throw new Error(`placeInFrame: ${w}x${rows.length} does not fit ${frameW}x${frameH}`)
  const ox = Math.floor((frameW - w) / 2)
  const blank = '.'.repeat(frameW)
  return [
    ...Array.from({ length: frameH - rows.length }, () => blank),
    ...rows.map((r) => '.'.repeat(ox) + r + '.'.repeat(frameW - ox - r.length)),
  ]
}

/** Swaps each key of `from` for the key at the same index of `to`, on rows r0 to r1 inclusive only. */
export function remapRows(rows: readonly string[], [r0, r1]: readonly [number, number], from: string, to: string): string[] {
  return rows.map((row, r) =>
    r < r0 || r > r1 ? row : [...row].map((ch) => { const i = from.indexOf(ch); return i < 0 ? ch : to[i] }).join(''))
}

const filled = (rows: readonly string[], r: number, c: number) =>
  r >= 0 && r < rows.length && c >= 0 && c < rows[r].length && rows[r][c] !== '.'

/** The 1px outline: every filled cell 4-adjacent to a clear cell or the frame's edge becomes L. */
export function outlineToL(rows: readonly string[]): string[] {
  return rows.map((row, r) => [...row].map((ch, c) => {
    if (ch === '.') return ch
    const edge = !filled(rows, r - 1, c) || !filled(rows, r + 1, c) || !filled(rows, r, c - 1) || !filled(rows, r, c + 1)
    return edge ? 'L' : ch
  }).join(''))
}

/** Closes each row's outline (frameRules): the first and the last filled cell of every row become L. */
export function closeOutline(rows: readonly string[]): string[] {
  return rows.map((row) => {
    const first = row.search(/[^.]/)
    if (first < 0) return row
    let last = row.length - 1
    while (row[last] === '.') last--
    const cells = [...row]
    cells[first] = 'L'
    cells[last] = 'L'
    return cells.join('')
  })
}

/**
 * Clears single-cell flecks the downsample leaves (each one is a fill of its own): a cell, never L, that is not on the
 * frame's edge takes its neighbours' key when all four agree, or when its left and right neighbours agree on a key
 * that is not clear and not L (a fleck inside a horizontal run). Reads the input only, so one pass is order-free.
 */
export function despeckleGrid(rows: readonly string[]): string[] {
  return rows.map((row, r) => [...row].map((ch, c) => {
    if (ch === '.' || ch === 'L' || r === 0 || c === 0 || r === rows.length - 1 || c === row.length - 1) return ch
    const left = row[c - 1]
    const right = row[c + 1]
    if (left === right && left !== ch && left !== '.' && left !== 'L') return left
    const up = rows[r - 1][c]
    if (up === left && up === right && up === rows[r + 1][c] && up !== '.') return up
    return ch
  }).join(''))
}

/** Replaces the frame's first rows with `head` (the anchor head graft), every row the same width. */
export function graftRows(rows: readonly string[], head: readonly string[]): string[] {
  if (head.some((h, i) => h.length !== (rows[i] ?? '').length)) throw new Error('graftRows: the head is not the frame width')
  return [...head, ...rows.slice(head.length)]
}

/**
 * The manifest's touched cells, `[row, col, key]`, set after the outline and any graft: a detail the downsample cannot
 * keep (a one-pixel eye), recorded in the manifest so regeneration reproduces it rather than a hand edit to the output.
 */
export function setCells(rows: readonly string[], cells: readonly (readonly [number, number, string])[]): string[] {
  const out = rows.map((row) => [...row])
  for (const [r, c, key] of cells) {
    if (key.length !== 1 || r < 0 || r >= out.length || c < 0 || c >= out[r].length) {
      throw new Error(`setCells: [${r}, ${c}, ${key}] is not one key inside the frame`)
    }
    out[r][c] = key
  }
  return out.map((row) => row.join(''))
}

/** How many fills drawSprite issues for a frame: one per horizontal run of one non-clear key. */
export function runCount(rows: readonly string[]): number {
  let n = 0
  for (const row of rows) for (let c = 0; c < row.length; c++) if (row[c] !== '.' && row[c] !== row[c - 1]) n++
  return n
}

/** The TS module `--sprite` writes to src/ui/scene/generated/: a header, any notes, then the frame as string[]. */
export function spriteModule(id: string, name: string, rows: readonly string[], notes: readonly string[] = []): string {
  return [
    `// Generated by \`npm run art -- ${id}\` (scripts/pixelate.ts --sprite mode) from art/manifest.json.`,
    '// Never edit by hand: change the manifest entry or the raw sheet and regenerate.',
    ...notes.map((n) => `// ${n}`),
    `export const ${name}: string[] = [`,
    ...rows.map((row, i) => `  '${row}', // ${i}`),
    ']',
    '',
  ].join('\n')
}
