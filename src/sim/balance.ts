// Balance-band measurements: plays the balance bots (bot.ts) over a range of seeds and reduces the runs to one
// measurement per row of the balance-band table (DESIGN.md "Balance bands"), and holds that table's targets (`BANDS`).
// src/sim/__tests__/balance.test.ts asserts the targets against the measurements and scripts/balance.ts prints both,
// so the readout and the tests cannot drift apart. Pure: no clock, no random source; every run is a deterministic
// function of its seed.
import { CARELESS, OPENING_ONE_SHOTS, SENSIBLE, STRESS_BOLT, firstSixMean, runBot } from './bot'
import { DAYS_PER_YEAR } from './data'
import type { BotPolicy, BotRun } from './bot'
import type { AwardId, GameState } from './types'

/**
 * The balance-band table's targets, judged over 20 seeds (seeds 1 to 20): counts are out of 20. balance.test.ts asserts
 * every row but the anime one, which only the script reports. These change only with owner sign-off: when a rule
 * change pushes a row out of its band, tune a knob (DESIGN.md lists them) and record the change, never these numbers.
 */
export const BANDS = {
  // Package 1
  /** sensible bot, first one-shot score: in low-high on at least `atLeast` seeds, median in medianLow-medianHigh */
  firstScore: { low: 40, high: 55, atLeast: 13, medianLow: 44, medianHigh: 52 },
  /** sensible minus careless, mean score of the first 6 one-shots */
  firstSixGap: { atLeast: 8 },
  /** sensible bot, organic offer within the first 6 one-shots; median first offer by one-shot `medianAtMost` */
  sensibleOffer: { atLeast: 16, medianAtMost: 3 },
  /** careless bot, organic offer within 6 */
  carelessOffer: { atMost: 6 },
  /** sensible bot's first serial reaches SERIAL_TARGET_RESULTS results */
  firstSerial: { atLeast: 14 },
  /** stress case cancelled on at least `atLeast` seeds, never before its `notBefore`th result */
  stress: { atLeast: 15, notBefore: 5 },
  /** careless bot's money at its 6th result under `under` */
  carelessMoney: { under: 3000, atLeast: 15 },
  /** forecast calibration, (seen - expected) / expected over year one */
  calibration: { within: 0.3 },
  /** sensible bot, no week in debt in year one */
  debtFree: { atLeast: 18 },
  // Package 2
  /** sensible bot, mean random events that land in year one */
  events: { low: 8, high: 13 },
  /** sensible bot meets the rival in year one on `metAtLeast` seeds; its share of the meetings won */
  rival: { metAtLeast: 16, winShareLow: 0.35, winShareHigh: 0.75 },
  /** sensible bot, an award or a near miss in year one; the Golden Pen in year one on at most `goldenPenAtMost` */
  awards: { atLeast: 16, goldenPenAtMost: 5 },
  /** sensible bot (buying), low-high pieces of equipment owned at day 336 */
  equipment: { low: 2, high: 3, atLeast: 12 },
  /** sensible bot, an anime offer within two years (script only) */
  anime: { low: 6, high: 16 },
} as const

/** One in-game year. */
export const YEAR = DAYS_PER_YEAR
/** Runs judged on the first six one-shots or the first serial get three years, so a long serial cannot cut them short. */
export const LONG = 3 * YEAR
/** The first serial's target in the balance bands. */
export const SERIAL_TARGET_RESULTS = 8
/** The stress case gets six one-shot cycles (about 144 days) plus a year of serial, like the old script. */
export const STRESS_DAYS = 480

/** Each seed and bot is played three ways, and every balance row reads the run that defines it. */
export interface SeedRuns {
  /** year one: weeks in debt, forecast calibration */
  year: BotRun
  /** until the sixth one-shot polls (at most three years): first offer, first score, mean of 6, money at the 6th */
  opening: BotRun
  /** until the first serial ends or reaches 8 results (at most three years) */
  serial: BotRun
}

function firstSerialSettled(s: GameState): boolean {
  const first = s.serials[0] ?? s.serial
  return !!first && (first.status !== 'running' || first.results.length >= SERIAL_TARGET_RESULTS)
}

function runSeed(seed: number, p: BotPolicy): SeedRuns {
  return {
    year: runBot(seed, p, { days: YEAR }),
    opening: runBot(seed, p, { days: LONG, maxOneShots: OPENING_ONE_SHOTS }),
    serial: runBot(seed, p, { days: LONG, until: firstSerialSettled }),
  }
}

/** Every run the P1 rows read, per seed in `seeds`: the sensible and careless bots three ways, the stress case once. */
export interface BalanceRuns {
  seeds: number[]
  sensible: SeedRuns[]
  careless: SeedRuns[]
  stress: BotRun[]
}

export function runBalance(seeds: number[]): BalanceRuns {
  return {
    seeds,
    sensible: seeds.map((seed) => runSeed(seed, SENSIBLE)),
    careless: seeds.map((seed) => runSeed(seed, CARELESS)),
    stress: seeds.map((seed) => runBot(seed, STRESS_BOLT, { days: STRESS_DAYS })),
  }
}

// ---------- helpers ----------

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Median with missing values (null) sorted last; null when the middle lands on a missing value. */
export function median(xs: (number | null)[]): number | null {
  const sorted = xs.map((x) => x ?? Infinity).sort((a, b) => a - b)
  const mid = sorted.length / 2
  const m = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
  return Number.isFinite(m) ? m : null
}

/** 1-based index of the first organic offer if it came within the first six one-shots. */
export function offerInOpening(run: BotRun): number | null {
  return run.firstOfferAt !== null && run.firstOfferAt <= OPENING_ONE_SHOTS ? run.firstOfferAt : null
}

/** How many runs a serial or the day limit stopped before their sixth one-shot. */
export function shortOfOpening(runs: BotRun[]): number {
  return runs.filter((r) => r.oneShots.length < OPENING_ONE_SHOTS).length
}

/** Forecast calibration: the offer chances the pitch screen quoted, summed, against the offers that came. */
export interface Calibration {
  expected: number
  seen: number
}

export function calibration(runs: BotRun[]): Calibration {
  const shots = runs.flatMap((r) => r.oneShots)
  return { expected: shots.reduce((a, o) => a + o.offerChance, 0), seen: shots.filter((o) => o.offer).length }
}

/** How far the offers seen are off the forecast, as a fraction of it: (seen - expected) / expected; null if none. */
export function calibrationError(c: Calibration): number | null {
  return c.expected > 0 ? (c.seen - c.expected) / c.expected : null
}

/** How many of `xs` lie in low..high, both included (missing values never do). */
export function countIn(xs: (number | null)[], low: number, high: number): number {
  return xs.filter((x) => x !== null && x >= low && x <= high).length
}

// ---------- the P1 rows ----------

/** One measurement per P1 row, in the table's order. Counts are out of `seeds.length`. */
export interface P1Measures {
  /** sensible bot, first one-shot score per seed (null if it never polled one) */
  firstScores: (number | null)[]
  /** mean score of the first six one-shots over every seed, for each bot */
  firstSixMean: { sensible: number; careless: number }
  /** seeds whose opening run stopped before the sixth one-shot, for each bot */
  shortOfSix: { sensible: number; careless: number }
  /** seeds with an organic offer within the first six one-shots, for each bot */
  offerWithinSix: { sensible: number; careless: number }
  /** sensible bot, median one-shot of its first offer (null when most seeds had none within six) */
  medianFirstOffer: number | null
  /** sensible bot, seeds whose first serial reached 8 results */
  firstSerialReached8: number
  /** sensible bot, seeds with no serial at all within three years */
  noFirstSerial: number
  /** stress case, the result count at which each cancelled serial was cancelled */
  stressCancelledAt: number[]
  /** careless bot, money right after its 6th one-shot paid out, per seed (null if it never published six) */
  carelessMoneyAtSixth: (number | null)[]
  /** forecast calibration over year one, both bots together and each alone */
  calibration: { all: Calibration; sensible: Calibration; careless: Calibration }
  /** sensible bot, weeks in debt in year one, per seed */
  sensibleWeeksInDebt: number[]
}

export function measureP1(runs: BalanceRuns): P1Measures {
  const sOpen = runs.sensible.map((r) => r.opening)
  const cOpen = runs.careless.map((r) => r.opening)
  const sYear = runs.sensible.map((r) => r.year)
  const cYear = runs.careless.map((r) => r.year)
  const openingMean = (rs: BotRun[]) => mean(rs.map(firstSixMean).filter((x): x is number => x !== null))
  const offerWithin = (rs: BotRun[]) => rs.filter((r) => offerInOpening(r) !== null).length
  const firstSerials = runs.sensible.map((r) => r.serial.serials[0])
  return {
    firstScores: sOpen.map((r) => r.oneShots[0]?.score ?? null),
    firstSixMean: { sensible: openingMean(sOpen), careless: openingMean(cOpen) },
    shortOfSix: { sensible: shortOfOpening(sOpen), careless: shortOfOpening(cOpen) },
    offerWithinSix: { sensible: offerWithin(sOpen), careless: offerWithin(cOpen) },
    medianFirstOffer: median(sOpen.map(offerInOpening)),
    firstSerialReached8: firstSerials.filter((x) => (x?.results ?? 0) >= SERIAL_TARGET_RESULTS).length,
    noFirstSerial: firstSerials.filter((x) => !x).length,
    stressCancelledAt: runs.stress.flatMap((r) => (r.serials[0]?.status === 'cancelled' ? [r.serials[0].results] : [])),
    carelessMoneyAtSixth: cOpen.map((r) => r.oneShots[OPENING_ONE_SHOTS - 1]?.money ?? null),
    calibration: {
      all: calibration([...sYear, ...cYear]),
      sensible: calibration(sYear),
      careless: calibration(cYear),
    },
    sensibleWeeksInDebt: sYear.map((r) => r.weeksInDebt),
  }
}

// ---------- the P2 rows ----------

/** One measurement per P2 row, per seed, all from the sensible bot's year-one run (it answers events, signs anime, shops). */
export interface P2Measures {
  /** random events that landed in year one */
  events: number[]
  /** year one's head to head with the rival (from the year-one review) */
  rival: { wins: number; losses: number }[]
  /** year one's awards and near misses (from the year-one review) */
  awards: { won: AwardId[]; near: AwardId[] }[]
  /** pieces of equipment owned at day 336 */
  equipment: number[]
}

export function measureP2(runs: BalanceRuns): P2Measures {
  const years = runs.sensible.map((r) => r.year)
  // A year run always reaches the close on day 336; without a review there was no year one to judge.
  const review = (r: BotRun) => r.final.yearReviews.find((y) => y.year === 1)
  return {
    events: years.map((r) => r.events),
    rival: years.map((r) => {
      const y = review(r)
      return { wins: y?.rival.wins ?? 0, losses: y?.rival.losses ?? 0 }
    }),
    awards: years.map((r) => {
      const y = review(r)
      return { won: y?.awards ?? [], near: y?.nearMisses.map((n) => n.id) ?? [] }
    }),
    equipment: years.map((r) => r.final.studio.owned.length),
  }
}

/** The mean of `xs` (0 for none). */
export function meanOf(xs: number[]): number {
  return xs.length ? mean(xs) : 0
}

/** Share of the meetings with the rival the player won, over every seed together; null when they never met. */
export function winShare(records: { wins: number; losses: number }[]): number | null {
  const wins = records.reduce((a, r) => a + r.wins, 0)
  const meetings = records.reduce((a, r) => a + r.wins + r.losses, 0)
  return meetings ? wins / meetings : null
}

// ---------- reported by the script only ----------

/** The sensible bot with its shopping switched off: no equipment, no move. */
export const SENSIBLE_BUYING_NOTHING: BotPolicy = { ...SENSIBLE, name: 'sensible, buying nothing', shops: false }

/**
 * Money at day 336 for the sensible bot buying nothing, per seed. Its median is S1, which sets
 * `EQUIPMENT_PRICE_SCALE` (S1 / 9000 rounded to 0.25 and clamped to 0.75-4; DESIGN.md "Studio and equipment").
 */
export function moneyBuyingNothing(seeds: number[]): number[] {
  return seeds.map((seed) => runBot(seed, SENSIBLE_BUYING_NOTHING, { days: YEAR }).final.player.money)
}

/** The day of the sensible bot's first anime offer within two years, per seed (null when none came). */
export function firstAnimeOffer(seeds: number[]): (number | null)[] {
  return seeds.map((seed) => {
    const run = runBot(seed, SENSIBLE, { days: 2 * YEAR, until: (s) => s.animeOfferedFor.length > 0 })
    return run.final.animeOfferedFor.length ? run.final.day : null
  })
}
