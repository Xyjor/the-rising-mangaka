// The scene's sprites: the palette, the string maps and the painter that draws one (pure module constants, no React,
// nothing allocated per frame). Each map is a list of rows, one character per pixel: '.' is clear, every other key is a
// colour in PAL (uppercase the base, lowercase its shade; the light comes from the top left). Every frame passes
// `frameRules` (sprites.test.ts). Facing left; drawSprite mirrors a frame to face right. Since 0.11.0 the rig (rig/)
// draws the mangaka and the assistants, and since 0.12.0 the editor; the string maps left are the cat's (until 0.13.0).
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../looks'
import { PAL, type SpriteMap } from './spriteCore'

export { PAL, frameRules } from './spriteCore'
export type { SpriteMap } from './spriteCore'

/** One palette per assistant look (look 0 is the mangaka's colours), built once so render allocates nothing. */
export const ASSISTANT_PALS: Record<string, string>[] = LOOK_SHIRTS.map((_, i) => ({
  ...PAL, H: LOOK_HAIRS[i], h: LOOK_HAIRS_SHADE[i], R: LOOK_SHIRTS[i], r: LOOK_SHIRTS_SHADE[i], y: LOOK_SHIRTS[i],
}))

/** The mangaka's outfit by level (Decision 7): hoodie 1-4, cardigan 5-9, blazer 10+. Purely visual. */
export type Outfit = 'hoodie' | 'cardigan' | 'blazer'

/** The outfit for a player level (Decision 7's thresholds). */
export function outfitOf(level: number): Outfit {
  return level >= 10 ? 'blazer' : level >= 5 ? 'cardigan' : 'hoodie'
}

/** One palette per outfit, PAL with J (base) and j (shade) swapped, built once so render allocates nothing. The
 * cardigan and the blazer also show the idle and seated frames' white collar (K) and red tie (Y, shade y); the hoodie
 * keeps PAL, where they are the hoodie and shirt colours they replaced. The mangaka only; assistants keep
 * ASSISTANT_PALS (y their own shirt colour, so they look unchanged). */
export const OUTFIT_PALS: Record<Outfit, Record<string, string>> = {
  hoodie: PAL,
  cardigan: { ...PAL, J: '#c9a24a', j: '#a8832f', K: '#f6f6f6', Y: '#c0392b', y: '#8e2a20' },
  blazer: { ...PAL, J: '#2e3a78', j: '#222b5c', K: '#f6f6f6', Y: '#c0392b', y: '#8e2a20' },
}

/**
 * The editor's palette (0.12.0): PAL with the mangaka's trousers F/f as the suit's G/g and the shoes O/o black (E),
 * so the editor walks on the mangaka's leg parts unchanged, as the 0.10 editor walked on recoloured legs. Built once.
 */
export const EDITOR_PAL: Record<string, string> = { ...PAL, F: PAL.G, f: PAL.g, O: PAL.E, o: PAL.E }

/**
 * The cat curled asleep (12x8, facing left, eyes closed): the head hump at the front, the haunch behind, the tail wrapped
 * under. A tabby asleep is still a tabby: two stripes down the curled back (`c` between fur, cols 5 and 8 on rows 4-5), the
 * chest hidden in the curl (no `Q`), as every other cat frame reads it (task B5).
 */
export const CAT_SLEEP: SpriteMap = [
  '............',
  '.LL....LL...',
  'LCcL..LCcL..',
  'LCCCLLLCCCcL',
  'LCcCCcCCcCcL', // 4 two stripes down the curled back, under the dip and on the haunch
  'LCCCCcCCcCcL', // 5 both reach the belly
  '.LCCCCCCCccL',
  '..LLLLLLLLL.',
]

/**
 * The cat sitting up (12x8, facing left): the ears two single `L` tips over fur either side of the ridge, the eye at
 * row 3 col 2 (fur above it, so it never merges with the ridge) with the cream muzzle in front of it (`Q`, row 3 col 1)
 * running into the cream chest patch (`Q`, rows 4-5 at the front) as in every frame where the chest shows (not asleep:
 * curled, it is hidden), two stripes down the back (`c` between fur: col 5 on rows 5-6, col 7 on row 5) and the tail
 * curled round at the back (task B5: the stripes, the muzzle, the eye a column forward from the old frame's row 3 col 3).
 */
export const CAT_SIT: SpriteMap = [
  '.L..L.......', // 0 the ear tips
  'LCLLCL......', // 1 the ears, the ridge between them
  'LCCCcL......', // 2 the forehead
  'LQECcL......', // 3 the eye, the cream muzzle in front of it
  '.LQCcLLLL...', // 4 the chest, the back's top edge
  '.LQQCcCcCLL.', // 5 two stripes hang from the back
  '.LcCCcCCcLCL', // 6 the first reaches the belly; the tail's tip curls round at the back
  '..LLLLLLLLL.', // 7
]

/**
 * The cat's walk (12x8, facing left), 125 ms a frame: the legs apart, then crossing. The ears two single `L` tips
 * over fur (no ridge: the eye at row 2 col 2 sits under fur, a fur cell in front of it so it merges with neither the
 * outline nor the ear line), the muzzle under it, two stripes hanging from the back (cols 5 and 8) and the tail up
 * behind, three rows tall at col 10 (task B5).
 */
export const CAT_WALK: readonly [SpriteMap, SpriteMap] = [
  [
    '.L.L......L.', // 0 the ear tips, the tail's tip
    'LCCCL....LCL', // 1 the ears over fur; the tail up behind
    'LCECLLLLLLCL', // 2 the eye, the back's top edge, the tail
    'LQCCCcCCcCCL', // 3 the muzzle; two stripes hang from the back, the tail joins the rump
    '.LQCCCCCCCcL', // 4 the chest
    '.LQCCCCCCCcL', // 5
    '.LCL.LCL.LcL', // 6 the legs apart
    '.LLL.LLL.LLL', // 7
  ],
  [
    '.L.L......L.',
    'LCCCL....LCL',
    'LCECLLLLLLCL',
    'LQCCCcCCcCCL',
    '.LQCCCCCCCcL',
    '.LQCCCCCCCcL',
    'LCL..LCLLcL.', // 6 the legs crossing
    'LLL..LLLLLL.', // 7
  ],
] as const

/**
 * The idle cycle's groom (Decision 6, 12x8), redrawn (fix round 1: the first draft's paw was a bare colour swap on
 * top of CAT_SIT's own cells, unreadable at scene scale). CAT_SIT with the eye closed (row 3 col 2, the socket
 * shaded `c` rather than hidden) and a raised paw that fills the gap between the ears with two `C` cells, clearly not
 * the plain `L` ridge CAT_SIT has at those cells. Frame 1 moves the paw one row up (into the ear gap itself, row 0,
 * its underside a `c` cell on the ridge row) so the two frames visibly alternate. The stripes and the muzzle are the
 * sit's (task B5).
 */
export const CAT_GROOM: readonly [SpriteMap, SpriteMap] = [
  [
    '.L..L.......',
    'LCCCCL......', // the paw fills the ear gap (cols 2-3 are L, L in CAT_SIT)
    'LCCCcL......',
    'LQcCcL......', // the eye closed: a shade cell, not hidden (col 2 is E in CAT_SIT)
    '.LQCcLLLL...',
    '.LQQCcCcCLL.',
    '.LcCCcCCcLCL',
    '..LLLLLLLLL.',
  ],
  [
    '.LCCL.......', // the paw one row up, in the ear gap itself (cols 2-3 are . , . in CAT_SIT)
    'LCCcCL......', // the paw's underside, a shade cell on the ridge row
    'LCCCcL......',
    'LQcCcL......', // the eye closed
    '.LQCcLLLL...',
    '.LQQCcCcCLL.',
    '.LcCCcCCcLCL',
    '..LLLLLLLLL.',
  ],
] as const

/**
 * The idle cycle's stretch (Decision 6, 12x8): the body stretched long and low, the head at cols 0-4 with its ears
 * laid back as two single `L` tips on row 3 and the eye at row 4 col 3, the tail up at cols 9-11, two stripes down the
 * back (col 6, and col 9 at the tail's root) (task B5: the ears and the stripes).
 */
export const CAT_STRETCH: SpriteMap = [
  '............',
  '.........LCL', // 1 the tail up
  '.........LCL', // 2
  '.L..L....LCL', // 3 the ear tips, laid back along the low head
  'LCCECCcCCcCL', // 4 the eye; two stripes down the back, the second at the tail's root
  '.LQQCCCCCCcL', // 5 the chest
  '.LcCCCCCCcLL', // 6
  '..LLLLLLLLL.', // 7
]

/**
 * A string-map sprite in canvas space, its top-left at (x, y) rounded: rows `fromRow` to `rows - 1`, mirrored left to
 * right when `flip`. Each horizontal run of one key is a single fillRect (indices only, nothing allocated).
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D, map: SpriteMap, x: number, y: number, rows = map.length,
  pal: Record<string, string> = PAL, flip = false, fromRow = 0,
) {
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  for (let r = fromRow; r < rows; r++) {
    const line = map[r]
    const n = line.length
    let c = 0
    while (c < n) {
      const ch = line[c]
      let len = 1
      while (c + len < n && line[c + len] === ch) len++
      if (ch !== '.') {
        ctx.fillStyle = pal[ch] ?? '#f0f'
        ctx.fillRect(flip ? x0 + n - c - len : x0 + c, y0 + r, len, 1)
      }
      c += len
    }
  }
}
