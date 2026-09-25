// Balance readout: runs the balance bots (src/sim/bot.ts) over a range of seeds and prints one line per seed per
// bot, then one line per row of the balance-band table. The runs and the row measurements come from
// src/sim/balance.ts, the same code src/sim/__tests__/balance.test.ts asserts on; nothing is asserted here, and the
// targets printed are for reference only.
// Run with: npm run balance -- [from=1] [to=20] [--detail seed]
//   --detail seed  also prints every one-shot and chapter of that seed for each bot, in the old readout's format.
import { CARELESS, OPENING_ONE_SHOTS, SENSIBLE, STRESS_BOLT, firstSixMean, runBot } from '../src/sim/bot'
import type { BotPolicy } from '../src/sim/bot'
import {
  LONG, SERIAL_TARGET_RESULTS, STRESS_DAYS, YEAR, calibrationError, measureP1, median, offerInOpening, runBalance,
} from '../src/sim/balance'
import type { Calibration, SeedRuns } from '../src/sim/balance'
import { magazineById, previewSubmission } from '../src/sim/index'
import type { GameState, Serial } from '../src/sim/index'

const STRESS_SEEDS = [1, 42, 99]

function usage(problem: string): never {
  console.error(`${problem}\nUsage: npm run balance -- [from=1] [to=20] [--detail seed]`)
  process.exit(1)
}

function toSeed(arg: string | undefined, name: string): number {
  if (arg === undefined || !/^-?\d+$/.test(arg)) usage(`${name} must be a whole number, got "${arg ?? ''}".`)
  return Number(arg)
}

const args = process.argv.slice(2)
const positional: string[] = []
let detailSeed: number | null = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--detail') detailSeed = toSeed(args[++i], '--detail seed')
  else positional.push(args[i])
}
if (positional.length > 2) usage(`Expected at most two seeds (from, to), got ${positional.length}.`)
const from = positional[0] === undefined ? 1 : toSeed(positional[0], 'from')
const to = positional[1] === undefined ? 20 : toSeed(positional[1], 'to')
if (to < from) usage(`to (${to}) must not be below from (${from}).`)

// ---------- helpers ----------

const fmt = (x: number | null, digits = 0) => (x === null ? '-' : x.toFixed(digits))

/** " (who n of N seeds reached fewer than 6)" when a serial or the day limit stopped any opening run short. */
function shortNote(short: number, n: number, who = ''): string {
  return short ? ` (${who}${short} of ${n} seeds reached fewer than ${OPENING_ONE_SHOTS})` : ''
}

// ---------- per-seed lines ----------

const COLUMNS = ['seed', 'policy', 'first offer', 'first score', 'mean of 6', 'money at 6th', 'first serial', 'weeks in debt']
const WIDTHS = [4, 12, 11, 11, 11, 12, 22, 13]

function row(cells: string[]): string {
  return cells.map((c, i) => (i === 1 || i === 6 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join('  ')
}

function seedLine(seed: number, p: BotPolicy, runs: SeedRuns): string {
  const { opening, serial, year } = runs
  const count = Math.min(opening.oneShots.length, OPENING_ONE_SHOTS)
  const offer = offerInOpening(opening)
  const ser = serial.serials[0]
  return row([
    String(seed),
    p.name,
    offer === null ? 'none' : `one-shot ${offer}`,
    fmt(opening.oneShots[0]?.score ?? null),
    count && count < OPENING_ONE_SHOTS ? `${fmt(firstSixMean(opening), 1)} of ${count}` : fmt(firstSixMean(opening), 1),
    opening.oneShots[5] ? `¥${opening.oneShots[5].money}` : '-',
    ser ? `${ser.results} results, ${ser.status}` : 'none',
    String(year.weeksInDebt),
  ])
}

// ---------- detail readout (the old script's line format) ----------

function findSerial(s: GameState, id: number): Serial | undefined {
  return s.serial?.id === id ? s.serial : s.serials.find((x) => x.id === id)
}

function printDetail(seed: number, p: BotPolicy, days: number) {
  console.log(`\n--- ${p.name}, seed ${seed}: one-shots and chapters over ${days} days ---`)
  let prev: GameState | null = null
  let pitch = ''
  let index = 0
  runBot(seed, p, {
    days,
    observe(decided, next) {
      const pj = decided.project
      if (pj?.kind === 'oneshot' && pj.status === 'submitted' && pj.submittedDay === decided.day && pj.magazineId) {
        const est = previewSubmission(decided, pj.magazineId)!
        pitch = `${decided.day - pj.startedDay}d | ${pj.genre}/${pj.theme}/${pj.audience} @${pj.magazineId}` +
          ` | est ${est.expectedRank.low}-${est.expectedRank.high} p(offer) ${est.offerChance.toFixed(2)}`
      }
      if (next.history.length > decided.history.length) {
        const r = next.history[next.history.length - 1]
        const b = r.breakdown
        console.log(
          `work ${index++}: ${pitch} | score ${r.score} rank ${r.rank}/${r.entrants}` +
          ` | +¥${r.rewards.money} +${r.rewards.fans}f +${r.rewards.xp}xp | art ${b.art} story ${b.story} pace ${b.pacing} fit ${b.audienceFit} fresh ${b.freshness}` +
          ` | ¥${next.player.money} L${next.player.level} sp${next.player.skillPoints} offer:${next.pendingOffer ? 'yes' : 'no'}`,
        )
      }
      const started = decided.serial && prev && findSerial(prev, decided.serial.id) === undefined ? decided.serial : null
      if (started) {
        const hired = decided.assistants.length > (prev?.assistants.length ?? 0) ? ', assistant hired' : ''
        console.log(`--- serial "${started.title}" at ${magazineById(started.magazineId).name}, day ${started.startedDay}${hired} ---`)
      }
      const watched = decided.serial ?? (prev?.serial ? findSerial(decided, prev.serial.id) : undefined)
      if (watched) {
        const before = prev ? findSerial(prev, watched.id) : undefined
        const after = findSerial(next, watched.id)!
        for (const r of after.results.slice(before?.results.length ?? 0)) {
          console.log(
            `ch${r.chapter} d${r.day - after.startedDay}: rank ${r.rank}/${r.entrants} score ${r.score} fresh ${r.breakdown.freshness} | pop ${after.popularity} warn ${after.warnings} vols ${after.volumes}` +
            ` | +¥${r.rewards.money} | ¥${next.player.money} fans ${next.player.fans} L${next.player.level}`,
          )
        }
        if (before?.status === 'running' && after.status !== 'running') {
          console.log(`serial status: ${after.status}, money ¥${next.player.money}, fans ${next.player.fans}, level ${next.player.level}`)
        }
      }
      prev = next
    },
  })
}

// ---------- report ----------

const seeds = Array.from({ length: to - from + 1 }, (_, i) => from + i)
const runs = runBalance(seeds)
const n = seeds.length

console.log(`Balance bots, seeds ${from}-${to}`)
console.log(
  `First offer, first score, mean of 6 and money at 6th: played to the ${OPENING_ONE_SHOTS}th one-shot (at most ${LONG} days).` +
  ` First serial: played until it ends or reaches ${SERIAL_TARGET_RESULTS} results (at most ${LONG} days).` +
  ` Weeks in debt: year one (${YEAR} days). Stress case: ${STRESS_DAYS} days.`,
)
console.log(row(COLUMNS))
seeds.forEach((seed, i) => {
  console.log(seedLine(seed, SENSIBLE, runs.sensible[i]))
  console.log(seedLine(seed, CARELESS, runs.careless[i]))
})
for (const seed of STRESS_SEEDS) {
  const i = seeds.indexOf(seed)
  const run = i >= 0 ? runs.stress[i] : runBot(seed, STRESS_BOLT, { days: STRESS_DAYS })
  console.log(seedLine(seed, STRESS_BOLT, { year: run, opening: run, serial: run }))
}

// Aggregates, one per balance-band row, from the measurements balance.test.ts asserts. The targets here are for
// reference only; the test holds the thresholds.
const m = measureP1(runs)
const inBand = m.firstScores.filter((x) => x !== null && x >= 40 && x <= 55).length
const { sensible: sMean, careless: cMean } = m.firstSixMean
const earliestCancel = m.stressCancelledAt.length ? Math.min(...m.stressCancelledAt) : null
const under3000 = m.carelessMoneyAtSixth.filter((x) => x !== null && x < 3000).length
const calText = (c: Calibration) => `Σ ${c.expected.toFixed(2)} vs ${c.seen} seen`
const calErr = calibrationError(m.calibration.all)
const calOff = calErr === null ? 'n/a' : `${calErr >= 0 ? '+' : ''}${(calErr * 100).toFixed(0)}%`
const debtFree = m.sensibleWeeksInDebt.filter((w) => w === 0).length
const sShort = shortNote(m.shortOfSix.sensible, n)
const cShort = shortNote(m.shortOfSix.careless, n)

console.log(`\nBalance bands, P1 (${n} seeds)`)
console.log(`Sensible bot, first one-shot score: ${inBand}/${n} in 40-55, median ${fmt(median(m.firstScores), 1)} (target 40-55 on >= 13/20; median 44-52)`)
console.log(`Sensible minus careless, mean score of first 6 one-shots: ${sMean.toFixed(1)} - ${cMean.toFixed(1)} = ${(sMean - cMean).toFixed(1)}${shortNote(m.shortOfSix.sensible, n, 'sensible: ')}${shortNote(m.shortOfSix.careless, n, 'careless: ')} (target >= 8)`)
console.log(`Sensible bot, organic offer within first 6 one-shots: ${m.offerWithinSix.sensible}/${n}, median first offer at one-shot ${m.medianFirstOffer === null ? 'none' : fmt(m.medianFirstOffer, 1)}${sShort} (target >= 16/20; median <= 3)`)
console.log(`Careless bot, organic offer within 6: ${m.offerWithinSix.careless}/${n}${cShort} (target <= 6/20)`)
console.log(`Sensible bot's first serial reaches 8 results: ${m.firstSerialReached8}/${n}${m.noFirstSerial ? ` (${m.noFirstSerial} had no serial within ${LONG} days)` : ''} (target >= 14/20)`)
console.log(`Stress case (forced Weekly Bolt, no points, balanced): cancelled ${m.stressCancelledAt.length}/${n}, earliest at result ${fmt(earliestCancel)} (target cancelled on >= 15/20, never before its 5th result)`)
console.log(`Careless bot money at its 6th result: under ¥3000 on ${under3000}/${n}${cShort} (target < ¥3000 on >= 15/20)`)
console.log(`Forecast calibration (Σ offer chances vs offers seen): ${calText(m.calibration.all)}, ${calOff} over year one (sensible ${calText(m.calibration.sensible)}, careless ${calText(m.calibration.careless)}) (target within ±30%)`)
console.log(`Sensible bot weeks in debt, year one: 0 on ${debtFree}/${n} (target 0 on >= 18/20)`)
console.log('\nBalance bands, P2')
for (const name of [
  'Events per year (sensible)', 'Rival met in year one', 'Award or near miss in year one',
  'Equipment owned at day 336 (sensible, buying)',
]) console.log(`${name}: n/a until Phase 2`)

if (detailSeed !== null) {
  printDetail(detailSeed, SENSIBLE, YEAR)
  printDetail(detailSeed, CARELESS, YEAR)
  printDetail(detailSeed, STRESS_BOLT, STRESS_DAYS)
}
