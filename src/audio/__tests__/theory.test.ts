import { describe, expect, it } from 'vitest'
import {
  containsCPentatonic, degreeToMidi, isAvoid, parseChord, parseKey, swingDelay, voiceChord,
} from '../music/theory'
import type { Chord, KeyName } from '../music/theory'

const KEYS: readonly KeyName[] = ['C major', 'A minor', 'F major', 'D minor', 'G major', 'E minor']
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii']
const SUFFIXES = ['', '6', '7', 'maj7', '9', 'maj9', '11', 'ø7', '7sus', '9sus', 'maj7sus', 'maj9sus']

/** Every numeral and suffix the grammar can spell, in both cases, that the key accepts. */
function acceptedChords(name: KeyName): Chord[] {
  const key = parseKey(name)
  const out: Chord[] = []
  for (const n of NUMERALS) {
    for (const c of [n, n.toUpperCase()]) {
      for (const s of SUFFIXES) {
        try {
          out.push(parseChord(c + s, key))
        } catch {
          // rejected: not part of this sweep
        }
      }
    }
  }
  return out
}

describe('keys', () => {
  it('contains the C pentatonic exactly in the six key names', () => {
    const hits: string[] = []
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const [mode, steps] of [['major', MAJOR], ['minor', MINOR]] as const) {
        if (containsCPentatonic(steps.map((x) => (x + tonic) % 12))) hits.push(`${tonic} ${mode}`)
      }
    }
    // C, F, G major; A, D, E minor.
    expect(hits.sort()).toEqual(['0 major', '2 minor', '4 minor', '5 major', '7 major', '9 minor'])
  })

  it('spells each key name as its tonic and mode', () => {
    expect(parseKey('F major')).toEqual({ name: 'F major', tonic: 5, mode: 'major', scale: [5, 7, 9, 10, 0, 2, 4] })
    expect(parseKey('E minor')).toEqual({ name: 'E minor', tonic: 4, mode: 'minor', scale: [4, 6, 7, 9, 11, 0, 2] })
    for (const k of KEYS) expect(containsCPentatonic(parseKey(k).scale)).toBe(true)
  })
})

describe('parseChord', () => {
  const C = parseKey('C major')

  it('stacks ii9 in F major as G B-flat D F A', () => {
    const c = parseChord('ii9', parseKey('F major'))
    expect(c.tones).toEqual([7, 10, 2, 5, 9])
    expect(c.root).toBe(7)
    expect(c.third).toBe(10)
    expect(c.seventh).toBe(5)
  })

  it('takes the 4th for a sus chord and the 6th as the seventh slot of a 6 chord', () => {
    expect(parseChord('V9sus', C)).toMatchObject({ tones: [7, 0, 2, 5, 9], third: 0, seventh: 5 })
    expect(parseChord('I6', C)).toMatchObject({ tones: [0, 4, 7, 9], third: 4, seventh: 9 })
    expect(parseChord('vi', C)).toMatchObject({ tones: [9, 0, 4], third: 0, seventh: null })
    expect(parseChord('ii11', C).tones).toEqual([2, 5, 9, 0, 4, 7])
    expect(parseChord('viiø7', C).tones).toEqual([11, 2, 5, 9])
    expect(parseChord('iiø7', parseKey('A minor')).tones).toEqual([11, 2, 5, 9])
  })

  it('requires maj exactly where the diatonic 7th is major', () => {
    expect(parseChord('Imaj7', C).seventh).toBe(11)
    expect(() => parseChord('I7', C)).toThrow(/I7.*C major/)
    expect(() => parseChord('Vmaj7', C)).toThrow(/Vmaj7.*C major/)
    expect(parseChord('V7', C).seventh).toBe(5)
  })

  it('requires the numeral case to match the triad', () => {
    expect(parseChord('ii', C).tones).toEqual([2, 5, 9])
    expect(() => parseChord('II', C)).toThrow(/II.*C major/)
    expect(() => parseChord('iv', C)).toThrow(/iv.*C major/)
  })

  it('rejects a flat 9th, an 11th over a major third, a sus without a perfect 4th and a bare diminished triad', () => {
    expect(() => parseChord('iii9', C)).toThrow(/iii9.*C major/)
    expect(() => parseChord('I11', C)).toThrow(/I11.*C major/)
    expect(parseChord('Imaj9sus', C).third).toBe(5)
    expect(() => parseChord('IVmaj9sus', C)).toThrow(/IVmaj9sus.*C major/)
    expect(() => parseChord('vii', C)).toThrow(/vii.*C major/)
    expect(() => parseChord('iiø7', C)).toThrow(/iiø7.*C major/)
    expect(() => parseChord('I13', C)).toThrow(/I13.*C major/)
  })

  it('rejects a 6 chord whose diatonic 6th is not a major sixth', () => {
    // A to F and E to C are minor sixths (8 semitones); D to B and A minor's D to B are major sixths (9).
    expect(() => parseChord('vi6', C)).toThrow(/vi6.*C major/)
    expect(() => parseChord('iii6', C)).toThrow(/iii6.*C major/)
    expect(() => parseChord('i6', parseKey('A minor'))).toThrow(/i6.*A minor/)
    expect(parseChord('ii6', C).tones).toEqual([2, 5, 9, 11])
    expect(parseChord('iv6', parseKey('A minor')).tones).toEqual([2, 5, 9, 11])
  })

  it('keeps every accepted chord inside its key', () => {
    for (const name of KEYS) {
      const scale = parseKey(name).scale
      const chords = acceptedChords(name)
      expect(chords.length).toBeGreaterThan(20)
      for (const c of chords) for (const t of c.tones) expect(scale, `${c.symbol} in ${name}`).toContain(t)
    }
  })
})

describe('voiceChord', () => {
  const C = parseKey('C major')
  const RANGE = [50, 74] as const

  it('starts nearest MIDI 62, rootless for a seventh chord', () => {
    // ii7 rootless is F A C; the candidates' means are 56.7, 60.7, 64.7 and 68.7.
    expect(voiceChord(parseChord('ii7', C), null, RANGE)).toEqual([57, 60, 65])
  })

  it('moves as little as possible from the last voicing', () => {
    // V7 rootless is B D F: 59 62 65 moves 4 semitones in all; the next best, 53 59 62, moves 8.
    expect(voiceChord(parseChord('V7', C), [57, 60, 65], RANGE)).toEqual([59, 62, 65])
  })

  it('breaks a tie in movement by going lower', () => {
    // From 62 65 70, both 60 64 67 and 64 67 72 move 6 semitones.
    expect(voiceChord(parseChord('I', C), [62, 65, 70], RANGE)).toEqual([60, 64, 67])
  })

  it('keeps the 3rd, the 7th, the 9th and the 11th of an 11th chord, dropping the 5th', () => {
    // ii11 is D F A C E G: the 3rd F, the 7th C, the 9th E and the 11th G sound; the root D and the 5th A do not.
    const v = voiceChord(parseChord('ii11', C), null, RANGE)
    expect(v.map((m) => m % 12).sort((a, b) => a - b)).toEqual([0, 4, 5, 7])
  })

  it('stays in range, rootless with the 3rd and 7th from 4 tones, the lowest interval 3 or more, deterministic', () => {
    for (const name of KEYS) {
      let prev: number[] | null = null
      for (const c of acceptedChords(name)) {
        const v = voiceChord(c, prev, RANGE)
        expect(voiceChord(c, prev, RANGE)).toEqual(v)
        const pcs = v.map((m) => m % 12)
        for (const m of v) {
          expect(m).toBeGreaterThanOrEqual(50)
          expect(m).toBeLessThanOrEqual(74)
        }
        for (let i = 1; i < v.length; i++) expect(v[i] - v[i - 1]).toBeGreaterThanOrEqual(3)
        expect(v[v.length - 1] - v[0]).toBeLessThanOrEqual(14)
        if (c.tones.length >= 4) {
          expect(pcs, `${c.symbol} in ${name}`).not.toContain(c.root)
          expect(pcs).toContain(c.third)
          expect(pcs).toContain(c.seventh)
        } else {
          expect([...pcs].sort((a, b) => a - b)).toEqual([...c.tones].sort((a, b) => a - b))
        }
        prev = v
      }
    }
  })
})

describe('helpers', () => {
  it('places a scale degree by octave from the tonic', () => {
    const F = parseKey('F major')
    expect(degreeToMidi(F, 65, 1, 0)).toBe(65)
    expect(degreeToMidi(F, 65, 4, 0)).toBe(70)
    expect(degreeToMidi(F, 65, 5, 1)).toBe(84)
    expect(degreeToMidi(parseKey('A minor'), 57, 3, -1)).toBe(48)
    expect(() => degreeToMidi(F, 65, 8, 0)).toThrow()
  })

  it('marks a non-chord tone a semitone above a chord tone as an avoid note', () => {
    const I = parseChord('I', parseKey('C major'))
    expect(isAvoid(65, I)).toBe(true) // F over the chord's E
    expect(isAvoid(64, I)).toBe(false) // E, a chord tone
    expect(isAvoid(62, I)).toBe(false) // D, a whole step above C
  })

  it('delays odd 16ths by (2 swing - 1) sixteenths and never even ones', () => {
    expect(swingDelay(0, 0.6, 0.2)).toBe(0)
    expect(swingDelay(2, 0.68, 0.2)).toBe(0)
    expect(swingDelay(1, 0.6, 0.2)).toBeCloseTo(0.04, 10)
    expect(swingDelay(15, 0.68, 0.25)).toBeCloseTo(0.09, 10)
    expect(swingDelay(3, 0.5, 0.2)).toBe(0)
  })
})
