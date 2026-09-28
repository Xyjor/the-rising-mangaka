// The curated pixel-art palette for AI-generated illustrations (scripts/pixelate.ts snaps every opaque pixel to the
// nearest entry in OKLab). Every colour here MUST appear literally as a hex string somewhere in `src/ui/scene/*.ts`
// or `src/styles/tokens.css` (src/ui/__tests__/art.test.ts checks this), so the illustrated art always reads as part
// of the same world as the hand-painted scene and room art. Lowercase `#rrggbb`, no duplicates.
export const ART_PALETTE: readonly string[] = [
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
  '#e0932e', '#f5b700', '#c9b400', '#ffe47a', '#fff2a8', '#fff1c2', '#e0b25a', '#e39a4a', '#c67d33',
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
] as const
