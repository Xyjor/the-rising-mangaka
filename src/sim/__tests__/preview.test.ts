import { describe, expect, it } from 'vitest'
import {
  GENRES, MAGAZINES, PODIUM_RANK, RANK_MULTIPLIER, THEMES, binomialAtMost, createGame, estimateScore,
  evaluateProject, genreThemeRating, getPhase, magazineById, normalCdf, previewSubmission, rankTier,
  startProject, submitProject, themeAudienceRating, tick, tickMany, weakRankLine,
} from '../index'
import type { GameState, GenreId, ThemeId } from '../index'

const draft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'teens' } as const
const kidsDraft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'kids' } as const

function drawUntilReady(state: GameState): GameState {
  let s = state
  let guard = 0
  while (getPhase(s) !== 'ready' && guard++ < 400) s = tick(s)
  return s
}

/** Force the ready manuscript's page quality so the estimator lands on a known score. */
function withQuality(s: GameState, art: number, story: number): GameState {
  const p = s.project!
  return { ...s, project: { ...p, artSum: art * p.pagesDone, storySum: story * p.pagesDone } }
}

describe('submission preview', () => {
  it('gives a sane band and odds for every magazine on the seed-42 manuscript', () => {
    const s = drawUntilReady(startProject(createGame('Rin', 42), draft))
    const byId: Record<string, number> = {}
    for (const m of MAGAZINES) {
      const pv = previewSubmission(s, m.id)!
      expect(pv.expectedRank.low).toBeGreaterThanOrEqual(1)
      expect(pv.expectedRank.high).toBeGreaterThanOrEqual(pv.expectedRank.low)
      expect(pv.expectedRank.high).toBeLessThanOrEqual(m.entrants + 1)
      expect(pv.offerChance).toBeGreaterThanOrEqual(0)
      expect(pv.offerChance).toBeLessThanOrEqual(1)
      expect(pv.expectedScore).toBeGreaterThanOrEqual(0)
      expect(pv.expectedScore).toBeLessThanOrEqual(100)
      byId[m.id] = pv.offerChance
    }
    expect(byId['kids-comic']).toBeGreaterThan(byId['weekly-bolt'])
  })

  it('reproduces the worked examples: score 50 at Kids Comic, score 47 at Weekly Bolt', () => {
    const base = drawUntilReady(startProject(createGame('Rin', 42), kidsDraft))

    const kids = withQuality(base, 49, 49)
    expect(estimateScore(kids, kids.project!, 'kids-comic')).toBe(50)
    const pk = previewSubmission(kids, 'kids-comic')!
    expect(pk.expectedScore).toBe(50)
    expect(pk.expectedRank).toEqual({ low: 2, high: 7 })
    expect(Math.abs(pk.offerChance - 0.29)).toBeLessThanOrEqual(0.02)

    const bolt = withQuality(base, 50, 51)
    expect(estimateScore(bolt, bolt.project!, 'weekly-bolt')).toBe(47)
    const pb = previewSubmission(bolt, 'weekly-bolt')!
    expect(pb.expectedScore).toBe(47)
    expect(pb.expectedRank).toEqual({ low: 9, high: 13 })
  })

  it('has a normal CDF and binomial tail that match the tables', () => {
    expect(Math.abs(normalCdf(0) - 0.5)).toBeLessThan(1e-4)
    expect(Math.abs(normalCdf(1.96) - 0.975)).toBeLessThan(1e-4)
    expect(Math.abs(normalCdf(-1.96) - 0.025)).toBeLessThan(1e-4)
    expect(Math.abs(binomialAtMost(10, 2, 0.338) - 0.288)).toBeLessThan(1e-3)
    expect(binomialAtMost(10, 10, 0.5)).toBeCloseTo(1, 10)
    expect(binomialAtMost(10, -1, 0.5)).toBe(0)
  })

  it('tiers ranks the same way rewards do', () => {
    expect(rankTier(1, 13)).toBe('first')
    expect(rankTier(3, 13)).toBe('podium')
    expect(rankTier(4, 13)).toBe('mid')
    expect(rankTier(7, 13)).toBe('mid')
    expect(rankTier(8, 13)).toBe('weak')
    expect(weakRankLine(13)).toBe(10)
    expect(PODIUM_RANK).toBe(3)
  })

  it('quotes the same pay floor and ceiling the poll would hand out', () => {
    const base = drawUntilReady(startProject(createGame('Rin', 42), kidsDraft))
    const mag = magazineById('kids-comic')
    const pages = base.project!.pagesDone
    const pv = previewSubmission(base, 'kids-comic')!
    expect(pv.minMoney).toBe(Math.round(mag.pageRate * pages * RANK_MULTIPLIER.weak))
    expect(pv.maxMoney).toBe(Math.round(mag.pageRate * pages * RANK_MULTIPLIER.first))

    const strong = withQuality(base, 100, 100)
    const top = evaluateProject(strong, strong.project!, 'kids-comic').result
    expect(top.rank).toBe(1)
    expect(top.rewards.money).toBe(pv.maxMoney)

    const feeble = withQuality(base, 0, 0)
    const bottom = evaluateProject(feeble, feeble.project!, 'kids-comic').result
    expect(bottom.rank).toBeGreaterThan(Math.ceil(bottom.entrants / 2))
    expect(bottom.rewards.money).toBe(pv.minMoney)
  })

  it('lets a fresh player reach the serial gate at Kids Comic with a well-matched combo', () => {
    // Twenty seeds starting at the balance script's seed. Fantasy x magic for kids rates Perfect/Great in every
    // world, so the per-seed search below is a guard against future compat tables, not a search that moves today.
    let offers = 0
    for (let seed = 42; seed < 62; seed++) {
      let s = createGame('Rin', seed)
      // Default to fantasy/magic/kids, swapping to the best-rated pairing this world hides (ties keep the default).
      let best: { genre: GenreId; theme: ThemeId } = { genre: 'fantasy', theme: 'magic' }
      let bestRating = -1
      const candidates = [best, ...GENRES.flatMap((g) => THEMES.map((t) => ({ genre: g.id, theme: t.id })))]
      for (const c of candidates) {
        const rating = genreThemeRating(s.worldSeed, c.genre, c.theme) + themeAudienceRating(s.worldSeed, c.theme, 'kids')
        if (rating > bestRating) { bestRating = rating; best = c }
      }
      s = drawUntilReady(startProject(s, { title: 'Go', audience: 'kids', ...best }))
      s = submitProject(s, 'kids-comic')
      s = tickMany(s, 7)
      expect(s.pendingResult).not.toBeNull()
      if (s.pendingOffer) offers++
    }
    expect(offers).toBeGreaterThanOrEqual(8)
  })
})
