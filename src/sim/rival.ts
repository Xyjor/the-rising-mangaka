// The named rival mangaka: one per world. Who they are comes from a hash of the world seed, how good they are from the
// years elapsed, so building one consumes no RNG. The polls score them as entrant 0 of their magazine's field
// (`pollField` in scoring.ts); this file makes the rival, grows them at each year end (`growRival`, called by
// `closeYear` in year.ts) and keeps the head-to-head count.
import { addLog, num } from './core'
import { MAGAZINES, RIVAL_MAX_CRAFT, RIVAL_NAMES, RIVAL_SERIES, RIVAL_START_CRAFT, RIVAL_YEARLY_GROWTH } from './data'
import { hashString } from './rng'
import type { GameState, MagazineId, Rival, RivalPlacing, RivalTemper } from './types'

/**
 * A rival sits this far above the field they join: the magazine with the highest rivalMean at most craft - 6. From
 * the starting craft 57 and +4 a year that climbs one magazine a year: Kids, Petal, Bolt, then Ultra.
 */
const RIVAL_FIELD_MARGIN = 6

/** The magazine a rival of `craft` runs in: the highest rivalMean at most craft - 6, else Kids Comic Go!. */
export function rivalMagazineFor(craft: number): MagazineId {
  let best: { id: MagazineId; mean: number } | null = null
  for (const m of MAGAZINES) {
    if (m.rivalMean > craft - RIVAL_FIELD_MARGIN) continue
    if (!best || m.rivalMean > best.mean) best = { id: m.id, mean: m.rivalMean }
  }
  return best?.id ?? 'kids-comic'
}

/** The series the world's rival draws in `magazineId`: one of its three, picked by a hash of the world seed. */
function rivalSeries(worldSeed: number, magazineId: MagazineId): string {
  const titles = RIVAL_SERIES[magazineId]
  return titles[hashString(`rival:${worldSeed}:${magazineId}`) % titles.length]
}

/** The three tempers, in the order the world-seed hash picks from. */
export const RIVAL_TEMPERS: readonly RivalTemper[] = ['gracious', 'cocky', 'stoic']

/** The world's rival temper: a hash of the world seed, no RNG. Text only (results and year review lines). */
export function rivalTemperFor(worldSeed: number): RivalTemper {
  return RIVAL_TEMPERS[hashString(`temper:${worldSeed}`) % RIVAL_TEMPERS.length]
}

/** The world's rival after `yearsElapsed` whole years: the name is fixed per world, craft grows to a cap. */
export function makeRival(worldSeed: number, yearsElapsed: number): Rival {
  const craft = Math.min(RIVAL_MAX_CRAFT, RIVAL_START_CRAFT + RIVAL_YEARLY_GROWTH * yearsElapsed)
  const magazineId = rivalMagazineFor(craft)
  return {
    name: RIVAL_NAMES[hashString(`rival:${worldSeed}`) % RIVAL_NAMES.length],
    craft,
    magazineId,
    seriesTitle: rivalSeries(worldSeed, magazineId),
    temper: rivalTemperFor(worldSeed),
  }
}

/**
 * The rival a year on: craft + RIVAL_YEARLY_GROWTH, capped at RIVAL_MAX_CRAFT. When the new craft belongs in another
 * magazine (`rivalMagazineFor`) the rival moves there with that magazine's series for this world; otherwise the series
 * stays. Growing `makeRival(w, n)` gives `makeRival(w, n + 1)`.
 */
export function growRival(rival: Rival, worldSeed: number): Rival {
  const craft = Math.min(RIVAL_MAX_CRAFT, rival.craft + RIVAL_YEARLY_GROWTH)
  const magazineId = rivalMagazineFor(craft)
  if (magazineId === rival.magazineId) return { ...rival, craft }
  return { ...rival, craft, magazineId, seriesTitle: rivalSeries(worldSeed, magazineId) }
}

/**
 * Head to head over every poll the rival was in, one-shots and chapters of every serial: a win when the player placed
 * above the rival, a loss when below. Equal ranks count as neither. With `afterDay`, only polls after that day count.
 */
export function rivalRecord(s: GameState, afterDay = -Infinity): { wins: number; losses: number } {
  const serials = s.serial ? [...s.serials, s.serial] : s.serials
  const polls: { day: number; rank: number; rival?: RivalPlacing }[] =
    [...s.history, ...serials.flatMap((x) => x.results)]
  let wins = 0
  let losses = 0
  for (const p of polls) {
    if (!p.rival || p.day <= afterDay) continue
    if (p.rank < p.rival.rank) wins++
    else if (p.rank > p.rival.rank) losses++
  }
  return { wins, losses }
}

/** Fans a won rival challenge brings: 3% of fans, at most 1,500. */
export function challengeFans(fans: number): number {
  return Math.min(1500, Math.round(fans * 0.03))
}
/** Popularity a lost rival challenge costs. */
export const CHALLENGE_POPULARITY_LOSS = 3

/**
 * Runs in tick() right after checkDeadline: an accepted rival challenge is settled by its serial's next chapter result
 * (the one at index `fromResult`). Placing above the rival: fans + `challengeFans`. Below: popularity -3. A tie, a
 * result without the rival in it, or a serial that ended first calls it off. Consumes no RNG.
 */
export function settleChallenge(state: GameState): GameState {
  const ch = state.rivalChallenge
  if (!ch) return state
  const ser = (state.serial ? [state.serial, ...state.serials] : state.serials).find((x) => x.id === ch.serialId)
  const name = state.rival.name
  const r = ser?.results[ch.fromResult]
  if (!r) {
    if (ser && ser.status === 'running') return state
    return addLog({ ...state, rivalChallenge: null }, 'event', `The challenge with ${name} is off: the series ended first.`, false)
  }
  const s: GameState = { ...state, rivalChallenge: null }
  if (!r.rival || r.rank === r.rival.rank) {
    return addLog(s, 'event', `The challenge with ${name} ended in a draw. Nothing changed.`, true)
  }
  if (r.rank < r.rival.rank) {
    const gain = challengeFans(s.player.fans)
    const won: GameState = { ...s, player: { ...s.player, fans: s.player.fans + gain } }
    return addLog(won, 'event', `You beat ${name} in the challenge: #${r.rank} to #${r.rival.rank}. Fans +${num(gain)}.`, true)
  }
  const live = s.serial?.id === ch.serialId ? s.serial : null
  const lost: GameState = live
    ? { ...s, serial: { ...live, popularity: Math.max(0, live.popularity - CHALLENGE_POPULARITY_LOSS) } }
    : s
  return addLog(lost, 'event',
    `${name} won the challenge: #${r.rival.rank} to your #${r.rank}. Popularity -${CHALLENGE_POPULARITY_LOSS}.`, true)
}
