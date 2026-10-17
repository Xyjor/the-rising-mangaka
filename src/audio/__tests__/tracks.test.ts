import { describe, expect, it } from 'vitest'
import { barEvents, leadPhrase } from '../music/arrange'
import { compileTrack } from '../music/score'
import type { CompiledTrack } from '../music/score'
import { isAvoid } from '../music/theory'
import { CATALOG, isTrackId, SEASON_TRACKS, TITLE_TRACK, TRACKS } from '../music/tracks'
import type { TrackId } from '../music/tracks'
import type { Inst, MusicEvent } from '../music/types'

/**
 * The audio nodes one event of each instrument builds. Task 7 replaces this table with `NODES_PER_NOTE` from
 * `music/instruments.ts`.
 */
const NODES_PER_NOTE: Record<Inst, number> = { keys: 4, lead: 4, bass: 3, kick: 2, snare: 4, hat: 2, shaker: 2 }
const NODE_BUDGET = 140
const PASSES = [0, 1, 2, 3]
const SEEDS = [1, 2, 3]
const KEY_NAMES = ['C major', 'A minor', 'F major', 'D minor', 'G major', 'E minor']
const DRUMS: readonly Inst[] = ['kick', 'snare', 'hat', 'shaker']
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

/** The section names in the order the form first plays them. */
const sectionsInOrder = (t: CompiledTrack) => [...new Set(t.plan.map((b) => b.section))]

describe('the defined tracks', () => {
  it('include the title track and the spring track', () => {
    expect(Object.keys(TRACKS).sort()).toEqual(['blank-page', 'slow-ink'])
  })

  for (const [id, t] of defined) {
    describe(id, () => {
      it('is in one of the six keys', () => {
        expect(KEY_NAMES).toContain(t.key.name)
      })

      it('plays only diatonic notes', () => {
        let off = 0
        everyBar(t, (events) => {
          for (const e of events) if (e.midi !== 0 && !t.key.scale.includes(pc(e.midi))) off++
        })
        expect(off).toBe(0)
      })

      it('uses no iii or vii chords in a G-collection key', () => {
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

      it(`stays within ${NODE_BUDGET} audio nodes per bar`, () => {
        let worst = 0
        everyBar(t, (events) => {
          worst = Math.max(worst, events.reduce((sum, e) => sum + NODES_PER_NOTE[e.inst], 0))
        })
        expect(worst).toBeLessThanOrEqual(NODE_BUDGET)
      })
    })
  }
})

describe('the title track', () => {
  const t = CATALOG.compiled(TITLE_TRACK)

  it('is blank-page, a C major bell piece at 72 BPM', () => {
    expect(TITLE_TRACK).toBe('blank-page')
    expect([t.key.name, t.bpm, t.lead]).toEqual(['C major', 72, 'bell'])
  })

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

  it("pools the season's defined tracks in the studio", () => {
    expect(CATALOG.poolFor({ mood: 'studio', season: 'spring', calm: false })).toEqual(['slow-ink'])
    expect(CATALOG.poolFor({ mood: 'studio', season: 'spring', calm: true })).toEqual(['slow-ink'])
  })

  it('falls back to slow-ink for a season with no track written yet', () => {
    for (const season of ['summer', 'autumn', 'winter'] as const) {
      expect(CATALOG.poolFor({ mood: 'studio', season, calm: false })).toEqual(['slow-ink'])
    }
  })

  it('compiles a defined track, the same object each time', () => {
    const t = CATALOG.compiled('slow-ink')
    expect([t.id, t.key.name, t.bpm, t.lead]).toEqual(['slow-ink', 'F major', 74, 'soft'])
    expect(CATALOG.compiled('slow-ink')).toBe(t)
  })

  it('throws for a track not written yet or not a track at all', () => {
    expect(() => CATALOG.compiled('kotatsu')).toThrow(/kotatsu/)
    expect(() => CATALOG.compiled('nope')).toThrow(/nope/)
  })

  it('knows the nine track ids and nothing else', () => {
    for (const id of ALL_IDS) expect(isTrackId(id)).toBe(true)
    for (const id of ['', 'nope', 'Slow-ink', 'toString', 'constructor']) expect(isTrackId(id)).toBe(false)
    const typed: TrackId[] = ALL_IDS.filter(isTrackId)
    expect(typed).toHaveLength(9)
  })
})
