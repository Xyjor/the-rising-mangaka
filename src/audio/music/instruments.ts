// The music's instruments (0.13.0): one short-lived voice per note event, built from sources and an envelope gain only
// (plus a mod gain for the FM voices), so the fixed filters can live on the persistent buses in chain.ts. The keys are
// an FM electric piano, the lead a bell, a glock or a soft triangle, the bass a sine with a quiet triangle, and the
// drums a swept sine kick and noise from synth.ts's shared buffer. Every time is context time (seconds): an event's
// `at` is absolute here, and nothing is scheduled before it. Each voice ends itself: one `onended`, on the source that
// stops last, disconnects every node it made. The chain, the session and their buffers are re-exported from chain.ts.
import { mix } from '../../sim'
import { midiToHz } from '../cues'
import { holdAt, noiseBuffer } from '../synth'
import type { Inst, LeadVoice, MusicEvent, Voice, VoiceFn } from './types'

export { buildChain, crackleBuffers, impulseBuffer, openSession } from './chain'
export type { Chain, Session } from './chain'

/** Each instrument's (and lead timbre's) envelope peak at velocity 1; the lead's entry is its loudest timbre. */
export const PEAK: Record<Inst | LeadVoice, number> = {
  keys: 0.035, bass: 0.08, lead: 0.05, kick: 0.12, snare: 0.05, hat: 0.025, shaker: 0.015,
  bell: 0.05, glock: 0.05, soft: 0.05,
}

/** The bass's triangle sits at this level under its sine. */
const BASS_TRIANGLE = 0.3

/**
 * Each instrument's (and lead timbre's) real peak amplitude at velocity 1, for the summed-peak budget: its envelope
 * peak times the sum of the source levels under it, so the bass's sine and its triangle at 0.3 count 1.3 x its peak;
 * every other voice has one source at full level.
 */
export const AMPLITUDE: Record<Inst | LeadVoice, number> = { ...PEAK, bass: PEAK.bass * (1 + BASS_TRIANGLE) }

/**
 * The audio nodes one event of each instrument builds, the lead at its costliest timbre (the FM bell and glock): FM
 * is two oscillators, a mod gain and an envelope; the bass a sine, a triangle, the triangle's level and an envelope;
 * the snare, like the hat and the shaker, a noise and its envelope. The node budget tests count with it.
 */
export const NODES_PER_NOTE: Record<Inst, number> = { keys: 4, bass: 4, lead: 4, kick: 2, snare: 2, hat: 2, shaker: 2 }

/** Exponential ramps cannot reach 0; this is inaudible. */
const SILENT = 0.0001
/** Cutting a voice short: fade with this time constant, then stop its sources this long after. */
const STOP_FADE = 0.01
const STOP_AFTER = 0.05
/** The noise voices read from somewhere in the first half of synth.ts's one-second buffer. */
const NOISE_SPAN = 0.5
/** A drum hit's linear attack, in seconds. */
const HIT_ATTACK = 0.002

/** One envelope's timing: attack, then an exponential decay towards `sustain` x peak over `decay`, then release. */
interface Shape { attack: number; decay: number; sustain: number; release: number }

const KEYS: Shape = { attack: 0.006, decay: 1.4, sustain: 0.35, release: 0.25 }
/** The bell decays to silence; a note let go sooner releases over 0.4 s. */
const BELL: Shape = { attack: 0.004, decay: 0.8, sustain: 0, release: 0.4 }
const GLOCK: Shape = { ...BELL, decay: 1.2 }
/** The soft lead settles to 0.7 over 0.3 s (the design gives the level, not the time). */
const SOFT: Shape = { attack: 0.04, decay: 0.3, sustain: 0.7, release: 0.15 }
const BASS: Shape = { attack: 0.012, decay: 1, sustain: 1, release: 0.08 }

/** The electric piano's FM index: from 1.2 + 1.3 x velocity (at most 3) down to 0.25 over 0.6 s, at 1:1. */
const KEYS_INDEX = { base: 1.2, perVel: 1.3, max: 3, floor: 0.25, time: 0.6, ratio: 1 }
/** The bell's index from 1.5 to 0.1 over 0.4 s, at 3.5:1; the glock is the bell an octave up at 5:1. */
const BELL_INDEX = { start: 1.5, floor: 0.1, time: 0.4 }
const BELL_RATIO = 3.5
const GLOCK_RATIO = 5
/**
 * The glock's modulator runs at 10x the note, so above about A3 index 1.5 would swing it past 6000 Hz and alias
 * into a harsh fizz; its starting deviation (index x modulator Hz) is capped here, the floor kept below it.
 */
const GLOCK_MAX_DEVIATION = 5800
/** The kick sweeps 110 to 45 Hz over 0.12 s, easing to this share of its peak, then tails to silence by 0.44 s. */
const KICK = { from: 110, to: 45, sweep: 0.12, body: 0.6, end: 0.44 }
/** The snare: 0.14 s of noise alone (the 190 Hz triangle body went in 0.13.0, Task 12). */
const SNARE = { noise: 0.14 }
const HAT = { closed: 0.035, open: 0.18 }
const SHAKER = { len: 0.05, attack: 0.008 }

/** What one voice made: every node (to disconnect), its envelopes (to cut) and its sources with their stop times. */
interface Kit {
  ctx: BaseAudioContext
  at: number
  nodes: AudioNode[]
  envs: GainNode[]
  srcs: { node: AudioScheduledSourceNode; end: number }[]
}

/** A gain the voice owns, not yet connected. */
function gain(k: Kit): GainNode {
  const g = k.ctx.createGain()
  k.nodes.push(g)
  return g
}

/** An envelope into `out`, silent until the event's time. */
function envelope(k: Kit, out: AudioNode): GainNode {
  const g = gain(k)
  g.connect(out)
  g.gain.value = 0
  g.gain.setValueAtTime(0, k.at)
  k.envs.push(g)
  return g
}

/** An oscillator into `to`, at `hz` (null: the caller schedules its frequency). */
function osc(k: Kit, type: OscillatorType, hz: number | null, to: AudioNode, end: number): OscillatorNode {
  const o = k.ctx.createOscillator()
  o.type = type
  if (hz !== null) o.frequency.value = hz
  o.connect(to)
  o.start(k.at)
  o.stop(end)
  k.nodes.push(o)
  k.srcs.push({ node: o, end })
  return o
}

/** Noise from the shared buffer at an offset hashed from the event, so repeated hits differ. */
function noise(k: Kit, e: MusicEvent, to: AudioNode, end: number): void {
  const src = k.ctx.createBufferSource()
  src.buffer = noiseBuffer(k.ctx)
  src.connect(to)
  const offset = (mix(e.midi, Math.round(e.at * 1000), 0x5e7a) / 2 ** 32) * NOISE_SPAN
  src.start(k.at, offset)
  src.stop(end)
  k.nodes.push(src)
  k.srcs.push({ node: src, end })
}

/**
 * Shapes an envelope held until `off`: attack, decay towards sustain (cut where the note lets go), release. A shape
 * that decays to silence before `off` ends there. Returns when it is silent.
 */
function shape(p: AudioParam, at: number, peak: number, s: Shape, off: number): number {
  const top = at + s.attack
  p.linearRampToValueAtTime(peak, top)
  const floor = Math.max(peak * s.sustain, SILENT)
  const held = Math.max(off, top)
  if (held - top < s.decay) {
    p.exponentialRampToValueAtTime(peak * (floor / peak) ** ((held - top) / s.decay), held)
  } else {
    p.exponentialRampToValueAtTime(floor, top + s.decay)
    if (floor <= SILENT) return top + s.decay
    p.setValueAtTime(floor, held)
  }
  p.exponentialRampToValueAtTime(SILENT, held + s.release)
  return held + s.release
}

/** A drum hit: a linear attack to `peak`, then an exponential fall to silence at `at + len`. */
function hit(p: AudioParam, at: number, peak: number, attack: number, len: number): number {
  p.linearRampToValueAtTime(peak, at + attack)
  p.exponentialRampToValueAtTime(SILENT, at + len)
  return at + len
}

/** Two sine oscillators, the modulator at `ratio` through a mod gain into the carrier's frequency. */
function fm(k: Kit, env: GainNode, hz: number, ratio: number, from: number, to: number, time: number, end: number) {
  const modHz = hz * ratio
  const mod = gain(k)
  const carrier = osc(k, 'sine', hz, env, end)
  mod.connect(carrier.frequency)
  // The index as a deviation in Hz: index x modulator frequency.
  mod.gain.setValueAtTime(from * modHz, k.at)
  mod.gain.exponentialRampToValueAtTime(to * modHz, k.at + time)
  osc(k, 'sine', modHz, mod, end)
}

/** Plays one event into `out` (the Loop's fade gain for its instrument), the lead in timbre `lead`. */
export const playVoice: VoiceFn = (ctx, out, e, lead) => {
  const k: Kit = { ctx, at: e.at, nodes: [], envs: [], srcs: [] }
  const voice = e.inst === 'lead' ? lead : e.inst
  const peak = Math.max(PEAK[voice] * e.vel, SILENT)
  const hz = midiToHz(e.midi)
  const off = e.at + e.dur
  const env = envelope(k, out)
  switch (voice) {
    case 'keys': {
      const end = shape(env.gain, e.at, peak, KEYS, off)
      const i = KEYS_INDEX
      fm(k, env, hz, i.ratio, Math.min(i.max, i.base + i.perVel * e.vel), i.floor, i.time, end)
      break
    }
    case 'bell':
    case 'glock': {
      const bell = voice === 'bell'
      const s = bell ? BELL : GLOCK
      const end = shape(env.gain, e.at, peak, s, Math.min(off, e.at + s.attack + s.decay))
      const i = BELL_INDEX
      const carrier = bell ? hz : hz * 2
      const ratio = bell ? BELL_RATIO : GLOCK_RATIO
      const start = bell ? i.start : Math.min(i.start, GLOCK_MAX_DEVIATION / (carrier * ratio))
      fm(k, env, carrier, ratio, start, Math.min(i.floor, start / 2), i.time, end)
      break
    }
    case 'soft':
      osc(k, 'triangle', hz, env, shape(env.gain, e.at, peak, SOFT, off))
      break
    case 'bass': {
      const end = shape(env.gain, e.at, peak, BASS, off)
      osc(k, 'sine', hz, env, end)
      const level = gain(k)
      level.connect(env)
      level.gain.value = BASS_TRIANGLE
      osc(k, 'triangle', hz, level, end)
      break
    }
    case 'kick': {
      env.gain.linearRampToValueAtTime(peak, e.at + HIT_ATTACK)
      env.gain.exponentialRampToValueAtTime(peak * KICK.body, e.at + KICK.sweep)
      env.gain.exponentialRampToValueAtTime(SILENT, e.at + KICK.end)
      const o = osc(k, 'sine', null, env, e.at + KICK.end)
      o.frequency.setValueAtTime(KICK.from, e.at)
      o.frequency.exponentialRampToValueAtTime(KICK.to, e.at + KICK.sweep)
      break
    }
    case 'snare': {
      noise(k, e, env, hit(env.gain, e.at, peak, HIT_ATTACK, SNARE.noise))
      break
    }
    case 'hat':
      noise(k, e, env, hit(env.gain, e.at, peak, HIT_ATTACK, e.open ? HAT.open : HAT.closed))
      break
    case 'shaker':
      noise(k, e, env, hit(env.gain, e.at, peak, SHAKER.attack, SHAKER.len))
      break
  }
  return finish(k)
}

/** Wires the last source's `onended` to disconnect everything, and returns the voice. */
function finish(k: Kit): Voice {
  const last = k.srcs.reduce((a, b) => (b.end > a.end ? b : a))
  last.node.onended = () => {
    for (const n of k.nodes) n.disconnect()
  }
  let stopped = false
  return {
    end: last.end,
    stop(t: number) {
      if (stopped) return
      stopped = true
      const s = Math.max(t, k.at)
      for (const env of k.envs) {
        holdAt(env.gain, s)
        env.gain.setTargetAtTime(0, s, STOP_FADE)
      }
      for (const src of k.srcs) if (src.end > s) src.node.stop(Math.min(src.end, s + STOP_AFTER))
    },
  }
}
