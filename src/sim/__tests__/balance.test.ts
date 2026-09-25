import { beforeAll, describe, expect, it } from 'vitest'
import { EQUIPMENT_PRICE_SCALE, createGame } from '../index'
import type { AwardId, GameState, YearReview } from '../index'
import type { BotRun, BotSerial } from '../bot'
import {
  BANDS, calibration, calibrationError, countIn, firstAnimeOffer, meanOf, measureP1, measureP2, median,
  moneyBuyingNothing, offerInOpening, priceScale, runBalance, shortOfOpening, winShare,
} from '../balance'
import type { BalanceRuns, P1Measures, P2Measures } from '../balance'

// The balance-band table (DESIGN.md "Balance bands"), 20 seeds each, against `BANDS`. Those targets change only with
// owner sign-off: when a rule change pushes a row out of its band, tune a knob (DESIGN.md lists them in order) and
// record the change, never the target.
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)

describe('balance bands (seeds 1-20)', { timeout: 30000 }, () => {
  let m: P1Measures
  let m2: P2Measures
  let animeDays: (number | null)[]
  let s1: number | null
  // Every bot run the rows read, played once: the sensible and careless bots three ways each, the stress case once,
  // the sensible bot until its first anime offer (at most two years), and year one buying nothing (S1).
  beforeAll(() => {
    const runs = runBalance(SEEDS)
    m = measureP1(runs)
    m2 = measureP2(runs)
    animeDays = firstAnimeOffer(SEEDS)
    s1 = median(moneyBuyingNothing(SEEDS))
  }, 30000)

  describe('Package 1', () => {
    const score = BANDS.firstScore
    it(`sensible bot, first one-shot score: ${score.low}-${score.high} on at least ${score.atLeast} of 20 seeds, median ${score.medianLow}-${score.medianHigh}`, () => {
      expect(countIn(m.firstScores, score.low, score.high)).toBeGreaterThanOrEqual(score.atLeast)
      const mid = median(m.firstScores)
      expect(mid).not.toBeNull()
      expect(mid!).toBeGreaterThanOrEqual(score.medianLow)
      expect(mid!).toBeLessThanOrEqual(score.medianHigh)
    })

    it(`sensible minus careless, mean score of the first 6 one-shots: at least ${BANDS.firstSixGap.atLeast}`, () => {
      expect(m.firstSixMean.sensible - m.firstSixMean.careless).toBeGreaterThanOrEqual(BANDS.firstSixGap.atLeast)
    })

    const offer = BANDS.sensibleOffer
    it(`sensible bot, organic offer within the first 6 one-shots on at least ${offer.atLeast} of 20; median first offer by one-shot ${offer.medianAtMost}`, () => {
      expect(m.offerWithinSix.sensible).toBeGreaterThanOrEqual(offer.atLeast)
      expect(m.medianFirstOffer).not.toBeNull()
      expect(m.medianFirstOffer!).toBeLessThanOrEqual(offer.medianAtMost)
    })

    it(`careless bot, organic offer within 6 one-shots on at most ${BANDS.carelessOffer.atMost} of 20`, () => {
      expect(m.offerWithinSix.careless).toBeLessThanOrEqual(BANDS.carelessOffer.atMost)
    })

    it(`sensible bot's first serial reaches 8 results on at least ${BANDS.firstSerial.atLeast} of 20`, () => {
      expect(m.firstSerialReached8).toBeGreaterThanOrEqual(BANDS.firstSerial.atLeast)
    })

    const stress = BANDS.stress
    it(`stress case (forced Weekly Bolt, no points, balanced focus): cancelled on at least ${stress.atLeast} of 20, never before its ${stress.notBefore}th result`, () => {
      expect(m.stressCancelledAt.length).toBeGreaterThanOrEqual(stress.atLeast)
      for (const results of m.stressCancelledAt) expect(results).toBeGreaterThanOrEqual(stress.notBefore)
    })

    const money = BANDS.carelessMoney
    it(`careless bot money at its 6th result: under ¥${money.under} on at least ${money.atLeast} of 20`, () => {
      expect(m.carelessMoneyAtSixth.filter((x) => x !== null && x < money.under).length).toBeGreaterThanOrEqual(money.atLeast)
    })

    it(`forecast calibration over year one: offers seen within ±${BANDS.calibration.within * 100}% of the summed offer chances`, () => {
      const err = calibrationError(m.calibration.all)
      expect(err).not.toBeNull()
      expect(Math.abs(err!)).toBeLessThanOrEqual(BANDS.calibration.within)
    })

    it(`sensible bot weeks in debt, year one: 0 on at least ${BANDS.debtFree.atLeast} of 20`, () => {
      expect(countIn(m.sensibleWeeksInDebt, 0, 0)).toBeGreaterThanOrEqual(BANDS.debtFree.atLeast)
    })
  })

  describe('Package 2', () => {
    const events = BANDS.events
    it(`events per year (sensible): a mean of ${events.low}-${events.high} land in year one`, () => {
      const perYear = meanOf(m2.events)
      expect(perYear).toBeGreaterThanOrEqual(events.low)
      expect(perYear).toBeLessThanOrEqual(events.high)
    })

    const rival = BANDS.rival
    it(`rival met in year one on at least ${rival.metAtLeast} of 20; the bot wins ${rival.winShareLow * 100}-${rival.winShareHigh * 100}% of the meetings`, () => {
      expect(m2.rival.filter((r) => r.wins + r.losses > 0).length).toBeGreaterThanOrEqual(rival.metAtLeast)
      const share = winShare(m2.rival)
      expect(share).not.toBeNull()
      expect(share!).toBeGreaterThanOrEqual(rival.winShareLow)
      expect(share!).toBeLessThanOrEqual(rival.winShareHigh)
    })

    const awards = BANDS.awards
    it(`award or near miss in year one on at least ${awards.atLeast} of 20; the Golden Pen in year one on at most ${awards.goldenPenAtMost}`, () => {
      expect(m2.awards.filter((a) => a.won.length + a.near.length > 0).length).toBeGreaterThanOrEqual(awards.atLeast)
      expect(m2.awards.filter((a) => a.won.includes('golden-pen')).length).toBeLessThanOrEqual(awards.goldenPenAtMost)
    })

    const kit = BANDS.equipment
    it(`equipment owned at day 336 (sensible, buying): ${kit.low}-${kit.high} pieces on at least ${kit.atLeast} of 20`, () => {
      expect(countIn(m2.equipment, kit.low, kit.high)).toBeGreaterThanOrEqual(kit.atLeast)
    })

    const anime = BANDS.anime
    it(`anime offer within two years (sensible) on ${anime.low}-${anime.high} of 20`, () => {
      const offered = animeDays.filter((d) => d !== null).length
      expect(offered).toBeGreaterThanOrEqual(anime.low)
      expect(offered).toBeLessThanOrEqual(anime.high)
    })

    it('the equipment price scale is the one S1 gives: S1 / 9000 rounded to 0.25, within 0.75-16', () => {
      expect(s1).not.toBeNull()
      expect(EQUIPMENT_PRICE_SCALE).toBe(priceScale(s1!))
    })
  })
})


interface RunSpec {
  /** one one-shot per score */
  scores?: number[]
  /** money right after each one-shot (default 3000) */
  money?: number[]
  /** the forecast offer chance of each one-shot (default 0) */
  chances?: number[]
  /** whether each one-shot earned an offer (default no) */
  offers?: boolean[]
  firstOfferAt?: number | null
  serials?: BotSerial[]
  weeksInDebt?: number
  /** random events that landed */
  events?: number
  /** year one's review, filed at the close (none when the run stopped short of it) */
  review?: YearReview
  /** equipment the studio owns at the end of the run */
  owned?: GameState['studio']['owned']
}

/** A year-one review: only the head to head, the awards and the near misses are set, everything else is filler. */
function yearOne(wins: number, losses: number, awards: AwardId[] = [], near: AwardId[] = []): YearReview {
  return {
    year: 1, oneShots: 2, bestOneShot: null, chapters: 10, volumes: 2, copies: 9000, bestScore: 60, moneyDelta: 0,
    fansDelta: 0, levelFrom: 1, levelTo: 5, awards, nearMisses: near.map((id) => ({ id, have: 0, need: 0 })),
    rival: {
      name: 'Touya Kagami', wins, losses, fromMagazine: 'kids-comic', toMagazine: 'monthly-petal', craftBefore: 50,
      craftAfter: 54, series: 'Paper Moon Letters',
    },
    rivalAward: null,
  }
}

/** A hand-made bot run: only what the measurements read is set, everything else is filler. */
function run(spec: RunSpec): BotRun {
  const count = Math.max(spec.scores?.length ?? 0, spec.chances?.length ?? 0)
  return {
    oneShots: Array.from({ length: count }, (_, i) => ({
      day: 24 * (i + 1), score: spec.scores?.[i] ?? 50, rank: 5, entrants: 11, magazineId: 'kids-comic',
      money: spec.money?.[i] ?? 3000, offer: spec.offers?.[i] ?? false, offerChance: spec.chances?.[i] ?? 0,
    })),
    firstOfferAt: spec.firstOfferAt ?? null,
    serials: spec.serials ?? [],
    weeksInDebt: spec.weeksInDebt ?? 0,
    events: spec.events ?? 0,
    moneyAtDay: [3000],
    final: finalState(spec),
  }
}

function finalState(spec: RunSpec): GameState {
  const g = createGame('Rin', 1)
  return { ...g, yearReviews: spec.review ? [spec.review] : [], studio: { tier: 'apartment', owned: spec.owned ?? [] } }
}

const shots = (n: number) => Array.from({ length: n }, () => 50)

describe('balance measurements', () => {
  it('median: the middle value, the mean of the middle two, missing values last', () => {
    expect(median([45, 40, 50])).toBe(45)
    // 40, 43, 45, 50: (43 + 45) / 2
    expect(median([50, 43, 45, 40])).toBe(44)
    // 3, null, null: the middle is missing
    expect(median([null, 3, null])).toBeNull()
    // 2, 4, null, null: the middle two are 4 and a missing value
    expect(median([null, 4, 2, null])).toBeNull()
    // 1, 2, 3, null: (2 + 3) / 2
    expect(median([3, null, 1, 2])).toBe(2.5)
  })

  it('counts a first offer only within the first six one-shots, and runs cut short before six', () => {
    expect(offerInOpening(run({ scores: shots(2), firstOfferAt: 2 }))).toBe(2)
    expect(offerInOpening(run({ scores: shots(6), firstOfferAt: 6 }))).toBe(6)
    expect(offerInOpening(run({ scores: shots(7), firstOfferAt: 7 }))).toBeNull()
    expect(offerInOpening(run({ scores: shots(1) }))).toBeNull()
    // five one-shots is short of six, six is not, none is
    expect(shortOfOpening([run({ scores: shots(5) }), run({ scores: shots(6) }), run({})])).toBe(2)
  })

  it('calibration sums the quoted offer chances against the offers seen', () => {
    // 0.5 + 0.25 + 0.25 = 1 expected across both runs; 2 offers seen: (2 - 1) / 1 = +100%
    const c = calibration([run({ chances: [0.5, 0.25], offers: [true, false] }), run({ chances: [0.25], offers: [true] })])
    expect(c).toEqual({ expected: 1, seen: 2 })
    expect(calibrationError(c)).toBe(1)
    // 4 expected, 3 seen: (3 - 4) / 4 = -25%
    expect(calibrationError({ expected: 4, seen: 3 })).toBe(-0.25)
    // nothing was forecast: no error to report
    expect(calibrationError({ expected: 0, seen: 1 })).toBeNull()
  })

  it('reads each P1 row from the run that defines it', () => {
    const runs: BalanceRuns = {
      seeds: [1, 2],
      sensible: [
        {
          year: run({ chances: [0.5, 0.5], offers: [true, false] }),
          opening: run({ scores: [50, 60], firstOfferAt: 2 }),
          serial: run({ serials: [{ magazineId: 'kids-comic', startedDay: 48, results: 8, status: 'running' }] }),
        },
        {
          year: run({ chances: [0.25], weeksInDebt: 2 }),
          // the offer came with the 7th one-shot, the 99 is past the first six
          opening: run({ scores: [40, 44, 48, 52, 56, 60, 99], firstOfferAt: 7 }),
          serial: run({}),
        },
      ],
      careless: [
        {
          year: run({ chances: [0.25], offers: [true], weeksInDebt: 3 }),
          opening: run({ scores: [30, 30, 30, 30, 30, 30], money: [2900, 2800, 2700, 2600, 2500, 2400] }),
          serial: run({}),
        },
        { year: run({}), opening: run({ scores: [36], money: [2000] }), serial: run({}) },
      ],
      stress: [
        run({ serials: [{ magazineId: 'weekly-bolt', startedDay: 149, results: 6, status: 'cancelled' }] }),
        run({ serials: [{ magazineId: 'weekly-bolt', startedDay: 149, results: 9, status: 'running' }] }),
      ],
    }
    expect(measureP1(runs)).toEqual({
      // the first one-shot of each sensible opening run
      firstScores: [50, 40],
      // sensible: seed 1 (50 + 60) / 2 = 55, seed 2 (40 + 44 + 48 + 52 + 56 + 60) / 6 = 50, (55 + 50) / 2 = 52.5;
      // careless: seed 1 30, seed 2 36, (30 + 36) / 2 = 33
      firstSixMean: { sensible: 52.5, careless: 33 },
      // sensible seed 1 (2 one-shots), careless seed 2 (1)
      shortOfSix: { sensible: 1, careless: 1 },
      // sensible seed 1 at one-shot 2; seed 2's offer at 7 is too late
      offerWithinSix: { sensible: 1, careless: 0 },
      // 2 and a missing value: the middle two include the missing one
      medianFirstOffer: null,
      firstSerialReached8: 1,
      noFirstSerial: 1,
      // only the first stress run was cancelled, at its 6th result
      stressCancelledAt: [6],
      // money after careless seed 1's 6th one-shot; seed 2 never published six
      carelessMoneyAtSixth: [2400, null],
      // year one only: sensible 0.5 + 0.5 + 0.25 = 1.25 with 1 offer, careless 0.25 with 1
      calibration: {
        all: { expected: 1.5, seen: 2 },
        sensible: { expected: 1.25, seen: 1 },
        careless: { expected: 0.25, seen: 1 },
      },
      sensibleWeeksInDebt: [0, 2],
    })
  })
})

describe('balance measurements, Package 2', () => {
  it('priceScale is S1 / 9000 to the nearest quarter, held within 0.75 and 16', () => {
    // 101,816.5 / 9000 = 11.313; x 4 = 45.25, rounds to 45: 11.25
    expect(priceScale(101_816.5)).toBe(11.25)
    // 127,356 / 9000 = 14.151; x 4 = 56.6, rounds to 57: 14.25
    expect(priceScale(127_356)).toBe(14.25)
    // 9,000 is exactly 1; 3,000 would be 0.33, held at 0.75; 180,000 would be 20, held at 16
    expect([9000, 3000, 180_000].map(priceScale)).toEqual([1, 0.75, 16])
  })

  it('countIn counts the values inside a band, both ends included, never a missing one', () => {
    // 40, 55 and 47 are in 40-55; 39 and 56 are just outside
    expect(countIn([40, 55, 39, 56, null, 47], 40, 55)).toBe(3)
  })

  it('meanOf averages, and is 0 for nothing', () => {
    // (8 + 11 + 14) / 3
    expect(meanOf([8, 11, 14])).toBe(11)
    expect(meanOf([])).toBe(0)
  })

  it("winShare pools every seed's meetings: wins over wins and losses", () => {
    // 3 + 0 + 1 = 4 wins of 4 + 0 + 4 = 8 meetings
    expect(winShare([{ wins: 3, losses: 1 }, { wins: 0, losses: 0 }, { wins: 1, losses: 3 }])).toBe(0.5)
    expect(winShare([{ wins: 0, losses: 0 }])).toBeNull()
  })

  it("reads each P2 row from the sensible bot's year-one run", () => {
    const empty = { year: run({}), opening: run({}), serial: run({}) }
    const runs: BalanceRuns = {
      seeds: [1, 2],
      sensible: [
        {
          ...empty,
          year: run({ events: 11, review: yearOne(12, 4, ['rookie', 'readers'], ['golden-pen']), owned: ['coffee', 'lamp'] }),
          // the opening and serial runs do not count, whatever they hold
          opening: run({ events: 30, owned: ['coffee', 'lamp', 'shelf', 'chair'] }),
        },
        // no review: a run that stopped short of the close meets nobody and wins nothing
        { ...empty, year: run({ events: 9 }) },
      ],
      careless: [{ ...empty, year: run({ events: 5, review: yearOne(0, 9) }) }, empty],
      stress: [run({}), run({})],
    }
    expect(measureP2(runs)).toEqual({
      events: [11, 9],
      rival: [{ wins: 12, losses: 4 }, { wins: 0, losses: 0 }],
      awards: [{ won: ['rookie', 'readers'], near: ['golden-pen'] }, { won: [], near: [] }],
      equipment: [2, 0],
    })
  })
})
