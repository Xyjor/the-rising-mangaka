import { describe, expect, it } from 'vitest'
import type { PollResult, Rival } from '../../sim'
import {
  GRACE_TEXT, animeStatusLine, beatLabel, firstName, inGrace, likelyLine, offerLabel, payWhy, rivalCareerLine, rivalLine,
  warningText,
} from '../labels'

describe('warningText', () => {
  it('reads Safe with no warnings', () => {
    expect(warningText(0)).toBe('Safe')
  })

  it('counts the warning and the chapters left at 1 of 3', () => {
    expect(warningText(1)).toBe('1 warning. 2 more weak chapters or missed issues in a row cancel it')
  })

  it('gives the last-chance message one warning before cancellation', () => {
    expect(warningText(2)).toBe('One more weak chapter or missed issue cancels it')
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

describe('rival copy', () => {
  const rival = { name: 'Iori Hayama', score: 51, rank: 4 }

  it('says whether the player finished ahead of or behind the rival, by rank', () => {
    expect(rivalLine({ score: 55, rank: 2, rival })).toBe('Iori Hayama placed #4 with 51. You finished ahead.')
    expect(rivalLine({ score: 47, rank: 6, rival })).toBe('Iori Hayama placed #4 with 51. You finished behind.')
  })

  it('explains a finish either side of the same rounded score, and calls equal ranks a tie', () => {
    expect(rivalLine({ score: 51, rank: 3, rival })).toBe(
      'Iori Hayama placed #4 with 51, the same score as yours. You finished just ahead.',
    )
    expect(rivalLine({ score: 51, rank: 5, rival })).toBe(
      'Iori Hayama placed #4 with 51, the same score as yours. You finished just behind.',
    )
    expect(rivalLine({ score: 51, rank: 4, rival })).toBe('Iori Hayama placed #4 with 51. You tied.')
  })

  it('has nothing to say about a poll without the rival', () => {
    expect(rivalLine({ score: 51, rank: 4 })).toBeNull()
  })

  it('names the rival by first name and quotes the chance to beat them as a whole percent', () => {
    expect(firstName('Iori Hayama')).toBe('Iori')
    expect(beatLabel(0.6008)).toBe('60%')
    expect(beatLabel(0.004)).toBe('under 1%')
    expect(beatLabel(0.996)).toBe('over 99%')
  })

  it('sums up the rival for the career screen: series, magazine, usual scores and the head-to-head record', () => {
    const r: Rival = { name: 'Iori Hayama', craft: 50, magazineId: 'kids-comic', seriesTitle: 'Robo Pals Go!', temper: 'stoic' }
    // 50 - 8 to 50 + 8; a magazine name that ends in "!" ends its sentence without another full stop
    expect(rivalCareerLine(r, { wins: 3, losses: 2 })).toBe(
      'Iori Hayama draws "Robo Pals Go!" for Kids Comic Go! Usually scores 42 to 58. Head to head: 3 wins, 2 losses.',
    )
    const petal: Rival = { ...r, craft: 58, magazineId: 'monthly-petal', seriesTitle: 'Paper Moon Letters' }
    expect(rivalCareerLine(petal, { wins: 0, losses: 4 })).toBe(
      'Iori Hayama draws "Paper Moon Letters" for Monthly Petal. Usually scores 50 to 66. Head to head: 0 wins, 4 losses.',
    )
    expect(rivalCareerLine(r, { wins: 1, losses: 1 })).toMatch(/Head to head: 1 win, 1 loss\.$/)
    expect(rivalCareerLine(r, { wins: 0, losses: 0 })).toMatch(/Head to head: 0 wins, 0 losses\.$/)
  })
})

describe('animeStatusLine', () => {
  const kumo = { studio: 'kumo', serialId: 1, signedDay: 100, airsDay: 142, endsDay: 226, tailEndsDay: 310 } as const
  const hoshi = { studio: 'hoshi', serialId: 1, signedDay: 100, airsDay: 212, endsDay: 380, tailEndsDay: 548 } as const

  it('counts down to the premiere in weeks, then in days in the last week', () => {
    expect(animeStatusLine(kumo, 100, true)).toBe('Signed with Studio Kumo, airs in 6 weeks; volumes sell 1.3x from the premiere.')
    expect(animeStatusLine(kumo, 135, true)).toBe('Signed with Studio Kumo, airs in 1 week; volumes sell 1.3x from the premiere.')
    expect(animeStatusLine(kumo, 136, true)).toBe('Signed with Studio Kumo, airs in 6 days; volumes sell 1.3x from the premiere.')
    expect(animeStatusLine(kumo, 141, true)).toBe('Signed with Studio Kumo, airs in 1 day; volumes sell 1.3x from the premiere.')
    expect(animeStatusLine(hoshi, 100, true)).toBe('Signed with Hoshi Animation, airs in 16 weeks; volumes sell 1.6x from the premiere.')
  })

  it('numbers the weeks on air from the premiere day', () => {
    expect(animeStatusLine(kumo, 142, true)).toBe('On air, week 1 of 12: +400 fans and ¥500 a week; volumes sell 1.3x.')
    expect(animeStatusLine(kumo, 155, true)).toBe('On air, week 2 of 12: +400 fans and ¥500 a week; volumes sell 1.3x.')
    expect(animeStatusLine(kumo, 225, true)).toBe('On air, week 12 of 12: +400 fans and ¥500 a week; volumes sell 1.3x.')
    expect(animeStatusLine(hoshi, 212, true)).toBe('On air, week 1 of 24: +900 fans and ¥1,000 a week; volumes sell 1.6x.')
  })

  it('counts down the boost after the finale, to its last day, then says it is over', () => {
    expect(animeStatusLine(kumo, 226, true)).toBe('The anime has ended; volumes sell 1.3x for 12 more weeks.')
    expect(animeStatusLine(kumo, 300, true)).toBe('The anime has ended; volumes sell 1.3x for 2 more weeks.')
    expect(animeStatusLine(kumo, 303, true)).toBe('The anime has ended; volumes sell 1.3x for 1 more week.')
    expect(animeStatusLine(kumo, 304, true)).toBe('The anime has ended; volumes sell 1.3x for 6 more days.')
    expect(animeStatusLine(kumo, 309, true)).toBe('The anime has ended; volumes sell 1.3x for 1 more day.')
    expect(animeStatusLine(kumo, 310, true)).toBe('The anime has ended; today is the last day volumes sell 1.3x.')
    expect(animeStatusLine(kumo, 311, true)).toBe('The Studio Kumo anime has ended, and volumes sell at the normal rate again.')
  })

  it('promises no volume boost once the series is over: it ships no more volumes', () => {
    expect(animeStatusLine(kumo, 100, false)).toBe('Signed with Studio Kumo, airs in 6 weeks.')
    expect(animeStatusLine(kumo, 156, false)).toBe('On air, week 3 of 12: +400 fans and ¥500 a week.')
    expect(animeStatusLine(kumo, 226, false)).toBe('The Studio Kumo anime has ended.')
    expect(animeStatusLine(kumo, 310, false)).toBe('The Studio Kumo anime has ended.')
    expect(animeStatusLine(kumo, 311, false)).toBe('The Studio Kumo anime has ended.')
  })
})
