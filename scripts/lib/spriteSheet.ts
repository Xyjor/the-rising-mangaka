// The sprite contact sheet's pure parts, shared by scripts/spriteSheet.ts (which reads the frames and writes the PNG
// with sharp) and its tests: a string map to RGBA pixels, one image painted over another, a row's layout, and a
// head-steady frame with a mood's face and mark blitted on.

/** An RGBA image, 4 bytes a pixel, row by row. */
export type Rgba = { width: number; height: number; data: Uint8ClampedArray }

/** A flat image of one colour (`#rrggbb`), or clear when no colour is given. */
export function blank(width: number, height: number, hex?: string): Rgba {
  const data = new Uint8ClampedArray(width * height * 4)
  if (hex) {
    const [r, g, b] = rgb(hex)
    for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i)
  }
  return { width, height, data }
}

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const MAGENTA = '#ff00ff'

/**
 * A string map as RGBA: each cell a `scale` x `scale` block in its palette colour (`#rrggbb` only; a key the palette
 * lacks is magenta, so it shows), '.' clear, mirrored left to right when `flip`.
 */
export function rasterize(map: readonly string[], pal: Record<string, string>, scale: number, flip = false): Rgba {
  const cols = map.reduce((w, row) => Math.max(w, row.length), 0)
  const img = blank(cols * scale, map.length * scale)
  map.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const ch = row[c]
      if (ch === '.') continue
      const [red, green, blue] = rgb(pal[ch] ?? MAGENTA)
      const x0 = (flip ? cols - 1 - c : c) * scale
      for (let y = r * scale; y < (r + 1) * scale; y++) {
        for (let x = x0; x < x0 + scale; x++) img.data.set([red, green, blue, 255], (y * img.width + x) * 4)
      }
    }
  })
  return img
}

/**
 * A frame rasterized in its palette, or, when the palette is missing (a working tree without that outfit or look), a
 * clear cell the frame's size with `note` added to `notes`: the sheet draws what it can and says what it left out,
 * never falling back to another palette or throwing (as its HEAD cells do).
 */
export function cellOrEmpty(
  map: readonly string[], pal: Record<string, string> | undefined, scale: number, notes: Set<string>, note: string,
): Rgba {
  if (pal) return rasterize(map, pal, scale)
  notes.add(note)
  return blank(map.reduce((w, row) => Math.max(w, row.length), 0) * scale, map.length * scale)
}

/** Paints `src` over `dst` with its top-left at (x, y): clear pixels (alpha 0) are skipped, anything off `dst` clipped. */
export function paintOver(dst: Rgba, src: Rgba, x: number, y: number): void {
  for (let sy = 0; sy < src.height; sy++) {
    const dy = y + sy
    if (dy < 0 || dy >= dst.height) continue
    for (let sx = 0; sx < src.width; sx++) {
      const dx = x + sx
      if (dx < 0 || dx >= dst.width) continue
      const si = (sy * src.width + sx) * 4
      if (src.data[si + 3] === 0) continue
      dst.data.set(src.data.subarray(si, si + 4), (dy * dst.width + dx) * 4)
    }
  }
}

/** A row of cells laid out left to right, `gap` apart: each cell's x, the row's width and its height (the tallest cell). */
export function layoutRow(
  cells: readonly { w: number; h: number }[], gap: number,
): { cells: { x: number; w: number; h: number }[]; width: number; height: number } {
  let x = 0
  const out = cells.map(({ w, h }) => {
    const cell = { x, w, h }
    x += w + gap
    return cell
  })
  return { cells: out, width: Math.max(0, x - gap), height: cells.reduce((h, c) => Math.max(h, c.h), 0) }
}

/**
 * A mark key in the blitted map's merged key space: the mark's own key moved out of ASCII (+0x100), so it never meets a
 * frame key ('L' in MARK_PAL is not 'L' in PAL). `markPalette` builds the matching lookup palette.
 */
export function markKey(k: string): string {
  return String.fromCharCode(k.charCodeAt(0) + 0x100)
}

/** The lookup palette for a `blitFace` map: the frame's palette plus the mark palette under its `markKey`s. */
export function markPalette(pal: Record<string, string>, markPal: Record<string, string>): Record<string, string> {
  const out = { ...pal }
  for (const [k, hex] of Object.entries(markPal)) out[markKey(k)] = hex
  return out
}

/** Rows and columns where render.ts's drawMood puts a face (x+4, y+9+headDy) and a mark (markX: x+20, y-2). */
const FACE_ROW = 9
const FACE_COL = 4
const MARK_COL = 20
const HEADROOM = 2

/**
 * A head-steady frame with a mood blitted on, where render.ts draws it: the frame from row 2 (2 rows of headroom, so
 * the mark at y-2 is inside the map), the face over the frame's rows 9-12 (+headDy) from col 4 (the result's rows
 * 11-14 +headDy), and the mark at the result's rows 0-4, cols 20-22, in the merged key space (`markKey`; rasterize the
 * result with `markPalette`). A face or mark '.' leaves what is under it.
 */
export function blitFace(
  frame: readonly string[], face: readonly string[], mark: readonly string[], headDy: number,
): string[] {
  const width = frame[0]?.length ?? 0
  const rows = [...Array.from({ length: HEADROOM }, () => '.'.repeat(width)), ...frame].map((row) => row.split(''))
  const stamp = (map: readonly string[], top: number, left: number, key: (k: string) => string) => {
    map.forEach((line, r) => {
      for (let c = 0; c < line.length; c++) {
        const target = rows[top + r]
        if (line[c] !== '.' && target && left + c < width) target[left + c] = key(line[c])
      }
    })
  }
  stamp(face, HEADROOM + FACE_ROW + headDy, FACE_COL, (k) => k)
  stamp(mark, 0, MARK_COL, markKey)
  return rows.map((row) => row.join(''))
}

/** Images side by side, `gap` apart, bottom-aligned (so the bed pose and the cat sit on the row's floor). */
export function hcat(imgs: readonly Rgba[], gap: number): Rgba {
  const row = layoutRow(imgs.map((i) => ({ w: i.width, h: i.height })), gap)
  const out = blank(row.width, row.height)
  imgs.forEach((img, i) => paintOver(out, img, row.cells[i].x, row.height - img.height))
  return out
}

/** Images stacked top to bottom, `gap` apart, left-aligned. */
export function vcat(imgs: readonly Rgba[], gap: number): Rgba {
  const width = imgs.reduce((w, i) => Math.max(w, i.width), 0)
  const height = imgs.reduce((h, i) => h + i.height, 0) + gap * Math.max(0, imgs.length - 1)
  const out = blank(width, height)
  let y = 0
  for (const img of imgs) {
    paintOver(out, img, 0, y)
    y += img.height + gap
  }
  return out
}

/**
 * Images on shelves: left to right, `gap` apart, a new shelf (`gap` below) before one would pass `width` (an image
 * wider than that has a shelf to itself), each shelf top-aligned (so every block's first strip starts on one line), the
 * shelves left-aligned (`vcat`). Keeps the sheet's area near its content's, under sharp's input pixel limit, as the
 * animations grow.
 */
export function shelve(imgs: readonly Rgba[], width: number, gap: number): Rgba {
  const shelves: Rgba[][] = []
  let used = 0
  for (const img of imgs) {
    const last = shelves[shelves.length - 1]
    if (last && used + gap + img.width <= width) {
      last.push(img)
      used += gap + img.width
    } else {
      shelves.push([img])
      used = img.width
    }
  }
  return vcat(shelves.map((shelf) => {
    const row = layoutRow(shelf.map((i) => ({ w: i.width, h: i.height })), gap)
    const out = blank(row.width, row.height)
    shelf.forEach((img, i) => paintOver(out, img, row.cells[i].x, 0))
    return out
  }), gap)
}
