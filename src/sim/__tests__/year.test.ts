import { describe, expect, it } from 'vitest'
import {
  AWARDS, DAYS_PER_YEAR, acceptOffer, buildYearReview, closeYear, createGame, markReviewRead, studioLook, submitProject,
  tick, tickMany,
} from '../index'
import type { ChapterResult, GameState, LogEntry, PollResult, RivalPlacing, Serial } from '../index'
import { KIDS_OFFER, withReadyOneShot } from '../../test/fixtures'

/**
 * Seed 1 (world 7919): rival Iori Hayama, craft 57, drawing "Robo Pals Go!" in Kids Comic Go!. No random event rolls
 * before day 10,000, so nothing but the rules under test moves money or fans.
 */
function quiet(): GameState {
  return { ...createGame('Rin', 1), nextEventDay: 10_000 }
}

/** A Weekly Bolt one-shot result on `day`: placed `rank` of 13 with `score`, rewards already paid. */
function oneShot(day: number, rank: number, score: number, rival?: RivalPlacing): PollResult {
  return {
    projectId: 1, title: `One-shot ${day}`, genre: 'action', theme: 'samurai', audience: 'teens', magazineId: 'weekly-bolt',
    day, score, rank, entrants: 13,
    breakdown: { art: score, story: score, pacing: score, audienceFit: score, freshness: score },
    penalties: { magazineMismatch: 0, staleness: 0 }, rewards: { money: 0, fans: 0, xp: 0 },
    genreThemeRating: 2, themeAudienceRating: 2, editorComment: '', pages: 20, rival,
  }
}

/** A chapter result on `day`: placed `rank` of 11 with `score`. */
function chapter(n: number, day: number, rank: number, score = 60, rival?: RivalPlacing): ChapterResult {
  return {
    chapter: n, day, score, rank, entrants: 11,
    breakdown: { art: score, story: score, pacing: score, audienceFit: score, freshness: score },
    rewards: { money: 0, fans: 0, xp: 0 }, rival,
  }
}

/** Chapter results with these `ranks`, one a week from `firstDay`. */
function chapters(firstDay: number, ranks: number[], score = 60): ChapterResult[] {
  return ranks.map((rank, i) => chapter(i + 1, firstDay + 7 * i, rank, score))
}

/** An ended Kids Comic Go! serial (id 1) accepted on `startedDay`, with `patch` on top. */
function archived(startedDay: number, patch: Partial<Serial> = {}): Serial {
  const s = acceptOffer({ ...quiet(), day: startedDay, pendingOffer: KIDS_OFFER }).serial!
  return { ...s, status: 'ended', endedDay: startedDay + 150, ...patch }
}

/** Year one's closing day, 336, with `patch` on top of a quiet career. */
function yearOneEnd(patch: Partial<GameState> = {}): GameState {
  return { ...quiet(), day: 336, ...patch }
}

/** Year two's closing day, 672: year two began on day 336 with ¥3,000, no fans, level 1 and nothing sold. */
function yearTwoEnd(patch: Partial<GameState> = {}): GameState {
  return { ...quiet(), day: 672, yearStart: { day: 336, money: 3000, fans: 0, level: 1, copies: 0, volumes: 0 }, ...patch }
}

function toasts(s: GameState, after = 0): string[] {
  return s.log.filter((e: LogEntry) => e.toast && e.id > after).map((e) => e.text)
}

describe('the calendar', () => {
  it('has 336 days a year: twelve months of four weeks', () => {
    expect(DAYS_PER_YEAR).toBe(336)
  })
})

describe('a new career', () => {
  it('snapshots the year start on day 0, with no reviews and no awards', () => {
    const g = createGame('Rin', 1)
    expect(g.yearStart).toEqual({ day: 0, money: 3000, fans: 0, level: 1, copies: 0, volumes: 0 })
    expect(g.yearReviews).toEqual([])
    expect(g.reviewUnread).toBeNull()
    expect(g.awards).toEqual([])
  })
})

describe('closeYear', () => {
  it('a fresh career with ¥50,000 left alone for a year: 48 weeks of costs, no awards, the rival wins the Rookie Prize', () => {
    const g = quiet()
    const start = { ...g, player: { ...g.player, money: 50_000 }, yearStart: { ...g.yearStart, money: 50_000 } }
    const s = tickMany(start, 336)
    // 48 weekly living costs of ¥400 (days 7 to 336) = ¥19,200. The Fifty thousand milestone (100 XP) lands on day 1.
    expect(s.player.money).toBe(30_800)
    expect(s.yearReviews).toEqual([{
      year: 1, oneShots: 0, bestOneShot: null, chapters: 0, volumes: 0, copies: 0, bestScore: null,
      moneyDelta: -19_200, fansDelta: 0, levelFrom: 1, levelTo: 2, awards: [], nearMisses: [],
      rival: {
        name: 'Iori Hayama', wins: 0, losses: 0, fromMagazine: 'kids-comic', toMagazine: 'monthly-petal',
        craftBefore: 57, craftAfter: 61, series: 'Glasshouse Summer',
      },
      rivalAward: 'rookie',
    }])
    expect(s.yearStart).toEqual({ day: 336, money: 30_800, fans: 0, level: 2, copies: 0, volumes: 0 })
    // craft 57 + 4 = 61: the highest rival mean at most 61 - 6 = 55 is Monthly Petal's 52; FNV-1a of
    // "rival:7919:monthly-petal" mod 3 is 2
    expect(s.rival).toEqual({ name: 'Iori Hayama', craft: 61, magazineId: 'monthly-petal', seriesTitle: 'Glasshouse Summer' })
    expect(s.awards).toEqual([])
    expect(s.reviewUnread).toBe(1)
    expect(toasts(s, start.nextLogId - 1)).toContain('Year 1 is over. No awards this year. Your year in review is on the desk.')
    expect(s.log.map((e) => e.text)).toContain('Iori Hayama moved up to Monthly Petal with a new series, "Glasshouse Summer".')
  })

  it('runs only on a closing day', () => {
    for (const day of [0, 335, 337, 671]) {
      const g = { ...quiet(), day }
      expect(closeYear(g)).toBe(g)
    }
    expect(closeYear({ ...quiet(), day: 672 }).yearReviews).toHaveLength(1)
  })

  it('pays the Rookie Prize at the close of year one for a #1 one-shot: ¥3,000, 500 fans, 100 XP', () => {
    const g = { ...quiet(), day: 335, history: [oneShot(100, 1, 62)] }
    const s = tick(g)
    // day 336 is a weekly-cost day: 3,000 - 400 + 3,000
    expect(s.player.money).toBe(5600)
    expect(s.player.fans).toBe(500)
    expect(s.awards).toEqual([{ id: 'rookie', year: 1 }])
    const r = s.yearReviews[0]
    expect(r).toMatchObject({
      year: 1, oneShots: 1, bestOneShot: { title: 'One-shot 100', rank: 1, entrants: 13, score: 62 }, bestScore: 62,
      // the prize counts for the year it was won: 5,600 - 3,000 and 0 + 500; 100 XP takes level 1 to 2
      moneyDelta: 2600, fansDelta: 500, levelFrom: 1, levelTo: 2, awards: ['rookie'], nearMisses: [], rivalAward: null,
    })
    expect(s.log.map((e) => e.text)).toContain('You won the Rookie Prize: +¥3,000, +500 fans, +100 XP.')
    expect(toasts(s, g.nextLogId - 1)).toContain('Year 1 is over. You won the Rookie Prize. Your year in review is on the desk.')
  })

  it('takes the new year start after the prizes, so next year counts from zero', () => {
    const s = tick({ ...quiet(), day: 335, history: [oneShot(100, 1, 62)] })
    expect(s.yearStart).toEqual({ day: 336, money: 5600, fans: 500, level: 2, copies: 0, volumes: 0 })
  })

  it('pays every award won, lists them in the toast, and counts the prizes in the year', () => {
    // started on day 40 (Rookie), 8 chapters at #2 (Readers' Choice), a score of 80 (Critics'), 38,000 copies (Golden Pen)
    const ser = archived(40, { results: chapters(60, [2, 2, 2, 2, 2, 2, 2, 2], 80), totalCopies: 38_000, volumes: 2 })
    const g = yearOneEnd({ serials: [ser] })
    const s = closeYear(g)
    // 3,000 + 5,000 + 4,000 + 8,000 and 500 + 2,000 + 1,000 + 3,000
    expect(s.player.money).toBe(23_000)
    expect(s.player.fans).toBe(6500)
    // 600 XP from level 1: 100 to level 2, 160 to 3, 220 to 4, 120 left of the 280 level 4 needs
    expect(s.player).toMatchObject({ level: 4, xp: 120 })
    expect(s.awards).toEqual([
      { id: 'rookie', year: 1 }, { id: 'readers', year: 1 }, { id: 'critics', year: 1 }, { id: 'golden-pen', year: 1 },
    ])
    expect(s.yearReviews[0]).toMatchObject({
      oneShots: 0, chapters: 8, volumes: 2, copies: 38_000, bestScore: 80, moneyDelta: 20_000, fansDelta: 6500,
      levelFrom: 1, levelTo: 4, awards: ['rookie', 'readers', 'critics', 'golden-pen'], nearMisses: [], rivalAward: null,
    })
    expect(s.yearStart).toEqual({ day: 336, money: 23_000, fans: 6500, level: 4, copies: 38_000, volumes: 2 })
    expect(toasts(s, g.nextLogId - 1)).toContain(
      "Year 1 is over. You won the Rookie Prize, the Readers' Choice, the Critics' Prize and the Golden Pen. Your year in review is on the desk.",
    )
  })

  it('grows the rival 4 craft a year to 76, and moves and renames the series only when the magazine changes', () => {
    let s = quiet()
    const seen: [number, string, string][] = []
    for (let year = 1; year <= 8; year++) {
      s = closeYear({ ...s, day: year * 336 })
      seen.push([s.rival.craft, s.rival.magazineId, s.rival.seriesTitle])
    }
    // 57 Kids; 61 Petal; 65 Bolt; 69 and up Ultra (highest rival mean at most craft - 6); 77 is capped at 76
    expect(seen).toEqual([
      [61, 'monthly-petal', 'Glasshouse Summer'],
      [65, 'weekly-bolt', 'Crimson Fang Academy'],
      [69, 'ultra-seinen', 'The Quiet Prosecutor'],
      [73, 'ultra-seinen', 'The Quiet Prosecutor'],
      [76, 'ultra-seinen', 'The Quiet Prosecutor'],
      [76, 'ultra-seinen', 'The Quiet Prosecutor'],
      [76, 'ultra-seinen', 'The Quiet Prosecutor'],
      [76, 'ultra-seinen', 'The Quiet Prosecutor'],
    ])
    expect(s.log.filter((e) => e.text.startsWith('Iori Hayama moved up')).map((e) => e.text)).toEqual([
      'Iori Hayama moved up to Monthly Petal with a new series, "Glasshouse Summer".',
      'Iori Hayama moved up to Weekly Bolt with a new series, "Crimson Fang Academy".',
      'Iori Hayama moved up to Ultra Seinen with a new series, "The Quiet Prosecutor".',
    ])
    expect(s.yearReviews.map((r) => [r.year, r.rival.craftBefore, r.rival.craftAfter])).toEqual([
      [1, 57, 61], [2, 61, 65], [3, 65, 69], [4, 69, 73], [5, 73, 76], [6, 76, 76], [7, 76, 76], [8, 76, 76],
    ])
  })

  it('counts a result landing on the closing day for the year that closes, and not for the next', () => {
    const ready = withReadyOneShot({ ...quiet(), day: 329 }, { title: 'Late Bloom', genre: 'action', theme: 'samurai', audience: 'teens' }, 50, 50)
    const s = tickMany(submitProject(ready, 'weekly-bolt'), 7)
    expect(s.history.map((r) => r.day)).toEqual([336])
    expect(s.yearReviews[0]).toMatchObject({ oneShots: 1, bestOneShot: { title: 'Late Bloom' } })
    // year two runs from day 337 to day 672
    expect(buildYearReview({ ...s, day: 672 })).toMatchObject({ year: 2, oneShots: 0, bestOneShot: null, bestScore: null })
  })

  it('closes the year during a trip and leaves the trip to run its course', () => {
    const g: GameState = { ...quiet(), day: 335, trip: { placeId: 'art-class', startedDay: 333, endsDay: 337 } }
    const s = tick(g)
    // day 336: the weekly ¥400, the review filed, the trip untouched
    expect(s.trip).toBe(g.trip)
    expect(s.player.money).toBe(2600)
    expect(s.yearReviews).toHaveLength(1)
    expect(s.yearReviews[0]).toMatchObject({ year: 1, moneyDelta: -400, awards: [], rivalAward: 'rookie' })
    expect(s).toMatchObject({ reviewUnread: 1, yearStart: { day: 336, money: 2600 }, activity: 'rest' })
    // day 337: home from the Life Drawing Class as planned, Art 40 + 2
    const home = tick(s)
    expect(home.trip).toBeNull()
    expect(home.player.stats.art).toBe(42)
    expect(home.yearReviews).toHaveLength(1)
  })

  it('closes the year with an event and a poll result waiting, and leaves both waiting', () => {
    const result = oneShot(330, 5, 60)
    const g: GameState = {
      ...quiet(), day: 335, history: [result], pendingResult: result,
      event: { id: 'cold', day: 332, expiresDay: 339 },
    }
    const s = tick(g)
    expect(s.pendingResult).toBe(result)
    expect(s.event).toBe(g.event)
    expect(s.player.money).toBe(2600)
    // #5 with 60: no award, no near miss
    expect(s.yearReviews[0]).toMatchObject({ year: 1, oneShots: 1, bestScore: 60, awards: [], nearMisses: [] })
    expect(s.reviewUnread).toBe(1)
  })
})

describe('the Rookie Prize', () => {
  it('goes to a #1 one-shot or a serial started in year one', () => {
    expect(buildYearReview(yearOneEnd({ history: [oneShot(50, 4, 50), oneShot(90, 1, 55)] })).awards).toEqual(['rookie'])
    expect(buildYearReview(yearOneEnd({ serials: [archived(200)] })).awards).toEqual(['rookie'])
  })

  it('is a near miss for a best one-shot at #3, and nothing at #4', () => {
    const near = buildYearReview(yearOneEnd({ history: [oneShot(50, 5, 50), oneShot(90, 3, 55)] }))
    expect(near.awards).toEqual([])
    expect(near.nearMisses).toEqual([{ id: 'rookie', have: 3, need: 1 }])
    expect(near.bestOneShot).toEqual({ title: 'One-shot 90', rank: 3, entrants: 13, score: 55 })
    expect(buildYearReview(yearOneEnd({ history: [oneShot(90, 4, 55)] })).nearMisses).toEqual([])
  })

  it('goes to a #2 one-shot on the closing day whose serialisation offer is still waiting, paid once', () => {
    const result = oneShot(336, 2, 60)
    const offer = { magazineId: 'weekly-bolt', title: 'One-shot 336', genre: 'action', theme: 'samurai', audience: 'teens' } as const
    const g = yearOneEnd({ history: [result], pendingResult: result, pendingOffer: offer })
    const s = closeYear(g)
    expect(s.awards).toEqual([{ id: 'rookie', year: 1 }])
    expect(s.player.money).toBe(6000)
    expect(s.yearReviews[0]).toMatchObject({ awards: ['rookie'], nearMisses: [], rivalAward: null })
    expect(s.log.filter((e) => e.text.startsWith('You won the Rookie Prize'))).toHaveLength(1)
    // accepted after the close, the serial starts on day 336, in year two: no second Rookie Prize
    const serialised = acceptOffer({ ...s, pendingResult: null })
    expect(serialised.serial!.startedDay).toBe(336)
    const next = closeYear({ ...serialised, day: 672 })
    expect(next.awards).toEqual([{ id: 'rookie', year: 1 }])
    expect(next.yearReviews[1]).toMatchObject({ year: 2, awards: [] })
    // without the offer, the same #2 is only a near miss
    expect(buildYearReview(yearOneEnd({ history: [result] }))).toMatchObject({
      awards: [], nearMisses: [{ id: 'rookie', have: 2, need: 1 }], rivalAward: 'rookie',
    })
  })

  it('is not given in year two, and the rival does not take it there either', () => {
    const s = tick(yearTwoEnd({ day: 671, history: [oneShot(400, 1, 60)], serials: [archived(420)] }))
    expect(s.awards).toEqual([])
    expect(s.yearReviews[0]).toMatchObject({ year: 2, awards: [], nearMisses: [], rivalAward: null })
    expect(buildYearReview(yearTwoEnd({ history: [oneShot(400, 2, 60)] })).nearMisses).toEqual([])
  })
})

describe("the Readers' Choice", () => {
  const readers = (ranks: number[], firstDay = 400) =>
    buildYearReview(yearTwoEnd({ serials: [archived(380, { results: chapters(firstDay, ranks) })] }))

  it('goes to a serial with 8 results this year averaging rank 3.0 or better', () => {
    expect(readers([1, 2, 3, 4, 5, 3, 3, 3]).awards).toEqual(['readers'])
  })

  it('is a near miss at an average of 4.5, shown rounded up to one decimal, and nothing above it', () => {
    expect(readers([4, 4, 4, 4, 5, 5, 5, 5]).nearMisses).toEqual([{ id: 'readers', have: 4.5, need: 3 }])
    // 25 / 8 = 3.125 misses 3.0 and shows as 3.2, never as a 3.0 that looks like a win
    expect(readers([3, 3, 3, 3, 3, 3, 3, 4])).toMatchObject({ awards: [], nearMisses: [{ id: 'readers', have: 3.2, need: 3 }] })
    // 37 / 8 = 4.625
    expect(readers([4, 4, 4, 4, 5, 5, 5, 6])).toMatchObject({ awards: [], nearMisses: [] })
  })

  it('needs 8 results inside this year: 7, or 8 with one from last year, is not enough', () => {
    expect(readers([1, 1, 1, 1, 1, 1, 1])).toMatchObject({ awards: [], nearMisses: [] })
    // the first result lands on day 336, the closing day of year one
    expect(readers([1, 1, 1, 1, 1, 1, 1, 1], 336)).toMatchObject({ awards: [], nearMisses: [] })
  })

  it('judges the best serial of the year: the running one and the archive alike', () => {
    const s = yearTwoEnd({
      serials: [archived(380, { results: chapters(400, [6, 6, 6, 6, 6, 6, 6, 6]) })],
      serial: { ...archived(500, { id: 9, results: chapters(510, [2, 2, 2, 2, 2, 2, 2, 2]) }), status: 'running', endedDay: null },
    })
    expect(buildYearReview(s).awards).toEqual(['readers'])
  })
})

describe("the Critics' Prize", () => {
  const critics = (score: number) => buildYearReview(yearTwoEnd({ history: [oneShot(400, 6, score)] }))

  it('goes to a best score of 75 or more; 68 to 74 is a near miss; 67 is nothing', () => {
    expect(critics(75).awards).toEqual(['critics'])
    expect(critics(74)).toMatchObject({ awards: [], nearMisses: [{ id: 'critics', have: 74, need: 75 }] })
    expect(critics(68)).toMatchObject({ awards: [], nearMisses: [{ id: 'critics', have: 68, need: 75 }] })
    expect(critics(67)).toMatchObject({ awards: [], nearMisses: [] })
  })

  it('lists a best score of 70 as a near miss at the close', () => {
    const s = tick(yearTwoEnd({ day: 671, history: [oneShot(400, 5, 70)] }))
    expect(s.yearReviews[0]).toMatchObject({ bestScore: 70, awards: [], nearMisses: [{ id: 'critics', have: 70, need: 75 }] })
    expect(s.awards).toEqual([])
  })

  it('counts chapter scores too', () => {
    const s = yearTwoEnd({ serials: [archived(380, { results: [chapter(1, 400, 5, 76)] })] })
    expect(buildYearReview(s)).toMatchObject({ bestScore: 76, awards: ['critics'] })
  })
})

describe('the Golden Pen', () => {
  it('goes to 37,000 copies sold this year, the bar itself: ¥8,000, 3,000 fans, 200 XP at the close', () => {
    const g = yearTwoEnd({ day: 671, serials: [archived(400, { totalCopies: 37_000, volumes: 2 })] })
    const s = tick(g)
    // day 672 is a weekly-cost day: 3,000 - 400 + 8,000
    expect(s.player.money).toBe(10_600)
    expect(s.player.fans).toBe(3000)
    expect(s.awards).toEqual([{ id: 'golden-pen', year: 2 }])
    expect(s.yearReviews[0]).toMatchObject({ year: 2, copies: 37_000, volumes: 2, awards: ['golden-pen'], nearMisses: [] })
  })

  it('is a near miss from 22,000 copies up to 36,999, and nothing at 21,999', () => {
    const pen = (totalCopies: number) => buildYearReview(yearTwoEnd({ serials: [archived(400, { totalCopies })] }))
    expect(pen(36_999)).toMatchObject({ awards: [], nearMisses: [{ id: 'golden-pen', have: 36_999, need: 37_000 }] })
    expect(pen(22_000).nearMisses).toEqual([{ id: 'golden-pen', have: 22_000, need: 37_000 }])
    expect(pen(21_999).nearMisses).toEqual([])
  })

  it('counts only the copies sold since the year began, across the running serial and the archive', () => {
    const s = yearTwoEnd({
      yearStart: { day: 336, money: 3000, fans: 0, level: 1, copies: 10_000, volumes: 1 },
      serials: [archived(100, { totalCopies: 10_000, volumes: 1 })],
      serial: { ...archived(400, { id: 9, totalCopies: 30_000, volumes: 2 }), status: 'running', endedDay: null },
    })
    // 40,000 sold in all (enough to win), 10,000 of them before the year began: this year's 30,000 is a near miss
    expect(buildYearReview(s)).toMatchObject({ copies: 30_000, volumes: 2, awards: [], nearMisses: [{ id: 'golden-pen', have: 30_000, need: 37_000 }] })
  })
})

describe('buildYearReview', () => {
  it('picks the best one-shot by rank, then by score', () => {
    const r = buildYearReview(yearTwoEnd({ history: [oneShot(400, 2, 60), oneShot(450, 2, 66), oneShot(500, 3, 70)] }))
    expect(r.bestOneShot).toEqual({ title: 'One-shot 450', rank: 2, entrants: 13, score: 66 })
    expect(r.bestScore).toBe(70)
    expect(r.oneShots).toBe(3)
  })

  it("counts this year's head to head with the rival over one-shots and chapters", () => {
    const at = (rank: number): RivalPlacing => ({ name: 'Iori Hayama', score: 55, rank })
    const s = yearTwoEnd({
      history: [
        oneShot(336, 2, 60, at(5)), // last year: not counted
        oneShot(400, 2, 60, at(5)), // win
        oneShot(500, 6, 50, at(2)), // loss
        oneShot(600, 3, 55, at(4)), // win
        oneShot(610, 4, 55), // the rival was elsewhere
      ],
      serials: [archived(380, { results: [chapter(1, 620, 1, 70, at(3)), chapter(2, 627, 5, 50, at(5))] })], // win, tie
    })
    expect(buildYearReview(s).rival).toMatchObject({ wins: 3, losses: 1 })
  })

  it('counts chapters from every serial this year only', () => {
    const s = yearTwoEnd({
      serials: [archived(100, { results: chapters(300, [4, 4, 4, 4, 4, 4]) })], // days 300 to 335
      serial: { ...archived(400, { id: 9, results: chapters(420, [3, 3, 3]) }), status: 'running', endedDay: null },
    })
    // days 300, 307, ..., 335 are last year's; 420, 427 and 434 are this year's
    expect(buildYearReview(s).chapters).toBe(3)
  })
})

describe('markReviewRead', () => {
  it('clears the unread review, and leaves a state with none as it was', () => {
    const s = closeYear(yearOneEnd())
    expect(s.reviewUnread).toBe(1)
    expect(markReviewRead(s).reviewUnread).toBeNull()
    const read = markReviewRead(s)
    expect(markReviewRead(read)).toBe(read)
  })
})

describe('studioLook.trophies', () => {
  it('is the awards list itself, one trophy per award won, oldest first', () => {
    const fresh = quiet()
    expect(studioLook(fresh).trophies).toBe(fresh.awards)
    expect(studioLook(fresh).trophies).toEqual([])
    const g = { ...quiet(), awards: [{ id: 'rookie', year: 1 }, { id: 'golden-pen', year: 2 }, { id: 'golden-pen', year: 3 }] } as GameState
    const look = studioLook(g)
    expect(look.trophies).toBe(g.awards)
    expect(look.trophies.map((a) => a.id)).toEqual(['rookie', 'golden-pen', 'golden-pen'])
  })
})

describe('award data', () => {
  it('has the four awards of the brief with their prizes', () => {
    expect(AWARDS.map((a) => [a.id, a.name, a.prize.money, a.prize.fans, a.prize.xp])).toEqual([
      ['rookie', 'Rookie Prize', 3000, 500, 100],
      ['readers', "Readers' Choice", 5000, 2000, 150],
      ['critics', "Critics' Prize", 4000, 1000, 150],
      ['golden-pen', 'Golden Pen', 8000, 3000, 200],
    ])
  })

  it("has the bars to win and to miss narrowly; the Golden Pen's are 37,000 and 22,000 copies (Task 19, Package A)", () => {
    expect(AWARDS.map((a) => [a.id, a.need, a.near])).toEqual([
      ['rookie', 1, 3], ['readers', 3, 4.5], ['critics', 75, 68], ['golden-pen', 37_000, 22_000],
    ])
  })
})
