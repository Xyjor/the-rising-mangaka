import { magazineById } from './data'
import { createGame } from './engine'
import type { GameState, Serial } from './types'

/**
 * Fill any top-level or player field a saved game predates with the createGame default.
 * New top-level fields with a createGame default need no line here; nested defaults
 * (e.g. a new Serial field) get an explicit line.
 */
export function upgradeSave(g: GameState): GameState {
  const base = createGame('', 0)
  // Chapter deadlines: a serial saved before them owes its next chapter one magazine rhythm from the day of loading.
  const fix = (x: Serial): Serial => ({
    ...x,
    nextDueDay: x.nextDueDay ?? g.day + magazineById(x.magazineId).chapterDays,
    missedIssues: x.missedIssues ?? 0,
  })
  const up: GameState = { ...base, ...g, player: { ...base.player, ...g.player } }
  return { ...up, serial: up.serial && fix(up.serial), serials: up.serials.map(fix) }
}
