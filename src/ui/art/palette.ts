// The curated pixel-art palette for AI-generated illustrations (scripts/pixelate.ts snaps every opaque pixel to the
// nearest entry in OKLab). Every colour here MUST appear literally as a hex string somewhere in `src/ui/scene/*.ts`
// or `src/styles/tokens.css` (src/ui/__tests__/art.test.ts checks this), so the illustrated art always reads as part
// of the same world as the hand-painted scene and room art. Lowercase `#rrggbb`, no duplicates.
//
// Two lists, snapped to separately: ART_PALETTE_BASE is frozen at its pre-0.9.0 contents, and every committed
// illustration was snapped to exactly it, so `npm run art` regenerates them byte for byte; never add to it.
// ART_PALETTE_SCENE is base plus the scene's room colours, for entries marked `"palette": "scene"` in
// art/manifest.json (the 0.9.0 room shells and prop sprites). ART_PALETTE is their union, the set of every colour an
// asset may use.
export const ART_PALETTE_BASE: readonly string[] = [
  // Outline, ink, near-black/white
  '#1c1a26', '#1b1b1b', '#f6f6f6',
  // Skin and hair
  '#f4cfa5', '#dba57d', '#2b2140', '#1d1630',
  // Blues (sky, denim, indigo accents)
  '#3b6fd6', '#2a52a6', '#8aa0c8', '#8fd3ff', '#bfe6f0', '#f4f8ff', '#e4e7ec',
  // Reds and corals (outfits, signage, warmth)
  '#c0392b', '#e8a0a0', '#c9442e', '#d1443f', '#b2302f', '#8e2a20', '#e5484d',
  // Blossom pinks
  '#f29bb4', '#f7b6c8',
  // Golds, oranges, ambers (sunset, lamps, awards)
  '#e0932e', '#f5b700', '#c9b400', '#ffe47a', '#fff2a8', '#fff1c2', '#fff7c2', '#f5f1c9', '#fdfcf7', '#e0b25a', '#e39a4a', '#c67d33',
  // Ochres (muted browns/olives)
  '#7a5a00', '#6f6300',
  // Tatami and woods (greens)
  '#e8ff8a', '#5aa845', '#3a8f4e', '#2f7a3a', '#5fbf6a', '#3fa66c', '#2f9e60', '#23784a', '#17301f', '#262f25',
  // Wall creams, papers, neutrals
  '#d9d3c5', '#e8e4d8', '#f2efe6', '#f1ede3', '#e9e5da', '#cbc7bf', '#a9a59c', '#a19e97', '#b9b6ad',
  // Night indigos
  '#0c0d11', '#0f1016', '#16161a', '#1e2740', '#1f2129', '#2449a8', '#2c3656', '#3a3d4c', '#222b5c',
  // Purples (rare accents, magic/night glow)
  '#6a3fd9', '#7c4dff', '#b9a2ff', '#ece4ff',
  // Greys
  '#66666f', '#5c5a62', '#77757e', '#8a8a96',
]

/** The scene's room colours added in 0.9.0 (roomArt.ts, studioArt.ts, render.ts), none of them already in the base. */
const SCENE_ADDITIONS: readonly string[] = [
  // The room shells (0.9.0, roomArt.ts and studioArt.ts, day colours: at night the scene dims the image instead).
  // The apartment's plaster, woods and tatami
  '#e6d3a8', '#ecdcb6', '#9c7550', '#c9b48a', '#b88d62', '#7a5a3e', '#cdbd7c', '#bfae6c', '#3d4a3a', '#a8984f',
  // The flat's teal wallpaper, wainscot, frame, planks and rug
  '#8fb5ac', '#9dc2b9', '#8a5f3a', '#b98a5c', '#a0764c', '#6e4a2c', '#c8894e', '#a86d3a', '#b04a3f',
  // The loft's plaster, brick, frame, steel, concrete and rug
  '#dcd8cf', '#b5574a', '#d9b7a5', '#6b4a32', '#4a4a55', '#bdb8ae', '#a9a49a', '#3f4f7a',
  // Switches and outlets; the window frame, the sill and the bookshelf's woods
  '#f0ead6', '#b8b2a5', '#5a4634', '#4a3828', '#6d4c33', '#8b6543', '#5a3d28',
] as const

/** What a `"palette": "scene"` manifest entry snaps to: the base and the room colours. */
export const ART_PALETTE_SCENE: readonly string[] = [...ART_PALETTE_BASE, ...SCENE_ADDITIONS]

/** Every colour an asset may use (art.test.ts checks PNGs and literals against it). */
export const ART_PALETTE: readonly string[] = ART_PALETTE_SCENE
