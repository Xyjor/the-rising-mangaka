// The scene's characters as a table of actors: where each one is, where it is going and in what pose. `planActors`
// sets the targets from the game (never the walk itself), `stepActors` walks everyone toward them at WALK_PX_PER_S,
// one axis then the other, and `settleActors` puts everyone in place at once (a mount or a loaded save). Pure: the
// table is mutated in place, nothing here touches the DOM or the painter. Coordinates are canvas space (320x180): a
// sprite's top-left corner.
import type { Activity, Phase } from '../../sim'

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
}

export interface ActorTable { mangaka: Actor; assistants: readonly [Actor, Actor, Actor]; editor: Actor; cat: Actor }

export interface Spot { readonly x: number; readonly y: number }

export const MANGAKA_SEAT: Spot = { x: 132, y: 67 }
export const MANGAKA_STAND: Spot = { x: 170, y: 81 }
export const MANGAKA_BED: Spot = { x: 216, y: 106 }
export const DOOR_SPOT: Spot = { x: 254, y: 85 }
export const EDITOR_SPOT: Spot = { x: 198, y: 85 }
export const CAT_BED: Spot = { x: 196, y: 118 }
export const CAT_KITCHEN: Spot = { x: 44, y: 150 }
export const ASSISTANT_SEAT_Y = 89
export const ASSISTANT_SEAT_X: readonly number[] = [66, 86, 106]
/** The editor's walk from the door to their spot: 56 + 0 px at 40 px/s, 1400 ms. */
export const EDITOR_WALK_MS = ((DOOR_SPOT.x - EDITOR_SPOT.x) + (DOOR_SPOT.y - EDITOR_SPOT.y)) / WALK_PX_PER_S * 1000

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
    facing: -1, state: 'hidden', goal: 'hidden', legs: 'xy', anim: 0,
  }
}

/** Everyone at the door, hidden. */
export function newActorTable(): ActorTable {
  return { mangaka: newActor(), assistants: [newActor(), newActor(), newActor()], editor: newActor(), cat: newActor() }
}

/** Sends an actor toward a spot; an actor who is not in the room comes in through the door. */
function send(a: Actor, spot: Spot, goal: ActorState) {
  // An 'away' actor is always already at the door, so snapping it there again is a no-op.
  if (a.state === 'away' || a.state === 'hidden') { a.x = DOOR_SPOT.x; a.y = DOOR_SPOT.y }
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
  if (snap.visitor !== 'none') send(e, EDITOR_SPOT, 'standing')
  // once the editor has been in, they leave through the door; before that they stay hidden
  else if (e.goal !== 'hidden') send(e, DOOR_SPOT, 'away')

  const c = table.cat
  if (resting) { send(c, CAT_KITCHEN, 'sitting'); c.legs = 'yx' }
  else { send(c, CAT_BED, 'sleeping'); c.legs = 'xy' }
}

function stepActor(a: Actor, dtMs: number, reduced: boolean) {
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

function settle(a: Actor) { a.x = a.targetX; a.y = a.targetY; a.state = a.goal; a.anim = 0 }

/** Everyone in place at once: nobody walks in on a mount or a loaded save. */
export function settleActors(table: ActorTable): void {
  settle(table.mangaka)
  for (let i = 0; i < 3; i++) settle(table.assistants[i])
  settle(table.editor)
  settle(table.cat)
}

function off(a: Actor): boolean { return a.x !== a.targetX || a.y !== a.targetY }

/** Whether anyone is on the way somewhere (the loop repaints every step while they are). */
export function anyWalking(table: ActorTable): boolean {
  const [a, b, c] = table.assistants
  return off(table.mangaka) || off(a) || off(b) || off(c) || off(table.editor) || off(table.cat)
}
