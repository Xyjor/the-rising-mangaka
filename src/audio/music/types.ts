// The music's shared types (0.13.0): the instruments and the parts they mix into, one note event as the arranger
// writes it, the scene the player follows, and the voice a note becomes once scheduled. Types and one lookup only.
import type { Season } from '../../sim'

/** Every instrument the arranger writes for. */
export type Inst = 'keys' | 'bass' | 'lead' | 'kick' | 'snare' | 'hat' | 'shaker'

/** The four mix parts; each instrument plays through one of them. */
export type Part = 'keys' | 'bass' | 'lead' | 'drums'

/** Which part each instrument's level follows: the drum kit shares one. */
export const PART_OF: Record<Inst, Part> = {
  keys: 'keys', bass: 'bass', lead: 'lead', kick: 'drums', snare: 'drums', hat: 'drums', shaker: 'drums',
}

/** The lead's three timbres, chosen per track. */
export type LeadVoice = 'bell' | 'soft' | 'glock'

/** One note as the arranger writes it. */
export interface MusicEvent {
  inst: Inst
  /** MIDI note number; 0 for the unpitched drums. */
  midi: number
  /** Seconds from the track's start. */
  at: number
  dur: number
  /** Velocity, 0..1. */
  vel: number
  /** An open hat. */
  open?: boolean
}

/** What the music follows: the title screen or the studio, the game's season, and a calm moment. */
export interface MusicScene { mood: 'title' | 'studio'; season: Season; calm: boolean }

/** A scheduled note: when it ends, and a way to cut it short. */
export interface Voice { readonly end: number; stop(at: number): void }

/** Plays one event into `out`; here `e.at` is absolute context time. */
export type VoiceFn = (ctx: BaseAudioContext, out: AudioNode, e: MusicEvent, lead: LeadVoice) => Voice
