import { describe, expect, it } from 'vitest'
import { playVoices } from '../synth'
import type { Voice } from '../types'
import {
  FakeAudioContext, FakeBiquad, FakeBufferSource, FakeGain, FakeOscillator, type FakeParam, type FakeSource,
} from './fakeAudio'

const r = (x: number) => Math.round(x * 1e6) / 1e6
const trace = (p: FakeParam) =>
  p.events.map((e) => [e.kind, 'value' in e ? r(e.value) : null, 'time' in e ? r(e.time) : null])

function play(fake: FakeAudioContext, voices: Voice[], at: number, pitch = 0) {
  const dest = fake.createGain()
  const stop = playVoices(fake as unknown as BaseAudioContext, dest as unknown as AudioNode, voices, at, pitch)
  return { dest, stop }
}

/** The envelope gain a source feeds, through its filter when it has one. */
function envOf(src: FakeSource): FakeGain {
  const next = src.connections[0]
  return (next instanceof FakeBiquad ? next.connections[0] : next) as FakeGain
}

describe('playVoices', () => {
  it('schedules a tone with an attack, a decay, a release and a glide', () => {
    const fake = new FakeAudioContext()
    const { dest } = play(fake, [{ wave: 'square', freq: 440, to: 880, at: 0.25, dur: 0.5, gain: 0.2, attack: 0.125 }], 1)
    const [osc] = fake.sources as FakeOscillator[]
    expect(osc).toBeInstanceOf(FakeOscillator)
    expect(osc.type).toBe('square')
    expect(trace(osc.frequency)).toEqual([
      ['setValueAtTime', 440, 1.25],
      ['exponentialRampToValueAtTime', 880, 1.75],
    ])
    const env = envOf(osc)
    expect(osc.connections).toEqual([env])
    expect(env.connections).toEqual([dest])
    // Silent until 1.25, peak 0.2 at 1.375, decay to 60% (0.12) by 30% of the rest (1.4875), release to silence at 1.75.
    expect(trace(env.gain)).toEqual([
      ['value', 0, null],
      ['setValueAtTime', 0, 1.25],
      ['linearRampToValueAtTime', 0.2, 1.375],
      ['exponentialRampToValueAtTime', 0.12, 1.4875],
      ['exponentialRampToValueAtTime', 0.0001, 1.75],
    ])
    expect(osc.starts).toEqual([1.25])
    expect(osc.stops).toEqual([1.75])
  })

  it('shifts the oscillator and its filter by the pitch in semitones', () => {
    const voice: Voice = { wave: 'triangle', freq: 440, at: 0, dur: 0.1, gain: 0.1, filter: { type: 'lowpass', freq: 1000, q: 2 } }
    const up = new FakeAudioContext()
    play(up, [voice], 0, 12)
    const [osc] = up.sources as FakeOscillator[]
    const filter = osc.connections[0] as FakeBiquad
    expect(osc.frequency.events[0]).toMatchObject({ value: 880 })
    expect(filter).toBeInstanceOf(FakeBiquad)
    expect(filter.type).toBe('lowpass')
    expect(filter.frequency.target).toBe(2000)
    expect(filter.Q.target).toBe(2)
    expect(filter.connections).toEqual([envOf(osc)])

    const down = new FakeAudioContext()
    play(down, [voice], 0, -12)
    const [low] = down.sources as FakeOscillator[]
    expect(low.frequency.events[0]).toMatchObject({ value: 220 })
    expect((low.connections[0] as FakeBiquad).frequency.target).toBe(500)
  })

  it('plays noise from one shared, seeded buffer, sped up by the pitch', () => {
    const fake = new FakeAudioContext()
    const noise: Voice[] = [
      { wave: 'noise', freq: 0, at: 0, dur: 0.05, gain: 0.2, filter: { type: 'bandpass', freq: 2000 } },
      { wave: 'noise', freq: 0, at: 0.1, dur: 0.05, gain: 0.2 },
    ]
    play(fake, noise, 0, 12)
    play(fake, noise, 1)
    expect(fake.buffers).toHaveLength(1)
    const [buffer] = fake.buffers
    expect(buffer.length).toBe(8000)
    const [a, b, c] = fake.sources as FakeBufferSource[]
    expect(a).toBeInstanceOf(FakeBufferSource)
    expect(a.buffer).toBe(buffer)
    expect(b.buffer).toBe(buffer)
    expect(c.buffer).toBe(buffer)
    expect(a.loop).toBe(true)
    expect(a.playbackRate.target).toBe(2)
    expect(c.playbackRate.target).toBe(1)
    expect((a.connections[0] as FakeBiquad).frequency.target).toBe(4000)
    expect(b.connections[0]).toBeInstanceOf(FakeGain)
    expect(b.starts).toEqual([0.1])
    expect(a.offsets[0]).not.toBe(b.offsets[0])

    const data = buffer.getChannelData(0)
    expect(Math.min(...data)).toBeGreaterThanOrEqual(-1)
    expect(Math.max(...data)).toBeLessThan(1)
    expect(new Set(data).size).toBeGreaterThan(7000)
    const again = new FakeAudioContext()
    play(again, noise, 0)
    expect(again.buffers[0].getChannelData(0)).toEqual(data)
  })

  it('disconnects a voice once its source ends', () => {
    const fake = new FakeAudioContext()
    const { dest } = play(fake, [{ wave: 'sine', freq: 440, at: 0, dur: 0.1, gain: 0.1, filter: { type: 'highpass', freq: 200 } }], 0)
    const [osc] = fake.sources
    const filter = osc.connections[0] as FakeBiquad
    const env = envOf(osc)
    expect(osc.disconnected || filter.disconnected || env.disconnected).toBe(false)
    osc.end()
    expect([osc.disconnected, filter.disconnected, env.disconnected]).toEqual([true, true, true])
    expect(dest.disconnected).toBe(false)
  })

  it('returns a stop that fades and stops every voice now, once', () => {
    const fake = new FakeAudioContext()
    const { stop } = play(fake, [
      { wave: 'triangle', freq: 440, at: 0, dur: 1, gain: 0.1 },
      { wave: 'noise', freq: 0, at: 0.5, dur: 1, gain: 0.1 },
    ], 0)
    fake.currentTime = 0.2
    stop()
    const [tone, noise] = fake.sources
    expect(tone.stops).toEqual([1, 0.25])
    expect(noise.stops).toEqual([1.5, 0.25])
    for (const src of [tone, noise]) {
      expect(trace(envOf(src).gain).slice(-2)).toEqual([
        ['cancelScheduledValues', null, 0.2],
        ['setTargetAtTime', 0, 0.2],
      ])
    }
    stop()
    expect(tone.stops).toHaveLength(2)
  })
})
