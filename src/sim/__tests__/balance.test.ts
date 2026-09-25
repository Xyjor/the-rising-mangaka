import { beforeAll, describe, expect, it } from 'vitest'
import { createGame } from '../index'
import type { BotRun, BotSerial } from '../bot'
import { calibration, calibrationError, measureP1, median, offerInOpening, runBalance, shortOfOpening } from '../balance'
import type { BalanceRuns, P1Measures } from '../balance'

// The balance-band table's P1 rows (DESIGN.md "Balance bands"), 20 seeds each. These thresholds change only with
// owner sign-off: when a rule change pushes a row out of its band, tune a knob (DESIGN.md lists them in order) and
// record the change, never the threshold.
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)

describe('balance bands, P1 (seeds 1-20)', { timeout: 30000 }, () => {
  let m: P1Measures
  // Every bot run the rows read, played once: the sensible and careless bots three ways each, the stress case once.
  beforeAll(() => {
    m = measureP1(runBalance(SEEDS))
  }, 30000)

  it('sensible bot, first one-shot score: 40-55 on at least 13 of 20 seeds, median 44-52', () => {
    expect(m.firstScores.filter((x) => x !== null && x >= 40 && x <= 55).length).toBeGreaterThanOrEqual(13)
    const mid = median(m.firstScores)
    expect(mid).not.toBeNull()
    expect(mid!).toBeGreaterThanOrEqual(44)
    expect(mid!).toBeLessThanOrEqual(52)
  })

  it('sensible minus careless, mean score of the first 6 one-shots: at least 8', () => {
    expect(m.firstSixMean.sensible - m.firstSixMean.careless).toBeGreaterThanOrEqual(8)
  })

  it('sensible bot, organic offer within the first 6 one-shots on at least 16 of 20; median first offer by one-shot 3', () => {
    expect(m.offerWithinSix.sensible).toBeGreaterThanOrEqual(16)
    expect(m.medianFirstOffer).not.toBeNull()
    expect(m.medianFirstOffer!).toBeLessThanOrEqual(3)
  })

  it('careless bot, organic offer within 6 one-shots on at most 6 of 20', () => {
    expect(m.offerWithinSix.careless).toBeLessThanOrEqual(6)
  })

  it("sensible bot's first serial reaches 8 results on at least 14 of 20", () => {
    expect(m.firstSerialReached8).toBeGreaterThanOrEqual(14)
  })

  it('stress case (forced Weekly Bolt, no points, balanced focus): cancelled on at least 15 of 20, never before its 5th result', () => {
    expect(m.stressCancelledAt.length).toBeGreaterThanOrEqual(15)
    for (const results of m.stressCancelledAt) expect(results).toBeGreaterThanOrEqual(5)
  })

  it('careless bot money at its 6th result: under ¥3,000 on at least 15 of 20', () => {
    expect(m.carelessMoneyAtSixth.filter((x) => x !== null && x < 3000).length).toBeGreaterThanOrEqual(15)
  })

  it('forecast calibration over year one: offers seen within ±30% of the summed offer chances', () => {
    const err = calibrationError(m.calibration.all)
    expect(err).not.toBeNull()
    expect(Math.abs(err!)).toBeLessThanOrEqual(0.3)
  })

  it('sensible bot weeks in debt, year one: 0 on at least 18 of 20', () => {
    expect(m.sensibleWeeksInDebt.filter((w) => w === 0).length).toBeGreaterThanOrEqual(18)
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
    moneyAtDay: [3000],
    final: createGame('Rin', 1),
  }
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
