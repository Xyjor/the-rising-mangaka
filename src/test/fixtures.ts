/** Shared game-state builders for tests: the sim's `state/__tests__/autopause.test.ts` local helpers,
 * generalised so UI tests can build the same fixtures without duplicating the sim calls. */
import { ONE_SHOT_PAGES, createGame, getPhase, startProject, submitProject, tick, tickMany } from '../sim'
import type { GameState, Project, ProjectDraft } from '../sim'

export const DRAFT: ProjectDraft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'teens' }

/** Set every craft stat to `v`, so score outcomes are easy to predict. */
export function withStats(s: GameState, v: number): GameState {
  return { ...s, player: { ...s.player, stats: { art: v, story: v, pacing: v } } }
}

/** Tick until the current project is ready to pitch (or give up after a generous guard). */
export function drawUntilReady(state: GameState): GameState {
  let s = state
  let guard = 0
  while (getPhase(s) !== 'ready' && guard++ < 400) s = tick(s)
  return s
}

/**
 * A finished one-shot of `draft` on the desk, every page drawn at quality `art` and `story`. Built directly, with no
 * ticks, so the state's RNG seed is the one `createGame` left.
 */
export function withReadyOneShot(s: GameState, draft: ProjectDraft, art: number, story: number): GameState {
  const project: Project = {
    id: s.nextProjectId, kind: 'oneshot', chapter: 0, ...draft,
    pagesTarget: ONE_SHOT_PAGES, pagesDone: ONE_SHOT_PAGES,
    artSum: art * ONE_SHOT_PAGES, storySum: story * ONE_SHOT_PAGES,
    startedDay: s.day, status: 'ready', magazineId: null, submittedDay: null, resultsDay: null,
  }
  return { ...s, project, nextProjectId: s.nextProjectId + 1 }
}

/** A game with a one-shot already submitted and its poll result waiting to be dismissed. */
export function withPendingResult(stats = 34): GameState {
  let s = withStats(createGame('Rin', 42), stats)
  s = drawUntilReady(startProject(s, DRAFT))
  s = submitProject(s, 'weekly-bolt')
  return tickMany(s, 7)
}
