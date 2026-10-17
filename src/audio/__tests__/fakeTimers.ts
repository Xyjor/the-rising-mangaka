/**
 * A manual stand-in for setInterval and clearInterval: nothing runs on its own. A test calls `fire()` to run every
 * live interval once, as if its period had passed, and reads `live` to see which intervals are still set.
 */
import type { Timers } from '../music/player'

export class FakeTimers implements Timers {
  readonly #live = new Map<number, { fn: () => void; ms: number }>()
  #next = 1

  setInterval(fn: () => void, ms: number): unknown {
    const id = this.#next++
    this.#live.set(id, { fn, ms })
    return id
  }

  clearInterval(id: unknown): void {
    this.#live.delete(id as number)
  }

  /** The period in ms of every interval still set. */
  get live(): number[] {
    return [...this.#live.values()].map((t) => t.ms)
  }

  /** Runs every live interval once. An interval cleared by an earlier one in the same round does not run. */
  fire(): void {
    for (const [id, t] of [...this.#live]) if (this.#live.has(id)) t.fn()
  }
}
