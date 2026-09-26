// The year end. Every DAYS_PER_YEAR days the year closes (`closeYear`, in tick() after checkDeadline and before
// animeTick; DESIGN.md "Tick order"): it judges the awards and pays their prizes, files a review of the year
// (`buildYearReview`), grows the rival (`growRival` in rival.ts), and takes the new year's baseline (`yearStart`). The
// review waits on the desk as a card until read (`markReviewRead`). The year end toasts but never pauses the clock:
// nothing in it waits for an answer. No RNG. No imports from engine.ts: engine imports this file.
//
// "This year" is every poll result with a day in (yearStart.day, closing day]: the polls run before closeYear in the
// same tick, so a result landing on the closing day counts for the year that closes. A serial counts as started this
// year from yearStart.day on: commands run between ticks, so a serial accepted on a closing day starts the new year.
// For the Rookie Prize, a serialisation offer still waiting at the year-one close counts as a serial started.
import { addLog, grantXp, num, yen } from './core'
import { AWARDS, DAYS_PER_YEAR, READERS_CHOICE_MIN_RESULTS, awardById, magazineById } from './data'
import { growRival, rivalRecord } from './rival'
import type {
  Award, AwardId, ChapterResult, GameState, NearMiss, PollResult, Serial, YearReview, YearStart,
} from './types'

function allSerials(s: GameState): Serial[] {
  return s.serial ? [...s.serials, s.serial] : s.serials
}

/** Where the career stands today, as the baseline of a year that starts today. */
export function yearSnapshot(s: GameState): YearStart {
  const serials = allSerials(s)
  return {
    day: s.day,
    money: s.player.money,
    fans: s.player.fans,
    level: s.player.level,
    copies: serials.reduce((sum, x) => sum + x.totalCopies, 0),
    volumes: serials.reduce((sum, x) => sum + x.volumes, 0),
  }
}

/** The best of these one-shots: the best rank, then the best score, then the earliest. */
function bestOf(results: PollResult[]): PollResult | null {
  let best: PollResult | null = null
  for (const r of results) if (!best || r.rank < best.rank || (r.rank === best.rank && r.score > best.score)) best = r
  return best
}

/** The best average rank among serials with READERS_CHOICE_MIN_RESULTS+ results this year, as rank sum and count. */
function bestRun(runs: ChapterResult[][]): { sum: number; n: number } | null {
  let best: { sum: number; n: number } | null = null
  for (const run of runs) {
    if (run.length < READERS_CHOICE_MIN_RESULTS) continue
    const sum = run.reduce((a, r) => a + r.rank, 0)
    if (!best || sum * best.n < best.sum * run.length) best = { sum, n: run.length }
  }
  return best
}

/**
 * Where the year stands against one award: the figure it is judged on (null when it is not in play), the figure a
 * near miss shows, and whether a smaller figure is better (ranks).
 */
interface Standing { figure: number | null; shown: number; lower: boolean }

/** Won, a near miss, or neither: the figure against the award's two bars. */
function rate(a: Award, st: Standing): 'won' | 'near' | null {
  const { figure, lower } = st
  if (figure === null) return null
  const reaches = (bar: number) => (lower ? figure <= bar : figure >= bar)
  return reaches(a.need) ? 'won' : reaches(a.near) ? 'near' : null
}

/**
 * The year so far, from `yearStart` to today: what it brought, the awards it earns and the near misses, and the rival
 * a year on. `closeYear` files it on the closing day. Pure; consumes no RNG.
 */
export function buildYearReview(s: GameState): YearReview {
  const start = s.yearStart
  const year = Math.floor(start.day / DAYS_PER_YEAR) + 1
  const thisYear = (day: number) => day > start.day
  const oneShots = s.history.filter((r) => thisYear(r.day))
  const serials = allSerials(s)
  const runs = serials.map((x) => x.results.filter((r) => thisYear(r.day)))
  const scores = [...oneShots, ...runs.flat()].map((r) => r.score)
  const bestScore = scores.length ? Math.max(...scores) : null
  const best = bestOf(oneShots)
  const run = bestRun(runs)
  const now = yearSnapshot(s)
  const copies = now.copies - start.copies

  const standings: Record<AwardId, Standing> = {
    rookie: { figure: year === 1 ? best?.rank ?? null : null, shown: best?.rank ?? 0, lower: true },
    // the average shown rounded up to one decimal, so a miss never reads as the 3.0 that wins
    readers: { figure: run && run.sum / run.n, shown: run ? Math.ceil((run.sum * 10) / run.n) / 10 : 0, lower: true },
    critics: { figure: bestScore, shown: bestScore ?? 0, lower: false },
    'golden-pen': { figure: copies, shown: copies, lower: false },
  }
  // The Rookie Prize also goes to a serial started in year one, whatever the one-shots did. A serialisation offer
  // still waiting at the close (earned by a year-one one-shot, perhaps on the closing day itself) counts as one.
  const rookieSerial = year === 1 && (serials.some((x) => x.startedDay >= start.day) || !!s.pendingOffer)
  const awards: AwardId[] = []
  const nearMisses: NearMiss[] = []
  for (const a of AWARDS) {
    const verdict = a.id === 'rookie' && rookieSerial ? 'won' : rate(a, standings[a.id])
    if (verdict === 'won') awards.push(a.id)
    else if (verdict === 'near') nearMisses.push({ id: a.id, have: standings[a.id].shown, need: a.need })
  }

  const grown = growRival(s.rival, s.worldSeed)
  return {
    year,
    oneShots: oneShots.length,
    bestOneShot: best && { title: best.title, rank: best.rank, entrants: best.entrants, score: best.score },
    chapters: runs.reduce((sum, r) => sum + r.length, 0),
    volumes: now.volumes - start.volumes,
    copies,
    bestScore,
    moneyDelta: s.player.money - start.money,
    fansDelta: s.player.fans - start.fans,
    levelFrom: start.level,
    levelTo: s.player.level,
    awards,
    nearMisses,
    rival: {
      name: s.rival.name,
      ...rivalRecord(s, start.day),
      fromMagazine: s.rival.magazineId,
      toMagazine: grown.magazineId,
      craftBefore: s.rival.craft,
      craftAfter: grown.craft,
      series: grown.seriesTitle,
    },
    // year one's Rookie Prize goes to someone: the rival, when the player missed it
    rivalAward: year === 1 && !awards.includes('rookie') ? 'rookie' : null,
  }
}

/** "a", "a and b", "a, b and c". */
function listOf(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** Pay one award's prize (money, fans, XP) and record it as won for `year`. */
function payPrize(state: GameState, id: AwardId, year: number): GameState {
  const { name, prize } = awardById(id)
  const s: GameState = {
    ...state,
    awards: [...state.awards, { id, year }],
    player: { ...state.player, money: state.player.money + prize.money, fans: state.player.fans + prize.fans },
  }
  const text = `You won the ${name}: +${yen(prize.money)}, +${num(prize.fans)} fans, +${prize.xp} XP.`
  return grantXp(addLog(s, 'money', text, false), prize.xp)
}

/**
 * On a closing day (day > 0 and day % DAYS_PER_YEAR === 0): judge the year once, pay every award it won, file that
 * judgment with the prizes counted in the year's money, fans and level, grow the rival (a log line when they change
 * magazine), then take the new year's baseline, so next year's deltas start clean. The review waits unread on the
 * desk. One toast; the clock keeps running.
 */
export function closeYear(state: GameState): GameState {
  if (state.day <= 0 || state.day % DAYS_PER_YEAR !== 0) return state
  const judged = buildYearReview(state)
  let s = state
  for (const id of judged.awards) s = payPrize(s, id, judged.year)
  // Only the prizes moved: the filed review is the judgment the prizes were paid on.
  const start = state.yearStart
  const review: YearReview = {
    ...judged,
    moneyDelta: s.player.money - start.money,
    fansDelta: s.player.fans - start.fans,
    levelTo: s.player.level,
  }
  const rival = growRival(s.rival, s.worldSeed)
  s = { ...s, rival, yearReviews: [...s.yearReviews, review], reviewUnread: review.year, yearStart: yearSnapshot(s) }
  if (rival.magazineId !== state.rival.magazineId) {
    const mag = magazineById(rival.magazineId).name
    s = addLog(s, 'info', `${rival.name} moved up to ${mag} with a new series, "${rival.seriesTitle}".`, false)
  }
  const won = review.awards.length
    ? `You won ${listOf(review.awards.map((id) => `the ${awardById(id).name}`))}`
    : 'No awards this year'
  return addLog(s, 'success', `Year ${review.year} is over. ${won}. Your year in review is on the desk.`, true)
}

/** The review waiting unread on the desk, or null. */
export function unreadReview(s: GameState): YearReview | null {
  return s.reviewUnread === null ? null : s.yearReviews.find((r) => r.year === s.reviewUnread) ?? null
}

/** The player opened the year review: the desk card goes. */
export function markReviewRead(s: GameState): GameState {
  return s.reviewUnread === null ? s : { ...s, reviewUnread: null }
}
