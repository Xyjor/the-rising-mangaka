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

/** Most voices that may be playing or scheduled at once. */
export const MAX_VOICES = 24
/** For this long after unlock(), cues play even while resume() is pending, so the unlocking click is heard. */
export const UNLOCK_GRACE_MS = 300
export const FX_LEVEL = 0.8
export const MUSIC_LEVEL = 0.5
/** Time constants (s) for level changes: quick for volume and mute, slower for ducking. */
const LEVEL_GLIDE = 0.02
const DUCK_GLIDE = 0.08

const noop = () => {}
const GAPS: Record<string, number> = Object.fromEntries(Object.entries(CUES).map(([id, cue]) => [id, cue.gapMs]))

interface Playing {
  /** Scheduled end of each voice, in now() ms. */
  ends: number[]
  stopped: boolean
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
  let unlockedAt = Number.NEGATIVE_INFINITY
  let playing: Playing[] = []

  const levels = () => ({
    master: prefs.muted ? 0 : levelToGain(prefs.volume),
    fx: FX_LEVEL,
    music: prefs.music ? MUSIC_LEVEL : 0,
  })
  const musicLevel = () => levels().music * duckLevel
  const glide = (param: AudioParam, value: number, timeConstant: number) => {
    if (ctx) param.setTargetAtTime(value, ctx.currentTime, timeConstant)
  }

  /** Voices played and not yet ended or stopped. Forgets plays that are over. */
  function activeVoices(t: number): number {
    playing = playing.filter((p) => !p.stopped && p.ends.some((e) => e > t))
    return playing.reduce((n, p) => n + p.ends.filter((e) => e > t).length, 0)
  }

  return {
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
      unlockedAt = now()
      if (prefs.muted) {
        if (ctx.state === 'running') void ctx.suspend().catch(noop)
      } else if (ctx.state !== 'running') {
        void ctx.resume().catch(noop)
      }
    },

    play(cue, opts) {
      if (!ctx || !graph || prefs.muted) return noop
      const t = now()
      if (ctx.state !== 'running' && t - unlockedAt > UNLOCK_GRACE_MS) return noop
      const def = CUES[cue]
      const active = activeVoices(t)
      // A cue always fits into a silent engine (the 30-hit drumroll needs that); otherwise it must fit under the cap.
      if (active > 0 && active + def.voices.length > MAX_VOICES) return noop
      if (!limiter.allow(cue, t)) return noop

      let pitch = opts?.pitch ?? 0
      if (def.vary && def.vary.length > 0) {
        const turn = turns.get(cue) ?? 0
        turns.set(cue, turn + 1)
        pitch += def.vary[turn % def.vary.length]
      }
      const stopVoices = playVoices(ctx, graph.fx, def.voices, ctx.currentTime, pitch)
      const entry: Playing = { ends: def.voices.map((v) => t + (v.at + v.dur) * 1000), stopped: false }
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
      else if (!prefs.muted && wasMuted) void ctx.resume().catch(noop)
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
      if (ctx && !prefs.muted) void ctx.resume().catch(noop)
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
