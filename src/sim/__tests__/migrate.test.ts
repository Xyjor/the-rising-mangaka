import { describe, expect, it } from 'vitest'
import { RIVAL_SERIES, acceptOffer, createGame } from '../index'
import type { GameState, Serial } from '../index'
import { upgradeSave } from '../migrate'

const KIDS_OFFER = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const

/** A serial as a save from before chapter deadlines stored it. */
function withoutDeadline(s: Serial): Serial {
  const old = { ...s } as Partial<Serial>
  delete old.nextDueDay
  delete old.missedIssues
  return old as Serial
}

/** Seed 4 on day 30 with a Kids Comic Go! serial running. */
function runningOnDay30(): GameState {
  return acceptOffer({ ...createGame('Rin', 4), day: 30, pendingOffer: KIDS_OFFER })
}

describe('upgradeSave', () => {
  it('an old serial without nextDueDay gets day + chapterDays and missedIssues 0', () => {
    const g = runningOnDay30()
    const archived: Serial = { ...g.serial!, id: 99, magazineId: 'weekly-bolt', status: 'ended', endedDay: 20 }
    const save = { ...g, serial: withoutDeadline(g.serial!), serials: [withoutDeadline(archived)] }
    const up = upgradeSave(save)
    // Kids Comic Go! runs a chapter every 21 days, Weekly Bolt every 14: 30 + 21 and 30 + 14.
    expect(up.serial).toMatchObject({ nextDueDay: 51, missedIssues: 0 })
    expect(up.serials[0]).toMatchObject({ id: 99, nextDueDay: 44, missedIssues: 0 })
  })

  it('keeps the due day and missed issues a newer save already has', () => {
    const g = runningOnDay30()
    const save = { ...g, serial: { ...g.serial!, nextDueDay: 60, missedIssues: 2 } }
    expect(upgradeSave(save).serial).toMatchObject({ nextDueDay: 60, missedIssues: 2 })
  })

  it('leaves a save with no serial as it was', () => {
    const g = createGame('Rin', 4)
    const up = upgradeSave(g)
    expect(up.serial).toBeNull()
    expect(up.serials).toEqual([])
  })

  it('gives a save from before the rival the rival its world would have by now', () => {
    // Seed 4 (world 31676) names Touya Kagami. Day 700 is two whole years in (700 / 336 = 2.08):
    // craft 50 + 2 x 4 = 58, and the highest rival mean at most 56 is Monthly Petal's 52.
    const g = { ...createGame('Rin', 4), day: 700 } as Partial<GameState>
    delete g.rival
    const up = upgradeSave(g as GameState)
    expect(up.rival).toMatchObject({ name: 'Touya Kagami', craft: 58, magazineId: 'monthly-petal' })
    expect(RIVAL_SERIES['monthly-petal']).toContain(up.rival.seriesTitle)
    // day 335 is still year one: the fresh rival
    const young = { ...createGame('Rin', 4), day: 335 } as Partial<GameState>
    delete young.rival
    expect(upgradeSave(young as GameState).rival).toMatchObject({ craft: 50, magazineId: 'kids-comic' })
  })

  it('keeps the rival a newer save already has', () => {
    const rival = { name: 'Mikoto Sakuraba', craft: 71, magazineId: 'weekly-bolt', seriesTitle: 'Thunder Relay' } as const
    expect(upgradeSave({ ...createGame('Rin', 4), day: 700, rival }).rival).toEqual(rival)
  })

  it("gives a save from before random events its own world's event seed, a first roll two weeks out and no event", () => {
    const old = (seed: number): GameState => {
      const g = { ...createGame('Rin', seed), day: 30 } as Partial<GameState>
      delete g.event
      delete g.eventSeed
      delete g.nextEventDay
      return g as GameState
    }
    // seed 4 is world 31676: FNV-1a of "events:31676" is 1148715873, under 2^31 so the same as a signed int
    const up = upgradeSave(old(4))
    expect(up).toMatchObject({ eventSeed: 1148715873, nextEventDay: 44, event: null })
    // the same seed a new career in that world starts with, so the upgraded save rolls the same events
    expect(up.eventSeed).toBe(createGame('Rin', 4).eventSeed)
    // seed 1 is world 7919: FNV-1a of "events:7919" is 2653888552, which is -1641078744 as a signed 32-bit int
    expect(upgradeSave(old(1)).eventSeed).toBe(-1641078744)
  })

  it('keeps the event, event seed and next roll a newer save already has', () => {
    const event = { id: 'letter', day: 31, expiresDay: 38 } as const
    const up = upgradeSave({ ...createGame('Rin', 4), day: 33, event, eventSeed: 12345, nextEventDay: 45 })
    expect(up).toMatchObject({ event, eventSeed: 12345, nextEventDay: 45 })
  })
})
