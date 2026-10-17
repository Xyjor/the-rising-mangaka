import { describe, expect, it } from 'vitest'
import { barEvents, leadPhrase } from '../music/arrange'
import { AMPLITUDE, levelAt, NODES_PER_NOTE } from '../music/instruments'
import { compileTrack } from '../music/score'
import type { CompiledTrack } from '../music/score'
import { degreeToMidi, isAvoid } from '../music/theory'
import { CATALOG, isTrackId, SEASON_TRACKS, TITLE_TRACK, TRACKS } from '../music/tracks'
import type { TrackId } from '../music/tracks'
import type { Inst, MusicEvent } from '../music/types'

const NODE_BUDGET = 140
/** The most the overlapping voices' peaks may sum to before the buses (the design's "Budgets and loudness"). */
const PEAK_BUDGET = 0.45
const PASSES = [0, 1, 2, 3]
const SEEDS = [1, 2, 3]
const KEY_NAMES = ['C major', 'A minor', 'F major', 'D minor', 'G major', 'E minor']
const DRUMS: readonly Inst[] = ['kick', 'snare', 'hat', 'shaker']
const PITCHED: readonly Inst[] = ['keys', 'bass', 'lead']
const ALL_IDS = [
  'blank-page', 'slow-ink', 'sakura-margins', 'screentone', 'cold-ramune', 'rain-on-the-sill', 'tea-break',
  'first-snow', 'kotatsu',
]

const pc = (midi: number) => ((midi % 12) + 12) % 12
const defined = Object.entries(TRACKS).map(([id, spec]) => [id, compileTrack(id, spec)] as const)

/** Every bar's events over passes 0-3 and seeds 1-3. */
function everyBar(t: CompiledTrack, visit: (events: MusicEvent[], bar: number) => void): void {
  for (const pass of PASSES) {
    for (const seed of SEEDS) {
      for (let bar = 0; bar < t.bars; bar++) visit(barEvents(t, bar, pass, seed), bar)
    }
  }
}

/** Every event of one pass under one seed, the whole form, in start order. */
function passEvents(t: CompiledTrack, pass: number, seed: number): MusicEvent[] {
  const out: MusicEvent[] = []
  for (let bar = 0; bar < t.bars; bar++) out.push(...barEvents(t, bar, pass, seed))
  return out
}

/** The section names in the order the form first plays them. */
const sectionsInOrder = (t: CompiledTrack) => [...new Set(t.plan.map((b) => b.section))]

describe('the defined tracks', () => {
  it('are all nine, each id once, each with its own title', () => {
    expect(new Set(ALL_IDS).size).toBe(9)
    expect(Object.keys(TRACKS).sort()).toEqual([...ALL_IDS].sort())
    expect(new Set(Object.values(TRACKS).map((spec) => spec.title)).size).toBe(9)
  })

  it('share no motif: each tune belongs to one track', () => {
    const owner = new Map<string, string>()
    for (const [id, spec] of Object.entries(TRACKS)) {
      for (const motif of Object.values(spec.motifs)) {
        const tune = motif.trim().split(/\s+/).join(' ')
        expect(owner.get(tune) ?? id).toBe(id)
        owner.set(tune, id)
      }
    }
  })

  for (const [id, t] of defined) {
    describe(id, () => {
      it('is in one of the six keys', () => {
        expect(KEY_NAMES).toContain(t.key.name)
      })

      it('plays only diatonic notes', () => {
        let pitched = 0
        let off = 0
        everyBar(t, (events) => {
          for (const e of events) {
            if (!PITCHED.includes(e.inst)) continue
            pitched++
            if (!t.key.scale.includes(pc(e.midi))) off++
          }
        })
        expect(pitched).toBeGreaterThan(0)
        expect(off).toBe(0)
      })

      // In G major that rules out iii and vii, in E minor v and ii: their B and F# sit a semitone from a cue's C or G.
      it('has no chords rooted on B or F# in a G-collection key', () => {
        if (t.key.name !== 'G major' && t.key.name !== 'E minor') return
        const roots = t.plan.flatMap((b) => b.slots.map((s) => s.chord.root))
        expect(roots).not.toContain(11)
        expect(roots).not.toContain(6)
      })

      it('holds no long lead note on an avoid note', () => {
        let long = 0
        for (const pass of PASSES) {
          for (const seed of SEEDS) {
            t.plan.forEach((b, start) => {
              if (!b.lead || b.lead.half !== 0) return
              for (const n of leadPhrase(t, start, pass, seed)) {
                if (n.midi === null || n.len < 4) continue
                long++
                // Every chord slot the note covers, 16th by 16th.
                for (let q = n.at; q < n.at + n.len; q++) {
                  const { slots } = t.plan[Math.min(start + Math.floor(q / 16), t.bars - 1)]
                  const covering = slots.filter((s) => s.step <= q % 16)
                  expect(isAvoid(n.midi, covering[covering.length - 1].chord)).toBe(false)
                }
              }
            })
          }
        }
        expect(long).toBeGreaterThan(0)
      })

      it('writes every long lead note as no avoid note over the chords it covers, needing no snap', () => {
        // The motifs as written: with no variation, every long note (4 or more 16ths) must already clear each chord
        // under it, in every section the motif is placed in.
        const plain = compileTrack(id, { ...TRACKS[id as TrackId], feel: { ...t.feel, vary: 0 } })
        const snapped: string[] = []
        plain.plan.forEach((b, start) => {
          if (!b.lead || b.lead.half !== 0) return
          for (const n of plain.motifs[b.lead.name].notes) {
            if (n.degree === null || n.len < 4) continue
            const midi = degreeToMidi(plain.key, plain.leadTonic, n.degree, n.octave)
            for (let q = n.at; q < n.at + n.len; q++) {
              const { slots, section } = plain.plan[Math.min(start + Math.floor(q / 16), plain.bars - 1)]
              const covering = slots.filter((s) => s.step <= q % 16)
              const chord = covering[covering.length - 1].chord
              if (!isAvoid(midi, chord)) continue
              snapped.push(`${section} ${b.lead.name} degree ${n.degree} over ${chord.symbol}`)
            }
          }
        })
        expect([...new Set(snapped)]).toEqual([])
      })

      it('keeps every part in its range', () => {
        const [lo, hi] = [t.leadTonic - 7, t.leadTonic + 19]
        let out = 0
        everyBar(t, (events) => {
          for (const e of events) {
            if (e.inst === 'keys' && (e.midi < 50 || e.midi > 74)) out++
            if (e.inst === 'bass' && (e.midi < 36 || e.midi > 55)) out++
            if (e.inst === 'lead' && (e.midi < lo || e.midi > hi)) out++
          }
        })
        expect(out).toBe(0)
      })

      it('has a length, tempo, swing and form inside the bounds', () => {
        expect(t.bars).toBeGreaterThanOrEqual(24)
        expect(t.bars).toBeLessThanOrEqual(40)
        expect(t.seconds).toBeGreaterThanOrEqual(60)
        expect(t.seconds).toBeLessThanOrEqual(150)
        expect(t.bpm).toBeGreaterThanOrEqual(66)
        expect(t.bpm).toBeLessThanOrEqual(90)
        expect(t.feel.swing).toBeGreaterThanOrEqual(0.5)
        expect(t.feel.swing).toBeLessThanOrEqual(0.68)
        expect(sectionsInOrder(t).length).toBeGreaterThanOrEqual(2)
      })

      // The budget counts the nodes of the events starting in each bar, as the player schedules them bar by bar.
      it(`stays within ${NODE_BUDGET} audio nodes per bar`, () => {
        let worst = 0
        everyBar(t, (events) => {
          worst = Math.max(worst, events.reduce((sum, e) => sum + NODES_PER_NOTE[e.inst], 0))
        })
        expect(worst).toBeLessThanOrEqual(NODE_BUDGET)
      })

      // Swept at every event's start (where a sum can only rise), counting each voice still held then, from any bar, at
      // its envelope's level at that instant (`levelAt`): a decayed chord or a kick past its body counts for less.
      it(`keeps the summed peak of the voices sounding together within ${PEAK_BUDGET}`, () => {
        let worst = 0
        for (const pass of PASSES) {
          for (const seed of SEEDS) {
            let sounding: MusicEvent[] = []
            for (const e of passEvents(t, pass, seed)) {
              sounding = sounding.filter((o) => o.at + o.dur > e.at)
              sounding.push(e)
              const sum = sounding.reduce((a, o) => {
                const level = levelAt(o.inst, t.lead, e.at - o.at, o.open ?? false)
                return a + AMPLITUDE[o.inst === 'lead' ? t.lead : o.inst] * o.vel * level
              }, 0)
              worst = Math.max(worst, sum)
            }
          }
        }
        expect(worst).toBeGreaterThan(0)
        expect(worst).toBeLessThanOrEqual(PEAK_BUDGET)
      })
    })
  }
})

describe('the summer tracks', () => {
  for (const id of SEASON_TRACKS.summer) {
    it(`${id} plays the shaker`, () => {
      let shakes = 0
      everyBar(CATALOG.compiled(id), (events) => {
        shakes += events.filter((e) => e.inst === 'shaker').length
      })
      expect(shakes).toBeGreaterThan(0)
    })
  }
})

describe('the title track', () => {
  const t = CATALOG.compiled(TITLE_TRACK)

  it('is blank-page, a C major bell piece at 72 BPM', () => {
    expect(TITLE_TRACK).toBe('blank-page')
    expect([t.key.name, t.bpm, t.lead]).toEqual(['C major', 72, 'bell'])
  })

  // The design's title row: keys and bell alone while the title screen settles, so its first two sections have no
  // bass and no drums, and the light beat arrives with the third.
  it('plays keys and bell only in its first two sections, and drums from its third', () => {
    const [first, second, third] = sectionsInOrder(t)
    let early = 0
    let drumsLater = 0
    everyBar(t, (events, bar) => {
      const { section } = t.plan[bar]
      for (const e of events) {
        if (section === first || section === second) {
          if (e.inst !== 'keys' && e.inst !== 'lead') early++
        } else if (section === third && DRUMS.includes(e.inst)) {
          drumsLater++
        }
      }
    })
    expect(early).toBe(0)
    expect(drumsLater).toBeGreaterThan(0)
  })
})

describe('the catalogue', () => {
  it('pairs each season with two different tracks, eight in all', () => {
    expect(SEASON_TRACKS).toEqual({
      spring: ['slow-ink', 'sakura-margins'],
      summer: ['screentone', 'cold-ramune'],
      autumn: ['rain-on-the-sill', 'tea-break'],
      winter: ['first-snow', 'kotatsu'],
    })
  })

  it('pools the title track alone on the title screen', () => {
    expect(CATALOG.poolFor({ mood: 'title', season: 'summer', calm: false })).toEqual(['blank-page'])
  })

  it("gives each season two different written tracks, none of them another season's", () => {
    const seasonal = Object.values(SEASON_TRACKS).flat()
    expect(new Set(seasonal).size).toBe(8)
    for (const id of seasonal) expect(TRACKS[id]).toBeDefined()
  })

  it('keeps the title track out of every season', () => {
    for (const pair of Object.values(SEASON_TRACKS)) expect(pair).not.toContain(TITLE_TRACK)
  })

  it("pools the season's two tracks in the studio, calm or not", () => {
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      for (const calm of [false, true]) {
        expect(CATALOG.poolFor({ mood: 'studio', season, calm })).toEqual(SEASON_TRACKS[season])
      }
    }
  })

  it('compiles a defined track, the same object each time', () => {
    const t = CATALOG.compiled('slow-ink')
    expect([t.id, t.key.name, t.bpm, t.lead]).toEqual(['slow-ink', 'F major', 74, 'soft'])
    expect(CATALOG.compiled('slow-ink')).toBe(t)
  })

  it('compiles every track', () => {
    for (const id of ALL_IDS) expect(CATALOG.compiled(id).id).toBe(id)
  })

  it('throws for an id that is not a track', () => {
    expect(() => CATALOG.compiled('nope')).toThrow(/nope/)
    expect(() => CATALOG.compiled('toString')).toThrow(/toString/)
  })

  it('knows the nine track ids and nothing else', () => {
    for (const id of ALL_IDS) expect(isTrackId(id)).toBe(true)
    for (const id of ['', 'nope', 'Slow-ink', 'toString', 'constructor']) expect(isTrackId(id)).toBe(false)
    const typed: TrackId[] = ALL_IDS.filter(isTrackId)
    expect(typed).toHaveLength(9)
  })
})
