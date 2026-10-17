// Whether the game clock runs: the one predicate the clock (App's useGameClock) and the sound bridge (the music's calm)
// share. Pure, with structural inputs and no store import, so the bridge can use it without importing the store.

/** The part of the store (or of the bridge's SoundState) the predicate reads. */
export interface ClockInputs {
  game: { pendingResult: unknown; pendingOffer: unknown } | null
  speed: number
  modal: string
  readOnly: boolean
}

/**
 * True while the clock ticks: a game is open, the speed is above 0, no modal is open, no result or offer waits for a
 * decision, and this tab owns the save.
 */
export function clockRuns(s: ClockInputs): boolean {
  return !!s.game && s.speed > 0 && s.modal === 'none' && !s.game.pendingResult && !s.game.pendingOffer && !s.readOnly
}
