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
