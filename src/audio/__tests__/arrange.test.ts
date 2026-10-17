import { describe, expect, it } from 'vitest'
import { MAX_LATE, barEvents, eventsInWindow, leadPhrase } from '../music/arrange'
import { bassRegister } from '../music/arrangeParts'
import { compileTrack } from '../music/score'
import type { CompiledTrack, TrackSpec } from '../music/score'
import { isAvoid } from '../music/theory'
import type { Inst, MusicEvent } from '../music/types'

/**
 * Two small synthetic tracks, never the real ones. Both run at 75 BPM, so a 16th is 0.2 s and a bar 3.2 s.
 *
 * LOOP: C major, every variation switched on. Section A is 8 bars (a phrase end at bar 3 that is not a section end,
 * a section end at bar 7), B 4 bars; the form A B A is 20 bars, 64 s.
 */
const LOOP: TrackSpec = {
  title: 'Loop', key: 'C major', bpm: 75, lead: 'bell', leadTonic: 72,
  feel: { swing: 0.6, humanise: 0.02, fill: 0.5, ghost: 0.5, vary: 1, answer: 0.6 },
  mix: { keys: 1, bass: 1, lead: 1, drums: 1 },
  drums: { beat: { k: 'X.........x.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' } },
  comp: { main: 'X-------x-------', alt: 'x---x-.-X---.---' },
  bass: { walk: 'R-----5-R---..A-' },
  motifs: { m: "3:4 4:4 5:4 _:4 | 1':8 7:4 5:4" },
  sections: {
    A: {
      chords: 'Imaj7 | vi7 | ii7 V7 | Imaj7 | IVmaj7 | iii7 vi7 | ii7 V7 | Imaj7',
      comp: 'main|alt', bass: 'walk', drums: 'beat', lead: 'm - . .',
    },
    B: {
      chords: 'IVmaj7 | V7 | iii7 vi7 | ii7 V7 Imaj7 vi7', comp: 'main', bass: 'walk', drums: 'beat', lead: '. . m -',
    },
  },
  form: 'A B A',
}

/**
 * STRAIGHT: A minor, no humanise and no chance-driven variation but the 9th and the hat drop. A two-bar pad holds
 * across a chord change (i9 to iv9, so it re-strikes) and across a repeated chord (VImaj7 twice, so it holds).
 * Hats on every 16th. The form S S is 8 bars, 25.6 s.
 */
const STRAIGHT: TrackSpec = {
  title: 'Straight', key: 'A minor', bpm: 75, lead: 'soft', leadTonic: 69,
  feel: { swing: 0.6, humanise: 0, fill: 0, ghost: 0, vary: 0, answer: 0 },
  mix: { keys: 1, bass: 1, lead: 1, drums: 1 },
  drums: { h16: { h: 'xxxxxxxxxxxxxxxx' } },
  comp: { pad: 'X-------------------------------' },
  bass: { hold: 'R---------------' },
  motifs: { m: '1:16' },
  sections: { S: { chords: 'i9 | iv9 | VImaj7 | VImaj7', comp: 'pad -', bass: 'hold', drums: 'h16' } },
  form: 'S S',
}

/**
 * EDGES: C major, the bass at its range's edges and the keys answering every lead-less bar. Bar 1's written approach
 * leads from C2 (36) to C, so its usual side (B1, 35) is out of range; bars 3-4 play an octave over vi7, whose A has
 * one placement in 36-55 (45), with a hold on step 14 for the pop; bar 5 holds four chords and no lead. The motif
 * opens on a short note before a rest, closes on one after a rest, and has two short notes side by side. The form E E
 * is 16 bars, 51.2 s.
 */
const EDGES: TrackSpec = {
  title: 'Edges', key: 'C major', bpm: 75, lead: 'glock', leadTonic: 72,
  feel: { swing: 0.55, humanise: 0.01, fill: 0, ghost: 0, vary: 1, answer: 1 },
  mix: { keys: 1, bass: 1, lead: 1, drums: 1 },
  drums: { t: { h: 'x...x...x...x...' } },
  comp: { main: 'X-------x-------' },
  bass: { one: 'R---------------', appr: 'R--------------A', oct: 'R---O---R-------' },
  motifs: { m: '1:2 _:2 3:2 4:2 5:8 | 6:4 5:4 _:6 2:2' },
  sections: {
    E: {
      chords: 'ii7 | Imaj7 | Imaj7 | vi7 | vi7 | ii7 V7 Imaj7 vi7 | IVmaj7 | V7',
      comp: 'main', bass: 'one appr one oct oct one one one', drums: 't', lead: '. . . . . . m -',
    },
  },
  form: 'E E',
}

const loop = compileTrack('loop', LOOP)
const straight = compileTrack('straight', STRAIGHT)
const edges = compileTrack('edges', EDGES)
const SIXTEENTH = 0.2
const DRUMS: readonly Inst[] = ['kick', 'snare', 'hat', 'shaker']
const isDrum = (e: MusicEvent) => DRUMS.includes(e.inst)
const pc = (n: number) => ((n % 12) + 12) % 12

/** Every bar's events end to end, for one pass. */
const whole = (t: CompiledTrack, pass: number, seed: number) =>
  t.plan.flatMap((_, bar) => barEvents(t, bar, pass, seed))

/** An event's bar, its grid step in that bar and its delay from the grid (the delay is under a 16th here). */
function slot(e: MusicEvent): { bar: number; step: number; offset: number } {
  const grid = Math.floor(e.at / SIXTEENTH + 1e-9)
  return { bar: Math.floor(grid / 16), step: grid % 16, offset: e.at - grid * SIXTEENTH }
}

const PASSES = [0, 1, 2, 3, 7, 12]
const SEEDS = [1, 99]

describe('arranger: timing and windows', () => {
  it('is deterministic for a track, a bar, a pass and a seed', () => {
    for (const bar of [0, 3, 7, 19]) expect(barEvents(loop, bar, 4, 7)).toEqual(barEvents(loop, bar, 4, 7))
    expect(whole(loop, 1, 2)).not.toEqual(whole(loop, 1, 3))
  })

  it('sorts every bar, starts every event inside the track and delays it from its grid slot by under MAX_LATE', () => {
    // MAX_LATE is worked from the bounds: swing 0.68 at 66 BPM delays (2 x 0.68 - 1) x 60 / 66 / 4 = 81.8 ms, plus
    // 30 ms of humanise and 3 x 12 ms of strum: 147.8 ms.
    expect(MAX_LATE).toBeGreaterThanOrEqual(0.1478)
    expect(MAX_LATE).toBeLessThan(0.16)
    for (const t of [loop, straight]) {
      for (const pass of PASSES) {
        for (const seed of SEEDS) {
          const all = whole(t, pass, seed)
          expect(all.length).toBeGreaterThan(t.bars * 10)
          for (let i = 1; i < all.length; i++) expect(all[i].at).toBeGreaterThanOrEqual(all[i - 1].at)
          for (const e of all) {
            expect(e.at).toBeGreaterThanOrEqual(0)
            expect(e.at).toBeLessThan(t.seconds)
            expect(e.at + e.dur).toBeLessThanOrEqual(t.seconds + 1e-9)
            expect(e.dur).toBeGreaterThan(0)
            expect(e.vel).toBeGreaterThan(0)
            expect(e.vel).toBeLessThanOrEqual(1)
            const { offset } = slot(e)
            expect(offset).toBeGreaterThanOrEqual(-1e-9)
            expect(offset).toBeLessThan(MAX_LATE)
          }
        }
      }
    }
  })

  it('gives the same events however [0, T) is split into windows, each once', () => {
    for (const t of [loop, straight]) {
      const full = whole(t, 3, 5)
      for (const cuts of [[t.seconds], [1.1, 3.2, 3.25, 9.6, 20, t.seconds], [0.07, 0.5, 6.401, 12.79, t.seconds]]) {
        const got: MusicEvent[] = []
        let from = 0
        for (const to of cuts) {
          got.push(...eventsInWindow(t, 3, 5, from, to))
          from = to
        }
        expect(got).toEqual(full)
      }
      // Half-open: an event exactly at a window's end belongs to the next window.
      const first = full[0]
      expect(eventsInWindow(t, 3, 5, 0, first.at)).toEqual([])
      expect(eventsInWindow(t, 3, 5, first.at, first.at + 1e-6)[0]).toEqual(first)
    }
  })

  it('delays odd 16ths by exactly (2 x swing - 1) 16ths when humanise is 0, and strums a chord 12 ms a note', () => {
    for (const pass of PASSES) {
      const all = whole(straight, pass, 1)
      const unstrummed = all.filter((e) => e.inst !== 'keys')
      for (const e of unstrummed) {
        const { step, offset } = slot(e)
        expect(offset).toBeCloseTo(step % 2 === 1 ? 0.04 : 0, 9)
      }
      expect(unstrummed.filter((e) => e.inst === 'hat' && slot(e).step % 2 === 1).length).toBeGreaterThan(40)
    }
    // Bar 1's 3rd 16th (its hat plays in pass 0, seed 2): 3.2 + 3 x 0.2 + 0.04 = 3.84 s.
    const hat = barEvents(straight, 1, 0, 2).find((e) => e.inst === 'hat' && Math.abs(e.at - 3.84) < 0.01)
    expect(hat).toBeDefined()
    expect(hat?.at).toBeCloseTo(3.84, 9)
    const chord = barEvents(straight, 0, 0, 1).filter((e) => e.inst === 'keys')
    expect(chord.length).toBeGreaterThanOrEqual(3)
    chord.forEach((e, i) => expect(e.at).toBeCloseTo(0.012 * i, 9))
    for (let i = 1; i < chord.length; i++) expect(chord[i].midi).toBeGreaterThan(chord[i - 1].midi)
  })
})

describe('arranger: harmony and ranges', () => {
  it('keeps the harmony across passes 0 and 7, while some bar still differs', () => {
    for (const seed of SEEDS) {
      const a = whole(loop, 0, seed)
      const b = whole(loop, 7, seed)
      for (let bar = 0; bar < loop.bars; bar++) {
        const slots = loop.plan[bar].slots
        slots.forEach((s, i) => {
          const end = slots[i + 1]?.step ?? 16
          const pcs = (list: MusicEvent[]) => [
            ...new Set(
              list
                .filter((e) => e.inst === 'keys' && slot(e).bar === bar && slot(e).step >= s.step && slot(e).step < end)
                .map((e) => pc(e.midi))
                .filter((p) => s.chord.tones.includes(p)),
            ),
          ].sort()
          expect(pcs(a)).toEqual(pcs(b))
        })
        const root = (list: MusicEvent[]) =>
          list.filter((e) => e.inst === 'bass' && slot(e).bar === bar && slot(e).step === 0).map((e) => e.midi)
        expect(root(a)).toEqual(root(b))
        expect(root(a)).toHaveLength(1)
        expect(pc(root(a)[0])).toBe(slots[0].chord.root)
      }
      expect(loop.plan.some((_, bar) => JSON.stringify(barEvents(loop, bar, 0, seed)) !==
        JSON.stringify(barEvents(loop, bar, 7, seed)))).toBe(true)
    }
  })

  it('plays only diatonic notes, keys in 50-74, bass in 36-55, the lead in leadTonic-7 to leadTonic+19', () => {
    for (const t of [loop, straight, edges]) {
      for (const pass of [...PASSES, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]) {
        for (const e of SEEDS.flatMap((seed) => whole(t, pass, seed))) {
          if (isDrum(e)) {
            expect(e.midi).toBe(0)
            continue
          }
          expect(t.key.scale).toContain(pc(e.midi))
          const lead = [t.leadTonic - 7, t.leadTonic + 19]
          const [lo, hi] = e.inst === 'keys' ? [50, 74] : e.inst === 'bass' ? [36, 55] : lead
          expect(e.midi).toBeGreaterThanOrEqual(lo)
          expect(e.midi).toBeLessThanOrEqual(hi)
        }
      }
    }
  })

  it('adds the 9th to a 7th chord in some passes only, inside the chord\'s slot', () => {
    // Bar 0 of STRAIGHT is i9 (it has its 9th, B); bar 2 is VImaj7 (F A C E), whose 9th is G.
    const withG = PASSES.concat([20, 21, 22, 23, 24, 25]).filter((pass) =>
      barEvents(straight, 2, pass, 1).some((e) => e.inst === 'keys' && pc(e.midi) === 7))
    expect(withG.length).toBeGreaterThan(0)
    expect(withG.length).toBeLessThan(12)
  })
})

describe("arranger: the keys' variations", () => {
  const passes = Array.from({ length: 40 }, (_, i) => i)
  const keysAt = (bar: number, pass: number, step: number) =>
    barEvents(loop, bar, pass, 1).filter((e) => e.inst === 'keys' && slot(e).step === step)

  it("plays the comp's alternate in about a quarter of bars", () => {
    // Bar 0 is one chord: main strikes on 0 and 8 only, the alternate on 0, 4 and 8.
    const alt = passes.filter((pass) => keysAt(0, pass, 4).length > 0)
    expect(alt.length).toBeGreaterThan(2)
    expect(alt.length).toBeLessThan(20)
  })

  it("answers a resting lead with three of the chord's notes high in the keys range on steps 12-14", () => {
    // Bar 2 (ii7 V7) has no lead; bar 0 has the motif, so it never answers.
    let answers = 0
    for (const pass of passes) {
      expect([12, 13, 14].some((step) => keysAt(0, pass, step).length > 0)).toBe(false)
      const run = [12, 13, 14].map((step) => keysAt(2, pass, step))
      if (run.every((notes) => notes.length === 0)) continue
      answers++
      const voiced = loop.plan[2].slots[1].voicing.map(pc)
      for (const notes of run) {
        expect(notes).toHaveLength(1)
        expect(notes[0].midi).toBeGreaterThanOrEqual(62)
        expect(notes[0].midi).toBeLessThanOrEqual(74)
        expect(voiced).toContain(pc(notes[0].midi))
      }
    }
    expect(answers).toBeGreaterThan(5)
    expect(answers).toBeLessThan(passes.length)
  })
})

describe('arranger: durations and re-strikes', () => {
  it('re-strikes a held chord at a chord change and holds it over a repeated chord', () => {
    const all = whole(straight, 0, 1).filter((e) => e.inst === 'keys')
    const inBar = (bar: number) => all.filter((e) => slot(e).bar === bar)
    expect(inBar(1).length).toBeGreaterThanOrEqual(3)
    expect(inBar(1).every((e) => slot(e).step === 0)).toBe(true)
    // The pad struck at 0 s lasts until the re-strike at 3.2 s, less a 10% gap measured from the strike: every note
    // of the chord, strummed or not, releases together at 0.9 x 3.2 = 2.88 s.
    for (const e of inBar(0)) expect(e.at + e.dur).toBeCloseTo(2.88, 9)
    // Bars 2 and 3 are both VImaj7: struck at 6.4 s and held through bar 3 to the next strike at 12.8 s, less the
    // gap: 6.4 + 0.9 x 6.4 = 12.16 s.
    expect(inBar(3)).toEqual([])
    for (const e of inBar(2)) expect(e.at + e.dur).toBeCloseTo(12.16, 9)
  })

  it('never lets a note overlap the next strike of its part', () => {
    for (const t of [loop, straight, edges]) {
      for (const pass of PASSES) {
        const all = whole(t, pass, 1)
        for (const part of ['keys', 'bass', 'lead'] as const) {
          const notes = all.filter((e) => e.inst === part)
          for (const e of notes) {
            // A strike's own strum spreads its notes by under 0.05 s; the next strike comes later than that.
            const next = notes.find((f) => f.at >= e.at + 0.05)
            if (next) expect(e.at + e.dur).toBeLessThanOrEqual(next.at + 1e-9)
          }
        }
      }
    }
  })
})

describe('arranger: drums', () => {
  /** Whether a bar plays a fill: an open hat, or loud snares on 12-15 other than the pattern's one on 12. */
  function hasFill(events: MusicEvent[]): boolean {
    if (events.some((e) => e.open)) return true
    const loud = events.filter((e) => e.inst === 'snare' && e.vel > 0.3 && slot(e).step >= 12)
    const snares = loud.map((e) => slot(e).step)
    return snares.join() !== '12'
  }
  const passes = Array.from({ length: 40 }, (_, i) => i)

  it('fills a phrase\'s 4th bar in some passes and not all, and never with fill 0', () => {
    const filled = passes.filter((pass) => hasFill(barEvents(loop, 3, pass, 1)))
    expect(filled.length).toBeGreaterThan(0)
    expect(filled.length).toBeLessThan(passes.length)
    const calm = compileTrack('calm', { ...LOOP, feel: { ...LOOP.feel, fill: 0 } })
    expect(passes.filter((pass) => hasFill(barEvents(calm, 3, pass, 1)))).toEqual([])
    // Bar 1 is not a phrase's 4th bar.
    expect(passes.filter((pass) => hasFill(barEvents(loop, 1, pass, 1)))).toEqual([])
  })

  it('drops or fills steps 12-15 before a new section, both in some pass', () => {
    let drops = 0
    let fills = 0
    for (const pass of passes) {
      const drums = barEvents(loop, 7, pass, 1).filter(isDrum)
      const late = drums.filter((e) => slot(e).step >= 12)
      if (late.length === 0) drops++
      else {
        expect(hasFill(drums)).toBe(true)
        fills++
      }
    }
    expect(drops).toBeGreaterThan(0)
    expect(fills).toBeGreaterThan(0)
  })

  it('puts ghost snares only on odd steps with no snare beside them', () => {
    let ghosts = 0
    for (const pass of passes.slice(0, 10)) {
      for (let bar = 0; bar < loop.bars; bar++) {
        const snares = barEvents(loop, bar, pass, 1).filter((e) => e.inst === 'snare')
        for (const g of snares.filter((e) => e.vel <= 0.25 + 1e-9)) {
          ghosts++
          const step = slot(g).step
          expect(step % 2).toBe(1)
          expect(snares.some((e) => e !== g && Math.abs(slot(e).step - step) === 1)).toBe(false)
        }
      }
    }
    expect(ghosts).toBeGreaterThan(0)
  })

  it('drops hats only off the quarter notes', () => {
    let dropped = 0
    for (let pass = 0; pass < 40; pass++) {
      // Bars 3 and 7 end a section, so their steps 12-15 drop out or fill.
      for (const bar of [0, 1, 2, 4, 5, 6]) {
        const steps = barEvents(straight, bar, pass, 1).filter((e) => e.inst === 'hat').map((e) => slot(e).step)
        for (const q of [0, 4, 8, 12]) expect(steps).toContain(q)
        dropped += 16 - steps.length
      }
    }
    expect(dropped).toBeGreaterThan(0)
  })

  it('plays no drums after step 0 in the track\'s last bar', () => {
    for (const t of [loop, straight]) {
      for (const pass of PASSES) {
        const drums = barEvents(t, t.bars - 1, pass, 1).filter(isDrum)
        expect(drums.length).toBeGreaterThan(0)
        expect(drums.every((e) => slot(e).step === 0)).toBe(true)
      }
    }
  })

  it('marks open hats and gives the unpitched drums their nominal lengths', () => {
    const all = passes.flatMap((pass) => barEvents(loop, 3, pass, 1).concat(barEvents(loop, 0, pass, 1)))
    const nominal: Record<string, number> = { kick: 0.32, snare: 0.14, hat: 0.035, shaker: 0.05 }
    for (const e of all.filter(isDrum)) expect(e.dur).toBeCloseTo(e.open ? 0.18 : nominal[e.inst], 9)
    expect(all.some((e) => e.open && e.inst === 'hat')).toBe(true)
  })
})

describe('arranger: the lead', () => {
  const total = (notes: readonly { len: number }[]) => notes.reduce((a, n) => a + n.len, 0)

  it('snaps a long avoid note to the nearest chord tone and keeps the motif as written otherwise', () => {
    // vary 0: m over Imaj7 then vi7, degree 1 = C5 (72). E5, F5 (a long avoid note over C E G B: E5), G5, a rest,
    // C6 over vi7, B5 (not an avoid note over A C E G), G5.
    const plain = compileTrack('plain', { ...LOOP, feel: { ...LOOP.feel, vary: 0 } })
    const notes = leadPhrase(plain, 0, 0, 1)
    expect(notes.map((n) => n.midi)).toEqual([76, 76, 79, null, 84, 83, 79])
    expect(notes.map((n) => n.len)).toEqual([4, 4, 4, 4, 8, 4, 4])
  })

  it('varies some occurrences, keeping their length, the scale, the range and no long avoid note', () => {
    const plain = compileTrack('plain', { ...LOOP, feel: { ...LOOP.feel, vary: 0 } })
    let varied = 0
    for (const start of [0, 4, 10, 12, 16]) {
      expect(loop.plan[start].lead).toEqual({ name: 'm', half: 0 })
      for (let pass = 0; pass < 20; pass++) {
        const notes = leadPhrase(loop, start, pass, 1)
        if (JSON.stringify(notes) !== JSON.stringify(leadPhrase(plain, start, pass, 1))) varied++
        expect(total(notes)).toBe(32)
        let at = 0
        for (const n of notes) {
          expect(n.at).toBe(at)
          at += n.len
          if (n.midi === null) continue
          expect(loop.key.scale).toContain(pc(n.midi))
          expect(n.midi).toBeGreaterThanOrEqual(65)
          expect(n.midi).toBeLessThanOrEqual(91)
          if (n.len >= 4) {
            // Every chord slot the note covers, 16th by 16th.
            for (let q = n.at; q < n.at + n.len; q++) {
              const { slots } = loop.plan[start + Math.floor(q / 16)]
              const covering = slots.filter((s) => s.step <= q % 16)
              expect(isAvoid(n.midi, covering[covering.length - 1].chord)).toBe(false)
            }
          }
        }
      }
    }
    expect(varied).toBeGreaterThan(20)
  })

  it('merges a short note only into a pitched neighbour, so the motif\'s rests never change', () => {
    const plain = compileTrack('plain-edges', { ...EDGES, feel: { ...EDGES.feel, vary: 0 } })
    const rests = (notes: readonly { midi: number | null; at: number; len: number }[]) =>
      notes.filter((n) => n.midi === null).map((n) => `${n.at}:${n.len}`)
    let merged = 0
    for (let pass = 0; pass < 200; pass++) {
      for (const start of [6, 14]) {
        const notes = leadPhrase(edges, start, pass, 1)
        const base = leadPhrase(plain, start, pass, 1)
        expect(rests(notes)).toEqual(rests(base))
        if (notes.length < base.length) merged++
      }
    }
    expect(merged).toBeGreaterThan(0)
  })

  it('plays the phrase\'s notes as lead events from the motif\'s first bar on', () => {
    const notes = leadPhrase(loop, 0, 2, 1).filter((n) => n.midi !== null)
    const events = [...barEvents(loop, 0, 2, 1), ...barEvents(loop, 1, 2, 1)].filter((e) => e.inst === 'lead')
    expect(events.map((e) => e.midi)).toEqual(notes.map((n) => n.midi))
    expect(events.map((e) => slot(e).bar * 16 + slot(e).step)).toEqual(notes.map((n) => n.at))
  })
})

describe('arranger: the edges of the ranges', () => {
  /** The pitch class's note in 36-55 nearest `prev`, ties lower. */
  function nearestBass(p: number, prev: number): number {
    let best = -1
    for (let n = 36; n <= 55; n++) if (pc(n) === p && (best < 0 || Math.abs(n - prev) < Math.abs(best - prev))) best = n
    return best
  }

  it('keeps an octave over a root with one placement in 36-55 on the root itself, and never pops it', () => {
    // vi7's A sits only at 45: neither 57 nor 33 fits, so the written O (step 4) plays 45 and no pop comes on 14
    // (bar 4 may still approach ii7 on 15).
    for (const seed of SEEDS) {
      for (let pass = 0; pass < 40; pass++) {
        for (const bar of [3, 4, 11, 12]) {
          const bass = barEvents(edges, bar, pass, seed).filter((e) => e.inst === 'bass' && slot(e).step < 15)
          expect(bass.map((e) => e.midi)).toEqual([45, 45, 45])
          expect(bass.map((e) => slot(e).step)).toEqual([0, 4, 8])
        }
      }
    }
  })

  it('approaches from the other side when the usual one leaves the range', () => {
    // Bar 1 plays C at 36 (nearest the D at 38 before it); its written A leads to C at 36 again, and B1 (35) is out of
    // range, so it approaches from D2 (38). (Passes with an octave pop on 14 approach from that C3 instead.)
    let plain = 0
    for (let pass = 0; pass < 20; pass++) {
      const bass = barEvents(edges, 1, pass, 1).filter((e) => e.inst === 'bass')
      if (bass.length === 3) continue
      plain++
      expect(bass.map((e) => e.midi)).toEqual([36, 38])
      expect(bass.map((e) => slot(e).step)).toEqual([0, 15])
    }
    expect(plain).toBeGreaterThan(10)
  })

  it('works the bass register once per track, the same for every pass', () => {
    const anchors = bassRegister(edges)
    expect(anchors).toHaveLength(edges.bars)
    // Bar 0's D sits nearest 43 at 38, so bar 1 starts from 38.
    expect(anchors[1]).toBe(38)
    for (const seed of SEEDS) {
      for (let pass = 0; pass < 20; pass++) {
        for (let bar = 0; bar < edges.bars; bar++) {
          const first = barEvents(edges, bar, pass, seed).find((e) => e.inst === 'bass' && slot(e).step === 0)
          expect(first?.midi).toBe(nearestBass(edges.plan[bar].slots[0].chord.root, anchors[bar]))
        }
      }
    }
  })

  it('clears the held chord when an answer run starts, even where a new chord starts on step 12', () => {
    // Bar 5 holds four chords and no lead, and EDGES always answers: one note on each of 12, 13 and 14, no chord.
    for (let pass = 0; pass < 20; pass++) {
      const keys = barEvents(edges, 5, pass, 1).filter((e) => e.inst === 'keys')
      for (const step of [12, 13, 14]) expect(keys.filter((e) => slot(e).step === step)).toHaveLength(1)
      expect(keys.filter((e) => slot(e).step === 15)).toEqual([])
    }
  })

  it('freezes the events it keeps in the window cache', () => {
    const events = eventsInWindow(edges, 2, 3, 0, 6.4)
    expect(events.length).toBeGreaterThan(0)
    expect(events.every((e) => Object.isFrozen(e))).toBe(true)
  })
})
