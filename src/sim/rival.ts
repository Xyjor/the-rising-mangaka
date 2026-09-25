// The named rival mangaka: one per world. Who they are comes from a hash of the world seed, how good they are from the
// years elapsed, so building one consumes no RNG. The polls score them as entrant 0 of their magazine's field
// (`pollField` in scoring.ts); this file only makes the rival and keeps the head-to-head count.
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

/** The world's rival after `yearsElapsed` whole years: the name is fixed per world, craft grows to a cap. */
export function makeRival(worldSeed: number, yearsElapsed: number): Rival {
  const craft = Math.min(RIVAL_MAX_CRAFT, RIVAL_START_CRAFT + RIVAL_YEARLY_GROWTH * yearsElapsed)
  const magazineId = rivalMagazineFor(craft)
  const titles = RIVAL_SERIES[magazineId]
  return {
    name: RIVAL_NAMES[hashString(`rival:${worldSeed}`) % RIVAL_NAMES.length],
    craft,
    magazineId,
    seriesTitle: titles[hashString(`rival:${worldSeed}:${magazineId}`) % titles.length],
  }
}

/**
 * Head to head over every poll the rival was in, one-shots and chapters of every serial: a win when the player placed
 * above the rival, a loss when below. Equal ranks count as neither.
 */
export function rivalRecord(s: GameState): { wins: number; losses: number } {
  const serials = s.serial ? [...s.serials, s.serial] : s.serials
  const polls: { rank: number; rival?: RivalPlacing }[] = [...s.history, ...serials.flatMap((x) => x.results)]
  let wins = 0
  let losses = 0
  for (const p of polls) {
    if (!p.rival) continue
    if (p.rank < p.rival.rank) wins++
    else if (p.rank > p.rival.rank) losses++
  }
  return { wins, losses }
}
