import { genreThemeRating, themeAudienceRating } from './compat'
import {
  MAGAZINE_MISMATCH_PENALTY, RATING_SCORE, SCORE_WEIGHTS, STALENESS_PENALTY, magazineById,
} from './data'
import { clamp, draw, gaussian } from './rng'
import type {
  AudienceId, ChapterResult, GameState, GenreId, MagazineId, PendingChapter, PollResult, Project,
  ScoreBreakdown, Serial, ThemeId,
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

export function weightedScore(b: ScoreBreakdown): number {
  const s =
    b.art * SCORE_WEIGHTS.art +
    b.story * SCORE_WEIGHTS.story +
    b.pacing * SCORE_WEIGHTS.pacing +
    b.audienceFit * SCORE_WEIGHTS.audienceFit +
    b.freshness * SCORE_WEIGHTS.freshness
  return clamp(Math.round(s), 0, 100)
}

/** Readers tire of a long series: freshness erodes after chapter 8. */
export function serialFatigue(chapter: number): number {
  return Math.max(0, chapter - 8) * 2
}

export function rankScore(rank: number, entrants: number): number {
  if (entrants <= 1) return 100
  return Math.round(100 * (1 - (rank - 1) / (entrants - 1)))
}

function editorComment(b: ScoreBreakdown, score: number): string {
  const entries: [keyof ScoreBreakdown, number][] = [
    ['art', b.art], ['story', b.story], ['pacing', b.pacing],
    ['audienceFit', b.audienceFit], ['freshness', b.freshness],
  ]
  entries.sort((a, z) => a[1] - z[1])
  const weakest = entries[0][0]
  const lines: Record<keyof ScoreBreakdown, string> = {
    art: 'The linework is holding you back. Readers noticed the rough panels.',
    story: 'The premise is fine, but the plot loses them halfway. Tighten the script.',
    pacing: 'Scenes drag. Cut a page, earn a cliffhanger.',
    audienceFit: 'This theme is not landing with the readers of that magazine.',
    freshness: 'Readers have seen this pairing before. Surprise them next time.',
  }
  const opener =
    score >= 80 ? 'Excellent work.' : score >= 60 ? 'Solid.' : score >= 40 ? 'Not bad, but.' : 'Rough one.'
  return `${opener} ${lines[weakest]}`
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
    const rival = mag.rivalMean + gaussian(values[offset + i * 2], values[offset + i * 2 + 1]) * 12
    if (rival > score) beaten++
  }
  return 1 + beaten
}

function rankMultiplier(rank: number, entrants: number): number {
  return rank === 1 ? 2 : rank <= 3 ? 1.4 : rank <= Math.ceil(entrants / 2) ? 1 : 0.7
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
  const score = weightedScore(breakdown)
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
    editorComment: editorComment(breakdown, score),
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
  const score = weightedScore(breakdown)
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
