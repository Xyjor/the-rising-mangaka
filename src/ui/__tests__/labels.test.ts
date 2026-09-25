import { describe, expect, it } from 'vitest'
import type { PollResult } from '../../sim'
import { GRACE_TEXT, inGrace, likelyLine, offerLabel, payWhy, warningText } from '../labels'

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

describe('GRACE_TEXT', () => {
  it('names chapter 5, one past the 4-result grace period', () => {
    expect(GRACE_TEXT).toBe('New series: no warnings until chapter 5.')
  })
})

describe('inGrace', () => {
  it('is true for 0 through 3 results, and false from 4 results on (the 5th result can warn)', () => {
    expect([0, 1, 2, 3].map(inGrace)).toEqual([true, true, true, true])
    expect([4, 5, 8].map(inGrace)).toEqual([false, false, false])
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

describe('offerLabel', () => {
  it('pairs the odds word with a whole-number percent', () => {
    expect(offerLabel({ offerChance: 0.4836, offerBlocked: null })).toBe('likely, 48%')
    expect(offerLabel({ offerChance: 0.25, offerBlocked: null })).toBe('possible, 25%')
    expect(offerLabel({ offerChance: 0.05, offerBlocked: null })).toBe('a long shot, 5%')
  })

  it('says "under 1%" below one percent, never "0%" or a rounded-up "1%"', () => {
    expect(offerLabel({ offerChance: 0.0099, offerBlocked: null })).toBe('under 1%')
    expect(offerLabel({ offerChance: 0, offerBlocked: null })).toBe('under 1%')
    expect(offerLabel({ offerChance: 0.01, offerBlocked: null })).toBe('a long shot, 1%')
  })

  it('is certain only when every outcome clears 65, and never rounds a near miss up to 100%', () => {
    expect(offerLabel({ offerChance: 1, offerBlocked: null })).toBe('certain: this clears 65')
    expect(offerLabel({ offerChance: 1 - 1e-12, offerBlocked: null })).toBe('likely, 99%')
    expect(offerLabel({ offerChance: 0.9996, offerBlocked: null })).toBe('likely, 99%')
  })

  it('names the running serial that blocks an offer', () => {
    expect(offerLabel({ offerChance: 0, offerBlocked: 'serial' }, 'Magic Club')).toBe('none while "Magic Club" runs')
  })
})

describe('likelyLine', () => {
  it('gives the likely score and rank as ranges', () => {
    expect(likelyLine({ scoreRange: { low: 52, high: 53 }, expectedRank: { low: 2, high: 5 } }, 11)).toBe(
      'Likely score 52 to 53. Likely rank #2 to #5 of 11.',
    )
  })

  it('names a single value when both ends meet', () => {
    expect(likelyLine({ scoreRange: { low: 52, high: 52 }, expectedRank: { low: 1, high: 1 } }, 11)).toBe(
      'Likely score 52. Likely rank #1 of 11.',
    )
    expect(likelyLine({ scoreRange: { low: 85, high: 86 }, expectedRank: { low: 1, high: 1 } }, 11)).toBe(
      'Likely score 85 to 86. Likely rank #1 of 11.',
    )
  })
})
