// The pitch forecast: the whole spread of scores, ranks, offers and pay a one-shot could get in a magazine's poll,
// computed exactly and without RNG from what the player can know. A pairing the Notebook has rated counts at that
// rating; an untested one is spread over RATING_PRIOR and its hidden rating is never read. Pacing noise is
// integrated with a 25-node quadrature, the rivals with a Poisson-binomial per score.
import { genreThemeKey, themeAudienceKey } from './compat'
import {
  PACING_NOISE_SD, RATING_PRIOR, RIVAL_SCORE_SD, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE, magazineById,
} from './data'
import { clamp, normalCdf } from './rng'
import {
  computeBreakdown, pollPay, projectArtQuality, projectStoryQuality, rivalMeans, stalenessCount, weightedScore,
} from './scoring'
import type { GameState, MagazineId, Project, Rating } from './types'

export interface Forecast {
  /** P(score = s) at index s, for scores 0..100 */
  scoreDist: number[]
  /** the mean score, rounded */
  expectedScore: number
  /** 10th and 90th percentile scores */
  scoreRange: { low: number; high: number }
  /** P(rank = r) at index r - 1, for ranks 1..entrants (the player's work counts as an entrant) */
  rankDist: number[]
  /** 10th and 90th percentile ranks */
  expectedRank: { low: number; high: number }
  /** chance the poll ends in a serialisation offer, 0..1 */
  offerChance: number
  /** what rules an offer out whatever the score: a running serial, or null */
  offerBlocked: 'serial' | null
  /** mean pay over every score and rank */
  expectedPay: number
  /** the lowest and highest pay over every score and rank with a probability above PAY_RANGE_MIN_PROBABILITY */
  payRange: { low: number; high: number }
  /** chance of beating the named rival; null while no named rival is in this poll */
  beatRival: number | null
}

/** An outcome counts towards the quoted pay range when it is at least this likely. */
const PAY_RANGE_MIN_PROBABILITY = 1e-9
/** Percentiles quoted as the likely range. */
const RANGE_LOW = 0.1
const RANGE_HIGH = 0.9

/** Pacing-noise quadrature: nodes z = -3 + 0.25i for i = 0..24, weights proportional to exp(-z^2 / 2), summing to 1. */
const PACING_NODES: readonly { z: number; w: number }[] = (() => {
  const zs = Array.from({ length: 25 }, (_, i) => -3 + 0.25 * i)
  const raw = zs.map((z) => Math.exp((-z * z) / 2))
  const total = raw.reduce((a, b) => a + b, 0)
  return zs.map((z, i) => ({ z, w: raw[i] / total }))
})()

/** A known rating for certain, or every rating weighted by RATING_PRIOR when the Notebook has not rated the pairing. */
function ratingSpread(known: Rating | undefined): [Rating, number][] {
  return known !== undefined ? [[known, 1]] : RATING_PRIOR.map((p, r) => [r as Rating, p])
}

/**
 * P(exactly k rivals score above `score`) at index k, for k = 0..means.length. Rival i scores
 * N(means[i], RIVAL_SCORE_SD) and finishes above with p_i = 1 - normalCdf((score - means[i]) / RIVAL_SCORE_SD),
 * the poll's strict `rival > score`; a Poisson-binomial folds the rivals in one at a time.
 */
export function rivalsAboveDist(score: number, means: readonly number[]): number[] {
  let dist = [1]
  for (const mean of means) {
    const p = 1 - normalCdf((score - mean) / RIVAL_SCORE_SD)
    const next = new Array<number>(dist.length + 1).fill(0)
    dist.forEach((q, k) => {
      next[k] += q * (1 - p)
      next[k + 1] += q * p
    })
    dist = next
  }
  return dist
}

/** The smallest index whose cumulative probability reaches `q` (with 1e-12 of slack for rounding in the sums). */
function percentile(dist: readonly number[], q: number): number {
  let cum = 0
  for (let i = 0; i < dist.length; i++) {
    cum += dist[i]
    if (cum >= q - 1e-12) return i
  }
  return dist.length - 1
}

/**
 * Forecast `project`'s poll at `magazineId`. Every rating scenario (at most 5 x 5) and quadrature node gives a
 * score through the poll's own `computeBreakdown` and `weightedScore`, so the rounding is the real one. For each
 * score the rival Poisson-binomial is computed once and gives the rank, offer and pay outcomes.
 */
export function forecastPoll(state: GameState, project: Project, magazineId: MagazineId): Forecast {
  const mag = magazineById(magazineId)
  const input = {
    artQ: projectArtQuality(project),
    storyQ: projectStoryQuality(project),
    genre: project.genre,
    theme: project.theme,
    audience: project.audience,
    magazineId,
    staleness: stalenessCount(state, project.genre, project.theme),
    fatigue: 0,
  }
  const scoreDist = new Array<number>(101).fill(0)
  for (const [gt, pg] of ratingSpread(state.notebook.genreTheme[genreThemeKey(project.genre, project.theme)])) {
    for (const [ta, pt] of ratingSpread(state.notebook.themeAudience[themeAudienceKey(project.theme, project.audience)])) {
      for (const { z, w } of PACING_NODES) {
        const { breakdown } = computeBreakdown(state, { ...input, pacingNoise: z * PACING_NOISE_SD }, { gt, ta })
        scoreDist[weightedScore(breakdown, mag.taste)] += pg * pt * w
      }
    }
  }

  const means = rivalMeans(mag, state.rival)
  // The named rival, when it runs here, is entrant 0: beaten when it scores under the player (normalCdf of the gap).
  const rival = state.rival.magazineId === magazineId ? state.rival : null
  let beatRival = 0
  const entrants = mag.entrants + 1
  const rankDist = new Array<number>(entrants).fill(0)
  let meanScore = 0
  // The chance of no offer, summed over scores under 65 only, so a manuscript that always clears 65 is exactly 1.
  let miss = 0
  let expectedPay = 0
  let payLow = Infinity
  let payHigh = -Infinity
  scoreDist.forEach((ps, score) => {
    if (ps === 0) return
    meanScore += ps * score
    if (rival) beatRival += ps * normalCdf((score - rival.craft) / RIVAL_SCORE_SD)
    const above = rivalsAboveDist(score, means)
    const topFinish = above.slice(0, SERIAL_OFFER_MIN_RANK).reduce((a, b) => a + b, 0)
    if (score < SERIAL_OFFER_MIN_SCORE) miss += ps * (1 - topFinish)
    above.forEach((pk, k) => {
      const joint = ps * pk
      const pay = pollPay(mag, project.pagesDone, score, k + 1, entrants)
      rankDist[k] += joint
      expectedPay += joint * pay
      if (joint > PAY_RANGE_MIN_PROBABILITY) {
        payLow = Math.min(payLow, pay)
        payHigh = Math.max(payHigh, pay)
      }
    })
  })

  const offerBlocked = state.serial?.status === 'running' ? 'serial' : null
  return {
    scoreDist,
    expectedScore: Math.round(meanScore),
    scoreRange: { low: percentile(scoreDist, RANGE_LOW), high: percentile(scoreDist, RANGE_HIGH) },
    rankDist,
    expectedRank: { low: percentile(rankDist, RANGE_LOW) + 1, high: percentile(rankDist, RANGE_HIGH) + 1 },
    offerChance: offerBlocked ? 0 : clamp(1 - miss, 0, 1),
    offerBlocked,
    expectedPay,
    payRange: { low: payLow, high: payHigh },
    beatRival: rival ? beatRival : null,
  }
}
