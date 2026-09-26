// Per-cue rate limiting: a cue may not play again until its gap has passed since its last allowed play.

export interface Limiter {
  /** True, and records the play, when `cue` last played at least its gap ago (or never). */
  allow(cue: string, nowMs: number): boolean
}

/** `gaps` maps a cue to its gap in ms; a cue with no entry is never held. */
export function createLimiter(gaps: Readonly<Record<string, number>>): Limiter {
  const last = new Map<string, number>()
  return {
    allow(cue, nowMs) {
      const prev = last.get(cue)
      if (prev !== undefined && nowMs - prev < (gaps[cue] ?? 0)) return false
      last.set(cue, nowMs)
      return true
    },
  }
}
