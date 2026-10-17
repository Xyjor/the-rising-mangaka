// The arranger (0.13.0), pure: one bar of a compiled track turned into timed `MusicEvent`s, with seeded variation so
// each pass of a track sounds a little different while its harmony stays fixed. Every choice rolls the dice of
// `arrangeParts.ts` (`u = mix(seed ^ hashString(id), pass, bar * 1024 + lane * 64 + step) / 2^32`, one lane per rule,
// the table at `LANE`), so a bar is the same for the same track, pass and seed. Times are seconds from the track's
// start; swing, humanise and strum only ever delay a note, by less than `MAX_LATE`, and nothing starts at or after the
// track's end. This file holds the drums and the public API; the keys, bass and lead live in `arrangeParts.ts`.
// `eventsInWindow` keeps a few bars' events so the player's per-tick calls are cheap. No Math.random, no clock, no Web
// Audio.
import {
  bassEvents, diceFor, emit, INST_ORDER, jitter, keysEvents, LANE, leadEvents, STRUM, strikeTime,
} from './arrangeParts'
import type { Dice } from './arrangeParts'
import { MAX_HUMANISE, MAX_SWING, MIN_BPM } from './score'
import type { CompiledTrack, DrumCell, DrumLane } from './score'
import type { MusicEvent } from './types'

export { leadPhrase } from './arrangeParts'
export type { LeadNote } from './arrangeParts'

/** The most notes a chord strums (a 3-note voicing and its added 9th). */
const MAX_CHORD = 4

/**
 * The most any note is delayed from its grid slot, in seconds, rounded up to the millisecond: the most swing at the
 * slowest tempo ((2 x 0.68 - 1) x 60 / 66 / 4 = 81.8 ms), the most humanise (30 ms) and a 4-note strum (36 ms).
 * Every event starts in [grid, grid + MAX_LATE).
 */
export const MAX_LATE =
  Math.ceil((((2 * MAX_SWING - 1) * 60) / MIN_BPM / 4 + MAX_HUMANISE + (MAX_CHORD - 1) * STRUM) * 1000) / 1000

type Drum = 'kick' | 'snare' | 'hat' | 'shaker'
const DRUM_OF: Record<DrumLane, Drum> = { k: 'kick', s: 'snare', h: 'hat', sh: 'shaker' }
const DRUM_BLOCK: Record<Drum, number> = { kick: 0, snare: 16, hat: 32, shaker: 48 }
/** Each drum's nominal length in seconds; an open hat rings for `OPEN_HAT`. */
const NOMINAL: Record<Drum, number> = { kick: 0.32, snare: 0.14, hat: 0.035, shaker: 0.05 }
const OPEN_HAT = 0.18
const CELL_VEL: Record<DrumCell, number> = { X: 1, x: 0.8, g: 0.25, '.': 0 }
const GHOST_VEL = 0.25
const FILLS = ['skip', 'roll', 'open'] as const
type Fill = (typeof FILLS)[number]

/** A hat's velocity by where it falls: 1 on the beat, 0.7 on an off-beat 8th, 0.45 on a 16th. */
const hatScale = (step: number): number => (step % 4 === 0 ? 1 : step % 2 === 0 ? 0.7 : 0.45)

/**
 * The bar's drums. Hats are scaled by position and, off the downbeat, dropped 8% of the time. Before a new section,
 * steps 12-15 drop out or fill, half and half; on a phrase's 4th bar they fill with chance `feel.fill`. A fill is a
 * skip (kick and snare out, snares on 13 and 15), a roll (snares on 12-15, rising, no hats) or an open hat on 14. A
 * kick lands on step 15 10% of the time; ghost snares (chance `feel.ghost`, velocity 0.25) go on odd steps with no
 * snare beside them. The track's last bar keeps step 0 only.
 */
function drumEvents(t: CompiledTrack, bar: number, dice: Dice, out: MusicEvent[]): void {
  const plan = t.plan[bar]
  if (!plan.drums) return
  const { lanes } = t.drums[plan.drums.name]
  const half = plan.drums.half * 16
  const hits: Record<Drum, number[]> = { kick: [], snare: [], hat: [], shaker: [] }
  for (const drum of Object.values(DRUM_OF)) hits[drum] = new Array<number>(16).fill(0)
  for (const [lane, cells] of Object.entries(lanes) as [DrumLane, readonly DrumCell[]][]) {
    for (let s = 0; s < 16; s++) hits[DRUM_OF[lane]][s] = CELL_VEL[cells[half + s]]
  }
  const { kick, snare, hat } = hits
  for (let s = 0; s < 16; s++) {
    if (hat[s] > 0) hat[s] = s !== 0 && dice(bar, LANE.hatDrop, s) < 0.08 ? 0 : hat[s] * hatScale(s)
  }
  const last = bar === t.bars - 1
  let drop = false
  let fill: Fill | null = null
  if (plan.sectionEnd && !last) {
    if (dice(bar, LANE.fill, 2) < 0.5) drop = true
    else fill = FILLS[Math.floor(dice(bar, LANE.fill, 3) * 3)]
  } else if (plan.phraseEnd && !last && dice(bar, LANE.fill, 0) < t.feel.fill) {
    fill = FILLS[Math.floor(dice(bar, LANE.fill, 1) * 3)]
  }
  let openStep = -1
  for (let s = 12; s < 16; s++) {
    if (drop) for (const drum of Object.values(DRUM_OF)) hits[drum][s] = 0
    if (fill === 'roll') {
      snare[s] = [0.45, 0.55, 0.7, 0.85][s - 12]
      hat[s] = 0
    } else if (fill === 'skip') {
      kick[s] = 0
      snare[s] = s === 13 || s === 15 ? 0.8 : 0
    } else if (fill === 'open') {
      hat[s] = s === 14 ? 0.7 : s === 15 ? 0 : hat[s]
      openStep = 14
    }
  }
  if (!drop && !last && kick[15] === 0 && dice(bar, LANE.kickAnticipation, 15) < 0.1) kick[15] = 0.8
  if (!last) {
    for (let s = 1; s < 16; s += 2) {
      const clear = snare[s] === 0 && snare[s - 1] === 0 && (s === 15 || snare[s + 1] === 0)
      if (clear && !(drop && s >= 12) && dice(bar, LANE.ghost, s) < t.feel.ghost) snare[s] = GHOST_VEL
    }
  }
  for (const drum of Object.values(DRUM_OF)) {
    const block = DRUM_BLOCK[drum]
    for (let s = 0; s < (last ? 1 : 16); s++) {
      const v = hits[drum][s]
      if (v <= 0) continue
      const open = drum === 'hat' && s === openStep
      const at = strikeTime(t, bar, s, dice(bar, LANE.humaniseDrums, block + s) * t.feel.humanise)
      const vel = v * jitter(dice(bar, LANE.velocityDrums, block + s))
      emit(out, t, { inst: drum, midi: 0, at, dur: open ? OPEN_HAT : NOMINAL[drum], vel, ...(open ? { open } : {}) })
    }
  }
}

/** Orders events by start, then by instrument, then by pitch. */
const byTime = (a: MusicEvent, b: MusicEvent): number =>
  a.at - b.at || INST_ORDER[a.inst] - INST_ORDER[b.inst] || a.midi - b.midi

/**
 * One bar's events for a pass under a seed, sorted by start (ties by a fixed instrument order). Deterministic: the
 * same track, bar, pass and seed give the same events; the harmony and voicings never depend on the pass.
 */
export function barEvents(t: CompiledTrack, bar: number, pass: number, seed: number): MusicEvent[] {
  const dice = diceFor(t, pass, seed)
  const out: MusicEvent[] = []
  drumEvents(t, bar, dice, out)
  bassEvents(t, bar, dice, out)
  keysEvents(t, bar, dice, out)
  leadEvents(t, bar, dice, out)
  return out.sort(byTime)
}

/** How many bars `eventsInWindow` keeps per track. */
const CACHE_BARS = 8
const cache = new WeakMap<CompiledTrack, Map<string, readonly MusicEvent[]>>()

function cachedBar(t: CompiledTrack, bar: number, pass: number, seed: number): readonly MusicEvent[] {
  let bars = cache.get(t)
  if (!bars) cache.set(t, (bars = new Map()))
  const key = `${pass}:${seed}:${bar}`
  let events = bars.get(key)
  if (events) bars.delete(key)
  else events = barEvents(t, bar, pass, seed)
  bars.set(key, events)
  if (bars.size > CACHE_BARS) bars.delete(bars.keys().next().value as string)
  return events
}

/**
 * The events starting in the half-open window [from, to) seconds of a pass, sorted as `barEvents` sorts them. Bars
 * are kept in a small cache, so the player can call this every tick. Callers must not mutate the events.
 */
export function eventsInWindow(t: CompiledTrack, pass: number, seed: number, from: number, to: number): MusicEvent[] {
  if (!(to > from)) return []
  const first = Math.max(0, Math.floor((from - MAX_LATE) / t.barSeconds))
  const last = Math.min(t.bars - 1, Math.floor(to / t.barSeconds))
  const out: MusicEvent[] = []
  for (let bar = first; bar <= last; bar++) {
    for (const e of cachedBar(t, bar, pass, seed)) if (e.at >= from && e.at < to) out.push(e)
  }
  return out.sort(byTime)
}
