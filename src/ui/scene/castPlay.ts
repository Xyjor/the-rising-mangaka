// The cast driver (0.11.0; the editor since 0.12.0): each loop step it turns every rig-drawn actor's state (actors.ts)
// into a pose on the actor (`Actor.pose`) through the animation player: the base loop for the state, the transition
// between two states, the idle moments the seeded schedule picks and the reactions the snapshot's cue brings. The
// tracks are mutated in place, like the actor table; the rules they follow are pure functions, tested alone. No
// clock: StudioScene passes its scene time. The cat keeps its 0.10 frames until 0.13.0.
import { LOW_STAMINA_THRESHOLD } from '../../sim'
import type { Actor, ActorState, ActorTable } from './actors'
import { advance, animLength, enqueue, interrupt, poseAt, settle, startPlayer, switchBase } from './animation'
import type { Anim, PlayerState } from './animation'
import { nextIdle } from './idleSchedule'
import type { ReactionCue, ReactionKind } from './reactions'
import { ANIMS } from './rig/anims'
import type { AnimId } from './rig/anims'
import type { PoseId } from './rig/poses'

export type CastWho = 'mangaka' | 'assistant' | 'editor'

/** What picks a base loop besides the state: drawing with the clock running, the chapter late, the manuscript ready. */
export interface CastContext { working: boolean; late: boolean; ready: boolean }

/** The base loop for a character in a state, or null when it is not drawn (away, hidden; the editor only stands and walks). */
export function baseAnimFor(who: CastWho, state: ActorState, c: CastContext): AnimId | null {
  if (who === 'editor') return state === 'standing' ? 'editor-stand' : state === 'walking' ? 'editor-walk' : null
  switch (state) {
    case 'seated': return c.working ? (c.late && who === 'mangaka' ? 'seat-draw-late' : 'seat-draw') : 'seat-idle'
    case 'standing': return who === 'mangaka' ? (c.ready ? 'stand-ready' : 'stand') : null
    case 'walking': return who === 'mangaka' ? 'walk' : null
    case 'sleeping': return who === 'mangaka' ? 'sleep' : 'doze'
    default: return null
  }
}

/**
 * The transition between two states for a character, or null: the people down into the chair and up out of it, into
 * bed and out of it; the editor's turn at the spot on arriving and back toward the door on leaving.
 */
export function transitionFor(who: CastWho, from: ActorState, to: ActorState): AnimId | null {
  if (who === 'editor') {
    if (from === 'walking' && to === 'standing') return 'editor-arrive'
    if (from === 'standing' && to === 'walking') return 'editor-leave'
    return null
  }
  if (from === 'walking' && to === 'seated') return 'sit-down'
  if (from === 'seated' && to === 'walking') return 'stand-up'
  if (from === 'walking' && to === 'sleeping') return 'lie-down'
  if (from === 'sleeping' && to === 'walking') return 'get-up'
  return null
}

const STAND_POOL: readonly AnimId[] = ['stand-look', 'stand-sip']
const SEAT_POOL: readonly AnimId[] = ['seat-stretch', 'seat-sip', 'seat-flip']
const TIRED_POOL: readonly AnimId[] = ['seat-rub', 'seat-sip']
/** The editor's waiting moments: pushing up the glasses, checking the watch, a glance at the manuscript pile. */
const EDITOR_POOL: readonly AnimId[] = ['editor-glasses', 'editor-watch', 'editor-glance']
const NO_POOL: readonly AnimId[] = []

/**
 * The idle moments a base loop picks from: standing, a look around or a sip; at the desk, a stretch, a sip or a page
 * flipped, or, tired, rubbing the eyes; the editor waiting, his own three.
 */
export function idlePool(base: AnimId, tired: boolean): readonly AnimId[] {
  if (base === 'stand') return STAND_POOL
  if (base === 'seat-draw' || base === 'seat-idle') return tired ? TIRED_POOL : SEAT_POOL
  if (base === 'editor-stand') return EDITOR_POOL
  return NO_POOL
}

/** Every idle moment (the pools' animations): a reaction cuts one short; it waits behind a transition or another reaction. */
export const IDLE_MOMENTS: ReadonlySet<string> = new Set<AnimId>([...STAND_POOL, ...SEAT_POOL, ...TIRED_POOL, ...EDITOR_POOL])

/**
 * The animation a reaction plays for a character in a state, or null (the 0.11.0 plan's decision 7; the editor's
 * verdicts, 0.12.0: a nod on an offer or a good poll, a sigh on a bad one, only standing at the spot).
 */
export function reactionAnim(kind: ReactionKind, who: CastWho, state: ActorState): AnimId | null {
  const seated = state === 'seated'
  const standing = state === 'standing'
  if (who === 'editor') {
    if (!standing) return null
    return kind === 'offer' || kind === 'good-poll' ? 'editor-nod' : kind === 'bad-poll' ? 'editor-sigh' : null
  }
  if (who === 'assistant') return kind === 'good-poll' && seated ? 'seat-cheer' : null
  switch (kind) {
    case 'good-poll':
    case 'level-up': return standing ? 'stand-cheer' : seated ? 'seat-cheer' : null
    case 'bad-poll': return standing ? 'stand-slump' : seated ? 'seat-slump' : null
    case 'late': return seated ? 'seat-panic' : null
    case 'missed': return seated ? 'seat-tear' : null
    // the mangaka and the assistants ignore an offer; the editor nods at it (above)
    case 'offer': return null
  }
}

/** Whether a dev preview animation is the character's own: the editor plays only `editor-*`, and no one else does. */
export function previewFits(who: CastWho, anim: Anim): boolean {
  return anim.id.startsWith('editor-') === (who === 'editor')
}

/** The loop walks the actors (and counts a hold down) once before the driver takes a cue: a hold outlasts its verdict by this much. */
export const VERDICT_HOLD_SLACK_MS = 50

/**
 * How long the editor stays at the spot for a reaction cue (the 0.12.0 plan's decision 14): his verdict's length plus
 * the slack while he stands (the nod on an offer or a good poll, the sigh on a bad one), 0 when the cue is not his
 * or he is not standing. StudioScene sets `Actor.holdMs` from it before the plan sends him to the door. It ignores a
 * transition still playing: a cue inside the 160 ms `editor-arrive` queues behind the turn and the hold ends up to
 * 110 ms before the verdict does (unreachable in play: the cue comes from a click on a card that mounts on arrival).
 */
export function verdictHoldMs(kind: ReactionKind, editor: Actor): number {
  const r = reactionAnim(kind, 'editor', editor.state)
  return r === null ? 0 : animLength(ANIMS[r]) + VERDICT_HOLD_SLACK_MS
}

/** The rig head's top row in a state's frame: 6 seated, 8 in the bed frame, else 0 (bubbles and pops sit above it). */
export function headTop(state: ActorState): number {
  return state === 'seated' ? 6 : state === 'sleeping' ? 8 : 0
}

/**
 * The rig head's centre column from the actor: 16 (cols 4-27) in every state. In bed too: the actor's bed spot stands
 * on the lying head's column (the bed frame's cols 23-46, its centre 201 + 35 = 220 + 16).
 */
export function headCentre(_state: ActorState): number {
  return 16
}

/** One character's animation: its player, the state it last saw, the last cue it took, its idle schedule. */
export interface Track {
  player: PlayerState<PoseId> | null
  state: ActorState
  cue: number
  /** The game day the count is for, and the moments counted that day (the schedule's seed). */
  idleDay: number
  idleN: number
  /** When the next idle moment fires, on the scene clock; -1 until it is scheduled. A new day never moves it. */
  nextIdleAt: number
}

export interface CastPlay { readonly mangaka: Track; readonly assistants: readonly [Track, Track, Track]; readonly editor: Track }

function newTrack(): Track {
  return { player: null, state: 'hidden', cue: 0, idleDay: -1, idleN: 0, nextIdleAt: -1 }
}

export function newCastPlay(): CastPlay {
  return { mangaka: newTrack(), assistants: [newTrack(), newTrack(), newTrack()], editor: newTrack() }
}

/** What the driver reads each step besides the actor table (StudioScene fills one object in place). */
export interface CastInput {
  day: number
  working: boolean
  late: boolean
  ready: boolean
  stamina: number
  assistants: readonly { stamina: number }[]
  reaction: ReactionCue | null
  /** A dev build's `?rig=<animation>`: played over every base of its posture on its own character whenever nothing else plays. */
  preview: AnimId | null
}

/** How far apart the seats' loops start, so the assistants' pens never move in step. */
export const PHASE_MS = 150
/** The editor's seat in the idle schedule and the phase (the mangaka is 0, the assistants 1-3). */
export const EDITOR_SEAT = 4

const ctx: CastContext = { working: false, late: false, ready: false }

function baseOf(who: CastWho, a: Actor, input: CastInput): AnimId | null {
  ctx.working = input.working
  ctx.late = input.late
  ctx.ready = input.ready
  return baseAnimFor(who, a.state, ctx)
}

/** The stamina the idle pool reads for a seat: the mangaka's, an assistant's own, the editor's never low. */
function staminaOf(who: CastWho, seat: number, input: CastInput): number {
  if (who === 'mangaka') return input.stamina
  if (who === 'assistant') return input.assistants[seat - 1]?.stamina ?? 100
  return 100
}

function stepTrack(t: Track, a: Actor, who: CastWho, seat: number, input: CastInput, now: number, reduced: boolean): void {
  const id = baseOf(who, a, input)
  if (id === null) {
    t.player = null
    t.state = a.state
    a.pose = ''
    return
  }
  const base = ANIMS[id]
  if (!t.player) {
    t.player = startPlayer(base, now - seat * PHASE_MS)
    t.cue = input.reaction?.id ?? t.cue
  } else if (base !== t.player.base) {
    // a new base keeps the seat's phase (so the assistants' pens never fall into step); a transition starts now
    const tr = reduced ? null : transitionFor(who, t.state, a.state)
    t.player = switchBase(t.player, base, tr === null ? null : ANIMS[tr], tr === null ? now - seat * PHASE_MS : now)
  }
  t.state = a.state
  // end what played out since the last step first, so nothing below sees a finished one-shot as still playing
  t.player = advance(t.player, now)
  if (input.reaction && input.reaction.id !== t.cue) {
    t.cue = input.reaction.id
    const r = reduced ? null : reactionAnim(input.reaction.kind, who, a.state)
    if (r !== null) {
      // a reaction cuts an idle moment short; it waits behind a transition or another reaction
      const playing = t.player.over?.anim.id
      t.player = playing !== undefined && IDLE_MOMENTS.has(playing) ? interrupt(t.player, ANIMS[r], now) : enqueue(t.player, ANIMS[r], now)
    }
  }
  if (reduced) {
    a.pose = base.steps[0].pose
    return
  }
  // a new game day restarts the count (the schedule's seed), never the wait: days turn every 220-1000 ms while the
  // clock runs, and the shortest wait is 6 s
  if (t.idleDay !== input.day) {
    t.idleDay = input.day
    t.idleN = 0
  }
  if (t.nextIdleAt < 0) t.nextIdleAt = now + nextIdle(input.day, seat, t.idleN).gapMs
  if (now >= t.nextIdleAt) {
    const pool = idlePool(id, staminaOf(who, seat, input) < LOW_STAMINA_THRESHOLD)
    if (pool.length && !t.player.over) t.player = enqueue(t.player, ANIMS[pool[nextIdle(input.day, seat, t.idleN).pick % pool.length]], now)
    t.idleN++
    t.nextIdleAt = now + nextIdle(input.day, seat, t.idleN).gapMs
  }
  const preview = input.preview === null ? null : ANIMS[input.preview]
  if (preview && preview !== base && preview.posture === base.posture && previewFits(who, preview) && !t.player.over) {
    t.player = enqueue(t.player, preview, now)
  }
  a.pose = poseAt(t.player, now)
}

/**
 * One loop step for the whole cast at scene time `now` (the mangaka, the three assistants' seats and the editor at the
 * fifth seat; the cat keeps its 0.10 frames); `reduced` (reduced motion) holds every base's first step.
 */
export function stepCast(play: CastPlay, table: ActorTable, input: CastInput, now: number, reduced: boolean): void {
  stepTrack(play.mangaka, table.mangaka, 'mangaka', 0, input, now, reduced)
  for (let i = 0; i < 3; i++) stepTrack(play.assistants[i], table.assistants[i], 'assistant', i + 1, input, now, reduced)
  stepTrack(play.editor, table.editor, 'editor', EDITOR_SEAT, input, now, reduced)
}

function settleTrack(t: Track, a: Actor, who: CastWho, seat: number, input: CastInput, now: number): void {
  const id = baseOf(who, a, input)
  t.player = id === null ? null : startPlayer(ANIMS[id], now - seat * PHASE_MS)
  t.state = a.state
  t.cue = input.reaction?.id ?? t.cue
  t.idleDay = -1
  t.nextIdleAt = -1
  a.pose = id === null ? '' : ANIMS[id].steps[0].pose
}

/** Everyone on their base loop from now (a mount, a loaded save): no transition, the waiting cue taken as seen. */
export function settleCast(play: CastPlay, table: ActorTable, input: CastInput, now: number): void {
  settleTrack(play.mangaka, table.mangaka, 'mangaka', 0, input, now)
  for (let i = 0; i < 3; i++) settleTrack(play.assistants[i], table.assistants[i], 'assistant', i + 1, input, now)
  settleTrack(play.editor, table.editor, 'editor', EDITOR_SEAT, input, now)
}

/**
 * The window shown again: every transition and moment jumps to its end, each base going on from now at its seat's
 * phase (so the assistants stay `PHASE_MS` apart), and every idle wait is re-armed from the next step.
 */
export function resumeCast(play: CastPlay, now: number): void {
  const tracks = [play.mangaka, ...play.assistants, play.editor]
  for (let seat = 0; seat < tracks.length; seat++) {
    const t = tracks[seat]
    if (t.player) t.player = settle(t.player, now, now - seat * PHASE_MS)
    t.nextIdleAt = -1
  }
}
