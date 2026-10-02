// The scene's sprites: the palette, the string maps and the painter that draws one (pure module constants, no React,
// nothing allocated per frame). Each map is a list of rows, one character per pixel: '.' is clear, every other key is a
// colour in PAL (uppercase the base, lowercase its shade; the light comes from the top left). Every 24x32 frame passes
// `frameRules` (sprites.test.ts). Facing left; drawSprite mirrors a frame to face right.
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../looks'
import { ASSISTANT_DOZE_C2 } from './generated/assistant-doze'
import type { Mood } from './mood'
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

/** The breath (as the hand-drawn idle has it): rows 0-23 a row lower, row 24 (the hem) tucked under, rows 25-31 kept. */
export function breathOf(f: SpriteMap): SpriteMap {
  return ['.'.repeat(f[0].length), ...f.slice(0, 24), ...f.slice(25)]
}

/** The standing anchor's body under ANCHOR_HEAD (task B1, after art/raw/sprites/mangaka-front.png): the hoodie's
 * torso J with its hood shadow j over the shoulders and down the right, the collar K either side of the neck over a
 * shirt V (R, the assistants' shirt colour) that the drawstring Y hangs from, three-wide darker sleeves j seamed from
 * the torso by an L and ending in a hand S (one s on its shaded side) closed by its own outline on row 23, so the
 * breath (`breathOf`, which tucks row 24, the hem j) never opens it; brown trousers F/f with the gap between the legs,
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

/** Standing, the style anchor (frame 0: ANCHOR_HEAD over IDLE_BODY) and its breath (frame 1: rows 0-23 a row lower,
 * the hem tucked under, `breathOf`), 16 frames each. Hand-drawn: task C2's generated idle (`sprite/mangaka-front-idle`)
 * was a near tie and would have switched bodies mid-cycle against the hand-drawn stretch and sip, so it was retired
 * (its manifest recipe and raw sheet kept, no frame module; DESIGN.md "The sprites"). */
export const MANGAKA_IDLE: readonly [SpriteMap, SpriteMap] = [IDLE_0, breathOf(IDLE_0)]

/** How far each head-steady pose moves the head (the FACES overlay goes at rows 9-12 + headDy). stretch[1] is a row
 * lower than stretch[0] (MANGAKA_STRETCH[1] leads with a blank row, like MANGAKA_IDLE); sip's two frames share the
 * same row 0, so sip has no offset. */
export const HEAD_DY = { idle: [0, 1], sit: [0, 0], stretch: [0, 1], sip: [0, 0] } as const satisfies {
  idle: readonly [0, 1]; sit: readonly [0, 0]; stretch: readonly [0, 1]; sip: readonly [0, 0]
}

/**
 * The idle cycle's stretch (Decision 6): the standing body with both arms flung out and up beside the head, eyes closed.
 * Each sleeve rises from its shoulder cap (row 17, as the idle) a column further out per row to a fist beside the cheek
 * (rows 12-14, one wide at the fingertips and three at the wrist, its one s at the bottom corner); the arms leave the
 * avatar crop, which is why the stretch is exempt from faceRules. Under the shoulders the torso stands alone, two
 * columns wider than the chest between the idle's seams, closed under each sleeve by an L row. STRETCH[1] is the
 * breath (`breathOf`: rows 0-23 a row lower, the hem tucked, headDy = 1), as MANGAKA_IDLE[1] is to MANGAKA_IDLE[0].
 */
const STRETCH_0: SpriteMap = [
  '......LLLLLLLLLL........', // 0
  '....LLHHHHHHHHHhLL......', // 1
  '...LHHHHHHHHHHHHhhL.....', // 2
  '..LHHHHHHHHHHHHHHhhL....', // 3
  '..LHHHHHHHHHHHHHHhhL....', // 4
  '..LHHHHHHHHHHHHHHhhL....', // 5
  '..LHHHSHHHHSHHHHHhhL....', // 6
  '..LHSSSSSSSSSSSSSShL....', // 7
  '..LHSSSSSSSSSSSSSSsL....', // 8
  '..LHSSSSSSSSSSSSSSsL....', // 9  eyes closed
  '..LHSSssSSSSSSssSSsL....', // 10 eyes closed
  '..LHSSSSSSSSSSSSSSsL....', // 11 eyes closed
  'LSLSBBSSSSMMSSSSBBsLSL..', // 12 the fingertips beside the cheeks
  'LSSLSSSSSSSSSSSSSSsLSSL.', // 13
  'LSSsLSSSSSSSSSSSSsLSSsL.', // 14 the fists, three wide at the wrist, one s each
  '.LjjjLLsssssssssLLjjjL..', // 15 the raised sleeves, a column in per row down to the shoulders
  '..LjjjLjKKsssKKjLjjjL...', // 16
  '...LjjjLJKRRRKjLjjjL....', // 17 the shoulder caps, as the idle
  '....LLLJJJRYRJJjLLL.....', // 18 the sleeves' undersides closed; the torso alone below, no arm-line L
  '......LJJJJYJJJjL.......', // 19
  '......LJJJJYJJJjL.......', // 20
  '......LJJJJYJJJjL.......', // 21
  '......LJJJJYJJJjL.......', // 22
  '......LLJJJJJJjLL.......', // 23
  '.......LjjjjjjjjL.......', // 24
  '.......LFFFFFFFfL.......', // 25
  '.......LFFFLFFFfL.......', // 26
  '.......LFFFLFFFfL.......', // 27
  '.......LFFFLFFFfL.......', // 28
  '.......LFFfLFfffL.......', // 29
  '......LOOoLLOOOoL.......', // 30
  '......LLLLLLLLLLL.......', // 31
]
export const MANGAKA_STRETCH: readonly [SpriteMap, SpriteMap] = [STRETCH_0, breathOf(STRETCH_0)]

/**
 * The idle cycle's sip (Decision 6): the standing body with the leading (left) arm raised, a mug at the mouth (rows
 * 12-14: the W rim in its L outline, then the hand holding it, S with its s). The sleeve stands where the idle's hangs
 * (cols 4-6) but ends at row 19, closed by an L row at 20, and its forearm turns in along row 15 under the chin to the
 * hand; the other arm hangs as the idle's. The mug's cells are face keys, so both frames pass faceRules and a mood
 * paints over it. SIP[1] closes the eyes, otherwise unchanged.
 */
export const MANGAKA_SIP: readonly [SpriteMap, SpriteMap] = [
  [
    '......LLLLLLLLLL........', // 0
    '....LLHHHHHHHHHhLL......', // 1
    '...LHHHHHHHHHHHHhhL.....', // 2
    '..LHHHHHHHHHHHHHHhhL....', // 3
    '..LHHHHHHHHHHHHHHhhL....', // 4
    '..LHHHHHHHHHHHHHHhhL....', // 5
    '..LHHHSHHHHSHHHHHhhL....', // 6
    '..LHSSSSSSSSSSSSSShL....', // 7
    '..LHSSSSSSSSSSSSSSsL....', // 8
    '..LHSSEESSSSSSEESSsL....', // 9
    '..LHSSEWSSSSSSEWSSsL....', // 10
    '..LHSSEESSSSSSEESSsL....', // 11
    '..LSBBSSLWWLSSSSBBsL....', // 12 the mug rim
    '...LSSSSLWWLSSSSSSsL....', // 13 the mug
    '....LSSSLSsLSSSSSsL.....', // 14 the hand on the mug
    '...LjjjjjjLsssssLL......', // 15 the forearm, in along the chin to the hand
    '...LjjjLKKsssKKjjLL.....', // 16 the raised sleeve over the hood's shadow
    '...LjjjLJKRRRKjLjjjL....', // 17
    '...LjjjLJJRYRJjLjjjL....', // 18
    '...LjjjLJJJYJJjLjjjL....', // 19
    '....LLLLJJJYJJjLjjjL....', // 20 the raised sleeve's underside; the other arm hangs as the idle
    '.......LJJJYJJjLjjjL....', // 21
    '.......LJJJYJJjLSSsL....', // 22
    '.......LJJJJJJjLLLL.....', // 23
    '.......LjjjjjjjjL.......', // 24
    '.......LFFFFFFFfL.......', // 25
    '.......LFFFLFFFfL.......', // 26
    '.......LFFFLFFFfL.......', // 27
    '.......LFFFLFFFfL.......', // 28
    '.......LFFfLFfffL.......', // 29
    '......LOOoLLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
  [
    '......LLLLLLLLLL........', // 0
    '....LLHHHHHHHHHhLL......', // 1
    '...LHHHHHHHHHHHHhhL.....', // 2
    '..LHHHHHHHHHHHHHHhhL....', // 3
    '..LHHHHHHHHHHHHHHhhL....', // 4
    '..LHHHHHHHHHHHHHHhhL....', // 5
    '..LHHHSHHHHSHHHHHhhL....', // 6
    '..LHSSSSSSSSSSSSSShL....', // 7
    '..LHSSSSSSSSSSSSSSsL....', // 8
    '..LHSSSSSSSSSSSSSSsL....', // 9  eyes closed
    '..LHSSssSSSSSSssSSsL....', // 10 eyes closed
    '..LHSSSSSSSSSSSSSSsL....', // 11 eyes closed
    '..LSBBSSLWWLSSSSBBsL....', // 12
    '...LSSSSLWWLSSSSSSsL....', // 13
    '....LSSSLSsLSSSSSsL.....', // 14
    '...LjjjjjjLsssssLL......', // 15
    '...LjjjLKKsssKKjjLL.....', // 16
    '...LjjjLJKRRRKjLjjjL....', // 17
    '...LjjjLJJRYRJjLjjjL....', // 18
    '...LjjjLJJJYJJjLjjjL....', // 19
    '....LLLLJJJYJJjLjjjL....', // 20
    '.......LJJJYJJjLjjjL....', // 21
    '.......LJJJYJJjLSSsL....', // 22
    '.......LJJJJJJjLLLL.....', // 23
    '.......LjjjjjjjjL.......', // 24
    '.......LFFFFFFFfL.......', // 25
    '.......LFFFLFFFfL.......', // 26
    '.......LFFFLFFFfL.......', // 27
    '.......LFFFLFFFfL.......', // 28
    '.......LFFfLFfffL.......', // 29
    '......LOOoLLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
] as const

/** The walk's first contact under ANCHOR_HEAD: the leading (left) arm swung forward and up, its sleeve three rows
 * and the fist at row 20, the trailing arm hanging as the idle's; the hem as the idle's; the left leg stepping out, a
 * column further per row to a long shoe whose toe reaches two columns past it, the right leg straight under the hip,
 * the crotch line (L) on the hip row above the gap. */
const WALK_CONTACT_0: SpriteMap = [
  '....LLjjKKsssKKjjLL.....', // 16
  '...LjjjLJKRRRKjLjjjL....', // 17
  '...LjjjLJJRYRJjLjjjL....', // 18
  '...LjjjLJJJYJJjLjjjL....', // 19
  '...LSSsLJJJYJJjLjjjL....', // 20 the leading fist, forward and up
  '....LLLLJJJYJJjLjjjL....', // 21
  '.......LJJJYJJjLSSsL....', // 22 the trailing hand, as the idle
  '.......LJJJJJJjLLLL.....', // 23
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
 * out to the right, the right arm swings up), the shade still on the right of every run. */
const WALK_CONTACT_2: SpriteMap = [
  '....LLjjKKsssKKjjLL.....', // 16
  '...LjjjLJKRRRKjLjjjL....', // 17
  '...LjjjLJJRYRJjLjjjL....', // 18
  '...LjjjLJJJYJJjLjjjL....', // 19
  '...LjjjLJJJYJJjLSSsL....', // 20 the leading fist, forward and up
  '...LjjjLJJJYJJjLLLL.....', // 21
  '...LSSsLJJJYJJjL........', // 22 the trailing hand, as the idle
  '....LLLLJJJJJJjL........', // 23
  '.......LjjjjjjjjL.......', // 24 the hem, as the idle
  '.......LFFFFLFFFfL......', // 25 the hips, a column out on the stepping side
  '.......LFFfL.LFFfL......', // 26 the left leg stays under, the right steps out
  '.......LFFfL..LFFfL.....', // 27
  '.......LFFfL...LFFfL....', // 28
  '.......LFffL...LfffL....', // 29
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
 * the forward one), so the cycle steps rather than slides; the pass frames are one map. */
export const MANGAKA_WALK: readonly [SpriteMap, SpriteMap, SpriteMap, SpriteMap] = [
  [...ANCHOR_HEAD, ...WALK_CONTACT_0], WALK_PASS, [...ANCHOR_HEAD, ...WALK_CONTACT_2], WALK_PASS,
]

/** The seated lap and legs (rows 25-31, task B3), shared by both sit frames and the panic: the thighs F forward to the
 * desk (left) with their underside in shade f, the knee at the left end, the shins dropping under it at cols 1-6 to
 * the shoe O/o on its L sole. Rows 29-30 stay inside cols 1-6, clear of the pen tablet (render.test's tablet box). */
const SIT_LAP: SpriteMap = [
  '.LFFFFFFFFFFFFFfL.......', // 25
  '.LFFFFFFFFFFFFFfL.......', // 26
  '.LFFFFFfffffffffL.......', // 27
  '.LFFFfLLLLLLLLLLL.......', // 28
  '.LFFFfL.................', // 29
  '.LOOOoL.................', // 30
  '.LLLLLL.................', // 31
]

/**
 * Seated at the desk (task B3): ANCHOR_HEAD over the idle's shoulders (rows 16-19: the K collar, the R V, the Y
 * drawstring, both sleeves j at the shoulders), then the leading arm bends out along the desk on rows 20-21 to the hand
 * round the pen (row 22, S with its s beside the pen's L at col 0, the pen's tip two rows above the fist), the trailing
 * sleeve hanging as the idle's to its hand on row 22, and the hem over the lap (SIT_LAP) toward the desk. Frame 1 is
 * the stroke: the forearm, the hand and the pen a row lower (rows 20-24), everything else shared, so only the hand
 * moves. No y shade on the drawstring (PAL.y is blue, which would speckle the hoodie's white cord; the idle has none).
 */
const SIT_0: SpriteMap = [
  ...ANCHOR_HEAD,
  ...IDLE_BODY.slice(0, 4), // 16-19: the shoulders, collar, V and the sleeves at the shoulders, as the idle
  'L.LjjjjLJJJYJJjLjjjL....', // 20 the pen's tip; the leading forearm turns out along the desk
  'LLjjjjjLJJJYJJjLjjjL....', // 21
  'LSSsLLLLJJJYJJjLSSsL....', // 22 the hand round the pen (its L at col 0); the trailing hand, as the idle's
  'LLLL...LJJJJJJjLLLL.....', // 23
  '.LLLLLLLjjjjjjjjL.......', // 24 the hem over the lap's top edge, out to the knee
  ...SIT_LAP,
]
export const MANGAKA_SIT: readonly [SpriteMap, SpriteMap] = [
  SIT_0,
  [
    ...SIT_0.slice(0, 20),
    '...LjjjLJJJYJJjLjjjL....', // 20 the sleeve hangs a row longer
    'L.LjjjjLJJJYJJjLjjjL....', // 21 the pen's tip; the forearm turns out a row lower
    'LLjjjjjLJJJYJJjLSSsL....', // 22 the trailing hand stays
    'LSSsLLLLJJJJJJjLLLL.....', // 23 the hand round the pen, a row lower: the stroke
    'LLLLLLLLjjjjjjjjL.......', // 24 the pen's end on the lap's top edge
    ...SIT_LAP,
  ],
]

/**
 * Seated, late on a chapter: both hands clamped on top of the head (the hands meet the hair at rows 1-3, the forearms
 * run down and out over the hair's edge, the elbows out at cols 0-3 and 20-23), ringed eyes, the mouth open. This
 * replaces the earlier ruling's fists beside the head (rows 5-8): with the arms raised and the elbows out, the hands
 * on top read as hands, not ears. Task B3 made the raised arms j sleeves (a cuff under each hand on row 3, the upper
 * arms out along row 16 over the collar, closed under by row 17) and put the stretch's lone torso (rows 18-23) over
 * SIT_LAP under them. Frame 1 presses the hands a row lower (rows 2-3); rows 4-31 are frame 0's.
 */
const PANIC_0: SpriteMap = [
  '..LLLLLLLLLLLLLLLLLL....', // 0
  '..LSSLHHHHHHHHHHLSsL....', // 1  the hands on top of the head
  '.LSSSLHHHHHHHHHHhLSsL...', // 2
  '.LjjLHHHHHHHHHHHHhLjjL..', // 3  the cuffs: the sleeves run down beside the head
  'LjjLHHHHHHHHHHHHHhhLjjL.', // 4
  'LjjLHHHHHHHHHHHHHhhLLjjL', // 5
  'LjjLHHSHHHHSHHHHHhhLLjjL', // 6
  'LjjLSSSSSSSSSSSSSShLLjjL', // 7
  'LjjLSSSSSSSSSSSSSSsLLjjL', // 8
  'LjLHSWWWSSSSSWWWSSsLLjjL', // 9  the ringed eyes
  'LjLHSWEWSSSSSWEWSSsLLjjL', // 10
  'LjLHSWWWSSSSSWWWSSsLLjjL', // 11
  'LjLSBBSSSLMMLSSSBBsLLjjL', // 12 the mouth open
  'LjLLSSSSSSSSSSSSSSsLLjjL', // 13
  'LjL.LSSSSSSSSSSSSsL.LjjL', // 14
  'LjL..LLsssssssssLL..LjjL', // 15
  'LjjjjjLjKKsssKKjLjjjjjjL', // 16 the upper arms out to the elbows, over the hood's shadow and the collar
  'LLLLLLLLJKRRRKjLLLLLLLL.', // 17 the arms' undersides closed; the V
  '......LJJJRYRJJjL.......', // 18 the torso alone under the raised arms, as the stretch's
  ...STRETCH_0.slice(19, 24), // 19-23
  '.LLLLLLLjjjjjjjjL.......', // 24 the hem over the lap's top edge, as the sit
  ...SIT_LAP,
]
export const MANGAKA_PANIC: readonly [SpriteMap, SpriteMap] = [
  PANIC_0,
  [
    '......LLLLLLLLLL........', // 0
    '..LLLLHHHHHHHHHhLLLL....', // 1
    '..LSSLHHHHHHHHHHhLSsL...', // 2  the hands pressed a row lower
    '.LSSSLHHHHHHHHHHHhLSsL..', // 3
    ...PANIC_0.slice(4), // 4-31
  ],
]

/** Asleep in bed (30x14): the chibi head on the pillow (cols 12-29, eyes shut), the shoulders under the blanket: the
 * hood's shadow j over the hoodie J, its underside in shade (task B3). */
export const MANGAKA_LIE: SpriteMap = [
  '..............................', // 0
  '................LLLLLLLLLL....', // 1
  '..............LLHHHHHHHHHhLL..', // 2
  '.............LHHHHHHHHHHHHhhL.', // 3
  '............LHHHHHHHHHHHHHHhhL', // 4
  '............LHHHSHHHHSHHHHHhhL', // 5
  '............LHSSSSSSSSSSSSSShL', // 6
  '............LHSSSSSSSSSSSSSSsL', // 7
  'LLLLLLLLLLLLLHSSSSSSSSSSSSSSsL', // 8
  'LjjjjjjjjjjjLHSSssSSSSSSssSSsL', // 9  the hood's shadow over the shoulders
  'LJJJJJJJJJJJLSBBSSSSMMSSSSBBsL', // 10 the hoodie
  'LJJJJJJJJJJL..LSSSSSSSSSSSSsL.', // 11
  'LjjjjjjjjjjL...LLsssssssssLL..', // 12 its underside in shade
  'LLLLLLLLLLLL..................', // 13
]

/**
 * An assistant asleep at the desk, generated (task C2, art/manifest.json `sprite/assistant-doze`, from the front sheet's
 * dozing cell fitted to a 20x23 box on the frame's last rows): the head down on the folded arms (rows 10-26, eyes shut,
 * eight cells touched in the manifest), the arms on rows 27-30, sleeves (j) since task B3's manifest remap of their J
 * (so they match the seated body's darker sleeves). The readability gate found it reads as dozing more clearly than
 * the hand-drawn frame it replaced (113 fills; 100 at the gate, 91 with the remap). Drawn with the assistant's palette,
 * no mood.
 */
export const ASSISTANT_DOZE: SpriteMap = ASSISTANT_DOZE_C2

/**
 * The editor: the anchor in a grey suit (G/g for J/j), a white collar (row 16 cols 9-12), a red tie (col 11 rows
 * 17-21), glasses across row 10 cols 5-16 (the eyes show on rows 9 and 11) and a 6x7 briefcase at cols 18-23 rows
 * 22-28 in the trailing hand. Frame 1 is the breath, as MANGAKA_IDLE[1] (rows 0-23 a row lower).
 */
export const EDITOR_IDLE: readonly [SpriteMap, SpriteMap] = [
  [
    '......LLLLLLLLLL........', // 0
    '....LLHHHHHHHHHhLL......', // 1
    '...LHHHHHHHHHHHHhhL.....', // 2
    '..LHHHHHHHHHHHHHHhhL....', // 3
    '..LHHHHHHHHHHHHHHhhL....', // 4
    '..LHHHHHHHHHHHHHHhhL....', // 5
    '..LHHHSHHHHSHHHHHhhL....', // 6
    '..LHSSSSSSSSSSSSSShL....', // 7
    '..LHSSSSSSSSSSSSSSsL....', // 8
    '..LHSSEESSSSSSEESSsL....', // 9
    '..LHSPPPPPPPPPPPPSsL....', // 10
    '..LHSSEESSSSSSEESSsL....', // 11
    '..LSBBSSSSMMSSSSBBsL....', // 12
    '...LSSSSSSSSSSSSSSsL....', // 13
    '....LSSSSSSSSSSSSsL.....', // 14
    '.....LLsssssssssLL......', // 15
    '......LGGWWWWGGgL.......', // 16
    '.....LGGGGWNWGGggL......', // 17
    '....LGGGGGWNWGGGggL.....', // 18
    '....LGGGGGWNWGGGggL.....', // 19
    '....LGGLGGWNWGGLggL.....', // 20
    '....LGGLGGWNWGGLggL.....', // 21
    '....LSSLGGGGGGGLSsLLLLLL', // 22
    '.....LLLGGGGGGGLLLLFFFfL', // 23
    '.......LggggggggL.LFFFfL', // 24
    '.......LTTTTTTTtL.LFFFfL', // 25
    '.......LTTTLTTTtL.LFFFfL', // 26
    '.......LTTTLTTTtL.LffffL', // 27
    '.......LTTTLTTttL.LLLLLL', // 28
    '.......LtttLttttL.......', // 29
    '......LOOOLLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
  [
    '........................', // 0
    '......LLLLLLLLLL........', // 1
    '....LLHHHHHHHHHhLL......', // 2
    '...LHHHHHHHHHHHHhhL.....', // 3
    '..LHHHHHHHHHHHHHHhhL....', // 4
    '..LHHHHHHHHHHHHHHhhL....', // 5
    '..LHHHHHHHHHHHHHHhhL....', // 6
    '..LHHHSHHHHSHHHHHhhL....', // 7
    '..LHSSSSSSSSSSSSSShL....', // 8
    '..LHSSSSSSSSSSSSSSsL....', // 9
    '..LHSSEESSSSSSEESSsL....', // 10
    '..LHSPPPPPPPPPPPPSsL....', // 11
    '..LHSSEESSSSSSEESSsL....', // 12
    '..LSBBSSSSMMSSSSBBsL....', // 13
    '...LSSSSSSSSSSSSSSsL....', // 14
    '....LSSSSSSSSSSSSsL.....', // 15
    '.....LLsssssssssLL......', // 16
    '......LGGWWWWGGgL.......', // 17
    '.....LGGGGWNWGGggL......', // 18
    '....LGGGGGWNWGGGggL.....', // 19
    '....LGGGGGWNWGGGggL.....', // 20
    '....LGGLGGWNWGGLggL.....', // 21
    '....LGGLGGWNWGGLggL.....', // 22
    '....LSSLGGGGGGGLSsLLLLLL', // 23
    '.....LLLGGGGGGGLLLLFFFfL', // 24
    '.......LTTTTTTTtL.LFFFfL', // 25
    '.......LTTTLTTTtL.LFFFfL', // 26
    '.......LTTTLTTTtL.LffffL', // 27
    '.......LTTTLTTttL.LLLLLL', // 28
    '.......LtttLttttL.......', // 29
    '......LOOOLLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
] as const

/** The editor's walk: MANGAKA_WALK dressed the same way, the briefcase a row lower on the pass frames. */
export const EDITOR_WALK: readonly [SpriteMap, SpriteMap, SpriteMap, SpriteMap] = [
  [
    '......LLLLLLLLLL........', // 0
    '....LLHHHHHHHHHhLL......', // 1
    '...LHHHHHHHHHHHHhhL.....', // 2
    '..LHHHHHHHHHHHHHHhhL....', // 3
    '..LHHHHHHHHHHHHHHhhL....', // 4
    '..LHHHHHHHHHHHHHHhhL....', // 5
    '..LHHHSHHHHSHHHHHhhL....', // 6
    '..LHSSSSSSSSSSSSSShL....', // 7
    '..LHSSSSSSSSSSSSSSsL....', // 8
    '..LHSSEESSSSSSEESSsL....', // 9
    '..LHSPPPPPPPPPPPPSsL....', // 10
    '..LHSSEESSSSSSEESSsL....', // 11
    '..LSBBSSSSMMSSSSBBsL....', // 12
    '...LSSSSSSSSSSSSSSsL....', // 13
    '....LSSSSSSSSSSSSsL.....', // 14
    '.....LLsssssssssLL......', // 15
    '......LGGWWWWGGgL.......', // 16
    '.....LGGGGWNWGGggL......', // 17
    '....LGGGGGWNWGGGggL.....', // 18
    '....LGGGGGWNWGGGggL.....', // 19
    '....LGGLGGWNWGGLggL.....', // 20
    '....LSSLGGWNWGGLggL.....', // 21
    '....LLLLGGGGGGGLggLLLLLL', // 22
    '.....LLLGGGGGGGLSsLFFFfL', // 23
    '.......LggggggggLLLFFFfL', // 24
    '......LTTTTTTTTTtLLFFFfL', // 25
    '.....LTTTL...LTTTtLFFFfL', // 26
    '.....LTTTL...LTTTtLffffL', // 27
    '.....LTTTL...LTTttLLLLLL', // 28
    '.....LtttL...LttttL.....', // 29
    '....LOOOOL...LOOOoL.....', // 30
    '....LLLLLL...LLLLLL.....', // 31
  ],
  [
    '........................', // 0
    '......LLLLLLLLLL........', // 1
    '....LLHHHHHHHHHhLL......', // 2
    '...LHHHHHHHHHHHHhhL.....', // 3
    '..LHHHHHHHHHHHHHHhhL....', // 4
    '..LHHHHHHHHHHHHHHhhL....', // 5
    '..LHHHHHHHHHHHHHHhhL....', // 6
    '..LHHHSHHHHSHHHHHhhL....', // 7
    '..LHSSSSSSSSSSSSSShL....', // 8
    '..LHSSSSSSSSSSSSSSsL....', // 9
    '..LHSSEESSSSSSEESSsL....', // 10
    '..LHSPPPPPPPPPPPPSsL....', // 11
    '..LHSSEESSSSSSEESSsL....', // 12
    '..LSBBSSSSMMSSSSBBsL....', // 13
    '...LSSSSSSSSSSSSSSsL....', // 14
    '....LSSSSSSSSSSSSsL.....', // 15
    '.....LLsssssssssLL......', // 16
    '......LGGWWWWGGgL.......', // 17
    '.....LGGGGWNWGGggL......', // 18
    '....LGGGGGWNWGGGggL.....', // 19
    '....LGGGGGWNWGGGggL.....', // 20
    '....LGGLGGWNWGGLggL.....', // 21
    '....LGGLGGWNWGGLggL.....', // 22
    '....LSSLGGGGGGGLSsLLLLLL', // 23
    '.....LLLGGGGGGGLLLLFFFfL', // 24
    '.......LggggggggL.LFFFfL', // 25
    '........LTTTTTtL..LFFFfL', // 26
    '........LTTTTTtL..LFFFfL', // 27
    '........LTTTTTtL..LffffL', // 28
    '........LttttttL..LLLLLL', // 29
    '........LOOOOOoL........', // 30
    '........LLLLLLLL........', // 31
  ],
  [
    '......LLLLLLLLLL........', // 0
    '....LLHHHHHHHHHhLL......', // 1
    '...LHHHHHHHHHHHHhhL.....', // 2
    '..LHHHHHHHHHHHHHHhhL....', // 3
    '..LHHHHHHHHHHHHHHhhL....', // 4
    '..LHHHHHHHHHHHHHHhhL....', // 5
    '..LHHHSHHHHSHHHHHhhL....', // 6
    '..LHSSSSSSSSSSSSSShL....', // 7
    '..LHSSSSSSSSSSSSSSsL....', // 8
    '..LHSSEESSSSSSEESSsL....', // 9
    '..LHSPPPPPPPPPPPPSsL....', // 10
    '..LHSSEESSSSSSEESSsL....', // 11
    '..LSBBSSSSMMSSSSBBsL....', // 12
    '...LSSSSSSSSSSSSSSsL....', // 13
    '....LSSSSSSSSSSSSsL.....', // 14
    '.....LLsssssssssLL......', // 15
    '......LGGWWWWGGgL.......', // 16
    '.....LGGGGWNWGGggL......', // 17
    '....LGGGGGWNWGGGggL.....', // 18
    '....LGGGGGWNWGGGggL.....', // 19
    '....LGGLGGWNWGGLggL.....', // 20
    '....LGGLGGWNWGGLSsL.....', // 21
    '....LGGLGGGGGGGLLLLLLLLL', // 22
    '....LSSLGGGGGGGLLLLFFFfL', // 23
    '....LLLLggggggggL.LFFFfL', // 24
    '......LTTTTTTTTTtLLFFFfL', // 25
    '.....LTTTTL...LTTtLFFFfL', // 26
    '.....LTTTTL...LTTtLffffL', // 27
    '.....LTTTTL...LTttLLLLLL', // 28
    '.....LttttL...LtttL.....', // 29
    '.....LOOOL...LOOOOoL....', // 30
    '.....LLLLL...LLLLLLL....', // 31
  ],
  [
    '........................', // 0
    '......LLLLLLLLLL........', // 1
    '....LLHHHHHHHHHhLL......', // 2
    '...LHHHHHHHHHHHHhhL.....', // 3
    '..LHHHHHHHHHHHHHHhhL....', // 4
    '..LHHHHHHHHHHHHHHhhL....', // 5
    '..LHHHHHHHHHHHHHHhhL....', // 6
    '..LHHHSHHHHSHHHHHhhL....', // 7
    '..LHSSSSSSSSSSSSSShL....', // 8
    '..LHSSSSSSSSSSSSSSsL....', // 9
    '..LHSSEESSSSSSEESSsL....', // 10
    '..LHSPPPPPPPPPPPPSsL....', // 11
    '..LHSSEESSSSSSEESSsL....', // 12
    '..LSBBSSSSMMSSSSBBsL....', // 13
    '...LSSSSSSSSSSSSSSsL....', // 14
    '....LSSSSSSSSSSSSsL.....', // 15
    '.....LLsssssssssLL......', // 16
    '......LGGWWWWGGgL.......', // 17
    '.....LGGGGWNWGGggL......', // 18
    '....LGGGGGWNWGGGggL.....', // 19
    '....LGGGGGWNWGGGggL.....', // 20
    '....LGGLGGWNWGGLggL.....', // 21
    '....LGGLGGWNWGGLggL.....', // 22
    '....LSSLGGGGGGGLSsLLLLLL', // 23
    '.....LLLGGGGGGGLLLLFFFfL', // 24
    '.......LggggggggL.LFFFfL', // 25
    '........LTTTTTtL..LFFFfL', // 26
    '........LTTTTTtL..LFFFfL', // 27
    '........LTTTTTtL..LffffL', // 28
    '........LttttttL..LLLLLL', // 29
    '........LOOOOOoL........', // 30
    '........LLLLLLLL........', // 31
  ],
] as const

/** The cat curled asleep (12x8, facing left, eyes closed). */
export const CAT_SLEEP: SpriteMap = [
  '............',
  '.LL....LL...',
  'LCcL..LCcL..',
  'LCCCLLLCCCcL',
  'LCcCCCCCCCcL',
  'LCCCCCCCCCcL',
  '.LCCCCCCCccL',
  '..LLLLLLLLL.',
]

/**
 * The cat sitting up (12x8, facing left), the eye at row 3 col 3, the tail curled round at the back, and a cream chest
 * patch (`Q`, rows 4-5 at the front) as in every frame where the chest shows (not asleep: curled, it is hidden).
 */
export const CAT_SIT: SpriteMap = [
  '.L..L.......',
  'LCLLCL......',
  'LCCCcL......',
  'LCCEcL......',
  '.LQCcLLLL...',
  '.LQQCCCCcLL.',
  '.LcCCCCCcLCL',
  '..LLLLLLLLL.',
]

/** The cat's walk (12x8, facing left), 125 ms a frame: the legs apart, then crossing. */
export const CAT_WALK: readonly [SpriteMap, SpriteMap] = [
  [
    '.L.L........',
    'LCLCL.......',
    'LECCLLLLLLL.',
    'LCCCCCCCCccL',
    '.LQCCCCCCccL',
    '.LQCCCCCCccL',
    '.LCL.LCL.LcL',
    '.LLL.LLL.LLL',
  ],
  [
    '.L.L........',
    'LCLCL.......',
    'LECCLLLLLLL.',
    'LCCCCCCCCccL',
    '.LQCCCCCCccL',
    '.LQCCCCCCccL',
    'LCL..LCLLcL.',
    'LLL..LLLLLL.',
  ],
] as const

/**
 * The idle cycle's groom (Decision 6, 12x8), redrawn (fix round 1: the first draft's paw was a bare colour swap on
 * top of CAT_SIT's own cells, unreadable at scene scale). CAT_SIT with the eye closed (row 3 col 3, the socket
 * shaded `c` rather than hidden) and a raised paw that fills the gap between the ears with two `C` cells and a `c`
 * toe, clearly not the plain `L` ridge or `C` cheek CAT_SIT has at those cells. Frame 1 moves the paw one row up
 * (into the ear gap itself, row 0) so the two frames visibly alternate.
 */
export const CAT_GROOM: readonly [SpriteMap, SpriteMap] = [
  [
    '.L..L.......',
    'LCCCCL......', // the paw fills the ear gap (cols 2-3 were L, L in CAT_SIT)
    'LCcCcL......', // the paw's toe, a shade lower (col 2 was C in CAT_SIT)
    'LCCccL......', // the eye closed: a shade line, not hidden (col 3 was E in CAT_SIT)
    '.LQCcLLLL...',
    '.LQQCCCCcLL.',
    '.LcCCCCCcLCL',
    '..LLLLLLLLL.',
  ],
  [
    '.LCCL.......', // the paw one row up, in the ear gap itself (cols 2-3 were . , . in CAT_SIT)
    'LCcCcL......', // the paw's toe (as frame 0, one row higher)
    'LCCCcL......',
    'LCCccL......', // the eye closed
    '.LQCcLLLL...',
    '.LQQCCCCcLL.',
    '.LcCCCCCcLCL',
    '..LLLLLLLLL.',
  ],
] as const

/** The idle cycle's stretch (Decision 6, 12x8): the body stretched long and low, the head at cols 0-3, the tail up
 * at cols 9-11. */
export const CAT_STRETCH: SpriteMap = [
  '............',
  '.........LCL',
  '.........LCL',
  '.........LCL',
  'LCCECCCCCCCL',
  '.LQQCCCCCCcL',
  '.LcCCCCCCcLL',
  '..LLLLLLLLL.',
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

/**
 * The mood overlay: 14 wide x 4 tall, painted at (x+4, y+9+headDy) over rows 9-12 of a head-steady pose (flipped and
 * shifted to x+6 when the actor faces right). `neutral` has no overlay, so it is not a key here. Each map fully
 * repaints its cells (no '.'), so the closed-outline rule (frameRules) does not apply; only width, height and palette
 * keys are checked.
 */
export const FACES: Record<Exclude<Mood, 'neutral'>, SpriteMap> = {
  happy: [
    'SSSSSSSSSSSSSS',
    'SLESSSSSSSLESS',
    'SSSSSSSSSSSSSS',
    'BBSSSSMMSSSSBB',
  ],
  tired: [
    'SSSSSSSSSSSSSS',
    'SEESSSSSSSEESS',
    'SSSSSSSSSSSSSS',
    'SSSSSLLLLSSSSS',
  ],
  surprised: [
    'SSEESSSSSSEESS',
    'SEWESSSSSEWESS',
    'SSEESSSSSSEESS',
    'SSSSSSLLSSSSSS',
  ],
  sleepy: [
    'SSSSSSSSSSSSSS',
    'SLLSSSSSSSLLSS',
    'SSSSSSSSSSSSSS',
    'BBSSSSSMSSSSBB',
  ],
}

/** The mood marks' own palette: a white highlight, a pale blue sweat drop, gold for the sparkle, the outline. */
export const MARK_PAL: Record<string, string> = { W: '#f6f6f6', R: '#8fd3ff', Y: '#f5b700', L: '#1c1a26' }

/** The mark at the head's top-right edge, at (x+20, y-2) (render.ts `markX`, `MARK_DY`: cols 20-22, rows -2 to 2),
 * 3 wide x 5 tall, in MARK_PAL: a sweat drop (tired), a sparkle (happy), and
 * the existing '!'/'z' glyph shapes (surprised/sleepy) recoloured to MARK_PAL's L. */
export const MARKS: Record<Exclude<Mood, 'neutral'>, SpriteMap> = {
  tired: ['.W.', 'WRW', 'WRW', '.W.', '...'],
  happy: ['.Y.', 'YWY', '.Y.', '...', '...'],
  surprised: ['.L.', '.L.', '.L.', '...', '.L.'],
  sleepy: ['LLL', '..L', '.L.', 'L..', 'LLL'],
}

/** Every exported 24x32 frame, for the frame-rules test. */
export const HUMAN_FRAMES: readonly SpriteMap[] = [
  ...MANGAKA_IDLE, ...MANGAKA_WALK, ...MANGAKA_SIT, ...MANGAKA_PANIC, ...MANGAKA_STRETCH, ...MANGAKA_SIP,
  ASSISTANT_DOZE, ...EDITOR_IDLE, ...EDITOR_WALK,
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
