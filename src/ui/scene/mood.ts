// The mood overlay's pure rules: which mood wins (moodOf) and how long a cheer lasts after a pop worth celebrating
// (cheersFor). No React, no DOM; render.ts and StudioScene.tsx both read this.
import { LOW_STAMINA_THRESHOLD } from '../../sim'
import type { PopKind } from './Pops'

export type Mood = 'neutral' | 'happy' | 'tired' | 'surprised' | 'sleepy'

export interface MoodInput {
  /** The mangaka (or assistant) is in the studio, not away or at the job. */
  home: boolean
  /** The editor is standing in the studio, visiting. */
  editorHere: boolean
  /** A fans or xp/level pop fired within the last CHEER_MS. */
  cheer: boolean
  stamina: number
  /** The activity is rest. */
  resting: boolean
  night: boolean
}

/**
 * The mood's priority order (Decision 4): surprised beats happy beats tired beats sleepy beats neutral. Panic (the
 * seated mangaka late on a chapter) is not a mood; it stays the existing MANGAKA_PANIC frames and is handled by the
 * caller before this is ever consulted.
 */
export function moodOf(m: MoodInput): Mood {
  if (m.home && m.editorHere) return 'surprised'
  if (m.cheer) return 'happy'
  if (m.stamina < LOW_STAMINA_THRESHOLD) return 'tired'
  if (m.resting && m.night) return 'sleepy'
  return 'neutral'
}

/** How long the happy mood holds after a fans or level pop, in ms. */
export const CHEER_MS = 2400

/**
 * True when a fans pop, or a level-up pop (an 'xp' pop with `levelUp: true`, not an ordinary xp gain), is among
 * these pops: a moment worth a happy mood. Plain xp accrues continuously, so it must not cheer on its own (Decision
 * 4 means this as a rare 2.4s beat, not a near-constant state).
 */
export function cheersFor(pops: readonly { kind: PopKind; levelUp?: boolean }[]): boolean {
  return pops.some((p) => p.kind === 'fans' || p.levelUp === true)
}
