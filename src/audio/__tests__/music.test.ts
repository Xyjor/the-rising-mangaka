import { describe, expect, it } from 'vitest'
import { BASS, LEAD, LOOP_SECONDS, MUSIC_BPM, STEPS, createMusicPlayer, eventsInWindow, stepSeconds } from '../music'
import { FakeAudioContext, FakeGain, FakeOscillator, FakeParam, asContext } from './fakeAudio'
import { FakeTimers } from './fakeTimers'

const r = (x: number) => Math.round(x * 1e6) / 1e6
const trace = (p: FakeParam) =>
  p.events.map((e) => [e.kind, 'value' in e ? r(e.value) : null, 'time' in e ? r(e.time) : null])
/** Events with their times rounded, for comparing against hand-derived literals. */
const rounded = (from: number, to: number) =>
  eventsInWindow(from, to).map((e) => ({ part: e.part, midi: e.midi, at: r(e.at), dur: r(e.dur) }))

const _ = null

describe('music data', () => {
  it('runs at 84 BPM in eighth-note steps: 30/84 s a step, 64 steps a loop', () => {
    expect(MUSIC_BPM).toBe(84)
    expect(STEPS).toBe(64)
    expect(stepSeconds(84)).toBeCloseTo(0.357143, 6)
    expect(stepSeconds(120)).toBeCloseTo(0.25, 9)
    // 64 x 30/84 = 160/7
    expect(LOOP_SECONDS).toBeCloseTo(22.857143, 6)
  })

  it('writes the lead out as the brief scores it', () => {
    expect(LEAD).toEqual([
      76, _, 79, _, 81, _, 79, _, 76, _, 74, _, 72, _, _, _, 72, _, 76, _, 81, _, 79, _, 76, _, _, _, _, _, _, _,
      81, _, 84, _, 81, _, 79, _, 76, _, 79, _, 81, _, _, _, 79, _, 81, _, 79, _, 76, _, 74, _, _, _, _, _, _, _,
    ])
  })

  it('plays the bass root on step 0 and the fifth on step 4 of each chord: C C Am Am F F G G', () => {
    expect(BASS).toHaveLength(64)
    expect([BASS[0], BASS[4], BASS[16], BASS[36], BASS[60]]).toEqual([48, 55, 45, 48, 50])
    expect(BASS).toEqual([
      48, _, _, _, 55, _, _, _, 48, _, _, _, 55, _, _, _, 45, _, _, _, 52, _, _, _, 45, _, _, _, 52, _, _, _,
      41, _, _, _, 48, _, _, _, 41, _, _, _, 48, _, _, _, 43, _, _, _, 50, _, _, _, 43, _, _, _, 50, _, _, _,
    ])
  })

  it('finds the notes in a window, each lasting min(steps to the next, 4) steps x 0.9', () => {
    // Lead 76 to 79 is 2 steps: 2 x 30/84 x 0.9. Bass 48 to 55 is 4 steps.
    expect(rounded(0, 0.3)).toEqual([
      { part: 'lead', midi: 76, at: 0, dur: 0.642857 },
      { part: 'bass', midi: 48, at: 0, dur: 1.285714 },
    ])
    expect(rounded(0.3, 0.8)).toEqual([{ part: 'lead', midi: 79, at: 0.714286, dur: 0.642857 }])
  })

  it('holds the last lead note for 4 steps, not the 8 to the top of the loop', () => {
    // Step 56 is at 56 x 30/84 = 20 s: lead 74 and the G bar's root 43.
    expect(rounded(19.9, 20.1)).toEqual([
      { part: 'lead', midi: 74, at: 20, dur: 1.285714 },
      { part: 'bass', midi: 43, at: 20, dur: 1.285714 },
    ])
  })

  it('wraps into the next loop, in seconds from the first loop origin', () => {
    expect(rounded(22.8, 22.9)).toEqual([
      { part: 'lead', midi: 76, at: 22.857143, dur: 0.642857 },
      { part: 'bass', midi: 48, at: 22.857143, dur: 1.285714 },
    ])
  })

  it('is half-open: a note on the end of one window belongs to the next', () => {
    expect(eventsInWindow(22.8, LOOP_SECONDS)).toEqual([])
    expect(eventsInWindow(LOOP_SECONDS, 22.9).map((e) => e.midi)).toEqual([76, 48])
    expect(eventsInWindow(0.5, 0.5)).toEqual([])
  })
})

function setup(o: { state?: AudioContextState } = {}) {
  const fake = new FakeAudioContext(o)
  const timers = new FakeTimers()
  const dest = fake.createGain()
  const player = createMusicPlayer(asContext(fake), dest as unknown as AudioNode, timers)
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
  const oscillators = () => fake.sources as FakeOscillator[]
  /** The gains that feed dest: one fade per loop start. */
  const fades = () => fake.nodes.filter((n): n is FakeGain => n instanceof FakeGain && n.connections.includes(dest))
  return { fake, timers, dest, player, advance, oscillators, fades }
}

/** The envelope an oscillator feeds. */
const envOf = (osc: FakeOscillator) => osc.connections[0] as FakeGain

describe('music player', () => {
  it('starts at step 0 behind its own fade (0 to 1 over 2 s) and schedules the first window at once', () => {
    const { player, timers, oscillators, fades } = setup()
    player.start()
    expect(timers.live).toEqual([50])
    const [fade] = fades()
    expect(fades()).toHaveLength(1)
    expect(trace(fade.gain)).toEqual([
      ['value', 0, null],
      ['setValueAtTime', 0, 0],
      ['linearRampToValueAtTime', 1, 2],
    ])
    const [lead, bass] = oscillators()
    expect(oscillators()).toHaveLength(2)
    expect([lead.type, bass.type]).toEqual(['triangle', 'sine'])
    expect(lead.frequency.target).toBeCloseTo(659.255, 3) // MIDI 76, E5
    expect(bass.frequency.target).toBeCloseTo(130.813, 3) // MIDI 48, C3
    for (const osc of [lead, bass]) {
      expect(osc.starts).toEqual([0])
      expect(envOf(osc).connections).toEqual([fade])
    }
  })

  it('shapes each note: a 10 ms attack, a fall to half, a release to 0 by its end, a stop just after', () => {
    const { player, oscillators } = setup()
    player.start()
    const [lead, bass] = oscillators()
    // Lead: peak 0.05 at 0.01, half by the end less 0.06 (0.642857 - 0.06), 0 at 0.642857, stop 0.02 after.
    expect(trace(envOf(lead).gain)).toEqual([
      ['value', 0, null],
      ['setValueAtTime', 0, 0],
      ['linearRampToValueAtTime', 0.05, 0.01],
      ['linearRampToValueAtTime', 0.025, 0.582857],
      ['linearRampToValueAtTime', 0, 0.642857],
    ])
    expect(lead.stops.map(r)).toEqual([0.662857])
    expect(trace(envOf(bass).gain)).toEqual([
      ['value', 0, null],
      ['setValueAtTime', 0, 0],
      ['linearRampToValueAtTime', 0.07, 0.01],
      ['linearRampToValueAtTime', 0.035, 1.225714],
      ['linearRampToValueAtTime', 0, 1.285714],
    ])
    expect(bass.stops.map(r)).toEqual([1.305714])
  })

  it('disconnects a note once it ends', () => {
    const { player, oscillators } = setup()
    player.start()
    const [lead] = oscillators()
    lead.end()
    expect([lead.disconnected, envOf(lead).disconnected]).toEqual([true, true])
  })

  it('looks 200 ms ahead on each 50 ms tick', () => {
    const { player, advance, oscillators } = setup()
    player.start()
    advance(500) // the tick at 0.5 s schedules up to 0.7 s; step 2 is at 0.714286
    expect(oscillators()).toHaveLength(2)
    advance(50)
    expect(oscillators()).toHaveLength(3)
    const step2 = oscillators()[2]
    expect(step2.starts.map(r)).toEqual([0.714286])
    expect(step2.frequency.target).toBeCloseTo(783.991, 3) // MIDI 79, G5
  })

  it('schedules each note of a loop once, then the loop again from the top', () => {
    const { player, advance, oscillators } = setup()
    player.start()
    // At 22.7 s the scheduler has reached 22.9 s: one whole loop (24 lead notes and 16 bass notes) and the next
    // loop's first step at 22.857143.
    advance(22700)
    expect(oscillators()).toHaveLength(42)
    const [lead, bass] = oscillators().slice(40)
    expect(lead.starts.map(r)).toEqual([22.857143])
    expect(bass.starts.map(r)).toEqual([22.857143])
    expect(lead.frequency.target).toBeCloseTo(659.255, 3)
    expect(bass.frequency.target).toBeCloseTo(130.813, 3)
  })

  it('skips ahead after a stall instead of playing the missed notes in a burst', () => {
    const { fake, timers, player, oscillators } = setup()
    player.start()
    fake.currentTime = 5.6
    timers.fire()
    // Only step 16 (5.714286 s) falls in 5.6 to 5.8: lead 72 and the Am bar's root 45.
    const fresh = oscillators().slice(2)
    expect(fresh).toHaveLength(2)
    for (const osc of fresh) expect(osc.starts.map(r)).toEqual([5.714286])
    expect(fresh[0].frequency.target).toBeCloseTo(523.251, 3)
    expect(fresh[1].frequency.target).toBeCloseTo(110, 6)
  })

  it('stops by fading from where it is to 0 over 0.4 s, then stops what still sounds and lets the timer go', () => {
    const { player, timers, advance, oscillators, fades } = setup()
    player.start()
    advance(1600)
    player.stop()
    const [fade] = fades()
    expect(trace(fade.gain).slice(-2)).toEqual([
      ['cancelAndHoldAtTime', null, 1.6],
      ['linearRampToValueAtTime', 0, 2],
    ])
    // By 1.6 s steps 0, 2 and 4 are scheduled (5 notes). Step 4 (1.428571 s) still sounds at 2 s: lead 81 until
    // 2.071429, bass 55 until 2.714286. Step 6 (2.142857 s) falls inside the 1.95 s look-ahead but after the fade, so
    // it never starts.
    advance(400)
    expect(oscillators()).toHaveLength(5)
    for (const osc of oscillators()) expect(osc.starts[0]).toBeLessThan(2)
    const [lead81, bass55] = oscillators().slice(3)
    expect(lead81.frequency.target).toBe(880)
    expect(lead81.stops.map(r)).toEqual([2.091429, 2])
    expect(bass55.stops.map(r)).toEqual([2.734286, 2])
    expect(fade.disconnected).toBe(true)
    expect(timers.live).toEqual([])
  })

  it('starts a fresh loop from the top while the last one fades, and cleans the old one up when its fade ends', () => {
    const { player, timers, advance, oscillators, fades } = setup()
    player.start()
    advance(1600)
    player.stop()
    advance(100)
    player.start()
    const [old, fresh] = fades()
    expect(fades()).toHaveLength(2)
    expect(trace(fresh.gain)).toEqual([
      ['value', 0, null],
      ['setValueAtTime', 0, 1.7],
      ['linearRampToValueAtTime', 1, 3.7],
    ])
    const [lead, bass] = oscillators().slice(-2)
    expect(lead.starts.map(r)).toEqual([1.7])
    expect(lead.frequency.target).toBeCloseTo(659.255, 3)
    expect(bass.frequency.target).toBeCloseTo(130.813, 3)
    expect(envOf(lead).connections).toEqual([fresh])
    advance(300)
    expect(old.disconnected).toBe(true)
    expect(fresh.disconnected).toBe(false)
    expect(timers.live).toEqual([50])
  })

  it('ignores start while playing and stop while stopped', () => {
    const { fake, player, timers, oscillators, fades } = setup()
    player.stop()
    expect(fake.nodes).toHaveLength(1) // only the test's dest
    expect(timers.live).toEqual([])
    player.start()
    player.start()
    expect(oscillators()).toHaveLength(2)
    expect(fades()).toHaveLength(1)
    expect(timers.live).toEqual([50])
    player.stop()
    player.stop()
    const ramps = fades()[0].gain.events.filter((e) => e.kind === 'linearRampToValueAtTime')
    expect(ramps).toHaveLength(2) // the fade in and one fade out
  })

  it('ends a fade at once when the context is suspended, so no timer runs while muted', () => {
    const { fake, player, timers, oscillators, fades } = setup()
    player.start()
    player.stop()
    fake.state = 'suspended'
    timers.fire()
    expect(fades()[0].disconnected).toBe(true)
    for (const osc of oscillators()) expect(osc.stops.at(-1)).toBe(0)
    expect(timers.live).toEqual([])
  })

  it('keeps a playing loop through a suspension: its clock is frozen, so nothing piles up', () => {
    const { fake, player, timers, oscillators } = setup()
    player.start()
    fake.state = 'suspended'
    for (let i = 0; i < 20; i++) timers.fire()
    expect(oscillators()).toHaveLength(2)
    expect(timers.live).toEqual([50])
  })

  it('clears its timer on dispose', () => {
    const { player, timers } = setup()
    player.start()
    player.dispose()
    expect(timers.live).toEqual([])
  })
})
