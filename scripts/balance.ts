// Balance readout: runs the balance bots (src/sim/bot.ts) over a range of seeds and prints one line per seed per
// bot, then one line per row of the balance-band table. Nothing is asserted here; the balance tests do that.
// Run with: npm run balance -- [from=1] [to=20] [--detail seed]
//   --detail seed  also prints every one-shot and chapter of that seed for each bot, in the old readout's format.
import { CARELESS, OPENING_ONE_SHOTS, SENSIBLE, STRESS_BOLT, firstSixMean, runBot } from '../src/sim/bot'
import type { BotPolicy, BotRun } from '../src/sim/bot'
import { magazineById, previewSubmission } from '../src/sim/index'
import type { GameState, Serial } from '../src/sim/index'

/** One in-game year. */
const YEAR = 336
/** Runs judged on the first six one-shots or the first serial get three years, so a long serial cannot cut them short. */
const LONG = 3 * YEAR
/** The first serial's target in the balance bands. */
const SERIAL_TARGET_RESULTS = 8
/** The stress case gets six one-shot cycles (about 144 days) plus a year of serial, like the old script. */
const STRESS_DAYS = 480
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

// ---------- runs ----------

/** Each seed and bot is played three ways, and every balance row reads the run that defines it. */
interface SeedRuns {
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

// ---------- helpers ----------

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

/** Median with missing values (null) sorted last; null when the middle lands on a missing value. */
function median(xs: (number | null)[]): number | null {
  const sorted = xs.map((x) => x ?? Infinity).sort((a, b) => a - b)
  const mid = sorted.length / 2
  const m = sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
  return Number.isFinite(m) ? m : null
}

const fmt = (x: number | null, digits = 0) => (x === null ? '-' : x.toFixed(digits))

/** 1-based index of the first organic offer if it came within the first six one-shots. */
function offerInOpening(run: BotRun): number | null {
  return run.firstOfferAt !== null && run.firstOfferAt <= OPENING_ONE_SHOTS ? run.firstOfferAt : null
}

/** " (who n of N seeds reached fewer than 6)" when a serial or the day limit stopped any opening run short. */
function shortNote(runs: BotRun[], who = ''): string {
  const short = runs.filter((r) => r.oneShots.length < OPENING_ONE_SHOTS).length
  return short ? ` (${who}${short} of ${runs.length} seeds reached fewer than ${OPENING_ONE_SHOTS})` : ''
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
const sensible = seeds.map((seed) => runSeed(seed, SENSIBLE))
const careless = seeds.map((seed) => runSeed(seed, CARELESS))
const stress = seeds.map((seed) => runBot(seed, STRESS_BOLT, { days: STRESS_DAYS }))
const n = seeds.length

console.log(`Balance bots, seeds ${from}-${to}`)
console.log(
  `First offer, first score, mean of 6 and money at 6th: played to the ${OPENING_ONE_SHOTS}th one-shot (at most ${LONG} days).` +
  ` First serial: played until it ends or reaches ${SERIAL_TARGET_RESULTS} results (at most ${LONG} days).` +
  ` Weeks in debt: year one (${YEAR} days). Stress case: ${STRESS_DAYS} days.`,
)
console.log(row(COLUMNS))
seeds.forEach((seed, i) => {
  console.log(seedLine(seed, SENSIBLE, sensible[i]))
  console.log(seedLine(seed, CARELESS, careless[i]))
})
for (const seed of STRESS_SEEDS) {
  const i = seeds.indexOf(seed)
  const run = i >= 0 ? stress[i] : runBot(seed, STRESS_BOLT, { days: STRESS_DAYS })
  console.log(seedLine(seed, STRESS_BOLT, { year: run, opening: run, serial: run }))
}

// Aggregates, one per balance-band row. Targets are printed for reference only.
const sOpen = sensible.map((r) => r.opening)
const cOpen = careless.map((r) => r.opening)
const firstScores = sOpen.map((r) => r.oneShots[0]?.score ?? null)
const inBand = firstScores.filter((x) => x !== null && x >= 40 && x <= 55).length
const openingMean = (runs: BotRun[]) => mean(runs.map(firstSixMean).filter((x): x is number => x !== null))
const sensibleMean = openingMean(sOpen)
const carelessMean = openingMean(cOpen)
const offerWithin6 = (runs: BotRun[]) => runs.filter((r) => offerInOpening(r) !== null).length
const medianOffer = median(sOpen.map(offerInOpening))
const firstSerials = sensible.map((r) => r.serial.serials[0])
const reach8 = firstSerials.filter((x) => (x?.results ?? 0) >= SERIAL_TARGET_RESULTS).length
const noSerial = firstSerials.filter((x) => !x).length
const stressCancelled = stress.flatMap((r) => (r.serials[0]?.status === 'cancelled' ? [r.serials[0].results] : []))
const earliestCancel = stressCancelled.length ? Math.min(...stressCancelled) : null
const under3000 = cOpen.filter((r) => r.oneShots[5] && r.oneShots[5].money < 3000).length
function calibration(runs: BotRun[]) {
  const shots = runs.flatMap((r) => r.oneShots)
  const expected = shots.reduce((a, o) => a + o.offerChance, 0)
  const seen = shots.filter((o) => o.offer).length
  return { expected, seen, text: `Σ ${expected.toFixed(2)} vs ${seen} seen` }
}
const sYear = sensible.map((r) => r.year)
const cYear = careless.map((r) => r.year)
const cal = calibration([...sYear, ...cYear])
const calOff = cal.expected > 0 ? `${cal.seen >= cal.expected ? '+' : ''}${(((cal.seen - cal.expected) / cal.expected) * 100).toFixed(0)}%` : 'n/a'
const debtFree = sYear.filter((r) => r.weeksInDebt === 0).length

console.log(`\nBalance bands, P1 (${n} seeds)`)
console.log(`Sensible bot, first one-shot score: ${inBand}/${n} in 40-55, median ${fmt(median(firstScores), 1)} (target 40-55 on >= 13/20; median 44-52)`)
console.log(`Sensible minus careless, mean score of first 6 one-shots: ${sensibleMean.toFixed(1)} - ${carelessMean.toFixed(1)} = ${(sensibleMean - carelessMean).toFixed(1)}${shortNote(sOpen, 'sensible: ')}${shortNote(cOpen, 'careless: ')} (target >= 8)`)
console.log(`Sensible bot, organic offer within first 6 one-shots: ${offerWithin6(sOpen)}/${n}, median first offer at one-shot ${medianOffer === null ? 'none' : fmt(medianOffer, 1)}${shortNote(sOpen)} (target >= 16/20; median <= 3)`)
console.log(`Careless bot, organic offer within 6: ${offerWithin6(cOpen)}/${n}${shortNote(cOpen)} (target <= 6/20)`)
console.log(`Sensible bot's first serial reaches 8 results: ${reach8}/${n}${noSerial ? ` (${noSerial} had no serial within ${LONG} days)` : ''} (target >= 14/20)`)
console.log(`Stress case (forced Weekly Bolt, no points, balanced): cancelled ${stressCancelled.length}/${n}, earliest at result ${fmt(earliestCancel)} (target cancelled on >= 15/20, never before its 5th result)`)
console.log(`Careless bot money at its 6th result: under ¥3000 on ${under3000}/${n}${shortNote(cOpen)} (target < ¥3000 on >= 15/20)`)
console.log(`Forecast calibration (Σ offer chances vs offers seen): ${cal.text}, ${calOff} over year one (sensible ${calibration(sYear).text}, careless ${calibration(cYear).text}) (target within ±30%)`)
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
