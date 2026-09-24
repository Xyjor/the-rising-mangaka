// Milestones: a visible ladder of career goals. Pure checkers over existing state, no RNG.
// Checked at the end of every tick (see DESIGN.md "Tick order"). No imports from engine.ts.
import { ONE_SHOT_PAGES, SERIAL_OFFER_MIN_RANK, VOLUME_EVERY_CHAPTERS } from './data'
import type { GameState, Serial } from './types'

export type MilestoneId =
  | 'first-manuscript' | 'first-poll' | 'top-half' | 'podium' | 'fans-1k' | 'first-hire'
  | 'first-serial' | 'first-volume' | 'level-5' | 'fans-5k' | 'chapters-10' | 'money-50k'
  | 'three-assistants' | 'fans-20k' | 'big-league' | 'chapters-50' | 'graceful-exit' | 'fans-100k'

export interface Milestone {
  id: MilestoneId
  title: string
  hint: string
  xp: number
  done: (s: GameState) => boolean
}

/** every serial the player has run: the current one plus the archive */
function allSerials(s: GameState): Serial[] {
  return s.serial ? [s.serial, ...s.serials] : s.serials
}

/** every poll placement so far as [rank, entrants], one-shots and chapters alike */
function placements(s: GameState): [number, number][] {
  const out: [number, number][] = s.history.map((r) => [r.rank, r.entrants])
  for (const ser of allSerials(s)) for (const r of ser.results) out.push([r.rank, r.entrants])
  return out
}

function chaptersSent(s: GameState): number {
  return allSerials(s).reduce((a, ser) => a + ser.chaptersSent, 0)
}

/** Ordered ladder. Total 1,840 XP, about two extra levels over a career. */
export const MILESTONES: Milestone[] = [
  {
    id: 'first-manuscript', title: 'First manuscript', hint: `Finish your first ${ONE_SHOT_PAGES} pages`, xp: 40,
    done: (s) =>
      s.history.length >= 1 ||
      (s.project?.kind === 'oneshot' && s.project.status !== 'drawing') ||
      !!s.pendingResult,
  },
  {
    id: 'first-poll', title: 'First poll', hint: 'Submit a manuscript and read the results', xp: 40,
    done: (s) => s.history.length >= 1,
  },
  {
    id: 'top-half', title: 'Top half', hint: 'Place in the top half of a poll', xp: 60,
    done: (s) => placements(s).some(([rank, entrants]) => rank <= Math.ceil(entrants / 2)),
  },
  {
    id: 'podium', title: 'On the podium', hint: `Place top ${SERIAL_OFFER_MIN_RANK} in any poll`, xp: 80,
    done: (s) => placements(s).some(([rank]) => rank <= SERIAL_OFFER_MIN_RANK),
  },
  {
    id: 'fans-1k', title: 'A thousand fans', hint: 'Reach 1,000 fans', xp: 80,
    done: (s) => s.player.fans >= 1000,
  },
  {
    id: 'first-hire', title: 'First hire', hint: 'Hire an assistant', xp: 60,
    done: (s) => s.assistants.length >= 1,
  },
  {
    id: 'first-serial', title: 'Serialised', hint: 'Accept a serialisation offer', xp: 100,
    done: (s) => !!s.serial || s.serials.length >= 1,
  },
  {
    id: 'first-volume', title: 'First volume', hint: `Ship a collected volume (every ${VOLUME_EVERY_CHAPTERS} chapters)`, xp: 100,
    done: (s) => allSerials(s).reduce((a, ser) => a + ser.volumes, 0) >= 1,
  },
  {
    id: 'level-5', title: 'Level 5', hint: 'Reach level 5', xp: 100,
    done: (s) => s.player.level >= 5,
  },
  {
    id: 'fans-5k', title: 'Five thousand fans', hint: 'Reach 5,000 fans', xp: 100,
    done: (s) => s.player.fans >= 5000,
  },
  {
    id: 'chapters-10', title: 'Ten chapters', hint: 'Send 10 serial chapters', xp: 100,
    done: (s) => chaptersSent(s) >= 10,
  },
  {
    id: 'money-50k', title: 'Fifty thousand', hint: 'Hold ¥50,000', xp: 100,
    done: (s) => s.player.money >= 50000,
  },
  {
    id: 'three-assistants', title: 'Full studio', hint: 'Employ three assistants', xp: 80,
    done: (s) => s.assistants.length >= 3,
  },
  {
    id: 'fans-20k', title: 'Twenty thousand fans', hint: 'Reach 20,000 fans', xp: 150,
    done: (s) => s.player.fans >= 20000,
  },
  {
    id: 'big-league', title: 'Big league', hint: 'Run a serial in Weekly Bolt or Ultra Seinen', xp: 150,
    done: (s) => allSerials(s).some((ser) => ser.magazineId === 'weekly-bolt' || ser.magazineId === 'ultra-seinen'),
  },
  {
    id: 'chapters-50', title: 'Fifty chapters', hint: 'Send 50 serial chapters', xp: 150,
    done: (s) => chaptersSent(s) >= 50,
  },
  {
    id: 'graceful-exit', title: 'Graceful exit', hint: 'Wrap up a serial while its popularity is 50 or higher', xp: 150,
    // 50 is SERIAL_CLIMAX_MIN_POPULARITY; switch to the constant once the sim fix pass lands it in data.ts.
    done: (s) => s.serials.some((ser) => ser.status === 'ended' && ser.popularity >= 50),
  },
  {
    id: 'fans-100k', title: 'A hundred thousand fans', hint: 'Reach 100,000 fans', xp: 200,
    done: (s) => s.player.fans >= 100000,
  },
]

/** ids already awarded; tolerates saves made before the field existed */
export function doneIds(s: GameState): MilestoneId[] {
  return s.milestonesDone ?? []
}

/** the first goal not yet reached, or null once the ladder is complete; returns the constant object */
export function nextMilestone(s: GameState): Milestone | null {
  const done = doneIds(s)
  return MILESTONES.find((m) => !done.includes(m.id)) ?? null
}

/** every goal not yet awarded whose rule is now true, in ladder order */
export function pendingMilestones(s: GameState): Milestone[] {
  const done = doneIds(s)
  return MILESTONES.filter((m) => !done.includes(m.id) && m.done(s))
}
