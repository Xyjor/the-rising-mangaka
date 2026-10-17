// The arranger's pitched parts (0.13.0), pure: the keys, the bass and the lead for one bar of a compiled track, and
// the plumbing every part shares (the seeded dice, grid times, the event writer). `arrange.ts` adds the drums and
// the public API. A note lasts until the next strike of its part less a 10% gap, so each part scans forward through
// the bars after a strike to find it; the bass's register is worked out once per track, pass-independently, so a bar
// never needs the bars before it. Harmony and voicings come from the compiled plan and never read the pass; only the
// variations do. No Math.random, no clock, no Web Audio.
import { hashString, mix } from '../../sim'
import type { BarPlan, BassCell, ChordSlot, CompCell, CompiledTrack } from './score'
import { degreeToMidi, isAvoid, swingDelay } from './theory'
import type { Chord } from './theory'
import type { Inst, MusicEvent } from './types'

/**
 * The dice's lanes: each variation rule rolls on its own lane, so `u = mix(seed ^ hashString(id), pass, bar * 1024 +
 * lane * 64 + step) / 2^32`. A lane holds 64 slots; where a rule rolls for several instruments, each takes a block
 * of 16 (drums: kick 0, snare 16, hat 32, shaker 48; pitched: keys 0, bass 16, lead 32, answer run 48).
 */
export const LANE = {
  /** A drum hit's humanise delay, by instrument block and step. */
  humaniseDrums: 0,
  /** A pitched strike's humanise delay, by part block and step. */
  humanisePitched: 1,
  /** A drum hit's velocity scale (0.88-1), by instrument block and step. */
  velocityDrums: 2,
  /** A pitched strike's velocity scale (0.88-1), by part block and step. */
  velocityPitched: 3,
  /** A ghost snare on an odd step. */
  ghost: 4,
  /** A hat dropped off the downbeat. */
  hatDrop: 5,
  /** Slot 0 a phrase-end fill, 1 its kind; slot 2 a section end's drop or fill, 3 that fill's kind. */
  fill: 6,
  /** A kick on step 15. */
  kickAnticipation: 7,
  /** The comp's alternate, rolled on the pattern's first bar. */
  compAlt: 8,
  /** The added 9th, by the chord's slot index. */
  ninth: 9,
  /** Slot 0 an answer run, 1 its direction. */
  answer: 10,
  /** The bass's approach note on step 15. */
  bassApproach: 11,
  /** The bass's octave pop on step 14. */
  bassPop: 12,
  /** Rolled on the motif's first bar: slot 0 a change, 1 its kind, 2 which note, 3 which way. */
  leadVary: 13,
} as const

/** A roll in [0, 1) for a bar, a lane and a slot. */
export type Dice = (bar: number, lane: number, step: number) => number

/** The dice for one pass of a track under one seed. */
export function diceFor(t: CompiledTrack, pass: number, seed: number): Dice {
  const salt = (seed ^ hashString(t.id)) | 0
  return (bar, lane, step) => mix(salt, pass, bar * 1024 + lane * 64 + step) / 2 ** 32
}

/** The strum: each chord note, low to high, starts this much after the one below. */
export const STRUM = 0.012
/** A note's gap before the next strike of its part, as a share of the time between them. */
const GAP = 0.1
const KEYS_TOP = 74
const BASS_RANGE = [36, 55] as const
/** The note the bass's first root sits nearest. */
const BASS_START = 43
/** The lead folds into leadTonic + these, inclusive. */
const LEAD_RANGE = [-7, 19] as const
const CELL_VEL = { X: 1, x: 0.8 } as const
const SILENT_COMP: readonly CompCell[] = new Array<CompCell>(16).fill('.')

const pc = (n: number): number => ((n % 12) + 12) % 12
const sameNotes = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((n, i) => n === b[i])

/** A grid slot's time from the track start, before any delay. */
export const gridTime = (t: CompiledTrack, bar: number, step: number): number => bar * t.barSeconds + step * t.sixteenth

/** A strike's start: its grid slot, its swing delay, then `delay` (humanise, strum). */
export function strikeTime(t: CompiledTrack, bar: number, step: number, delay: number): number {
  return gridTime(t, bar, step) + swingDelay(step, t.feel.swing, t.sixteenth) + delay
}

/** The velocity scale a roll gives: 0.88-1. */
export const jitter = (u: number): number => 0.88 + 0.12 * u

/** Writes an event unless it starts at or after the track's end; its length is capped at the end. */
export function emit(out: MusicEvent[], t: CompiledTrack, e: MusicEvent): void {
  if (e.at >= t.seconds) return
  out.push({ ...e, dur: Math.min(e.dur, t.seconds - e.at) })
}

/** A note from `at` to the grid time `end` of the next strike or release of its part, less the gap. */
const lengthTo = (at: number, end: number): number => Math.max((1 - GAP) * (end - at), 0.005)

/** The slot sounding at a step: the last one starting at or before it. */
export function slotAt(plan: BarPlan, step: number): ChordSlot {
  let found = plan.slots[0]
  for (const s of plan.slots) if (s.step <= step) found = s
  return found
}

const isSlotStart = (plan: BarPlan, step: number): boolean => plan.slots.some((s) => s.step === step)
const lastSlot = (plan: BarPlan): ChordSlot => plan.slots[plan.slots.length - 1]
const isStrike = (c: string): boolean => c !== '-' && c !== '.'

// ---- Keys ----

interface KeysBar { cells: readonly CompCell[]; answer: boolean }

/**
 * A bar's comp as played: the pattern's half, or its alternate in 25% of bars (rolled on the pattern's first bar, so
 * both halves of a two-bar pattern agree), silence with no comp; and whether an answer run plays, which needs the lead
 * resting and no comp strike on steps 12-15.
 */
function keysBar(t: CompiledTrack, bar: number, dice: Dice): KeysBar {
  const plan = t.plan[bar]
  const ref = plan.comp
  let cells = SILENT_COMP
  if (ref) {
    const name = ref.alt !== null && dice(bar - ref.half, LANE.compAlt, 0) < 0.25 ? ref.alt : ref.name
    cells = t.comp[name].cells.slice(ref.half * 16, ref.half * 16 + 16)
  }
  const answer = plan.lead === null && !cells.slice(12).some(isStrike) && dice(bar, LANE.answer, 0) < t.feel.answer
  return { cells, answer }
}

/** Whether a chord still sounds at a bar's end: its last cell that is not a hold is a strike, and no run cut it. */
function keysHeldAtEnd(t: CompiledTrack, bar: number, dice: Dice): boolean {
  for (let b = bar; b >= 0; b--) {
    const kb = keysBar(t, b, dice)
    if (kb.answer) return false
    for (let s = 15; s >= 0; s--) {
      if (kb.cells[s] === '.') return false
      if (isStrike(kb.cells[s])) return true
    }
  }
  return false
}

/** The grid time a chord struck at (bar, step) with voicing `base` stops: a strike, a release, a run or a new chord. */
function keysEnd(t: CompiledTrack, bar: number, step: number, base: readonly number[], dice: Dice): number {
  for (let b = bar, s = step + 1; b < t.bars; b++, s = 0) {
    const kb = keysBar(t, b, dice)
    const plan = t.plan[b]
    for (; s < 16; s++) {
      if ((kb.answer && s === 12) || kb.cells[s] !== '-') return gridTime(t, b, s)
      if (isSlotStart(plan, s) && !sameNotes(slotAt(plan, s).voicing, base)) return gridTime(t, b, s)
    }
  }
  return t.seconds
}

/**
 * The 9th a chord may add, placed in the keys range: only where the chord has none and it is a whole step above the
 * root, at least 2 semitones from every voiced note and 3 above the lowest; the nearest above the top note, else the
 * highest below it; null when none fits. Voicings without a 9th have 3 notes, so a chord never passes 4.
 */
function ninthOf(t: CompiledTrack, slot: ChordSlot): number | null {
  const { chord, voicing } = slot
  if (chord.tones.length > 4) return null
  const p = t.key.scale[(t.key.scale.indexOf(chord.root) + 1) % 7]
  if (pc(p - chord.root) !== 2) return null
  const fits: number[] = []
  for (let n = voicing[0] + 3; n <= KEYS_TOP; n++) {
    if (pc(n) === p && voicing.every((v) => Math.abs(n - v) >= 2)) fits.push(n)
  }
  const top = voicing[voicing.length - 1]
  return fits.find((n) => n > top) ?? fits[fits.length - 1] ?? null
}

/** The bar's keys: comp strikes (strummed low to high), re-strikes at a chord change while held, and the answer run. */
export function keysEvents(t: CompiledTrack, bar: number, dice: Dice, out: MusicEvent[]): void {
  const plan = t.plan[bar]
  const kb = keysBar(t, bar, dice)
  const heldIn = bar > 0 && keysHeldAtEnd(t, bar - 1, dice)
  let held: readonly number[] | null = heldIn ? lastSlot(t.plan[bar - 1]).voicing : null
  const strike = (step: number, vel: number) => {
    const slot = slotAt(plan, step)
    const ninth = dice(bar, LANE.ninth, plan.slots.indexOf(slot)) < 0.3 ? ninthOf(t, slot) : null
    const notes = ninth === null ? [...slot.voicing] : [...slot.voicing, ninth].sort((a, b) => a - b)
    const delay = dice(bar, LANE.humanisePitched, step) * t.feel.humanise
    const v = vel * jitter(dice(bar, LANE.velocityPitched, step))
    const end = keysEnd(t, bar, step, slot.voicing, dice)
    notes.forEach((midi, i) => {
      const at = strikeTime(t, bar, step, delay + i * STRUM)
      emit(out, t, { inst: 'keys', midi, at, dur: lengthTo(at, end), vel: v })
    })
    held = slot.voicing
  }
  for (let s = 0; s < 16; s++) {
    if (kb.answer && s === 12) {
      answerRun(t, bar, kb.cells, dice, out)
      held = null
    }
    const c = kb.cells[s]
    if (c === 'X' || c === 'x') strike(s, CELL_VEL[c])
    else if (c === '.') held = null
    else if (held && isSlotStart(plan, s) && !sameNotes(slotAt(plan, s).voicing, held)) strike(s, CELL_VEL.x)
  }
}

/** Three of the chord's voiced notes, the highest placings at or under MIDI 74, on steps 12-14, up or down. */
function answerRun(t: CompiledTrack, bar: number, cells: readonly CompCell[], dice: Dice, out: MusicEvent[]): void {
  const voicing = slotAt(t.plan[bar], 12).voicing
  const high = [...new Set(voicing.map((n) => KEYS_TOP - pc(KEYS_TOP - n)))].sort((a, b) => a - b).slice(-3)
  if (dice(bar, LANE.answer, 1) >= 0.5) high.reverse()
  const last = cells[15] === '.' ? gridTime(t, bar, 15) : gridTime(t, bar + 1, 0)
  high.forEach((midi, i) => {
    const step = 12 + i
    const at = strikeTime(t, bar, step, dice(bar, LANE.humanisePitched, 48 + step) * t.feel.humanise)
    const end = i < high.length - 1 ? gridTime(t, bar, step + 1) : Math.min(last, t.seconds)
    const vel = 0.6 * jitter(dice(bar, LANE.velocityPitched, 48 + step))
    emit(out, t, { inst: 'keys', midi, at, dur: lengthTo(at, end), vel })
  })
}

// ---- Bass ----

type BassPlay = BassCell | 'P'
const SILENT_BASS: readonly BassPlay[] = new Array<BassPlay>(16).fill('.')
const BASS_VEL: Record<BassPlay | 'restrike', number> = {
  R: 0.9, 3: 0.85, 5: 0.85, O: 0.8, A: 0.75, P: 0.7, restrike: 0.8, '-': 0, '.': 0,
}

/** A pitch class's note in the bass range nearest `prev`, ties lower. */
function nearest(p: number, prev: number): number {
  let best = -1
  for (let n = BASS_RANGE[0]; n <= BASS_RANGE[1]; n++) {
    if (pc(n) === p && (best < 0 || Math.abs(n - prev) < Math.abs(best - prev))) best = n
  }
  return best
}

const foldBass = (n: number): number => (n < BASS_RANGE[0] ? n + 12 : n > BASS_RANGE[1] ? n - 12 : n)

/** A bass cell's note: the chord's root, 3rd, 5th, the root's octave, or a scale step toward the next chord's root. */
function bassPitch(t: CompiledTrack, plan: BarPlan, step: number, cell: BassPlay | 'restrike', prev: number): number {
  const chord = slotAt(plan, step).chord
  if (cell === '3') return nearest(chord.third, prev)
  if (cell === '5') return nearest(chord.tones[2], prev)
  if (cell === 'O' || cell === 'P') {
    const root = nearest(chord.root, prev)
    return root + 12 <= BASS_RANGE[1] ? root + 12 : root - 12
  }
  if (cell === 'A') {
    const next: Chord = plan.slots.find((s) => s.step > step)?.chord ?? plan.next
    const target = nearest(next.root, prev)
    const i = t.key.scale.indexOf(pc(target))
    if (prev <= target) return foldBass(target - pc(target - t.key.scale[(i + 6) % 7]))
    return foldBass(target + pc(t.key.scale[(i + 1) % 7] - target))
  }
  return nearest(chord.root, prev)
}

/** The base cells of a bar's bass pattern (silence with none), before any pass's additions. */
function bassBase(t: CompiledTrack, bar: number): readonly BassPlay[] {
  const ref = t.plan[bar].bass
  return ref ? t.bass[ref.name].cells.slice(ref.half * 16, ref.half * 16 + 16) : SILENT_BASS
}

/**
 * A bar's bass as played: the base cells, an octave pop on step 14 in 10% of bars and, before a change of root (never
 * in the last bar), an approach note on step 15 in 35%, each only on a hold or a rest and never beside a written `A`.
 */
function bassBar(t: CompiledTrack, bar: number, dice: Dice): readonly BassPlay[] {
  const base = bassBase(t, bar)
  if (base === SILENT_BASS) return base
  const cells = [...base]
  const open = (c: BassPlay) => c === '-' || c === '.'
  if (open(cells[14]) && dice(bar, LANE.bassPop, 14) < 0.1) cells[14] = 'P'
  const plan = t.plan[bar]
  const change = bar < t.bars - 1 && plan.next.root !== lastSlot(plan).chord.root
  if (change && open(cells[15]) && cells[14] !== 'A' && dice(bar, LANE.bassApproach, 15) < 0.35) cells[15] = 'A'
  return cells
}

/**
 * Walks a bar's bass cells from the previous note `prev` and the held chord's root `held`: each strike, and a
 * re-strike of the root where a held note meets a new root, is passed to `visit`. Returns the last note and hold.
 */
function walkBass(
  t: CompiledTrack, bar: number, cells: readonly BassPlay[], prev: number, held: number | null,
  visit?: (step: number, midi: number, vel: number) => void,
): { prev: number; held: number | null } {
  const plan = t.plan[bar]
  for (let s = 0; s < 16; s++) {
    const c = cells[s]
    if (c === '.') held = null
    if (c === '.' || (c === '-' && (held === null || !isSlotStart(plan, s) || slotAt(plan, s).chord.root === held))) {
      continue
    }
    const cell = c === '-' ? 'restrike' : c
    prev = bassPitch(t, plan, s, cell, prev)
    held = slotAt(plan, s).chord.root
    visit?.(s, prev, BASS_VEL[cell])
  }
  return { prev, held }
}

const registers = new WeakMap<CompiledTrack, readonly number[]>()

/**
 * The bass note before each bar, worked once per track from the base cells alone (no pass's additions), so every
 * note sits in the octave nearest the one before it and a bar's register never depends on the pass.
 */
function bassRegister(t: CompiledTrack): readonly number[] {
  let anchors = registers.get(t)
  if (!anchors) {
    const out: number[] = []
    let state: { prev: number; held: number | null } = { prev: BASS_START, held: null }
    for (let b = 0; b < t.bars; b++) {
      out.push(state.prev)
      state = walkBass(t, b, bassBase(t, b), state.prev, state.held)
    }
    registers.set(t, (anchors = out))
  }
  return anchors
}

function bassHeldAtEnd(t: CompiledTrack, bar: number, dice: Dice): boolean {
  for (let b = bar; b >= 0; b--) {
    const cells = bassBar(t, b, dice)
    for (let s = 15; s >= 0; s--) {
      if (cells[s] === '.') return false
      if (cells[s] !== '-') return true
    }
  }
  return false
}

/** The grid time a bass note struck at (bar, step) over root `root` stops: a strike, a rest or a new root. */
function bassEnd(t: CompiledTrack, bar: number, step: number, root: number, dice: Dice): number {
  for (let b = bar, s = step + 1; b < t.bars; b++, s = 0) {
    const cells = bassBar(t, b, dice)
    const plan = t.plan[b]
    for (; s < 16; s++) {
      if (cells[s] !== '-') return gridTime(t, b, s)
      if (isSlotStart(plan, s) && slotAt(plan, s).chord.root !== root) return gridTime(t, b, s)
    }
  }
  return t.seconds
}

/** The bar's bass notes. */
export function bassEvents(t: CompiledTrack, bar: number, dice: Dice, out: MusicEvent[]): void {
  const held = bar > 0 && bassHeldAtEnd(t, bar - 1, dice) ? lastSlot(t.plan[bar - 1]).chord.root : null
  const plan = t.plan[bar]
  walkBass(t, bar, bassBar(t, bar, dice), bassRegister(t)[bar], held, (step, midi, vel) => {
    const at = strikeTime(t, bar, step, dice(bar, LANE.humanisePitched, 16 + step) * t.feel.humanise)
    const end = bassEnd(t, bar, step, slotAt(plan, step).chord.root, dice)
    const v = vel * jitter(dice(bar, LANE.velocityPitched, 16 + step))
    emit(out, t, { inst: 'bass', midi, at, dur: lengthTo(at, end), vel: v })
  })
}

// ---- Lead ----

/** One note of a motif occurrence as played (`midi` null for a rest), its start and length in 16ths from its start. */
export interface LeadNote { readonly midi: number | null; readonly at: number; readonly len: number }

interface Draft { degree: number | null; octave: number; at: number; len: number }

/** Moves a degree one scale step, carrying the octave. */
function stepDegree(n: Draft, dir: 1 | -1): void {
  const d = (n.degree as number) - 1 + dir
  n.octave += Math.floor(d / 7)
  n.degree = (((d % 7) + 7) % 7) + 1
}

/** One change to a motif occurrence, picked by the dice: an inner note moved, the end resolved, a merge, an octave. */
function vary(t: CompiledTrack, notes: Draft[], start: number, dice: Dice): Draft[] {
  const kind = dice(start, LANE.leadVary, 1)
  const which = dice(start, LANE.leadVary, 2)
  const pitched = notes.flatMap((n, i) => (n.degree === null ? [] : [i]))
  if (kind < 0.4) {
    const inner = pitched.slice(1, -1)
    const dir = dice(start, LANE.leadVary, 3) < 0.5 ? -1 : 1
    if (inner.length) stepDegree(notes[inner[Math.floor(which * inner.length)]], dir)
  } else if (kind < 0.7) {
    const last = notes[pitched[pitched.length - 1]]
    const was = degreeToMidi(t.key, t.leadTonic, last.degree as number, last.octave)
    last.degree = which < 0.5 ? 1 : 3
    const octaves = [last.octave - 1, last.octave, last.octave + 1]
    const pitch = (o: number) => Math.abs(degreeToMidi(t.key, t.leadTonic, last.degree as number, o) - was)
    last.octave = octaves.reduce((a, o) => (pitch(o) < pitch(a) ? o : a))
  } else if (kind < 0.95) {
    const short = pitched.filter((i) => notes[i].len <= 2)
    if (short.length) {
      const i = short[Math.floor(which * short.length)]
      const into = i > 0 && (notes[i - 1].degree !== null || notes[i + 1] === undefined) ? i - 1 : i + 1
      if (into < i) notes[into].len += notes[i].len
      else notes[into] = { ...notes[into], at: notes[i].at, len: notes[into].len + notes[i].len }
      notes.splice(i, 1)
    }
  } else {
    for (const i of pitched) notes[i].octave += 1
  }
  return notes
}

/** The nearest chord tone to a note, ties lower. */
function snap(midi: number, chord: Chord): number {
  for (let d = 1; ; d++) {
    if (chord.tones.includes(pc(midi - d))) return midi - d
    if (chord.tones.includes(pc(midi + d))) return midi + d
  }
}

/**
 * The lead for the motif occurrence starting at bar `start` (its first bar; empty when no motif starts there): with
 * chance `feel.vary` one change, then each long note (4 or more 16ths) that is an avoid note over the chord at its
 * start snapped to the nearest chord tone, then every note folded into leadTonic-7..leadTonic+19. The occurrence keeps
 * its length.
 */
export function leadPhrase(t: CompiledTrack, start: number, pass: number, seed: number): readonly LeadNote[] {
  return phrase(t, start, diceFor(t, pass, seed))
}

function phrase(t: CompiledTrack, start: number, dice: Dice): readonly LeadNote[] {
  const ref = t.plan[start]?.lead
  if (!ref || ref.half !== 0) return []
  let notes: Draft[] = t.motifs[ref.name].notes.map((n) => ({ ...n }))
  if (dice(start, LANE.leadVary, 0) < t.feel.vary) notes = vary(t, notes, start, dice)
  const [lo, hi] = [t.leadTonic + LEAD_RANGE[0], t.leadTonic + LEAD_RANGE[1]]
  return notes.map(({ degree, octave, at, len }) => {
    if (degree === null) return { midi: null, at, len }
    let midi = degreeToMidi(t.key, t.leadTonic, degree, octave)
    const chord = slotAt(t.plan[Math.min(start + Math.floor(at / 16), t.bars - 1)], at % 16).chord
    if (len >= 4 && isAvoid(midi, chord)) midi = snap(midi, chord)
    while (midi > hi) midi -= 12
    while (midi < lo) midi += 12
    return { midi, at, len }
  })
}

/** The bar's lead notes: those of its motif occurrence that start in this bar. */
export function leadEvents(t: CompiledTrack, bar: number, dice: Dice, out: MusicEvent[]): void {
  const ref = t.plan[bar].lead
  if (!ref) return
  const start = bar - ref.half
  for (const n of phrase(t, start, dice)) {
    if (n.midi === null || Math.floor(n.at / 16) !== ref.half) continue
    const step = n.at % 16
    const at = strikeTime(t, bar, step, dice(bar, LANE.humanisePitched, 32 + step) * t.feel.humanise)
    const end = Math.min(gridTime(t, start, n.at + n.len), t.seconds)
    const vel = 0.85 * jitter(dice(bar, LANE.velocityPitched, 32 + step))
    emit(out, t, { inst: 'lead', midi: n.midi, at, dur: lengthTo(at, end), vel })
  }
}

/** The instruments' order for events that start together. */
export const INST_ORDER: Record<Inst, number> = { kick: 0, snare: 1, hat: 2, shaker: 3, bass: 4, keys: 5, lead: 6 }
