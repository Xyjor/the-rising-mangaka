// Music theory for the tracks (0.13.0), pure: keys, roman-numeral chords stacked in scale thirds, voicings, scale
// degrees, avoid notes and swing. Pitch classes run 0-11 with C = 0. The parser holds every chord to the design's
// rules (the numeral's case, `maj` exactly where the 7th is major, no flat 9th, 11ths on minor chords only, a perfect
// 4th under `sus`, the half-diminished `ø7` only where diatonic), so a track spelled wrongly fails to compile rather
// than clashing with the cues. No Math.random, no clock, no Web Audio.

/** The six keys whose scale holds the C major pentatonic: the C, F and G collections. */
export type KeyName = 'C major' | 'A minor' | 'F major' | 'D minor' | 'G major' | 'E minor'

/** A key: its tonic's pitch class, its mode, and its seven scale pitch classes from the tonic. */
export interface Key { name: KeyName; tonic: number; mode: 'major' | 'minor'; scale: readonly number[] }

/** A parsed chord: its pitch classes root first, then stacked thirds (the 4th in place of the 3rd for `sus`). */
export interface Chord {
  symbol: string
  root: number
  tones: readonly number[]
  /** The 3rd's pitch class, or the 4th's for a sus chord. */
  third: number
  /** The 7th's pitch class, the 6th's for a 6 chord, or null for a triad. */
  seventh: number | null
}

const TONICS: Record<KeyName, number> = {
  'C major': 0, 'A minor': 9, 'F major': 5, 'D minor': 2, 'G major': 7, 'E minor': 4,
}
const STEPS = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] } as const
const C_PENTATONIC = [0, 2, 4, 7, 9] as const
const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'] as const
const CHORD_RE = /^(i{1,3}|iv|vi{0,2}|I{1,3}|IV|VI{0,2})(ø7|maj9|maj7|11|9|7|6)?(sus)?$/

const pc = (n: number): number => ((n % 12) + 12) % 12

/** The key for a name. */
export function parseKey(name: KeyName): Key {
  const tonic = TONICS[name]
  const mode = name.endsWith('major') ? 'major' : 'minor'
  return { name, tonic, mode, scale: STEPS[mode].map((x) => pc(x + tonic)) }
}

/** Whether a scale holds every note of the C major pentatonic (C D E G A), so the cues never clash with it. */
export function containsCPentatonic(scale: readonly number[]): boolean {
  return C_PENTATONIC.every((n) => scale.includes(n))
}

/**
 * A roman numeral in the key's mode (major I-vii, minor i-VII) with an optional suffix: '' a triad, '6' an added 6th,
 * '7', 'maj7', '9', 'maj9', '11' (minor chords only), 'ø7' (half-diminished, only on the diminished degree), and 'sus'
 * after a 7th or 9th. Throws an Error naming the numeral and the key when any rule is broken.
 */
export function parseChord(numeral: string, key: Key): Chord {
  const fail = (why: string): never => {
    throw new Error(`Chord '${numeral}' in ${key.name}: ${why}`)
  }
  const m = CHORD_RE.exec(numeral)
  if (!m) return fail('not a roman numeral with a known suffix')
  const [, roman, suffix = '', sus] = m
  const d = NUMERALS.indexOf(roman.toLowerCase() as (typeof NUMERALS)[number])
  const at = (n: number): number => key.scale[(d + n) % 7]
  const root = at(0)
  const above = (n: number): number => pc(at(n) - root)
  const minor = above(2) === 3
  const diminished = above(4) === 6
  if (sus && !['7', 'maj7', '9', 'maj9'].includes(suffix)) fail("'sus' follows a 7th or a 9th only")
  if (diminished) {
    if (suffix !== 'ø7' || roman !== roman.toLowerCase()) fail("the diminished degree is written only as 'ø7', lowercase")
    return { symbol: numeral, root, tones: [root, at(2), at(4), at(6)], third: at(2), seventh: at(6) }
  }
  if (suffix === 'ø7') fail("'ø7' belongs on the diminished degree only")
  if (roman !== (minor ? roman.toLowerCase() : roman.toUpperCase())) {
    fail(`a ${minor ? 'minor' : 'major'} triad is written ${minor ? 'lowercase' : 'uppercase'}`)
  }
  const third = sus ? at(3) : at(2)
  if (sus && above(3) !== 5) fail("'sus' needs a perfect 4th above the root")
  if (suffix === '') return { symbol: numeral, root, tones: [root, third, at(4)], third, seventh: null }
  if (suffix === '6') return { symbol: numeral, root, tones: [root, third, at(4), at(5)], third, seventh: at(5) }
  const majorSeventh = above(6) === 11
  if (suffix.startsWith('maj') !== majorSeventh) {
    fail(majorSeventh ? "the 7th is major, so it needs 'maj'" : "the 7th is minor, so it takes no 'maj'")
  }
  const tones = [root, third, at(4), at(6)]
  if (suffix !== '7' && suffix !== 'maj7') {
    if (above(1) === 1) fail('the 9th would be flat')
    tones.push(at(1))
  }
  if (suffix === '11') {
    if (!minor) fail('an 11th sits over a minor 3rd only')
    tones.push(at(3))
  }
  return { symbol: numeral, root, tones, third, seventh: at(6) }
}

/**
 * The pitch classes a voicing plays: a chord of 4 or more tones goes rootless, keeping the 3rd and the 7th (or 6th)
 * and then the 9th, the 5th and the 11th, up to 4 notes; a triad keeps all three.
 */
function voicedTones(chord: Chord): number[] {
  if (chord.tones.length < 4) return [...chord.tones]
  const rest = chord.tones.slice(1)
  if (rest.length <= 4) return rest
  // root, 3rd, 5th, 7th, 9th, 11th: keep the 3rd and 7th, then the 9th, the 5th and the 11th.
  const [, third, fifth, seventh, ninth, eleventh] = chord.tones
  return [third, seventh, ninth, fifth, eleventh].slice(0, 4)
}

/** How far a candidate moves from the last voicing: note by note when the sizes match, else to each nearest note. */
function movement(cand: readonly number[], prev: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < cand.length; i++) {
    if (cand.length === prev.length) sum += Math.abs(cand[i] - prev[i])
    else sum += Math.min(...prev.map((p) => Math.abs(cand[i] - p)))
  }
  return sum
}

const sumOf = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0)

/**
 * A chord's voicing in MIDI notes, ascending, inside the inclusive `range`: every assignment of its voiced pitch
 * classes with each adjacent interval 3 semitones or more and a span of at most 14. The pick moves least from `prev`
 * (ties go lower); with no `prev`, its mean sits nearest MIDI 62. Throws when no voicing fits the range.
 */
export function voiceChord(chord: Chord, prev: readonly number[] | null, range: readonly [number, number]): number[] {
  const [lo, hi] = range
  const options = voicedTones(chord).map((t) => {
    const notes: number[] = []
    for (let n = lo; n <= hi; n++) if (pc(n) === t) notes.push(n)
    return notes
  })
  let best: number[] | null = null
  let bestScore = Infinity
  const consider = (picked: number[]) => {
    const v = [...picked].sort((a, b) => a - b)
    for (let i = 1; i < v.length; i++) if (v[i] - v[i - 1] < 3) return
    if (v[v.length - 1] - v[0] > 14) return
    const score = prev ? movement(v, prev) : Math.abs(sumOf(v) / v.length - 62)
    const lower = best !== null && (sumOf(v) < sumOf(best) || (sumOf(v) === sumOf(best) && v.join() < best.join()))
    if (score < bestScore || (score === bestScore && lower)) {
      best = v
      bestScore = score
    }
  }
  const walk = (i: number, picked: number[]) => {
    if (i === options.length) return consider(picked)
    for (const n of options[i]) walk(i + 1, [...picked, n])
  }
  walk(0, [])
  if (!best) throw new Error(`Chord '${chord.symbol}': no voicing fits MIDI ${lo}-${hi}`)
  return best
}

/** The MIDI note of scale degree 1-7, where `tonicMidi` is degree 1 at octave 0 and each octave adds 12. */
export function degreeToMidi(key: Key, tonicMidi: number, degree: number, octave: number): number {
  if (!Number.isInteger(degree) || degree < 1 || degree > 7) {
    throw new Error(`Degree ${degree} in ${key.name}: a scale degree runs 1-7`)
  }
  return tonicMidi + pc(key.scale[degree - 1] - key.tonic) + 12 * octave
}

/** Whether a note is an avoid note over the chord: not a chord tone, and a semitone above one. */
export function isAvoid(midi: number, chord: Chord): boolean {
  const p = pc(midi)
  return !chord.tones.includes(p) && chord.tones.some((t) => pc(t + 1) === p)
}

/** How late a 16th step plays: odd steps by (2 swing - 1) sixteenths (0.5 is straight), even steps never. */
export function swingDelay(step: number, swing: number, sixteenth: number): number {
  return step % 2 === 0 ? 0 : (2 * swing - 1) * sixteenth
}
