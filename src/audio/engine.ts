// The sound engine: owns the AudioContext (created lazily on the first user gesture), the mixer, mute and volume,
// and the guards that keep cues from piling up. Framework-free; time comes from the injected `now()` in ms.
import { CUES } from './cues'
import { createLimiter } from './limiter'
import { buildGraph, playVoices, type Graph } from './synth'
import { DEFAULT_SOUND, clamp01, levelToGain, type CueId, type SoundPrefs } from './types'

export interface SoundEngine {
  /** Call from a user gesture: creates the context on the first call, resumes it on later ones. */
  unlock(): void
  readonly unlocked: boolean
  /** True while the context is running. An unlock outside a real gesture leaves it suspended (unlocked, not running). */
  readonly running: boolean
  /** Plays a cue now. Returns a function that stops it early (a no-op when nothing played). */
  play(cue: CueId, opts?: { pitch?: number }): () => void
  setPrefs(p: SoundPrefs): void
  levels(): { master: number; fx: number; music: number }
  startMusic(): void
  stopMusic(): void
  /** Lowers the music bus to `level` (0..1) of its normal level; duck(1) restores it. */
  duck(level: number): void
  suspend(): void
  resume(): void
  dispose(): void
}

export interface SoundEngineOptions {
  createContext: () => AudioContext | null
  /** Milliseconds, any origin. Defaults to performance.now. */
  now?: () => number
}

/** Most voices that may sound at the same moment. */
export const MAX_VOICES = 24
/**
 * For this long after unlock() or any other resume, cues play even while resume() is pending, so the cue of the
 * gesture that woke the context is not lost.
 */
export const UNLOCK_GRACE_MS = 300
export const FX_LEVEL = 0.8
export const MUSIC_LEVEL = 0.5
/** Time constants (s) for level changes: quick for volume and mute, slower for ducking. */
const LEVEL_GLIDE = 0.02
const DUCK_GLIDE = 0.08

/** The bus levels the prefs ask for: master from mute and volume, fx fixed, music on or off (before any duck). */
export function levelsFor(p: SoundPrefs): { master: number; fx: number; music: number } {
  return { master: p.muted ? 0 : levelToGain(p.volume), fx: FX_LEVEL, music: p.music ? MUSIC_LEVEL : 0 }
}

const noop = () => {}
const GAPS: Record<string, number> = Object.fromEntries(Object.entries(CUES).map(([id, cue]) => [id, cue.gapMs]))

/** When a voice sounds, in now() ms: from s (start) to e (end). */
interface Span {
  s: number
  e: number
}

interface Playing {
  spans: Span[]
  stopped: boolean
}

/**
 * The most spans sounding at the same moment from `t` on. The count only rises where a span starts, so checking each
 * span's start (or `t`, for spans already sounding) finds the peak.
 */
function peakOverlap(spans: readonly Span[], t: number): number {
  let peak = 0
  for (const span of spans) {
    const at = Math.max(span.s, t)
    let n = 0
    for (const other of spans) if (other.s <= at && at < other.e) n++
    peak = Math.max(peak, n)
  }
  return peak
}

export function createSoundEngine(o: SoundEngineOptions): SoundEngine {
  const now = o.now ?? (() => performance.now())
  const limiter = createLimiter(GAPS)
  const turns = new Map<CueId, number>()
  let prefs: SoundPrefs = { ...DEFAULT_SOUND }
  let duckLevel = 1
  let ctx: AudioContext | null = null
  let graph: Graph | null = null
  let created = false
  let disposed = false
  /** When the context was last asked to resume: the start of the grace. */
  let wokeAt = Number.NEGATIVE_INFINITY
  let playing: Playing[] = []

  const levels = () => levelsFor(prefs)
  const musicLevel = () => levels().music * duckLevel
  const glide = (param: AudioParam, value: number, timeConstant: number) => {
    if (ctx) param.setTargetAtTime(value, ctx.currentTime, timeConstant)
  }

  /** Resumes the context and starts the grace, so a cue played right away is scheduled while resume() is pending. */
  const wake = () => {
    if (!ctx) return
    wokeAt = now()
    void ctx.resume().catch(noop)
  }

  /** The peak of live voices plus `add`, from `t` on. Forgets plays that have ended or were stopped. */
  function peakWith(t: number, add: readonly Span[]): number {
    playing = playing.filter((p) => !p.stopped && p.spans.some((span) => span.e > t))
    const live = playing.flatMap((p) => p.spans.filter((span) => span.e > t))
    return peakOverlap([...live, ...add], t)
  }

  return {
    get running() {
      return ctx?.state === 'running'
    },

    get unlocked() {
      return graph !== null
    },

    unlock() {
      if (disposed) return
      if (!created) {
        created = true
        ctx = o.createContext()
        if (ctx) graph = buildGraph(ctx, { ...levels(), music: musicLevel() })
      }
      if (!ctx) return
      if (prefs.muted) {
        if (ctx.state === 'running') void ctx.suspend().catch(noop)
      } else if (ctx.state !== 'running') {
        wake()
      }
    },

    play(cue, opts) {
      if (!ctx || !graph || prefs.muted) return noop
      const t = now()
      if (ctx.state !== 'running' && t - wokeAt > UNLOCK_GRACE_MS) return noop
      const def = CUES[cue]
      const spans = def.voices.map((v) => ({ s: t + v.at * 1000, e: t + (v.at + v.dur) * 1000 }))
      if (peakWith(t, spans) > MAX_VOICES) return noop
      if (!limiter.allow(cue, t)) return noop

      let pitch = opts?.pitch ?? 0
      if (def.vary && def.vary.length > 0) {
        const turn = turns.get(cue) ?? 0
        turns.set(cue, turn + 1)
        pitch += def.vary[turn % def.vary.length]
      }
      const stopVoices = playVoices(ctx, graph.fx, def.voices, ctx.currentTime, pitch)
      const entry: Playing = { spans, stopped: false }
      playing.push(entry)
      return () => {
        if (entry.stopped || disposed) return
        entry.stopped = true
        stopVoices()
      }
    },

    setPrefs(p) {
      const wasMuted = prefs.muted
      prefs = { ...p }
      if (!ctx || !graph) return
      glide(graph.master.gain, levels().master, LEVEL_GLIDE)
      glide(graph.music.gain, musicLevel(), LEVEL_GLIDE)
      if (prefs.muted && !wasMuted) void ctx.suspend().catch(noop)
      else if (!prefs.muted && wasMuted) wake()
    },

    levels,

    // Music arrives in a later task; until then these are safe no-ops.
    startMusic() {},
    stopMusic() {},

    duck(level) {
      duckLevel = clamp01(level)
      if (graph) glide(graph.music.gain, musicLevel(), DUCK_GLIDE)
    },

    suspend() {
      if (ctx) void ctx.suspend().catch(noop)
    },

    resume() {
      if (!prefs.muted) wake()
    },

    dispose() {
      disposed = true
      if (ctx) void ctx.close().catch(noop)
      ctx = null
      graph = null
      playing = []
    },
  }
}
