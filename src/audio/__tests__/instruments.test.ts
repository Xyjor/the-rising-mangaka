import { describe, expect, it } from 'vitest'
import {
  AMPLITUDE, buildChain, crackleBuffers, impulseBuffer, NODES_PER_NOTE, openSession, PEAK, playVoice,
} from '../music/instruments'
import type { MixLevels } from '../music/levels'
import type { Inst, LeadVoice, MusicEvent } from '../music/types'
import {
  asContext, FakeAudioContext, FakeBiquad, FakeBuffer, FakeBufferSource, FakeConvolver, FakeDelay, FakeGain,
  FakeNode, FakeOscillator, FakeParam, FakeSource,
} from './fakeAudio'

const INSTS: readonly Inst[] = ['keys', 'bass', 'lead', 'kick', 'snare', 'hat', 'shaker']
const LEADS: readonly LeadVoice[] = ['bell', 'soft', 'glock']
const node = (n: FakeNode) => n as unknown as AudioNode

/** Every instrument and lead voice to sweep, with a representative pitch. */
const CASES: readonly { inst: Inst; lead: LeadVoice; midi: number }[] = [
  ...INSTS.filter((i) => i !== 'lead').map((inst) => ({ inst, lead: 'bell' as LeadVoice, midi: inst === 'bass' ? 40 : 64 })),
  ...LEADS.map((lead) => ({ inst: 'lead' as Inst, lead, midi: 76 })),
]

function ev(o: Partial<MusicEvent> & { inst: Inst }): MusicEvent {
  return { midi: 60, at: 2, dur: 0.5, vel: 0.8, ...o }
}

/** Plays one event into a fresh fake, returning the voice, its output and every node the voice made. */
function play(e: MusicEvent, lead: LeadVoice = 'bell', fake = new FakeAudioContext()) {
  const out = fake.createGain()
  const before = fake.nodes.length
  const voice = playVoice(asContext(fake), node(out), e, lead)
  const made = fake.nodes.slice(before)
  const sources = made.filter((n): n is FakeSource => n instanceof FakeSource)
  const params = made.flatMap((n) => Object.values(n).filter((f): f is FakeParam => f instanceof FakeParam))
  const envs = made.filter((n): n is FakeGain => n instanceof FakeGain && n.connections.includes(out))
  return { fake, out, voice, made, sources, params, envs }
}

const lastStop = (s: FakeSource) => s.stops[s.stops.length - 1]
const scheduledValues = (p: FakeParam) =>
  p.events.filter((x) => x.kind === 'linearRampToValueAtTime' || x.kind === 'exponentialRampToValueAtTime' || x.kind === 'setValueAtTime')
    .map((x) => ('value' in x ? x.value : 0))

describe('playVoice', () => {
  for (const c of CASES) {
    const name = c.inst === 'lead' ? `lead (${c.lead})` : c.inst
    describe(name, () => {
      const e = ev({ inst: c.inst, midi: c.midi, at: 3, dur: 0.6, vel: 0.7 })

      it('starts every source at or after its time and stops each by the voice end', () => {
        const { voice, sources } = play(e, c.lead)
        expect(sources.length).toBeGreaterThan(0)
        for (const s of sources) {
          expect(s.starts).toHaveLength(1)
          expect(s.starts[0]).toBeGreaterThanOrEqual(3)
          expect(lastStop(s)).toBeLessThanOrEqual(voice.end + 1e-9)
        }
        expect(Math.max(...sources.map(lastStop))).toBeCloseTo(voice.end, 9)
        expect(voice.end).toBeGreaterThan(3)
      })

      it('schedules nothing before its time', () => {
        const { params } = play(e, c.lead)
        for (const p of params) for (const x of p.events) if ('time' in x) expect(x.time).toBeGreaterThanOrEqual(3)
      })

      it('shapes each envelope from silence, attacking linearly up to at most the peak times the velocity', () => {
        const { envs } = play(e, c.lead)
        const peak = (c.inst === 'lead' ? PEAK[c.lead] : PEAK[c.inst]) * 0.7
        expect(envs.length).toBeGreaterThan(0)
        for (const env of envs) {
          const [first, second, third] = env.gain.events
          expect(first).toEqual({ kind: 'value', value: 0 })
          expect(second).toEqual({ kind: 'setValueAtTime', value: 0, time: 3 })
          expect(third.kind).toBe('linearRampToValueAtTime')
          for (const x of env.gain.events) if (x.kind === 'exponentialRampToValueAtTime') expect(x.value).toBeGreaterThan(0)
          expect(Math.max(...scheduledValues(env.gain))).toBeLessThanOrEqual(peak + 1e-12)
        }
        // The loudest envelope reaches the peak.
        expect(Math.max(...envs.flatMap((env) => scheduledValues(env.gain)))).toBeCloseTo(peak, 12)
      })

      it('stops every source when cut short, and its last source ending disconnects every node it made', () => {
        const { voice, sources, made, fake } = play(e, c.lead)
        fake.currentTime = 3.01
        voice.stop(3.01)
        for (const s of sources) {
          expect(s.stops).toHaveLength(2)
          expect(lastStop(s)).toBeGreaterThanOrEqual(3.01)
          expect(lastStop(s)).toBeLessThanOrEqual(3.01 + 0.05 + 1e-9)
        }
        const withEnd = sources.filter((s) => s.onended)
        expect(withEnd).toHaveLength(1)
        expect(lastStop(withEnd[0])).toBe(Math.max(...sources.map(lastStop)))
        expect(made.filter((n) => n.disconnected)).toEqual([])
        withEnd[0].end()
        expect(made.filter((n) => !n.disconnected)).toEqual([])
      })

      it('never stops anything before its own time, even when cut short earlier', () => {
        const { voice, sources } = play(e, c.lead)
        voice.stop(1)
        for (const s of sources) expect(lastStop(s)).toBeGreaterThanOrEqual(3)
      })

      it(`builds exactly NODES_PER_NOTE nodes${c.inst === 'lead' ? ' or fewer' : ''}`, () => {
        const { made } = play(e, c.lead)
        if (c.inst === 'lead') expect(made.length).toBeLessThanOrEqual(NODES_PER_NOTE.lead)
        else expect(made.length).toBe(NODES_PER_NOTE[c.inst])
      })
    })
  }

  it('counts the lead at its costliest voice', () => {
    const counts = LEADS.map((lead) => play(ev({ inst: 'lead', midi: 76 }), lead).made.length)
    expect(Math.max(...counts)).toBe(NODES_PER_NOTE.lead)
  })

  it('reaches the design peaks', () => {
    const top = (inst: Inst, lead: LeadVoice = 'bell') =>
      Math.max(...play(ev({ inst, vel: 1 }), lead).envs.flatMap((env) => scheduledValues(env.gain)))
    expect(top('keys')).toBeCloseTo(0.035, 12)
    expect(top('bass')).toBeCloseTo(0.08, 12)
    expect(top('kick')).toBeCloseTo(0.12, 12)
    expect(top('snare')).toBeCloseTo(0.05, 12)
    expect(top('hat')).toBeCloseTo(0.025, 12)
    expect(top('shaker')).toBeCloseTo(0.015, 12)
    expect(top('lead', 'bell')).toBeCloseTo(0.05, 12)
    expect(top('lead', 'soft')).toBeCloseTo(0.05, 12)
  })

  it('sweeps the kick from 110 to 45 Hz over 0.12 s', () => {
    const { sources } = play(ev({ inst: 'kick', at: 1 }))
    const osc = sources[0] as FakeOscillator
    expect(osc.frequency.events).toEqual([
      { kind: 'setValueAtTime', value: 110, time: 1 },
      { kind: 'exponentialRampToValueAtTime', value: 45, time: 1.12 },
    ])
  })

  it('drives the electric piano carrier through a decaying mod gain at 1:1', () => {
    const { made } = play(ev({ inst: 'keys', midi: 69, at: 1, vel: 0.6 }))
    const mod = made.find((n): n is FakeGain => n instanceof FakeGain && n.paramConnections.length > 0)!
    const carrier = made.find((n): n is FakeOscillator => n instanceof FakeOscillator && n.frequency === mod.paramConnections[0])!
    expect(carrier).toBeDefined()
    expect(carrier.frequency.value).toBe(440)
    const modulator = made.find((n): n is FakeOscillator => n instanceof FakeOscillator && n.connections.includes(mod))!
    expect(modulator.frequency.value).toBe(440)
    // I0 = 1.2 + 1.3 x 0.6 = 1.98, so 1.98 x 440 Hz falling to 0.25 x 440 Hz over 0.6 s.
    expect(mod.gain.events).toEqual([
      { kind: 'setValueAtTime', value: expect.closeTo(871.2, 9), time: 1 },
      { kind: 'exponentialRampToValueAtTime', value: 110, time: expect.closeTo(1.6, 9) },
    ])
  })

  it('caps the electric piano index at 3', () => {
    const { made } = play(ev({ inst: 'keys', midi: 69, vel: 1.5 }))
    const mod = made.find((n): n is FakeGain => n instanceof FakeGain && n.paramConnections.length > 0)!
    expect(mod.gain.events[0]).toMatchObject({ value: 1320 })
  })

  it('rings the bell at 3.5:1 and the glock an octave up at 5:1', () => {
    for (const [lead, midi, carrierHz, modHz] of [['bell', 69, 440, 1540], ['glock', 57, 440, 2200]] as const) {
      const { made } = play(ev({ inst: 'lead', midi, at: 1 }), lead)
      const mod = made.find((n): n is FakeGain => n instanceof FakeGain && n.paramConnections.length > 0)!
      const carrier = made.find((n): n is FakeOscillator => n instanceof FakeOscillator && n.frequency === mod.paramConnections[0])!
      const modulator = made.find((n): n is FakeOscillator => n instanceof FakeOscillator && n.connections.includes(mod))!
      expect([carrier.frequency.value, modulator.frequency.value]).toEqual([carrierHz, modHz])
      // Index 1.5 falling to 0.1 over 0.4 s, as a deviation of index x modulator frequency.
      expect(mod.gain.events).toEqual([
        { kind: 'setValueAtTime', value: expect.closeTo(1.5 * modHz, 9), time: 1 },
        { kind: 'exponentialRampToValueAtTime', value: expect.closeTo(0.1 * modHz, 9), time: expect.closeTo(1.4, 9) },
      ])
    }
  })

  it("caps the glock's peak deviation under 6000 Hz, high notes ringing at a lower index", () => {
    // A5 (880 Hz): the carrier at 1760 Hz, the modulator at 8800 Hz; index 1.5 would deviate by 13,200 Hz.
    for (let midi = 55; midi <= 100; midi++) {
      const { made } = play(ev({ inst: 'lead', midi, at: 1 }), 'glock')
      const mod = made.find((n): n is FakeGain => n instanceof FakeGain && n.paramConnections.length > 0)!
      const values = mod.gain.events.map((x) => ('value' in x ? x.value : 0))
      expect(Math.max(...values)).toBeLessThan(6000)
      // The index still falls: the ramp ends below where it starts.
      expect(values[1]).toBeLessThan(values[0])
    }
  })

  it('plays the snare as noise alone, with no pitched body', () => {
    const { sources, made } = play(ev({ inst: 'snare', at: 1 }))
    expect(sources.map((s) => s instanceof FakeBufferSource)).toEqual([true])
    expect(made.filter((n) => n instanceof FakeOscillator)).toEqual([])
  })

  it('gives each voice its real peak amplitude: the bass its sine plus its triangle at 0.3, the rest their peak', () => {
    expect(AMPLITUDE.bass).toBeCloseTo(0.104, 12)
    for (const v of ['keys', 'lead', 'kick', 'snare', 'hat', 'shaker', 'bell', 'glock', 'soft'] as const) {
      expect(AMPLITUDE[v]).toBe(PEAK[v])
    }
  })

  it("plays a strummed chord's notes at their own times, 12 ms apart", () => {
    const fake = new FakeAudioContext()
    const starts = [1, 1.012, 1.024].map((at, i) => {
      const { sources } = play(ev({ inst: 'keys', midi: 60 + i * 4, at }), 'bell', fake)
      return Math.min(...sources.map((s) => s.starts[0]))
    })
    expect(starts).toEqual([1, 1.012, 1.024])
  })

  it('reads the snare noise from a hashed offset, different from note to note', () => {
    const offsets = [1, 1.5, 2].map((at) => {
      const { sources } = play(ev({ inst: 'snare', at }))
      return (sources.find((s) => s instanceof FakeBufferSource) as FakeBufferSource).offsets[0]
    })
    expect(new Set(offsets).size).toBe(3)
    for (const o of offsets) expect(o >= 0 && o < 0.5).toBe(true)
  })

  it('holds a long hat open for 0.18 s and a closed one for 35 ms', () => {
    expect(play(ev({ inst: 'hat', at: 1 })).voice.end).toBeCloseTo(1.035, 9)
    expect(play(ev({ inst: 'hat', at: 1, open: true })).voice.end).toBeCloseTo(1.18, 9)
  })
})

const sum = (a: Float32Array) => a.reduce((s, x) => s + Math.abs(x), 0)
const maxAbs = (a: Float32Array) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0)
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length)
const fakeBuffers = (bs: AudioBuffer[]) => bs as unknown as FakeBuffer[]

describe('crackleBuffers', () => {
  const [a, b, hiss] = fakeBuffers(crackleBuffers(asContext(new FakeAudioContext()), 7))

  it('makes two click layers of 7.3 and 11.9 s and a 2 s hiss, mono at 22050 Hz', () => {
    expect([a, b, hiss].map((x) => [x.numberOfChannels, x.sampleRate, x.length])).toEqual([
      [1, 22050, Math.round(7.3 * 22050)], [1, 22050, Math.round(11.9 * 22050)], [1, 22050, 2 * 22050],
    ])
  })

  it('is the same for the same seed and different for another', () => {
    const again = fakeBuffers(crackleBuffers(asContext(new FakeAudioContext()), 7))
    const other = fakeBuffers(crackleBuffers(asContext(new FakeAudioContext()), 8))
    for (let i = 0; i < 3; i++) {
      expect(again[i].getChannelData(0)).toEqual([a, b, hiss][i].getChannelData(0))
      expect(other[i].getChannelData(0)).not.toEqual([a, b, hiss][i].getChannelData(0))
    }
  })

  it('peaks the clicks at 0.012 and the hiss at 0.004', () => {
    for (const layer of [a, b]) {
      expect(maxAbs(layer.getChannelData(0))).toBeLessThanOrEqual(0.012)
      expect(maxAbs(layer.getChannelData(0))).toBeGreaterThan(0.008)
    }
    expect(maxAbs(hiss.getChannelData(0))).toBeCloseTo(0.004, 9)
  })

  it('scatters about six clicks a second', () => {
    for (const [layer, seconds] of [[a, 7.3], [b, 11.9]] as const) {
      const d = layer.getChannelData(0)
      let onsets = 0
      for (let i = 1; i < d.length; i++) if (d[i] !== 0 && d[i - 1] === 0) onsets++
      expect(onsets / seconds).toBeGreaterThan(4.5)
      expect(onsets / seconds).toBeLessThan(7)
    }
  })

  it('starts and ends every loop at zero', () => {
    for (const x of [a, b, hiss]) {
      const d = x.getChannelData(0)
      expect(Math.abs(d[0])).toBeLessThan(1e-6)
      expect(Math.abs(d[d.length - 1])).toBeLessThan(1e-6)
    }
  })

  it('keeps the hiss continuous around its seam', () => {
    const d = hiss.getChannelData(0)
    let step = 0
    for (let i = 1; i < d.length; i++) step = Math.max(step, Math.abs(d[i] - d[i - 1]))
    expect(Math.abs(d[0] - d[d.length - 1])).toBeLessThanOrEqual(step)
  })
})

describe('impulseBuffer', () => {
  const fake = new FakeAudioContext()
  const ir = impulseBuffer(asContext(fake), 3) as unknown as FakeBuffer
  const [l, r] = [ir.getChannelData(0), ir.getChannelData(1)]

  it('is stereo, 1.8 s long, at the context rate', () => {
    expect([ir.numberOfChannels, ir.sampleRate, ir.length]).toEqual([2, 8000, 14400])
  })

  it('is silent for the 15 ms pre-delay, then sounds', () => {
    expect(sum(l.subarray(0, 120)) + sum(r.subarray(0, 120))).toBe(0)
    expect(sum(l.subarray(120, 520))).toBeGreaterThan(0)
  })

  it('decays by at least 40 dB', () => {
    const head = rms(l.subarray(120, 520))
    const tail = rms(l.subarray(l.length - 400))
    expect(20 * Math.log10(head / tail)).toBeGreaterThanOrEqual(40)
  })

  it('stays within ±1, differs per channel and is the same for the same seed', () => {
    expect(Math.max(maxAbs(l), maxAbs(r))).toBeLessThanOrEqual(1)
    expect(l).not.toEqual(r)
    const again = impulseBuffer(asContext(new FakeAudioContext()), 3) as unknown as FakeBuffer
    expect(again.getChannelData(1)).toEqual(r)
    const other = impulseBuffer(asContext(new FakeAudioContext()), 4) as unknown as FakeBuffer
    expect(other.getChannelData(0)).not.toEqual(l)
  })
})

const LEVELS: MixLevels = { tone: 2400, space: 0.3, parts: { keys: 0.9, bass: 0.8, lead: 0.7, drums: 0.5 } }

function chainOn(fake = new FakeAudioContext()) {
  const dest = fake.createGain()
  const before = fake.nodes.length
  const chain = buildChain(asContext(fake), node(dest), 5, LEVELS)
  const made = fake.nodes.slice(before)
  const input = chain.input as unknown as Record<Inst, FakeGain>
  return { fake, dest, chain, made, input }
}

const only = <T>(xs: readonly T[]): T => {
  expect(xs).toHaveLength(1)
  return xs[0]
}

describe('buildChain', () => {
  it('creates no sources', () => {
    const { made } = chainOn()
    expect(made.length).toBeGreaterThan(0)
    expect(made.filter((n) => n instanceof FakeSource)).toEqual([])
  })

  it('sets each instrument input to its part level', () => {
    const { input } = chainOn()
    expect(INSTS.map((i) => input[i].gain.value)).toEqual([0.9, 0.8, 0.7, 0.5, 0.5, 0.5, 0.5])
  })

  it('routes the tonal buses through the wobble delay and the tone lowpass, with a reverb send beside it', () => {
    const { input, dest } = chainOn()
    const sumNode = only(input.keys.connections) as FakeGain
    expect(only(input.lead.connections)).toBe(sumNode)
    const bassLp = only(input.bass.connections) as FakeBiquad
    expect([bassLp.type, bassLp.frequency.value]).toEqual(['lowpass', 700])
    expect(only(bassLp.connections)).toBe(sumNode)

    const delay = sumNode.connections.find((n): n is FakeDelay => n instanceof FakeDelay)!
    expect([delay.maxDelayTime, delay.delayTime.value]).toEqual([0.05, 0.005])
    const tone = only(delay.connections) as FakeBiquad
    expect([tone.type, tone.frequency.value]).toEqual(['lowpass', 2400])
    expect(tone.connections).toEqual([dest])

    const send = sumNode.connections.find((n): n is FakeGain => n instanceof FakeGain)!
    expect(sumNode.connections).toHaveLength(2)
    expect(send.gain.value).toBe(0.3)
    const verb = only(send.connections) as FakeConvolver
    expect(verb).toBeInstanceOf(FakeConvolver)
    expect(verb.normalizeAtBuffer).toBe(true)
    expect(verb.buffer?.sampleRate).toBe(8000)
    expect(verb.buffer?.numberOfChannels).toBe(2)
    expect(verb.connections).toEqual([tone])
  })

  it('sends the drum buses straight to the output through their filters', () => {
    const { input, dest } = chainOn()
    expect(input.kick.connections).toEqual([dest])
    for (const [inst, hz, q] of [['snare', 1800, 0.8], ['hat', 6500, 0.9], ['shaker', 5200, 1]] as const) {
      const bp = only(input[inst].connections) as FakeBiquad
      expect([bp.type, bp.frequency.value, bp.Q.value]).toEqual(['bandpass', hz, q])
      expect(bp.connections).toEqual([dest])
    }
  })

  it('opens a closed crackle gate onto the output', () => {
    const { chain, dest } = chainOn()
    const gate = chain.gate as unknown as FakeGain
    expect(gate.gain.value).toBe(0)
    expect(gate.connections).toEqual([dest])
  })

  it('glides every level with setTargetAtTime', () => {
    const { fake, chain, input, made } = chainOn()
    fake.currentTime = 3
    chain.setLevels({ tone: 1300, space: 0.1, parts: { keys: 1, bass: 0.6, lead: 0.4, drums: 0 } }, 0.8)
    const last = (p: FakeParam) => p.events[p.events.length - 1]
    expect(INSTS.map((i) => last(input[i].gain))).toEqual(
      [1, 0.6, 0.4, 0, 0, 0, 0].map((value) => ({ kind: 'setTargetAtTime', value, time: 3, timeConstant: 0.8 })),
    )
    const send = made.find((n): n is FakeGain => n instanceof FakeGain && n.connections.some((c) => c instanceof FakeConvolver))!
    expect(last(send.gain)).toEqual({ kind: 'setTargetAtTime', value: 0.1, time: 3, timeConstant: 0.8 })
    const tone = made.find((n): n is FakeBiquad => n instanceof FakeBiquad && n.frequency.value === 2400)!
    expect(last(tone.frequency)).toEqual({ kind: 'setTargetAtTime', value: 1300, time: 3, timeConstant: 0.8 })
  })

  it('cancels whatever was scheduled from its start on, so the latest glide wins', () => {
    const { fake, chain, input } = chainOn()
    fake.currentTime = 3
    chain.setLevels({ tone: 2000, space: 0.2, parts: { keys: 1, bass: 0.8, lead: 1, drums: 1 } }, 0.4, 3.2)
    chain.setLevels({ tone: 2400, space: 0.2, parts: { keys: 1, bass: 0.5, lead: 1, drums: 1 } }, 0.4)
    expect(input.bass.gain.events.slice(-2)).toEqual([
      { kind: 'cancelScheduledValues', time: 3 },
      { kind: 'setTargetAtTime', value: 0.5, time: 3, timeConstant: 0.4 },
    ])
  })

  it('glides from a later start time when given one', () => {
    const { fake, chain, input, made } = chainOn()
    fake.currentTime = 3
    chain.setLevels({ tone: 1300, space: 0.1, parts: { keys: 1, bass: 0.6, lead: 0.4, drums: 0 } }, 0.4, 3.2)
    const last = (p: FakeParam) => p.events[p.events.length - 1]
    for (const i of INSTS) expect(last(input[i].gain)).toMatchObject({ kind: 'setTargetAtTime', time: 3.2, timeConstant: 0.4 })
    const send = made.find((n): n is FakeGain => n instanceof FakeGain && n.connections.some((c) => c instanceof FakeConvolver))!
    expect(last(send.gain)).toEqual({ kind: 'setTargetAtTime', value: 0.1, time: 3.2, timeConstant: 0.4 })
    const tone = made.find((n): n is FakeBiquad => n instanceof FakeBiquad && n.frequency.value === 2400)!
    expect(last(tone.frequency)).toEqual({ kind: 'setTargetAtTime', value: 1300, time: 3.2, timeConstant: 0.4 })
  })
})

describe('openSession', () => {
  function session() {
    const c = chainOn()
    const before = c.fake.nodes.length
    const s = openSession(asContext(c.fake), c.chain, 5, 4)
    const made = c.fake.nodes.slice(before)
    return { ...c, s, made, sources: made.filter((n): n is FakeSource => n instanceof FakeSource) }
  }

  it('wobbles the delay with a 0.45 Hz LFO and a 6 Hz flutter at a thirtieth of its depth', () => {
    const { made, chain } = session()
    const wobble = chain.wobble as unknown as FakeParam
    const depths = wobble.inputs.map((g) => {
      const osc = made.find((n): n is FakeOscillator => n instanceof FakeOscillator && n.connections.includes(g))!
      return [osc.type, osc.frequency.value, (g as FakeGain).gain.value]
    })
    expect(depths).toEqual([['sine', 0.45, 0.0015], ['sine', 6, expect.closeTo(0.0015 / 30, 12)]])
  })

  it('loops the crackle layers into the gate', () => {
    const { made, chain } = session()
    const loops = made.filter((n): n is FakeBufferSource => n instanceof FakeBufferSource)
    expect(loops.map((s) => [s.loop, s.buffer?.length, s.connections[0] === (chain.gate as unknown as FakeNode)])).toEqual([
      [true, Math.round(7.3 * 22050), true], [true, Math.round(11.9 * 22050), true], [true, 2 * 22050, true],
    ])
  })

  it('starts every source at its time', () => {
    const { sources } = session()
    expect(sources).toHaveLength(5)
    for (const src of sources) expect(src.starts).toEqual([4])
  })

  it('stops every source on stop, and disconnects every node it made once they end', () => {
    const { s, sources, made } = session()
    s.stop(9)
    for (const src of sources) expect(src.stops).toEqual([9])
    for (const src of sources) src.end()
    expect(made.filter((n) => !n.disconnected)).toEqual([])
  })

  it('never stops before it started', () => {
    const { s, sources } = session()
    s.stop(1)
    for (const src of sources) expect(src.stops).toEqual([4])
  })
})
