import { createGame } from './engine'
import type { GameState } from './types'

/**
 * Fill any top-level or player field a saved game predates with the createGame default.
 * New top-level fields with a createGame default need no line here; nested defaults
 * (e.g. a new Serial field) get an explicit line.
 */
export function upgradeSave(g: GameState): GameState {
  const base = createGame('', 0)
  return { ...base, ...g, player: { ...base.player, ...g.player } }
}
