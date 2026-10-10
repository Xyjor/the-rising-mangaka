// The scene's sprites: the palette, the string maps and the painter that draws one (pure module constants, no React,
// nothing allocated per frame). Each map is a list of rows, one character per pixel: '.' is clear, every other key is a
// colour in PAL (uppercase the base, lowercase its shade; the light comes from the top left). Every 24x32 frame passes
// `frameRules` (sprites.test.ts). Facing left; drawSprite mirrors a frame to face right. Since 0.11.0 the rig (rig/)
// draws the mangaka and the assistants; the string maps left are the editor's and the cat's, the editor's props, and
// the 0.10 standing and walk frames the editor is cut from (`LEGACY_IDLE`, `LEGACY_WALK`).
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../looks'
import { ANCHOR_HEAD, PAL, type SpriteMap } from './spriteCore'

export { ANCHOR_HEAD, PAL, faceRules, frameRules } from './spriteCore'
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

/** A map with each key in `from` swapped for the key at the same place in `to`, every other cell kept (pure: the
 * editor walks on the mangaka's legs recoloured to his suit). */
function recolour(map: SpriteMap, from: string, to: string): SpriteMap {
  return map.map((row) => row.replace(/./g, (ch) => (from.includes(ch) ? to[from.indexOf(ch)] : ch)))
}

/** The standing anchor's body under ANCHOR_HEAD (task B1, after art/raw/sprites/mangaka-front.png): the hoodie's
 * torso J with its hood shadow j over the shoulders and down the right, the collar K either side of the neck over a
 * shirt V (R, the assistants' shirt colour) that the drawstring Y hangs from, three-wide darker sleeves j seamed from
 * the torso by an L and ending in a hand S (one s on its shaded side) closed by its own outline on row 23, so the
 * 0.10 breath (which tucked row 24, the hem j) never opened it; brown trousers F/f with the gap between the legs,
 * and red shoes O/o on an L sole. Sleeve and hand are separate runs, so OUTFIT_PALS' darker j gives the cardigan and
 * blazer darker sleeves for free. */
const IDLE_BODY: SpriteMap = [
  '....LLjjKKsssKKjjLL.....', // 16
  '...LjjjLJKRRRKjLjjjL....', // 17
  '...LjjjLJJRYRJjLjjjL....', // 18
  '...LjjjLJJJYJJjLjjjL....', // 19
  '...LjjjLJJJYJJjLjjjL....', // 20
  '...LjjjLJJJYJJjLjjjL....', // 21
  '...LSSsLJJJYJJjLSSsL....', // 22
  '....LLLLJJJJJJjLLLL.....', // 23
  '.......LjjjjjjjjL.......', // 24
  '.......LFFFFFFFfL.......', // 25
  '.......LFFFLFFFfL.......', // 26
  '.......LFFFLFFFfL.......', // 27
  '.......LFFFLFFFfL.......', // 28
  '.......LFFfLFfffL.......', // 29
  '......LOOoLLOOOoL.......', // 30
  '......LLLLLLLLLLL.......', // 31
]
const IDLE_0: SpriteMap = [...ANCHOR_HEAD, ...IDLE_BODY]

/**
 * The 0.10 mangaka's standing and walk frames: no longer drawn (the rig draws the mangaka since 0.11.0); the editor's
 * walk is cut from their legs until 0.12.0 redraws him. The standing frame is ANCHOR_HEAD over IDLE_BODY, the style
 * anchor (`scripts/pixelate.ts` reports faceRules against it).
 */
export const LEGACY_IDLE: SpriteMap = IDLE_0

/** The walk's first contact under ANCHOR_HEAD: the left leg stepping out, a column further per row to a long shoe
 * whose toe reaches two columns past it, the right leg straight under the hip, the crotch line (L) on the hip row above
 * the gap; the right arm swung forward and up against the stepping leg (its sleeve three rows, the fist at row 20), the
 * left arm hanging as the idle's; the hem as the idle's. */
const WALK_CONTACT_0: SpriteMap = [
  '....LLjjKKsssKKjjLL.....', // 16
  '...LjjjLJKRRRKjLjjjL....', // 17
  '...LjjjLJJRYRJjLjjjL....', // 18
  '...LjjjLJJJYJJjLjjjL....', // 19
  '...LjjjLJJJYJJjLSSsL....', // 20 the right fist, forward and up
  '...LjjjLJJJYJJjLLLL.....', // 21
  '...LSSsLJJJYJJjL........', // 22 the left hand hanging, as the idle's
  '....LLLLJJJJJJjL........', // 23
  '.......LjjjjjjjjL.......', // 24 the hem, as the idle
  '......LFFFFLFFFfL.......', // 25 the hips, a column out on the stepping side
  '......LFFFL.LFFfL.......', // 26 the left leg steps out, the right stays under
  '.....LFFFL..LFFfL.......', // 27
  '....LFFFL...LFFfL.......', // 28
  '....LFFfL...LfffL.......', // 29
  '..LOOOOoL...LOOoL.......', // 30 the forward shoe reaches its toe out
  '..LLLLLLL...LLLLL.......', // 31
]

/** The walk's second contact under ANCHOR_HEAD: WALK_CONTACT_0 with the legs and arms swapped (the right leg steps
 * out to the right, the left arm swings up against it). The light does not swap: each leg keeps its own shading on
 * both contact frames (the shade on the right of every run, the left leg under the hip as the idle's). */
const WALK_CONTACT_2: SpriteMap = [
  '....LLjjKKsssKKjjLL.....', // 16
  '...LjjjLJKRRRKjLjjjL....', // 17
  '...LjjjLJJRYRJjLjjjL....', // 18
  '...LjjjLJJJYJJjLjjjL....', // 19
  '...LSSsLJJJYJJjLjjjL....', // 20 the left fist, forward and up
  '....LLLLJJJYJJjLjjjL....', // 21
  '.......LJJJYJJjLSSsL....', // 22 the right hand hanging, as the idle's
  '.......LJJJJJJjLLLL.....', // 23
  '.......LjjjjjjjjL.......', // 24 the hem, as the idle
  '.......LFFFFLFFFfL......', // 25 the hips, a column out on the stepping side
  '.......LFFFL.LFFfL......', // 26 the left leg stays under, the right steps out
  '.......LFFFL..LFFfL.....', // 27
  '.......LFFFL...LFFfL....', // 28
  '.......LFFfL...LfffL....', // 29 the standing leg shaded as the idle's left
  '.......LOOoL...LOOOOoL..', // 30 the stepping shoe reaches out
  '.......LLLLL...LLLLLLL..', // 31
]

/** The walk's pass: the idle a row lower down to and including the hem (row 25, so the hem never blinks at the walk's
 * ten frames a second), then the legs together, a row shorter, one shoe. */
const WALK_PASS: SpriteMap = [
  '.'.repeat(24), // 0
  ...IDLE_0.slice(0, 25), // 1-25: rows 0-24 of the idle
  '........LFFFFFfL........', // 26 the legs together, passing
  '........LFFFFFfL........', // 27
  '........LFFFFFfL........', // 28
  '........LFFffffL........', // 29
  '........LOOOOOoL........', // 30
  '........LLLLLLLL........', // 31
]

/** The walk, 100 ms a frame: contact, pass (a row lower), contact with the legs and arms swapped, pass again. The
 * contact frames lead with different legs (the left foot reaching out on frame 0, the right on frame 2, the long shoe
 * the forward one), so the cycle steps rather than slides, and each swings up the arm opposite its forward leg (the
 * right on frame 0, the left on frame 2), never the same side's (a pacing gait); the pass frames are one map. */
export const LEGACY_WALK: readonly [SpriteMap, SpriteMap, SpriteMap, SpriteMap] = [
  [...ANCHOR_HEAD, ...WALK_CONTACT_0], WALK_PASS, [...ANCHOR_HEAD, ...WALK_CONTACT_2], WALK_PASS,
]

/**
 * The editor's head (task B4): ANCHOR_HEAD with square glasses over the eyes, two 4x3 P frames (rows 9-11, cols 6-9
 * and 11-14) joined by one P cell on row 10, each with the eye E and its W highlight inside and skin either side, so
 * they read as two lenses rather than the dark bar the 0.8.0 frame wore. The hair rows 0-8 and the blush, mouth and
 * chin rows 12-15 are the anchor's. The editor takes no mood (the rig bakes the mangaka's and the
 * assistants' faces), so the P inside faceRules' window is fine: the editor stays exempt from faceRules.
 */
const EDITOR_HEAD: SpriteMap = [
  ...ANCHOR_HEAD.slice(0, 9), // 0-8: the hair and brow, as the anchor's
  '..LHSSPPPPSPPPPSSSsL....', // 9  the lenses' top edges
  '..LHSSPEWPPPEWPSSSsL....', // 10 the eyes inside the frames, the bridge between
  '..LHSSPPPPSPPPPSSSsL....', // 11 the lenses' bottom edges
  ...ANCHOR_HEAD.slice(12), // 12-15: the blush, mouth and chin, as the anchor's
]

/**
 * The editor's standing body under EDITOR_HEAD: IDLE_BODY's construction (three-wide sleeves seamed from the torso by
 * an L, a hand S/s closed by its own outline under each, the hem on row 24, the gap between the legs, the shoes on an L
 * sole) dressed as a navy suit (G, its g shade down the right of the torso, on each sleeve's right column and as the
 * jacket's hem over the G trousers), after art/raw/sprites/editor.png: the collar W either side of the neck narrowing
 * to the knot of the tie N (col 11, rows 17-21), the shirt W showing beside the knot on rows 17-18, black shoes E, and
 * the 6x7 briefcase (F with its f underside in an L box, cols 18-23, rows 22-28) hanging from the right hand, whose
 * outline is the case's top-left corner, so that hand is two wide (S/s) where the left one is three.
 */
const EDITOR_BODY: SpriteMap = [
  '....LLGGWWsssWWGgLL.....', // 16 the collar points either side of the neck
  '...LGGgLGWWNWWgLGGgL....', // 17 the collar narrows to the tie's knot; the shirt beside it
  '...LGGgLGGWNWGgLGGgL....', // 18
  '...LGGgLGGGNGGgLGGgL....', // 19 the tie down the jacket's closure
  '...LGGgLGGGNGGgLGGgL....', // 20
  '...LGGgLGGGNGGgLGGgL....', // 21
  '...LSSsLGGGGGGgLSsLLLLLL', // 22 the hands; the right one holds the briefcase's top edge
  '....LLLLGGGGGGgLLLLFFFfL', // 23
  '.......LggggggggL.LFFFfL', // 24 the jacket's hem
  '.......LGGGGGGGgL.LFFFfL', // 25 the trousers
  '.......LGGGLGGGgL.LFFFfL', // 26
  '.......LGGGLGGGgL.LffffL', // 27 the case's underside
  '.......LGGGLGGGgL.LLLLLL', // 28
  '.......LGGgLGgggL.......', // 29
  '......LEEELLEEEEL.......', // 30 black shoes
  '......LLLLLLLLLLL.......', // 31
]
const EDITOR_0: SpriteMap = [...EDITOR_HEAD, ...EDITOR_BODY]

/**
 * The editor standing at the spot: frame 0 EDITOR_HEAD over EDITOR_BODY, frame 1 the breath, rows 0-23 a row lower
 * with the hem tucked under as the 0.10 idle's breath had it, but hand-drawn below the hem so the briefcase comes down whole with
 * the hand that holds it (rows 23-29, as on the walk's pass frames) instead of losing a row to the tuck.
 */
export const EDITOR_IDLE: readonly [SpriteMap, SpriteMap] = [
  EDITOR_0,
  [
    '.'.repeat(24), // 0
    ...EDITOR_0.slice(0, 24), // 1-24: rows 0-23 a row lower, the case's top edge and first row with them
    '.......LGGGGGGGgL.LFFFfL', // 25 the trousers, as frame 0's; the case a row lower beside them
    '.......LGGGLGGGgL.LFFFfL', // 26
    '.......LGGGLGGGgL.LFFFfL', // 27
    '.......LGGGLGGGgL.LffffL', // 28 the case's underside
    '.......LGGgLGgggL.LLLLLL', // 29
    '......LEEELLEEEEL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
]

/** The briefcase as EDITOR_BODY hangs it (rows 22-28, cols 18-23): the L top edge, the F body with its f shade down
 * the right, the f underside and the L bottom edge. */
const CASE: SpriteMap = EDITOR_BODY.slice(6, 13).map((row) => row.slice(18))

/** The editor's legs on a walk frame: the mangaka's rows from `from` down in the suit (the trousers F/f to G/g, the
 * shoes O/o to black E), the briefcase's last four rows (CASE[3-6]) drawn over cols 18-23 of the first four, since on
 * every walk frame the case's top edge is three rows above the first leg row; a leg stepping out passes behind it. */
function editorLegs(walk: SpriteMap, from: number): SpriteMap {
  return recolour(walk.slice(from), 'FfOo', 'GgEE').map((row, i) => (i < 4 ? row.slice(0, 18) + CASE[3 + i] : row))
}

/**
 * The editor's walk, built on LEGACY_WALK: its timing, its arm swing and its legs (`editorLegs`, the mangaka's
 * rows recoloured to the suit), under EDITOR_HEAD and EDITOR_BODY's shoulders. The briefcase keeps its idle place on
 * both contact frames (rows 22-28), always in the right hand: on frame 0, where the right arm swings up against the
 * stepping left leg, it hangs from the raised fist's closure row by a short L handle; on frame 2, where the left arm
 * swings up, the right hand holds its top edge as the idle's and the stepping right leg passes behind it on row 28.
 * The pass frames are one map: the idle a row lower down to and including the hem (so the case drops a row with the
 * hand), then the mangaka's legs together beside it.
 */
const EDITOR_PASS: SpriteMap = [
  '.'.repeat(24), // 0
  ...EDITOR_0.slice(0, 25), // 1-25: rows 0-24 of the idle, the case's top three rows with them
  ...editorLegs(WALK_PASS, 26), // 26-31: the legs together, passing; the case a row lower
]
export const EDITOR_WALK: readonly [SpriteMap, SpriteMap, SpriteMap, SpriteMap] = [
  [
    ...EDITOR_HEAD,
    ...EDITOR_BODY.slice(0, 4), // 16-19: the collar, the tie's knot and the shoulders, as the standing editor's
    '...LGGgLGGGNGGgLSSsL....', // 20 the right fist, forward and up
    '...LGGgLGGGNGGgLLLL.....', // 21
    '...LSSsLGGGGGGgLLLLLLLLL', // 22 the left hand hanging, as the idle's; the case hangs from the fist by its handle
    '....LLLLGGGGGGgL..LFFFfL', // 23
    EDITOR_BODY[8], // 24 the jacket's hem, as the idle's
    ...editorLegs(LEGACY_WALK[0], 25), // 25-31: the left leg steps out, the right stays under
  ],
  EDITOR_PASS,
  [
    ...EDITOR_HEAD,
    ...EDITOR_BODY.slice(0, 4), // 16-19
    '...LSSsLGGGNGGgLGGgL....', // 20 the left fist, forward and up
    '....LLLLGGGNGGgLGGgL....', // 21
    '.......LGGGGGGgLSsLLLLLL', // 22 the right hand on the briefcase, as the idle's
    '.......LGGGGGGgLLLLFFFfL', // 23
    EDITOR_BODY[8], // 24
    ...editorLegs(LEGACY_WALK[2], 25), // 25-31: the right leg steps out, behind the case on row 28
  ],
  EDITOR_PASS,
]

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

/** The editor's props: their own palette (paper, its lines, the contract's blue and red, gold, the trophy's wood). */
export const PROP_PAL: Record<string, string> = {
  L: '#1c1a26', W: '#fdfcf7', l: '#b8b2a5', R: '#3b6fd6', M: '#e5484d', Y: '#f5b700', F: '#8b5a2b',
}
/** The envelope (6x4), its flap folded down to a point. */
export const PROP_ENVELOPE: SpriteMap = ['LLLLLL', 'LlWWlL', 'LWllWL', 'LLLLLL']
/** A letter (5x6), two lines of writing. */
export const PROP_LETTER: SpriteMap = ['LLLLL', 'LWWWL', 'LlllL', 'LWWWL', 'LlllL', 'LLLLL']
/** The contract (5x7): the blue heading, the body, the red seal. */
export const PROP_CONTRACT: SpriteMap = ['LLLLL', 'LWWWL', 'LRRRL', 'LWWWL', 'LWWWL', 'LWMWL', 'LLLLL']
/** A trophy (5x6): the gold cup on its stem and a wooden base. */
export const PROP_TROPHY: SpriteMap = ['LLLLL', 'LYYYL', '.LYL.', '.LYL.', 'LFFFL', 'LLLLL']

/** The editor's drawn 24x32 frames (standing and walking), for the frame-rules test. */
export const EDITOR_FRAMES: readonly SpriteMap[] = [...EDITOR_IDLE, ...EDITOR_WALK]

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
