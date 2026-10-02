// The presentation clock: a second, tiny, non-persisted store for visual time. `store.ts` never imports this file
// and this file never imports `store.ts`'s Store type beyond the `RunSpeed` alias it re-exports through SPEED_MS use
// at the call site (App.tsx passes `speed` in). Kept separate so 60 renders/second here never touches persisted state.
import { create } from 'zustand'
import { SPEED_MS } from './store'
import type { RunSpeed } from './store'

export interface ClockState {
  /** The sim day the clock is currently showing (set by `syncClockToDay`, not advanced here). */
  day: number
  /** Progress through `day`, 0 to FRACTION_MAX. Advanced by `advanceClock` between sim ticks. */
  fraction: number
  /** `weekT(day, fraction)`, kept on state so subscribers can select it directly. */
  t: number
  /** The highest `LogEntry.id` the player has seen, for the unread-log badge. */
  logSeenId: number
  /**
   * The tutorial guide is on screen (TutorialGuide sets it while its anchor is found; a step that waits leaves it
   * false): the scene's editor greeting hides only then.
   */
  guideVisible: boolean
}

export const DAYS_PER_WEEK = 7
// Matches render.ts's night window.
export const NIGHT_AFTER = 0.72
export const NIGHT_UNTIL = 0.06
// The next day is the sim's to announce (via a tick), not this clock's to race ahead into.
const FRACTION_MAX = 0.999

export const useClock = create<ClockState>()(() => ({ day: 0, fraction: 0, t: 0, logSeenId: 0, guideVisible: false }))

export function weekT(day: number, fraction: number): number {
  return ((day % DAYS_PER_WEEK) + fraction) / DAYS_PER_WEEK
}

export function isNight(t: number): boolean {
  return t > NIGHT_AFTER || t < NIGHT_UNTIL
}

export function advanceClock(dtMs: number, speed: RunSpeed): void {
  if (dtMs <= 0) return
  const { day, fraction } = useClock.getState()
  const next = Math.min(FRACTION_MAX, fraction + dtMs / SPEED_MS[speed])
  useClock.setState({ fraction: next, t: weekT(day, next) })
}

export function syncClockToDay(day: number): void {
  if (useClock.getState().day === day) return
  useClock.setState({ day, fraction: 0, t: weekT(day, 0) })
}

export function markLogSeen(nextLogId: number): void {
  useClock.setState({ logSeenId: nextLogId })
}

export function unreadLogCount(log: readonly { id: number }[], seenId: number): number {
  return log.reduce((n, e) => (e.id >= seenId ? n + 1 : n), 0)
}
