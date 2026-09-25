// Balance readout: runs the balance bots (src/sim/bot.ts) over a range of seeds and prints one line per seed per
// bot, then one line per row of the balance-band table. Nothing is asserted here; the balance tests do that.
// Run with: npm run balance -- [from=1] [to=20] [--detail seed]
//   --detail seed  also prints every one-shot and chapter of that seed for each bot, in the old readout's format.
import { CARELESS, SENSIBLE, STRESS_BOLT, runBot } from '../src/sim/bot'
import type { BotPolicy, BotRun } from '../src/sim/bot'
import { magazineById, previewSubmission } from '../src/sim/index'
import type { GameState, Serial } from '../src/sim/index'

/** One in-game year. */
const YEAR = 336
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

/** Mean score of the first six one-shots (fewer if the year ran out first). */
function firstSixMean(run: BotRun): number | null {
  const six = run.oneShots.slice(0, 6)
  return six.length ? mean(six.map((o) => o.score)) : null
}

// ---------- per-seed lines ----------

const COLUMNS = ['seed', 'policy', 'first offer', 'first score', 'mean of 6', 'money at 6th', 'first serial', 'weeks in debt']
const WIDTHS = [4, 12, 11, 11, 11, 12, 22, 13]

function row(cells: string[]): string {
  return cells.map((c, i) => (i === 1 || i === 6 ? c.padEnd(WIDTHS[i]) : c.padStart(WIDTHS[i]))).join('  ')
}

function seedLine(seed: number, p: BotPolicy, run: BotRun): string {
  const six = run.oneShots.slice(0, 6)
  const sixth = run.oneShots[5]
  const ser = run.serials[0]
  return row([
    String(seed),
    p.name,
    run.firstOfferAt === null ? 'none' : `one-shot ${run.firstOfferAt}`,
    fmt(run.oneShots[0]?.score ?? null),
    six.length < 6 && six.length ? `${fmt(firstSixMean(run), 1)} of ${six.length}` : fmt(firstSixMean(run), 1),
    sixth ? `¥${sixth.money}` : '-',
    ser ? `${ser.results} results, ${ser.status}` : 'none',
    String(run.weeksInDebt),
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

// ---------- run ----------

const seeds = Array.from({ length: to - from + 1 }, (_, i) => from + i)
const sensible = seeds.map((seed) => runBot(seed, SENSIBLE, { days: YEAR }))
const careless = seeds.map((seed) => runBot(seed, CARELESS, { days: YEAR }))
const stress = seeds.map((seed) => runBot(seed, STRESS_BOLT, { days: STRESS_DAYS }))
const n = seeds.length

console.log(`Balance bots, seeds ${from}-${to}, ${YEAR} days (stress case ${STRESS_DAYS} days)`)
console.log(row(COLUMNS))
seeds.forEach((seed, i) => {
  console.log(seedLine(seed, SENSIBLE, sensible[i]))
  console.log(seedLine(seed, CARELESS, careless[i]))
})
for (const seed of STRESS_SEEDS) {
  const i = seeds.indexOf(seed)
  console.log(seedLine(seed, STRESS_BOLT, i >= 0 ? stress[i] : runBot(seed, STRESS_BOLT, { days: STRESS_DAYS })))
}

// Aggregates, one per balance-band row. Targets are printed for reference only.
const firstScores = sensible.map((r) => r.oneShots[0]?.score ?? null)
const inBand = firstScores.filter((x) => x !== null && x >= 40 && x <= 55).length
const sensibleMean = mean(sensible.map(firstSixMean).filter((x): x is number => x !== null))
const carelessMean = mean(careless.map(firstSixMean).filter((x): x is number => x !== null))
const offerWithin6 = (runs: BotRun[]) => runs.filter((r) => r.firstOfferAt !== null && r.firstOfferAt <= 6).length
const reach8 = sensible.filter((r) => (r.serials[0]?.results ?? 0) >= 8).length
const stressCancelled = stress.flatMap((r) => (r.serials[0]?.status === 'cancelled' ? [r.serials[0].results] : []))
const earliestCancel = stressCancelled.length ? Math.min(...stressCancelled) : null
const carelessSixth = careless.map((r) => r.oneShots[5]?.money ?? null)
const under3000 = carelessSixth.filter((m) => m !== null && m < 3000).length
const shortOfSix = carelessSixth.filter((m) => m === null).length
function calibration(runs: BotRun[]) {
  const shots = runs.flatMap((r) => r.oneShots)
  const expected = shots.reduce((a, o) => a + o.offerChance, 0)
  const seen = shots.filter((o) => o.offer).length
  return { expected, seen, text: `Σ ${expected.toFixed(2)} vs ${seen} seen` }
}
const cal = calibration([...sensible, ...careless])
const calOff = cal.expected > 0 ? `${cal.seen >= cal.expected ? '+' : ''}${(((cal.seen - cal.expected) / cal.expected) * 100).toFixed(0)}%` : 'n/a'
const medianOffer = median(sensible.map((r) => r.firstOfferAt))
const debtFree = sensible.filter((r) => r.weeksInDebt === 0).length

console.log(`\nBalance bands, P1 (${n} seeds)`)
console.log(`Sensible bot, first one-shot score: ${inBand}/${n} in 40-55, median ${fmt(median(firstScores), 1)} (target 40-55 on >= 13/20; median 44-52)`)
console.log(`Sensible minus careless, mean score of first 6 one-shots: ${sensibleMean.toFixed(1)} - ${carelessMean.toFixed(1)} = ${(sensibleMean - carelessMean).toFixed(1)} (target >= 8)`)
console.log(`Sensible bot, organic offer within first 6 one-shots: ${offerWithin6(sensible)}/${n}, median first offer at one-shot ${medianOffer === null ? 'none' : fmt(medianOffer, 1)} (target >= 16/20; median <= 3)`)
console.log(`Careless bot, organic offer within 6: ${offerWithin6(careless)}/${n} (target <= 6/20)`)
console.log(`Sensible bot's first serial reaches 8 results: ${reach8}/${n} (target >= 14/20)`)
console.log(`Stress case (forced Weekly Bolt, no points, balanced): cancelled ${stressCancelled.length}/${n}, earliest at result ${fmt(earliestCancel)} (target cancelled on >= 15/20, never before its 5th result)`)
console.log(`Careless bot money at its 6th result: under ¥3000 on ${under3000}/${n}${shortOfSix ? ` (${shortOfSix} had no 6th result)` : ''} (target < ¥3000 on >= 15/20)`)
console.log(`Forecast calibration (Σ offer chances vs offers seen): ${cal.text}, ${calOff} (sensible ${calibration(sensible).text}, careless ${calibration(careless).text}) (target within ±30%)`)
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
