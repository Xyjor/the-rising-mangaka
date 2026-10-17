import { describe, expect, it, vi } from 'vitest'
import { createSoundEngine } from '../engine'
import type { MusicPlayer, PlayerOptions } from '../music/player'
import type { MusicScene } from '../music/types'
import { MUSIC_LOWPASS_HZ } from '../synth'
import { DEFAULT_SOUND } from '../types'
import {
  FakeAudioContext, FakeBiquad, FakeBufferSource, FakeCompressor, FakeGain, FakeNode, FakeOscillator, asContext,
} from './fakeAudio'
import { FakeTimers } from './fakeTimers'

function setup(o: { state?: AudioContextState; resumes?: boolean } = {}) {
  let clock = 0
  const fake = new FakeAudioContext(o)
  const timers = new FakeTimers()
  const createContext = vi.fn(() => asContext(fake))
  const engine = createSoundEngine({ createContext, now: () => clock, timers })
  return { fake, engine, createContext, timers, at: (ms: number) => { clock = ms } }
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
const STUDIO: MusicScene = { mood: 'studio', season: 'spring', calm: false }
const CALM: MusicScene = { mood: 'studio', season: 'spring', calm: true }

/** Every node `src` reaches by its node connections, stopping at (but including) `stop`. */
function reached(src: FakeNode, stop: FakeNode): Set<FakeNode> {
  const seen = new Set<FakeNode>()
  const walk = (n: FakeNode): void => {
    if (seen.has(n)) return
    seen.add(n)
    if (n !== stop) for (const next of n.connections) walk(next)
  }
  walk(src)
  return seen
}

/** A Loop's seven fades: gains set to 0 at time 0 that ramp to 1 over the player's 2 s fade-in. */
function loopFades(fake: FakeAudioContext): FakeGain[] {
  return fake.nodes.filter((n): n is FakeGain => n instanceof FakeGain
    && n.gain.events.some((e) => e.kind === 'setValueAtTime' && e.value === 0 && e.time === 0)
    && n.gain.events.some((e) => e.kind === 'linearRampToValueAtTime' && e.value === 1 && e.time === 2))
}

/** An engine whose player is a recorder: `log` names each call made on it in order, `created` each creation. */
function recorded(o: { seed: number }) {
  const fake = new FakeAudioContext()
  const log: string[] = []
  const created: { dest: AudioNode; graphMusic: FakeGain; o: PlayerOptions }[] = []
  const engine = createSoundEngine({
    createContext: () => asContext(fake),
    now: () => 0,
    timers: new FakeTimers(),
    seed: o.seed,
    createMusic: (_ctx, dest, _timers, po) => {
      created.push({ dest, graphMusic: mixer(fake).music, o: po })
      log.push('create')
      const player: MusicPlayer = {
        start: () => log.push('start'),
        stop: () => log.push('stop'),
        setScene: (s) => log.push(`scene ${s.mood} ${s.season}${s.calm ? ' calm' : ''}`),
        pin: (id) => log.push(`pin ${id}`),
        nudge: () => log.push('nudge'),
        dispose: () => log.push('dispose'),
      }
      return player
    },
  })
  return { engine, log, created, fake }
}

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
    expect(m.lowpass.frequency.target).toBe(MUSIC_LOWPASS_HZ)
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

  it('starts nothing on unlock when the music was never asked for, or asked for and withdrawn', () => {
    for (const ask of [false, true]) {
      const { fake, engine, timers } = setup()
      if (ask) {
        engine.startMusic()
        engine.stopMusic()
      }
      engine.unlock()
      expect(fake.sources).toEqual([])
      expect(timers.live).toEqual([])
    }
  })


  it('passes the seed and the scene set before unlock to the player it creates, then the pin', () => {
    const { engine, created, log } = recorded({ seed: 42 })
    engine.setMusicScene(STUDIO)
    engine.pinMusicTrack('kotatsu')
    expect(created).toEqual([])
    engine.unlock()
    expect(created).toHaveLength(1)
    expect(created[0].o).toEqual({ seed: 42, scene: STUDIO })
    expect(created[0].dest).toBe(created[0].graphMusic)
    expect(log).toEqual(['create', 'pin kotatsu'])
  })

  it('creates the player in the title scene, unpinned, when nothing was set', () => {
    const { engine, created, log } = recorded({ seed: 1 })
    engine.unlock()
    expect(created[0].o.scene).toEqual({ mood: 'title', season: 'spring', calm: false })
    expect(log).toEqual(['create'])
  })

  it('keeps only the last scene and pin set before unlock, and an unpin leaves the player unpinned', () => {
    const { engine, created, log } = recorded({ seed: 1 })
    engine.setMusicScene(STUDIO)
    engine.setMusicScene(CALM)
    engine.pinMusicTrack('kotatsu')
    engine.pinMusicTrack(null)
    engine.unlock()
    expect(created[0].o.scene).toEqual(CALM)
    expect(log).toEqual(['create'])
  })

  it('starts the player at creation when the music was asked for before unlock', () => {
    const { engine, log } = recorded({ seed: 1 })
    engine.pinMusicTrack('tea-break')
    engine.startMusic()
    engine.unlock()
    expect(log).toEqual(['create', 'pin tea-break', 'start'])
  })

  it('forwards start, stop, scenes and pins to the player once it exists', () => {
    const { engine, log } = recorded({ seed: 1 })
    engine.unlock()
    engine.startMusic()
    engine.setMusicScene(CALM)
    engine.pinMusicTrack('first-snow')
    engine.pinMusicTrack(null)
    engine.stopMusic()
    expect(log).toEqual(['create', 'start', 'scene studio spring calm', 'pin first-snow', 'pin null', 'stop'])
  })

  it('nudges the player once resume() has woken the context, so it schedules before its timer fires', async () => {
    const { engine, log, fake } = recorded({ seed: 1 })
    engine.unlock()
    engine.startMusic()
    fake.state = 'suspended'
    engine.resume()
    await Promise.resolve()
    expect(log).toEqual(['create', 'start', 'nudge'])
  })

  it('nudges the player when a later unlock wakes a suspended context, and never while muted', async () => {
    const { engine, log, fake } = recorded({ seed: 1 })
    engine.unlock()
    await Promise.resolve()
    expect(log).toEqual(['create'])
    fake.state = 'suspended'
    engine.unlock()
    await Promise.resolve()
    expect(log).toEqual(['create', 'nudge'])
    engine.setPrefs(MUTED)
    engine.resume()
    await Promise.resolve()
    expect(log).toEqual(['create', 'nudge'])
  })

  it('disposes the player, then closes the context', () => {
    const { engine, log, fake } = recorded({ seed: 1 })
    engine.unlock()
    fake.close = (() => {
      log.push('close')
      return Promise.resolve()
    }) as typeof fake.close
    engine.dispose()
    expect(log).toEqual(['create', 'dispose', 'close'])
    engine.startMusic()
    engine.setMusicScene(STUDIO)
    engine.pinMusicTrack('kotatsu')
    expect(log).toEqual(['create', 'dispose', 'close'])
  })

  it('routes every music source through the music bus, never straight to the master', () => {
    const { fake, engine, timers } = setup()
    engine.startMusic()
    engine.unlock()
    for (let i = 1; i <= 20; i++) {
      fake.currentTime = i * 0.05
      timers.fire()
    }
    const m = mixer(fake)
    expect(fake.sources.length).toBeGreaterThan(0)
    let throughMusic = 0
    for (const src of fake.sources) {
      const above = reached(src, m.music)
      for (const bypass of [m.master, m.lowpass, m.comp, fake.destination]) expect(above.has(bypass)).toBe(false)
      if (above.has(m.music)) throughMusic++
    }
    expect(throughMusic).toBeGreaterThan(0)
  })

  it('plays one Loop however often startMusic is called', () => {
    const { fake, engine, timers } = setup()
    engine.startMusic()
    engine.startMusic()
    engine.unlock()
    engine.startMusic()
    expect(loopFades(fake)).toHaveLength(7)
    expect(timers.live).toEqual([50])
  })

  it('stopMusic fades the Loop to 0 over 0.4 s and leaves the music bus to prefs and duck', () => {
    const { fake, engine } = setup()
    engine.unlock()
    engine.startMusic()
    const { music } = mixer(fake)
    const fades = loopFades(fake)
    expect(fades).toHaveLength(7)
    const busEvents = music.gain.events.length
    fake.currentTime = 1
    engine.stopMusic()
    for (const fade of fades) {
      expect(fade.gain.events.at(-1)).toEqual({ kind: 'linearRampToValueAtTime', value: 0, time: 1.4 })
    }
    expect(music.gain.events).toHaveLength(busEvents)
  })

  it('clears the music timer on dispose, closes the context and starts nothing after', () => {
    const { fake, engine, timers } = setup()
    engine.startMusic()
    engine.unlock()
    engine.dispose()
    expect(timers.live).toEqual([])
    expect(fake.calls).toEqual(['close'])
    engine.startMusic()
    expect(timers.live).toEqual([])
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

  it('runs only while its context state is running', () => {
    const { fake, engine } = setup({ state: 'suspended', resumes: false })
    expect(engine.running).toBe(false)
    engine.unlock()
    expect(engine.unlocked).toBe(true)
    expect(engine.running).toBe(false)
    fake.state = 'running'
    expect(engine.running).toBe(true)
    engine.dispose()
    expect(engine.running).toBe(false)
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
