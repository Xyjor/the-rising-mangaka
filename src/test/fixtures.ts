/** Shared game-state builders for tests: the sim's `state/__tests__/autopause.test.ts` local helpers,
 * generalised so UI tests can build the same fixtures without duplicating the sim calls. */
import { DAYS_PER_YEAR, ONE_SHOT_PAGES, acceptOffer, createGame, getPhase, startProject, submitProject, tick, tickMany } from '../sim'
import type { GameState, Project, ProjectDraft, SerialOffer } from '../sim'

export const DRAFT: ProjectDraft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'teens' }

/** A Kids Comic Go! serialisation offer for "Magic Club": put it in `pendingOffer` and `acceptOffer` starts the serial. */
export const KIDS_OFFER: SerialOffer = {
  magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids',
}

/** Set every craft stat to `v`, so score outcomes are easy to predict. */
export function withStats(s: GameState, v: number): GameState {
  return { ...s, player: { ...s.player, stats: { art: v, story: v, pacing: v } } }
}

/**
 * Push the running serial's deadline out of reach, so a test's weak-chapter arithmetic is never touched by a missed
 * issue. `sendChapter` adds `chapterDays` to it, which keeps it far beyond any day a test reaches.
 */
export function noDeadline(s: GameState): GameState {
  return s.serial ? { ...s, serial: { ...s.serial, nextDueDay: Number.MAX_SAFE_INTEGER } } : s
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

/**
 * The merch reference serial: seed 1 on day 400 (year two), money 100,000, with a running Kids Comic Go! serial
 * (id 1) at `popularity` that has shipped 5 volumes and 33,500 copies, 6,700 a volume, the median of the sensible
 * bot's year-one serials over seeds 1-20. `licensed` sets the goods maker's licence as granted on day 337.
 */
export function withMerchSerial(popularity = 80, licensed = true): GameState {
  const s = acceptOffer({ ...createGame('Rin', 1), day: 400, pendingOffer: KIDS_OFFER })
  return {
    ...s,
    player: { ...s.player, money: 100_000 },
    serial: { ...s.serial!, popularity, volumes: 5, totalCopies: 33_500 },
    merch: { ...s.merch, licensedDay: licensed ? DAYS_PER_YEAR + 1 : null },
  }
}
