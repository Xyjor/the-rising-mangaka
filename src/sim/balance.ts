// Balance-band measurements: plays the balance bots (bot.ts) over a range of seeds and reduces the runs to one
// measurement per row of the balance-band table (DESIGN.md "Balance bands"). Only the measurements live here; the
// targets live in src/sim/__tests__/balance.test.ts, which asserts them, and scripts/balance.ts, which prints them
// for reference. Both read these functions, so the readout and the tests cannot drift apart. Pure: no clock, no
// random source; every run is a deterministic function of its seed.
import { CARELESS, OPENING_ONE_SHOTS, SENSIBLE, STRESS_BOLT, firstSixMean, runBot } from './bot'
import { DAYS_PER_YEAR } from './data'
import type { BotPolicy, BotRun } from './bot'
import type { GameState } from './types'

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
