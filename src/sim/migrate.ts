import { EVENT_GAP_DAYS, magazineById } from './data'
import { createGame, describeDate } from './engine'
import { makeRival } from './rival'
import { hashString } from './rng'
import type { GameState, Serial, StudioTierId } from './types'

/**
 * Fill any top-level or player field a saved game predates with the createGame default.
 * New top-level fields with a createGame default need no line here; nested defaults
 * (e.g. a new Serial field) get an explicit line.
 */
export function upgradeSave(g: GameState): GameState {
  const base = createGame('', 0)
  // Chapter deadlines: a serial saved before them owes its next chapter one magazine rhythm from the day of loading.
  const fix = (x: Serial): Serial => ({
    ...x,
    nextDueDay: x.nextDueDay ?? g.day + magazineById(x.magazineId).chapterDays,
    missedIssues: x.missedIssues ?? 0,
  })
  const up: GameState = { ...base, ...g, player: { ...base.player, ...g.player } }
  return {
    ...up,
    serial: up.serial && fix(up.serial),
    serials: up.serials.map(fix),
    // The rival comes from the save's own world seed (never createGame('', 0)'s), grown by the whole years played.
    rival: g.rival ?? makeRival(g.worldSeed, describeDate(g.day).year - 1),
    // Random events: the save's own world's event seed (the one a new career there starts with), the first roll two
    // weeks from the day of loading. `event` defaults to null through the createGame base.
    eventSeed: g.eventSeed ?? (hashString(`events:${g.worldSeed}`) | 0),
    nextEventDay: g.nextEventDay ?? g.day + EVENT_GAP_DAYS,
    // Studios: a save from before them keeps every assistant it has, so it starts in a studio with a desk for each.
    studio: g.studio ?? { tier: studioTierFor(up.assistants.length), owned: [] },
  }
}

function studioTierFor(assistants: number): StudioTierId {
  if (assistants >= 3) return 'loft'
  return assistants === 2 ? 'flat' : 'apartment'
}
