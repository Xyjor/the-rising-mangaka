// The generated-art registry. scripts/pixelate.ts writes indexed PNGs to src/assets/art/<id>.png; this module globs
// them all in eagerly (so Vite bundles each as a real asset URL, never base64-inlined — see vite.config.ts's
// assetsInlineLimit) and exposes typed ArtRef lookups. Later tasks add typed records here (e.g. a
// `Record<GenreId, ArtRef>` for genre art) built with the `art()` helper below, which throws at module load if a
// referenced id has no generated PNG — a missing asset fails immediately, not at render time.

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
