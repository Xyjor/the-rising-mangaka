// The generated images the scene may draw (0.9.0): each tier's room shell (its walls, beams and floor, 320x180) and
// the props (cutout sprites at the footprints of the code-drawn pieces they replace: the structural props since 0.9.0,
// the desk, the chairs, the equipment and the front row since 0.10.0). render takes a
// `SceneArt` and draws an image only once it has loaded (`ready`); until then, or when there is none, the code-drawn
// piece paints as before, so a frame is never blank. Characters stay string-map sprites. This module never imports
// the registry: `sceneImages.ts` builds the images from it and the component hands them to render.
import type { StudioTierId } from '../../sim'

/**
 * The props that can be a generated sprite, in the code's own terms. The structural ones (0.9.0): the window's frame,
 * the apartment's plain front door, the flat's and the loft's lit doorway, the kitchenette, the bookshelf, the bed and
 * the stock poster (the one on the wall while no serial or anime replaces it). The furniture (0.10.0): the stock
 * `desk` and `chair`; the equipment that replaces or joins them when owned (`drafting-table`, `tall-chair`, the
 * `arm-lamp`, the `reference-shelf`, the `coffee-machine` on the sill); and each tier's front row on the floor (the
 * apartment's `zabuton` and `boxes`, the flat's `fern` and `books`, the loft's `floor-lamp` and `sofa`, and every
 * tier's `bin`).
 */
export type ScenePropId =
  | 'window' | 'door' | 'doorway' | 'kitchenette' | 'bookshelf' | 'bed' | 'poster'
  | 'desk' | 'drafting-table' | 'chair' | 'tall-chair' | 'arm-lamp' | 'reference-shelf' | 'coffee-machine'
  | 'zabuton' | 'boxes' | 'fern' | 'books' | 'floor-lamp' | 'sofa' | 'bin'

/** Where an image lands, in canvas space: the exact box of the code-drawn piece it replaces. */
export interface Footprint {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/**
 * A prop sprite's native size [w, h]: the footprint's full height, its width from the sprite's own aspect (w / h),
 * so a generated piece is never squashed into the old footprint's shape. Where the wider sprite would hide something
 * drawn before it, `maxW` caps the width instead and the height follows from the aspect.
 */
export function fitSprite(aspect: number, footprint: Footprint, maxW = Infinity): [number, number] {
  const w = Math.round(footprint.h * aspect)
  if (w <= maxW) return [w, footprint.h]
  return [maxW, Math.round(maxW / aspect)]
}

/**
 * Where a w x h prop sprite lands: its bottom row on the footprint's bottom row, centred across the footprint (a half
 * pixel of slack goes to the right, so the sprite sits one pixel left).
 */
export function placeSprite(footprint: Footprint, w: number, h: number): Footprint {
  return { x: footprint.x + Math.floor((footprint.w - w) / 2), y: footprint.y + footprint.h - h, w, h }
}

/**
 * The desks (0.10.0): a sprite whose tabletop must stay where the code-drawn one is, since the pages, the ink pot and
 * the pen sit on it. A desk sprite spans its footprint's width (`fitDesk`) and hangs from its top row (`hangSprite`)
 * instead: at its footprint's height it would be 35 px (the drafting table 45) under a 58 px desk top.
 */
export const DESK_PROPS = ['desk', 'drafting-table'] as const satisfies readonly ScenePropId[]

/** A desk sprite's native size [w, h]: the footprint's full width, its height from the sprite's own aspect (w / h). */
export function fitDesk(aspect: number, footprint: Footprint): [number, number] {
  return [footprint.w, Math.round(footprint.w / aspect)]
}

/**
 * Where a w x h desk sprite lands: its top row on the footprint's top row (the tabletop's back edge, or the drafting
 * table's lightbox), centred across the footprint the way `placeSprite` centres; it may reach below the footprint.
 */
export function hangSprite(footprint: Footprint, w: number, h: number): Footprint {
  return { x: footprint.x + Math.floor((footprint.w - w) / 2), y: footprint.y, w, h }
}

/**
 * The widths a prop's sprite is capped at, where its full-height sprite would hide something drawn before it: the bed
 * stays inside its old 58 px footprint, so the door and the doorway (drawn after it, at full height 38 and 46 px wide,
 * well over it) can be 33 px, the widest that stays centred on the door frame and clear of the bed (x 192-249). The
 * reference shelf (31 px at full height, under the poster from x 116) is 11 px, the widest centred on its slot that
 * stops at x 115; the sofa (41 px) is 37, clear of the bin (x 232, drawn after it in the same front row).
 */
export const PROP_MAX_W: Partial<Record<ScenePropId, number>> = {
  bed: 58, door: 33, doorway: 33, 'reference-shelf': 11, sofa: 37,
}

/**
 * Each prop sprite's native size [w, h] (art/manifest.json `prop/<id>` native): `fitSprite` of its crop's aspect on
 * its footprint (render.ts `PROP_FOOTPRINT`) under `PROP_MAX_W`, or `fitDesk` for a desk, checked by art.test.
 */
export const PROP_SPRITE: Record<ScenePropId, readonly [number, number]> = {
  window: [48, 36],
  door: [33, 50],
  doorway: [33, 41],
  kitchenette: [58, 58],
  bookshelf: [50, 58],
  bed: [58, 23],
  poster: [22, 28],
  desk: [58, 33],
  'drafting-table': [68, 35],
  chair: [19, 30],
  'tall-chair': [24, 34],
  'arm-lamp': [14, 20],
  'reference-shelf': [11, 13],
  'coffee-machine': [6, 8],
  zabuton: [14, 7],
  boxes: [22, 22],
  fern: [30, 27],
  books: [10, 9],
  'floor-lamp': [18, 34],
  sofa: [37, 23],
  bin: [13, 12],
}

/** The images one frame may draw; a null or missing entry (or one still loading) paints the code-drawn fallback. */
export interface SceneArt {
  room: Record<StudioTierId, CanvasImageSource | null>
  prop: Partial<Record<ScenePropId, CanvasImageSource | null>>
}

/** No generated art: every piece code-drawn, today's scene exactly. */
export const NO_ART: SceneArt = {
  room: { apartment: null, flat: null, loft: null },
  prop: {
    window: null, door: null, doorway: null, kitchenette: null, bookshelf: null, bed: null, poster: null,
    desk: null, 'drafting-table': null, chair: null, 'tall-chair': null, 'arm-lamp': null, 'reference-shelf': null,
    'coffee-machine': null, zabuton: null, boxes: null, fern: null, books: null, 'floor-lamp': null, sofa: null, bin: null,
  },
}

/**
 * The dim laid over a room image at night, right after it (the code-drawn shells have their own night colours; one
 * image serves day and night). The scene's own night overlay and lights still go on top, as before.
 */
export const ROOM_NIGHT_DIM = 'rgba(20,24,60,0.25)'

/** The fields `ready` reads: an `<img>` has `complete` and `naturalWidth`; a canvas or a bitmap only a `width`. */
interface Loadable {
  complete?: boolean
  naturalWidth?: number
  width?: unknown
}

/**
 * True only for an image that can be drawn now: an `<img>` once it has loaded (`complete` with a natural width), and
 * anything else (a canvas, a bitmap) with a width. Nothing allocated per call.
 */
export function ready(img: CanvasImageSource | null | undefined): img is CanvasImageSource {
  if (!img) return false
  const o = img as Loadable
  if (o.complete !== undefined) return o.complete && (o.naturalWidth ?? 0) > 0
  return typeof o.width === 'number' && o.width > 0
}

/** A code-drawn piece: what paints while its image is missing or loading. Module-level functions, so no allocation. */
export type Fallback = (ctx: CanvasRenderingContext2D) => void

/** Draws prop `id`'s image at its footprint when it is ready, else runs the code-drawn `fallback` in its place. */
export function drawProp(
  ctx: CanvasRenderingContext2D, art: SceneArt, id: ScenePropId, x: number, y: number, w: number, h: number,
  fallback: Fallback,
) {
  const img = art.prop[id]
  if (ready(img)) ctx.drawImage(img, x, y, w, h)
  else fallback(ctx)
}
