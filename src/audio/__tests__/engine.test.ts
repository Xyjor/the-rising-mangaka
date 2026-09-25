import { describe, expect, it, vi } from 'vitest'
import { createSoundEngine } from '../engine'
import { DEFAULT_SOUND } from '../types'
import {
  FakeAudioContext, FakeBiquad, FakeBufferSource, FakeCompressor, FakeGain, FakeOscillator, asContext,
} from './fakeAudio'

function setup(o: { state?: AudioContextState; resumes?: boolean } = {}) {
  let clock = 0
  const fake = new FakeAudioContext(o)
  const createContext = vi.fn(() => asContext(fake))
  const engine = createSoundEngine({ createContext, now: () => clock })
  return { fake, engine, createContext, at: (ms: number) => { clock = ms } }
}

/** Finds the mixer by its wiring: master feeds the compressor, the lowpass and fx feed master, music feeds the lowpass. */
function mixer(fake: FakeAudioContext) {
  const gains = fake.nodes.filter((n): n is FakeGain => n instanceof FakeGain)
  const comp = fake.nodes.find((n): n is FakeCompressor => n instanceof FakeCompressor)!
  const master = gains.find((g) => g.connections.includes(comp))!
  const lowpass = fake.nodes.find((n): n is FakeBiquad => n instanceof FakeBiquad && n.connections.includes(master))!
  const fx = gains.find((g) => g.connections.includes(master))!
  const music = gains.find((g) => g.connections.includes(lowpass))!
  return { comp, master, lowpass, fx, music }
}

const MUTED = { ...DEFAULT_SOUND, muted: true }

describe('sound engine', () => {
  it('creates no context and plays nothing before the first unlock', () => {
    const { engine, createContext } = setup()
    const stop = engine.play('click')
    expect(typeof stop).toBe('function')
    stop()
    expect(createContext).not.toHaveBeenCalled()
    expect(engine.unlocked).toBe(false)
  })

  it('creates one context however often it is unlocked', () => {
    const { engine, createContext } = setup()
    engine.unlock()
    engine.unlock()
    expect(createContext).toHaveBeenCalledTimes(1)
    expect(engine.unlocked).toBe(true)
  })

  it('mixes fx at 0.8 and lowpassed music at 0.5 into a compressed master at 0.25 for volume 0.5', () => {
    const { fake, engine } = setup()
    expect(engine.levels()).toEqual({ master: 0.25, fx: 0.8, music: 0.5 })
    engine.unlock()
    const m = mixer(fake)
    expect(m.comp.connections).toEqual([fake.destination])
    expect(m.master.gain.target).toBe(0.25)
    expect(m.fx.gain.target).toBe(0.8)
    expect(m.music.gain.target).toBe(0.5)
    expect(m.lowpass.type).toBe('lowpass')
    expect(m.lowpass.frequency.target).toBe(1800)
  })

  it('plays cues through the fx bus', () => {
    const { fake, engine } = setup()
    engine.unlock()
    engine.play('click')
    const [osc] = fake.sources
    expect(osc).toBeInstanceOf(FakeOscillator)
    const env = osc.connections[0]
    expect(env.connections).toEqual([mixer(fake).fx])
  })

  it('muting zeroes the master, suspends the context and makes plays create nothing', () => {
    const { fake, engine } = setup()
    engine.unlock()
    engine.setPrefs(MUTED)
    expect(fake.calls).toEqual(['suspend'])
    expect(mixer(fake).master.gain.target).toBe(0)
    expect(engine.levels().master).toBe(0)
    const nodes = fake.nodes.length
    engine.play('click')
    engine.play('drumroll')
    expect(fake.nodes.length).toBe(nodes)
  })

  it('unmuting resumes the context and restores the master', () => {
    const { fake, engine } = setup()
    engine.unlock()
    engine.setPrefs(MUTED)
    engine.setPrefs(DEFAULT_SOUND)
    expect(fake.calls).toEqual(['suspend', 'resume'])
    expect(mixer(fake).master.gain.target).toBe(0.25)
    engine.play('click')
    expect(fake.sources).toHaveLength(1)
  })

  it('unlocking while muted builds a silent mixer and suspends it', () => {
    const { fake, engine } = setup()
    engine.setPrefs(MUTED)
    engine.unlock()
    expect(engine.unlocked).toBe(true)
    expect(mixer(fake).master.gain.target).toBe(0)
    expect(fake.calls).toEqual(['suspend'])
  })

  it('glides the master to a new volume', () => {
    const { fake, engine } = setup()
    engine.unlock()
    engine.setPrefs({ ...DEFAULT_SOUND, volume: 1 })
    const gain = mixer(fake).master.gain
    expect(gain.target).toBe(1)
    expect(gain.events.at(-1)?.kind).toBe('setTargetAtTime')
    expect(engine.levels().master).toBe(1)
  })

  it('holds page for 600 ms: plays at 0, not at 300, again at 600', () => {
    const { fake, engine, at } = setup()
    engine.unlock()
    engine.play('page')
    at(300)
    engine.play('page')
    expect(fake.sources).toHaveLength(1)
    at(600)
    engine.play('page')
    expect(fake.sources).toHaveLength(2)
  })

  it('does not start the gap on a refused play', () => {
    const { fake, engine, at } = setup()
    engine.unlock()
    engine.setPrefs(MUTED)
    engine.play('page')
    engine.setPrefs(DEFAULT_SOUND)
    at(100)
    engine.play('page')
    expect(fake.sources).toHaveLength(1)
  })

  it('takes the page vary offsets in turn', () => {
    const { fake, engine, at } = setup()
    engine.unlock()
    for (const ms of [0, 600, 1200, 1800]) {
      at(ms)
      engine.play('page')
    }
    const rates = (fake.sources as FakeBufferSource[]).map((s) => s.playbackRate.target)
    // 2^(-1/12), 1, 2^(1/12), then round again.
    expect(rates[0]).toBeCloseTo(0.943874, 6)
    expect(rates[1]).toBe(1)
    expect(rates[2]).toBeCloseTo(1.059463, 6)
    expect(rates[3]).toBeCloseTo(0.943874, 6)
  })

  it('shifts every voice by the pitch option', () => {
    const { fake, engine } = setup()
    engine.unlock()
    engine.play('bar', { pitch: 12 })
    const [osc] = fake.sources as FakeOscillator[]
    // C5 (523.2511 Hz) an octave up is C6.
    expect(osc.frequency.events[0]).toMatchObject({ kind: 'setValueAtTime' })
    expect(osc.frequency.target).toBeCloseTo(1046.502, 3)
  })

  it('caps 40 same-instant plays at 24 voices', () => {
    const { fake, engine, at } = setup()
    engine.unlock()
    for (let i = 0; i < 40; i++) engine.play('bar')
    expect(fake.sources).toHaveLength(24)
    at(100) // every 70 ms bar has ended
    engine.play('bar')
    expect(fake.sources).toHaveLength(25)
  })

  it('caps by the voices sounding together, not by the voices in a cue', () => {
    const { fake, engine } = setup()
    engine.unlock()
    for (let i = 0; i < 40; i++) engine.play('fanfare')
    // Fanfare: four 80 ms squares one after another (0-0.08, 0.09-0.17, 0.18-0.26, 0.27-0.35 s), then three voices
    // together from 0.36 s (C6 to 0.86, C4 and G4 to 0.91). Its peak is 3, so 8 fanfares peak at 24 and a 9th would
    // make 27. 8 fanfares of 7 voices each is 56 sources.
    expect(fake.sources).toHaveLength(8 * 7)
  })

  it('plays bars over a drumroll: drumroll at 150 ms, bars at 350 and 600 ms', () => {
    const { fake, engine, at } = setup()
    engine.unlock()
    at(150)
    engine.play('drumroll')
    at(350)
    engine.play('bar')
    at(600)
    engine.play('bar')
    expect(fake.sources).toHaveLength(32)
  })

  it('starts a drumroll while a chapter cue is still sounding', () => {
    const { fake, engine, at } = setup()
    engine.unlock()
    engine.play('chapter')
    at(100) // the chapter's last note sounds until 420 ms
    engine.play('drumroll')
    expect(fake.sources).toHaveLength(3 + 30)
  })

  it('plays for 300 ms after unlock while resume is pending, then waits for a running context', () => {
    const { fake, engine, at } = setup({ state: 'suspended', resumes: false })
    at(1000)
    engine.unlock()
    expect(fake.calls).toEqual(['resume'])
    at(1300)
    engine.play('click')
    expect(fake.sources).toHaveLength(1)
    const nodes = fake.nodes.length
    at(1301)
    engine.play('bar')
    expect(fake.nodes.length).toBe(nodes)
    fake.state = 'running'
    at(5000)
    engine.play('bar')
    expect(fake.sources).toHaveLength(2)
  })

  it('stops a drumroll: every hit stops now and its voices are freed', () => {
    const { fake, engine } = setup()
    engine.unlock()
    const stop = engine.play('drumroll')
    const hits = fake.sources
    expect(hits).toHaveLength(30)
    expect(hits[29].stops.at(-1)).toBeCloseTo(2.08, 6)
    fake.currentTime = 0.5
    stop()
    for (const hit of hits) expect(hit.stops.at(-1)).toBeCloseTo(0.55, 6)
    // The clock is still at 0 ms, where the first hit would sound: unstopped, only 23 bars would fit beside it.
    for (let i = 0; i < 24; i++) engine.play('bar')
    expect(fake.sources).toHaveLength(30 + 24)
  })

  it('restarts the grace when unmuting, so a cue played right away is scheduled while resume is pending', () => {
    const { fake, engine, at } = setup({ resumes: false })
    engine.unlock()
    at(5000)
    engine.setPrefs(MUTED)
    engine.setPrefs(DEFAULT_SOUND)
    expect(fake.state).toBe('suspended')
    engine.play('click')
    expect(fake.sources).toHaveLength(1)
    at(5301)
    engine.play('bar')
    expect(fake.sources).toHaveLength(1)
  })

  it('restarts the grace on resume()', () => {
    const { fake, engine, at } = setup({ resumes: false })
    engine.unlock()
    engine.suspend()
    at(9000)
    engine.resume()
    engine.play('click')
    expect(fake.sources).toHaveLength(1)
  })

  it('turns the music bus off with the music pref and ducks it by level', () => {
    const { fake, engine } = setup()
    engine.unlock()
    const music = mixer(fake).music.gain
    engine.duck(0.4)
    expect(music.target).toBeCloseTo(0.2, 9)
    expect(engine.levels().music).toBe(0.5)
    engine.setPrefs({ ...DEFAULT_SOUND, music: false })
    expect(music.target).toBe(0)
    expect(engine.levels().music).toBe(0)
    engine.setPrefs(DEFAULT_SOUND)
    expect(music.target).toBeCloseTo(0.2, 9)
    engine.duck(1)
    expect(music.target).toBe(0.5)
  })

  it('lets music start and stop at any time without making sound yet', () => {
    const { fake, engine } = setup()
    engine.stopMusic()
    engine.startMusic()
    engine.unlock()
    const nodes = fake.nodes.length
    engine.startMusic()
    engine.stopMusic()
    engine.stopMusic()
    expect(fake.nodes.length).toBe(nodes)
  })

  it('passes suspend and resume through to the context, but stays suspended while muted', () => {
    const { fake, engine } = setup()
    engine.suspend()
    engine.resume()
    engine.unlock()
    engine.suspend()
    engine.resume()
    expect(fake.calls).toEqual(['suspend', 'resume'])
    engine.setPrefs(MUTED)
    engine.resume()
    expect(fake.calls).toEqual(['suspend', 'resume', 'suspend'])
  })

  it('closes the context on dispose and stays locked after', () => {
    const { fake, engine, createContext } = setup()
    engine.unlock()
    engine.dispose()
    expect(fake.calls).toEqual(['close'])
    expect(engine.unlocked).toBe(false)
    const nodes = fake.nodes.length
    engine.unlock()
    engine.play('click')
    expect(createContext).toHaveBeenCalledTimes(1)
    expect(fake.nodes.length).toBe(nodes)
  })

  it('stays locked when no context can be created', () => {
    const createContext = vi.fn(() => null)
    const engine = createSoundEngine({ createContext, now: () => 0 })
    engine.unlock()
    engine.unlock()
    expect(engine.unlocked).toBe(false)
    expect(createContext).toHaveBeenCalledTimes(1)
    engine.play('click')()
  })
})
