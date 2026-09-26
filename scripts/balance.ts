// Balance readout: runs the balance bots (src/sim/bot.ts) over a range of seeds and prints one line per seed per
// bot, then one line per row of the balance-band table. The runs, the row measurements and the targets (`BANDS`) come
// from src/sim/balance.ts, the same code src/sim/__tests__/balance.test.ts asserts on; nothing is asserted here. The
// last lines print anime offers within two years and S1, the money that sets the equipment prices.
// Run with: npm run balance -- [from=1] [to=20] [--detail seed]
//   --detail seed  also prints every one-shot and chapter of that seed for each bot, in the old readout's format.
import { CARELESS, OPENING_ONE_SHOTS, SENSIBLE, STRESS_BOLT, firstSixMean, runBot } from '../src/sim/bot'
import type { BotPolicy } from '../src/sim/bot'
import {
  BANDS, LONG, SERIAL_TARGET_RESULTS, STRESS_DAYS, YEAR, calibrationError, countIn, firstAnimeOffer, meanOf,
  measureP1, measureP2, median, moneyBuyingNothing, offerInOpening, priceScale, runBalance, winShare,
} from '../src/sim/balance'
import type { Calibration, SeedRuns } from '../src/sim/balance'
import { EQUIPMENT_PRICE_SCALE, magazineById, num, previewSubmission } from '../src/sim/index'
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

// Aggregates, one per balance-band row, from the measurements balance.test.ts asserts, against the same targets.
const m = measureP1(runs)
const B = BANDS
const inBand = countIn(m.firstScores, B.firstScore.low, B.firstScore.high)
const { sensible: sMean, careless: cMean } = m.firstSixMean
const earliestCancel = m.stressCancelledAt.length ? Math.min(...m.stressCancelledAt) : null
const underMoney = m.carelessMoneyAtSixth.filter((x) => x !== null && x < B.carelessMoney.under).length
const calText = (c: Calibration) => `Σ ${c.expected.toFixed(2)} vs ${c.seen} seen`
const calErr = calibrationError(m.calibration.all)
const pct = (x: number) => `${(x * 100).toFixed(0)}%`
const calOff = calErr === null ? 'n/a' : `${calErr >= 0 ? '+' : ''}${pct(calErr)}`
const debtFree = countIn(m.sensibleWeeksInDebt, 0, 0)
const sShort = shortNote(m.shortOfSix.sensible, n)
const cShort = shortNote(m.shortOfSix.careless, n)

console.log(`\nBalance bands, P1 (${n} seeds)`)
const fs = B.firstScore
console.log(`Sensible bot, first one-shot score: ${inBand}/${n} in ${fs.low}-${fs.high}, median ${fmt(median(m.firstScores), 1)} (target ${fs.low}-${fs.high} on >= ${fs.atLeast}/20; median ${fs.medianLow}-${fs.medianHigh})`)
console.log(`Sensible minus careless, mean score of first 6 one-shots: ${sMean.toFixed(1)} - ${cMean.toFixed(1)} = ${(sMean - cMean).toFixed(1)}${shortNote(m.shortOfSix.sensible, n, 'sensible: ')}${shortNote(m.shortOfSix.careless, n, 'careless: ')} (target >= ${B.firstSixGap.atLeast})`)
console.log(`Sensible bot, organic offer within first 6 one-shots: ${m.offerWithinSix.sensible}/${n}, median first offer at one-shot ${m.medianFirstOffer === null ? 'none' : fmt(m.medianFirstOffer, 1)}${sShort} (target >= ${B.sensibleOffer.atLeast}/20; median <= ${B.sensibleOffer.medianAtMost})`)
console.log(`Careless bot, organic offer within 6: ${m.offerWithinSix.careless}/${n}${cShort} (target <= ${B.carelessOffer.atMost}/20)`)
console.log(`Sensible bot's first serial reaches ${SERIAL_TARGET_RESULTS} results: ${m.firstSerialReached8}/${n}${m.noFirstSerial ? ` (${m.noFirstSerial} had no serial within ${LONG} days)` : ''} (target >= ${B.firstSerial.atLeast}/20)`)
console.log(`Stress case (forced Weekly Bolt, no points, balanced): cancelled ${m.stressCancelledAt.length}/${n}, earliest at result ${fmt(earliestCancel)} (target cancelled on >= ${B.stress.atLeast}/20, never before its ${B.stress.notBefore}th result)`)
console.log(`Careless bot money at its 6th result: under ¥${B.carelessMoney.under} on ${underMoney}/${n}${cShort} (target < ¥${B.carelessMoney.under} on >= ${B.carelessMoney.atLeast}/20)`)
console.log(`Forecast calibration (Σ offer chances vs offers seen): ${calText(m.calibration.all)}, ${calOff} over year one (sensible ${calText(m.calibration.sensible)}, careless ${calText(m.calibration.careless)}) (target within ±${pct(B.calibration.within)})`)
console.log(`Sensible bot weeks in debt, year one: 0 on ${debtFree}/${n} (target 0 on >= ${B.debtFree.atLeast}/20)`)

// The P2 rows read the sensible bot's year-one run (it answers events, signs anime deals and shops).
const m2 = measureP2(runs)
const met = m2.rival.filter((r) => r.wins + r.losses > 0).length
const wins = m2.rival.reduce((a, r) => a + r.wins, 0)
const meetings = m2.rival.reduce((a, r) => a + r.wins + r.losses, 0)
const share = winShare(m2.rival)
const awarded = m2.awards.filter((a) => a.won.length + a.near.length > 0).length
const goldenPen = m2.awards.filter((a) => a.won.includes('golden-pen')).length
const kit = B.equipment
const animeDays = firstAnimeOffer(seeds)
const offered = animeDays.filter((d): d is number => d !== null)
const s1 = median(moneyBuyingNothing(seeds))
const range = (xs: number[]) => (xs.length ? `${Math.min(...xs)} to ${Math.max(...xs)}` : 'none')

console.log(`\nBalance bands, P2 (${n} seeds)`)
console.log(`Events per year (sensible): ${meanOf(m2.events).toFixed(1)} a seed in year one, ${range(m2.events)} (target ${B.events.low}-${B.events.high})`)
console.log(`Rival met in year one: ${met}/${n}, the bot won ${wins} of ${meetings} meetings (${share === null ? 'n/a' : pct(share)}) (target >= ${B.rival.metAtLeast}/20; bot wins ${pct(B.rival.winShareLow)}-${pct(B.rival.winShareHigh)} of meetings)`)
console.log(`Award or near miss in year one: ${awarded}/${n}, Golden Pen ${goldenPen}/${n} (target >= ${B.awards.atLeast}/20; Golden Pen in year one <= ${B.awards.goldenPenAtMost}/20)`)
console.log(`Equipment owned at day ${YEAR} (sensible, buying): ${kit.low}-${kit.high} pieces on ${countIn(m2.equipment, kit.low, kit.high)}/${n} (pieces per seed: ${m2.equipment.join(' ')}) (target ${kit.low}-${kit.high} on >= ${kit.atLeast}/20)`)
console.log(`Anime offer within two years (sensible): ${offered.length}/${n}, days ${range(offered)} (target ${B.anime.low}-${B.anime.high} of 20)`)
console.log(`\nS1, sensible money at day ${YEAR} buying nothing: median ¥${s1 === null ? '-' : num(s1)}, S1 / 9000 = ${s1 === null ? '-' : (s1 / 9000).toFixed(2)}, scale ${s1 === null ? '-' : priceScale(s1)} (EQUIPMENT_PRICE_SCALE is ${EQUIPMENT_PRICE_SCALE}: S1 / 9000 rounded to 0.25, held within 0.75-16)`)

if (detailSeed !== null) {
  printDetail(detailSeed, SENSIBLE, YEAR)
  printDetail(detailSeed, CARELESS, YEAR)
  printDetail(detailSeed, STRESS_BOLT, STRESS_DAYS)
}
