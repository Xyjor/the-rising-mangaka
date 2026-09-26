// Audio domain types and the player's sound preferences. Framework-free: nothing here touches React or the store.

/** Every sound the game makes. The recipes live in cues.ts. */
export type CueId =
  | 'click' | 'pause' | 'resume' | 'page' | 'send' | 'start' | 'ready' | 'submit'
  | 'hire' | 'depart' | 'return' | 'chapter' | 'chapter-top' | 'chapter-weak' | 'coins'
  | 'levelup' | 'milestone' | 'warn' | 'cancel' | 'offer' | 'serialised' | 'event' | 'award'
  | 'drumroll' | 'bar' | 'stamp' | 'fanfare' | 'jingle-up' | 'jingle-mid' | 'jingle-down'
  | 'knock' | 'pop'

/** What every voice has. Times are seconds from the start of the cue. */
interface VoiceShape {
  at: number
  dur: number
  /** Peak gain, above 0 and at most 0.3. */
  gain: number
  /** Seconds from silence to peak (default 0.005). */
  attack?: number
  filter?: { type: BiquadFilterType; freq: number; q?: number }
}

/** An oscillator note. */
export interface ToneVoice extends VoiceShape {
  wave: 'square' | 'triangle' | 'sine'
  /** Frequency in Hz. */
  freq: number
  /** Glide target in Hz (above 0), reached as the voice ends. */
  to?: number
}

/** A burst of white noise, shaped by its filter. */
export interface NoiseVoice extends VoiceShape {
  wave: 'noise'
}

/** One enveloped tone or noise burst inside a cue. */
export type Voice = ToneVoice | NoiseVoice

export interface CueDef {
  voices: readonly Voice[]
  /** Shortest time between two plays of this cue, in ms (0 = no limit). */
  gapMs: number
  /** Semitone offsets taken in turn on each play, so a repeated cue does not sound identical. */
  vary?: readonly number[]
}

export interface SoundPrefs {
  muted: boolean
  /** Slider position, 0..1. The gain is its square (levelToGain). */
  volume: number
  music: boolean
}

export const DEFAULT_SOUND: Readonly<SoundPrefs> = Object.freeze({ muted: false, volume: 0.5, music: true })

/** Clamp to 0..1, with NaN treated as 0. */
export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.min(1, Math.max(0, v))
}

/** Slider level to gain: squared, so equal slider steps sound like roughly equal loudness steps. */
export function levelToGain(v: number): number {
  const c = clamp01(v)
  return c * c
}

/** Sound prefs from anything (a save, a partial object): valid fields kept, volume clamped, the rest defaulted. */
export function normalizeSound(raw: unknown): SoundPrefs {
  const p: Partial<Record<keyof SoundPrefs, unknown>> = raw !== null && typeof raw === 'object' ? raw : {}
  return {
    muted: typeof p.muted === 'boolean' ? p.muted : DEFAULT_SOUND.muted,
    volume: typeof p.volume === 'number' && !Number.isNaN(p.volume) ? clamp01(p.volume) : DEFAULT_SOUND.volume,
    music: typeof p.music === 'boolean' ? p.music : DEFAULT_SOUND.music,
  }
}
