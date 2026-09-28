// Merchandise: a year-two money stream. A goods maker's licence arrives on the first day past year one on which a
// serial (running or archived) has shipped a volume (a toast, no pause: nothing to answer). The player then orders
// runs of goods for a serial that has shipped a volume: the cost is paid at once, and each run pays at the end of
// every week it sells, from its serial's average copies per volume and today's demand (the running serial's
// popularity, or half its final popularity once archived), times the anime boost. Money only: merch never touches
// fans, popularity or copies. Runs in tick() after animeTick, before eventTick (DESIGN.md "Tick order"). No RNG.
// No imports from engine.ts: engine imports this file.
import { animeDealFor, animeVolumeMult } from './anime'
import { addLog, num, yen } from './core'
import { DAYS_PER_YEAR, MERCH_MAX_RUNS, merchItemById } from './data'
import type { GameState, MerchItemId, MerchRun, Serial } from './types'

const WEEK = 7

function serialById(s: GameState, id: number): Serial | undefined {
  return (s.serial ? [s.serial, ...s.serials] : s.serials).find((x) => x.id === id)
}

/** Average copies a volume of `ser` sold so far (0 before its first volume). */
export function avgCopiesPerVolume(ser: Serial): number {
  return ser.volumes ? ser.totalCopies / ser.volumes : 0
}

/** Demand for goods of `ser`: its popularity while it runs, half its final popularity once it has ended. */
export function merchDemand(ser: Serial): number {
  return ser.status === 'running' ? ser.popularity : ser.popularity / 2
}

/** Is the run selling on `day` (ordered, not yet at its last pay day)? */
export function merchRunActive(run: MerchRun, day: number): boolean {
  return day < run.endsDay
}

export function activeMerchRuns(s: GameState): MerchRun[] {
  return s.merch.runs.filter((r) => merchRunActive(r, s.day))
}

function weeklyFor(s: GameState, item: MerchItemId, serialId: number): { units: number; money: number } {
  const ser = serialById(s, serialId)
  if (!ser) return { units: 0, money: 0 }
  const m = merchItemById(item)
  const units = Math.round((avgCopiesPerVolume(ser) * m.share * merchDemand(ser)) / 100)
  return { units, money: Math.round(units * m.margin * animeVolumeMult(s, serialId)) }
}

/** A run's week today: round(average copies per volume x share x demand / 100) units, x margin x the anime boost. */
export function merchWeekly(s: GameState, run: MerchRun): { units: number; money: number } {
  return weeklyFor(s, run.item, run.serialId)
}

/** What a run of `item` for `serialId` would earn over its weeks if today's demand holds, and the net after its cost. */
export function merchForecast(s: GameState, item: MerchItemId, serialId: number): { total: number; net: number; weeks: number } {
  const m = merchItemById(item)
  const total = weeklyFor(s, item, serialId).money * m.weeks
  return { total, net: total - m.cost, weeks: m.weeks }
}

/** Why a run of `item` for `serialId` cannot be ordered today, in words the UI shows; null when it can. */
export function merchRefusal(s: GameState, item: MerchItemId, serialId: number): string | null {
  const m = merchItemById(item)
  const ser = serialById(s, serialId)
  if (s.merch.licensedDay === null) return 'A goods maker licenses series from year two, once a volume has shipped.'
  if (!ser || ser.volumes < 1) return 'Goods need a volume on the shelves first.'
  if (m.needsVolumes && ser.volumes < m.needsVolumes) return `${m.name} need ${m.needsVolumes} volumes out (${ser.volumes} so far).`
  if (m.needsAnime && !animeDealFor(s, serialId)) return `${m.name} need a signed anime deal for this series.`
  const active = activeMerchRuns(s)
  if (active.some((r) => r.item === item && r.serialId === serialId)) return `${m.name} are already selling for this series.`
  if (active.length >= MERCH_MAX_RUNS) return `${MERCH_MAX_RUNS} runs are already selling. Wait for one to sell out.`
  if (s.player.money < m.cost) return `You need ${yen(m.cost)} (you have ${yen(s.player.money)}).`
  return null
}

/** Order a run of `item` for `serialId`: pays the cost now. Refused (the same state) when `merchRefusal` says so. */
export function orderMerch(s: GameState, item: MerchItemId, serialId: number): GameState {
  if (merchRefusal(s, item, serialId) !== null) return s
  const m = merchItemById(item)
  const run: MerchRun = {
    id: s.merch.nextRunId, item, serialId, orderedDay: s.day, endsDay: s.day + m.weeks * WEEK, sold: 0, money: 0,
  }
  const next: GameState = {
    ...s,
    player: { ...s.player, money: s.player.money - m.cost },
    merch: { ...s.merch, runs: [...s.merch.runs, run], nextRunId: run.id + 1 },
  }
  const title = serialById(s, serialId)!.title
  return addLog(next, 'money', `You ordered ${m.name.toLowerCase()} of "${title}": -${yen(m.cost)}. They sell for ${m.weeks} weeks.`, true)
}

function licenceDue(s: GameState): boolean {
  if (s.merch.licensedDay !== null || s.day <= DAYS_PER_YEAR) return false
  return (s.serial ? [s.serial, ...s.serials] : s.serials).some((x) => x.volumes > 0)
}

/**
 * Once a day, after animeTick: grant the licence when due, then pay every active run at the end of each of its weeks
 * (a log line, no toast); on its last pay day a run sells out (a toast) and stays in `runs` as history. No RNG.
 */
export function merchTick(state: GameState): GameState {
  let s = state
  if (licenceDue(s)) {
    s = addLog({ ...s, merch: { ...s.merch, licensedDay: s.day } }, 'series', 'A goods maker wants to license your series.', true)
  }
  for (const run of s.merch.runs) {
    const since = s.day - run.orderedDay
    if (since <= 0 || s.day > run.endsDay || since % WEEK !== 0) continue
    const m = merchItemById(run.item)
    const w = merchWeekly(s, run)
    const paid: MerchRun = { ...run, sold: run.sold + w.units, money: run.money + w.money }
    s = {
      ...s,
      player: { ...s.player, money: s.player.money + w.money },
      merch: { ...s.merch, earned: s.merch.earned + w.money, runs: s.merch.runs.map((r) => (r.id === run.id ? paid : r)) },
    }
    const title = serialById(s, run.serialId)?.title ?? 'your series'
    s = addLog(s, 'money', `${m.name} of "${title}", week ${since / WEEK} of ${m.weeks}: ${num(w.units)} sold, +${yen(w.money)}.`, false)
    if (s.day === run.endsDay) {
      s = addLog(s, 'money', `${m.name} sold out: +${yen(paid.money)} over ${m.weeks} weeks.`, true)
    }
  }
  return s
}
