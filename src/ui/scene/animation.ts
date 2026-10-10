// The animation player (0.11.0), pure: an animation is a list of steps (a pose and how long it shows), looping or played
// once; a player holds a character's base loop, the one-shot playing over it (a transition, an idle moment or a
// reaction) and the one-shots waiting. Time is the scene's own clock in ms (StudioScene); nothing here reads a clock,
// and a step where nothing ends returns the same state object.

/** How a character is posed: a base change between two postures drops the moments drawn for the old one. */
export type Posture = 'stand' | 'walk' | 'seat' | 'bed'

export interface Step<P extends string = string> { readonly pose: P; readonly ms: number }

export interface Anim<P extends string = string> {
  readonly id: string
  readonly posture: Posture
  readonly loop: boolean
  readonly steps: readonly Step<P>[]
}

/** An animation's length in ms: the sum of its steps. */
export function animLength(a: Anim): number {
  let n = 0
  for (const s of a.steps) n += s.ms
  return n
}

/** The step showing `t` ms in (before 0, the first): a loop wraps; a one-shot past its end holds its last step. */
export function stepAt<P extends string>(a: Anim<P>, t: number): Step<P> {
  const len = animLength(a)
  let at = t <= 0 || len <= 0 ? 0 : a.loop ? t % len : Math.min(t, len - 1)
  for (const s of a.steps) {
    if (at < s.ms) return s
    at -= s.ms
  }
  return a.steps[a.steps.length - 1]
}

/** A one-shot playing over the base: the animation and when it started. */
export interface Overlay<P extends string = string> { readonly anim: Anim<P>; readonly at: number }

export interface PlayerState<P extends string = string> {
  /** The base loop (the actor state's) and when it started, so a loop keeps its phase under a moment. */
  readonly base: Anim<P>
  readonly baseAt: number
  /** The one-shot playing now, or null. */
  readonly over: Overlay<P> | null
  /** One-shots waiting, each starting when the one before it ends. */
  readonly queue: readonly Anim<P>[]
}

/** The most one-shots that may wait; one more is dropped. */
export const QUEUE_MAX = 2

export function startPlayer<P extends string>(base: Anim<P>, now: number): PlayerState<P> {
  return { base, baseAt: now, over: null, queue: [] }
}

/**
 * A new base loop (the actor's state changed). With a transition, it plays first and the base starts as it ends.
 * Within one posture (drawing to idle at the desk) the moment playing and the queue are kept; across postures they are
 * dropped, drawn as they were for the old one. The same base and no transition: nothing changes.
 */
export function switchBase<P extends string>(
  p: PlayerState<P>, base: Anim<P>, transition: Anim<P> | null, now: number,
): PlayerState<P> {
  if (base === p.base && !transition) return p
  if (transition) return { base, baseAt: now + animLength(transition), over: { anim: transition, at: now }, queue: [] }
  if (base.posture === p.base.posture) return { ...p, base, baseAt: now }
  return { base, baseAt: now, over: null, queue: [] }
}

/** A one-shot over the base: at once when nothing plays, else after what waits; a full queue drops it. */
export function enqueue<P extends string>(p: PlayerState<P>, anim: Anim<P>, now: number): PlayerState<P> {
  if (!p.over) return { ...p, over: { anim, at: now } }
  if (p.queue.length >= QUEUE_MAX) return p
  return { ...p, queue: [...p.queue, anim] }
}

/** A one-shot that cuts in (a reaction over an idle moment): it replaces the one playing, at once; what waits keeps waiting. */
export function interrupt<P extends string>(p: PlayerState<P>, anim: Anim<P>, now: number): PlayerState<P> {
  return { ...p, over: { anim, at: now } }
}

/** Ends what has played out by `now` and starts what waits, each at the end of the one before; the same object when nothing ended. */
export function advance<P extends string>(p: PlayerState<P>, now: number): PlayerState<P> {
  let s = p
  while (s.over && now >= s.over.at + animLength(s.over.anim)) {
    const end = s.over.at + animLength(s.over.anim)
    const [next, ...rest] = s.queue
    s = { ...s, over: next ? { anim: next, at: end } : null, queue: rest }
  }
  return s
}

/** The pose showing at `now`: the one-shot's while one plays, else the base loop's. */
export function poseAt<P extends string>(p: PlayerState<P>, now: number): P {
  if (p.over && now >= p.over.at) return stepAt(p.over.anim, now - p.over.at).pose
  return stepAt(p.base, now - p.baseAt).pose
}

/** Everything played out at once (the window shown again, a settle): the base alone, from `baseAt` (default `now`). */
export function settle<P extends string>(p: PlayerState<P>, now: number, baseAt: number = now): PlayerState<P> {
  if (!p.over && !p.queue.length) return p
  return { base: p.base, baseAt, over: null, queue: [] }
}
