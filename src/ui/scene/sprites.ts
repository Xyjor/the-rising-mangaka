// The scene's sprites: the palette, the string maps and the painter that draws one (pure module constants, no React,
// nothing allocated per frame). Each map is a list of rows, one character per pixel: '.' is clear, every other key is a
// colour in PAL (uppercase the base, lowercase its shade; the light comes from the top left). Every 24x32 frame passes
// `frameRules` (sprites.test.ts). Facing left; drawSprite mirrors a frame to face right.
import { LOOK_HAIRS, LOOK_HAIRS_SHADE, LOOK_SHIRTS, LOOK_SHIRTS_SHADE } from '../looks'

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

/** Standing, the style anchor (frame 0) and its breath (frame 1: rows 0-24 a row lower), 16 frames each. */
export const MANGAKA_IDLE: readonly [SpriteMap, SpriteMap] = [
  [
    '........LLLLLLLL........', // 0
    '......LLHHHHHHHhL.......', // 1
    '.....LHHHHHHHHHhhL......', // 2
    '....LHHHHHHHHHHHhhL.....', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHSSHHSSHHShhL.....', // 5
    '....LHSSSSSSSSSSShL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSSEWSSSSEWSSsL.....', // 8
    '....LSSEESSSSEESSsL.....', // 9
    '....LBSSSSSSSSSSBsL.....', // 10
    '.....LSSSSMMSSSSsL......', // 11
    '......LSSSSSSSSsL.......', // 12
    '.......LLsssssLL........', // 13
    '.....LLJJJsssJJJjLL.....', // 14
    '....LJJJJJRWRJJJJjjL....', // 15
    '...LJJJJJJRWRJJJJJjjL...', // 16
    '...LJJJJJJWRWJJJJJjjL...', // 17
    '...LJJJJJJRWRJJJJJjjL...', // 18
    '...LJJLJJJWRWJJJLjjjL...', // 19
    '...LJJLJJJRWRJJJLjjjL...', // 20
    '...LSSLJJJWRWJJJLSsjL...', // 21
    '....LLLJJJRWRJJJjLLL....', // 22
    '......LJJJJJJJJJJjjL....', // 23
    '......LjjjjjjjjjjjjL....', // 24
    '......LTTTTTTTTTTttL....', // 25
    '......LTTTTLLTTTTttL....', // 26
    '......LTTTTL.LTTTttL....', // 27
    '......LTTTTL.LTTTttL....', // 28
    '......LttttL.LtttttL....', // 29
    '.....LOOOOOL.LOOOOoL....', // 30
    '.....LLLLLLL.LLLLLLL....', // 31
  ],
  [
    '........................', // 0
    '........LLLLLLLL........', // 1
    '......LLHHHHHHHhL.......', // 2
    '.....LHHHHHHHHHhhL......', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHHHHHHHHHHhhL.....', // 5
    '....LHHSSHHSSHHShhL.....', // 6
    '....LHSSSSSSSSSSShL.....', // 7
    '....LSSSSSSSSSSSSsL.....', // 8
    '....LSSEWSSSSEWSSsL.....', // 9
    '....LSSEESSSSEESSsL.....', // 10
    '....LBSSSSSSSSSSBsL.....', // 11
    '.....LSSSSMMSSSSsL......', // 12
    '......LSSSSSSSSsL.......', // 13
    '.......LLsssssLL........', // 14
    '.....LLJJJsssJJJjLL.....', // 15
    '....LJJJJJRWRJJJJjjL....', // 16
    '...LJJJJJJRWRJJJJJjjL...', // 17
    '...LJJJJJJWRWJJJJJjjL...', // 18
    '...LJJJJJJRWRJJJJJjjL...', // 19
    '...LJJLJJJWRWJJJLjjjL...', // 20
    '...LJJLJJJRWRJJJLjjjL...', // 21
    '...LSSLJJJWRWJJJLSsjL...', // 22
    '....LLLJJJRWRJJJjLLL....', // 23
    '......LJJJJJJJJJJjjL....', // 24
    '......LjjjjjjjjjjjjL....', // 25
    '......LTTTTLLTTTTttL....', // 26
    '......LTTTTL.LTTTttL....', // 27
    '......LTTTTL.LTTTttL....', // 28
    '......LttttL.LtttttL....', // 29
    '.....LOOOOOL.LOOOOoL....', // 30
    '.....LLLLLLL.LLLLLLL....', // 31
  ],
] as const

/** The walk, 100 ms a frame: contact, pass, contact with the legs swapped, pass with the arms swapped. */
export const MANGAKA_WALK: readonly [SpriteMap, SpriteMap, SpriteMap, SpriteMap] = [
  [
    '........LLLLLLLL........', // 0
    '......LLHHHHHHHhL.......', // 1
    '.....LHHHHHHHHHhhL......', // 2
    '....LHHHHHHHHHHHhhL.....', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHSSHHSSHHShhL.....', // 5
    '....LHSSSSSSSSSSShL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSSEWSSSSEWSSsL.....', // 8
    '....LSSEESSSSEESSsL.....', // 9
    '....LBSSSSSSSSSSBsL.....', // 10
    '.....LSSSSMMSSSSsL......', // 11
    '......LSSSSSSSSsL.......', // 12
    '.......LLsssssLL........', // 13
    '.....LLJJJsssJJJjLL.....', // 14
    '....LJJJJJRWRJJJJjjL....', // 15
    '...LJJJJJJRWRJJJJJjjL...', // 16
    '...LJJJJJJWRWJJJJJjjL...', // 17
    '...LJJJJJJRWRJJJJJjjL...', // 18
    '..LJJLLJJJWRWJJJLLjjjL..', // 19
    '..LJJLLJJJRWRJJJLLjjjL..', // 20
    '..LSSLLJJJWRWJJJLLSsjL..', // 21
    '...LLLLJJJRWRJJJjLLLL...', // 22
    '......LJJJJJJJJJJjjL....', // 23
    '......LjjjjjjjjjjjjL....', // 24
    '......LTTTTTTTTTTttL....', // 25
    '.....LTTTTL..LTTTTttL...', // 26
    '....LTTTTL....LTTTttL...', // 27
    '...LTTTTL......LTTTttL..', // 28
    '...LttttL......LtttttL..', // 29
    '..LOOOOOL......LOOOOoL..', // 30
    '..LLLLLLL......LLLLLLL..', // 31
  ],
  [
    '........................', // 0
    '........LLLLLLLL........', // 1
    '......LLHHHHHHHhL.......', // 2
    '.....LHHHHHHHHHhhL......', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHHHHHHHHHHhhL.....', // 5
    '....LHHSSHHSSHHShhL.....', // 6
    '....LHSSSSSSSSSSShL.....', // 7
    '....LSSSSSSSSSSSSsL.....', // 8
    '....LSSEWSSSSEWSSsL.....', // 9
    '....LSSEESSSSEESSsL.....', // 10
    '....LBSSSSSSSSSSBsL.....', // 11
    '.....LSSSSMMSSSSsL......', // 12
    '......LSSSSSSSSsL.......', // 13
    '.......LLsssssLL........', // 14
    '.....LLJJJsssJJJjLL.....', // 15
    '....LJJJJJRWRJJJJjjL....', // 16
    '...LJJJJJJRWRJJJJJjjL...', // 17
    '...LJJJJJJWRWJJJJJjjL...', // 18
    '...LJJJJJJRWRJJJJJjjL...', // 19
    '..LJJLLJJJWRWJJJLLjjjL..', // 20
    '..LJJLLJJJRWRJJJLLjjjL..', // 21
    '..LSSLLJJJWRWJJJLLSsjL..', // 22
    '...LLLLJJJRWRJJJjLLLL...', // 23
    '......LJJJJJJJJJJjjL....', // 24
    '......LjjjjjjjjjjjjL....', // 25
    '......LTTTTTTTTTTttL....', // 26
    '.......LTTTLTTtL........', // 27
    '.......LTTTLTTtL........', // 28
    '.......LtttLtttL........', // 29
    '......LOOOOLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
  [
    '........LLLLLLLL........', // 0
    '......LLHHHHHHHhL.......', // 1
    '.....LHHHHHHHHHhhL......', // 2
    '....LHHHHHHHHHHHhhL.....', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHSSHHSSHHShhL.....', // 5
    '....LHSSSSSSSSSSShL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSSEWSSSSEWSSsL.....', // 8
    '....LSSEESSSSEESSsL.....', // 9
    '....LBSSSSSSSSSSBsL.....', // 10
    '.....LSSSSMMSSSSsL......', // 11
    '......LSSSSSSSSsL.......', // 12
    '.......LLsssssLL........', // 13
    '.....LLJJJsssJJJjLL.....', // 14
    '....LJJJJJRWRJJJJjjL....', // 15
    '...LJJJJJJRWRJJJJJjjL...', // 16
    '...LJJJJJJWRWJJJJJjjL...', // 17
    '...LJJJJJJRWRJJJJJjjL...', // 18
    '...LJJJLJJWRWJJLjjjjL...', // 19
    '...LJJJLJJRWRJJLjjjjL...', // 20
    '...LJSSLJJWRWJJLSsjjL...', // 21
    '...LLLLLJJRWRJJJLLLLL...', // 22
    '......LJJJJJJJJJJjjL....', // 23
    '......LjjjjjjjjjjjjL....', // 24
    '......LTTTTTTTTTTttL....', // 25
    '...LTTTTTTL....LTTttL...', // 26
    '...LTTTTTL.....LTTttL...', // 27
    '..LTTTTTL.......LTTttL..', // 28
    '..LtttttL.......LttttL..', // 29
    '..LOOOOOL......LOOOOoL..', // 30
    '..LLLLLLL......LLLLLLL..', // 31
  ],
  [
    '........................', // 0
    '........LLLLLLLL........', // 1
    '......LLHHHHHHHhL.......', // 2
    '.....LHHHHHHHHHhhL......', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHHHHHHHHHHhhL.....', // 5
    '....LHHSSHHSSHHShhL.....', // 6
    '....LHSSSSSSSSSSShL.....', // 7
    '....LSSSSSSSSSSSSsL.....', // 8
    '....LSSEWSSSSEWSSsL.....', // 9
    '....LSSEESSSSEESSsL.....', // 10
    '....LBSSSSSSSSSSBsL.....', // 11
    '.....LSSSSMMSSSSsL......', // 12
    '......LSSSSSSSSsL.......', // 13
    '.......LLsssssLL........', // 14
    '.....LLJJJsssJJJjLL.....', // 15
    '....LJJJJJRWRJJJJjjL....', // 16
    '...LJJJJJJRWRJJJJJjjL...', // 17
    '...LJJJJJJWRWJJJJJjjL...', // 18
    '...LJJJJJJRWRJJJJJjjL...', // 19
    '...LJJJLJJWRWJJLjjjjL...', // 20
    '...LJJJLJJRWRJJLjjjjL...', // 21
    '...LJSSLJJWRWJJLSsjjL...', // 22
    '...LLLLLJJRWRJJJLLLLL...', // 23
    '......LJJJJJJJJJJjjL....', // 24
    '......LjjjjjjjjjjjjL....', // 25
    '......LTTTTTTTTTTttL....', // 26
    '.......LTTTLTTtL........', // 27
    '.......LTTTLTTtL........', // 28
    '.......LtttLtttL........', // 29
    '......LOOOOLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
] as const

/**
 * Seated at the desk: the leading arm out along rows 19-22 to the pen (col 0), the lap on rows 26-31 toward the desk.
 * Frame 1 is the stroke: the hand a row lower, the pen at rows 21-23.
 */
export const MANGAKA_SIT: readonly [SpriteMap, SpriteMap] = [
  [
    '........LLLLLLLL........', // 0
    '......LLHHHHHHHhL.......', // 1
    '.....LHHHHHHHHHhhL......', // 2
    '....LHHHHHHHHHHHhhL.....', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHSSHHSSHHShhL.....', // 5
    '....LHSSSSSSSSSSShL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSSEWSSSSEWSSsL.....', // 8
    '....LSSEESSSSEESSsL.....', // 9
    '....LBSSSSSSSSSSBsL.....', // 10
    '.....LSSSSMMSSSSsL......', // 11
    '......LSSSSSSSSsL.......', // 12
    '.......LLsssssLL........', // 13
    '.....LLJJJsssJJJjLL.....', // 14
    '....LJJJJJRWRJJJJjjL....', // 15
    '...LJJJJJJRWRJJJJJjjL...', // 16
    '...LJJJJJJWRWJJJJJjjL...', // 17
    '...LJJJJJJRWRJJJJJjjL...', // 18
    '.LLLLLLJJJWRWJJJLjjjL...', // 19
    'LLJJJJJJJJRWRJJJLjjjL...', // 20
    'LSSJJJJJJJWRWJJJLSsjL...', // 21
    'LLLLLLLJJJRWRJJJjLLL....', // 22
    '......LJJJJJJJJJJjjL....', // 23
    '......LjjjjjjjjjjjjL....', // 24
    '......LTTTTTTTTTtLLL....', // 25
    '...LTTTTTTTTTTttL.......', // 26
    '...LTTTTTTTTTTttL.......', // 27
    '...LTTTTTTTTTTttL.......', // 28
    '...LttttttttttttL.......', // 29
    '...LLLLLLLLLLLLLL.......', // 30
    '...LLLLLLLLLLLLLL.......', // 31
  ],
  [
    '........LLLLLLLL........', // 0
    '......LLHHHHHHHhL.......', // 1
    '.....LHHHHHHHHHhhL......', // 2
    '....LHHHHHHHHHHHhhL.....', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHSSHHSSHHShhL.....', // 5
    '....LHSSSSSSSSSSShL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSSEWSSSSEWSSsL.....', // 8
    '....LSSEESSSSEESSsL.....', // 9
    '....LBSSSSSSSSSSBsL.....', // 10
    '.....LSSSSMMSSSSsL......', // 11
    '......LSSSSSSSSsL.......', // 12
    '.......LLsssssLL........', // 13
    '.....LLJJJsssJJJjLL.....', // 14
    '....LJJJJJRWRJJJJjjL....', // 15
    '...LJJJJJJRWRJJJJJjjL...', // 16
    '...LJJJJJJWRWJJJJJjjL...', // 17
    '...LJJJJJJRWRJJJJJjjL...', // 18
    '...LJJJJJJWRWJJJLjjjL...', // 19
    '.LLLLLLJJJRWRJJJLjjjL...', // 20
    'LLJJJJJJJJWRWJJJLSsjL...', // 21
    'LSSJJJJJJJRWRJJJjLLL....', // 22
    'LLLLLLLJJJJJJJJJJjjL....', // 23
    '......LjjjjjjjjjjjjL....', // 24
    '......LTTTTTTTTTtLLL....', // 25
    '...LTTTTTTTTTTttL.......', // 26
    '...LTTTTTTTTTTttL.......', // 27
    '...LTTTTTTTTTTttL.......', // 28
    '...LttttttttttttL.......', // 29
    '...LLLLLLLLLLLLLL.......', // 30
    '...LLLLLLLLLLLLLL.......', // 31
  ],
] as const

/** Seated, late on a chapter: both hands up beside the head, the mouth open. Frame 1 has the hands a row higher. */
export const MANGAKA_PANIC: readonly [SpriteMap, SpriteMap] = [
  [
    '........LLLLLLLL........', // 0
    '......LLHHHHHHHhL.......', // 1
    '..LL.LHHHHHHHHHhhL.LL...', // 2
    '.LSSLHHHHHHHHHHHhhLSSL..', // 3
    '.LSSLHHHHHHHHHHHhhLSSL..', // 4
    '..LJLHHSSHHSSHHShhL.JL..', // 5
    '..LJLHSSSSSSSSSSShL.JL..', // 6
    '..LJLSSSSSSSSSSSSsL.JL..', // 7
    '..LJLSSEWSSSSEWSSsL.JL..', // 8
    '..LJLSSEESSSSEESSsL.JL..', // 9
    '..LJLBSSSSWWSSSSBsL.JL..', // 10
    '..LJLLSSSLMMLSSSsL.LJL..', // 11
    '..LJL.LSSSSSSSSsL..LJL..', // 12
    '..LJL..LLsssssLL...LJL..', // 13
    '..LLLLLJJJsssJJJjLLLLL..', // 14
    '....LJJJJJRWRJJJJjjL....', // 15
    '...LJJJJJJRWRJJJJJjjL...', // 16
    '...LJJJJJJWRWJJJJJjjL...', // 17
    '...LJJJJJJRWRJJJJJjjL...', // 18
    '...LJJJJJJWRWJJJJJjjL...', // 19
    '...LJJJJJJRWRJJJJJjjL...', // 20
    '...LJJJJJJWRWJJJJJjjL...', // 21
    '....LLLJJJRWRJJJjLLL....', // 22
    '......LJJJJJJJJJJjjL....', // 23
    '......LjjjjjjjjjjjjL....', // 24
    '......LTTTTTTTTTtLLL....', // 25
    '...LTTTTTTTTTTttL.......', // 26
    '...LTTTTTTTTTTttL.......', // 27
    '...LTTTTTTTTTTttL.......', // 28
    '...LttttttttttttL.......', // 29
    '...LLLLLLLLLLLLLL.......', // 30
    '...LLLLLLLLLLLLLL.......', // 31
  ],
  [
    '........LLLLLLLL........', // 0
    '..LL..LLHHHHHHHhL..LL...', // 1
    '.LSS.LHHHHHHHHHhhL.SSL..', // 2
    '.LSSLHHHHHHHHHHHhhLSSL..', // 3
    '..LJLHHHHHHHHHHHhhL.JL..', // 4
    '..LJLHHSSHHSSHHShhL.JL..', // 5
    '..LJLHSSSSSSSSSSShL.JL..', // 6
    '..LJLSSSSSSSSSSSSsL.JL..', // 7
    '..LJLSSEWSSSSEWSSsL.JL..', // 8
    '..LJLSSEESSSSEESSsL.JL..', // 9
    '..LJLBSSSSWWSSSSBsL.JL..', // 10
    '..LJLLSSSLMMLSSSsL.LJL..', // 11
    '..LJL.LSSSSSSSSsL..LJL..', // 12
    '..LJL..LLsssssLL...LJL..', // 13
    '..LLLLLJJJsssJJJjLLLLL..', // 14
    '....LJJJJJRWRJJJJjjL....', // 15
    '...LJJJJJJRWRJJJJJjjL...', // 16
    '...LJJJJJJWRWJJJJJjjL...', // 17
    '...LJJJJJJRWRJJJJJjjL...', // 18
    '...LJJJJJJWRWJJJJJjjL...', // 19
    '...LJJJJJJRWRJJJJJjjL...', // 20
    '...LJJJJJJWRWJJJJJjjL...', // 21
    '....LLLJJJRWRJJJjLLL....', // 22
    '......LJJJJJJJJJJjjL....', // 23
    '......LjjjjjjjjjjjjL....', // 24
    '......LTTTTTTTTTtLLL....', // 25
    '...LTTTTTTTTTTttL.......', // 26
    '...LTTTTTTTTTTttL.......', // 27
    '...LTTTTTTTTTTttL.......', // 28
    '...LttttttttttttL.......', // 29
    '...LLLLLLLLLLLLLL.......', // 30
    '...LLLLLLLLLLLLLL.......', // 31
  ],
] as const

/** Asleep in bed (30x14): the head on the pillow (cols 14-29, eyes closed), the shoulders under the blanket. */
export const MANGAKA_LIE: SpriteMap = [
  '..................LLLLLLLL....', // 0
  '................LLHHHHHHHhL...', // 1
  '...............LHHHHHHHHHhhL..', // 2
  '..............LHHHHHHHHHHHhhL.', // 3
  'LLLLLLLLLLLLLLLHHHHHHHHHHHhhL.', // 4
  'LJJJJJJJJJJJJjLHHSSHHSSHHShhL.', // 5
  'LJJJJJJJJJJJJjLHSSSSSSSSSSShL.', // 6
  'LJJJJJJJJJJJJjLSSSSSSSSSSSSsL.', // 7
  'LJJJJJJJJJJJJjLSSSSSSSSSSSSsL.', // 8
  'LjjjjjjjjjjjjjLSSssSSSSssSSsL.', // 9
  'LjjjjjjjjjjjjjLBSSSSSSSSSSBsL.', // 10
  'LLLLLLLLLLLLLL.LSSSSMMSSSSsL..', // 11
  '................LSSSSSSSSsL...', // 12
  '.................LLsssssLL....', // 13
]

/** An assistant asleep at the desk (SIT[0] with the head on the folded arms: rows 0-13 down 6 and right 2, eyes shut). */
export const ASSISTANT_DOZE: SpriteMap = [
  '........................', // 0
  '........................', // 1
  '........................', // 2
  '........................', // 3
  '........................', // 4
  '........................', // 5
  '..........LLLLLLLL......', // 6
  '........LLHHHHHHHhL.....', // 7
  '.......LHHHHHHHHHhhL....', // 8
  '......LHHHHHHHHHHHhhL...', // 9
  '......LHHHHHHHHHHHhhL...', // 10
  '......LHHSSHHSSHHShhL...', // 11
  '......LHSSSSSSSSSSShL...', // 12
  '......LSSSSSSSSSSSSsL...', // 13
  '.....LLSSSSSSSSSSSSsL...', // 14
  '....LJLSSssSSSSssSSsL...', // 15
  '...LJJLBSSSSSSSSSSBsL...', // 16
  '...LJJJLSSSSMMSSSSsLL...', // 17
  '...LJJJJLSSSSSSSSsLjL...', // 18
  '...LJJJJJJJJJJJJJJJjL...', // 19
  '...LJJJJJJJJJJJJJJJjL...', // 20
  '...LjjjjjjjjjjjjjjjjL...', // 21
  '...LLLLLLLLLLLLLLLLLL...', // 22
  '......LJJJJJJJJJJjjL....', // 23
  '......LjjjjjjjjjjjjL....', // 24
  '......LTTTTTTTTTtLLL....', // 25
  '...LTTTTTTTTTTttL.......', // 26
  '...LTTTTTTTTTTttL.......', // 27
  '...LTTTTTTTTTTttL.......', // 28
  '...LttttttttttttL.......', // 29
  '...LLLLLLLLLLLLLL.......', // 30
  '...LLLLLLLLLLLLLL.......', // 31
]

/**
 * The editor (the anchor in a grey suit: short hair, glasses on row 8, a white collar and red tie, the briefcase in
 * the trailing hand). Frame 1 is the breath, rows 0-24 a row lower, the case with them.
 */
export const EDITOR_IDLE: readonly [SpriteMap, SpriteMap] = [
  [
    '........LLLLLLLL........', // 0
    '......LLHHHHHHHhL.......', // 1
    '.....LHHHHHHHHHhhL......', // 2
    '....LHHHHHHHHHHHhhL.....', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHSSSSSSSSSSShL.....', // 5
    '....LSSSSSSSSSSSSsL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSPEWPPPPEWPSsL.....', // 8
    '....LSSEESSSSEESSsL.....', // 9
    '....LBSSSSSSSSSSBsL.....', // 10
    '.....LSSSSMMSSSSsL......', // 11
    '......LSSSSSSSSsL.......', // 12
    '.......LLsssssLL........', // 13
    '.....LLGGGWWWGGGgLL.....', // 14
    '....LGGGGGWNWGGGGggL....', // 15
    '...LGGGGGGWNWGGGGGggL...', // 16
    '...LGGGGGGWNWGGGGGggL...', // 17
    '...LGGGGGGWNWGGGGGggL...', // 18
    '...LGGLGGGGGGGGGLgggL...', // 19
    '...LGGLGGGGGGGGGLgggL...', // 20
    '...LSSLGGGGGGGGGLSLLLLLL', // 21
    '....LLLGGGGGGGGGgLLFFFfL', // 22
    '......LGGGGGGGGGGgLFFFfL', // 23
    '......LgggggggggggLFFFfL', // 24
    '......LTTTTTTTTTTtLFFFfL', // 25
    '......LTTTTLLTTTTtLffffL', // 26
    '......LTTTTL.LTTTtLLLLLL', // 27
    '......LTTTTL.LTTTttL....', // 28
    '......LttttL.LtttttL....', // 29
    '.....LOOOOOL.LOOOOoL....', // 30
    '.....LLLLLLL.LLLLLLL....', // 31
  ],
  [
    '........................', // 0
    '........LLLLLLLL........', // 1
    '......LLHHHHHHHhL.......', // 2
    '.....LHHHHHHHHHhhL......', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHHHHHHHHHHhhL.....', // 5
    '....LHSSSSSSSSSSShL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSSSSSSSSSSSSsL.....', // 8
    '....LSPEWPPPPEWPSsL.....', // 9
    '....LSSEESSSSEESSsL.....', // 10
    '....LBSSSSSSSSSSBsL.....', // 11
    '.....LSSSSMMSSSSsL......', // 12
    '......LSSSSSSSSsL.......', // 13
    '.......LLsssssLL........', // 14
    '.....LLGGGWWWGGGgLL.....', // 15
    '....LGGGGGWNWGGGGggL....', // 16
    '...LGGGGGGWNWGGGGGggL...', // 17
    '...LGGGGGGWNWGGGGGggL...', // 18
    '...LGGGGGGWNWGGGGGggL...', // 19
    '...LGGLGGGGGGGGGLgggL...', // 20
    '...LGGLGGGGGGGGGLgggL...', // 21
    '...LSSLGGGGGGGGGLSLLLLLL', // 22
    '....LLLGGGGGGGGGgLLFFFfL', // 23
    '......LGGGGGGGGGGgLFFFfL', // 24
    '......LgggggggggggLFFFfL', // 25
    '......LTTTTLLTTTTtLFFFfL', // 26
    '......LTTTTL.LTTTtLffffL', // 27
    '......LTTTTL.LTTTtLLLLLL', // 28
    '......LttttL.LtttttL....', // 29
    '.....LOOOOOL.LOOOOoL....', // 30
    '.....LLLLLLL.LLLLLLL....', // 31
  ],
] as const

/** The editor's walk (the mangaka's four frames, dressed the same way), the briefcase hanging under the trailing hand. */
export const EDITOR_WALK: readonly [SpriteMap, SpriteMap, SpriteMap, SpriteMap] = [
  [
    '........LLLLLLLL........', // 0
    '......LLHHHHHHHhL.......', // 1
    '.....LHHHHHHHHHhhL......', // 2
    '....LHHHHHHHHHHHhhL.....', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHSSSSSSSSSSShL.....', // 5
    '....LSSSSSSSSSSSSsL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSPEWPPPPEWPSsL.....', // 8
    '....LSSEESSSSEESSsL.....', // 9
    '....LBSSSSSSSSSSBsL.....', // 10
    '.....LSSSSMMSSSSsL......', // 11
    '......LSSSSSSSSsL.......', // 12
    '.......LLsssssLL........', // 13
    '.....LLGGGWWWGGGgLL.....', // 14
    '....LGGGGGWNWGGGGggL....', // 15
    '...LGGGGGGWNWGGGGGggL...', // 16
    '...LGGGGGGWNWGGGGGggL...', // 17
    '...LGGGGGGWNWGGGGGggL...', // 18
    '..LGGLLGGGGGGGGGLLgggL..', // 19
    '..LGGLLGGGGGGGGGLLgggL..', // 20
    '..LSSLLGGGGGGGGGLLSsgL..', // 21
    '...LLLLGGGGGGGGGgLLLLLLL', // 22
    '......LGGGGGGGGGGgLFFFfL', // 23
    '......LgggggggggggLFFFfL', // 24
    '......LTTTTTTTTTTtLFFFfL', // 25
    '.....LTTTTL..LTTTTLFFFfL', // 26
    '....LTTTTL....LTTTLffffL', // 27
    '...LTTTTL......LTTLLLLLL', // 28
    '...LttttL......LtttttL..', // 29
    '..LOOOOOL......LOOOOoL..', // 30
    '..LLLLLLL......LLLLLLL..', // 31
  ],
  [
    '........................', // 0
    '........LLLLLLLL........', // 1
    '......LLHHHHHHHhL.......', // 2
    '.....LHHHHHHHHHhhL......', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHHHHHHHHHHhhL.....', // 5
    '....LHSSSSSSSSSSShL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSSSSSSSSSSSSsL.....', // 8
    '....LSPEWPPPPEWPSsL.....', // 9
    '....LSSEESSSSEESSsL.....', // 10
    '....LBSSSSSSSSSSBsL.....', // 11
    '.....LSSSSMMSSSSsL......', // 12
    '......LSSSSSSSSsL.......', // 13
    '.......LLsssssLL........', // 14
    '.....LLGGGWWWGGGgLL.....', // 15
    '....LGGGGGWNWGGGGggL....', // 16
    '...LGGGGGGWNWGGGGGggL...', // 17
    '...LGGGGGGWNWGGGGGggL...', // 18
    '...LGGGGGGWNWGGGGGggL...', // 19
    '..LGGLLGGGGGGGGGLLgggL..', // 20
    '..LGGLLGGGGGGGGGLLgggL..', // 21
    '..LSSLLGGGGGGGGGLLSsgL..', // 22
    '...LLLLGGGGGGGGGgLLLLLLL', // 23
    '......LGGGGGGGGGGgLFFFfL', // 24
    '......LgggggggggggLFFFfL', // 25
    '......LTTTTTTTTTTtLFFFfL', // 26
    '.......LTTTLTTtL..LFFFfL', // 27
    '.......LTTTLTTtL..LffffL', // 28
    '.......LtttLtttL..LLLLLL', // 29
    '......LOOOOLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
  ],
  [
    '........LLLLLLLL........', // 0
    '......LLHHHHHHHhL.......', // 1
    '.....LHHHHHHHHHhhL......', // 2
    '....LHHHHHHHHHHHhhL.....', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHSSSSSSSSSSShL.....', // 5
    '....LSSSSSSSSSSSSsL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSPEWPPPPEWPSsL.....', // 8
    '....LSSEESSSSEESSsL.....', // 9
    '....LBSSSSSSSSSSBsL.....', // 10
    '.....LSSSSMMSSSSsL......', // 11
    '......LSSSSSSSSsL.......', // 12
    '.......LLsssssLL........', // 13
    '.....LLGGGWWWGGGgLL.....', // 14
    '....LGGGGGWNWGGGGggL....', // 15
    '...LGGGGGGWNWGGGGGggL...', // 16
    '...LGGGGGGWNWGGGGGggL...', // 17
    '...LGGGGGGWNWGGGGGggL...', // 18
    '...LGGGLGGGGGGGLggggL...', // 19
    '...LGGGLGGGGGGGLggggL...', // 20
    '...LGSSLGGGGGGGLSsggL...', // 21
    '...LLLLLGGGGGGGGLLLLLL..', // 22
    '......LGGGGGGGGGLFFFfL..', // 23
    '......LgggggggggLFFFfL..', // 24
    '......LTTTTTTTTTLFFFfL..', // 25
    '...LTTTTTTL....LLFFFfL..', // 26
    '...LTTTTTL.....LLffffL..', // 27
    '..LTTTTTL.......LLLLLL..', // 28
    '..LtttttL.......LttttL..', // 29
    '..LOOOOOL......LOOOOoL..', // 30
    '..LLLLLLL......LLLLLLL..', // 31
  ],
  [
    '........................', // 0
    '........LLLLLLLL........', // 1
    '......LLHHHHHHHhL.......', // 2
    '.....LHHHHHHHHHhhL......', // 3
    '....LHHHHHHHHHHHhhL.....', // 4
    '....LHHHHHHHHHHHhhL.....', // 5
    '....LHSSSSSSSSSSShL.....', // 6
    '....LSSSSSSSSSSSSsL.....', // 7
    '....LSSSSSSSSSSSSsL.....', // 8
    '....LSPEWPPPPEWPSsL.....', // 9
    '....LSSEESSSSEESSsL.....', // 10
    '....LBSSSSSSSSSSBsL.....', // 11
    '.....LSSSSMMSSSSsL......', // 12
    '......LSSSSSSSSsL.......', // 13
    '.......LLsssssLL........', // 14
    '.....LLGGGWWWGGGgLL.....', // 15
    '....LGGGGGWNWGGGGggL....', // 16
    '...LGGGGGGWNWGGGGGggL...', // 17
    '...LGGGGGGWNWGGGGGggL...', // 18
    '...LGGGGGGWNWGGGGGggL...', // 19
    '...LGGGLGGGGGGGLggggL...', // 20
    '...LGGGLGGGGGGGLggggL...', // 21
    '...LGSSLGGGGGGGLSsggL...', // 22
    '...LLLLLGGGGGGGGLLLLLL..', // 23
    '......LGGGGGGGGGLFFFfL..', // 24
    '......LgggggggggLFFFfL..', // 25
    '......LTTTTTTTTTLFFFfL..', // 26
    '.......LTTTLTTtLLFFFfL..', // 27
    '.......LTTTLTTtLLffffL..', // 28
    '.......LtttLtttLLLLLLL..', // 29
    '......LOOOOLOOOoL.......', // 30
    '......LLLLLLLLLLL.......', // 31
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
  '.LCCCCCCcL..',
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

/** Every exported 24x32 frame, for the frame-rules test. */
export const HUMAN_FRAMES: readonly SpriteMap[] = [
  ...MANGAKA_IDLE, ...MANGAKA_WALK, ...MANGAKA_SIT, ...MANGAKA_PANIC, ASSISTANT_DOZE, ...EDITOR_IDLE, ...EDITOR_WALK,
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
