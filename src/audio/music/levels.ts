// The music's mix levels for a scene (0.13.0): the tone filter, the room and each part's level, from the scene and the
// track playing (or none, between tracks). A calm moment darkens the tone, drops the drums and softens the lead.
import type { CompiledTrack } from './score'
import type { MusicScene, Part } from './types'

/** The tone filter's cutoff in a calm moment, in Hz. */
export const CALM_TONE = 1300
/** The title screen's tone cutoff, in Hz. */
export const TITLE_TONE = 2000
/** The tone cutoff with no track playing, in Hz. */
export const DEFAULT_TONE = 2600
/** The room's wet level with no track playing. */
export const DEFAULT_SPACE = 0.22
/** The lead's factor in a calm moment. */
export const CALM_LEAD = 0.6

/** What the player sets on its chain: tone cutoff in Hz, room wet level, and each part's level. */
export interface MixLevels { tone: number; space: number; parts: Record<Part, number> }

/** The levels for `scene` over `track` (null between tracks: the defaults, every part at 1). */
export function levelsFor(scene: MusicScene, track: Pick<CompiledTrack, 'tone' | 'space' | 'mix'> | null): MixLevels {
  const tone = scene.calm ? CALM_TONE : scene.mood === 'title' ? TITLE_TONE : (track?.tone ?? DEFAULT_TONE)
  const base: Record<Part, number> = track ? { ...track.mix } : { keys: 1, bass: 1, lead: 1, drums: 1 }
  const parts = scene.calm ? { ...base, drums: 0, lead: base.lead * CALM_LEAD } : base
  return { tone, space: track?.space ?? DEFAULT_SPACE, parts }
}
