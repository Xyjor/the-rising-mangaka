import { describe, expect, it } from 'vitest'
import { compileTrack } from '../music/score'
import type { TrackSpec } from '../music/score'
import { parseKey, voiceChord } from '../music/theory'

/**
 * The design's example track (docs/plans/2026-10-17-lofi-music-design.md, "Track data format"), copied verbatim but
 * for one key: the motif table is `motifs`, since a second `lead` beside the lead voice is a duplicate key.
 */
const SLOW_INK: TrackSpec = {
  title: 'Slow Ink', key: 'F major', bpm: 74, lead: 'soft', leadTonic: 65,
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
  form: 'intro A A2 B A2 outro',
}

/** A small C major track: one section of four bars, each part one pattern, no tone or space given. */
function tiny(over: Partial<TrackSpec> = {}): TrackSpec {
  return {
    title: 'Tiny', key: 'C major', bpm: 60, lead: 'bell', leadTonic: 72,
    feel: { swing: 0.5, humanise: 0, fill: 0, ghost: 0, vary: 0, answer: 0 },
    mix: { keys: 1, bass: 1, lead: 1, drums: 1 },
    drums: { a: { k: 'X...............' }, b: { h: 'x.x.x.x.x.x.x.x.' } },
    comp: { a: 'X---------------', b: 'x-------x-------', long: 'X-------------------------------' },
    bass: { a: 'R---------------' },
    motifs: { one: '1:16', two: "1:8 3:8 | 5':16" },
    sections: { S: { chords: 'I | IV | V | I', comp: 'a', bass: 'a', drums: 'a', lead: 'one' } },
    form: 'S',
    ...over,
  }
}

/** The tiny track with section S's fields replaced. */
const withS = (s: TrackSpec['sections'][string], over: Partial<TrackSpec> = {}): TrackSpec =>
  tiny({ sections: { S: { chords: 'I | IV | V | I', ...s } }, ...over })

describe('compileTrack: timing and form', () => {
  it('counts the example\'s 32 bars, about 103.8 s at 74 BPM', () => {
    const t = compileTrack('slow-ink', SLOW_INK)
    expect(t.bars).toBe(32)
    expect(t.plan).toHaveLength(32)
    // One 16th at 74 BPM is 60 / 74 / 4 = 0.2027 s; a bar 3.2432 s; 32 bars 103.78 s.
    expect(t.sixteenth).toBeCloseTo(0.202703, 5)
    expect(t.barSeconds).toBeCloseTo(3.243243, 5)
    expect(t.seconds).toBeCloseTo(103.78, 2)
    expect(t.key).toEqual(parseKey('F major'))
    expect(t).toMatchObject({ id: 'slow-ink', bpm: 74, lead: 'soft', leadTonic: 65, tone: 2600, space: 0.22 })
  })

  it('defaults tone to 2600 and space to 0.22', () => {
    const t = compileTrack('tiny', tiny())
    expect(t.tone).toBe(2600)
    expect(t.space).toBe(0.22)
    expect(compileTrack('tiny', tiny({ tone: 2200, space: 0.35 }))).toMatchObject({ tone: 2200, space: 0.35 })
  })

  it('marks each bar\'s section, its first and last bars and each phrase\'s 4th bar', () => {
    const p = compileTrack('slow-ink', SLOW_INK).plan
    expect(p.map((b) => b.section).join(' ')).toBe(
      'intro intro A A A A A A A A A2 A2 A2 A2 A2 A2 A2 A2 B B B B A2 A2 A2 A2 A2 A2 A2 A2 outro outro',
    )
    expect(p[2]).toMatchObject({ section: 'A', sectionBar: 0, sectionStart: true, sectionEnd: false, phraseEnd: false })
    expect(p[5]).toMatchObject({ sectionBar: 3, phraseEnd: true })
    expect(p[9]).toMatchObject({ sectionBar: 7, sectionEnd: true, phraseEnd: true })
    expect(p[1]).toMatchObject({ sectionStart: false, sectionEnd: true, phraseEnd: false })
    expect(p.filter((b) => b.sectionStart)).toHaveLength(6)
    expect(p.filter((b) => b.phraseEnd)).toHaveLength(7)
  })

  it('throws on an empty form or an unknown section in it', () => {
    expect(() => compileTrack('t', tiny({ form: '  ' }))).toThrow('t: field form: the form names no section')
    expect(() => compileTrack('t', tiny({ form: 'S X' }))).toThrow('t: field form: unknown section "X"')
  })

  it('checks the feel, the tempo and that leadTonic is the key\'s tonic', () => {
    const feel = tiny().feel
    expect(() => compileTrack('t', tiny({ feel: { ...feel, swing: 0.7 } }))).toThrow('t: field feel.swing')
    expect(() => compileTrack('t', tiny({ feel: { ...feel, ghost: 1.5 } }))).toThrow('t: field feel.ghost')
    expect(() => compileTrack('t', tiny({ bpm: 0 }))).toThrow('t: field bpm')
    expect(() => compileTrack('t', tiny({ leadTonic: 74 }))).toThrow('t: field leadTonic')
  })
})

describe('compileTrack: grids and motifs', () => {
  it('parses a grid into one cell per 16th', () => {
    const t = compileTrack('slow-ink', SLOW_INK)
    expect(t.drums.main.bars).toBe(1)
    expect(t.drums.main.lanes.s?.join('')).toBe('....X.......X...')
    expect(t.drums.tick.lanes.k).toBeUndefined()
    expect(t.bass.walk).toEqual({ bars: 1, cells: [...'R-----5-R---..A-'] })
    expect(compileTrack('tiny', tiny()).comp.long.bars).toBe(2)
  })

  it('takes a grid of 16 or 32 cells only, naming the track and the pattern\'s field', () => {
    const bad = { ...SLOW_INK, drums: { ...SLOW_INK.drums, main: { k: 'X......x..x....' } } }
    expect(() => compileTrack('slow-ink', bad)).toThrow(
      'slow-ink: field drums, pattern main, lane k: 15 cells; a grid is 16 or 32',
    )
    expect(() => compileTrack('t', tiny({ comp: { a: 'X'.repeat(48) } }))).toThrow(
      't: field comp, pattern a: 48 cells; a grid is 16 or 32',
    )
    expect(() => compileTrack('t', tiny({ drums: { a: {} } }))).toThrow('t: field drums, pattern a: no lanes')
    expect(() => compileTrack('t', tiny({ drums: { a: { k: 'X'.repeat(16), h: 'x'.repeat(32) } } }))).toThrow(
      't: field drums, pattern a: every lane must be the same length',
    )
  })

  it('throws on a character outside each lane\'s alphabet', () => {
    expect(() => compileTrack('t', tiny({ drums: { a: { k: 'X..-............' } } }))).toThrow(
      't: field drums, pattern a, lane k: unknown character "-" at 4',
    )
    expect(() => compileTrack('t', tiny({ comp: { a: 'X---g-----------' } }))).toThrow(
      't: field comp, pattern a: unknown character "g" at 5',
    )
    expect(() => compileTrack('t', tiny({ bass: { a: 'R---7-----------' } }))).toThrow(
      't: field bass, pattern a: unknown character "7" at 5',
    )
    expect(() => compileTrack('t', tiny({ drums: { a: { q: 'X...............' } as never } }))).toThrow(
      't: field drums, pattern a: unknown lane "q"',
    )
  })

  it('parses a motif into notes and rests with their start, octave and length', () => {
    const m1 = compileTrack('slow-ink', SLOW_INK).motifs.m1
    expect(m1.bars).toBe(2)
    expect(m1.notes).toEqual([
      { degree: null, octave: 0, at: 0, len: 2 },
      { degree: 5, octave: 0, at: 2, len: 2 },
      { degree: 6, octave: 0, at: 4, len: 2 },
      { degree: 1, octave: 1, at: 6, len: 4 },
      { degree: 6, octave: 0, at: 10, len: 2 },
      { degree: 5, octave: 0, at: 12, len: 4 },
      { degree: 3, octave: 0, at: 16, len: 8 },
      { degree: null, octave: 0, at: 24, len: 8 },
    ])
    expect(compileTrack('t', tiny({ motifs: { one: "2,,:16" } })).motifs.one.notes).toEqual([
      { degree: 2, octave: -2, at: 0, len: 16 },
    ])
  })

  it('needs a motif to fill whole bars, one or two, with each | on a bar line', () => {
    expect(() => compileTrack('t', tiny({ motifs: { one: '1:8 2:4' } }))).toThrow(
      't: field motifs, pattern one: 12 16ths; a motif fills 1 or 2 whole bars',
    )
    expect(() => compileTrack('t', tiny({ motifs: { one: '1:16 | 2:16 | 3:16' } }))).toThrow(
      't: field motifs, pattern one: 48 16ths; a motif fills 1 or 2 whole bars',
    )
    expect(() => compileTrack('t', tiny({ motifs: { one: '1:8 | 2:8' } }))).toThrow(
      't: field motifs, pattern one: "|" at 8 16ths is not on a bar line',
    )
    expect(() => compileTrack('t', tiny({ motifs: { one: '8:16' } }))).toThrow(
      't: field motifs, pattern one: bad token "8:16"',
    )
    expect(() => compileTrack('t', tiny({ motifs: { one: "1',:16" } }))).toThrow(
      't: field motifs, pattern one: bad token "1\',:16"',
    )
    expect(() => compileTrack('t', tiny({ motifs: { one: '1:0 2:16' } }))).toThrow(
      't: field motifs, pattern one: bad token "1:0"',
    )
  })
})

describe('compileTrack: sections', () => {
  it('lets like inherit every field, the child\'s own fields overriding', () => {
    const p = compileTrack('slow-ink', SLOW_INK).plan
    const a = p[2]
    const a2 = p[10]
    expect(a2.slots.map((s) => s.chord.symbol)).toEqual(a.slots.map((s) => s.chord.symbol))
    expect(a2.comp).toEqual(a.comp)
    expect(a2.bass).toEqual({ name: 'walk', half: 0 })
    expect(a2.drums).toEqual({ name: 'main', half: 0 })
    expect(a.lead).toBeNull()
    expect(a2.lead).toEqual({ name: 'm1', half: 0 })
    const spec = tiny({
      sections: {
        S: { chords: 'I | IV', comp: 'a', bass: 'a' },
        T: { like: 'S', comp: 'b' },
        U: { like: 'T', chords: 'V' },
      },
      form: 'S T U',
    })
    const q = compileTrack('t', spec).plan
    expect(q.map((b) => b.comp?.name).join()).toBe('a,a,b,b,b')
    expect(q.map((b) => b.bass?.name).join()).toBe('a,a,a,a,a')
    expect(q[4].slots[0].chord.symbol).toBe('V')
  })

  it('throws on an unknown or circular like, and on a section with no chords', () => {
    const base = tiny().sections
    expect(() => compileTrack('t', tiny({ sections: { ...base, T: { like: 'Z' } }, form: 'T' }))).toThrow(
      't: section T, field like: unknown section "Z"',
    )
    expect(() =>
      compileTrack('t', tiny({ sections: { T: { like: 'U' }, U: { like: 'T' } }, form: 'T' })),
    ).toThrow('t: section T, field like: circular like')
    expect(() => compileTrack('t', tiny({ sections: { T: { comp: 'a' } }, form: 'T' }))).toThrow(
      't: section T, field chords: no chords',
    )
  })

  it('cycles a short bar list over the section', () => {
    const p = compileTrack('slow-ink', SLOW_INK).plan
    expect(p.slice(0, 2).map((b) => b.drums)).toEqual([{ name: 'tick', half: 0 }, null])
    expect(p.slice(2, 10).every((b) => b.drums?.name === 'main')).toBe(true)
    const q = compileTrack('t', withS({ drums: 'a b' })).plan
    expect(q.map((b) => b.drums?.name).join()).toBe('a,b,a,b')
    expect(compileTrack('t', withS({})).plan.every((b) => b.comp === null && b.lead === null)).toBe(true)
  })

  it('continues a two-bar pattern with -', () => {
    const p = compileTrack('slow-ink', SLOW_INK).plan
    expect(p.slice(10, 18).map((b) => (b.lead ? `${b.lead.name}.${b.lead.half}` : '.')).join(' ')).toBe(
      'm1.0 m1.1 . . m2.0 m2.1 m3.0 m3.1',
    )
    const q = compileTrack('t', withS({ comp: 'long -' })).plan
    expect(q.map((b) => b.comp && `${b.comp.name}.${b.comp.half}`).join()).toBe('long.0,long.1,long.0,long.1')
  })

  it('holds - to a two-bar pattern, and a section to whole two-bar patterns', () => {
    expect(() => compileTrack('t', withS({ comp: 'a -' }))).toThrow(
      't: section S, field comp: "-" must follow a two-bar pattern',
    )
    expect(() => compileTrack('t', withS({ comp: '- long' }))).toThrow(
      't: section S, field comp: "-" must follow a two-bar pattern',
    )
    expect(() => compileTrack('t', withS({ comp: 'long a' }))).toThrow(
      't: section S, field comp: the two-bar pattern "long" needs "-" after it',
    )
    expect(() => compileTrack('t', withS({ lead: 'two - one' }))).toThrow(
      't: section S, field lead: the section ends inside the two-bar pattern "two"',
    )
    expect(() => compileTrack('t', withS({ bass: '  ' }))).toThrow(
      't: section S, field bass: the list is empty; leave the field out for silence',
    )
    expect(() => compileTrack('t', withS({ drums: 'a b a b a' }))).toThrow(
      't: section S, field drums: 5 bars listed; the section has 4',
    )
  })

  it('names the track, section and field for an unknown pattern', () => {
    const bad = { ...SLOW_INK, sections: { ...SLOW_INK.sections, A2: { like: 'A', drums: 'main mian' } } }
    expect(() => compileTrack('slow-ink', bad)).toThrow('slow-ink: section A2, field drums: unknown pattern "mian"')
    expect(() => compileTrack('t', withS({ lead: 'm9' }))).toThrow('t: section S, field lead: unknown pattern "m9"')
  })

  it('takes a comp alternate, checking both names', () => {
    const p = compileTrack('t', withS({ comp: 'a|b' })).plan
    expect(p[0].comp).toEqual({ name: 'a', half: 0, alt: 'b' })
    expect(compileTrack('t', withS({ comp: 'a' })).plan[0].comp).toEqual({ name: 'a', half: 0, alt: null })
    expect(() => compileTrack('t', withS({ comp: 'a|zz' }))).toThrow('t: section S, field comp: unknown pattern "zz"')
    expect(() => compileTrack('t', withS({ comp: 'a|long' }))).toThrow(
      't: section S, field comp: the alternate "long" must be as long as "a"',
    )
  })
})

describe('compileTrack: chords and voicings', () => {
  it('splits a bar into 1, 2 or 4 chords, evenly', () => {
    const p = compileTrack('slow-ink', SLOW_INK).plan
    expect(p[2].slots.map((s) => [s.step, s.chord.symbol])).toEqual([[0, 'IVmaj9']])
    expect(p[3].slots.map((s) => [s.step, s.chord.symbol])).toEqual([[0, 'iii7'], [8, 'vi7']])
    const q = compileTrack('t', withS({ chords: 'I IV V I' })).plan
    expect(q).toHaveLength(1)
    expect(q[0].slots.map((s) => [s.step, s.chord.symbol])).toEqual([[0, 'I'], [4, 'IV'], [8, 'V'], [12, 'I']])
  })

  it('throws on 3 chords in a bar, an empty bar or a chord the key rejects', () => {
    expect(() => compileTrack('t', withS({ chords: 'I | I IV V' }))).toThrow(
      't: section S, field chords: bar 2 holds 3 chords; a bar holds 1, 2 or 4',
    )
    expect(() => compileTrack('t', withS({ chords: 'I | | V' }))).toThrow(
      't: section S, field chords: bar 2 holds 0 chords; a bar holds 1, 2 or 4',
    )
    expect(() => compileTrack('t', withS({ chords: 'I | vi6' }))).toThrow(
      "t: section S, field chords: Chord 'vi6' in C major",
    )
  })

  it('gives each bar the next chord after it, wrapping to the first at the end', () => {
    const p = compileTrack('slow-ink', SLOW_INK).plan
    expect(p[1].next.symbol).toBe('IVmaj9')
    expect(p[2].next.symbol).toBe('iii7')
    expect(p[3].next.symbol).toBe('ii9')
    expect(p[31].next.symbol).toBe('IVmaj9')
  })

  it('voices the first chord nearest MIDI 62 and leads every voicing from the one before', () => {
    const p = compileTrack('slow-ink', SLOW_INK).plan
    // IVmaj9 in F is B-flat D F A C, rootless D F A C. Only D F A C (from 50 or 62) and C F A D (from 60) keep every
    // interval 3 or more inside a 14-semitone span: means 55, 67 and 67; the tie at 67 goes to 60 65 69 74.
    expect(p[0].slots[0].voicing).toEqual([60, 65, 69, 74])
    // Every voicing is the theory's voicing led from the one before it, across sections, never restarted.
    let prev: readonly number[] | null = null
    for (const s of p.flatMap((b) => b.slots)) {
      expect(s.voicing, s.chord.symbol).toEqual(voiceChord(s.chord, prev, [50, 74]))
      prev = s.voicing
    }
    const restarted = p.flatMap((b) => b.slots).filter((s) => s.voicing.join() !== voiceChord(s.chord, null, [50, 74]).join())
    expect(restarted.length).toBeGreaterThan(0)
  })

  it('leads a triad from the voicing before it', () => {
    const p = compileTrack('t', withS({ chords: 'I | V | I | IV | I' })).plan
    const firstI = p[0].slots[0].voicing
    expect(firstI).toEqual([60, 64, 67])
    // From 60 64 67, V (G B D) moves least to 59 62 67 (1 + 2 + 0).
    expect(p[1].slots[0].voicing).toEqual([59, 62, 67])
  })

  it('memoises per spec: the same object for the same spec, a new one for a copy', () => {
    const a = compileTrack('slow-ink', SLOW_INK)
    expect(compileTrack('slow-ink', SLOW_INK)).toBe(a)
    const b = compileTrack('slow-ink', structuredClone(SLOW_INK))
    expect(b).not.toBe(a)
    expect(b).toEqual(a)
  })
})
