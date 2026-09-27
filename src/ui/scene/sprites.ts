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
    '....LJJLJJWRWJJLjjjL....', // 19
    '....LJJLJJRWRJJLjjjL....', // 20
    '....LSSLJJWRWJJLSsjL....', // 21
    '.....LLLJJRWRJJJLLL.....', // 22
    '......LJJJJJJJJJJjjL....', // 23
    '......LjjjjjjjjjjjjL....', // 24
    '......LTTTTTTTTTTttL....', // 25
    '...LTTTTttL....LTTTTL...', // 26
    '...LTTTttL.....LTTTTL...', // 27
    '..LTTTttL.......LTTTTL..', // 28
    '..LtttttL.......LttttL..', // 29
    '..LOOOOoL......LOOOOOL..', // 30
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
    '....LJJLJJWRWJJLjjjL....', // 20
    '....LJJLJJRWRJJLjjjL....', // 21
    '....LSSLJJWRWJJLSsjL....', // 22
    '.....LLLJJRWRJJJLLL.....', // 23
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
    '......LTTTTTTTTTTttL....', // 25
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
    '......LTTTTTTTTTTttL....', // 25
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
    '...LLLHHHHHHHHHhhL.LL...', // 2
    '..LSSHHHHHHHHHHHhhLSSL..', // 3
    '..LSSHHHHHHHHHHHhhLSSL..', // 4
    '..LJLHHSSHHSSHHShhL.JL..', // 5
    '..LJLHSSSSSSSSSSShL.JL..', // 6
    '..LJLSSSSSSSSSSSSsL.JL..', // 7
    '..LJLSSEWSSSSEWSSsL.JL..', // 8
    '..LJLSSEESSSSEESSsL.JL..', // 9
    '..LJLBSSSSWWSSSSBsL.JL..', // 10
    '..LJ.LSSSLMMLSSSsL..JL..', // 11
    '..LJ..LSSSSSSSSsL...JL..', // 12
    '..LJ...LLsssssLL....JL..', // 13
    '..LJ.LLJJJsssJJJjLL.JL..', // 14
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
    '......LTTTTTTTTTTttL....', // 25
    '...LTTTTTTTTTTttL.......', // 26
    '...LTTTTTTTTTTttL.......', // 27
    '...LTTTTTTTTTTttL.......', // 28
    '...LttttttttttttL.......', // 29
    '...LLLLLLLLLLLLLL.......', // 30
    '...LLLLLLLLLLLLLL.......', // 31
  ],
  [
    '........LLLLLLLL........', // 0
    '...LL.LLHHHHHHHhL..LL...', // 1
    '..LSSLHHHHHHHHHhhL.SSL..', // 2
    '..LSSHHHHHHHHHHHhhLSSL..', // 3
    '..LJLHHHHHHHHHHHhhL.JL..', // 4
    '..LJLHHSSHHSSHHShhL.JL..', // 5
    '..LJLHSSSSSSSSSSShL.JL..', // 6
    '..LJLSSSSSSSSSSSSsL.JL..', // 7
    '..LJLSSEWSSSSEWSSsL.JL..', // 8
    '..LJLSSEESSSSEESSsL.JL..', // 9
    '..LJLBSSSSWWSSSSBsL.JL..', // 10
    '..LJ.LSSSLMMLSSSsL..JL..', // 11
    '..LJ..LSSSSSSSSsL...JL..', // 12
    '..LJ...LLsssssLL....JL..', // 13
    '..LJ.LLJJJsssJJJjLL.JL..', // 14
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
    '......LTTTTTTTTTTttL....', // 25
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

/** Every exported 24x32 frame, for the frame-rules test. */
export const HUMAN_FRAMES: readonly SpriteMap[] = [...MANGAKA_IDLE, ...MANGAKA_WALK, ...MANGAKA_SIT, ...MANGAKA_PANIC]

/**
 * What is wrong with a frame, [] when nothing: every row `w` wide, `h` rows, every key in PAL, the last row not empty,
 * and a closed outline (on every row with content, the first and last non-'.' character is 'L').
 */
export function frameRules(map: SpriteMap, w = 24, h = 32): string[] {
  const out: string[] = []
  if (map.length !== h) out.push(`${map.length} rows, not ${h}`)
  map.forEach((row, r) => {
    if (row.length !== w) out.push(`row ${r} is ${row.length} wide, not ${w}`)
    for (const ch of row) if (ch !== '.' && !(ch in PAL)) out.push(`row ${r} has key ${ch}`)
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
