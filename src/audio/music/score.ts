// The score compiler (0.13.0), pure: a track as hand-written data (`TrackSpec`: grids, motifs, sections of roman
// numeral chords, a form) checked and turned into a `CompiledTrack`, the bar-by-bar plan the arranger plays from.
// Every grid, motif, section list and chord is validated here, so a mistyped track fails to compile, never sounds
// wrong; every error names the track, the section (when there is one) and the field. Harmony is settled once: each
// bar's chords and their keys voicings, voice-led across the whole form. Compiling is memoised per spec object. No
// Math.random, no clock, no Web Audio.
import type { LeadVoice, Part } from './types'
import { parseChord, parseKey, voiceChord } from './theory'
import type { Chord, Key, KeyName } from './theory'

/** How a track plays: swing (0.5 straight to 0.68), and the chances (0-1) behind the arranger's variations. */
export interface Feel {
  readonly swing: number
  /** The most a note is delayed at random, in seconds (0-0.03). */
  readonly humanise: number
  /** The chance of a drum fill on a phrase's 4th bar. */
  readonly fill: number
  /** The chance of a ghost snare on an eligible step. */
  readonly ghost: number
  /** The chance a motif occurrence gets one change. */
  readonly vary: number
  /** The chance of a keys answer run in a bar where the lead rests. */
  readonly answer: number
}

/** The drum lanes: kick, snare, hat and shaker. */
export type DrumLane = 'k' | 's' | 'h' | 'sh'

/**
 * One section as written. `chords` is bars split by `|`, each holding 1, 2 or 4 numerals; the other fields are
 * space-separated per-bar lists of pattern names (`.` silence, `-` the second bar of a two-bar pattern), cycled when
 * shorter than the section. A comp entry may be `a|b`, `b` an alternate the arranger sometimes plays. `like` copies
 * another section's fields first; the section's own fields override them.
 */
export interface SectionSpec {
  like?: string
  chords?: string
  comp?: string
  bass?: string
  drums?: string
  lead?: string
}

/** A track as hand-written in `tracks.ts` (the design's "Track data format"). */
export interface TrackSpec {
  /** A working title, internal only. */
  title: string
  key: KeyName
  bpm: number
  lead: LeadVoice
  /** The MIDI note of scale degree 1 at the motifs' octave 0. */
  leadTonic: number
  feel: Feel
  mix: Record<Part, number>
  /** The lowpass cutoff in Hz; 2600 when left out. */
  tone?: number
  /** The reverb send; 0.22 when left out. */
  space?: number
  /** Drum patterns by name: a grid per lane of `X` accent, `x` normal, `g` ghost, `.` silence. */
  drums: Record<string, Partial<Record<DrumLane, string>>>
  /** Comp grids by name: `X`/`x` strike, `-` hold, `.` release. */
  comp: Record<string, string>
  /** Bass grids by name: `R` root, `3` third, `5` fifth, `O` octave, `A` approach, `-` hold, `.` rest. */
  bass: Record<string, string>
  /**
   * Lead motifs by name (`motifs`, apart from the lead voice's `lead` key): tokens `deg:len` (deg 1-7, then `'` up or `,` down an octave each), `_:len` a rest, `|` a bar line.
   */
  motifs: Record<string, string>
  sections: Record<string, SectionSpec>
  /** Section names in play order, space-separated. */
  form: string
}

export type DrumCell = 'X' | 'x' | 'g' | '.'
export type CompCell = 'X' | 'x' | '-' | '.'
export type BassCell = 'R' | '3' | '5' | 'O' | 'A' | '-' | '.'

/** A parsed drum pattern: every lane it names, each `bars * 16` cells long. */
export interface DrumPattern {
  readonly bars: 1 | 2
  readonly lanes: Readonly<Partial<Record<DrumLane, readonly DrumCell[]>>>
}

/** A parsed comp or bass grid, `bars * 16` cells long. */
export interface Grid<C extends string> { readonly bars: 1 | 2; readonly cells: readonly C[] }

/** One motif note, or a rest (`degree` null): its start and length in 16ths from the motif's start. */
export interface MotifNote {
  readonly degree: number | null
  readonly octave: number
  readonly at: number
  readonly len: number
}

/** A parsed motif: its notes and rests fill `bars * 16` sixteenths exactly. */
export interface Motif { readonly bars: 1 | 2; readonly notes: readonly MotifNote[] }

/** A bar's pattern: its name, and which bar of it plays (1 only for the second bar of a two-bar pattern). */
export interface PatternRef { readonly name: string; readonly half: 0 | 1 }

/** A bar's comp: the pattern, and the alternate the arranger may play instead (the same length), or null. */
export interface CompRef extends PatternRef { readonly alt: string | null }

/** One chord in a bar: the step (0-15) it starts on, and its keys voicing in MIDI notes, ascending. */
export interface ChordSlot { readonly step: number; readonly chord: Chord; readonly voicing: readonly number[] }

/** One bar of the form, everything the arranger needs that never depends on the pass. */
export interface BarPlan {
  readonly section: string
  /** The bar's index within its section. */
  readonly sectionBar: number
  readonly sectionStart: boolean
  readonly sectionEnd: boolean
  /** The 4th bar of a 4-bar phrase (`sectionBar % 4 === 3`), where fills go. */
  readonly phraseEnd: boolean
  /** 1, 2 or 4 chords starting on steps 0, 0/8 or 0/4/8/12. */
  readonly slots: readonly ChordSlot[]
  /** Each part's pattern for this bar, or null for silence. */
  readonly comp: CompRef | null
  readonly bass: PatternRef | null
  readonly drums: PatternRef | null
  readonly lead: PatternRef | null
  /** The first chord of the next bar (the form's first chord after its last bar), for the bass's approach notes. */
  readonly next: Chord
}

/** A compiled track: its settings, the per-bar plan and the parsed patterns, keyed by the names the plan uses. */
export interface CompiledTrack {
  readonly id: string
  readonly title: string
  readonly key: Key
  readonly bpm: number
  /** Seconds per 16th: 60 / bpm / 4. */
  readonly sixteenth: number
  /** Seconds per bar: 16 sixteenths. */
  readonly barSeconds: number
  readonly bars: number
  /** The whole form's length: bars * barSeconds. */
  readonly seconds: number
  readonly lead: LeadVoice
  readonly leadTonic: number
  readonly feel: Feel
  readonly mix: Readonly<Record<Part, number>>
  readonly tone: number
  readonly space: number
  /** One entry per bar of the form, in order. */
  readonly plan: readonly BarPlan[]
  readonly drums: Readonly<Record<string, DrumPattern>>
  readonly comp: Readonly<Record<string, Grid<CompCell>>>
  readonly bass: Readonly<Record<string, Grid<BassCell>>>
  readonly motifs: Readonly<Record<string, Motif>>
}

/** The slowest tempo a track may take; the arranger's `MAX_LATE` is worked out at it. */
export const MIN_BPM = 66
/** The most swing a track may take (0.5 is straight); the arranger's `MAX_LATE` counts it. */
export const MAX_SWING = 0.68
/** The most `feel.humanise` may delay a note, in seconds; the arranger's `MAX_LATE` counts it. */
export const MAX_HUMANISE = 0.03
/** The keys' voicing range, MIDI inclusive. */
const KEYS_RANGE = [50, 74] as const
const DEFAULT_TONE = 2600
const DEFAULT_SPACE = 0.22
const LANES: readonly DrumLane[] = ['k', 's', 'h', 'sh']
const DRUM_CELLS = 'Xxg.'
const COMP_CELLS = 'Xx-.'
const BASS_CELLS = 'R35OA-.'
const SLOT_STEPS: Record<number, readonly number[]> = { 1: [0], 2: [0, 8], 4: [0, 4, 8, 12] }
const MOTIF_NOTE = /^([1-7])('*|,*):([1-9]\d*)$/
const MOTIF_REST = /^_:([1-9]\d*)$/
const PART_FIELDS = ['comp', 'bass', 'drums', 'lead'] as const
type PartField = (typeof PART_FIELDS)[number]

/** Builds the error-throwing helper for one place in a track: `id: section S, field f: why`. */
function failer(id: string, where: string): (why: string) => never {
  return (why) => {
    throw new Error(`${id}: ${where}: ${why}`)
  }
}

const words = (s: string): string[] => s.trim().split(/\s+/).filter((w) => w !== '')

/** A grid's cells, each checked against the alphabet; an error gives the bad cell's position from 1. */
function parseGrid<C extends string>(text: string, alphabet: string, fail: (why: string) => never): C[] {
  if (text.length !== 16 && text.length !== 32) fail(`${text.length} cells; a grid is 16 or 32`)
  for (let i = 0; i < text.length; i++) {
    if (!alphabet.includes(text[i])) fail(`unknown character "${text[i]}" at ${i + 1}`)
  }
  return [...text] as C[]
}

function parseDrums(id: string, name: string, lanes: Partial<Record<DrumLane, string>>): DrumPattern {
  const where = `field drums, pattern ${name}`
  const fail = failer(id, where)
  const out: Partial<Record<DrumLane, readonly DrumCell[]>> = {}
  let length = 0
  for (const [lane, text] of Object.entries(lanes)) {
    if (!LANES.includes(lane as DrumLane)) fail(`unknown lane "${lane}"`)
    if (text === undefined) continue
    const cells = parseGrid<DrumCell>(text, DRUM_CELLS, failer(id, `${where}, lane ${lane}`))
    if (length && cells.length !== length) fail('every lane must be the same length')
    length = cells.length
    out[lane as DrumLane] = cells
  }
  if (!length) fail('no lanes')
  return { bars: length === 32 ? 2 : 1, lanes: out }
}

function parseLine<C extends string>(id: string, field: string, name: string, text: string, alphabet: string): Grid<C> {
  const cells = parseGrid<C>(text, alphabet, failer(id, `field ${field}, pattern ${name}`))
  return { bars: cells.length === 32 ? 2 : 1, cells }
}

function parseMotif(id: string, name: string, text: string): Motif {
  const fail = failer(id, `field motifs, pattern ${name}`)
  const notes: MotifNote[] = []
  let at = 0
  for (const token of words(text)) {
    if (token === '|') {
      if (at === 0 || at % 16 !== 0) fail(`"|" at ${at} 16ths is not on a bar line`)
      continue
    }
    const note = MOTIF_NOTE.exec(token)
    const rest = MOTIF_REST.exec(token)
    if (note) {
      const [, degree, marks, len] = note
      const octave = marks === '' ? 0 : marks.startsWith("'") ? marks.length : -marks.length
      notes.push({ degree: Number(degree), octave, at, len: Number(len) })
    } else if (rest) {
      notes.push({ degree: null, octave: 0, at, len: Number(rest[1]) })
    } else {
      fail(`bad token "${token}"`)
    }
    at += notes[notes.length - 1].len
  }
  if (at !== 16 && at !== 32) fail(`${at} 16ths; a motif fills 1 or 2 whole bars`)
  return { bars: at === 32 ? 2 : 1, notes }
}

function checkRange(fail: (why: string) => never, value: number, lo: number, hi: number): void {
  if (!(value >= lo && value <= hi)) fail(`${value} is outside ${lo}-${hi}`)
}

/** The section with every `like` resolved: the parent's fields (recursively), then its own. */
function resolveSection(id: string, sections: TrackSpec['sections'], name: string, seen: string[] = []): SectionSpec {
  const own = sections[name]
  if (!own.like) return own
  const fail = failer(id, `section ${seen[0] ?? name}, field like`)
  if (seen.includes(own.like) || own.like === name) fail('circular like')
  if (!Object.hasOwn(sections, own.like)) fail(`unknown section "${own.like}"`)
  const parent = resolveSection(id, sections, own.like, [...seen, name])
  const { like: _like, ...fields } = own
  return { ...parent, ...fields }
}

/** One section field's per-bar refs over `bars` bars: names checked, `-` checked, the list cycled. */
function resolveRefs(
  fail: (why: string) => never,
  list: string | undefined,
  bars: number,
  lengthOf: (name: string) => 1 | 2 | undefined,
  comp: boolean,
): (CompRef | null)[] {
  if (list === undefined) return new Array<CompRef | null>(bars).fill(null)
  const entries = words(list)
  if (!entries.length) fail('the list is empty; leave the field out for silence')
  if (entries.length > bars) fail(`${entries.length} bars listed; the section has ${bars}`)
  const refs: (CompRef | null)[] = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const before = refs[i - 1]
    if (entry === '-') {
      if (!before || before.half !== 0 || lengthOf(before.name) !== 2) fail('"-" must follow a two-bar pattern')
      refs.push({ ...before, half: 1 })
      continue
    }
    if (before && before.half === 0 && lengthOf(before.name) === 2) {
      fail(`the two-bar pattern "${before.name}" needs "-" after it`)
    }
    if (entry === '.') {
      refs.push(null)
      continue
    }
    const [name, alt, ...extra] = comp ? entry.split('|') : [entry]
    if (extra.length) fail(`"${entry}" names more than one alternate`)
    const length = lengthOf(name)
    if (length === undefined) fail(`unknown pattern "${name}"`)
    if (alt !== undefined) {
      const altLength = lengthOf(alt)
      if (altLength === undefined) fail(`unknown pattern "${alt}"`)
      if (altLength !== length) fail(`the alternate "${alt}" must be as long as "${name}"`)
    }
    refs.push({ name, half: 0, alt: alt ?? null })
  }
  const last = refs[refs.length - 1]
  if (last && last.half === 0 && lengthOf(last.name) === 2) {
    fail(`the two-bar pattern "${last.name}" needs "-" after it`)
  }
  const out = Array.from({ length: bars }, (_, i) => refs[i % refs.length])
  const end = out[bars - 1]
  if (end && end.half === 0 && lengthOf(end.name) === 2) {
    fail(`the section ends inside the two-bar pattern "${end.name}"`)
  }
  return out
}

/** A section's chords: per bar, the chords with their start steps. */
function parseChords(
  fail: (why: string) => never,
  text: string | undefined,
  key: Key,
): { step: number; chord: Chord }[][] {
  if (text === undefined || text.trim() === '') fail('no chords')
  return (text as string).split('|').map((bar, i) => {
    const numerals = words(bar)
    const steps = SLOT_STEPS[numerals.length]
    if (!steps) fail(`bar ${i + 1} holds ${numerals.length} chords; a bar holds 1, 2 or 4`)
    return numerals.map((n, j) => {
      try {
        return { step: steps[j], chord: parseChord(n, key) }
      } catch (e) {
        return fail(e instanceof Error ? e.message : String(e))
      }
    })
  })
}

function compile(id: string, spec: TrackSpec): CompiledTrack {
  const field = (f: string) => failer(id, `field ${f}`)
  const key = parseKey(spec.key)
  if (!(spec.bpm >= MIN_BPM)) field('bpm')(`${spec.bpm} is below ${MIN_BPM} BPM, the slowest tempo MAX_LATE allows`)
  if (((spec.leadTonic % 12) + 12) % 12 !== key.tonic) {
    field('leadTonic')(`MIDI ${spec.leadTonic} is not the tonic of ${spec.key}`)
  }
  checkRange(field('feel.swing'), spec.feel.swing, 0.5, MAX_SWING)
  checkRange(field('feel.humanise'), spec.feel.humanise, 0, MAX_HUMANISE)
  for (const k of ['fill', 'ghost', 'vary', 'answer'] as const) {
    checkRange(field(`feel.${k}`), spec.feel[k], 0, 1)
  }

  const drums: Record<string, DrumPattern> = {}
  for (const [name, lanes] of Object.entries(spec.drums)) drums[name] = parseDrums(id, name, lanes)
  const comp: Record<string, Grid<CompCell>> = {}
  for (const [name, text] of Object.entries(spec.comp)) comp[name] = parseLine(id, 'comp', name, text, COMP_CELLS)
  const bass: Record<string, Grid<BassCell>> = {}
  for (const [name, text] of Object.entries(spec.bass)) bass[name] = parseLine(id, 'bass', name, text, BASS_CELLS)
  const motifs: Record<string, Motif> = {}
  for (const [name, text] of Object.entries(spec.motifs)) motifs[name] = parseMotif(id, name, text)
  const tables: Record<PartField, Readonly<Record<string, { bars: 1 | 2 }>>> = { comp, bass, drums, lead: motifs }

  const form = words(spec.form)
  if (!form.length) field('form')('the form names no section')
  const plan: Omit<BarPlan, 'next'>[] = []
  let prev: readonly number[] | null = null
  for (const name of form) {
    if (!Object.hasOwn(spec.sections, name)) field('form')(`unknown section "${name}"`)
    const section = resolveSection(id, spec.sections, name)
    const at = (f: string) => failer(id, `section ${name}, field ${f}`)
    const chordBars = parseChords(at('chords'), section.chords, key)
    const n = chordBars.length
    const refs = {} as Record<PartField, (CompRef | null)[]>
    for (const f of PART_FIELDS) {
      const table = tables[f]
      const lengthOf = (p: string) => (Object.hasOwn(table, p) ? table[p].bars : undefined)
      refs[f] = resolveRefs(at(f), section[f], n, lengthOf, f === 'comp')
    }
    const plain = (r: CompRef | null): PatternRef | null => (r ? { name: r.name, half: r.half } : null)
    chordBars.forEach((bar, i) => {
      const slots = bar.map(({ step, chord }) => {
        const voicing: readonly number[] = voiceChord(chord, prev, KEYS_RANGE)
        prev = voicing
        return { step, chord, voicing }
      })
      plan.push({
        section: name, sectionBar: i, sectionStart: i === 0, sectionEnd: i === n - 1, phraseEnd: i % 4 === 3, slots,
        comp: refs.comp[i], bass: plain(refs.bass[i]), drums: plain(refs.drums[i]), lead: plain(refs.lead[i]),
      })
    })
  }

  const sixteenth = 60 / spec.bpm / 4
  const barSeconds = 16 * sixteenth
  return {
    id, title: spec.title, key, bpm: spec.bpm, sixteenth, barSeconds, bars: plan.length,
    seconds: plan.length * barSeconds, lead: spec.lead, leadTonic: spec.leadTonic, feel: spec.feel, mix: spec.mix,
    tone: spec.tone ?? DEFAULT_TONE, space: spec.space ?? DEFAULT_SPACE,
    plan: plan.map((b, i) => ({ ...b, next: plan[(i + 1) % plan.length].slots[0].chord })),
    drums, comp, bass, motifs,
  }
}

const memo = new WeakMap<TrackSpec, Map<string, CompiledTrack>>()

/**
 * Compiles a track, memoised per spec object (and id): the same spec gives the same object every time. Throws an
 * Error naming the track, the section (when there is one) and the field for any grid, motif, list, chord or setting
 * that breaks the format.
 */
export function compileTrack(id: string, spec: TrackSpec): CompiledTrack {
  let byId = memo.get(spec)
  if (!byId) memo.set(spec, (byId = new Map()))
  let compiled = byId.get(id)
  if (!compiled) byId.set(id, (compiled = compile(id, spec)))
  return compiled
}
