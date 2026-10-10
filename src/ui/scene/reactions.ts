// The scene's reactions (0.11.0): which game event a store change brings that the cast reacts to. StudioScene
// subscribes and hands each one to the snapshot as a one-shot cue (`Snapshot.reaction`). Pure: reads two states,
// touches nothing. Good and bad are the corkboard's own tones (story.ts `rankToneOf`).
// One cue is held per animation frame: two reactions inside one frame leave only the second (it overwrites the first
// before the driver reads it), which is rare and accepted.
import { chapterDeadline } from '../../sim'
import type { GameState } from '../../sim'
import type { PopState } from './Pops'
import { rankToneOf } from './story'

export type ReactionKind = 'good-poll' | 'bad-poll' | 'level-up' | 'late' | 'missed'

/** A reaction for the snapshot: `id` grows with every cue, so each character plays it once. */
export interface ReactionCue { readonly id: number; readonly kind: ReactionKind }

/** Issues missed by every serial, running or archived (an archived serial keeps its count). */
export function missedIssuesOf(g: GameState): number {
  let n = g.serial ? g.serial.missedIssues : 0
  for (const s of g.serials) n += s.missedIssues
  return n
}

/** The newest poll a change brought: a one-shot result dismissed (so seen), or a new chapter result of the serial running before. */
function newPoll(a: GameState, b: GameState): { rank: number; entrants: number } | null {
  if (a.pendingResult && !b.pendingResult) return a.pendingResult
  const ser = a.serial
  if (!ser) return null
  const now = b.serial?.id === ser.id ? b.serial : b.serials.find((x) => x.id === ser.id)
  if (!now || now.results.length <= ser.results.length) return null
  return now.results[now.results.length - 1]
}

/**
 * The reaction one store change brings, or null: never across a save load, a new career (another world seed), a jump
 * of more than a day, or in a read-only tab (popsFor's guards). By priority: a missed issue, a bad poll, a good poll,
 * a level-up, the chapter turning late.
 */
export function reactionFor(prev: PopState, next: PopState): ReactionKind | null {
  const a = prev.game
  const b = next.game
  // most store changes (a modal, a toast, the speed) leave the game object as it was
  if (a === b) return null
  if (prev.readOnly || next.readOnly || prev.saveLoads !== next.saveLoads || !a || !b) return null
  if (a.worldSeed !== b.worldSeed) return null
  const gap = b.day - a.day
  if (gap !== 0 && gap !== 1) return null
  if (missedIssuesOf(b) > missedIssuesOf(a)) return 'missed'
  const poll = newPoll(a, b)
  const tone = poll ? rankToneOf(poll.rank, poll.entrants) : 'none'
  if (tone === 'low') return 'bad-poll'
  if (tone === 'top') return 'good-poll'
  if (b.player.level > a.player.level) return 'level-up'
  if (chapterDeadline(a)?.status !== 'late' && chapterDeadline(b)?.status === 'late') return 'late'
  return null
}
