// Why the editor is visiting, what they carry and what they say. Pure: reads the game, touches nothing.
import { getPhase, unreadReview } from '../../sim'
import type { GameState } from '../../sim'

export type VisitorReason = 'none' | 'result' | 'offer' | 'ready' | 'anime' | 'event' | 'review'
export type VisitorProp = 'none' | 'envelope' | 'letter' | 'contract' | 'trophy'

/** The one reason the editor is at the spot, by priority: result, offer, ready, anime, event, review. */
export function visitorReasonOf(game: GameState | null): VisitorReason {
  if (!game) return 'none'
  if (game.pendingResult) return 'result'
  if (game.pendingOffer) return 'offer'
  if (getPhase(game) === 'ready') return 'ready'
  if (game.animeOffer) return 'anime'
  if (game.event) return 'event'
  if (unreadReview(game)) return 'review'
  return 'none'
}

export const PROP_FOR: Record<VisitorReason, VisitorProp> = {
  none: 'none', result: 'envelope', ready: 'envelope', offer: 'contract', anime: 'contract', event: 'letter', review: 'trophy',
}

export const GREETING: Record<VisitorReason, string> = {
  none: '',
  result: 'The poll results are in.',
  ready: 'Ready when you are.',
  offer: 'I have a contract for you.',
  anime: 'A studio wants to talk.',
  event: 'A letter came for you.',
  review: 'Your year in review is on the desk.',
}
