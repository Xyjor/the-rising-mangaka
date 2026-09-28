// Badges: a gallery of fun, often hidden achievements beside the milestone ladder. Pure checkers over the state before
// (`prev`) and after (`s`) a tick, no RNG, no XP, no money: they change no rule, so balance cannot move. Awarded as the
// last step of every tick (see DESIGN.md "Tick order" and "Badges"). No imports from engine.ts.
import { addLog } from './core'
import { EQUIPMENT_IDS } from './data'
import { rivalRecord } from './rival'
import type { AwardId, GameState, Serial } from './types'

export type BadgeId =
  | 'all-nighter' | 'cancelled' | 'stop-presses' | 'ramen-budget' | 'first-place' | 'golden-pen' | 'grand-slam'
  | 'rival-10' | 'perfect-pair' | 'anime-signed' | 'anime-declined' | 'the-loft' | 'fully-equipped' | 'century'
  | 'millionaire'

export interface Badge {
  id: BadgeId
  title: string
  /** what earns it; for a hidden badge the gallery shows only `category` until it is earned */
  hint: string
  hidden: boolean
  /** a hidden badge's teaser, e.g. "A secret about deadlines" */
  category: string
  done: (prev: GameState, s: GameState) => boolean
}

/** one earned badge and the day it landed */
export interface BadgeEarned { id: BadgeId; day: number }

function allSerials(s: GameState): Serial[] {
  return s.serial ? [s.serial, ...s.serials] : s.serials
}

function ranks(s: GameState): number[] {
  return [...s.history, ...allSerials(s).flatMap((x) => x.results)].map((r) => r.rank)
}

const ALL_AWARDS: AwardId[] = ['rookie', 'readers', 'critics', 'golden-pen']

export const BADGES: Badge[] = [
  {
    id: 'all-nighter', title: 'Pull an all-nighter', hint: 'Collapse from exhaustion at the desk', hidden: true,
    category: 'A secret about stamina',
    done: (prev, s) => prev.activity === 'work' && !prev.recovering && s.recovering,
  },
  {
    id: 'cancelled', title: 'Cancelled', hint: 'Have a serial cancelled', hidden: true,
    category: 'A secret about serials',
    done: (_p, s) => allSerials(s).some((x) => x.status === 'cancelled'),
  },
  {
    id: 'stop-presses', title: 'Stop the presses', hint: 'Miss an issue', hidden: true,
    category: 'A secret about deadlines',
    done: (_p, s) => allSerials(s).some((x) => x.missedIssues > 0),
  },
  {
    id: 'ramen-budget', title: 'Ramen budget', hint: 'End a week in debt', hidden: true,
    category: 'A secret about money',
    done: (prev, s) => s.day !== prev.day && s.day % 7 === 0 && s.player.money < 0,
  },
  {
    id: 'first-place', title: 'Top of the poll', hint: 'Rank first in any poll', hidden: false, category: 'Polls',
    done: (_p, s) => ranks(s).includes(1),
  },
  {
    id: 'golden-pen', title: 'The Golden Pen', hint: 'Win the Golden Pen award', hidden: false, category: 'Awards',
    done: (_p, s) => s.awards.some((a) => a.id === 'golden-pen'),
  },
  {
    id: 'grand-slam', title: 'Grand slam', hint: 'Win all four awards at least once', hidden: true,
    category: 'A secret about awards',
    done: (_p, s) => ALL_AWARDS.every((id) => s.awards.some((a) => a.id === id)),
  },
  {
    id: 'rival-10', title: 'Old rivals', hint: 'Place above your rival in 10 polls', hidden: false, category: 'Rival',
    done: (_p, s) => rivalRecord(s).wins >= 10,
  },
  {
    id: 'perfect-pair', title: 'Perfect pairing', hint: 'Record a genre and theme pairing at its best rating',
    hidden: false, category: 'Notebook',
    done: (_p, s) => Object.values(s.notebook.genreTheme).some((r) => r === 4),
  },
  {
    id: 'anime-signed', title: 'On the screen', hint: 'Sign an anime deal', hidden: false, category: 'Anime',
    done: (_p, s) => s.anime.length > 0,
  },
  {
    // An offer that ended without a deal: declined, left to lapse, or withdrawn when its series ended.
    id: 'anime-declined', title: 'Not for sale', hint: 'Let an anime offer go unsigned', hidden: true,
    category: 'A secret about anime',
    done: (_p, s) => s.animeOfferedFor.some((id) => s.animeOffer?.serialId !== id && !s.anime.some((d) => d.serialId === id)),
  },
  {
    id: 'the-loft', title: 'Moving up', hint: 'Move into the studio loft', hidden: false, category: 'Studio',
    done: (_p, s) => s.studio.tier === 'loft',
  },
  {
    id: 'fully-equipped', title: 'Fully equipped', hint: 'Own every piece of equipment', hidden: false,
    category: 'Studio',
    done: (_p, s) => EQUIPMENT_IDS.every((id) => s.studio.owned.includes(id)),
  },
  {
    id: 'century', title: 'Century', hint: 'Send 100 chapters across all your serials', hidden: false,
    category: 'Serials',
    done: (_p, s) => allSerials(s).reduce((a, x) => a + x.chaptersSent, 0) >= 100,
  },
  {
    id: 'millionaire', title: 'Millionaire', hint: 'Hold ¥1,000,000', hidden: false, category: 'Money',
    done: (_p, s) => s.player.money >= 1_000_000,
  },
]

export function badgeById(id: BadgeId): Badge | undefined {
  return BADGES.find((b) => b.id === id)
}

/** badges earned so far; tolerates saves made before the field existed */
export function earnedBadges(s: GameState): BadgeEarned[] {
  return s.badges ?? []
}

/** Last step of tick: award every unearned badge whose rule holds going from `prev` to `s`. Consumes no RNG. */
export function awardBadges(prev: GameState, state: GameState): GameState {
  let s = state
  for (const b of BADGES) {
    if (earnedBadges(s).some((e) => e.id === b.id) || !b.done(prev, s)) continue
    s = { ...s, badges: [...earnedBadges(s), { id: b.id, day: s.day }] }
    s = addLog(s, 'success', `Badge: ${b.title}.`, true)
  }
  return s
}

/** A loaded save's badges plus every one its state already earns, granted quietly on the save's current day. */
export function quietBadges(s: GameState): BadgeEarned[] {
  const have = earnedBadges(s)
  const add = BADGES.filter((b) => !have.some((e) => e.id === b.id) && b.done(s, s)).map((b) => ({ id: b.id, day: s.day }))
  return [...have, ...add]
}
