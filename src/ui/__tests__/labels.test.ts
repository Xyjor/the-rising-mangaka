import { describe, expect, it } from 'vitest'
import type { PollResult } from '../../sim'
import { payWhy, warningText } from '../labels'

describe('warningText', () => {
  it('reads Safe with no warnings', () => {
    expect(warningText(0)).toBe('Safe')
  })

  it('counts the warning and the chapters left at 1 of 3', () => {
    expect(warningText(1)).toBe('1 warning. 2 more weak chapters in a row cancel it')
  })

  it('gives the last-chance message one warning before cancellation', () => {
    expect(warningText(2)).toBe('One more weak chapter cancels it')
  })
})

/** A minimal, otherwise-arbitrary result: only magazineId, pages, score, rank and entrants feed payWhy. */
const podiumResult: PollResult = {
  projectId: 1,
  title: 'Blade Club',
  genre: 'action',
  theme: 'samurai',
  audience: 'kids',
  magazineId: 'kids-comic',
  day: 30,
  score: 52,
  rank: 2,
  entrants: 11,
  breakdown: { art: 50, story: 50, pacing: 50, audienceFit: 50, freshness: 50 },
  penalties: { magazineMismatch: 0, staleness: 0 },
  rewards: { money: 1638, fans: 400, xp: 72 },
  genreThemeRating: 2,
  themeAudienceRating: 2,
  editorComment: 'Solid.',
  pages: 20,
}

describe('payWhy', () => {
  it('explains a podium payout: pages, rate, score against the full-rate score, and the tier multiplier', () => {
    expect(payWhy(podiumResult)).toBe(
      '20 pages at ¥90, scaled by your score (52; 80 earns the full rate), times 1.4 for the podium.',
    )
  })

  it('names the rank-tier clause for first, mid-table and a weak finish', () => {
    expect(payWhy({ ...podiumResult, rank: 1, entrants: 13, magazineId: 'weekly-bolt' })).toBe(
      '20 pages at ¥110, scaled by your score (52; 80 earns the full rate), times 2 for first place.',
    )
    expect(payWhy({ ...podiumResult, rank: 5, entrants: 11 })).toBe(
      '20 pages at ¥90, scaled by your score (52; 80 earns the full rate), times 1 for mid-table.',
    )
    expect(payWhy({ ...podiumResult, rank: 13, entrants: 13, magazineId: 'weekly-bolt' })).toBe(
      '20 pages at ¥110, scaled by your score (52; 80 earns the full rate), times 0.7 for a weak finish.',
    )
  })
})
