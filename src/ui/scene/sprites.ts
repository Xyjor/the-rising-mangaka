// The scene's sprites: the palette, the string maps and the painter that draws one (pure module constants, no React,
// nothing allocated per frame). Each map is a list of rows, one character per pixel: '.' is clear, every other key is a
// colour in PAL (uppercase the base, lowercase its shade; the light comes from the top left). Every 24x32 frame passes
// `frameRules` (sprites.test.ts). Facing left; drawSprite mirrors a frame to face right.
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../looks'
import type { Mood } from './mood'

export type SpriteMap = readonly string[]

export const PAL: Record<string, string> = {
  L: '#1c1a26',
  H: '#2b2140', h: '#1d1630',
  S: '#f4cfa5', s: '#dba57d',
  E: '#1b1b1b', W: '#f6f6f6', M: '#c0392b', B: '#e8a0a0',
  R: '#3b6fd6', r: '#2a52a6',
  J: '#6f7a8c', j: '#525c6b',
  T: '#2c2c3a', t: '#1f1f2a',
  O: '#c0392b', o: '#8e2a20',
  G: '#5b6270', g: '#454a55', N: '#c0392b', P: '#3b3b45',
  F: '#6d4c33', f: '#4e3622',
  C: '#e39a4a', c: '#c67d33',
}

/** One palette per assistant look (look 0 is the mangaka's colours), built once so render allocates nothing. */
export const ASSISTANT_PALS: Record<string, string>[] = LOOK_SHIRTS.map((_, i) => ({
  ...PAL, H: LOOK_HAIRS[i], h: LOOK_HAIRS_SHADE[i], R: LOOK_SHIRTS[i], r: LOOK_SHIRTS_SHADE[i],
}))

/** The mangaka's outfit by level (Decision 7): hoodie 1-4, cardigan 5-9, blazer 10+. Purely visual. */
export type Outfit = 'hoodie' | 'cardigan' | 'blazer'

/** The outfit for a player level (Decision 7's thresholds). */
export function outfitOf(level: number): Outfit {
  return level >= 10 ? 'blazer' : level >= 5 ? 'cardigan' : 'hoodie'
}

/** One palette per outfit, PAL with J (base) and j (shade) swapped, built once so render allocates nothing. The
 * mangaka only; assistants keep ASSISTANT_PALS and are unaffected. */
export const OUTFIT_PALS: Record<Outfit, Record<string, string>> = {
  hoodie: PAL,
  cardigan: { ...PAL, J: '#c9a24a', j: '#a8832f' },
  blazer: { ...PAL, J: '#2e3a78', j: '#222b5c' },
}

/** Standing, the style anchor (frame 0) and its breath (frame 1: rows 0-23 a row lower, the hem tucked under), 16 frames each. */
export const MANGAKA_IDLE: readonly [SpriteMap, SpriteMap] = [
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
    '..LSBBSSSSMMSSSSBBsL....', // 12
    '...LSSSSSSSSSSSSSSsL....', // 13
    '....LSSSSSSSSSSSSsL.....', // 14
    '.....LLsssssssssLL......', // 15
    '......LJJJsssJJjL.......', // 16
    '.....LJJJJRWRJJjjL......', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    '....LJJLJJRWRJJLjjL.....', // 20
    '....LJJLJJWRWJJLjjL.....', // 21
    '....LSSLJJRWRJJLSsL.....', // 22
    '.....LLLJJJJJJJLLL......', // 23
    '.......LjjjjjjjjL.......', // 24
    '.......LTTTTTTTtL.......', // 25
    '.......LTTTLTTTtL.......', // 26
    '.......LTTTLTTTtL.......', // 27
    '.......LTTTLTTttL.......', // 28
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
    '..LHSSEWSSSSSSEWSSsL....', // 11
    '..LHSSEESSSSSSEESSsL....', // 12
    '..LSBBSSSSMMSSSSBBsL....', // 13
    '...LSSSSSSSSSSSSSSsL....', // 14
    '....LSSSSSSSSSSSSsL.....', // 15
    '.....LLsssssssssLL......', // 16
    '......LJJJsssJJjL.......', // 17
    '.....LJJJJRWRJJjjL......', // 18
    '....LJJJJJRWRJJJjjL.....', // 19
    '....LJJJJJWRWJJJjjL.....', // 20
    '....LJJLJJRWRJJLjjL.....', // 21
    '....LJJLJJWRWJJLjjL.....', // 22
    '....LSSLJJRWRJJLSsL.....', // 23
    '.....LLLJJJJJJJLLL......', // 24
    '.......LTTTTTTTtL.......', // 25
    '.......LTTTLTTTtL.......', // 26
    '.......LTTTLTTTtL.......', // 27
    '.......LTTTLTTttL.......', // 28
    '.......LtttLttttL.......', // 29
    '......LOOOLLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
] as const

/** How far each head-steady pose moves the head (the FACES overlay goes at rows 9-12 + headDy). stretch[1] is a row
 * lower than stretch[0] (MANGAKA_STRETCH[1] leads with a blank row, like MANGAKA_IDLE); sip's two frames share the
 * same row 0, so sip has no offset. */
export const HEAD_DY = { idle: [0, 1], sit: [0, 0], stretch: [0, 1], sip: [0, 0] } as const satisfies {
  idle: readonly [0, 1]; sit: readonly [0, 0]; stretch: readonly [0, 1]; sip: readonly [0, 0]
}

/**
 * The idle cycle's stretch (Decision 6): the anchor with the arms flung out and up beside the head, eyes closed.
 * STRETCH[1] is the breath (rows 0-23 a row lower, headDy = 1), as MANGAKA_IDLE[1] is to MANGAKA_IDLE[0].
 */
export const MANGAKA_STRETCH: readonly [SpriteMap, SpriteMap] = [
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
    '.LLSBBSSSSMMSSSSBBsL..L.', // 12 arms: hands beside the head
    'LSLLSSSSSSSSSSSSSSsL.LSL', // 13
    'LSL.LSSSSSSSSSSSSsL..LSL', // 14
    'LJL..LLsssssssssLL...LJL', // 15
    'LJL...LJJJsssJJjL....LJL', // 16
    '.....LJJJJRWRJJjjL......', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    '....LJJJJJRWRJJJjjL.....', // 20 no arm-line L (cols 7, 15)
    '....LJJJJJWRWJJJjjL.....', // 21 no arm-line L (cols 7, 15)
    '....LJJJJJRWRJJJJjL.....', // 22 hands become JJ
    '.....LLLJJJJJJJLLL......', // 23
    '.......LjjjjjjjjL.......', // 24
    '.......LTTTTTTTtL.......', // 25
    '.......LTTTLTTTtL.......', // 26
    '.......LTTTLTTTtL.......', // 27
    '.......LTTTLTTttL.......', // 28
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
    '..LHSSSSSSSSSSSSSSsL....', // 10 eyes closed
    '..LHSSssSSSSSSssSSsL....', // 11 eyes closed
    '..LHSSSSSSSSSSSSSSsL....', // 12 eyes closed
    '.LLSBBSSSSMMSSSSBBsL..L.', // 13
    'LSLLSSSSSSSSSSSSSSsL.LSL', // 14
    'LSL.LSSSSSSSSSSSSsL..LSL', // 15
    'LJL..LLsssssssssLL...LJL', // 16
    'LJL...LJJJsssJJjL....LJL', // 17
    '.....LJJJJRWRJJjjL......', // 18
    '....LJJJJJRWRJJJjjL.....', // 19
    '....LJJJJJWRWJJJjjL.....', // 20
    '....LJJJJJRWRJJJjjL.....', // 21
    '....LJJJJJWRWJJJjjL.....', // 22
    '....LJJJJJRWRJJJJjL.....', // 23
    '.....LLLJJJJJJJLLL......', // 24
    '.......LTTTTTTTtL.......', // 25
    '.......LTTTLTTTtL.......', // 26
    '.......LTTTLTTTtL.......', // 27
    '.......LTTTLTTttL.......', // 28
    '.......LtttLttttL.......', // 29
    '......LOOOLLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
] as const

/**
 * The idle cycle's sip (Decision 6): the anchor with the leading hand raised, a mug at the mouth (rows 12-14, the
 * rim then the hand). SIP[1] closes the eyes, otherwise unchanged.
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
    '...LSSSSLWWLSSSSSSsL....', // 13 the mug rim
    '....LSSSLSSLSSSSSsL.....', // 14 the hand
    '.....LLsssssssssLL......', // 15
    '......LJJJsssJJjL.......', // 16
    '.....LJJJJRWRJJjjL......', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    '....LJJLJJRWRJJLjjL.....', // 20
    '....LJJLJJWRWJJLjjL.....', // 21
    '....LJJLJJRWRJJLSsL.....', // 22 the left hand becomes JJ
    '.....LLLJJJJJJJLLL......', // 23
    '.......LjjjjjjjjL.......', // 24
    '.......LTTTTTTTtL.......', // 25
    '.......LTTTLTTTtL.......', // 26
    '.......LTTTLTTTtL.......', // 27
    '.......LTTTLTTttL.......', // 28
    '.......LtttLttttL.......', // 29
    '......LOOOLLOOOoL.......', // 30
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
    '....LSSSLSSLSSSSSsL.....', // 14
    '.....LLsssssssssLL......', // 15
    '......LJJJsssJJjL.......', // 16
    '.....LJJJJRWRJJjjL......', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    '....LJJLJJRWRJJLjjL.....', // 20
    '....LJJLJJWRWJJLjjL.....', // 21
    '....LJJLJJRWRJJLSsL.....', // 22
    '.....LLLJJJJJJJLLL......', // 23
    '.......LjjjjjjjjL.......', // 24
    '.......LTTTTTTTtL.......', // 25
    '.......LTTTLTTTtL.......', // 26
    '.......LTTTLTTTtL.......', // 27
    '.......LTTTLTTttL.......', // 28
    '.......LtttLttttL.......', // 29
    '......LOOOLLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
] as const

/** The walk, 100 ms a frame: contact, pass (a row lower), contact with the legs and arms swapped, pass again. */
export const MANGAKA_WALK: readonly [SpriteMap, SpriteMap, SpriteMap, SpriteMap] = [
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
    '..LSBBSSSSMMSSSSBBsL....', // 12
    '...LSSSSSSSSSSSSSSsL....', // 13
    '....LSSSSSSSSSSSSsL.....', // 14
    '.....LLsssssssssLL......', // 15
    '......LJJJsssJJjL.......', // 16
    '.....LJJJJRWRJJjjL......', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    '....LJJLJJRWRJJLjjL.....', // 20
    '....LSSLJJWRWJJLjjL.....', // 21
    '....LLLLJJRWRJJLjjL.....', // 22
    '.....LLLJJJJJJJLSsL.....', // 23
    '.......LjjjjjjjjLLL.....', // 24
    '......LTTTTTTTTTtL......', // 25
    '.....LTTTL...LTTTtL.....', // 26
    '.....LTTTL...LTTTtL.....', // 27
    '.....LTTTL...LTTttL.....', // 28
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
    '..LHSSEWSSSSSSEWSSsL....', // 11
    '..LHSSEESSSSSSEESSsL....', // 12
    '..LSBBSSSSMMSSSSBBsL....', // 13
    '...LSSSSSSSSSSSSSSsL....', // 14
    '....LSSSSSSSSSSSSsL.....', // 15
    '.....LLsssssssssLL......', // 16
    '......LJJJsssJJjL.......', // 17
    '.....LJJJJRWRJJjjL......', // 18
    '....LJJJJJRWRJJJjjL.....', // 19
    '....LJJJJJWRWJJJjjL.....', // 20
    '....LJJLJJRWRJJLjjL.....', // 21
    '....LJJLJJWRWJJLjjL.....', // 22
    '....LSSLJJRWRJJLSsL.....', // 23
    '.....LLLJJJJJJJLLL......', // 24
    '.......LjjjjjjjjL.......', // 25
    '........LTTTTTtL........', // 26
    '........LTTTTTtL........', // 27
    '........LTTTTTtL........', // 28
    '........LttttttL........', // 29
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
    '..LHSSEWSSSSSSEWSSsL....', // 10
    '..LHSSEESSSSSSEESSsL....', // 11
    '..LSBBSSSSMMSSSSBBsL....', // 12
    '...LSSSSSSSSSSSSSSsL....', // 13
    '....LSSSSSSSSSSSSsL.....', // 14
    '.....LLsssssssssLL......', // 15
    '......LJJJsssJJjL.......', // 16
    '.....LJJJJRWRJJjjL......', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    '....LJJLJJRWRJJLjjL.....', // 20
    '....LJJLJJWRWJJLSsL.....', // 21
    '....LJJLJJRWRJJLLLL.....', // 22
    '....LSSLJJJJJJJLLL......', // 23
    '....LLLLjjjjjjjjL.......', // 24
    '......LTTTTTTTTTtL......', // 25
    '.....LTTTTL...LTTtL.....', // 26
    '.....LTTTTL...LTTtL.....', // 27
    '.....LTTTTL...LTttL.....', // 28
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
    '..LHSSEWSSSSSSEWSSsL....', // 11
    '..LHSSEESSSSSSEESSsL....', // 12
    '..LSBBSSSSMMSSSSBBsL....', // 13
    '...LSSSSSSSSSSSSSSsL....', // 14
    '....LSSSSSSSSSSSSsL.....', // 15
    '.....LLsssssssssLL......', // 16
    '......LJJJsssJJjL.......', // 17
    '.....LJJJJRWRJJjjL......', // 18
    '....LJJJJJRWRJJJjjL.....', // 19
    '....LJJJJJWRWJJJjjL.....', // 20
    '....LJJLJJRWRJJLjjL.....', // 21
    '....LJJLJJWRWJJLjjL.....', // 22
    '....LSSLJJRWRJJLSsL.....', // 23
    '.....LLLJJJJJJJLLL......', // 24
    '.......LjjjjjjjjL.......', // 25
    '........LTTTTTtL........', // 26
    '........LTTTTTtL........', // 27
    '........LTTTTTtL........', // 28
    '........LttttttL........', // 29
    '........LOOOOOoL........', // 30
    '........LLLLLLLL........', // 31
  ],
] as const

/**
 * Seated at the desk: the anchor's head and body, the leading arm out along rows 21-23 to the pen (col 0), the lap on
 * rows 24-29 toward the desk, the shins and shoes at cols 1-6. Frame 1 is the stroke: the hand a row lower.
 */
export const MANGAKA_SIT: readonly [SpriteMap, SpriteMap] = [
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
    '..LSBBSSSSMMSSSSBBsL....', // 12
    '...LSSSSSSSSSSSSSSsL....', // 13
    '....LSSSSSSSSSSSSsL.....', // 14
    '.....LLsssssssssLL......', // 15
    '......LJJJsssJJjL.......', // 16
    '.....LJJJJRWRJJjjL......', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    'L...LJJLJJRWRJJLjjL.....', // 20
    'LLLLLJJLJJWRWJJLjjL.....', // 21
    'LSSJJJJLJJRWRJJLSsL.....', // 22
    'LLLLLLLLJJJJJJJLLL......', // 23
    '.LLLLLLLjjjjjjjjL.......', // 24
    '.LTTTTTTTTTTTTTtL.......', // 25
    '.LTTTTTTTTTTTTTtL.......', // 26
    '.LTTTTTTTTTTTTttL.......', // 27
    '.LttttttttttttttL.......', // 28
    '.LLLLLLLLLLLLLLLL.......', // 29
    '.LOOOoL.................', // 30
    '.LLLLLL.................', // 31
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
    '..LHSSEWSSSSSSEWSSsL....', // 10
    '..LHSSEESSSSSSEESSsL....', // 11
    '..LSBBSSSSMMSSSSBBsL....', // 12
    '...LSSSSSSSSSSSSSSsL....', // 13
    '....LSSSSSSSSSSSSsL.....', // 14
    '.....LLsssssssssLL......', // 15
    '......LJJJsssJJjL.......', // 16
    '.....LJJJJRWRJJjjL......', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    'L...LJJLJJRWRJJLjjL.....', // 20
    'L...LJJLJJWRWJJLjjL.....', // 21
    'LLLLLJJLJJRWRJJLSsL.....', // 22
    'LSSJJJJLJJJJJJJLLL......', // 23
    'LLLLLLLLjjjjjjjjL.......', // 24
    '.LTTTTTTTTTTTTTtL.......', // 25
    '.LTTTTTTTTTTTTTtL.......', // 26
    '.LTTTTTTTTTTTTttL.......', // 27
    '.LttttttttttttttL.......', // 28
    '.LLLLLLLLLLLLLLLL.......', // 29
    '.LOOOoL.................', // 30
    '.LLLLLL.................', // 31
  ],
] as const

/** Seated, late on a chapter: fists clutching the sides of the head, ringed eyes, the mouth open. Frame 1 has the fists a row lower. */
export const MANGAKA_PANIC: readonly [SpriteMap, SpriteMap] = [
  [
    '......LLLLLLLLLL........', // 0
    '....LLHHHHHHHHHhLL......', // 1
    '...LHHHHHHHHHHHHhhL.....', // 2
    '..LHHHHHHHHHHHHHHhhL....', // 3
    'LLLLHHHHHHHHHHHHHhhLLLLL', // 4
    'LSSLHHHHHHHHHHHHHhhLLSsL', // 5
    'LSSLHHSHHHHSHHHHHhhLLSsL', // 6
    'LSSLSSSSSSSSSSSSSShLLSsL', // 7
    'LSSLSSSSSSSSSSSSSSsLLSsL', // 8
    'LJLHSWWWSSSSSWWWSSsLLJjL', // 9
    'LJLHSWEWSSSSSWEWSSsLLJjL', // 10
    'LJLHSWWWSSSSSWWWSSsLLJjL', // 11
    'LJLSBBSSSLMMLSSSBBsLLJjL', // 12
    'LJLLSSSSSSSSSSSSSSsLLJjL', // 13
    'LJL.LSSSSSSSSSSSSsL.LJjL', // 14
    'LJL..LLsssssssssLL..LJjL', // 15
    'LJJJJJLJJJsssJJjLJJJJJjL', // 16
    'LLLLLLJJJJRWRJJjjLLLLLLL', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    '....LJJJJJRWRJJJjjL.....', // 20
    '....LJJJJJWRWJJJjjL.....', // 21
    '....LJJJJJRWRJJJjjL.....', // 22
    '.....LLLJJJJJJJLLL......', // 23
    '.LLLLLLLjjjjjjjjL.......', // 24
    '.LTTTTTTTTTTTTTtL.......', // 25
    '.LTTTTTTTTTTTTTtL.......', // 26
    '.LTTTTTTTTTTTTttL.......', // 27
    '.LttttttttttttttL.......', // 28
    '.LLLLLLLLLLLLLLLL.......', // 29
    '.LOOOoL.................', // 30
    '.LLLLLL.................', // 31
  ],
  [
    '......LLLLLLLLLL........', // 0
    '....LLHHHHHHHHHhLL......', // 1
    '...LHHHHHHHHHHHHhhL.....', // 2
    '..LHHHHHHHHHHHHHHhhL....', // 3
    '..LHHHHHHHHHHHHHHhhL....', // 4
    'LLLLHHHHHHHHHHHHHhhLLLLL', // 5
    'LSSLHHSHHHHSHHHHHhhLLSsL', // 6
    'LSSLSSSSSSSSSSSSSShLLSsL', // 7
    'LSSLSSSSSSSSSSSSSSsLLSsL', // 8
    'LSSLSWWWSSSSSWWWSSsLLSsL', // 9
    'LJLHSWEWSSSSSWEWSSsLLJjL', // 10
    'LJLHSWWWSSSSSWWWSSsLLJjL', // 11
    'LJLSBBSSSLMMLSSSBBsLLJjL', // 12
    'LJLLSSSSSSSSSSSSSSsLLJjL', // 13
    'LJL.LSSSSSSSSSSSSsL.LJjL', // 14
    'LJL..LLsssssssssLL..LJjL', // 15
    'LJJJJJLJJJsssJJjLJJJJJjL', // 16
    'LLLLLLJJJJRWRJJjjLLLLLLL', // 17
    '....LJJJJJRWRJJJjjL.....', // 18
    '....LJJJJJWRWJJJjjL.....', // 19
    '....LJJJJJRWRJJJjjL.....', // 20
    '....LJJJJJWRWJJJjjL.....', // 21
    '....LJJJJJRWRJJJjjL.....', // 22
    '.....LLLJJJJJJJLLL......', // 23
    '.LLLLLLLjjjjjjjjL.......', // 24
    '.LTTTTTTTTTTTTTtL.......', // 25
    '.LTTTTTTTTTTTTTtL.......', // 26
    '.LTTTTTTTTTTTTttL.......', // 27
    '.LttttttttttttttL.......', // 28
    '.LLLLLLLLLLLLLLLL.......', // 29
    '.LOOOoL.................', // 30
    '.LLLLLL.................', // 31
  ],
] as const

/** Asleep in bed (30x14): the chibi head on the pillow (cols 12-29, eyes shut), the shoulders under the blanket. */
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
  'LJJJJJJJJJJJLHSSssSSSSSSssSSsL', // 9
  'LJJJJJJJJJJJLSBBSSSSMMSSSSBBsL', // 10
  'LjjjjjjjjjjL..LSSSSSSSSSSSSsL.', // 11
  'LjjjjjjjjjjL...LLsssssssssLL..', // 12
  'LLLLLLLLLLLL..................', // 13
]

/** An assistant asleep at the desk: SIT[0]'s head (rows 0-14) down 6 rows and right 2, resting on the folded arms (rows
 * 21-23), the eyes shut (the rows 9-11 eyes become S, row 10 ss); the lap, shins and shoes are SIT[0]'s rows 24-31. */
export const ASSISTANT_DOZE: SpriteMap = [
  '........................', // 0
  '........................', // 1
  '........................', // 2
  '........................', // 3
  '........................', // 4
  '........................', // 5
  '........LLLLLLLLLL......', // 6
  '......LLHHHHHHHHHhLL....', // 7
  '.....LHHHHHHHHHHHHhhL...', // 8
  '....LHHHHHHHHHHHHHHhhL..', // 9
  '....LHHHHHHHHHHHHHHhhL..', // 10
  '....LHHHHHHHHHHHHHHhhL..', // 11
  '....LHHHSHHHHSHHHHHhhL..', // 12
  '....LHSSSSSSSSSSSSSShL..', // 13
  '....LHSSSSSSSSSSSSSSsL..', // 14
  '....LHSSSSSSSSSSSSSSsL..', // 15
  '....LHSSssSSSSSSssSSsL..', // 16
  '....LHSSSSSSSSSSSSSSsL..', // 17
  '....LSBBSSSSMMSSSSBBsL..', // 18
  '.....LSSSSSSSSSSSSSSsL..', // 19
  '......LSSSSSSSSSSSSsL...', // 20
  '.LJJJJJLLsssssssssLLjL..', // 21
  '.LJJJJJJJJJJJJJJJJJJjL..', // 22
  '.LLLLLLLJJJJJJJJLLLLLL..', // 23
  '.LLLLLLLjjjjjjjjL.......', // 24
  '.LTTTTTTTTTTTTTtL.......', // 25
  '.LTTTTTTTTTTTTTtL.......', // 26
  '.LTTTTTTTTTTTTttL.......', // 27
  '.LttttttttttttttL.......', // 28
  '.LLLLLLLLLLLLLLLL.......', // 29
  '.LOOOoL.................', // 30
  '.LLLLLL.................', // 31
]

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

/** The cat sitting up (12x8, facing left), the eye at row 3 col 3, the tail curled round at the back. */
export const CAT_SIT: SpriteMap = [
  '.L..L.......',
  'LCLLCL......',
  'LCCCcL......',
  'LCCEcL......',
  '.LCCcLLLL...',
  '.LCCCCCCcLL.',
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
    '.LCCCCCCCccL',
    '.LCCCCCCCccL',
    '.LCL.LCL.LcL',
    '.LLL.LLL.LLL',
  ],
  [
    '.L.L........',
    'LCLCL.......',
    'LECCLLLLLLL.',
    'LCCCCCCCCccL',
    '.LCCCCCCCccL',
    '.LCCCCCCCccL',
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
    '.LCCcLLLL...',
    '.LCCCCCCcLL.',
    '.LcCCCCCcLCL',
    '..LLLLLLLLL.',
  ],
  [
    '.LCCL.......', // the paw one row up, in the ear gap itself (cols 2-3 were . , . in CAT_SIT)
    'LCcCcL......', // the paw's toe (as frame 0, one row higher)
    'LCCCcL......',
    'LCCccL......', // the eye closed
    '.LCCcLLLL...',
    '.LCCCCCCcLL.',
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
  '.LCCCCCCCCcL',
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

/** The mark above the head at (x+11, y-8), 3 wide x 5 tall, in MARK_PAL: a sweat drop (tired), a sparkle (happy), and
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
 * What is wrong with a frame, [] when nothing: every row `w` wide, `h` rows, every key in `pal` (PAL by default), the last row not empty,
 * and a closed outline (on every row with content, the first and last non-'.' character is 'L').
 */
export function frameRules(map: SpriteMap, w = 24, h = 32, pal: Record<string, string> = PAL): string[] {
  const out: string[] = []
  if (map.length !== h) out.push(`${map.length} rows, not ${h}`)
  map.forEach((row, r) => {
    if (row.length !== w) out.push(`row ${r} is ${row.length} wide, not ${w}`)
    for (const ch of row) if (ch !== '.' && !(ch in pal)) out.push(`row ${r} has key ${ch}`)
    const first = row.search(/[^.]/)
    if (first < 0) return
    let last = row.length - 1
    while (row[last] === '.') last--
    if (row[first] !== 'L' || row[last] !== 'L') out.push(`row ${r} is open`)
  })
  if (map.length && !/[^.]/.test(map[map.length - 1])) out.push('the last row is empty')
  return out
}

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
