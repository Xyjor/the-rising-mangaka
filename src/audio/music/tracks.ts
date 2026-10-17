// The music's tracks (0.13.0), pure data and a small catalogue: each track written in the score format of `score.ts`
// (grids, motifs as scale degrees, sections of roman-numeral chords, a form), the title track, the two tracks of each
// season's studio pool, and `CATALOG`, the player's way in (a scene's pool, a compiled track by id). The nine ids are
// working titles, internal only and never shown in the UI. Each season has its character: spring bright and light,
// summer the most upbeat (crisp hats and a shaker; in the G collection no chord rooted on B or F#), autumn warm and
// darker (a lower tone, soft leads, more minor colour), winter sparse and slower (ticking drums, a glock, more space).
// Every section carries a one-line note of its harmonic plan. No Math.random, no clock, no Web Audio.
import type { Season } from '../../sim'
import { compileTrack } from './score'
import type { CompiledTrack, TrackSpec } from './score'
import type { MusicScene } from './types'

/** Every track's id: the title track's and the eight seasonal tracks'. */
export type TrackId =
  | 'blank-page'
  | 'slow-ink'
  | 'sakura-margins'
  | 'screentone'
  | 'cold-ramune'
  | 'rain-on-the-sill'
  | 'tea-break'
  | 'first-snow'
  | 'kotatsu'

const TRACK_IDS: readonly TrackId[] = [
  'blank-page', 'slow-ink', 'sakura-margins', 'screentone', 'cold-ramune', 'rain-on-the-sill', 'tea-break',
  'first-snow', 'kotatsu',
]

/** Whether a string is one of the nine track ids. */
export function isTrackId(s: string): s is TrackId {
  return (TRACK_IDS as readonly string[]).includes(s)
}

/** Every track by id. */
export const TRACKS: Record<TrackId, TrackSpec> = {
  'blank-page': {
    title: 'Blank Page', key: 'C major', bpm: 72, lead: 'bell', leadTonic: 72, // degree 1 = C5
    feel: { swing: 0.58, humanise: 0.008, fill: 0.3, ghost: 0.08, vary: 0.35, answer: 0.4 },
    mix: { keys: 1, bass: 0.9, lead: 0.85, drums: 0.7 }, tone: 2400, space: 0.28,
    drums: {
      tick: { h: 'x...x...x...x...' },
      half: { k: 'X.........x.....', s: '........x.......', h: 'x...x...x...x...' },
    },
    comp: { pad: 'X---------------', push: 'X------.x------.', lift: 'X-----x---.x----' },
    bass: { hold: 'R---------------', walk: 'R-----5-R---..A-', two: 'R------.R-----A-' },
    motifs: {
      // The intro's pickup: G A C', rising into the first bar of A.
      m0: "_:8 5:2 6:2 1':4",
      // The call: G A G E, then D E and a held G, with space after.
      m1: "_:4 5:2 6:2 5:4 3:4 | 2:2 3:2 5:8 _:4",
      // The response: down from C' to G, settling on E.
      m2: "_:4 1':2 7:2 6:4 5:4 | 5:2 3:6 _:2 2:2 3:4",
      // The question that closes A: up to a held C', then down to G, left open over the dominant.
      m3: "6:4 5:2 6:2 1':8 | 7:2 6:2 5:4 _:8",
      // B's high call: E' D' C' to a held A, then G and a climb to B.
      m4: "3':4 2':2 1':2 6:8 | 5:4 _:4 3:2 5:2 7:4",
      // B's answer: the same opening, turning back down to A.
      m5: "3':4 2':2 1':2 6:4 1':4 | 7:4 5:4 6:8",
      // The last word: E D and a long C.
      m6: '_:4 3:2 2:2 1:8',
    },
    sections: {
      // The subdominant to a suspended dominant: a door left ajar into A.
      intro: { chords: 'IVmaj9 | V9sus', comp: 'pad', lead: '. m0' },
      // I-vi-ii-V twice, the second time through iii-vi and IV: home, gently.
      A: {
        chords: 'Imaj9 | vi9 | ii9 | V9sus | Imaj9 | iii7 vi7 | IVmaj9 | V9sus V9',
        comp: 'push|lift', lead: 'm1 - . . m2 - m3 -',
      },
      // The lift: from IV down through iii and vi to I, then round again to the suspended V.
      B: {
        chords: 'IVmaj9 | iii7 | vi9 | Imaj7 | IVmaj9 | iii7 vi7 | ii9 | V9sus',
        comp: 'lift|push', bass: 'two', drums: 'tick half', lead: 'm4 - . . m5 - . .',
      },
      // A again, with the bass walking and the light beat under it.
      A2: { like: 'A', bass: 'walk', drums: 'half' },
      // IV to I, a plagal close.
      outro: { chords: 'IVmaj9 | Imaj9', comp: 'pad', bass: 'hold', drums: 'tick .', lead: '. m6' },
    },
    form: 'intro A B A2 outro', // 2+8+8+8+2 = 28 bars, about 93 s
  },
  'slow-ink': {
    title: 'Slow Ink', key: 'F major', bpm: 74, lead: 'soft', leadTonic: 65, // degree 1 = F4
    feel: { swing: 0.6, humanise: 0.008, fill: 0.6, ghost: 0.15, vary: 0.4, answer: 0.3 },
    mix: { keys: 1, bass: 1, lead: 0.8, drums: 0.85 }, tone: 2600, space: 0.22,
    drums: {
      main: { k: 'X......x..x.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
      half: { k: 'X.........x.....', s: '........x.......', h: 'x...x...x...x...' },
      tick: { h: 'x...x...x...x...' },
    },
    comp: { pad: 'X---------------', push: 'X------.x------.', lift: 'X-----x---.x----' },
    bass: { hold: 'R---------------', walk: 'R-----5-R---..A-', two: 'R------.R-----A-' },
    motifs: {
      m1: "_:2 5:2 6:2 1':4 6:2 5:4 | 3:8 _:8",
      m2: '_:2 3:2 5:2 6:4 5:2 3:2 2:2 | 3:6 _:10',
      m3: "6:2 1':2 2':4 1':2 6:2 5:4 | 3:4 5:2 3:2 1:8",
    },
    sections: {
      // IV to I: the plagal sway the whole track leans on.
      intro: { chords: 'IVmaj9 | Imaj9', comp: 'pad', drums: 'tick .' },
      // From IV through iii-vi and ii to a suspended V, then round again to land on I.
      A: {
        chords: 'IVmaj9 | iii7 vi7 | ii9 | V9sus | IVmaj9 | iii7 vi7 | ii9 V9 | Imaj9',
        comp: 'push', bass: 'walk', drums: 'main',
      },
      // A with the lead.
      A2: { like: 'A', lead: 'm1 - . . m2 - m3 -' },
      // The relative minor's turn: vi and iii, then IV to the suspended V.
      B: { chords: 'vi9 | iii7 | IVmaj9 | V9sus', comp: 'lift', bass: 'two', drums: 'half', lead: '. . m3 -' },
      // IV to I again, to close.
      outro: { chords: 'IVmaj9 | Imaj9', comp: 'pad', bass: 'hold', drums: 'tick .' },
    },
    form: 'intro A A2 B A2 outro', // 2+8+8+4+8+2 = 32 bars, about 104 s
  },
  'sakura-margins': {
    title: 'Sakura Margins', key: 'F major', bpm: 80, lead: 'bell', leadTonic: 65, // degree 1 = F4
    feel: { swing: 0.56, humanise: 0.006, fill: 0.35, ghost: 0.1, vary: 0.35, answer: 0.45 },
    mix: { keys: 0.95, bass: 0.9, lead: 0.85, drums: 0.75 }, tone: 2800, space: 0.24,
    drums: {
      skip: { k: 'X.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx' },
      float: { k: 'x.........x.....', s: '............x...', h: '..x...x...x...x.' },
      tick: { h: '..x...x...x...x.' },
    },
    comp: { bloom: 'X---------------', lilt: '..x-----..x-----', skip: 'X-----x---x-----' },
    bass: { root: 'R-------5-------', bounce: 'R-----R.5-----A-' },
    motifs: {
      // The call: A C D, then C and A held, then G A and a held C.
      s1: '_:2 3:2 5:2 6:2 5:4 3:4 | 2:2 3:2 5:4 _:8',
      // The response: up to F', down through D and C to G, then E held open over the dominant.
      s2: "_:2 6:2 1':2 6:2 5:4 3:2 2:2 | 7,:8 _:8",
      // B's call, up in the light: D F' G' F' D, then C and A.
      s3: "_:2 6:2 1':4 2':2 1':2 6:4 | 5:4 3:4 _:8",
      // B's answer: A' G' F' to D, then C held, a D, and C again.
      s4: "_:4 3':2 2':2 1':4 6:4 | 5:6 6:2 5:8",
      // A2's second phrase: F' D C A, a rise to C, then D C A G.
      s5: "_:2 1':2 6:2 5:2 3:4 5:4 | 6:4 5:2 3:2 2:8",
      // The last word: D C A and F.
      s6: '_:4 6:2 5:2 3:4 1:4',
    },
    sections: {
      // I, then ii to a suspended V: the window opening.
      intro: { chords: 'Imaj9 | ii9 V9sus', comp: 'bloom', drums: 'tick .' },
      // I-V-vi-IV twice, the second time turning through ii to the suspended V.
      A: {
        chords: 'Imaj9 | V7 | vi9 | IVmaj9 | Imaj9 | V7 | ii9 | V9sus',
        comp: 'lilt', bass: 'bounce', drums: 'skip', lead: 's1 - . . s2 - . .',
      },
      // The lift: IV and V, then iii to vi, the brightest corner of the key, and ii to the suspended V.
      B: {
        chords: 'IVmaj9 | V9 | iii7 vi9 | ii9 V9sus',
        comp: 'skip|lilt', bass: 'root', drums: 'float', lead: 's3 - s4 -',
      },
      // A again with its second phrase changed.
      A2: { like: 'A', lead: 's1 - . . s5 - . .' },
      // ii to the suspended V, home to I.
      outro: { chords: 'ii9 V9sus | Imaj9', comp: 'bloom', bass: 'root', drums: 'tick .', lead: '. s6' },
    },
    form: 'intro A B A2 B outro', // 2+8+4+8+4+2 = 28 bars, 84 s
  },
  screentone: {
    title: 'Screentone', key: 'G major', bpm: 84, lead: 'bell', leadTonic: 67, // degree 1 = G4
    feel: { swing: 0.54, humanise: 0.005, fill: 0.5, ghost: 0.18, vary: 0.4, answer: 0.35 },
    mix: { keys: 0.9, bass: 1, lead: 0.8, drums: 0.9 }, tone: 3000, space: 0.18,
    drums: {
      groove: { k: 'X......x.x......', s: '....x.......x...', h: 'x.x.x.x.x.xxx.x.', sh: '...x...x...x...x' },
      break: { k: 'x.........x.....', s: '....x.......x...', h: 'x...x...x...x...', sh: 'x.x.x.x.x.x.x.x.' },
      shake: { sh: 'x.x.x.x.x.x.x.x.' },
    },
    comp: { sun: 'X-------X-------', pop: 'X-----x---x-----', drift: '..x-----..x-----' },
    bass: { pump: 'R-----R-5-----A-', skip: 'R--.R--.5-----O-' },
    motifs: {
      // One-bar calls and answers, short and bright: D E D, B and a held D.
      t1: '_:2 5:2 6:2 5:2 _:2 3:2 5:4',
      // E G' E, a held D and B.
      t2: "_:2 6:2 1':2 6:2 5:4 3:4",
      // A B D B A and a held G.
      t3: '_:2 2:2 3:2 5:2 3:2 2:2 1:4',
      // B's calls, an octave up: B' A' G' E D.
      t4: "_:2 3':2 2':2 1':2 6:4 5:4",
      // G' A' B', then A' and G' held.
      t5: "_:2 1':2 2':2 3':2 2':4 1':4",
      // The last word: B A B and a long G.
      t6: '_:2 3:2 2:2 3:2 1:8',
    },
    sections: {
      // I to IV: the sunlit sway, over the shaker alone.
      intro: { chords: 'Imaj9 | IVmaj9', comp: 'sun', drums: 'shake .' },
      // I, then IV-V pushing round to vi; again, with ii and a suspended V to turn it home.
      A: {
        chords: 'Imaj9 | IVmaj9 V9 | vi9 | IVmaj9 V9sus | Imaj9 | IVmaj9 V9 | ii9 | V9sus V9',
        comp: 'pop|drift', bass: 'pump', drums: 'groove', lead: 't1 . t2 . t1 . t3 .',
      },
      // From IV: I, ii and vi, then IV-V and vi to the suspended V.
      B: {
        chords: 'IVmaj9 | Imaj9 | ii9 | vi9 | IVmaj9 | V9 | vi9 | V9sus',
        comp: 'drift', bass: 'skip', drums: 'groove', lead: 't4 . t5 . t4 . . .',
      },
      // The breakdown: vi to IV, ii with its 11th to the suspended V, under steady shaker.
      break: { chords: 'vi9 | IVmaj9 | ii11 | V9sus', comp: 'sun', bass: 'pump', drums: 'break' },
      // A again, the calls swapped.
      A2: { like: 'A', lead: 't2 . t1 . t2 . t3 .' },
      // IV to I.
      outro: { chords: 'IVmaj9 | Imaj9', comp: 'sun', bass: 'pump', drums: 'shake .', lead: '. t6' },
    },
    form: 'intro A B break A2 outro', // 2+8+8+4+8+2 = 32 bars, about 91 s
  },
  'cold-ramune': {
    title: 'Cold Ramune', key: 'E minor', bpm: 80, lead: 'soft', leadTonic: 64, // degree 1 = E4
    feel: { swing: 0.6, humanise: 0.009, fill: 0.4, ghost: 0.12, vary: 0.35, answer: 0.35 },
    mix: { keys: 1, bass: 1, lead: 0.85, drums: 0.8 }, tone: 2500, space: 0.26,
    drums: {
      dusk: { k: 'X......x.x......', s: '....x.......x...', h: 'x...x...x...x...', sh: '.x.x.x.x.x.x.x.x' },
      glow: {
        k: 'x.........x.....x.....x.........',
        s: '....x.......x.......x.......x.x.',
        sh: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
      },
      shake: { sh: '.x.x.x.x.x.x.x.x' },
    },
    comp: { pad: 'X---------------', halves: 'X-------x-------', late: '...x------..x---' },
    bass: { slow: 'R-------------A-', octave: 'R-----O-R-----5-' },
    motifs: {
      // The call: B G, a held B and D, then B G F# and a long E.
      r1: '_:4 5:2 3:2 5:4 7:4 | 5:2 3:2 2:2 1:4 _:6',
      // The response: E' D, a held B, G B, settling on G.
      r2: "_:4 1':2 7:2 5:4 3:2 5:2 | 3:8 _:8",
      // B's call, higher: G' F#' E' D, B, then C B and a held A.
      r3: "_:2 3':2 2':2 1':2 7:4 5:4 | 6:2 5:2 4:4 _:8",
      // B's answer: climbing B C D to E', then D C and a long B.
      r4: "_:6 5:2 6:2 7:2 1':4 | 7:2 6:2 5:12",
      // The last word: B G F# E.
      r5: '_:2 5:2 3:2 2:2 1:8',
    },
    sections: {
      // VI to a suspended VII: the evening coming on.
      intro: { chords: 'VImaj9 | VII9sus', comp: 'pad', drums: 'shake .' },
      // i-VI-III-VII, then i-VI and iv to the suspended VII.
      A: {
        chords: 'i9 | VImaj9 | IIImaj9 | VII9 | i9 | VImaj9 | iv9 | VII9sus VII9',
        comp: 'halves', bass: 'octave', drums: 'dusk', lead: '. r1 - . r2 - . .',
      },
      // From iv: VII to the relative major III and VI, then iv, i and VI to the suspended VII.
      B: {
        chords: 'iv9 | VII9 | IIImaj9 | VImaj9 | iv11 | i9 | VImaj7 | VII9sus',
        comp: 'late|halves', bass: 'slow', drums: 'glow - glow - dusk dusk glow -', lead: 'r3 - . . r4 - . .',
      },
      // A with the phrases swapped.
      A2: { like: 'A', lead: '. r2 - . r1 - . .' },
      // VI, the suspended VII and iv, settling on i.
      outro: {
        chords: 'VImaj9 | VII9sus | iv9 | i9', comp: 'pad', bass: 'slow', drums: 'shake shake . .', lead: '. . r5 .',
      },
    },
    form: 'intro A B A2 outro', // 2+8+8+8+4 = 30 bars, 90 s
  },
  'rain-on-the-sill': {
    title: 'Rain on the Sill', key: 'D minor', bpm: 72, lead: 'soft', leadTonic: 62, // degree 1 = D4
    feel: { swing: 0.62, humanise: 0.012, fill: 0.25, ghost: 0.2, vary: 0.35, answer: 0.4 },
    mix: { keys: 1, bass: 1, lead: 0.75, drums: 0.75 }, tone: 2200, space: 0.26,
    drums: {
      drizzle: { k: 'X.........x..x..', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      patter: { k: 'x...............', s: '........x.......', h: 'x..x..x.x..x..x.' },
    },
    comp: { pad: 'X---------------', warm: 'X---------x-----', rain: '..x---x-----x---' },
    bass: { lean: 'R-------R-----A-', step: 'R---5---R---3---' },
    motifs: {
      // The call: A F E D, then E F E and a low C.
      d1: '_:4 5:4 3:2 2:2 1:4 | 2:4 3:2 2:2 7,:8',
      // The response: A Bb A F, then G F and a long E.
      d2: '_:4 5:2 6:2 5:4 3:4 | 4:6 3:2 2:8',
      // B's call: D' C Bb and a held A, then F G A, C and A.
      d3: "_:2 1':2 7:2 6:2 5:8 | _:2 3:2 4:2 5:2 7:4 5:4",
      // B's answer, highest: F' E' F', then D' and C held, then a long A.
      d4: "_:2 3':2 2':2 3':2 1':4 7:4 | 5:12 _:4",
      // The last word: E F and D.
      d5: '_:4 2:2 3:2 1:8',
    },
    sections: {
      // i with its 11th to VI: grey light at the window.
      intro: { chords: 'i11 | VImaj9', comp: 'pad' },
      // i-iv-VI-v twice, the second time through III-VI and the half-diminished ii to v.
      A: {
        chords: 'i9 | iv9 | VImaj9 | v7 | i9 | iv9 | IIImaj9 VImaj9 | iiø7 v7',
        comp: 'warm', bass: 'lean', drums: 'drizzle', lead: '. . d1 - . . d2 -',
      },
      // The relative major's warmth: VI-VII-III-i, then iv-VII-VI to v.
      B: {
        chords: 'VImaj9 | VII9 | IIImaj9 | i9 | iv11 | VII9 | VImaj9 | v7',
        comp: 'rain', bass: 'step', drums: 'patter', lead: 'd3 - d4 - . . . .',
      },
      // A with the phrases swapped.
      A2: { like: 'A', lead: '. . d2 - . . d1 -' },
      // B again, the lead entering later and the beat filling in.
      B2: { like: 'B', drums: 'patter patter drizzle drizzle', lead: '. . d3 - . . d4 -' },
      // iv to i.
      outro: { chords: 'iv9 | i9', comp: 'pad', bass: 'lean', lead: '. d5' },
    },
    form: 'intro A B A2 B2 outro', // 2+8+8+8+8+2 = 36 bars, 120 s
  },
  'tea-break': {
    title: 'Tea Break', key: 'A minor', bpm: 76, lead: 'soft', leadTonic: 69, // degree 1 = A4
    feel: { swing: 0.58, humanise: 0.01, fill: 0.45, ghost: 0.15, vary: 0.4, answer: 0.35 },
    mix: { keys: 1, bass: 0.95, lead: 0.8, drums: 0.8 }, tone: 2300, space: 0.24,
    drums: {
      brew: { k: 'X.....xx..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      half: { k: 'x.......x.......', s: '............x...', h: 'x...x...x...x...' },
    },
    comp: { pad: 'X---------------', cup: 'X-----.-x-----.-', chop: 'x--x----..x-----' },
    bass: { brew: 'R-----5.R-----3-', sit: 'R-------R-------' },
    motifs: {
      // The call: A C E C, B A, then a low G and A.
      e1: '_:2 1:2 3:2 5:2 3:4 2:2 1:2 | 7,:4 1:4 _:8',
      // The response: E F E C B, a held C, then B A B.
      e2: '_:2 5:2 6:2 5:2 3:2 2:2 3:4 | 2:2 1:2 2:4 _:8',
      // B's one-bar call: E A' G E.
      e3: "_:4 5:2 1':2 7:4 5:4",
      // B's one-bar answer: F E and a long C.
      e4: '_:4 6:2 5:2 3:6 _:2',
      // The last word: C B G A.
      e5: '_:2 3:2 2:2 7,:2 1:8',
    },
    sections: {
      // iv to v: the kettle on.
      intro: { chords: 'iv9 | v7', comp: 'pad', bass: 'sit' },
      // The falling i-VII-VI-v, twice, the second time through iv.
      A: {
        chords: 'i9 | VII9 | VImaj9 | v7 | i9 | VII9 | iv9 | v7',
        comp: 'cup', bass: 'brew', drums: 'brew', lead: 'e1 - e2 - . . . .',
      },
      // The relative major: III-VII-VI to v.
      B: { chords: 'IIImaj9 | VII9 | VImaj9 | v7', comp: 'chop', bass: 'sit', drums: 'half', lead: 'e3 . e4 .' },
      // iv and i, then VI to v, the lead answering late.
      C: { chords: 'iv9 | i9 | VImaj9 | v7', comp: 'chop|cup', bass: 'brew', drums: 'half', lead: '. e4 . e3' },
      // A with the keys first and the lead after.
      A2: { like: 'A', lead: '. . . . e1 - e2 -' },
      // iv with its 11th to i.
      outro: { chords: 'iv11 | i9', comp: 'pad', bass: 'sit', lead: '. e5' },
    },
    form: 'intro A B C A2 outro', // 2+8+4+4+8+2 = 28 bars, about 88 s
  },
  'first-snow': {
    title: 'First Snow', key: 'C major', bpm: 68, lead: 'glock', leadTonic: 60, // degree 1 = C4, sounding C5
    feel: { swing: 0.56, humanise: 0.01, fill: 0.15, ghost: 0.05, vary: 0.3, answer: 0.5 },
    mix: { keys: 1, bass: 0.85, lead: 0.8, drums: 0.6 }, tone: 2400, space: 0.35,
    drums: {
      tick: { h: '....x.......x...' },
      half: { k: 'x.........x.....', s: '........x.......', h: 'x.......x.......' },
    },
    comp: { snow: 'X---------------', drift: 'x-------x-------' },
    bass: { hold: 'R---------------', low: 'R-------5-------' },
    motifs: {
      // The call: G and E, then A and a long G.
      f1: '_:4 5:4 3:4 _:4 | 6:4 5:8 _:4',
      // The response: high E' D', then a long C'.
      f2: "_:8 3':4 2':4 | 1':8 _:8",
      // B's call: A G and a long E, then D E and a long G.
      f3: '_:4 6:2 5:2 3:8 | _:4 2:2 3:2 5:8',
      // B's answer: C' B A, then a long G.
      f4: "_:8 1':2 7:2 6:4 | 5:12 _:4",
      // The last word: G, A G, and C.
      f5: '_:4 5:4 6:2 5:2 1:4',
    },
    sections: {
      // I with its sixth, then IV: the first flakes.
      intro: { chords: 'I6 | IVmaj7', comp: 'snow' },
      // I and iii, IV home to I, then vi-iii and ii to a suspended V.
      A: {
        chords: 'Imaj9 | iii7 | IVmaj9 | Imaj9 | vi9 | iii7 | ii9 | V9sus',
        comp: 'snow', bass: 'hold', drums: 'tick',
      },
      // A with the glock and the light beat.
      A2: { like: 'A', comp: 'drift', bass: 'low', drums: 'half tick', lead: '. . f1 - . . f2 -' },
      // From vi: IV-I to the suspended V, then vi with its 11th, iii, IV and V again.
      B: {
        chords: 'vi9 | IVmaj9 | Imaj9 | V9sus | vi11 | iii7 | IVmaj9 | V9sus',
        comp: 'drift|snow', bass: 'low', drums: 'half', lead: 'f3 - . . f4 - . .',
      },
      // IV to I with its sixth.
      outro: { chords: 'IVmaj9 | I6', comp: 'snow', bass: 'hold', drums: 'tick .', lead: '. f5' },
    },
    form: 'intro A A2 B outro', // 2+8+8+8+2 = 28 bars, about 99 s
  },
  kotatsu: {
    title: 'Kotatsu', key: 'A minor', bpm: 70, lead: 'glock', leadTonic: 57, // degree 1 = A3, sounding A4
    feel: { swing: 0.6, humanise: 0.01, fill: 0.2, ghost: 0.08, vary: 0.35, answer: 0.45 },
    mix: { keys: 1, bass: 0.95, lead: 0.75, drums: 0.65 }, tone: 2300, space: 0.32,
    drums: {
      tick: { h: 'x.....x.....x...' },
      half: { k: 'x......x........', s: '........x.......', h: '..x...x...x...x.' },
    },
    comp: { still: 'X---------------', warm: 'x-------..x-----', rock: 'x-----x---------' },
    bass: { hum: 'R-----------5---', sit: 'R-------R-------' },
    motifs: {
      // The call: E A' G, a long E, then F and a long E.
      k1: "_:4 5:2 1':2 7:4 5:4 | 6:4 5:8 _:4",
      // The response: C B A, a low G, then A B and a long C.
      k2: '_:4 3:2 2:2 1:4 7,:4 | 1:2 2:2 3:8 _:4',
      // B2's one-bar call: A' G E D.
      k3: "_:2 1':4 7:2 5:4 4:4",
      // B2's one-bar answer: C D and a long E.
      k4: '_:4 3:2 4:2 5:8',
      // The last word: E D, a held C and A.
      k5: '_:4 5:2 4:2 3:4 1:4',
    },
    sections: {
      // VI to i: the blanket over the knees.
      intro: { chords: 'VImaj7 | i9', comp: 'still' },
      // i-iv-VII-III, then VI-iv and v back to i.
      A: {
        chords: 'i9 | iv9 | VII9 | IIImaj9 | VImaj9 | iv9 | v7 | i9',
        comp: 'warm', bass: 'hum', drums: 'tick', lead: 'k1 - . . k2 - . .',
      },
      // VI to VII, then III and v: a short turn towards the relative major.
      B: { chords: 'VImaj9 | VII9 | IIImaj9 | v7', comp: 'rock|warm', bass: 'sit', drums: 'half' },
      // A with the light beat under it.
      A2: { like: 'A', drums: 'half tick' },
      // B with the glock's short calls.
      B2: { like: 'B', lead: 'k3 . k4 .' },
      // iv and VII to VI, settling on i.
      outro: { chords: 'iv9 | VII9 | VImaj9 | i9', comp: 'still', bass: 'hum', drums: 'tick . . .', lead: '. . . k5' },
    },
    form: 'intro A B A2 B2 outro', // 2+8+4+8+4+4 = 30 bars, about 103 s
  },
}

/** The title screen's track. */
export const TITLE_TRACK: TrackId = 'blank-page'

/** Each season's studio pool: two tracks. */
export const SEASON_TRACKS: Record<Season, readonly [TrackId, TrackId]> = {
  spring: ['slow-ink', 'sakura-margins'],
  summer: ['screentone', 'cold-ramune'],
  autumn: ['rain-on-the-sill', 'tea-break'],
  winter: ['first-snow', 'kotatsu'],
}

/** What the player reads tracks from: a scene's pool of ids, and a compiled track by id. */
export interface Catalog {
  /** The compiled track; throws for an id that is not a track. */
  compiled(id: string): CompiledTrack
  /** The ids a scene's music picks from. */
  poolFor(scene: MusicScene): readonly string[]
}

/**
 * The real tracks: the title track alone on the title screen, the season's two tracks in the studio. Compiling is
 * memoised by `compileTrack`.
 */
export const CATALOG: Catalog = {
  compiled(id) {
    if (!isTrackId(id)) throw new Error(`No track "${id}"`)
    return compileTrack(id, TRACKS[id])
  },
  poolFor(scene) {
    return scene.mood === 'title' ? [TITLE_TRACK] : SEASON_TRACKS[scene.season]
  },
}
