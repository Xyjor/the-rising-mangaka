// Cue recipes: data only. Every tone sits on the C major pentatonic scale (C D E G A), every voice peaks at or
// below 0.3 gain, and every cue is over within a second (the drumroll within 2.4 s). The synth plays them.
import type { CueDef, CueId, Voice } from './types'

/** Equal-tempered frequency of a MIDI note (69 = A4 = 440 Hz). */
export function midiToHz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12)
}

const C4 = midiToHz(60), E4 = midiToHz(64), G4 = midiToHz(67), A4 = midiToHz(69)
const C5 = midiToHz(72), D5 = midiToHz(74), E5 = midiToHz(76), G5 = midiToHz(79), A5 = midiToHz(81)
const C6 = midiToHz(84), E6 = midiToHz(88), G6 = midiToHz(91), A6 = midiToHz(93), C7 = midiToHz(96)

// Voice shorthands. Squares are bright, so they sit lower in level than triangles and sines.
const tri = (freq: number, at: number, dur: number, gain = 0.18, extra?: Partial<Voice>): Voice =>
  ({ wave: 'triangle', freq, at, dur, gain, ...extra })
const sq = (freq: number, at: number, dur: number, gain = 0.07, extra?: Partial<Voice>): Voice =>
  ({ wave: 'square', freq, at, dur, gain, ...extra })
const sine = (freq: number, at: number, dur: number, gain = 0.12, extra?: Partial<Voice>): Voice =>
  ({ wave: 'sine', freq, at, dur, gain, ...extra })
const noise = (at: number, dur: number, gain: number, filter: NonNullable<Voice['filter']>, attack = 0.003): Voice =>
  ({ wave: 'noise', freq: 0, at, dur, gain, attack, filter })

/** 30 snare-like hits 70 ms apart, each a little louder than the last: about 2.1 s. */
const DRUMROLL: Voice[] = Array.from({ length: 30 }, (_, i) =>
  noise(i * 0.07, 0.05, 0.06 + i * 0.007, { type: 'bandpass', freq: 1800, q: 0.7 }))

export const CUES: Record<CueId, CueDef> = {
  // Interface
  click: { gapMs: 120, voices: [tri(E6, 0, 0.035, 0.14, { attack: 0.002 })] },
  pause: { gapMs: 120, voices: [tri(G5, 0, 0.06), tri(C5, 0.06, 0.1)] },
  resume: { gapMs: 120, voices: [tri(C5, 0, 0.06), tri(G5, 0.06, 0.1)] },
  page: {
    gapMs: 600,
    vary: [-1, 0, 1],
    voices: [noise(0, 0.045, 0.2, { type: 'bandpass', freq: 2600, q: 0.8 }, 0.004)],
  },
  send: {
    gapMs: 400,
    voices: [sq(G4, 0, 0.14, 0.06, { to: G5, filter: { type: 'lowpass', freq: 2400 } }), tri(C6, 0.12, 0.14, 0.14)],
  },
  start: { gapMs: 250, voices: [tri(C5, 0, 0.07), tri(G5, 0.07, 0.14)] },
  ready: { gapMs: 400, voices: [sq(C5, 0, 0.08), sq(E5, 0.08, 0.08), sq(G5, 0.16, 0.08), tri(C6, 0.24, 0.32, 0.2)] },
  submit: {
    gapMs: 400,
    voices: [noise(0, 0.06, 0.2, { type: 'lowpass', freq: 900 }), tri(G5, 0.05, 0.1), tri(C6, 0.13, 0.25)],
  },

  // Studio and travel
  hire: { gapMs: 300, voices: [tri(E5, 0, 0.1), tri(A5, 0.1, 0.2)] },
  depart: { gapMs: 300, voices: [tri(C5, 0, 0.22, 0.18, { to: G5 }), sine(C6, 0.18, 0.22)] },
  return: { gapMs: 300, voices: [tri(E5, 0, 0.1), tri(G4, 0.1, 0.1), tri(C5, 0.2, 0.3)] },

  // Chapter results
  chapter: { gapMs: 300, voices: [tri(C5, 0, 0.09), tri(E5, 0.09, 0.09), tri(G5, 0.18, 0.24)] },
  'chapter-top': {
    gapMs: 300,
    voices: [
      sq(C5, 0, 0.07), sq(E5, 0.07, 0.07), sq(G5, 0.14, 0.07), sq(C6, 0.21, 0.07),
      tri(E6, 0.28, 0.4), tri(C6, 0.28, 0.4, 0.14),
    ],
  },
  'chapter-weak': { gapMs: 300, voices: [tri(E5, 0, 0.12, 0.16), tri(D5, 0.12, 0.12, 0.16), tri(A4, 0.24, 0.32, 0.16)] },

  // Money and progress
  coins: { gapMs: 120, voices: [sq(G6, 0, 0.05, 0.06), sq(C7, 0.05, 0.2, 0.06)] },
  levelup: {
    gapMs: 800,
    voices: [
      sq(C5, 0, 0.06), sq(D5, 0.06, 0.06), sq(E5, 0.12, 0.06), sq(G5, 0.18, 0.06), sq(A5, 0.24, 0.06),
      tri(C6, 0.3, 0.4, 0.2),
    ],
  },
  milestone: {
    gapMs: 800,
    voices: [tri(C5, 0, 0.6, 0.14), tri(E5, 0.06, 0.56, 0.12), tri(G5, 0.12, 0.5, 0.12), sine(C6, 0.18, 0.5)],
  },

  // Warnings and news
  warn: {
    gapMs: 1500,
    voices: [
      sq(A4, 0, 0.12, 0.07, { filter: { type: 'lowpass', freq: 1400 } }),
      sq(E4, 0.16, 0.22, 0.07, { filter: { type: 'lowpass', freq: 1400 } }),
    ],
  },
  cancel: { gapMs: 1500, voices: [tri(G4, 0, 0.14), tri(E4, 0.14, 0.14), tri(C4, 0.28, 0.45, 0.2)] },
  offer: { gapMs: 1000, voices: [tri(G5, 0, 0.09), tri(C6, 0.09, 0.09), tri(E6, 0.18, 0.09), sine(G6, 0.27, 0.45)] },
  serialised: {
    gapMs: 1000,
    voices: [
      sq(C5, 0, 0.12, 0.06), sq(G5, 0, 0.12, 0.05), sq(E5, 0.14, 0.12, 0.06), sq(C6, 0.14, 0.12, 0.05),
      tri(G5, 0.28, 0.5, 0.16), tri(C6, 0.28, 0.5, 0.14), tri(E6, 0.28, 0.5, 0.1),
    ],
  },
  // A soft two-note bell: each note a sine with a quiet octave partial that fades first.
  event: {
    gapMs: 1000,
    voices: [
      sine(A5, 0, 0.45, 0.14, { attack: 0.004 }), sine(A6, 0, 0.2, 0.04, { attack: 0.004 }),
      sine(E5, 0.22, 0.6, 0.14, { attack: 0.004 }), sine(E6, 0.22, 0.25, 0.04, { attack: 0.004 }),
    ],
  },
  award: {
    gapMs: 1000,
    voices: [
      sq(G5, 0, 0.07), sq(G5, 0.09, 0.07), sq(G5, 0.18, 0.07), sq(C6, 0.27, 0.55),
      tri(C5, 0.27, 0.6), tri(E5, 0.27, 0.6, 0.14),
    ],
  },

  // The result reveal: played in quick succession, so none of them is held.
  drumroll: { gapMs: 0, voices: DRUMROLL },
  /** Pitched per bar with the `pitch` option. */
  bar: { gapMs: 0, voices: [tri(C5, 0, 0.07, 0.16, { attack: 0.003 })] },
  stamp: {
    gapMs: 0,
    voices: [noise(0, 0.09, 0.28, { type: 'lowpass', freq: 700 }, 0.002), sine(80, 0, 0.18, 0.3, { to: 40, attack: 0.002 })],
  },
  fanfare: {
    gapMs: 0,
    voices: [
      sq(G4, 0, 0.08), sq(C5, 0.09, 0.08), sq(E5, 0.18, 0.08), sq(G5, 0.27, 0.08), sq(C6, 0.36, 0.5),
      tri(C4, 0.36, 0.55, 0.2), tri(G4, 0.36, 0.55, 0.14),
    ],
  },
  'jingle-up': {
    gapMs: 0,
    voices: [tri(C5, 0, 0.1), tri(E5, 0.1, 0.1), tri(G5, 0.2, 0.1), tri(C6, 0.3, 0.45, 0.2), sine(E6, 0.3, 0.45, 0.08)],
  },
  'jingle-mid': { gapMs: 0, voices: [tri(E5, 0, 0.12), tri(D5, 0.12, 0.12), tri(G5, 0.24, 0.4)] },
  'jingle-down': {
    gapMs: 0,
    voices: [tri(G5, 0, 0.14), tri(E5, 0.14, 0.14), tri(D5, 0.28, 0.14), tri(C5, 0.42, 0.45, 0.16)],
  },
}
