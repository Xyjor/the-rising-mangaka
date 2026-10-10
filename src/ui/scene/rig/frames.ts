// The rig's frames as the sprite cache draws them (0.11.0): a pose with the face its mood picks, assembled on first use
// and memoized, so render looks each one up by pose and mood and allocates nothing once it is built.
import { assemblePose, placeLayers } from './assemble'
import { FACE_ART, FACE_BY_MOOD } from './head'
import { PARTS } from './parts'
import { POSES } from './poses'
import type { PoseId } from './poses'
import type { CastFrame, Face, FaceArt, Mood, PartPose, Point } from './types'

/** The face art each head part takes, by the part's name (the editor's head has its own eyes, with the lens rims). */
const FACE_ART_BY_HEAD: Readonly<Record<string, FaceArt>> = { head: FACE_ART }

/** The face art for a part pose: its head part's. */
export function faceArtOf(pose: PartPose): FaceArt {
  const art = FACE_ART_BY_HEAD[pose.head.part]
  if (!art) throw new Error(`no face art for the head ${pose.head.part}`)
  return art
}

const hands = new Map<PoseId, Point | null>()

/**
 * Where a part pose's front hand is in its frame (the front arm's hand anchor), null for a key frame or a pose with no
 * front arm: the visit's prop is drawn there. Found once per pose and kept, so render allocates nothing.
 */
export function frontHand(id: PoseId): Point | null {
  let p = hands.get(id)
  if (p === undefined) {
    const pose = POSES[id].pose
    const arm = pose.kind === 'parts' && pose.armFront ? placeLayers(pose, PARTS).get('armFront') : undefined
    const hand = arm?.part.anchors.hand
    p = arm && hand ? { x: arm.at.x + hand.x, y: arm.at.y + hand.y } : null
    hands.set(id, p)
  }
  return p
}

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
      f = { id: frameId(id, face), map: assemblePose(pose, PARTS, faceArtOf(pose), face) }
    }
    row[k] = f
  }
  return f
}
