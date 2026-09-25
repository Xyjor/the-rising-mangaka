// The named rival mangaka: one per world. Who they are comes from a hash of the world seed, how good they are from the
// years elapsed, so building one consumes no RNG. The polls score them as entrant 0 of their magazine's field
// (`pollField` in scoring.ts); this file makes the rival, grows them at each year end (`growRival`, called by
// `closeYear` in year.ts) and keeps the head-to-head count.
import { MAGAZINES, RIVAL_MAX_CRAFT, RIVAL_NAMES, RIVAL_SERIES, RIVAL_START_CRAFT, RIVAL_YEARLY_GROWTH } from './data'
import { hashString } from './rng'
import type { GameState, MagazineId, Rival, RivalPlacing } from './types'

/** A rival sits this far above the field they join: the magazine with the highest rivalMean at most craft - 2. */
const RIVAL_FIELD_MARGIN = 2

/** The magazine a rival of `craft` runs in: the highest rivalMean at most craft - 2, else Kids Comic Go!. */
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

/** The world's rival after `yearsElapsed` whole years: the name is fixed per world, craft grows to a cap. */
export function makeRival(worldSeed: number, yearsElapsed: number): Rival {
  const craft = Math.min(RIVAL_MAX_CRAFT, RIVAL_START_CRAFT + RIVAL_YEARLY_GROWTH * yearsElapsed)
  const magazineId = rivalMagazineFor(craft)
  return {
    name: RIVAL_NAMES[hashString(`rival:${worldSeed}`) % RIVAL_NAMES.length],
    craft,
    magazineId,
    seriesTitle: rivalSeries(worldSeed, magazineId),
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
