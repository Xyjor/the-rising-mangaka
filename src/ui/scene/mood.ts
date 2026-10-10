// The cast's mood rules, pure: which mood wins (moodOf) and how long a cheer lasts after a pop worth celebrating
// (cheersFor), and the cat's idle cycle (catFrame). No React, no DOM; render.ts and StudioScene.tsx both read this.
import { LOW_STAMINA_THRESHOLD } from '../../sim'
import type { PopKind } from './Pops'
import type { Mood } from './rig/types'

export type { Mood }

export interface MoodInput {
  /** The mangaka (or assistant) is in the studio, not away or at the job. */
  home: boolean
  /** The editor is standing in the studio, visiting. */
  editorHere: boolean
  /** A fans or level-up pop fired within the last CHEER_MS. */
  cheer: boolean
  stamina: number
  /** The mangaka is at the desk working, at night. */
  lateNight: boolean
}

/**
 * The mood's priority order (Decision 4): surprised beats happy beats tired beats sleepy beats neutral. Panic (the
 * seated mangaka late on a chapter) is not a mood: it is the late loop's key frames (`seat-draw-late`), which wear their
 * own face.
 */
export function moodOf(m: MoodInput): Mood {
  if (m.home && m.editorHere) return 'surprised'
  if (m.cheer) return 'happy'
  if (m.stamina < LOW_STAMINA_THRESHOLD) return 'tired'
  if (m.lateNight) return 'sleepy'
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

/** Which set and frame the sitting cat's idle cycle shows. */
export type CatPose = { set: 'sit' | 'groom' | 'stretch'; index: 0 | 1 }

// Pre-built constants, not allocated per frame: the same object every time the same pose comes up.
const SIT_POSE: CatPose = { set: 'sit', index: 0 }
const GROOM_POSES: readonly [CatPose, CatPose] = [{ set: 'groom', index: 0 }, { set: 'groom', index: 1 }]
const STRETCH_POSE: CatPose = { set: 'stretch', index: 0 }

/**
 * The sitting cat's 480-frame idle cycle (Decision 6): CAT_SIT (0-359), a groom (360-419, 2 frames, frame/15 % 2)
 * and a stretch (420-479, one frame), then back to sitting. Frame 0 is always the plain sit.
 */
export function catFrame(frame: number): CatPose {
  const f = ((frame % 480) + 480) % 480
  if (f < 360) return SIT_POSE
  if (f < 420) return GROOM_POSES[Math.floor(f / 15) % 2]
  return STRETCH_POSE
}
