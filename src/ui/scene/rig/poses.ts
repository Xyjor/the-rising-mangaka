// The cast's poses (0.11.0): each a part pose (parts joined by their anchors) or a key frame (drawn whole), and where
// it is drawn: at the actor, or at the seat or the bed whatever the actor's position (a transition there plays while
// the actor already walks). Every PoseId is in the union and the table, so a pose named anywhere and not drawn fails tsc.
import { BED_LIE_0, BED_LIE_1, BED_SIT } from './keyFrames'
import type { PartPose, Place, Pose } from './types'

export type PoseId =
  | 'stand.idle' | 'stand.breath' | 'stand.blink'
  | 'ready.idle' | 'ready.breath' | 'ready.blink'
  | 'walk.contact-l' | 'walk.down-l' | 'walk.pass-l' | 'walk.up-l' | 'walk.contact-r' | 'walk.down-r' | 'walk.pass-r' | 'walk.up-r'
  | 'seat.rest' | 'seat.breath' | 'seat.blink' | 'seat.draw-a' | 'seat.draw-b' | 'seat.draw-c' | 'seat.half'
  | 'bed.lie-0' | 'bed.lie-1' | 'bed.sit'
  | 'stand.look-l' | 'stand.look-r' | 'stand.sip-raise' | 'stand.sip'
  | 'seat.sip-raise' | 'seat.sip' | 'seat.stretch-a' | 'seat.stretch-b' | 'seat.flip-a' | 'seat.flip-b' | 'seat.flip-c'
  | 'seat.rub-a' | 'seat.rub-b'

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

/** The ready stance's near arm and the manuscript it holds at the chest, over the standing body. */
const HOLD: Over = { armFront: { part: 'arm-l-hold' }, prop: { part: 'manuscript' } }

/** A walk step: the standing body with the torso `bob` rows lower, the given legs and arms. */
function walk(bob: 0 | 1, legFront: string, legBack: string, armFront: string, armBack: string): PartPose {
  return stand({
    torso: { part: 'torso', x: 7, y: 21 + bob },
    legFront: { part: legFront }, legBack: { part: legBack }, armFront: { part: armFront }, armBack: { part: armBack },
  })
}

/** Seated: the torso at (7, 27), so the head lands at (4, 6) and the hips on row 40, the desk top's line at the seat. */
function seat(over: Over = {}): PartPose {
  return {
    kind: 'parts', w: W, h: H, torso: { part: 'torso', x: 7, y: 27 }, head: HEAD,
    armBack: { part: 'arm-r-desk' }, armFront: { part: 'arm-l-rest' },
    legBack: { part: 'leg-r-seat' }, legFront: { part: 'leg-l-seat' }, ...over,
  }
}

export const POSES: Readonly<Record<PoseId, PoseDef>> = {
  'stand.idle': { pose: stand(), at: 'actor' },
  'stand.breath': { pose: stand({ head: { part: 'head', dy: 1 } }), at: 'actor' },
  'stand.blink': { pose: stand({ face: { eyes: 'blink' } }), at: 'actor' },
  'ready.idle': { pose: stand(HOLD), at: 'actor' },
  'ready.breath': { pose: stand({ ...HOLD, head: { part: 'head', dy: 1 } }), at: 'actor' },
  'ready.blink': { pose: stand({ ...HOLD, face: { eyes: 'blink' } }), at: 'actor' },
  'walk.contact-l': { pose: walk(0, 'leg-l-step', 'leg-r-stand', 'arm-l-swing-back', 'arm-r-swing-fwd'), at: 'actor' },
  'walk.down-l': { pose: walk(1, 'leg-l-step-bend', 'leg-r-plant-bend', 'arm-l-swing-back', 'arm-r-swing-fwd'), at: 'actor' },
  'walk.pass-l': { pose: walk(0, 'leg-l-stand', 'leg-r-lift', 'arm-l-hang', 'arm-r-hang'), at: 'actor' },
  'walk.up-l': { pose: walk(0, 'leg-l-stand', 'leg-r-reach', 'arm-l-hang', 'arm-r-hang'), at: 'actor' },
  'walk.contact-r': { pose: walk(0, 'leg-l-stand', 'leg-r-step', 'arm-l-swing-fwd', 'arm-r-swing-back'), at: 'actor' },
  'walk.down-r': { pose: walk(1, 'leg-l-plant-bend', 'leg-r-step-bend', 'arm-l-swing-fwd', 'arm-r-swing-back'), at: 'actor' },
  'walk.pass-r': { pose: walk(0, 'leg-l-lift', 'leg-r-stand', 'arm-l-hang', 'arm-r-hang'), at: 'actor' },
  'walk.up-r': { pose: walk(0, 'leg-l-reach', 'leg-r-stand', 'arm-l-hang', 'arm-r-hang'), at: 'actor' },
  'seat.rest': { pose: seat(), at: 'actor' },
  'seat.breath': { pose: seat({ head: { part: 'head', dy: 1 } }), at: 'actor' },
  'seat.blink': { pose: seat({ face: { eyes: 'blink' } }), at: 'actor' },
  'seat.draw-a': { pose: seat({ armFront: { part: 'arm-l-desk-a' }, prop: { part: 'pen' } }), at: 'actor' },
  'seat.draw-b': { pose: seat({ armFront: { part: 'arm-l-desk-b' }, prop: { part: 'pen' } }), at: 'actor' },
  'seat.draw-c': { pose: seat({ armFront: { part: 'arm-l-desk-c' }, prop: { part: 'pen' } }), at: 'actor' },
  // halfway down to the chair, drawn at the seat (sitting down and standing up): the torso at (7, 24), so the head
  // lands at (4, 3) and the hips on row 37, the arms hanging, the knees bent halfway (rows 37-47)
  'seat.half': {
    pose: {
      kind: 'parts', w: W, h: H, torso: { part: 'torso', x: 7, y: 24 }, head: HEAD,
      armBack: { part: 'arm-r-hang' }, armFront: { part: 'arm-l-hang' }, legBack: { part: 'leg-r-half' }, legFront: { part: 'leg-l-half' },
    },
    at: 'seat',
  },
  'bed.lie-0': { pose: { kind: 'key', map: BED_LIE_0 }, at: 'bed' },
  'bed.lie-1': { pose: { kind: 'key', map: BED_LIE_1 }, at: 'bed' },
  'bed.sit': { pose: { kind: 'key', map: BED_SIT }, at: 'bed' },
  // the idle moments: a glance either way, the sip standing and at the desk, the stretch, the page flipped right to
  // left, the left eye rubbed when tired
  'stand.look-l': { pose: stand({ head: { part: 'head', dx: -1 } }), at: 'actor' },
  'stand.look-r': { pose: stand({ head: { part: 'head', dx: 1 } }), at: 'actor' },
  'stand.sip-raise': { pose: stand({ armFront: { part: 'arm-l-mug-half' }, prop: { part: 'mug' } }), at: 'actor' },
  'stand.sip': { pose: stand({ armFront: { part: 'arm-l-mug' }, prop: { part: 'mug' }, face: { eyes: 'closed' } }), at: 'actor' },
  'seat.sip-raise': { pose: seat({ armFront: { part: 'arm-l-mug-half' }, prop: { part: 'mug' } }), at: 'actor' },
  'seat.sip': { pose: seat({ armFront: { part: 'arm-l-mug' }, prop: { part: 'mug' }, face: { eyes: 'closed' } }), at: 'actor' },
  'seat.stretch-a': { pose: seat({ armFront: { part: 'arm-l-out' }, armBack: { part: 'arm-r-out' } }), at: 'actor' },
  'seat.stretch-b': { pose: seat({ armFront: { part: 'arm-l-up' }, armBack: { part: 'arm-r-up' }, face: { eyes: 'closed' } }), at: 'actor' },
  'seat.flip-a': { pose: seat({ armFront: { part: 'arm-l-flip-a' }, prop: { part: 'page' } }), at: 'actor' },
  'seat.flip-b': { pose: seat({ armFront: { part: 'arm-l-flip-b' }, prop: { part: 'page' } }), at: 'actor' },
  'seat.flip-c': { pose: seat({ armFront: { part: 'arm-l-flip-c' }, prop: { part: 'page' } }), at: 'actor' },
  'seat.rub-a': { pose: seat({ armFront: { part: 'arm-l-rub-a' }, face: { eyes: 'squint' } }), at: 'actor' },
  'seat.rub-b': { pose: seat({ armFront: { part: 'arm-l-rub-b' }, face: { eyes: 'squint' } }), at: 'actor' },
}
