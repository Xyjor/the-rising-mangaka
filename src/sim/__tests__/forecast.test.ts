import { describe, expect, it } from 'vitest'
import {
  MAGAZINES, RATING_PRIOR, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE, acceptOffer, createGame, evaluateProject,
  forecastPoll, genreThemeRating, rivalsAboveDist, themeAudienceRating,
} from '../index'
import type { GameState, MagazineId, Notebook, ProjectDraft } from '../index'
import { withReadyOneShot } from '../../test/fixtures'

const KIDS_DRAFT: ProjectDraft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'kids' }
const TEENS_DRAFT: ProjectDraft = { ...KIDS_DRAFT, audience: 'teens' }
const COOKING_DRAFT: ProjectDraft = { title: 'Kitchen Gags', genre: 'comedy', theme: 'cooking', audience: 'kids' }

/**
 * A fresh seed-1 game (pacing 30) with `draft` ready at quality art/story and the notebook set to `notebook`. The named
 * rival (craft 50) runs in `rivalAt`: Monthly Petal unless a case says otherwise (no case pitches there), so the
 * field a case polls in is all at that magazine's rivalMean.
 */
function pitch(
  draft: ProjectDraft, art: number, story: number, notebook: Notebook, rivalAt: MagazineId = 'monthly-petal',
): GameState {
  const s = createGame('Rin', 1)
  expect(s.player.stats.pacing).toBe(30)
  const rival = { name: 'Iori Hayama', craft: 50, magazineId: rivalAt, seriesTitle: 'Robo Pals Go!' }
  return withReadyOneShot({ ...s, notebook, rival }, draft, art, story)
}

describe('pitch forecast', () => {
  it('RATING_PRIOR matches the cumulative thresholds hidden ratings are drawn with (0.15, 0.40, 0.70, 0.90)', () => {
    let cum = 0
    const thresholds = RATING_PRIOR.slice(0, 4).map((p) => (cum += p))
    const expected = [0.15, 0.4, 0.7, 0.9]
    thresholds.forEach((t, i) => expect(Math.abs(t - expected[i])).toBeLessThan(1e-12))
    expect(Math.abs(cum + RATING_PRIOR[4] - 1)).toBeLessThan(1e-12)
  })

  it('counts rivals above a score with a Poisson-binomial over per-rival means', () => {
    // two rivals at the score itself: each above with p = 1 - normalCdf(0) = 0.5, so 0.25 / 0.5 / 0.25
    const even = rivalsAboveDist(50, [50, 50])
    expect(even).toHaveLength(3)
    even.forEach((p, k) => expect(p).toBeCloseTo([0.25, 0.5, 0.25][k], 6))
    // one rival at the score (0.5) and one far above it (p = 1 - normalCdf(-100 / 8), about 1): 0 / 0.5 / 0.5
    const mixed = rivalsAboveDist(50, [50, 150])
    mixed.forEach((p, k) => expect(p).toBeCloseTo([0, 0.5, 0.5][k], 6))
  })

  it('Kids Comic Go!, quality 50/50, pacing 30, both pairings known Good: the worked example (rival at Ultra)', () => {
    const known = { genreTheme: { 'action|samurai': 2 as const }, themeAudience: { 'samurai|kids': 2 as const } }
    const s = pitch(KIDS_DRAFT, 50, 50, known, 'ultra-seinen')
    const f = forecastPoll(s, s.project!, 'kids-comic')
    // Kids weighs art 35, story 15, pacing 10, fit 20, freshness 20; art 50, story 50, fit 60, freshness 60:
    // score = round((1750 + 750 + 10 x pacing + 1200 + 1200) / 100) = round(49 + pacing / 10).
    // Node i has pacing round(30 + 4 x (-3 + 0.25i)) = 18 + i: 51 for i <= 6, 52 for i = 7..16, 53 for i >= 17.
    // Weights exp(-z^2 / 2) sum to 10.00917; nodes 0..6 carry 0.83365, 7..16 carry 7.88403, 17..24 carry 1.29149.
    expect(f.scoreDist).toHaveLength(101)
    expect(Math.abs(f.scoreDist[51] - 0.0833)).toBeLessThanOrEqual(0.0005)
    expect(Math.abs(f.scoreDist[52] - 0.7877)).toBeLessThanOrEqual(0.0005)
    expect(Math.abs(f.scoreDist[53] - 0.129)).toBeLessThanOrEqual(0.0005)
    // mean 51 x 0.0833 + 52 x 0.7877 + 53 x 0.1290 = 52.05
    expect(f.expectedScore).toBe(52)
    // cumulative 0.0833 at 51 (< 0.1), 0.871 at 52 (< 0.9), 1 at 53
    expect(f.scoreRange).toEqual({ low: 52, high: 53 })
    // Per score, 10 rivals at 47 +- 8, each above with p = 1 - normalCdf((s - 47) / 8): 0.3085, 0.2660, 0.2266.
    // P(rank <= 1) = 0.0833 x 0.0250 + 0.7877 x 0.0454 + 0.1290 x 0.0765 = 0.048 (< 0.1);
    // P(rank <= 2) = 0.0833 x 0.1365 + 0.7877 x 0.2099 + 0.1290 x 0.3008 = 0.216.
    // P(rank <= 4) = 0.0833 x 0.6267 + 0.7877 x 0.7374 + 0.1290 x 0.8277 = 0.740 (< 0.9);
    // P(rank <= 5) = 0.0833 x 0.8347 + 0.7877 x 0.9018 + 0.1290 x 0.9462 = 0.902.
    expect(f.expectedRank).toEqual({ low: 2, high: 5 })
    expect(f.rankDist).toHaveLength(11)
    // No score reaches 65, so an offer needs at most 2 rivals above:
    // 0.0833 x 0.3603 + 0.7877 x 0.4782 + 0.1290 x 0.5966 = 0.4836
    expect(Math.abs(f.offerChance - 0.4836)).toBeLessThanOrEqual(0.002)
    expect(f.offerBlocked).toBeNull()
    // lowest: score 51, last of 11 (weak, 70%): 90 x 20 x 51 x 70 / 8000 = 803.25 -> 803;
    // highest: score 53, first (200%): 90 x 20 x 53 x 200 / 8000 = 2385
    expect(f.payRange).toEqual({ low: 803, high: 2385 })
    expect(Math.abs(f.expectedPay - 1422)).toBeLessThanOrEqual(2)
    expect(f.beatRival).toBeNull()
  })

  it('the same manuscript with the named rival (craft 50) in Kids Comic Go!: one rival 3 points stronger', () => {
    const known = { genreTheme: { 'action|samurai': 2 as const }, themeAudience: { 'samurai|kids': 2 as const } }
    const s = pitch(KIDS_DRAFT, 50, 50, known, 'kids-comic')
    const f = forecastPoll(s, s.project!, 'kids-comic')
    // The score does not move: 51 / 52 / 53 at 0.0833 / 0.7877 / 0.1290.
    expect(Math.abs(f.scoreDist[52] - 0.7877)).toBeLessThanOrEqual(0.0005)
    // Beat the rival: sum of P(s) x normalCdf((s - 50) / 8) = 0.0833 x normalCdf(0.125) + 0.7877 x normalCdf(0.25)
    //   + 0.1290 x normalCdf(0.375) = 0.0833 x 0.5497 + 0.7877 x 0.5987 + 0.1290 x 0.6462 = 0.6008.
    expect(Math.abs(f.beatRival! - 0.6008)).toBeLessThanOrEqual(0.002)
    // One rival at 50 and nine at 47 (each above with 1 - normalCdf((s - mean) / 8)): at most 2 above, by score,
    // 0.3236 (51), 0.4386 (52), 0.5577 (53), so the offer is
    // 0.0833 x 0.3236 + 0.7877 x 0.4386 + 0.1290 x 0.5577 = 0.4444.
    expect(Math.abs(f.offerChance - 0.4444)).toBeLessThanOrEqual(0.002)
    // P(rank <= 1) = 0.039 (< 0.1), P(rank <= 2) = 0.188; P(rank <= 5) = 0.884 (< 0.9), P(rank <= 6) = 0.966.
    expect(f.expectedRank).toEqual({ low: 2, high: 6 })
    expect(f.rankDist).toHaveLength(11)
    // Same extremes as without the rival (51 last, 53 first); the mean pay drops from 1422 to 1395.2.
    expect(f.payRange).toEqual({ low: 803, high: 2385 })
    expect(Math.abs(f.expectedPay - 1395)).toBeLessThanOrEqual(2)
    // In Weekly Bolt the rival is not in the field.
    expect(forecastPoll(s, s.project!, 'weekly-bolt').beatRival).toBeNull()
  })

  it('Weekly Bolt, quality 50/51 teens, both pairings known Good: next to no offer chance', () => {
    const s = pitch(TEENS_DRAFT, 50, 51, { genreTheme: { 'action|samurai': 2 }, themeAudience: { 'samurai|teens': 2 } })
    const f = forecastPoll(s, s.project!, 'weekly-bolt')
    // Bolt weighs art 35, story 15, pacing 20, fit 10, freshness 20:
    // 50 x 35 + 51 x 15 + 30 x 20 + 60 x 10 + 60 x 20 = 4915 -> 49 at pacing 30; each pacing point moves 0.2
    expect(f.offerChance).toBeLessThan(0.0005)
    expect(f.expectedScore).toBe(49)
    expect(f.scoreRange).toEqual({ low: 48, high: 50 })
    // 12 rivals at 58 +- 8 against a score near 49: almost all of them finish above
    expect(f.expectedRank).toEqual({ low: 10, high: 13 })
    expect(f.rankDist).toHaveLength(13)
  })

  it('Kids Comic Go!, quality 100/100, Great and Great: the offer is certain and first place all but so', () => {
    const s = pitch(KIDS_DRAFT, 100, 100, { genreTheme: { 'action|samurai': 3 }, themeAudience: { 'samurai|kids': 3 } })
    const f = forecastPoll(s, s.project!, 'kids-comic')
    // 3500 + 1500 + 10 x pacing + 1600 + 1600 -> 84 to 86, every outcome at or above 65: exactly 1, no rounding dust
    expect(f.offerChance).toBe(1)
    expect(f.expectedRank).toEqual({ low: 1, high: 1 })
    // The pay range only counts outcomes above 1e-9. At 84 (P 0.0833) each rival is above with
    // p = 1 - normalCdf(37 / 8) = 1.9e-6: rank 2 is 0.0833 x 10p = 1.6e-6 (in), rank 3 is 0.0833 x 45p^2 = 1.3e-11
    // (out). Lowest: 84 at rank 2 (podium, 140%): 90 x 20 x 84 x 140 / 8000 = 2646;
    // highest: 86 first (200%): 90 x 20 x 86 x 200 / 8000 = 3870.
    expect(f.payRange).toEqual({ low: 2646, high: 3870 })
  })

  it('Ultra Seinen, quality 88/88 adults, Good and Good: clearing 65 is an offer even when rivals finish above', () => {
    const adults: ProjectDraft = { ...KIDS_DRAFT, audience: 'adults' }
    const s = pitch(adults, 88, 88, { genreTheme: { 'action|samurai': 2 }, themeAudience: { 'samurai|adults': 2 } })
    const f = forecastPoll(s, s.project!, 'ultra-seinen')
    // Ultra weighs art 15, story 35, pacing 20, fit 10, freshness 20:
    // round((1320 + 3080 + 20 x pacing + 600 + 1200) / 100) = round(62 + pacing / 5), pacing 18..42 -> 66 to 70
    expect(f.scoreDist.slice(0, 66).every((p) => p === 0)).toBe(true)
    expect(f.scoreDist.slice(71).every((p) => p === 0)).toBe(true)
    expect(f.scoreRange).toEqual({ low: 67, high: 69 })
    // 8 rivals at 62 +- 8 still put this 4th or lower about 27% of the time (a top 3 alone would be about 0.73),
    // but every score clears 65
    expect(f.expectedRank).toEqual({ low: 1, high: 4 })
    expect(f.offerChance).toBe(1)
  })

  it('forecasts no offer while a serial runs, and says why', () => {
    const offer = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const
    const running = acceptOffer({ ...createGame('Rin', 1), pendingOffer: offer })
    expect(running.serial!.status).toBe('running')
    const s = withReadyOneShot(running, KIDS_DRAFT, 100, 100)
    const f = forecastPoll(s, s.project!, 'kids-comic')
    expect(f.offerChance).toBe(0)
    expect(f.offerBlocked).toBe('serial')
  })

  it('never reads the hidden rating of a pairing the notebook does not know', () => {
    // worlds 1000 and 1001 hide different ratings for comedy x cooking and cooking x kids
    const worlds = [1000, 1001].map((seed) => createGame('Rin', seed))
    const hidden = worlds.map((w) => [
      genreThemeRating(w.worldSeed, 'comedy', 'cooking'), themeAudienceRating(w.worldSeed, 'cooking', 'kids'),
    ])
    expect(hidden[0]).not.toEqual(hidden[1])
    const [a, b] = worlds.map((w) => withReadyOneShot(w, COOKING_DRAFT, 50, 50))
    expect(forecastPoll(a, a.project!, 'kids-comic')).toEqual(forecastPoll(b, b.project!, 'kids-comic'))
  })

  it('is honest: over 3000 worlds, real polls at Kids Comic Go! land where the forecast said', () => {
    // Untested comedy x cooking for kids at quality 50/50: the forecast is the same in every world (it never reads the
    // hidden ratings), 0.3668 for an offer and a mean score of 50.85. Each seed hides its own ratings and draws its
    // own noise and rivals. Every fresh world's named rival (craft 57 since Task 19) runs in Kids Comic Go!, one of the
    // ten entrants: without it the offer chance would be 0.4256 (Task 10's figure), with a craft-50 rival 0.4091
    // (Task 14's). All three from a separate Python script of the model (25-node pacing quadrature over the rating
    // prior, a Poisson-binomial of 9 rivals at 47 and the named one, offer = at most 2 above or a score of 65+).
    const first = withReadyOneShot(createGame('Rin', 1000), COOKING_DRAFT, 50, 50)
    expect(first.rival).toMatchObject({ craft: 57, magazineId: 'kids-comic' })
    const f = forecastPoll(first, first.project!, 'kids-comic')
    expect(Math.abs(f.offerChance - 0.3668)).toBeLessThanOrEqual(0.002)
    const forecastMean = f.scoreDist.reduce((sum, p, score) => sum + p * score, 0)
    expect(Math.abs(forecastMean - 50.85)).toBeLessThanOrEqual(0.01)

    let offers = 0
    let scores = 0
    const n = 3000
    for (let seed = 1000; seed < 1000 + n; seed++) {
      const s = withReadyOneShot(createGame('Rin', seed), COOKING_DRAFT, 50, 50)
      const { result } = evaluateProject(s, s.project!, 'kids-comic')
      if (result.rank <= SERIAL_OFFER_MIN_RANK || result.score >= SERIAL_OFFER_MIN_SCORE) offers++
      scores += result.score
    }
    expect(Math.abs(offers / n - 0.3668)).toBeLessThanOrEqual(0.04)
    expect(Math.abs(scores / n - 50.85)).toBeLessThanOrEqual(1)
  })

  it('quotes a pay range that holds the real pay once the notebook knows the true ratings', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = createGame('Rin', seed)
      const notebook: Notebook = {
        genreTheme: { 'comedy|cooking': genreThemeRating(g.worldSeed, 'comedy', 'cooking') },
        themeAudience: { 'cooking|kids': themeAudienceRating(g.worldSeed, 'cooking', 'kids') },
      }
      const s = withReadyOneShot({ ...g, notebook }, COOKING_DRAFT, 50, 50)
      for (const m of MAGAZINES) {
        const { payRange } = forecastPoll(s, s.project!, m.id)
        const paid = evaluateProject(s, s.project!, m.id).result.rewards.money
        expect(paid).toBeGreaterThanOrEqual(payRange.low)
        expect(paid).toBeLessThanOrEqual(payRange.high)
      }
    }
  })
})
