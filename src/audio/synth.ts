// The mixer graph, the shared noise buffer and one short-lived chain per cue voice (source, optional filter, envelope
// gain). The music loop's notes and fades are made in music.ts. Scheduling is in context time (seconds).
import type { Voice } from './types'

/** The mixer: the fx and music buses feed master, which feeds a gentle compressor and the speakers. */
export interface Graph {
  master: GainNode
  fx: GainNode
  music: GainNode
}

export const MUSIC_LOWPASS_HZ = 1800

const DEFAULT_ATTACK = 0.005
/** The decay falls to this share of the peak... */
const SUSTAIN = 0.6
/** ...over this share of the time left after the attack, then releases to silence by the end of the voice. */
const DECAY_SHARE = 0.3
/** Exponential ramps cannot reach 0; this is inaudible. */
const SILENT = 0.0001
const NOISE_SECONDS = 1
const NOISE_SEED = 0x2f6b1d3
/** Stopping a cue early: fade with this time constant, then stop the sources this long after. */
const STOP_FADE = 0.01
const STOP_AFTER = 0.05

export function buildGraph(ctx: BaseAudioContext, levels: { master: number; fx: number; music: number }): Graph {
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -12
  comp.knee.value = 12
  comp.ratio.value = 4
  comp.attack.value = 0.003
  comp.release.value = 0.25
  comp.connect(ctx.destination)

  const master = ctx.createGain()
  master.gain.value = levels.master
  master.connect(comp)

  const fx = ctx.createGain()
  fx.gain.value = levels.fx
  fx.connect(master)

  const lowpass = ctx.createBiquadFilter()
  lowpass.type = 'lowpass'
  lowpass.frequency.value = MUSIC_LOWPASS_HZ
  lowpass.connect(master)

  const music = ctx.createGain()
  music.gain.value = levels.music
  music.connect(lowpass)

  return { master, fx, music }
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

/** One second of white noise from a fixed-seed LCG, made once per context and shared by every noise voice. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseBuffers.get(ctx)
  if (cached) return cached
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let s = NOISE_SEED
  for (let i = 0; i < data.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    data[i] = s / 2147483648 - 1
  }
  noiseBuffers.set(ctx, buffer)
  return buffer
}

/**
 * Plays `voices` starting at context time `at`, every frequency (and filter, and noise playback rate) shifted by
 * `pitch` semitones. Returns a stop function that fades every voice out and stops it now.
 */
export function playVoices(
  ctx: BaseAudioContext, dest: AudioNode, voices: readonly Voice[], at: number, pitch = 0,
): () => void {
  const ratio = 2 ** (pitch / 12)
  const live = voices.map((v, i) => startVoice(ctx, dest, v, at, ratio, i))
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    const t = ctx.currentTime
    for (const { src, env } of live) {
      holdAt(env.gain, t)
      env.gain.setTargetAtTime(0, t, STOP_FADE)
      src.stop(t + STOP_AFTER)
    }
  }
}

/** Drops a param's automation after `t` but keeps its level at `t`, so a fade from there starts without a jump. */
export function holdAt(param: AudioParam, t: number) {
  // Firefox has no cancelAndHoldAtTime.
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(t)
    return
  }
  const value = param.value
  param.cancelScheduledValues(t)
  param.setValueAtTime(value, t)
}

function startVoice(ctx: BaseAudioContext, dest: AudioNode, v: Voice, at: number, ratio: number, index: number) {
  const start = at + v.at
  const end = start + v.dur

  const env = ctx.createGain()
  const attack = Math.min(v.attack ?? DEFAULT_ATTACK, v.dur / 2)
  env.gain.value = 0
  env.gain.setValueAtTime(0, start)
  env.gain.linearRampToValueAtTime(v.gain, start + attack)
  env.gain.exponentialRampToValueAtTime(v.gain * SUSTAIN, start + attack + (v.dur - attack) * DECAY_SHARE)
  env.gain.exponentialRampToValueAtTime(SILENT, end)
  env.connect(dest)

  let filter: BiquadFilterNode | null = null
  if (v.filter) {
    filter = ctx.createBiquadFilter()
    filter.type = v.filter.type
    filter.frequency.value = v.filter.freq * ratio
    filter.Q.value = v.filter.q ?? 1
    filter.connect(env)
  }
  const input: AudioNode = filter ?? env

  let src: AudioScheduledSourceNode
  if (v.wave === 'noise') {
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuffer(ctx)
    noise.loop = true
    noise.playbackRate.value = ratio
    noise.connect(input)
    // Each voice reads from a different point in the buffer, so repeated hits do not sound identical.
    noise.start(start, (index * 0.137) % (NOISE_SECONDS / 2))
    src = noise
  } else {
    const osc = ctx.createOscillator()
    osc.type = v.wave
    osc.frequency.setValueAtTime(v.freq * ratio, start)
    if (v.to !== undefined) osc.frequency.exponentialRampToValueAtTime(v.to * ratio, end)
    osc.connect(input)
    osc.start(start)
    src = osc
  }
  src.stop(end)
  src.onended = () => {
    src.disconnect()
    filter?.disconnect()
    env.disconnect()
  }
  return { src, env }
}
