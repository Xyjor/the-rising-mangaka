// The cast's poses (0.11.0): each a part pose (parts joined by their anchors) or a key frame (drawn whole), and where
// it is drawn: at the actor, or at the seat or the bed whatever the actor's position (a transition there plays while
// the actor already walks). Every PoseId is in the union and the table, so a pose named anywhere and not drawn fails tsc.
import type { PartPose, Place, Pose } from './types'

export type PoseId = 'stand.idle' | 'stand.breath' | 'stand.blink'

export interface PoseDef { readonly pose: Pose; readonly at: 'actor' | 'seat' | 'bed' }

const W = 32
const H = 48
const HEAD: Place = { part: 'head' }
type Over = Partial<Omit<PartPose, 'kind' | 'w' | 'h'>>

/** Standing: the torso at (7, 21), so the head lands at (4, 0) and the hips on row 34; the arms hang. */
function stand(over: Over = {}): PartPose {
  return {
    kind: 'parts', w: W, h: H, torso: { part: 'torso', x: 7, y: 21 }, head: HEAD,
    armBack: { part: 'arm-r-hang' }, armFront: { part: 'arm-l-hang' },
    legBack: { part: 'leg-r-stand' }, legFront: { part: 'leg-l-stand' }, ...over,
  }
}

export const POSES: Readonly<Record<PoseId, PoseDef>> = {
  'stand.idle': { pose: stand(), at: 'actor' },
  'stand.breath': { pose: stand({ head: { part: 'head', dy: 1 } }), at: 'actor' },
  'stand.blink': { pose: stand({ face: { eyes: 'blink' } }), at: 'actor' },
}
