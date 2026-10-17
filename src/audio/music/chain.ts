// The music's mixer and session (0.13.0). The chain is persistent and holds no sources: one input gain per instrument
// at its part's level, the fixed bus filters, the tonal sum through a tape-wobble delay and a tone lowpass, a reverb
// send into one convolver, the dry drum buses, and the crackle gate. The session is what runs while music plays: the
// wobble's LFO and flutter, and the vinyl crackle's three loops into the gate. Its buffers (the crackle and the reverb
// impulse) are synthesised here, deterministic per seed through the sim's `mix` hash. Times are context time.
import { mix } from '../../sim'
import type { MixLevels } from './levels'
import { PART_OF } from './types'
import type { Inst } from './types'

/** The persistent mixer the voices play into (through each Loop's fade gains). */
export interface Chain {
  /** Each instrument's bus input, at its part's level. */
  input: Record<Inst, AudioNode>
  /** The crackle gate, closed (0) until the player opens it. */
  gate: GainNode
  /** The wobble delay's time, which the session's LFOs modulate. */
  wobble: AudioParam
  /**
   * Glides every part level, the reverb send and the tone cutoff towards `l` with time constant `tau`, from `at`
   * (context time; now when left out).
   */
  setLevels(l: MixLevels, tau: number, at?: number): void
}

/** The running LFOs and crackle. */
export interface Session { stop(at: number): void }

const INSTS: readonly Inst[] = ['keys', 'bass', 'lead', 'kick', 'snare', 'hat', 'shaker']
const BASS_LOWPASS = 700
/** The drum buses' bandpasses: centre in Hz and Q. */
const BANDS = { snare: [1800, 0.8], hat: [6500, 0.9], shaker: [5200, 1] } as const
/** The tape wobble: a delay around a 5 ms centre, swung 1.5 ms at 0.45 Hz plus a 6 Hz flutter at a thirtieth. */
const WOBBLE = { max: 0.05, centre: 0.005, depth: 0.0015, hz: 0.45, flutterHz: 6, flutterShare: 1 / 30 }

const CRACKLE_RATE = 22050
const CLICK_LAYERS = [7.3, 11.9] as const
const CLICKS_PER_SECOND = 6
const CLICK_PEAK = 0.012
/** A click's samples, each a share of its first; two or three of them. */
const CLICK_TAIL = [1, -0.45, 0.2] as const
/** Clicks keep this many samples clear of each end, so every loop starts and ends at zero. */
const CLICK_MARGIN = 8
const HISS_SECONDS = 2
const HISS_PEAK = 0.004
/** The hiss's one-pole lowpass coefficient (about 1.3 kHz at 22050 Hz). */
const HISS_SMOOTH = 0.3

const IMPULSE_SECONDS = 1.8
const PRE_DELAY = 0.015
/** The tail falls 60 dB by its end. */
const DECAY_DB = 60
/** The tail's lowpass cutoff glides from bright to dark, in Hz. */
const TAIL_BRIGHT = 7000
const TAIL_DARK = 1200

/** Salts for `mix`, so each buffer reads its own noise. */
const SALT = { clicks: 0x11, hiss: 0x22, impulse: 0x33 }

const unit = (h: number) => h / 2 ** 32
const noise = (seed: number, salt: number, i: number) => unit(mix(seed, salt, i)) * 2 - 1

function filter(ctx: BaseAudioContext, type: BiquadFilterType, hz: number, q?: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = hz
  if (q !== undefined) f.Q.value = q
  return f
}

/**
 * Builds the persistent mixer into `dest` at levels `l`, with its reverb impulse from `seed`. It creates no sources:
 * the session and the voices bring those.
 */
export function buildChain(ctx: BaseAudioContext, dest: AudioNode, seed: number, l: MixLevels): Chain {
  const tone = filter(ctx, 'lowpass', l.tone)
  tone.connect(dest)

  const sum = ctx.createGain()
  const delay = ctx.createDelay(WOBBLE.max)
  delay.delayTime.value = WOBBLE.centre
  sum.connect(delay)
  delay.connect(tone)

  const send = ctx.createGain()
  send.gain.value = l.space
  sum.connect(send)
  const verb = ctx.createConvolver()
  // The convolver reads `normalize` when its buffer is set.
  verb.normalize = true
  verb.buffer = impulseBuffer(ctx, seed)
  send.connect(verb)
  verb.connect(tone)

  const input = {} as Record<Inst, GainNode>
  for (const inst of INSTS) {
    const g = ctx.createGain()
    g.gain.value = l.parts[PART_OF[inst]]
    input[inst] = g
  }
  input.keys.connect(sum)
  input.lead.connect(sum)
  input.bass.connect(filter(ctx, 'lowpass', BASS_LOWPASS)).connect(sum)
  input.kick.connect(dest)
  for (const inst of ['snare', 'hat', 'shaker'] as const) {
    const [hz, q] = BANDS[inst]
    input[inst].connect(filter(ctx, 'bandpass', hz, q)).connect(dest)
  }

  const gate = ctx.createGain()
  gate.gain.value = 0
  gate.connect(dest)

  return {
    input,
    gate,
    wobble: delay.delayTime,
    setLevels(next, tau, at) {
      const t = at ?? ctx.currentTime
      for (const inst of INSTS) input[inst].gain.setTargetAtTime(next.parts[PART_OF[inst]], t, tau)
      send.gain.setTargetAtTime(next.space, t, tau)
      tone.frequency.setTargetAtTime(next.tone, t, tau)
    },
  }
}

const sessionBuffers = new WeakMap<BaseAudioContext, Map<number, AudioBuffer[]>>()

/** The crackle buffers for `seed`, made once per context. */
function crackleFor(ctx: BaseAudioContext, seed: number): AudioBuffer[] {
  let bySeed = sessionBuffers.get(ctx)
  if (!bySeed) sessionBuffers.set(ctx, (bySeed = new Map()))
  let buffers = bySeed.get(seed)
  if (!buffers) bySeed.set(seed, (buffers = crackleBuffers(ctx, seed)))
  return buffers
}

/**
 * Starts the session at `at`: the wobble's LFO and flutter into the chain's delay time, and the crackle loops into
 * its gate (which the player opens and closes). `stop` stops every source at once at `at` (never before the start)
 * and wires the last source's `onended` to disconnect every node the session made; they all stop together.
 */
export function openSession(ctx: BaseAudioContext, chain: Chain, seed: number, at: number): Session {
  const nodes: AudioNode[] = []
  const sources: AudioScheduledSourceNode[] = []
  for (const [hz, depth] of [[WOBBLE.hz, WOBBLE.depth], [WOBBLE.flutterHz, WOBBLE.depth * WOBBLE.flutterShare]]) {
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = hz
    const amount = ctx.createGain()
    amount.gain.value = depth
    lfo.connect(amount)
    amount.connect(chain.wobble)
    nodes.push(lfo, amount)
    sources.push(lfo)
  }
  for (const buffer of crackleFor(ctx, seed)) {
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.connect(chain.gate)
    nodes.push(src)
    sources.push(src)
  }
  for (const src of sources) src.start(at)

  let stopped = false
  return {
    stop(t) {
      if (stopped) return
      stopped = true
      const when = Math.max(t, at)
      sources[sources.length - 1].onended = () => {
        for (const n of nodes) n.disconnect()
      }
      for (const src of sources) src.stop(when)
    },
  }
}

/** One click layer: sparse 2-3 sample decaying clicks at hashed places and sizes, peaking at 0.012. */
function clickLayer(ctx: BaseAudioContext, seed: number, seconds: number, layer: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.round(seconds * CRACKLE_RATE), CRACKLE_RATE)
  const d = buffer.getChannelData(0)
  const room = d.length - 2 * CLICK_MARGIN - CLICK_TAIL.length
  const salt = SALT.clicks + layer
  for (let k = 0; k < Math.round(seconds * CLICKS_PER_SECOND); k++) {
    const h = mix(seed, salt, k)
    const at = CLICK_MARGIN + (mix(seed, salt, ~k) % room)
    const size = CLICK_PEAK * (0.3 + 0.7 * unit(h)) * (h & 1 ? 1 : -1)
    const len = h & 2 ? 3 : 2
    for (let j = 0; j < len; j++) {
      const v = size * CLICK_TAIL[j]
      if (Math.abs(v) > Math.abs(d[at + j])) d[at + j] = v
    }
  }
  return buffer
}

/** The 2 s hiss loop: lowpassed noise filtered twice around the loop (a seamless wrap), levelled to zero at its ends. */
function hissLoop(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, HISS_SECONDS * CRACKLE_RATE, CRACKLE_RATE)
  const d = buffer.getChannelData(0)
  const n = d.length
  const y = new Float64Array(n)
  let v = 0
  // The first lap only warms the filter; the second, starting where the first ended, is kept.
  for (let lap = 0; lap < 2; lap++) {
    for (let i = 0; i < n; i++) {
      v += HISS_SMOOTH * (noise(seed, SALT.hiss, i) - v)
      y[i] = v
    }
  }
  // Subtract the line through the ends: both become zero and the wrap stays continuous.
  const [first, last] = [y[0], y[n - 1]]
  let peak = 0
  for (let i = 0; i < n; i++) {
    y[i] -= first + ((last - first) * i) / (n - 1)
    peak = Math.max(peak, Math.abs(y[i]))
  }
  for (let i = 0; i < n; i++) d[i] = (y[i] / peak) * HISS_PEAK
  return buffer
}

/**
 * The crackle's three mono loops at 22050 Hz for `seed`: click layers of 7.3 s and 11.9 s (unequal, so the pattern
 * rarely repeats; about six clicks a second, peaking at 0.012) and a 2 s hiss peaking at 0.004. Each starts and ends
 * at zero.
 */
export function crackleBuffers(ctx: BaseAudioContext, seed: number): AudioBuffer[] {
  return [...CLICK_LAYERS.map((s, i) => clickLayer(ctx, seed, s, i)), hissLoop(ctx, seed)]
}

/**
 * The reverb's impulse for `seed`: stereo, 1.8 s at the context's own rate (a convolver refuses another), 15 ms of
 * silence, then noise (its own per channel) decaying 60 dB by the end through a lowpass that darkens over the tail.
 */
export function impulseBuffer(ctx: BaseAudioContext, seed: number): AudioBuffer {
  const rate = ctx.sampleRate
  const buffer = ctx.createBuffer(2, Math.round(IMPULSE_SECONDS * rate), rate)
  const pre = Math.round(PRE_DELAY * rate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch)
    const tail = d.length - 1 - pre
    let v = 0
    for (let i = pre; i < d.length; i++) {
      const t = (i - pre) / tail
      const cutoff = TAIL_BRIGHT * (TAIL_DARK / TAIL_BRIGHT) ** t
      v += (1 - Math.exp((-2 * Math.PI * cutoff) / rate)) * (noise(seed, SALT.impulse + ch, i) - v)
      d[i] = v * 10 ** ((-DECAY_DB * t) / 20)
    }
  }
  return buffer
}
