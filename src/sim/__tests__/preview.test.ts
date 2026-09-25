import { describe, expect, it } from 'vitest'
import {
  GENRES, MAGAZINES, PODIUM_RANK, THEMES, createGame, forecastPoll,
  genreThemeRating, normalCdf, previewSubmission, rankTier,
  startProject, submitProject, themeAudienceRating, tickMany, weakRankLine,
} from '../index'
import type { GenreId, ThemeId } from '../index'
import { DRAFT as draft, drawUntilReady, withReadyOneShot } from '../../test/fixtures'

const kidsDraft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'kids' } as const

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
      expect(pv.scoreRange.low).toBeLessThanOrEqual(pv.expectedScore)
      expect(pv.scoreRange.high).toBeGreaterThanOrEqual(pv.expectedScore)
      expect(pv.payRange.low).toBeLessThanOrEqual(pv.expectedPay)
      expect(pv.payRange.high).toBeGreaterThanOrEqual(pv.expectedPay)
      byId[m.id] = pv.offerChance
    }
    expect(byId['kids-comic']).toBeGreaterThan(byId['weekly-bolt'])
  })

  it('has a normal CDF that matches the tables', () => {
    expect(Math.abs(normalCdf(0) - 0.5)).toBeLessThan(1e-4)
    expect(Math.abs(normalCdf(1.96) - 0.975)).toBeLessThan(1e-4)
    expect(Math.abs(normalCdf(-1.96) - 0.025)).toBeLessThan(1e-4)
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

  it('wraps the forecast and counts the pairings the notebook has not rated', () => {
    const fresh = withReadyOneShot(createGame('Rin', 42), kidsDraft, 46, 46)
    const pv = previewSubmission(fresh, 'kids-comic')!
    expect(pv).toMatchObject({
      magazineId: 'kids-comic', mismatch: false, art: 46, story: 46, pacing: 30,
      audienceFit: null, freshness: null, staleness: 0, unknownPairings: 2,
    })
    expect(pv).toMatchObject(forecastPoll(fresh, fresh.project!, 'kids-comic'))
    const one = { ...fresh, notebook: { genreTheme: { 'action|samurai': 3 as const }, themeAudience: {} } }
    expect(previewSubmission(one, 'kids-comic')).toMatchObject({ freshness: 3, audienceFit: null, unknownPairings: 1 })
    const both = { ...one, notebook: { ...one.notebook, themeAudience: { 'samurai|kids': 1 as const } } }
    expect(previewSubmission(both, 'kids-comic')).toMatchObject({ freshness: 3, audienceFit: 1, unknownPairings: 0 })
    expect(previewSubmission({ ...fresh, project: null }, 'kids-comic')).toBeNull()
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
