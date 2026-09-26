import { genreThemeRating, themeAudienceRating } from './compat'
import {
  MAGAZINE_MISMATCH_PENALTY, PACING_NOISE_SD, PAY_FULL_RATE_SCORE, PODIUM_RANK, RANK_MULTIPLIER,
  RANK_MULTIPLIER_PCT, RATING_SCORE, RIVAL_SCORE_SD, SCORE_WEIGHTS, STALENESS_PENALTY, WEAK_RANK_FRACTION,
  audienceById, genreById, magazineById, themeById,
} from './data'
import type { RankTier } from './data'
import { clamp, draw, gaussian } from './rng'
import type {
  AudienceId, ChapterResult, Focus, GameState, GenreId, Magazine, MagazineId, PendingChapter, PollResult, Project,
  Rating, Rival, RivalPlacing, ScoreBreakdown, ScoreWeights, Serial, ThemeId,
} from './types'

export function projectArtQuality(p: Project): number {
  return p.pagesDone > 0 ? p.artSum / p.pagesDone : 0
}

export function projectStoryQuality(p: Project): number {
  return p.pagesDone > 0 ? p.storySum / p.pagesDone : 0
}

/** How many of the last 3 finished one-shots used this genre x theme. */
export function stalenessCount(state: GameState, genre: string, theme: string): number {
  return state.history.slice(-3).filter((r) => r.genre === genre && r.theme === theme).length
}

/** The poll score: each component times its weight (integer percentages), over 100. */
export function weightedScore(b: ScoreBreakdown, w: ScoreWeights = SCORE_WEIGHTS): number {
  const s = b.art * w.art + b.story * w.story + b.pacing * w.pacing + b.audienceFit * w.audienceFit + b.freshness * w.freshness
  return clamp(Math.round(s / 100), 0, 100)
}

const COMPONENTS: (keyof ScoreBreakdown)[] = ['art', 'story', 'pacing', 'audienceFit', 'freshness']

/**
 * The component that cost the most points at this magazine: the largest taste[k] x (100 - b[k]).
 * Ties go to the earlier key in the order art, story, pacing, audience fit, freshness.
 */
export function biggestLoss(b: ScoreBreakdown, taste: ScoreWeights): keyof ScoreBreakdown {
  let worst = COMPONENTS[0]
  for (const k of COMPONENTS) {
    if (taste[k] * (100 - b[k]) > taste[worst] * (100 - b[worst])) worst = k
  }
  return worst
}

/** The drawing focus a taste rewards: art or story, whichever it weighs higher; balanced when they are equal. */
export function suitedFocus(taste: ScoreWeights): Focus {
  return taste.art > taste.story ? 'art' : taste.art < taste.story ? 'story' : 'balanced'
}

/** Readers tire of a long series: freshness erodes after chapter 8. */
export function serialFatigue(chapter: number): number {
  return Math.max(0, chapter - 8) * 2
}

export function rankScore(rank: number, entrants: number): number {
  if (entrants <= 1) return 100
  return Math.round(100 * (1 - (rank - 1) / (entrants - 1)))
}

interface CommentContext {
  taste: ScoreWeights
  mismatch: number
  staleness: number
  genre: GenreId
  theme: ThemeId
  audience: AudienceId
  magAudience: AudienceId
}

/** One line from the editor that names the component that cost the most at this magazine, and a lever the player has. */
function editorComment(b: ScoreBreakdown, score: number, ctx: CommentContext): string {
  const costliest = biggestLoss(b, ctx.taste)
  const lines: Record<keyof ScoreBreakdown, string> = {
    art: 'The linework is holding you back. Put skill points into Art, or hire a careful assistant.',
    story: 'The premise is fine, but the plot loses them halfway. Put points into Story, or draw with story focus.',
    pacing: 'Scenes drag. Raise Pacing with skill points or the Editing Seminar.',
    audienceFit: ctx.mismatch > 0
      ? `Our readers are ${audienceById(ctx.magAudience).name}; you drew this for ${audienceById(ctx.audience).name}. Pitch it to a magazine that matches.`
      : `${themeById(ctx.theme).name} does not land with ${audienceById(ctx.audience).name} readers.`,
    freshness: ctx.staleness > 0
      ? 'Readers have seen this pairing from you before. Surprise them next time.'
      : `${genreById(ctx.genre).name} and ${themeById(ctx.theme).name} never clicked. Try another pairing; the rating is in your Notebook.`,
  }
  const opener =
    score >= 80 ? 'Excellent work. One nitpick:' : score >= 60 ? 'Solid.' : score >= 40 ? 'Not bad.' : 'Rough one.'
  return `${opener} ${lines[costliest]}`
}

export interface BreakdownInput {
  artQ: number
  storyQ: number
  genre: GenreId
  theme: ThemeId
  audience: AudienceId
  magazineId: MagazineId
  staleness: number
  fatigue: number
  pacingNoise: number
}

/**
 * A poll's five components before weighting. `ratings` stands in for the hidden genre x theme (`gt`) and theme x
 * audience (`ta`) ratings, so the pitch forecast can try every rating an untested pairing might have without
 * reading the real one; the polls themselves leave it out.
 */
export function computeBreakdown(state: GameState, input: BreakdownInput, ratings?: { gt: Rating; ta: Rating }): {
  breakdown: ScoreBreakdown; mismatch: number; staleness: number
} {
  const mag = magazineById(input.magazineId)
  const gt = ratings?.gt ?? genreThemeRating(state.worldSeed, input.genre, input.theme)
  const ta = ratings?.ta ?? themeAudienceRating(state.worldSeed, input.theme, input.audience)
  const mismatch = mag.audience === input.audience ? 0 : MAGAZINE_MISMATCH_PENALTY
  const staleness = input.staleness * STALENESS_PENALTY
  return {
    breakdown: {
      art: clamp(Math.round(input.artQ), 0, 100),
      story: clamp(Math.round(input.storyQ), 0, 100),
      pacing: clamp(Math.round(state.player.stats.pacing + input.pacingNoise), 0, 100),
      audienceFit: clamp(RATING_SCORE[ta] - mismatch, 0, 100),
      freshness: clamp(RATING_SCORE[gt] - staleness - input.fatigue, 0, 100),
    },
    mismatch,
    staleness,
  }
}

/** The rival when they run in `magazineId`, else null: the one check the polls and the pitch forecast share. */
export function rivalIn(rival: Rival | null, magazineId: MagazineId): Rival | null {
  return rival && rival.magazineId === magazineId ? rival : null
}

/**
 * Each rival entrant's mean score in a magazine's poll, one per entrant: the named rival's craft for entrant 0 when the
 * rival runs in this magazine, the magazine's rivalMean for everyone else. The polls and the pitch forecast both use it.
 */
export function rivalMeans(mag: Magazine, rival: Rival | null): number[] {
  const here = rivalIn(rival, mag.id)
  return Array.from({ length: mag.entrants }, (_, i) => (i === 0 && here ? here.craft : mag.rivalMean))
}

/** A poll's field: the player's rank, and where the named rival placed (null when the rival is elsewhere). */
export interface PollField {
  rank: number
  rival: RivalPlacing | null
}

/**
 * Score the poll's field from `values` (two per entrant from `offset`): entrant i scores
 * rivalMeans[i] + gaussian(values[offset + 2i], values[offset + 2i + 1]) x RIVAL_SCORE_SD, so the rival takes entrant
 * 0's draw slots and the stream is the same whether or not it runs here. The player's rank is 1 + entrants strictly
 * above `score`; the rival's is 1 + other entrants above the rival + 1 if the player's score is higher.
 */
export function pollField(
  rival: Rival | null, magazineId: MagazineId, score: number, values: readonly number[], offset: number,
): PollField {
  const mag = magazineById(magazineId)
  const scores = rivalMeans(mag, rival).map(
    (mean, i) => mean + gaussian(values[offset + i * 2], values[offset + i * 2 + 1]) * RIVAL_SCORE_SD,
  )
  const rank = 1 + scores.filter((x) => x > score).length
  const here = rivalIn(rival, magazineId)
  if (!here) return { rank, rival: null }
  const own = scores[0]
  const above = scores.slice(1).filter((x) => x > own).length + (score > own ? 1 : 0)
  return { rank, rival: { name: here.name, score: clamp(Math.round(own), 0, 100), rank: 1 + above } }
}

/** Reward tier for a poll placement. `entrants` includes the player's own work. */
export function rankTier(rank: number, entrants: number): RankTier {
  return rank === 1 ? 'first' : rank <= PODIUM_RANK ? 'podium' : rank <= Math.ceil(entrants / 2) ? 'mid' : 'weak'
}

/** First rank that counts as a weak chapter (the cancellation line). */
export const weakRankLine = (entrants: number) => Math.ceil(entrants * WEAK_RANK_FRACTION)

function rankMultiplier(rank: number, entrants: number): number {
  return RANK_MULTIPLIER[rankTier(rank, entrants)]
}

/**
 * Money paid for a poll placement: the page rate scaled by the score against `PAY_FULL_RATE_SCORE`
 * (the score that earns the full per-page rate), times the rank-tier multiplier. Every factor is an
 * integer and the multiplier is a percentage, so the single division at the end is exact for x.5 cases.
 */
export function pollPay(mag: Magazine, pages: number, score: number, rank: number, entrants: number): number {
  const pct = RANK_MULTIPLIER_PCT[rankTier(rank, entrants)]
  return Math.round((mag.pageRate * pages * score * pct) / (PAY_FULL_RATE_SCORE * 100))
}

/**
 * Evaluate a submitted one-shot against a magazine's poll.
 * Pure: consumes RNG from the state seed and returns the result plus the advanced seed.
 */
export function evaluateProject(
  state: GameState,
  project: Project,
  magazineId: MagazineId,
): { result: PollResult; seed: number } {
  const mag = magazineById(magazineId)
  const { values, seed } = draw(state.seed, 2 + mag.entrants * 2)
  const { breakdown, mismatch, staleness } = computeBreakdown(state, {
    artQ: projectArtQuality(project),
    storyQ: projectStoryQuality(project),
    genre: project.genre,
    theme: project.theme,
    audience: project.audience,
    magazineId,
    staleness: stalenessCount(state, project.genre, project.theme),
    fatigue: 0,
    pacingNoise: gaussian(values[0], values[1]) * PACING_NOISE_SD,
  })
  const score = weightedScore(breakdown, mag.taste)
  const field = pollField(state.rival, magazineId, score, values, 2)
  const rank = field.rank
  const entrants = mag.entrants + 1
  const mult = rankMultiplier(rank, entrants)

  const result: PollResult = {
    projectId: project.id,
    title: project.title,
    genre: project.genre,
    theme: project.theme,
    audience: project.audience,
    magazineId,
    day: state.day,
    score,
    rank,
    entrants,
    breakdown,
    penalties: { magazineMismatch: mismatch, staleness },
    rewards: {
      money: pollPay(mag, project.pagesDone, score, rank, entrants),
      fans: Math.round(mag.circulation * 10 * (score / 100) * mult),
      xp: Math.round(30 + score * 0.8),
    },
    genreThemeRating: genreThemeRating(state.worldSeed, project.genre, project.theme),
    themeAudienceRating: themeAudienceRating(state.worldSeed, project.theme, project.audience),
    editorComment: editorComment(breakdown, score, {
      taste: mag.taste, mismatch, staleness,
      genre: project.genre, theme: project.theme, audience: project.audience, magAudience: mag.audience,
    }),
    pages: project.pagesDone,
    ...(field.rival ? { rival: field.rival } : {}),
  }
  return { result, seed }
}

/** Evaluate one chapter of a running serial in its magazine's weekly poll. */
export function evaluateChapter(
  state: GameState,
  serial: Serial,
  pc: PendingChapter,
): { result: ChapterResult; seed: number } {
  const mag = magazineById(serial.magazineId)
  const { values, seed } = draw(state.seed, 2 + mag.entrants * 2)
  const { breakdown } = computeBreakdown(state, {
    artQ: pc.artQ,
    storyQ: pc.storyQ,
    genre: serial.genre,
    theme: serial.theme,
    audience: serial.audience,
    magazineId: serial.magazineId,
    staleness: 0,
    fatigue: serialFatigue(pc.chapter),
    pacingNoise: gaussian(values[0], values[1]) * PACING_NOISE_SD,
  })
  const score = weightedScore(breakdown, mag.taste)
  const field = pollField(state.rival, serial.magazineId, score, values, 2)
  const rank = field.rank
  const entrants = mag.entrants + 1
  const mult = rankMultiplier(rank, entrants)
  const result: ChapterResult = {
    chapter: pc.chapter,
    day: state.day,
    score,
    rank,
    entrants,
    breakdown,
    rewards: {
      money: pollPay(mag, pc.pages, score, rank, entrants),
      fans: Math.round(mag.circulation * 6 * (score / 100) * mult),
      xp: Math.round(20 + score * 0.5),
    },
    ...(field.rival ? { rival: field.rival } : {}),
  }
  return { result, seed }
}
