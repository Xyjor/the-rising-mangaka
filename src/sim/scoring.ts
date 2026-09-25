import { genreThemeKey, genreThemeRating, themeAudienceKey, themeAudienceRating } from './compat'
import {
  MAGAZINE_MISMATCH_PENALTY, PODIUM_RANK, RANK_MULTIPLIER, RATING_SCORE, RIVAL_SCORE_SD, SCORE_WEIGHTS,
  STALENESS_PENALTY, WEAK_RANK_FRACTION, audienceById, genreById, magazineById, themeById,
} from './data'
import type { RankTier } from './data'
import { clamp, draw, gaussian } from './rng'
import type {
  AudienceId, ChapterResult, Focus, GameState, GenreId, MagazineId, PendingChapter, PollResult, Project,
  ScoreBreakdown, ScoreWeights, Serial, ThemeId,
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

interface BreakdownInput {
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

function computeBreakdown(state: GameState, input: BreakdownInput): {
  breakdown: ScoreBreakdown; mismatch: number; staleness: number
} {
  const mag = magazineById(input.magazineId)
  const gt = genreThemeRating(state.worldSeed, input.genre, input.theme)
  const ta = themeAudienceRating(state.worldSeed, input.theme, input.audience)
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

function rankAgainstRivals(magazineId: MagazineId, score: number, values: number[], offset: number): number {
  const mag = magazineById(magazineId)
  let beaten = 0
  for (let i = 0; i < mag.entrants; i++) {
    const rival = mag.rivalMean + gaussian(values[offset + i * 2], values[offset + i * 2 + 1]) * RIVAL_SCORE_SD
    if (rival > score) beaten++
  }
  return 1 + beaten
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
 * Best guess at a one-shot's poll score before it is submitted. Pure, no RNG: pacing noise is
 * ignored and pairings the player has not tested yet are assumed to rate Good.
 */
export function estimateScore(state: GameState, project: Project, magazineId: MagazineId): number {
  const mag = magazineById(magazineId)
  const knownFit = state.notebook.themeAudience[themeAudienceKey(project.theme, project.audience)]
  const knownFresh = state.notebook.genreTheme[genreThemeKey(project.genre, project.theme)]
  const mismatch = mag.audience === project.audience ? 0 : MAGAZINE_MISMATCH_PENALTY
  const staleness = stalenessCount(state, project.genre, project.theme) * STALENESS_PENALTY
  return weightedScore({
    art: Math.round(projectArtQuality(project)),
    story: Math.round(projectStoryQuality(project)),
    pacing: state.player.stats.pacing,
    audienceFit: clamp((knownFit !== undefined ? RATING_SCORE[knownFit] : 60) - mismatch, 0, 100),
    freshness: clamp((knownFresh !== undefined ? RATING_SCORE[knownFresh] : 60) - staleness, 0, 100),
  }, mag.taste)
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
    pacingNoise: gaussian(values[0], values[1]) * 6,
  })
  const score = weightedScore(breakdown, mag.taste)
  const rank = rankAgainstRivals(magazineId, score, values, 2)
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
      money: Math.round(mag.pageRate * project.pagesDone * mult),
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
    pacingNoise: gaussian(values[0], values[1]) * 6,
  })
  const score = weightedScore(breakdown, mag.taste)
  const rank = rankAgainstRivals(serial.magazineId, score, values, 2)
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
      money: Math.round(mag.pageRate * pc.pages * mult),
      fans: Math.round(mag.circulation * 6 * (score / 100) * mult),
      xp: Math.round(20 + score * 0.5),
    },
  }
  return { result, seed }
}
