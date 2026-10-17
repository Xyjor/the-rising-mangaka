// The music's tracks (0.13.0), pure data and a small catalogue: each track written in the score format of `score.ts`
// (grids, motifs as scale degrees, sections of roman-numeral chords, a form), the title track, the two tracks of each
// season's studio pool, and `CATALOG`, the player's way in (a scene's pool, a compiled track by id). The nine ids are
// working titles, internal only and never shown in the UI. Only the title track and the spring track `slow-ink` are
// written so far; a season with none of its pair written plays `slow-ink` until the rest arrive. No Math.random, no
// clock, no Web Audio.
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

/**
 * The written tracks by id. Partial while the seasonal tracks are still being written; every id gets an entry once
 * they are all in.
 */
export const TRACKS: Partial<Record<TrackId, TrackSpec>> = {
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
      intro: { chords: 'IVmaj9 | Imaj9', comp: 'pad', drums: 'tick .' },
      A: {
        chords: 'IVmaj9 | iii7 vi7 | ii9 | V9sus | IVmaj9 | iii7 vi7 | ii9 V9 | Imaj9',
        comp: 'push', bass: 'walk', drums: 'main',
      },
      A2: { like: 'A', lead: 'm1 - . . m2 - m3 -' },
      B: { chords: 'vi9 | iii7 | IVmaj9 | V9sus', comp: 'lift', bass: 'two', drums: 'half', lead: '. . m3 -' },
      outro: { chords: 'IVmaj9 | Imaj9', comp: 'pad', bass: 'hold', drums: 'tick .' },
    },
    form: 'intro A A2 B A2 outro', // 2+8+8+4+8+2 = 32 bars, about 104 s
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

/** The studio's pool while none of a season's pair is written yet. */
const FALLBACK_POOL: readonly TrackId[] = ['slow-ink']

/** What the player reads tracks from: a scene's pool of ids, and a compiled track by id. */
export interface Catalog {
  /** The compiled track; throws for an id with no written track. */
  compiled(id: string): CompiledTrack
  /** The ids a scene's music picks from. */
  poolFor(scene: MusicScene): readonly string[]
}

/**
 * The real tracks: the title track alone on the title screen, the season's written tracks in the studio (`slow-ink`
 * while none of the pair is written). Compiling is memoised by `compileTrack`.
 */
export const CATALOG: Catalog = {
  compiled(id) {
    const spec = isTrackId(id) ? TRACKS[id] : undefined
    if (!spec) throw new Error(`No track "${id}"`)
    return compileTrack(id, spec)
  },
  poolFor(scene) {
    if (scene.mood === 'title') return [TITLE_TRACK]
    const pool = SEASON_TRACKS[scene.season].filter((id) => TRACKS[id] !== undefined)
    return pool.length ? pool : FALLBACK_POOL
  },
}
