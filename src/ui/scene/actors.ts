// The scene's characters as a table of actors: where each one is, where it is going and in what pose. `planActors`
// sets the targets from the game (never the walk itself), `stepActors` walks everyone toward them at WALK_PX_PER_S,
// one axis then the other, and `settleActors` puts everyone in place at once (a mount or a loaded save). Pure: the
// table is mutated in place, nothing here touches the DOM or the painter. Coordinates are canvas space (320x180): a
// sprite's top-left corner.
import type { Activity, Phase } from '../../sim'
import type { PoseId } from './rig/poses'

export const WALK_PX_PER_S = 40

export type ActorState = 'seated' | 'standing' | 'walking' | 'sleeping' | 'sitting' | 'away' | 'hidden'
/** Which axis a walk takes first: x then y, or y then x. */
export type Legs = 'xy' | 'yx'

export interface Actor {
  x: number
  y: number
  targetX: number
  targetY: number
  facing: 1 | -1
  /** The pose now ('walking' on the way). */
  state: ActorState
  /** The pose on arrival. */
  goal: ActorState
  legs: Legs
  /** Milliseconds walked on this walk (drives the walk cycle); 0 when still. */
  anim: number
  /**
   * The rig pose showing now (castPlay.ts sets it each step); '' for an actor the driver has not posed (render then
   * draws its base loop's first step) or that draws its 0.10 frames (the cat, until 0.13.0).
   */
  pose: PoseId | ''
  /**
   * Milliseconds the actor stays put in its state whatever its target (a verdict playing, the 0.12.0 plan's decision
   * 14): stepActors counts it down; 0 when free. Presentation only.
   */
  holdMs: number
}

export interface ActorTable { mangaka: Actor; assistants: readonly [Actor, Actor, Actor]; editor: Actor; cat: Actor }

export interface Spot { readonly x: number; readonly y: number }

/**
 * The mangaka's spots for the 32x48 rig (0.11.0, the plan's decision 2; each checked against the furniture in
 * actors.test): the seat (the waist, row 40, on the desk top y 98; the head under the corkboard; clear of the arm
 * lamp), the standing spot (the feet on row 47 at y 128), the bed (where the actor walks to and lies: its standing head,
 * cols 4-27 and rows 0-21, sits on the bed frames' lying and sitting-up head, so walking into or out of bed the head never
 * jumps; the frames themselves are drawn at `MANGAKA_BED_FRAME`); its door is everyone's, `DOOR_SPOT`.
 */
export const MANGAKA_SEAT: Spot = { x: 124, y: 58 }
export const MANGAKA_STAND: Spot = { x: 170, y: 81 }
export const MANGAKA_BED: Spot = { x: 220, y: 90 }
/**
 * The bed key frames' origin (48x32, drawn here whatever the actor's position): the lying head at cols 23-46 (x
 * 224-247) over the pillow (x 232-245). The actor's bed spot is 19 px right of it, so its standing head sits on the
 * lying head.
 */
export const MANGAKA_BED_FRAME: Spot = { x: 201, y: 90 }
/**
 * The door, everyone's: the feet on the door's floor line, y 116, centred on the door; the mangaka's since 0.11.0, the
 * editor's since 0.12.0.
 */
export const DOOR_SPOT: Spot = { x: 250, y: 69 }
/** The editor's spot for the 32x48 rig (0.12.0): in front of the bed, his feet on the floor (y 137), facing the desk. */
export const EDITOR_SPOT: Spot = { x: 205, y: 90 }
/** The cat's bed on the blanket: clear of the standing frame at the stand (to x 201) and of the lying head (from x 224). */
export const CAT_BED: Spot = { x: 202, y: 118 }
export const CAT_KITCHEN: Spot = { x: 44, y: 150 }
/**
 * The assistants' seats for the 32x48 rig (0.11.0, the plan's decision 3, each checked in actors.test): one row, 34 px
 * apart, in front of the main desk, from x 21 (the first head and page inside the phone crop, x 24) to the third head
 * ending at the stock desk's left edge (x 116); the seated waist (row 40) on their desk top (y 120).
 */
export const ASSISTANT_SEAT_Y = 80
export const ASSISTANT_SEAT_X: readonly number[] = [21, 55, 89]
/** The editor's walk from the door to his spot: 45 + 21 px at 40 px/s, 1650 ms. */
export const EDITOR_WALK_MS = (Math.abs(DOOR_SPOT.x - EDITOR_SPOT.x) + Math.abs(DOOR_SPOT.y - EDITOR_SPOT.y)) / WALK_PX_PER_S * 1000

/** What the plan reads from the scene's snapshot. */
export interface ActorPlanInput {
  phase: Phase
  activity: Activity
  stamina: number
  away: boolean
  assistants: readonly { stamina: number }[]
  visitor: 'none' | 'editor'
}

function newActor(): Actor {
  return {
    x: DOOR_SPOT.x, y: DOOR_SPOT.y, targetX: DOOR_SPOT.x, targetY: DOOR_SPOT.y,
    facing: -1, state: 'hidden', goal: 'hidden', legs: 'xy', anim: 0, pose: '', holdMs: 0,
  }
}

/** Everyone at the door, hidden. */
export function newActorTable(): ActorTable {
  return { mangaka: newActor(), assistants: [newActor(), newActor(), newActor()], editor: newActor(), cat: newActor() }
}

/** Sends an actor toward a spot; an actor who is not in the room comes in through `door`. */
function send(a: Actor, spot: Spot, goal: ActorState, door: Spot = DOOR_SPOT) {
  // An 'away' actor is always already at the door, so snapping it there again is a no-op.
  if (a.state === 'away' || a.state === 'hidden') { a.x = door.x; a.y = door.y }
  a.targetX = spot.x
  a.targetY = spot.y
  a.goal = goal
}

/** Puts an actor at a spot at once, in its pose (the assistants never walk). */
function place(a: Actor, x: number, y: number, state: ActorState) {
  a.x = x; a.y = y; a.targetX = x; a.targetY = y
  a.state = state; a.goal = state; a.anim = 0
}

/** Sets everyone's target and goal from the game (the same absent, busy and resting rules as the painter). */
export function planActors(table: ActorTable, snap: ActorPlanInput): void {
  const absent = snap.away || snap.activity === 'job'
  const busy = !absent && snap.phase === 'drawing' && snap.activity === 'work' && snap.stamina > 0
  const resting = !absent && !busy && snap.phase !== 'idle' && snap.phase !== 'ready'

  const m = table.mangaka
  if (busy) send(m, MANGAKA_SEAT, 'seated')
  else if (resting) send(m, MANGAKA_BED, 'sleeping')
  else if (absent) send(m, DOOR_SPOT, 'away')
  else send(m, MANGAKA_STAND, 'standing')

  const n = Math.min(3, snap.assistants.length)
  for (let i = 0; i < 3; i++) {
    const a = table.assistants[i]
    if (i < n) {
      const asleep = snap.assistants[i].stamina <= 0 || snap.activity === 'rest'
      place(a, ASSISTANT_SEAT_X[i], ASSISTANT_SEAT_Y, asleep ? 'sleeping' : 'seated')
    } else place(a, DOOR_SPOT.x, DOOR_SPOT.y, 'hidden')
  }

  const e = table.editor
  // in: down from the door, then along the floor (y first), so the frame crosses the bed in front of it; out: the way back
  if (snap.visitor !== 'none') { send(e, EDITOR_SPOT, 'standing'); e.legs = 'yx' }
  // once the editor has been in, they leave through the door; before that they stay hidden
  else if (e.goal !== 'hidden') { send(e, DOOR_SPOT, 'away'); e.legs = 'xy' }

  const c = table.cat
  if (resting) { send(c, CAT_KITCHEN, 'sitting'); c.legs = 'yx' }
  else { send(c, CAT_BED, 'sleeping'); c.legs = 'xy' }
}

function stepActor(a: Actor, dtMs: number, reduced: boolean) {
  // held: where it is, in its state, the hold counting down; reduced motion (which snaps) clears it instead
  if (a.holdMs > 0) {
    if (!reduced) { a.holdMs = Math.max(0, a.holdMs - dtMs); a.anim = 0; return }
    a.holdMs = 0
  }
  if (a.x === a.targetX && a.y === a.targetY) { a.state = a.goal; a.anim = 0; return }
  if (reduced) { a.x = a.targetX; a.y = a.targetY; a.state = a.goal; a.anim = 0; return }
  let budget = dtMs * WALK_PX_PER_S / 1000
  for (let pass = 0; pass < 2 && budget > 0; pass++) {
    const alongX = (pass === 0) === (a.legs === 'xy')
    const d = alongX ? a.targetX - a.x : a.targetY - a.y
    if (d === 0) continue
    const move = Math.abs(d) <= budget + 1e-6 ? d : Math.sign(d) * budget
    budget -= Math.abs(move)
    if (alongX) {
      a.facing = d > 0 ? 1 : -1
      a.x = move === d ? a.targetX : a.x + move
    } else a.y = move === d ? a.targetY : a.y + move
  }
  const arrived = a.x === a.targetX && a.y === a.targetY
  a.state = arrived ? a.goal : 'walking'
  a.anim = arrived ? 0 : a.anim + dtMs
}

/** Walks everyone toward their targets for dtMs; `reduced` (reduced motion) snaps them there. */
export function stepActors(table: ActorTable, dtMs: number, reduced: boolean): void {
  stepActor(table.mangaka, dtMs, reduced)
  for (let i = 0; i < 3; i++) stepActor(table.assistants[i], dtMs, reduced)
  stepActor(table.editor, dtMs, reduced)
  stepActor(table.cat, dtMs, reduced)
}

function settle(a: Actor) { a.x = a.targetX; a.y = a.targetY; a.state = a.goal; a.anim = 0; a.holdMs = 0 }

/** Everyone in place at once: nobody walks in on a mount or a loaded save. */
export function settleActors(table: ActorTable): void {
  settle(table.mangaka)
  for (let i = 0; i < 3; i++) settle(table.assistants[i])
  settle(table.editor)
  settle(table.cat)
}

/**
 * The editor back outside the door, still headed wherever the plan sends them: after a settle, they walk in again
 * (a new career's tutorial opens with the editor arriving rather than already standing there).
 */
export function editorWalksIn(table: ActorTable): void {
  const e = table.editor
  e.x = DOOR_SPOT.x; e.y = DOOR_SPOT.y; e.facing = -1; e.state = 'hidden'; e.anim = 0
}

function off(a: Actor): boolean { return a.x !== a.targetX || a.y !== a.targetY }

/** Whether anyone is on the way somewhere (the loop repaints every step while they are). */
export function anyWalking(table: ActorTable): boolean {
  const [a, b, c] = table.assistants
  return off(table.mangaka) || off(a) || off(b) || off(c) || off(table.editor) || off(table.cat)
}
