// The cast's animations (0.11.0): every step a pose and how long it shows. The ids, postures and looping are final,
// and every one of the cast's 0.11 animations is drawn (the stand-in that played until each landed is gone since the
// doze, task 18). The editor's (0.12.0): an editor animation whose art has not landed plays one step of `editor.stand`
// (EDITOR_STAND_IN) until tasks 8-10 draw it.
import type { Anim, Posture, Step } from '../animation'
import type { PoseId } from './poses'

export type AnimId =
  | 'stand' | 'stand-ready' | 'walk' | 'seat-draw' | 'seat-draw-late' | 'seat-idle' | 'sleep' | 'doze'
  | 'sit-down' | 'stand-up' | 'lie-down' | 'get-up'
  | 'stand-look' | 'stand-sip' | 'seat-stretch' | 'seat-sip' | 'seat-flip' | 'seat-rub'
  | 'stand-cheer' | 'seat-cheer' | 'stand-slump' | 'seat-slump' | 'seat-panic' | 'seat-tear'
  | 'editor-stand' | 'editor-walk' | 'editor-arrive' | 'editor-leave' | 'editor-glasses' | 'editor-watch' | 'editor-glance'
  | 'editor-nod' | 'editor-sigh'

/** Every animation in the sheet's order: base loops, transitions, idle moments, reactions; then the editor's. */
export const ANIM_IDS: readonly AnimId[] = [
  'stand', 'stand-ready', 'walk', 'seat-draw', 'seat-draw-late', 'seat-idle', 'sleep', 'doze',
  'sit-down', 'stand-up', 'lie-down', 'get-up',
  'stand-look', 'stand-sip', 'seat-stretch', 'seat-sip', 'seat-flip', 'seat-rub',
  'stand-cheer', 'seat-cheer', 'stand-slump', 'seat-slump', 'seat-panic', 'seat-tear',
  'editor-stand', 'editor-walk', 'editor-arrive', 'editor-leave', 'editor-glasses', 'editor-watch', 'editor-glance',
  'editor-nod', 'editor-sigh',
]

function anim(id: AnimId, posture: Posture, loop: boolean, steps: readonly Step<PoseId>[]): Anim<PoseId> {
  return { id, posture, loop, steps }
}

/** The walk: contact, down, pass and up on each leg, 75 ms a step, 600 ms a cycle (24 px at 40 px/s, 1.5x the 0.10 stride). */
const WALK_STEPS = ([
  'walk.contact-l', 'walk.down-l', 'walk.pass-l', 'walk.up-l', 'walk.contact-r', 'walk.down-r', 'walk.pass-r', 'walk.up-r',
] as const).map((pose) => ({ pose, ms: 75 }))

/** The pen across the page and back: left, middle, right, middle, 150 ms a step, 600 ms a stroke. */
const DRAW_STEPS: readonly Step<PoseId>[] = [
  { pose: 'seat.draw-a', ms: 150 }, { pose: 'seat.draw-b', ms: 150 }, { pose: 'seat.draw-c', ms: 150 }, { pose: 'seat.draw-b', ms: 150 },
]
/**
 * The panic, both hands on the head and back a row lower, twice, 160 ms a step (0.10's 4 frames of 10 at 24 fps): the
 * seated panic reaction, and the head of the late loop, so the panic recurs while late and reduced motion (the loop's
 * first step held) still shows it.
 */
const PANIC_STEPS: readonly Step<PoseId>[] = [
  { pose: 'key.panic-0', ms: 160 }, { pose: 'key.panic-1', ms: 160 }, { pose: 'key.panic-0', ms: 160 }, { pose: 'key.panic-1', ms: 160 },
]

/** Down into the chair: the half-sitting pose at the seat, 140 ms, where the walk stopped (no pop on arriving). */
const SIT_DOWN: readonly Step<PoseId>[] = [{ pose: 'seat.half', ms: 140 }]
/**
 * Up out of the chair: the half-sitting pose at the seat, 80 ms. The actor already walks (decision 1), so when the
 * walk shows it has moved on from the seat: at the plan's 140 ms the pose held four 24 fps frames and the walk then
 * jumped 8 px; at 80 ms it holds two and the walk shows 5 px on (6 at the 50 ms steps of a 60 Hz display).
 */
const STAND_UP: readonly Step<PoseId>[] = [{ pose: 'seat.half', ms: 80 }]
/**
 * Into bed and out of it: sitting up in bed, 220 ms. Leaving, the walk shows 12 px from the bed (8.8 px at 40 px/s,
 * held to the next frame); the head's own jump (the bed frame's col 23 to the standing frame's col 4) is larger.
 */
const SIT_UP: readonly Step<PoseId>[] = [{ pose: 'bed.sit', ms: 220 }]

/**
 * The idle moments, each a one-shot over its base loop. A glance left and right, 500 ms each, the plain stance
 * 150 ms after each. The sip: the mug raised under the chin 200 ms, at the mouth with the eyes closed 700 ms, lowered
 * under the chin 200 ms. The stretch: the arms out 250 ms, up beside the head with the eyes closed 700 ms, out again
 * 250 ms. The page flipped right to left, 200 ms a step. The left eye rubbed when tired, the fist at the eye and a row
 * lower, twice over, 250 ms a step.
 */
const LOOK: readonly Step<PoseId>[] = [
  { pose: 'stand.look-l', ms: 500 }, { pose: 'stand.idle', ms: 150 }, { pose: 'stand.look-r', ms: 500 }, { pose: 'stand.idle', ms: 150 },
]
const STAND_SIP: readonly Step<PoseId>[] = [
  { pose: 'stand.sip-raise', ms: 200 }, { pose: 'stand.sip', ms: 700 }, { pose: 'stand.sip-raise', ms: 200 },
]
const SEAT_SIP: readonly Step<PoseId>[] = [
  { pose: 'seat.sip-raise', ms: 200 }, { pose: 'seat.sip', ms: 700 }, { pose: 'seat.sip-raise', ms: 200 },
]
const STRETCH: readonly Step<PoseId>[] = [
  { pose: 'seat.stretch-a', ms: 250 }, { pose: 'seat.stretch-b', ms: 700 }, { pose: 'seat.stretch-a', ms: 250 },
]
const FLIP: readonly Step<PoseId>[] = [{ pose: 'seat.flip-a', ms: 200 }, { pose: 'seat.flip-b', ms: 200 }, { pose: 'seat.flip-c', ms: 200 }]
const RUB: readonly Step<PoseId>[] = [
  { pose: 'seat.rub-a', ms: 250 }, { pose: 'seat.rub-b', ms: 250 }, { pose: 'seat.rub-a', ms: 250 }, { pose: 'seat.rub-b', ms: 250 },
]

/**
 * The reactions, each a one-shot over its base loop. The cheer: the fists up 200 ms, the hands open a row higher 200 ms,
 * twice, then the fists held 400 ms (standing, it springs out of a crouch). The slump: the head bowed 800 ms, a sigh a
 * row lower 800 ms. The torn page: held up 250 ms, creased 200 ms, in halves 300 ms, and again.
 */
const cheer = (a: PoseId, b: PoseId): readonly Step<PoseId>[] => [
  { pose: a, ms: 200 }, { pose: b, ms: 200 }, { pose: a, ms: 200 }, { pose: b, ms: 200 }, { pose: a, ms: 400 },
]
const TEAR: readonly Step<PoseId>[] = [
  { pose: 'key.tear-0', ms: 250 }, { pose: 'key.tear-1', ms: 200 }, { pose: 'key.tear-2', ms: 300 },
  { pose: 'key.tear-1', ms: 200 }, { pose: 'key.tear-2', ms: 300 },
]

/** The assistants' doze at their desk: the head on the folded arms, then the breath (head and shoulders a row lower), 900 ms each, as the bed's sleep. */
const DOZE: readonly Step<PoseId>[] = [{ pose: 'key.doze-0', ms: 900 }, { pose: 'key.doze-1', ms: 900 }]

/** One step of the editor's standing pose, while an editor animation's art has not landed (0.12.0, tasks 8-10). */
const EDITOR_STAND_IN: readonly Step<PoseId>[] = [{ pose: 'editor.stand', ms: 500 }]

export const ANIMS: Readonly<Record<AnimId, Anim<PoseId>>> = {
  stand: anim('stand', 'stand', true, [
    { pose: 'stand.idle', ms: 500 }, { pose: 'stand.breath', ms: 500 }, { pose: 'stand.idle', ms: 500 },
    { pose: 'stand.breath', ms: 500 }, { pose: 'stand.idle', ms: 500 }, { pose: 'stand.breath', ms: 380 },
    { pose: 'stand.blink', ms: 120 },
  ]),
  'stand-ready': anim('stand-ready', 'stand', true, [
    { pose: 'ready.idle', ms: 500 }, { pose: 'ready.breath', ms: 500 }, { pose: 'ready.idle', ms: 500 },
    { pose: 'ready.breath', ms: 380 }, { pose: 'ready.blink', ms: 120 },
  ]),
  walk: anim('walk', 'walk', true, WALK_STEPS),
  'seat-draw': anim('seat-draw', 'seat', true, DRAW_STEPS),
  'seat-draw-late': anim('seat-draw-late', 'seat', true, [...PANIC_STEPS, ...DRAW_STEPS, ...DRAW_STEPS, ...DRAW_STEPS, ...DRAW_STEPS, ...DRAW_STEPS]),
  'seat-idle': anim('seat-idle', 'seat', true, [
    { pose: 'seat.rest', ms: 500 }, { pose: 'seat.breath', ms: 500 }, { pose: 'seat.rest', ms: 500 },
    { pose: 'seat.breath', ms: 380 }, { pose: 'seat.blink', ms: 120 },
  ]),
  sleep: anim('sleep', 'bed', true, [{ pose: 'bed.lie-0', ms: 900 }, { pose: 'bed.lie-1', ms: 900 }]),
  doze: anim('doze', 'bed', true, DOZE),
  'sit-down': anim('sit-down', 'seat', false, SIT_DOWN),
  'stand-up': anim('stand-up', 'walk', false, STAND_UP),
  'lie-down': anim('lie-down', 'bed', false, SIT_UP),
  'get-up': anim('get-up', 'walk', false, SIT_UP),
  'stand-look': anim('stand-look', 'stand', false, LOOK),
  'stand-sip': anim('stand-sip', 'stand', false, STAND_SIP),
  'seat-stretch': anim('seat-stretch', 'seat', false, STRETCH),
  'seat-sip': anim('seat-sip', 'seat', false, SEAT_SIP),
  'seat-flip': anim('seat-flip', 'seat', false, FLIP),
  'seat-rub': anim('seat-rub', 'seat', false, RUB),
  'stand-cheer': anim('stand-cheer', 'stand', false, cheer('key.cheer-stand-0', 'key.cheer-stand-1')),
  'seat-cheer': anim('seat-cheer', 'seat', false, cheer('key.cheer-seat-0', 'key.cheer-seat-1')),
  'stand-slump': anim('stand-slump', 'stand', false, [{ pose: 'key.slump-stand-0', ms: 800 }, { pose: 'key.slump-stand-1', ms: 800 }]),
  'seat-slump': anim('seat-slump', 'seat', false, [{ pose: 'key.slump-seat-0', ms: 800 }, { pose: 'key.slump-seat-1', ms: 800 }]),
  'seat-panic': anim('seat-panic', 'seat', false, PANIC_STEPS),
  'seat-tear': anim('seat-tear', 'seat', false, TEAR),
  // the editor (0.12.0): his standing loop on the mangaka's timing; the rest stand-ins until tasks 8-10 draw them
  'editor-stand': anim('editor-stand', 'stand', true, [
    { pose: 'editor.stand', ms: 500 }, { pose: 'editor.breath', ms: 500 }, { pose: 'editor.stand', ms: 500 },
    { pose: 'editor.breath', ms: 500 }, { pose: 'editor.stand', ms: 500 }, { pose: 'editor.breath', ms: 380 },
    { pose: 'editor.blink', ms: 120 },
  ]),
  'editor-walk': anim('editor-walk', 'walk', true, EDITOR_STAND_IN),
  'editor-arrive': anim('editor-arrive', 'stand', false, EDITOR_STAND_IN),
  'editor-leave': anim('editor-leave', 'walk', false, EDITOR_STAND_IN),
  'editor-glasses': anim('editor-glasses', 'stand', false, EDITOR_STAND_IN),
  'editor-watch': anim('editor-watch', 'stand', false, EDITOR_STAND_IN),
  'editor-glance': anim('editor-glance', 'stand', false, EDITOR_STAND_IN),
  'editor-nod': anim('editor-nod', 'stand', false, EDITOR_STAND_IN),
  'editor-sigh': anim('editor-sigh', 'stand', false, EDITOR_STAND_IN),
}
