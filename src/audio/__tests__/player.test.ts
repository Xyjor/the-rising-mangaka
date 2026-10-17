import { describe, expect, it } from 'vitest'
import { createMusicPlayer } from '../music/player'
import { breakSeconds } from '../music/playlist'
import { compileTrack } from '../music/score'
import type { TrackSpec } from '../music/score'
import type { KeyName } from '../music/theory'
import type { Catalog } from '../music/tracks'
import type { LeadVoice, MusicEvent, MusicScene, VoiceFn } from '../music/types'
import { FakeAudioContext, FakeBiquad, FakeBufferSource, FakeConvolver, FakeGain, FakeOscillator, FakeParam, asContext } from './fakeAudio'
import { FakeTimers } from './fakeTimers'

const r = (x: number) => Math.round(x * 1e6) / 1e6
const trace = (p: FakeParam) =>
  p.events.map((e) => [e.kind, 'value' in e ? r(e.value) : null, 'time' in e ? r(e.time) : null])

/**
 * Four tiny synthetic tracks, never the real ones: 2 bars at 120 BPM (a 4 s form), a kick on every beat and the
 * chord's root held in the bass, no humanise or chance-driven variation. Each sits in its own key, so the bass note
 * that opens a track names it: C (a), F (b), G (c), D (d).
 */
function spec(key: KeyName, leadTonic: number, chords: string, bassMix: number): TrackSpec {
  return {
    title: key, key, bpm: 120, lead: 'bell', leadTonic,
    feel: { swing: 0.5, humanise: 0, fill: 0, ghost: 0, vary: 0, answer: 0 },
    mix: { keys: 1, bass: bassMix, lead: 1, drums: 0.6 }, tone: 2400, space: 0.3,
    drums: { beat: { k: 'X...X...X...X...' } },
    comp: {},
    bass: { hold: 'R---------------' },
    motifs: {},
    sections: { A: { chords, bass: 'hold', drums: 'beat' } },
    form: 'A',
  }
}

const TRACKS = {
  a: compileTrack('a', spec('C major', 72, 'Imaj7 | IVmaj7', 0.8)),
  b: compileTrack('b', spec('F major', 77, 'Imaj7 | IVmaj7', 0.7)),
  c: compileTrack('c', spec('G major', 79, 'Imaj7 | IVmaj7', 0.9)),
  d: compileTrack('d', spec('D minor', 74, 'i7 | iv7', 1)),
}
const ID_OF_PC: Record<number, string> = { 0: 'a', 5: 'b', 7: 'c', 2: 'd' }
const BASS_MIX: Record<string, number> = { a: 0.8, b: 0.7, c: 0.9, d: 1 }
const SECONDS = 4

/** The title pool is a and b; the studio's is all four, but summer's is c alone and winter's d alone. */
const CATALOG: Catalog = {
  compiled(id) {
    const t = TRACKS[id as keyof typeof TRACKS]
    if (!t) throw new Error(`No track "${id}"`)
    return t
  },
  poolFor(scene) {
    if (scene.mood === 'title') return ['a', 'b']
    if (scene.season === 'summer') return ['c']
    return scene.season === 'winter' ? ['d'] : ['a', 'b', 'c', 'd']
  },
}

const SEED = 7
const STUDIO: MusicScene = { mood: 'studio', season: 'spring', calm: false }
const TITLE: MusicScene = { mood: 'title', season: 'spring', calm: false }
const WINTER: MusicScene = { mood: 'studio', season: 'winter', calm: false }
/** Each instrument's place in a Loop's seven fades (the order of `PART_OF`). */
const INST_INDEX = { keys: 0, bass: 1, lead: 2, kick: 3, snare: 4, hat: 5, shaker: 6 } as const

/** One scheduled event as the recording voice saw it: its absolute time, the gain it played into, its timbre. */
interface Played {
  e: MusicEvent
  out: FakeGain
  lead: LeadVoice
  src: FakeOscillator
  /** Every `Voice.stop` call's time. */
  stopped: number[]
}

function setup(o: { state?: AudioContextState; scene?: MusicScene } = {}) {
  const fake = new FakeAudioContext({ state: o.state })
  const timers = new FakeTimers()
  const dest = fake.createGain()
  const played: Played[] = []
  /** One fake source per event (at a sentinel 1000 Hz, apart from the session's LFOs), recorded. */
  const voice: VoiceFn = (ctx, out, e, lead) => {
    const src = (ctx as unknown as FakeAudioContext).createOscillator()
    src.frequency.value = 1000
    src.connect(out as unknown as FakeGain)
    src.start(e.at)
    const p: Played = { e, out: out as unknown as FakeGain, lead, src, stopped: [] }
    played.push(p)
    return {
      end: e.at + e.dur,
      stop(at) {
        p.stopped.push(at)
        src.stop(at)
      },
    }
  }
  const player = createMusicPlayer(asContext(fake), dest as unknown as AudioNode, timers, {
    seed: SEED, catalog: CATALOG, voice, ...(o.scene ? { scene: o.scene } : {}),
  })
  let ms = 0
  /** Moves the context clock on in 50 ms ticks, firing the timer at each. */
  const advance = (by: number) => {
    const end = ms + by
    while (ms < end) {
      ms += 50
      fake.currentTime = ms / 1000
      timers.fire()
    }
  }
  /** Each Loop's seven fade gains: gains (not the dest's) whose automation opens with a rise from 0 to 1. */
  const fades = () =>
    fake.nodes.filter(
      (n): n is FakeGain =>
        n instanceof FakeGain &&
        !n.connections.includes(dest) &&
        n.gain.events[0]?.kind === 'value' &&
        n.gain.events[0].value === 0 &&
        n.gain.events[2]?.kind === 'linearRampToValueAtTime' &&
        n.gain.events[2].value === 1,
    )
  /** The fades grouped by Loop, oldest first. */
  const loops = () => {
    const all = fades()
    return Array.from({ length: all.length / 7 }, (_, i) => all.slice(i * 7, i * 7 + 7))
  }
  /** The Loop (by its place in `loops()`) a played note went into. */
  const loopOf = (p: Played) => Math.floor(fades().indexOf(p.out) / 7)
  /** An instrument's bus input on the chain. */
  const bus = (inst: keyof typeof INST_INDEX) => fades()[INST_INDEX[inst]].connections[0] as FakeGain
  /** The chain's tone lowpass (the bass's own lowpass feeds the sum, not the dest). */
  const tone = () =>
    fake.nodes.find((n): n is FakeBiquad => n instanceof FakeBiquad && n.type === 'lowpass' && n.connections.includes(dest))!
  /** The reverb send. */
  const send = () =>
    fake.nodes.find((n): n is FakeGain => n instanceof FakeGain && n.connections.some((c) => c instanceof FakeConvolver))!
  /** The crackle gate: the gain the session's buffer sources play into. */
  const gate = () => {
    const src = fake.nodes.find((n): n is FakeBufferSource => n instanceof FakeBufferSource)
    return src?.connections[0] as FakeGain | undefined
  }
  /** The session's slow wobble LFOs (0.45 Hz): one per open session. */
  const lfos = () =>
    fake.nodes.filter((n): n is FakeOscillator => n instanceof FakeOscillator && n.frequency.target === 0.45)
  /** Ticks on to the last tick at or before `t` seconds. */
  const advanceTo = (t: number) => advance(Math.floor((t * 1000 - ms) / 50) * 50)
  return { fake, timers, dest, player, played, advance, advanceTo, fades, loops, loopOf, bus, tone, send, gate, lfos }
}

/**
 * The tracks heard: events split where 2 s pass with none (a track's own gaps are at most 1.75 s, every break at
 * least 2 s), each named by its opening bass note.
 */
function heard(played: readonly Played[]): { id: string; origin: number; last: number }[] {
  const sorted = [...played].sort((x, y) => x.e.at - y.e.at)
  const out: { id: string; origin: number; last: number }[] = []
  for (const p of sorted) {
    const cur = out.at(-1)
    if (cur && p.e.at - cur.last < 2) {
      cur.last = p.e.at
      continue
    }
    const bass = sorted.find((q) => q.e.inst === 'bass' && q.e.at === p.e.at)
    out.push({ id: bass ? ID_OF_PC[bass.e.midi % 12] : '?', origin: p.e.at, last: p.e.at })
  }
  return out
}

describe('music player: start and the look-ahead', () => {
  it('creates nothing until start', () => {
    const { fake, player, timers } = setup()
    expect(fake.nodes).toHaveLength(1) // only the test's dest
    player.stop()
    expect(fake.nodes).toHaveLength(1)
    expect(timers.live).toEqual([])
  })

  it('starts a track at once behind seven fades, each rising 0 to 1 over 2 s into its own bus', () => {
    const { player, timers, played, fades } = setup()
    player.start()
    expect(timers.live).toEqual([50])
    expect(fades()).toHaveLength(7)
    for (const f of fades()) {
      expect(trace(f.gain)).toEqual([
        ['value', 0, null],
        ['setValueAtTime', 0, 0],
        ['linearRampToValueAtTime', 1, 2],
      ])
      expect(f.connections).toHaveLength(1)
    }
    expect(new Set(fades().map((f) => f.connections[0])).size).toBe(7)
    // The first window (0 to 0.2 s) holds the opening kick and bass note, each into its own fade.
    expect(played.map((p) => [p.e.inst, p.e.at])).toEqual([['kick', 0], ['bass', 0]])
    const [kick, bass] = played
    expect(fades()).toContain(kick.out)
    expect(fades()).toContain(bass.out)
    expect(kick.out).not.toBe(bass.out)
    expect(kick.src.connections).toEqual([kick.out])
    expect(kick.lead).toBe('bell')
  })

  it('opens the crackle gate 0 to 1 over 2 s and starts one session', () => {
    const { player, gate, lfos } = setup()
    player.start()
    expect(trace(gate()!.gain)).toEqual([
      ['value', 0, null],
      ['cancelAndHoldAtTime', null, 0],
      ['linearRampToValueAtTime', 1, 2],
    ])
    expect(lfos()).toHaveLength(1)
  })

  it('looks 200 ms ahead on each 50 ms tick', () => {
    const { player, played, advance } = setup()
    player.start()
    advance(300) // the tick at 0.3 s schedules up to 0.5 s, half-open; the second kick is at 0.5
    expect(played).toHaveLength(2)
    advance(50)
    expect(played).toHaveLength(3)
    expect([played[2].e.inst, played[2].e.at]).toEqual(['kick', 0.5])
  })

  it('skips ahead after a stall instead of playing the missed notes in a burst', () => {
    const { fake, timers, player, played } = setup()
    player.start()
    fake.currentTime = 1.4
    timers.fire()
    // Only the kick at 1.5 falls in 1.4 to 1.6; the kicks at 0.5 and 1 are skipped.
    expect(played.slice(2).map((p) => [p.e.inst, p.e.at])).toEqual([['kick', 1.5]])
  })

  it('glides the chain to the track levels as its segment starts, from a chain built at the defaults', () => {
    const { player, played } = setup()
    player.start()
    const bass = played.find((p) => p.e.inst === 'bass')!
    const bassBus = bass.out.connections[0] as FakeGain
    // Built at every part 1 (no track), then the opening track's bass level with tau 0.4.
    expect(bassBus.gain.events).toEqual([
      { kind: 'value', value: 1 },
      { kind: 'setTargetAtTime', value: BASS_MIX[ID_OF_PC[bass.e.midi % 12]], time: 0, timeConstant: 0.4 },
    ])
  })
})

describe('music player: segments', () => {
  it('follows a track with a crackle break of 8 to 20 s and no voices, then a different track at its end', () => {
    const { player, played, advance } = setup()
    player.start()
    advance(30_000)
    const [first, second] = heard(played)
    const gap = breakSeconds(SEED, 1)
    expect(gap).toBeGreaterThanOrEqual(8)
    expect(gap).toBeLessThanOrEqual(20)
    expect(first.origin).toBe(0)
    expect(first.last).toBeLessThan(SECONDS)
    expect(r(second.origin)).toBe(r(SECONDS + gap))
    expect(['a', 'b']).toContain(first.id)
    expect(['a', 'b']).toContain(second.id)
    expect(second.id).not.toBe(first.id)
    // The second track's segment glides its levels in too.
    const bassBus = played[1].out.connections[0] as FakeGain
    const glides = bassBus.gain.events.filter((e) => e.kind === 'setTargetAtTime')
    expect(glides).toHaveLength(2)
    // At the segment's start, not when the look-ahead first reached it.
    expect(glides[1]).toMatchObject({ value: BASS_MIX[second.id], timeConstant: 0.4 })
    expect(r((glides[1] as { time: number }).time)).toBe(r(SECONDS + gap))
  })

  it('schedules a boundary inside one window in the same tick', () => {
    const { fake, timers, player, played } = setup()
    player.start()
    const breakEnd = SECONDS + breakSeconds(SEED, 1)
    let ms = 0
    // Tick up to the last tick whose window ends short of the break's end...
    while ((ms + 50) / 1000 + 0.2 < breakEnd) {
      ms += 50
      fake.currentTime = ms / 1000
      timers.fire()
    }
    expect(played.filter((p) => p.e.at >= breakEnd - 1e-9)).toEqual([])
    // ...then the one tick whose window crosses it: the next track's opening kick and bass are queued at once.
    ms += 50
    fake.currentTime = ms / 1000
    timers.fire()
    const opening = played.filter((p) => p.e.at >= breakEnd - 1e-9)
    expect(opening.map((p) => [p.e.inst, r(p.e.at)])).toEqual([['kick', r(breakEnd)], ['bass', r(breakEnd)]])
  })

  it('never repeats a track within two picks in a pool of four', () => {
    const { player, played, advance } = setup({ scene: STUDIO })
    player.start()
    advance(300_000)
    const ids = heard(played).map((t) => t.id)
    expect(ids.length).toBeGreaterThanOrEqual(10)
    expect(new Set(ids)).toEqual(new Set(['a', 'b', 'c', 'd']))
    for (let i = 0; i < ids.length; i++) {
      expect(ids.slice(Math.max(0, i - 2), i)).not.toContain(ids[i])
    }
  })

  it('keeps its voices pruned over 300 s of ticks', () => {
    const { fake, timers, player, played, advance } = setup({ scene: STUDIO })
    player.start()
    advance(300_000)
    expect(played.length).toBeGreaterThan(100)
    // A frozen stop finishes the Loop at once, stopping every voice it still holds: only the ones not yet ended.
    fake.state = 'suspended'
    player.stop()
    timers.fire()
    const held = played.filter((p) => p.stopped.length > 0)
    expect(held.length).toBeLessThanOrEqual(6)
    for (const p of held) expect(p.e.at + p.e.dur).toBeGreaterThan(300)
  })

  it('reads a season change at the next pick, leaving the playing track alone', () => {
    const { player, played, advance, fades } = setup({ scene: STUDIO })
    player.start()
    advance(1000)
    player.setScene({ ...STUDIO, season: 'summer' })
    expect(fades()).toHaveLength(7)
    advance(29_000)
    const [first, second] = heard(played)
    expect(first.origin).toBe(0)
    // The first track plays to its end and its break runs in full before the new pool's track.
    expect(r(second.origin)).toBe(r(SECONDS + breakSeconds(SEED, 1)))
    expect(second.id).toBe('c')
  })

  it('plays a pinned track at every pick with 2 s breaks, and the pool again once unpinned', () => {
    const { player, played, advance } = setup({ scene: STUDIO })
    player.pin('d')
    player.start()
    advance(17_000)
    expect(heard(played).map((t) => [t.id, t.origin])).toEqual([['d', 0], ['d', 6], ['d', 12]])
    player.pin(null)
    advance(30_000)
    const later = heard(played).slice(3)
    expect(later[0].origin).toBe(18) // the break already under way stays a pinned one
    expect(later[0].id).not.toBe('d')
  })
})

describe('music player: stop, restart and the session', () => {
  it('stops by fading every fade from where it is to 0 over 0.4 s, then releases voices, session and timer', () => {
    const { fake, player, timers, played, advance, fades, gate } = setup()
    player.start()
    advance(1000)
    player.stop()
    for (const f of fades()) {
      expect(trace(f.gain).slice(-2)).toEqual([
        ['cancelAndHoldAtTime', null, 1],
        ['linearRampToValueAtTime', 0, 1.4],
      ])
    }
    expect(trace(gate()!.gain).slice(-2)).toEqual([
      ['cancelAndHoldAtTime', null, 1],
      ['linearRampToValueAtTime', 0, 1.4],
    ])
    advance(400)
    // Nothing starts at or after the fade's end; the opening bass (0 to 1.8 s) still sounds and is cut at 1.4.
    for (const p of played) expect(p.e.at).toBeLessThan(1.4)
    const bass = played.find((p) => p.e.inst === 'bass')!
    expect(bass.stopped).toEqual([1.4])
    for (const f of fades()) expect(f.disconnected).toBe(true)
    expect(timers.live).toEqual([])
    // The session's sources all stop at the release, and the gate is left at 0.
    for (const s of fake.nodes.filter((n) => n instanceof FakeBufferSource)) expect(s.stops).toEqual([1.4])
    expect(trace(gate()!.gain).at(-1)).toEqual(['setValueAtTime', 0, 1.4])
  })

  it('starts a fresh Loop while the last one fades, reusing the session, and cleans the old one up', () => {
    const { player, timers, played, advance, fades, gate, lfos } = setup()
    player.start()
    advance(1000)
    player.stop()
    advance(100)
    player.start()
    const all = fades()
    expect(all).toHaveLength(14)
    const [old, fresh] = [all.slice(0, 7), all.slice(7)]
    for (const f of fresh) {
      expect(trace(f.gain)).toEqual([
        ['value', 0, null],
        ['setValueAtTime', 0, 1.1],
        ['linearRampToValueAtTime', 1, 3.1],
      ])
    }
    const opening = played.filter((p) => p.e.at >= 1.1)
    expect(opening.map((p) => [p.e.inst, p.e.at])).toEqual([['kick', 1.1], ['bass', 1.1]])
    for (const p of opening) expect(fresh).toContain(p.out)
    // The gate reopens from where its fade had got to; the session is not doubled.
    expect(trace(gate()!.gain).slice(-2)).toEqual([
      ['cancelAndHoldAtTime', null, 1.1],
      ['linearRampToValueAtTime', 1, 3.1],
    ])
    expect(lfos()).toHaveLength(1)
    advance(300)
    for (const f of old) expect(f.disconnected).toBe(true)
    for (const f of fresh) expect(f.disconnected).toBe(false)
    expect(timers.live).toEqual([50])
    expect(lfos()[0].stops).toEqual([])
  })

  it('opens a new session after a full stop, on the chain built at the first start', () => {
    const { fake, player, advance, lfos } = setup()
    player.start()
    advance(500)
    player.stop()
    advance(500)
    player.start()
    expect(lfos()).toHaveLength(2)
    expect(lfos()[0].stops).toEqual([0.9])
    expect(fake.nodes.filter((n) => n instanceof FakeConvolver)).toHaveLength(1)
  })

  it('ignores start while playing and stop while stopped', () => {
    const { player, timers, played, fades, lfos } = setup()
    player.start()
    player.start()
    expect(played).toHaveLength(2)
    expect(fades()).toHaveLength(7)
    expect(lfos()).toHaveLength(1)
    expect(timers.live).toEqual([50])
    player.stop()
    player.stop()
    const ramps = fades()[0].gain.events.filter((e) => e.kind === 'linearRampToValueAtTime')
    expect(ramps).toHaveLength(2) // the fade in and one fade out
  })

  it('ends a fade at once when the context is suspended, so no timer runs while muted', () => {
    const { fake, player, timers, played, fades } = setup()
    player.start()
    player.stop()
    fake.state = 'suspended'
    timers.fire()
    for (const f of fades()) expect(f.disconnected).toBe(true)
    for (const p of played) expect(p.stopped).toEqual([0])
    expect(timers.live).toEqual([])
  })

  it('keeps a playing Loop through a suspension: its clock is frozen, so nothing piles up', () => {
    const { fake, player, timers, played } = setup()
    player.start()
    fake.state = 'suspended'
    for (let i = 0; i < 20; i++) timers.fire()
    expect(played).toHaveLength(2)
    expect(timers.live).toEqual([50])
  })

  it('clears its timer on dispose', () => {
    const { player, timers } = setup()
    player.start()
    player.dispose()
    expect(timers.live).toEqual([])
  })
})

describe('music player: segments, the edge cases', () => {
  it('starts the break at the jumped-to time after a stall across a track end', () => {
    const { fake, timers, player, played } = setup()
    player.start()
    fake.currentTime = 4.1
    timers.fire()
    const breakEnd = 4.1 + breakSeconds(SEED, 1)
    for (let ms = 4150; ms / 1000 < breakEnd + 1; ms += 50) {
      fake.currentTime = ms / 1000
      timers.fire()
    }
    // Nothing between the first window and the next track: the skipped end of the first is not played late.
    expect(played.filter((p) => p.e.at >= 0.2 && p.e.at < breakEnd - 1e-9)).toEqual([])
    expect(r(heard(played)[1].origin)).toBe(r(breakEnd))
  })

  it('never chains a fading Loop into its next segment', () => {
    const { player, played, advance, advanceTo, loopOf } = setup()
    player.start()
    const breakEnd = SECONDS + breakSeconds(SEED, 1)
    advanceTo(breakEnd - 0.5)
    const flip = played.length
    player.setScene(WINTER)
    advance(3000)
    // The old Loop was in its break: had it chained, it would have opened a track at the break's end.
    const after = played.slice(flip)
    expect(after.length).toBeGreaterThan(0)
    for (const p of after) expect(loopOf(p)).toBe(1)
  })
})

describe('music player: the mood crossfade', () => {
  it('crossfades on a mood change: the old fades reach 0 at now + 1.5, the new rise 0 to 1', () => {
    const { player, played, advance, loops, loopOf } = setup()
    player.start()
    advance(1000)
    player.setScene(WINTER)
    const [old, fresh] = loops()
    expect(fresh).toHaveLength(7)
    for (const f of old) {
      expect(trace(f.gain).slice(-2)).toEqual([
        ['cancelAndHoldAtTime', null, 1],
        ['linearRampToValueAtTime', 0, 2.5],
      ])
    }
    for (const f of fresh) {
      expect(trace(f.gain)).toEqual([
        ['value', 0, null],
        ['setValueAtTime', 0, 1],
        ['linearRampToValueAtTime', 1, 2.5],
      ])
    }
    // The new pool's track (winter: d) opens at once in the new Loop.
    const opening = played.filter((p) => loopOf(p) === 1)
    expect(opening.map((p) => [p.e.inst, p.e.at])).toEqual([['kick', 1], ['bass', 1]])
    expect(ID_OF_PC[opening[1].e.midi % 12]).toBe('d')
    advance(1500)
    for (const f of old) expect(f.disconnected).toBe(true)
    for (const f of fresh) expect(f.disconnected).toBe(false)
  })

  it('cuts a break short on a mood change', () => {
    const { player, played, advance, loopOf } = setup()
    player.start()
    advance(6000) // in the first break (4 s to at least 12 s)
    player.setScene(WINTER)
    const opening = played.filter((p) => loopOf(p) === 1)
    expect(opening.map((p) => [p.e.inst, p.e.at])).toEqual([['kick', 6], ['bass', 6]])
  })

  it('replaces a Loop younger than 0.5 s with a 50 ms fade', () => {
    const { player, advance, loops } = setup()
    player.start()
    advance(200)
    player.setScene(WINTER)
    const [old, fresh] = loops()
    for (const f of old) {
      expect(trace(f.gain).slice(-2)).toEqual([
        ['cancelAndHoldAtTime', null, 0.2],
        ['linearRampToValueAtTime', 0, 0.25],
      ])
    }
    for (const f of fresh) expect(trace(f.gain).at(-1)).toEqual(['linearRampToValueAtTime', 1, 1.7])
    advance(50)
    for (const f of old) expect(f.disconnected).toBe(true)
  })

  it('creates no nodes on a mood change while stopped', () => {
    const { fake, player, advance } = setup()
    player.setScene(WINTER)
    expect(fake.nodes).toHaveLength(1)
    player.start()
    advance(1000)
    player.stop()
    advance(500)
    const made = fake.nodes.length
    player.setScene(TITLE)
    player.setScene({ ...WINTER, calm: true })
    expect(fake.nodes).toHaveLength(made)
  })

  it('shortens crossfade-outs on stop', () => {
    const { player, advance, loops } = setup()
    player.start()
    advance(1000)
    player.setScene(WINTER)
    advance(100)
    player.stop()
    const [old, fresh] = loops()
    for (const f of old) {
      expect(trace(f.gain).slice(-4)).toEqual([
        ['cancelAndHoldAtTime', null, 1],
        ['linearRampToValueAtTime', 0, 2.5],
        ['cancelAndHoldAtTime', null, 1.1],
        ['linearRampToValueAtTime', 0, 1.5],
      ])
    }
    for (const f of fresh) expect(trace(f.gain).at(-1)).toEqual(['linearRampToValueAtTime', 0, 1.5])
  })

  it('keeps at most 2 Loops fading, cutting the oldest to a 50 ms fade', () => {
    const { player, advance, loops } = setup()
    player.start()
    advance(600)
    player.setScene(WINTER)
    advance(600)
    player.setScene(TITLE)
    advance(600)
    // Loops 0 (to 2.1) and 1 (to 2.7) are fading; a third flip would make three.
    player.setScene(WINTER)
    const [l0, l1, l2] = loops()
    for (const f of l0) {
      expect(trace(f.gain).slice(-2)).toEqual([
        ['cancelAndHoldAtTime', null, 1.8],
        ['linearRampToValueAtTime', 0, 1.85],
      ])
    }
    for (const f of l1) expect(trace(f.gain).at(-1)).toEqual(['linearRampToValueAtTime', 0, 2.7])
    for (const f of l2) expect(trace(f.gain).at(-1)).toEqual(['linearRampToValueAtTime', 0, 3.3])
    advance(50)
    for (const f of l0) expect(f.disconnected).toBe(true)
    for (const f of l1) expect(f.disconnected).toBe(false)
  })
})

describe('music player: calm', () => {
  it('glides the buses and tone into calm with tau 0.8, leaving the room and the Loop alone', () => {
    const { player, advance, fades, bus, tone, send } = setup({ scene: STUDIO })
    player.start()
    advance(1000)
    player.setScene({ ...STUDIO, calm: true })
    expect(fades()).toHaveLength(7)
    const glide = (value: number) => ({ kind: 'setTargetAtTime', value, time: 1, timeConstant: 0.8 })
    expect(bus('kick').gain.events.at(-1)).toEqual(glide(0))
    expect(bus('shaker').gain.events.at(-1)).toEqual(glide(0))
    expect(bus('lead').gain.events.at(-1)).toEqual(glide(0.6))
    expect(bus('keys').gain.events.at(-1)).toEqual(glide(1))
    expect(tone().frequency.events.at(-1)).toEqual(glide(1300))
    expect(send().gain.target).toBe(0.3)
  })

  it('skips drum events 3 s into calm, and resumes them on the tick after calm ends with tau 0.4', () => {
    const { fake, player, played, advance, advanceTo, bus } = setup({ scene: STUDIO })
    player.start()
    advance(1000)
    player.setScene({ ...STUDIO, calm: true })
    const second = SECONDS + breakSeconds(SEED, 1)
    advanceTo(second + 1.3)
    const kicks = played.filter((p) => p.e.inst === 'kick').map((p) => p.e.at)
    // The first track's kicks (its second bar opens on its last, at 2) were queued inside the settle; the second
    // track has none, though its bass plays.
    expect(kicks).toEqual([0, 0.5, 1, 1.5, 2])
    expect(played.some((p) => p.e.inst === 'bass' && p.e.at >= second - 1e-9)).toBe(true)
    const off = fake.currentTime
    player.setScene(STUDIO)
    expect(bus('kick').gain.events.at(-1)).toEqual({ kind: 'setTargetAtTime', value: 0.6, time: off, timeConstant: 0.4 })
    // The next tick's window reaches the kick at 1.5 s into the track.
    advance(50)
    const resumed = played.filter((p) => p.e.inst === 'kick' && p.e.at > second)
    expect(resumed.map((p) => r(p.e.at))).toEqual([r(second + 1.5)])
  })

  it('carries a calm change into the glide of a track already queued but not yet started', () => {
    const { player, advanceTo, bus } = setup({ scene: STUDIO })
    player.start()
    const second = SECONDS + breakSeconds(SEED, 1)
    advanceTo(second - 0.1) // the look-ahead has created the second track's segment
    player.setScene({ ...STUDIO, calm: true })
    const atStart = bus('kick').gain.events.filter((e) => e.kind === 'setTargetAtTime' && r(e.time) === r(second))
    expect(atStart.at(-1)).toMatchObject({ value: 0 })
  })
})

describe('music player: the pin', () => {
  it('crossfades to a pinned track now, repeats it with 2 s breaks, and returns to the pool once unpinned', () => {
    const { player, played, advance, loops, loopOf } = setup({ scene: STUDIO })
    player.start()
    advance(1000)
    player.pin('d')
    for (const f of loops()[1]) expect(trace(f.gain).at(-1)).toEqual(['linearRampToValueAtTime', 1, 2.5])
    // A mood change while pinned does not crossfade.
    player.setScene(TITLE)
    player.setScene(STUDIO)
    expect(loops()).toHaveLength(2)
    advance(16_000)
    const pinnedLoop = () => played.filter((p) => loopOf(p) === 1)
    expect(heard(pinnedLoop()).map((t) => [t.id, t.origin])).toEqual([['d', 1], ['d', 7], ['d', 13]])
    player.pin(null)
    expect(loops()).toHaveLength(2)
    advance(30_000)
    const later = heard(pinnedLoop()).slice(3)
    expect(later[0].origin).toBe(19) // the break already under way stays a pinned one
    expect(later[0].id).not.toBe('d')
  })
})
