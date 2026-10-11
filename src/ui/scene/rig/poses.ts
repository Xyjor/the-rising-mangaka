// The cast's poses (0.11.0): each a part pose (parts joined by their anchors) or a key frame (drawn whole), and where
// it is drawn: at the actor, or at the seat or the bed whatever the actor's position (a transition there plays while
// the actor already walks). Every PoseId is in the union and the table, so a pose named anywhere and not drawn fails tsc.
import {
  BED_LIE_0, BED_LIE_1, BED_SIT, CHEER_SEAT_0, CHEER_SEAT_1, CHEER_STAND_0, CHEER_STAND_1, DOZE_0, DOZE_1, PANIC_0, PANIC_1,
  SLUMP_SEAT_0, SLUMP_SEAT_1, SLUMP_STAND_0, SLUMP_STAND_1, TEAR_0, TEAR_1, TEAR_2,
} from './keyFrames'
import type { PartPose, Place, Pose } from './types'

/**
 * The walk's eight steps in order, contact, down, pass and up on each leg: one list the mangaka's walk poses and the
 * editor's are both named from (`walk.<step>`, `editor.walk-<step>`), and `ANIMS` maps into both walk loops.
 */
export const WALK_PHASES = ['contact-l', 'down-l', 'pass-l', 'up-l', 'contact-r', 'down-r', 'pass-r', 'up-r'] as const
export type WalkPhase = (typeof WALK_PHASES)[number]

export type PoseId =
  | 'stand.idle' | 'stand.breath' | 'stand.blink'
  | 'ready.idle' | 'ready.breath' | 'ready.blink'
  | `walk.${WalkPhase}`
  | 'seat.rest' | 'seat.breath' | 'seat.blink' | 'seat.draw-a' | 'seat.draw-b' | 'seat.draw-c' | 'seat.half'
  | 'bed.lie-0' | 'bed.lie-1' | 'bed.sit'
  | 'stand.look-l' | 'stand.look-r' | 'stand.sip-raise' | 'stand.sip'
  | 'seat.sip-raise' | 'seat.sip' | 'seat.stretch-a' | 'seat.stretch-b' | 'seat.flip-a' | 'seat.flip-b' | 'seat.flip-c'
  | 'seat.rub-a' | 'seat.rub-b'
  | 'key.panic-0' | 'key.panic-1' | 'key.cheer-stand-0' | 'key.cheer-stand-1' | 'key.cheer-seat-0' | 'key.cheer-seat-1'
  | 'key.slump-stand-0' | 'key.slump-stand-1' | 'key.slump-seat-0' | 'key.slump-seat-1' | 'key.tear-0' | 'key.tear-1' | 'key.tear-2'
  | 'key.doze-0' | 'key.doze-1'
  | 'editor.stand' | 'editor.breath' | 'editor.blink'
  | `editor.walk-${WalkPhase}` | 'editor.turn' | 'editor.turn-back'
  | 'editor.raise' | 'editor.glasses' | 'editor.watch' | 'editor.glance'

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

const EDITOR_HEAD_PLACE: Place = { part: 'editor-head' }

/** The editor standing (0.12.0): the suit torso at (7, 21) under his own head, the near sleeve hanging, the far one holding the case, the mangaka's legs (recoloured by EDITOR_PAL). */
function editorStand(over: Over = {}): PartPose {
  return {
    kind: 'parts', w: W, h: H, torso: { part: 'editor-torso', x: 7, y: 21 }, head: EDITOR_HEAD_PLACE,
    armBack: { part: 'arm-r-suit-case' }, armFront: { part: 'arm-l-suit-hang' },
    legBack: { part: 'leg-r-stand' }, legFront: { part: 'leg-l-stand' }, ...over,
  }
}

/** An editor walk step: the standing suit body with the torso `bob` rows lower, the given legs (the mangaka's) and sleeves (the case ones on the far arm). */
function editorWalk(bob: 0 | 1, legFront: string, legBack: string, armFront: string, armBack: string): PartPose {
  return editorStand({
    torso: { part: 'editor-torso', x: 7, y: 21 + bob },
    legFront: { part: legFront }, legBack: { part: legBack }, armFront: { part: armFront }, armBack: { part: armBack },
  })
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
  // the reactions' key frames, drawn whole with their faces, at the actor (the seated ones as the seated poses)
  'key.panic-0': { pose: { kind: 'key', map: PANIC_0 }, at: 'actor' },
  'key.panic-1': { pose: { kind: 'key', map: PANIC_1 }, at: 'actor' },
  'key.cheer-stand-0': { pose: { kind: 'key', map: CHEER_STAND_0 }, at: 'actor' },
  'key.cheer-stand-1': { pose: { kind: 'key', map: CHEER_STAND_1 }, at: 'actor' },
  'key.cheer-seat-0': { pose: { kind: 'key', map: CHEER_SEAT_0 }, at: 'actor' },
  'key.cheer-seat-1': { pose: { kind: 'key', map: CHEER_SEAT_1 }, at: 'actor' },
  'key.slump-stand-0': { pose: { kind: 'key', map: SLUMP_STAND_0 }, at: 'actor' },
  'key.slump-stand-1': { pose: { kind: 'key', map: SLUMP_STAND_1 }, at: 'actor' },
  'key.slump-seat-0': { pose: { kind: 'key', map: SLUMP_SEAT_0 }, at: 'actor' },
  'key.slump-seat-1': { pose: { kind: 'key', map: SLUMP_SEAT_1 }, at: 'actor' },
  'key.tear-0': { pose: { kind: 'key', map: TEAR_0 }, at: 'actor' },
  'key.tear-1': { pose: { kind: 'key', map: TEAR_1 }, at: 'actor' },
  'key.tear-2': { pose: { kind: 'key', map: TEAR_2 }, at: 'actor' },
  // the assistants' doze at the row's desk, the head down on the folded arms, and its breath
  'key.doze-0': { pose: { kind: 'key', map: DOZE_0 }, at: 'actor' },
  'key.doze-1': { pose: { kind: 'key', map: DOZE_1 }, at: 'actor' },
  // the editor (0.12.0), every pose at the actor: standing with the case, his breath, his blink behind the lenses
  'editor.stand': { pose: editorStand(), at: 'actor' },
  'editor.breath': { pose: editorStand({ head: { part: 'editor-head', dy: 1 } }), at: 'actor' },
  'editor.blink': { pose: editorStand({ face: { eyes: 'blink' } }), at: 'actor' },
  // his walk (task 8): the mangaka's legs and bob, the suit sleeves swinging against them, the case with the far hand
  'editor.walk-contact-l': { pose: editorWalk(0, 'leg-l-step', 'leg-r-stand', 'arm-l-suit-swing-back', 'arm-r-suit-case-fwd'), at: 'actor' },
  'editor.walk-down-l': { pose: editorWalk(1, 'leg-l-step-bend', 'leg-r-plant-bend', 'arm-l-suit-swing-back', 'arm-r-suit-case-fwd'), at: 'actor' },
  'editor.walk-pass-l': { pose: editorWalk(0, 'leg-l-stand', 'leg-r-lift', 'arm-l-suit-hang', 'arm-r-suit-case'), at: 'actor' },
  'editor.walk-up-l': { pose: editorWalk(0, 'leg-l-stand', 'leg-r-reach', 'arm-l-suit-hang', 'arm-r-suit-case'), at: 'actor' },
  'editor.walk-contact-r': { pose: editorWalk(0, 'leg-l-stand', 'leg-r-step', 'arm-l-suit-swing-fwd', 'arm-r-suit-case-back'), at: 'actor' },
  'editor.walk-down-r': { pose: editorWalk(1, 'leg-l-plant-bend', 'leg-r-step-bend', 'arm-l-suit-swing-fwd', 'arm-r-suit-case-back'), at: 'actor' },
  'editor.walk-pass-r': { pose: editorWalk(0, 'leg-l-lift', 'leg-r-stand', 'arm-l-suit-hang', 'arm-r-suit-case'), at: 'actor' },
  'editor.walk-up-r': { pose: editorWalk(0, 'leg-l-reach', 'leg-r-stand', 'arm-l-suit-hang', 'arm-r-suit-case'), at: 'actor' },
  // the turns at the spot: the head a column toward the desk with the near arm still swung back from the last step
  // arriving; a column toward the door, the arm swung forward, leaving
  'editor.turn': { pose: editorStand({ head: { part: 'editor-head', dx: -1 }, armFront: { part: 'arm-l-suit-swing-back' } }), at: 'actor' },
  'editor.turn-back': { pose: editorStand({ head: { part: 'editor-head', dx: 1 }, armFront: { part: 'arm-l-suit-swing-fwd' } }), at: 'actor' },
  // the waiting moments: the near hand raised to the chin, at the glasses (the eyes blinking behind it), the watch
  // checked with the head bowed a row, a glance toward the desk
  'editor.raise': { pose: editorStand({ armFront: { part: 'arm-l-suit-raise' } }), at: 'actor' },
  'editor.glasses': { pose: editorStand({ armFront: { part: 'arm-l-suit-glasses' }, face: { eyes: 'blink' } }), at: 'actor' },
  'editor.watch': { pose: editorStand({ armFront: { part: 'arm-l-suit-watch' }, head: { part: 'editor-head', dy: 1 } }), at: 'actor' },
  'editor.glance': { pose: editorStand({ head: { part: 'editor-head', dx: -1 } }), at: 'actor' },
}
