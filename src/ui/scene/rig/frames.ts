// The rig's frames as the sprite cache draws them (0.11.0): a pose with the face its mood picks, assembled on first use
// and memoized, so render looks each one up by pose and mood and allocates nothing once it is built.
import { assemblePose } from './assemble'
import { FACE_ART, FACE_BY_MOOD } from './head'
import { PARTS } from './parts'
import { POSES } from './poses'
import type { PoseId } from './poses'
import type { CastFrame, Face, Mood, PartPose } from './types'

export const MOODS: readonly Mood[] = ['neutral', 'happy', 'tired', 'surprised', 'sleepy']
const MOOD_INDEX: Readonly<Record<Mood, number>> = { neutral: 0, happy: 1, tired: 2, surprised: 3, sleepy: 4 }

/** A part pose's face: the mood's, the pose's own slots over it, and no mark while the manuscript is ready (the '!' goes there). */
export function faceOf(pose: PartPose, mood: Mood, ready: boolean): Face {
  const face: Face = { ...FACE_BY_MOOD[mood], ...pose.face }
  return ready ? { ...face, mark: 'none' } : face
}

/** A frame's id: a key pose's own id; a part pose's with its face, `stand.idle~open.closed.none`. */
export function frameId(pose: PoseId, face: Face | null): string {
  return face ? `${pose}~${face.eyes}.${face.mouth}.${face.mark}` : pose
}

const memo = new Map<PoseId, (CastFrame | undefined)[]>()

/** The cast frame for a pose in a mood, ready or not: built on first use, the same object every time after. */
export function rigFrame(id: PoseId, mood: Mood, ready: boolean): CastFrame {
  let row = memo.get(id)
  if (!row) {
    row = []
    memo.set(id, row)
  }
  const pose = POSES[id].pose
  const k = pose.kind === 'key' ? 0 : MOOD_INDEX[mood] * 2 + (ready ? 1 : 0)
  let f = row[k]
  if (!f) {
    if (pose.kind === 'key') f = { id: frameId(id, null), map: pose.map }
    else {
      const face = faceOf(pose, mood, ready)
      f = { id: frameId(id, face), map: assemblePose(pose, PARTS, FACE_ART, face) }
    }
    row[k] = f
  }
  return f
}
