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
  /** A fans or level-up pop fired within the last CHEER_MS. */
  cheer: boolean
  stamina: number
  /** The mangaka is at the desk working, at night. */
  lateNight: boolean
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

/** Which set and frame the standing mangaka's idle cycle shows. */
export type IdlePose = { set: 'breathe' | 'stretch' | 'sip'; index: 0 | 1 }

// Every pose idleFrame can return, built once (not allocated per frame): same values every time the same pose comes
// up, so callers may compare by identity (idleFrame(0) === idleFrame(32)).
/** The breathing pose only, exposed so render.ts's ready branch (manuscript in hand) can share the same table. */
export const BREATHE_POSES: readonly [IdlePose, IdlePose] = [{ set: 'breathe', index: 0 }, { set: 'breathe', index: 1 }]
const STRETCH_POSES: readonly [IdlePose, IdlePose] = [{ set: 'stretch', index: 0 }, { set: 'stretch', index: 1 }]
const SIP_POSES: readonly [IdlePose, IdlePose] = [{ set: 'sip', index: 0 }, { set: 'sip', index: 1 }]

/**
 * The standing mangaka's 360-frame idle cycle (Decision 6): breathing (0-239, today's frame/16 % 2), a stretch
 * (240-299, 2 frames, frame/15 % 2) and a sip from a mug (300-359, 2 frames, frame/15 % 2), then back to breathing.
 * Frame 0 (reduced motion) is always the plain idle (breathe, 0), which falls out of the cycle math on its own.
 */
export function idleFrame(frame: number): IdlePose {
  const f = ((frame % 360) + 360) % 360
  if (f < 240) return BREATHE_POSES[Math.floor(f / 16) % 2]
  if (f < 300) return STRETCH_POSES[Math.floor(f / 15) % 2]
  return SIP_POSES[Math.floor(f / 15) % 2]
}

/** Which set and frame the sitting cat's idle cycle shows. */
export type CatPose = { set: 'sit' | 'groom' | 'stretch'; index: 0 | 1 }

// Same idea as the mangaka's poses above: pre-built constants, not allocated per frame.
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
