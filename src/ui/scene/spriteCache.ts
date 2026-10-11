// The sprite cache (0.11.0): each cast frame painted once per palette (and once more mirrored) into its own offscreen
// surface, built on first use and kept for the session, so render draws a character with one drawImage. A surface is
// an OffscreenCanvas, else a <canvas>, else (no canvas at all: node tests) a stand-in carrying its id and size, which
// the recording test context names in `images`. A hit allocates nothing: two Map lookups by the frame's stored id and
// a constant palette id.
// Memory: at most 485 rig frames (plus the 4 prop frames and the cat's 7) x 10 palettes x 2 facings x 6,144 B (a 32x48
// RGBA surface), about 60 MB in theory; about 340 are reachable (the editor is drawn neutral only), and a realistic
// long career builds about 900-1,000 surfaces, about 6 MB.
import { ASSISTANT_PALS, EDITOR_PAL, OUTFIT_PALS, PAL, drawSprite, outfitOf } from './sprites'
import type { CastFrame } from './rig/types'

export type { CastFrame }

export type PaletteId = 'pal' | 'cardigan' | 'blazer' | 'editor' | 'look0' | 'look1' | 'look2' | 'look3' | 'look4' | 'look5'

/** Every palette a cast frame is drawn in: PAL (the hoodie, the cat), the other two outfits, the editor's suit, the six looks. */
export const CAST_PALETTES: Readonly<Record<PaletteId, Record<string, string>>> = {
  pal: PAL, cardigan: OUTFIT_PALS.cardigan, blazer: OUTFIT_PALS.blazer, editor: EDITOR_PAL,
  look0: ASSISTANT_PALS[0], look1: ASSISTANT_PALS[1], look2: ASSISTANT_PALS[2],
  look3: ASSISTANT_PALS[3], look4: ASSISTANT_PALS[4], look5: ASSISTANT_PALS[5],
}

const LOOK_IDS: readonly PaletteId[] = ['look0', 'look1', 'look2', 'look3', 'look4', 'look5']

/** The mangaka's palette for a level (`outfitOf`; the hoodie is PAL). */
export function outfitPalette(level: number): PaletteId {
  const o = outfitOf(level)
  return o === 'hoodie' ? 'pal' : o
}

/** An assistant's palette for its look, wrapping as ASSISTANT_PALS does. */
export function lookPalette(look: number): PaletteId {
  return LOOK_IDS[look % LOOK_IDS.length]
}

/** Where the cache paints one frame: the image render draws, and the context that paints it (null: nothing to paint into). */
export interface Surface { readonly image: CanvasImageSource; readonly ctx: CanvasRenderingContext2D | null }
export type SurfaceFactory = (w: number, h: number, id: string) => Surface

/** A surface's id: `cast/<frame id>/<palette>`, `/r` added when mirrored. */
export function castSurfaceId(frameId: string, pal: PaletteId, flip: boolean): string {
  return `cast/${frameId}/${pal}${flip ? '/r' : ''}`
}

/**
 * An OffscreenCanvas, else a <canvas> (also when an OffscreenCanvas gives no 2D context, as Safari 16.0-16.3's do),
 * else a stand-in image (its id and size, nothing painted).
 */
export function defaultSurface(w: number, h: number, id: string): Surface {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(w, h)
    const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D | null
    if (ctx) return { image: c, ctx }
  }
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return { image: c, ctx: c.getContext('2d') }
  }
  return { image: { id, width: w, height: h } as unknown as CanvasImageSource, ctx: null }
}

export interface SpriteCache {
  /** The frame in the palette, mirrored when `flip`: painted on first use, the same image every time after. */
  image(frame: CastFrame, pal: PaletteId, flip: boolean): CanvasImageSource
  /** Surfaces built so far. */
  readonly size: number
}

export function createSpriteCache(make: SurfaceFactory = defaultSurface): SpriteCache {
  const byFrame = new Map<string, Map<PaletteId, [CanvasImageSource | null, CanvasImageSource | null]>>()
  let size = 0
  return {
    image(frame, pal, flip) {
      let byPal = byFrame.get(frame.id)
      if (!byPal) {
        byPal = new Map()
        byFrame.set(frame.id, byPal)
      }
      let pair = byPal.get(pal)
      if (!pair) {
        pair = [null, null]
        byPal.set(pal, pair)
      }
      const k = flip ? 1 : 0
      const have = pair[k]
      if (have) return have
      const h = frame.map.length
      const s = make(frame.map[0]?.length ?? 0, h, castSurfaceId(frame.id, pal, flip))
      if (s.ctx) drawSprite(s.ctx, frame.map, 0, 0, h, CAST_PALETTES[pal], flip)
      pair[k] = s.image
      size++
      return s.image
    },
    get size() {
      return size
    },
  }
}

let session: SpriteCache | null = null

/** The session's cache, made on first use. */
export function getCastCache(): SpriteCache {
  return (session ??= createSpriteCache())
}

/** Replaces the session's cache (a test's recording one); null makes a fresh default one on next use. */
export function installCastCache(cache: SpriteCache | null): void {
  session = cache
}

/** One cast frame drawn: its cached image at (x, y) rounded, one drawImage. */
export function drawCast(
  ctx: CanvasRenderingContext2D, cache: SpriteCache, frame: CastFrame, pal: PaletteId, x: number, y: number, flip: boolean,
): void {
  ctx.drawImage(cache.image(frame, pal, flip), Math.round(x), Math.round(y))
}

/**
 * A cast frame's top `rows` alone: the same cached image (mirrored never: a seated frame faces the viewer) cropped to
 * those rows, at (x, y) rounded, one drawImage. render draws the seated rig mangaka's rows 0-39 again with it, over the
 * page stack, so the pen and its hand lie on the pages.
 */
export function drawCastTop(
  ctx: CanvasRenderingContext2D, cache: SpriteCache, frame: CastFrame, pal: PaletteId, x: number, y: number, rows: number,
): void {
  const w = frame.map[0]?.length ?? 0
  ctx.drawImage(cache.image(frame, pal, false), 0, 0, w, rows, Math.round(x), Math.round(y), w, rows)
}
