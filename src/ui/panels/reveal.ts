// Pure timeline for the poll results reveal: when each beat of the drumroll -> bars -> score -> stamp ->
// jingle -> reward-coins sequence lands, and which of those beats fall inside a given time window.
// No React, no DOM: Task 27's Results modal choreography drives real time through this.
import type { RankTier } from '../../sim'
import type { CueId } from '../../audio/types'

/** Milliseconds from the reveal's start to the first bar growing. */
const INTRO = 350
/** Milliseconds between one bar starting and the next. */
const BAR_STEP = 250
/** How long each bar takes to grow to its value. */
const BAR_DUR = 400
/** Milliseconds between the last bar finishing and the score count-up starting. */
const SCORE_GAP = 0
/** How long the score takes to count up. */
const SCORE_DUR = 450
/** Milliseconds between the score count-up finishing and the rank stamp landing. */
const STAMP_GAP = 100
/** Milliseconds between the stamp landing and its jingle. */
const JINGLE_DELAY = 120
/** Milliseconds between the stamp landing and the first reward coin. */
const REWARD_DELAY = 250
/** Milliseconds between one reward coin and the next. */
const REWARD_STEP = 150
/** How long each reward coin takes to land. */
const REWARD_DUR = 400
/** How long before the first bar the drumroll starts. */
const DRUMROLL_LEAD = 200

/** Jingle cue per rank tier, played when the stamp lands. */
export const TIER_JINGLE: Record<RankTier, CueId> = {
  first: 'fanfare',
  podium: 'jingle-up',
  mid: 'jingle-mid',
  weak: 'jingle-down',
}

export interface RevealPlan {
  /** True when this plan is a reduced-motion/instant plan: every time is 0. */
  reduced: boolean
  drumrollAt: number
  /** Start time of each bar, in poll-entrant order. */
  barStart: number[]
  barDur: number
  scoreStart: number
  scoreDur: number
  stampAt: number
  jingleAt: number
  /** Start time of each reward coin. */
  rewardStart: number[]
  /** When the whole reveal is done. */
  end: number
}

/** Lays out a reveal's timeline for a poll with `bars` entrants and `rewards` reward coins.
 * `reduced` collapses every time to 0 (respecting reduced motion / a skip). */
export function revealPlan({ bars, rewards, reduced }: { bars: number; rewards: number; reduced: boolean }): RevealPlan {
  if (reduced) {
    return {
      reduced: true,
      drumrollAt: 0,
      barStart: new Array(bars).fill(0),
      barDur: 0,
      scoreStart: 0,
      scoreDur: 0,
      stampAt: 0,
      jingleAt: 0,
      rewardStart: new Array(rewards).fill(0),
      end: 0,
    }
  }
  const barStart = Array.from({ length: bars }, (_, i) => INTRO + i * BAR_STEP)
  const lastBarEnd = bars > 0 ? barStart[bars - 1] + BAR_DUR : INTRO
  const scoreStart = lastBarEnd + SCORE_GAP
  const scoreEnd = scoreStart + SCORE_DUR
  const stampAt = scoreEnd + STAMP_GAP
  const jingleAt = stampAt + JINGLE_DELAY
  const rewardStart = Array.from({ length: rewards }, (_, i) => stampAt + REWARD_DELAY + i * REWARD_STEP)
  const end = rewards > 0 ? rewardStart[rewards - 1] + REWARD_DUR : jingleAt
  return {
    reduced: false,
    drumrollAt: INTRO - DRUMROLL_LEAD,
    barStart,
    barDur: BAR_DUR,
    scoreStart,
    scoreDur: SCORE_DUR,
    stampAt,
    jingleAt,
    rewardStart,
    end,
  }
}

/** Cubic ease-out: fast start, gentle landing. */
function easeOutCubic(x: number): number {
  const inv = 1 - x
  return 1 - inv * inv * inv
}

/** Eased fraction of a `[start, start + dur]` window elapsed at `t`, clamped to [0, 1].
 * A zero-duration window (a reduced plan) is fully elapsed as soon as `t` reaches `start`. */
export function progressAt(t: number, start: number, dur: number): number {
  if (dur <= 0) return t >= start ? 1 : 0
  const linear = Math.min(1, Math.max(0, (t - start) / dur))
  return easeOutCubic(linear)
}

/** `value` eased in across `[start, start + dur]` at time `t`, rounded to a whole number. */
export function countUp(value: number, t: number, start: number, dur: number): number {
  return Math.round(value * progressAt(t, start, dur))
}

/** A 0-100 stat value mapped onto a 0-12 semitone offset for the bar-grow cue's pitch. */
export function barPitch(value: number): number {
  return Math.min(12, Math.max(0, Math.round((value / 100) * 12)))
}

/** One beat of the reveal, in reveal-local terms. Task 27 maps `kind` to a cue: bar -> the 'bar' cue at
 * `barPitch(value)`, coin -> 'coins', jingle -> `TIER_JINGLE[tier]`, drumroll -> 'drumroll', stamp -> 'stamp'. */
export type RevealEvent =
  | { kind: 'drumroll'; at: number }
  | { kind: 'bar'; at: number; index: number }
  | { kind: 'stamp'; at: number }
  | { kind: 'jingle'; at: number }
  | { kind: 'coin'; at: number; index: number }

/** Every beat of `plan` whose time falls in `(from, to]`, sorted by time.
 * When `skipped` (or `plan.reduced`, which always behaves as skipped) only the stamp and jingle fire. */
export function revealCues(plan: RevealPlan, from: number, to: number, skipped: boolean): RevealEvent[] {
  const inWindow = (at: number) => at > from && at <= to
  const quiet = skipped || plan.reduced
  const events: RevealEvent[] = []
  if (!quiet) {
    events.push({ kind: 'drumroll', at: plan.drumrollAt })
    for (const [index, at] of plan.barStart.entries()) events.push({ kind: 'bar', at, index })
  }
  events.push({ kind: 'stamp', at: plan.stampAt })
  events.push({ kind: 'jingle', at: plan.jingleAt })
  if (!quiet) {
    for (const [index, at] of plan.rewardStart.entries()) events.push({ kind: 'coin', at, index })
  }
  return events.filter(e => inWindow(e.at)).sort((a, b) => a.at - b.at)
}
