// The generated-art registry. scripts/pixelate.ts writes indexed PNGs to src/assets/art/<id>.png; this module globs
// them all in eagerly (so Vite bundles each as a real asset URL, never base64-inlined — see vite.config.ts's
// assetsInlineLimit) and exposes typed ArtRef lookups. Typed records are built with `art()`, which throws at module load if a
// referenced id has no generated PNG — a missing asset fails immediately, not at render time.

import type { BadgeId } from '../../sim/badges'
import type {
  AnimeStudioId, AwardId, EquipmentId, EventId, GenreId, MagazineId, MerchItemId, PlaceId, StudioTierId, ThemeId,
} from '../../sim/types'
import { PROP_SPRITE } from '../scene/sceneArt'
import type { ScenePropId } from '../scene/sceneArt'

/** A generated pixel-art asset: its manifest id, the bundled URL, and its native (unscaled) pixel size. */
export interface ArtRef {
  id: string
  src: string
  w: number
  h: number
}

// Eagerly imported so every art id resolves at module load (import.meta.glob with eager: true is a plain object,
// not a dynamic import), keyed by the path Vite sees it at.
const modules = import.meta.glob('/src/assets/art/**/*.png', { eager: true, import: 'default' }) as Record<string, string>

function srcFor(id: string): string | undefined {
  return modules[`/src/assets/art/${id}.png`]
}

/**
 * Looks up a generated art asset by its manifest id (e.g. "title/hero"), pairing it with the native pixel size the
 * caller expects. Throws at module load (not render time) if the PNG hasn't been generated with `npm run art`.
 */
export function art(id: string, w: number, h: number): ArtRef {
  const src = srcFor(id)
  if (!src) {
    throw new Error(`art(): no generated asset for "${id}" — run \`npm run art -- ${id}\` first`)
  }
  return { id, src, w, h }
}

/** The title screen's key art (art/manifest.json entry "title/hero", native 320x180). */
export const TITLE_ART: ArtRef = art('title/hero', 320, 180)

/** A 32x32 cutout from a batch 1 sheet (art/manifest.json, `<group>/<id>`). */
const icon = (id: string) => art(id, 32, 32)

/** Each genre's icon (slice of life's teacup came from batch 2's Higgsfield sheet). */
export const GENRE_ART: Record<GenreId, ArtRef> = {
  slice: icon('genre/slice'),
  action: icon('genre/action'),
  romance: icon('genre/romance'),
  comedy: icon('genre/comedy'),
  horror: icon('genre/horror'),
  sports: icon('genre/sports'),
  fantasy: icon('genre/fantasy'),
  mystery: icon('genre/mystery'),
  scifi: icon('genre/scifi'),
  drama: icon('genre/drama'),
}

/** Each theme's icon. */
export const THEME_ART: Record<ThemeId, ArtRef> = {
  school: icon('theme/school'),
  pirates: icon('theme/pirates'),
  ninja: icon('theme/ninja'),
  cooking: icon('theme/cooking'),
  music: icon('theme/music'),
  robots: icon('theme/robots'),
  vampires: icon('theme/vampires'),
  detective: icon('theme/detective'),
  space: icon('theme/space'),
  idols: icon('theme/idols'),
  samurai: icon('theme/samurai'),
  magic: icon('theme/magic'),
}

/** Each magazine's cover, 36x48 (a rectangle, not a cutout). */
export const MAGAZINE_ART: Record<MagazineId, ArtRef> = {
  'weekly-bolt': art('magazine/weekly-bolt', 36, 48),
  'monthly-petal': art('magazine/monthly-petal', 36, 48),
  'ultra-seinen': art('magazine/ultra-seinen', 36, 48),
  'kids-comic': art('magazine/kids-comic', 36, 48),
}

/** Each magazine's editor's portrait (Tanaka, Sato, Kuroda, Mori), keyed by magazine. */
export const EDITOR_ART: Record<MagazineId, ArtRef> = {
  'weekly-bolt': icon('editor/weekly-bolt'),
  'monthly-petal': icon('editor/monthly-petal'),
  'ultra-seinen': icon('editor/ultra-seinen'),
  'kids-comic': icon('editor/kids-comic'),
}

/** The named rival's portrait. */
export const RIVAL_ART: ArtRef = icon('rival/rival')

/** Each piece of equipment's icon (named apart from the scene's `EQUIPMENT_ART` drawings). */
export const EQUIPMENT_ART_ICON: Record<EquipmentId, ArtRef> = {
  coffee: icon('equipment/coffee'),
  lamp: icon('equipment/lamp'),
  shelf: icon('equipment/shelf'),
  chair: icon('equipment/chair'),
  'drafting-table': icon('equipment/drafting-table'),
  tablet: icon('equipment/tablet'),
}

/** Each award's icon. */
export const AWARD_ART: Record<AwardId, ArtRef> = {
  rookie: icon('award/rookie'),
  readers: icon('award/readers'),
  critics: icon('award/critics'),
  'golden-pen': icon('award/golden-pen'),
}

// ---------- batch 2 (Higgsfield z_image sheets) ----------

/** A framed scene crop (not a cutout): places 64x40, events and studio tiers 96x54. */
const place = (id: PlaceId) => art(`place/${id}`, 64, 40)
const scene = (id: string) => art(id, 96, 54)

/** Each badge's gallery tile. */
export const BADGE_ART: Record<BadgeId, ArtRef> = {
  'all-nighter': icon('badge/all-nighter'),
  cancelled: icon('badge/cancelled'),
  'stop-presses': icon('badge/stop-presses'),
  'ramen-budget': icon('badge/ramen-budget'),
  'first-place': icon('badge/first-place'),
  'golden-pen': icon('badge/golden-pen'),
  'grand-slam': icon('badge/grand-slam'),
  'rival-10': icon('badge/rival-10'),
  'perfect-pair': icon('badge/perfect-pair'),
  'anime-signed': icon('badge/anime-signed'),
  'anime-declined': icon('badge/anime-declined'),
  'the-loft': icon('badge/the-loft'),
  'fully-equipped': icon('badge/fully-equipped'),
  century: icon('badge/century'),
  millionaire: icon('badge/millionaire'),
}

/** The tile every not-yet-earned badge shows (a keyhole medal). */
export const BADGE_LOCKED: ArtRef = icon('badge/locked')

/** Each merch item's icon in the Series panel's Goods section. */
export const MERCH_ART: Record<MerchItemId, ArtRef> = {
  keychain: icon('merch/keychain'),
  poster: icon('merch/poster'),
  plush: icon('merch/plush'),
  artbook: icon('merch/artbook'),
  figure: icon('merch/figure'),
}

/** The goods licence (a shipping box with a heart), in the Goods section's header. */
export const MERCH_LICENCE_ART: ArtRef = icon('merch/licence')

/** Each trip's postcard, 64x40. */
export const PLACE_ART: Record<PlaceId, ArtRef> = {
  library: place('library'),
  survey: place('survey'),
  'art-class': place('art-class'),
  'writing-workshop': place('writing-workshop'),
  'editing-seminar': place('editing-seminar'),
  'hot-spring': place('hot-spring'),
  convention: place('convention'),
  masterclass: place('masterclass'),
  'manga-museum': place('manga-museum'),
  'mountain-retreat': place('mountain-retreat'),
  signing: place('signing'),
}

/** Each random event's card header, 96x54. */
export const EVENT_ART: Record<EventId, ArtRef> = {
  letter: scene('event/letter'),
  cold: scene('event/cold'),
  convention: scene('event/convention'),
  raise: scene('event/raise'),
  reprint: scene('event/reprint'),
  workshop: scene('event/workshop'),
  interview: scene('event/interview'),
  signing: scene('event/signing'),
  'editor-dinner': scene('event/editor-dinner'),
  cover: scene('event/cover'),
  'assistant-sick': scene('event/assistant-sick'),
  'rival-challenge': scene('event/rival-challenge'),
}

/** Each anime studio's emblem, a 32x32 cutout (round emblems read better square than at 48x32). */
export const ANIME_ART: Record<AnimeStudioId, ArtRef> = {
  kumo: icon('anime/kumo'),
  hoshi: icon('anime/hoshi'),
}

/** Each studio tier's room thumbnail, 96x54 (named apart from the scene's `TIER_ART` drawings). */
export const TIER_ART_THUMB: Record<StudioTierId, ArtRef> = {
  apartment: scene('tier/apartment'),
  flat: scene('tier/flat'),
  loft: scene('tier/loft'),
}

// ---------- the live scene (0.9.0): drawn into the canvas by render through src/ui/scene/sceneImages.ts ----------

/**
 * The generated room walls, 320x114 (canvas rows 0-113: the wall, beams, pillars, baseboard; no floor, no furniture),
 * each the raw's rows above its wall/floor seam: the apartment's and the loft's. Every tier is listed, so a new tier
 * fails `tsc` until its wall is decided; null is a tier with none: the flat's wall is code-drawn since 0.10.1
 * (roomArt.ts `TIER_WALL`), so `sceneImages` leaves its room null. The scene draws every floor in code (roomArt.ts
 * `TIER_FLOOR`); until a wall loads, the tier's code-drawn shell (`drawRoomShell`) paints instead.
 */
export const ROOM_ART: Record<StudioTierId, ArtRef | null> = {
  apartment: art('room/apartment', 320, 114),
  flat: null,
  loft: art('room/loft', 320, 114),
}

/** A prop's cutout sprite at its native size (sceneArt.ts `PROP_SPRITE`, placed by render.ts `PROP_BOX`). */
const sceneProp = (id: ScenePropId) => art(`prop/${id}`, PROP_SPRITE[id][0], PROP_SPRITE[id][1])

/** Each prop's sprite: the structural props (0.9.0), the furniture and equipment, and the front row (0.10.0). Until one
 * loads, its code-drawn piece paints instead. */
export const SCENE_PROP_ART: Record<ScenePropId, ArtRef> = {
  window: sceneProp('window'),
  door: sceneProp('door'),
  doorway: sceneProp('doorway'),
  kitchenette: sceneProp('kitchenette'),
  bookshelf: sceneProp('bookshelf'),
  bed: sceneProp('bed'),
  poster: sceneProp('poster'),
  desk: sceneProp('desk'),
  'drafting-table': sceneProp('drafting-table'),
  chair: sceneProp('chair'),
  'tall-chair': sceneProp('tall-chair'),
  'arm-lamp': sceneProp('arm-lamp'),
  'reference-shelf': sceneProp('reference-shelf'),
  'coffee-machine': sceneProp('coffee-machine'),
  zabuton: sceneProp('zabuton'),
  boxes: sceneProp('boxes'),
  fern: sceneProp('fern'),
  books: sceneProp('books'),
  'floor-lamp': sceneProp('floor-lamp'),
  sofa: sceneProp('sofa'),
  bin: sceneProp('bin'),
}
