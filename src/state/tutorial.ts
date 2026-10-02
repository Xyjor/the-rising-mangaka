// The guided first career: the steps, what completes each, and where a saved step resumes. Pure: no React, no store.
// `tutorialStep` (the store, the save) is an index into STEPS, or -1 once the tutorial is done or skipped.
import { getPhase, nextMilestone } from '../sim'
import type { GameState, Phase } from '../sim'

/** What the player did that can complete (or undo) a step. `next` is the guide's own Next button. */
export type TutorialTrigger =
  | 'wizard-opened' | 'wizard-closed' | 'project-started' | 'clock-run' | 'submit-opened' | 'submit-closed'
  | 'submitted' | 'result-dismissed' | 'next'

/** The control a step points at; the overlay (Task A2) finds it on screen and waits while it is not there. */
export type TutorialAnchor =
  | 'plan' | 'wizard-steps' | 'activity' | 'stamina' | 'speed' | 'pitch' | 'forecast' | 'breakdown' | 'rail-notebook'
  | 'rail-stats' | 'rail' | 'next-goal'

export type TutorialStepId =
  | 'plan' | 'wizard' | 'today' | 'stamina' | 'clock' | 'pitch' | 'forecast' | 'why' | 'notebook' | 'stats' | 'rail'
  | 'goal'

export interface TutorialStep {
  id: TutorialStepId
  anchor: TutorialAnchor
  /** What the editor says. */
  line: string
  /** The trigger that finishes the step. */
  completes: TutorialTrigger
  /** Entering the step stops the clock (a step is a decision, as `tick`'s auto-pause treats one). */
  holds: boolean
  /** The game phase the step belongs to; `any` fits every phase. */
  phase: Phase | 'any'
}

export const STEPS: readonly TutorialStep[] = [
  {
    id: 'plan', anchor: 'plan', completes: 'wizard-opened', holds: true, phase: 'idle',
    line: 'Everything starts with a manga. This button plans one: a genre, a theme, and who it is for.',
  },
  {
    id: 'wizard', anchor: 'wizard-steps', completes: 'project-started', holds: true, phase: 'idle',
    line: 'Pick a genre, a theme and an audience. The last page shows what you already know about the pairing; the Notebook fills in after each poll.',
  },
  {
    id: 'today', anchor: 'activity', completes: 'next', holds: true, phase: 'drawing',
    line: 'Draw fills pages while the clock runs and burns stamina. Rest refills it; Job pays the rent when money is short.',
  },
  {
    id: 'stamina', anchor: 'stamina', completes: 'next', holds: true, phase: 'drawing',
    line: 'Stamina is up here. Below 30, pages come at half speed; at zero you collapse into bed, so rest before that.',
  },
  {
    id: 'clock', anchor: 'speed', completes: 'clock-run', holds: true, phase: 'drawing',
    line: 'Nothing happens until time runs. Play or Space starts it, 1 to 3 set the pace, and the game pauses itself whenever something needs you.',
  },
  {
    id: 'pitch', anchor: 'pitch', completes: 'submit-opened', holds: true, phase: 'ready',
    line: 'Twenty pages, and the clock stopped for you. Pitch it: each magazine has its own readers, pay and rivals.',
  },
  {
    id: 'forecast', anchor: 'forecast', completes: 'submitted', holds: true, phase: 'ready',
    line: 'Each card is a forecast: likely rank, pay, and whether its readers match your audience. Pick one and submit.',
  },
  {
    id: 'why', anchor: 'breakdown', completes: 'result-dismissed', holds: true, phase: 'submitted',
    line: 'Here is the why: every bar is a part of your score. Weak bars tell you what to train or change next time.',
  },
  {
    id: 'notebook', anchor: 'rail-notebook', completes: 'next', holds: true, phase: 'any',
    line: 'Your Notebook now holds what this poll taught you. Read it before planning the next manga.',
  },
  {
    id: 'stats', anchor: 'rail-stats', completes: 'next', holds: true, phase: 'any',
    line: 'Stats spends the skill points you earn on art, story or pacing. The badge counts points waiting.',
  },
  {
    id: 'rail', anchor: 'rail', completes: 'next', holds: true, phase: 'any',
    line: 'Staff hires assistants, Studio upgrades the room, Trips train you away from the desk, Career tracks your goals. Every window pauses the clock.',
  },
  {
    id: 'goal', anchor: 'next-goal', completes: 'next', holds: true, phase: 'any',
    line: 'That is the loop. Your next goal waits on the desk, and I will be at the door whenever something needs you.',
  },
]

const inRange = (step: number) => Number.isInteger(step) && step >= 0 && step < STEPS.length

/**
 * The step after `trigger`: the step's own trigger moves it on (past the last step, the tutorial ends: -1); closing the
 * wizard or the pitch window early steps back to the button that opens it; anything else leaves it where it is.
 */
export function stepAfter(step: number, trigger: TutorialTrigger): number {
  if (!inRange(step)) return step
  if (trigger === STEPS[step].completes) return step + 1 < STEPS.length ? step + 1 : -1
  if (step === 1 && trigger === 'wizard-closed') return 0
  if (step === 6 && trigger === 'submit-closed') return 5
  return step
}

/**
 * The game's phase as the tutorial reads it: a poll result waiting to be read is still the submitted phase (the sim's
 * `getPhase` already says idle, since the project left the desk when the result landed).
 */
export function phaseOf(game: GameState): Phase {
  return game.pendingResult ? 'submitted' : getPhase(game)
}

/** No days played, nothing drawn, nothing on the desk: the career the first step was written for. */
function isFresh(game: GameState): boolean {
  return game.day === 0 && game.history.length === 0 && !game.project && !game.serial
}

/**
 * A step with nothing ever to point at is passed: the goal step (11) ends the tutorial once the milestone ladder is
 * complete (the desk shows no next goal). Every other step is returned as it was.
 */
export function settleStep(step: number, game: GameState): number {
  return step === 11 && !nextMilestone(game) ? -1 : step
}

/**
 * Where a saved step picks up against the game (`phaseOf`): step 0 only on a fresh career; another step stays when its
 * phase is the game's (or any), except that a step inside a window that is not saved (1, the wizard; 6, the pitch
 * window) goes back to the button that opens it (0; 5), and the pitch step (5) on a game still drawing goes back to the
 * clock step (4: the manuscript is not ready, and the clock has to run again); else it moves to the first later step
 * written for the game's phase, else the tutorial ends. A later step only counts when its phase is the game's own: an
 * `any` step never swallows a step out of order. The goal step settles (`settleStep`). The store also runs this when a
 * tick changes the phase (a manuscript finished mid-step moves on to the pitch step).
 */
export function resumeTutorialStep(step: number, game: GameState): number {
  if (!inRange(step)) return -1
  if (step === 0) return isFresh(game) ? 0 : -1
  const phase = phaseOf(game)
  if (step === 5 && phase === 'drawing') return 4
  if (STEPS[step].phase === 'any' || STEPS[step].phase === phase) {
    return step === 1 ? 0 : step === 6 ? 5 : settleStep(step, game)
  }
  return STEPS.findIndex((s, i) => i > step && s.phase === phase)
}

/** The first step written for the game's phase (or any). */
export function firstStepFor(game: GameState): number {
  const phase = phaseOf(game)
  return STEPS.findIndex((s) => s.phase === phase || s.phase === 'any')
}

/**
 * Whether the game lets a step's control be on screen now. Away on a trip the status card shows the trip instead of
 * the Plan, Activity and Pitch controls, and the next goal hides; the breakdown needs a result to read; the next goal
 * needs a milestone left. A control inside a window (the wizard's steps, the magazine list) is the player's to open.
 */
export function canPoint(step: number, game: GameState): boolean {
  if (!inRange(step)) return false
  switch (STEPS[step].anchor) {
    case 'plan': case 'activity': case 'pitch': return !game.trip
    case 'breakdown': return !!game.pendingResult
    case 'next-goal': return !game.trip && !!nextMilestone(game)
    default: return true
  }
}

/**
 * Where a replay starts: the first step for the game's phase, except a game waiting for its poll, whose breakdown step
 * cannot show before the result lands: it starts at the Notebook step (8). The store pauses only when the step's
 * control can show (`canPoint`): on a trip the step waits, the clock as it was, until the trip ends.
 */
export function replayStepFor(game: GameState): number {
  const step = firstStepFor(game)
  return step === 7 && !game.pendingResult ? 8 : step
}
