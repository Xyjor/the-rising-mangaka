// The generated-art registry. scripts/pixelate.ts writes indexed PNGs to src/assets/art/<id>.png; this module globs
// them all in eagerly (so Vite bundles each as a real asset URL, never base64-inlined — see vite.config.ts's
// assetsInlineLimit) and exposes typed ArtRef lookups. Typed records are built with `art()`, which throws at module load if a
// referenced id has no generated PNG — a missing asset fails immediately, not at render time.

import type { BadgeId } from '../../sim/badges'
import type { AwardId, EquipmentId, EventId, GenreId, MagazineId, MerchItemId, PlaceId, ThemeId } from '../../sim/types'

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

/** Each badge's tile art, once generated. Missing art is the normal case: the tile falls back to an icon. */
export const BADGE_ART: Partial<Record<BadgeId, ArtRef>> = {}

/** Each merch item's art slot in the Series panel's Goods section, once generated; missing art falls back to an icon. */
export const MERCH_ART: Partial<Record<MerchItemId, ArtRef>> = {}

/** Each random event's card art, once generated; missing art falls back to the card's icon. */
export const EVENT_ART: Partial<Record<EventId, ArtRef>> = {}

/** Each trip's postcard art in the Trips panel, once generated; missing art falls back to the drawn CSS postcard. */
export const PLACE_ART: Partial<Record<PlaceId, ArtRef>> = {}

/** The title screen's key art (art/manifest.json entry "title/hero", native 320x180). */
export const TITLE_ART: ArtRef = art('title/hero', 320, 180)

/** A 32x32 cutout from a batch 1 sheet (art/manifest.json, `<group>/<id>`). */
const icon = (id: string) => art(id, 32, 32)

/**
 * Each genre's icon, once generated. Slice of life is still missing (its sheet came back without the teacup), so the
 * wizard falls back to no art for it.
 */
export const GENRE_ART: Partial<Record<GenreId, ArtRef>> = {
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
