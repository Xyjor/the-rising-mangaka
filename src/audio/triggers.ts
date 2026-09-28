// Which sounds a change of game state makes. Pure: it compares two states field by field (never the log's wording),
// so the same rules hear a day's tick and a player's command alike. Framework-free; the store plays what it returns.
import { PODIUM_RANK, doneIds, earnedBadges, getPhase, isPayDay, weakRankLine } from '../sim'
import type { GameState, Serial } from '../sim'
import type { CueId } from './types'

/** At most this many cues play for one change; `page` plays only when nothing else does. */
const MAX_CUES = 2

/** Every serial in a state: the one on the desk, then the archive. */
function allSerials(s: GameState): Serial[] {
  return s.serial ? [s.serial, ...s.serials] : s.serials
}

/** Each serial in `next` beside the same serial (by id) in `prev`, or undefined when it is new. */
function serialPairs(prev: GameState, next: GameState): [Serial | undefined, Serial][] {
  const before = new Map(allSerials(prev).map((s) => [s.id, s]))
  return allSerials(next).map((s) => [before.get(s.id), s])
}

/** A serial got a new chapter result: top for the podium, weak below the weak line, else plain. */
function chapterCue(pairs: [Serial | undefined, Serial][]): CueId | null {
  // Only the newest result is heard when several resolve in one transition.
  const grown = pairs.find(([b, a]) => a.results.length > (b?.results.length ?? 0))
  if (!grown) return null
  const r = grown[1].results[grown[1].results.length - 1]
  if (r.rank <= PODIUM_RANK) return 'chapter-top'
  return r.rank > weakRankLine(r.entrants) ? 'chapter-weak' : 'chapter'
}

/** An anime's weekly pay landed: a new day that is a signed deal's pay day, and money rose. */
function animePaid(prev: GameState, next: GameState): boolean {
  if (next.day !== prev.day + 1 || next.player.money <= prev.player.money) return false
  return next.anime.some((d) => isPayDay(d, next.day))
}

/** Money for something made or bought: a volume shipped, equipment bought, or an anime's weekly pay. */
function coinsCue(prev: GameState, next: GameState, pairs: [Serial | undefined, Serial][]): CueId | null {
  const shipped = pairs.some(([b, a]) => a.volumes > (b?.volumes ?? 0))
  return shipped || next.studio.owned.length > prev.studio.owned.length || animePaid(prev, next) ? 'coins' : null
}

/** A new log line the player must notice that is a warning. */
function warned(prev: GameState, next: GameState): boolean {
  return next.log.some((e) => e.id >= prev.nextLogId && e.kind === 'warn' && e.toast)
}

/**
 * The cues for going from `prev` to `next`, most important first, at most two. Silent when the two states are not one
 * step of play apart (another world, or a gap other than zero or one day, as after loading another save or tickMany),
 * and on the tick a poll result lands, whose reveal owns that moment (a level-up or milestone on that tick still toasts).
 * A cancellation plays alone: the warnings that land with it would only repeat the bad news.
 */
export function cuesForTransition(prev: GameState, next: GameState): CueId[] {
  const days = next.day - prev.day
  if (prev.worldSeed !== next.worldSeed || (days !== 0 && days !== 1)) return []
  if (!prev.pendingResult && next.pendingResult) return []

  const pairs = serialPairs(prev, next)
  if (pairs.some(([b, a]) => a.status === 'cancelled' && b?.status !== 'cancelled')) return ['cancel']

  const phaseWas = getPhase(prev)
  const phase = getPhase(next)
  const newReview = next.yearReviews.length > prev.yearReviews.length ? next.yearReviews[next.yearReviews.length - 1] : null

  // In priority order.
  const heard: (CueId | null)[] = [
    prev.pendingOffer && next.serial && next.serial.id !== prev.serial?.id ? 'serialised' : null,
    next.pendingOffer && !next.pendingResult && (prev.pendingResult || !prev.pendingOffer) ? 'offer' : null,
    newReview && newReview.awards.length > 0 ? 'award' : null,
    !prev.event && next.event ? 'event' : null,
    phaseWas === 'drawing' && phase === 'ready' ? 'ready' : null,
    next.player.level > prev.player.level ? 'levelup' : null,
    doneIds(next).length > doneIds(prev).length || earnedBadges(next).length > earnedBadges(prev).length
      ? 'milestone' : null,
    chapterCue(pairs),
    coinsCue(prev, next, pairs),
    phaseWas === 'ready' && phase === 'submitted' ? 'submit' : null,
    !prev.project && next.project?.kind === 'oneshot' ? 'start' : null,
    warned(prev, next) || (prev.player.money >= 0 && next.player.money < 0) ? 'warn' : null,
    next.assistants.length > prev.assistants.length ? 'hire' : null,
    prev.trip && !next.trip ? 'return' : !prev.trip && next.trip ? 'depart' : null,
    pairs.some(([b, a]) => a.chaptersSent > (b?.chaptersSent ?? 0)) ? 'send' : null,
  ]
  const cues = heard.filter((c): c is CueId => c !== null).slice(0, MAX_CUES)
  if (cues.length) return cues

  const p = prev.project
  const q = next.project
  return p && q && p.id === q.id && Math.floor(q.pagesDone) > Math.floor(p.pagesDone) ? ['page'] : []
}

/** The click a speed change makes: resume from a pause, pause from running, a click between two speeds. */
export function speedCue(prev: number, next: number): CueId | null {
  if (prev === next) return null
  if (prev === 0) return 'resume'
  return next === 0 ? 'pause' : 'click'
}
