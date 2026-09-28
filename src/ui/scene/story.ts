// What the studio's story props show (roomArt.ts): the chapter's deadline, the running serial's poster, the last poll
// and the fans, read from the game as a few primitives so the scene's snapshot never walks the game per frame. Pure,
// and only a picture of state the panels already explain: no rule lives here.
import { GENRES, chapterDeadline } from '../../sim'
import type { GameState } from '../../sim'

export type RankTone = 'none' | 'top' | 'mid' | 'low'

export interface StoryLook {
  /** Days until the running serial's chapter is due, or -1 with no deadline (one-shots, no chapter on the desk). */
  daysLeft: number
  /** A serial is running: its own cover takes the poster's place. */
  serialOn: boolean
  /** The serial's genre as a cover colour, 0-5. */
  posterHue: number
  /** The last poll pinned on the corkboard: the top three, the bottom third or in between. */
  rankTone: RankTone
  /** Fan letters on the doormat: under 100 fans, 1,000, 10,000, and beyond (0-3). */
  fanLevel: 0 | 1 | 2 | 3
}

export const NO_STORY: StoryLook = { daysLeft: -1, serialOn: false, posterHue: 0, rankTone: 'none', fanLevel: 0 }

export const POSTER_HUES = 6

function toneOf(rank: number, entrants: number): RankTone {
  if (rank <= 3) return 'top'
  return rank * 3 > entrants * 2 ? 'low' : 'mid'
}

/** Storyboard cards on the corkboard, a 2x3 grid: one per sixth of the pages drawn, while a manuscript is on the desk. */
export const CORK_CARDS = 6

export function corkCards(phase: string, progress: number): number {
  const onDesk = phase === 'drawing' || phase === 'ready'
  return onDesk ? Math.min(CORK_CARDS, Math.floor(progress * CORK_CARDS)) : 0
}

export function storyLook(g: GameState | null): StoryLook {
  if (!g) return NO_STORY
  const ser = g.serial && g.serial.status === 'running' ? g.serial : null
  const deadline = chapterDeadline(g)
  // the most recent poll: the running serial's last chapter, or else the last one-shot
  const chapter = ser?.results[ser.results.length - 1]
  const oneShot = g.history[g.history.length - 1]
  const last = chapter && (!oneShot || chapter.day >= oneShot.day) ? chapter : oneShot
  const fans = g.player.fans
  return {
    daysLeft: deadline ? Math.max(0, deadline.daysLeft) : -1,
    serialOn: !!ser,
    posterHue: ser ? Math.max(0, GENRES.findIndex((x) => x.id === ser.genre)) % POSTER_HUES : 0,
    rankTone: last ? toneOf(last.rank, last.entrants) : 'none',
    fanLevel: fans < 100 ? 0 : fans < 1000 ? 1 : fans < 10000 ? 2 : 3,
  }
}
