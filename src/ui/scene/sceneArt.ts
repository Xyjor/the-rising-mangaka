// The generated images the scene may draw (0.9.0): each tier's room shell (its walls, beams and floor, 320x180) and
// the structural props (cutout sprites at the footprints of the code-drawn pieces they replace). render takes a
// `SceneArt` and draws an image only once it has loaded (`ready`); until then, or when there is none, the code-drawn
// piece paints as before, so a frame is never blank. Characters stay string-map sprites. This module never imports
// the registry: `sceneImages.ts` builds the images from it and the component hands them to render.
import type { StudioTierId } from '../../sim'

/**
 * The structural props that can be a generated sprite, in the code's own terms: the window's frame, the apartment's
 * plain front door, the flat's and the loft's lit doorway, the kitchenette, the bookshelf, the bed and the stock
 * poster (the one on the wall while no serial or anime replaces it).
 */
export type ScenePropId = 'window' | 'door' | 'doorway' | 'kitchenette' | 'bookshelf' | 'bed' | 'poster'

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
 * The widths a prop's sprite is capped at, where its full-height sprite would hide something drawn before it: the bed
 * stays inside its old 58 px footprint, so the door and the doorway (drawn after it, at full height 38 and 46 px wide,
 * well over it) can be 33 px, the widest that stays centred on the door frame and clear of the bed (x 192-249).
 */
export const PROP_MAX_W: Partial<Record<ScenePropId, number>> = { bed: 58, door: 33, doorway: 33 }

/**
 * Each prop sprite's native size [w, h] (art/manifest.json `prop/<id>` native): `fitSprite` of its crop's aspect on
 * its footprint (render.ts `PROP_FOOTPRINT`) under `PROP_MAX_W`, checked by art.test.
 */
export const PROP_SPRITE: Record<ScenePropId, readonly [number, number]> = {
  window: [48, 36],
  door: [33, 50],
  doorway: [33, 41],
  kitchenette: [58, 58],
  bookshelf: [50, 58],
  bed: [58, 23],
  poster: [22, 28],
}

/** The images one frame may draw; a null or missing entry (or one still loading) paints the code-drawn fallback. */
export interface SceneArt {
  room: Record<StudioTierId, CanvasImageSource | null>
  prop: Partial<Record<ScenePropId, CanvasImageSource | null>>
}

/** No generated art: every piece code-drawn, today's scene exactly. */
export const NO_ART: SceneArt = {
  room: { apartment: null, flat: null, loft: null },
  prop: { window: null, door: null, doorway: null, kitchenette: null, bookshelf: null, bed: null, poster: null },
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
