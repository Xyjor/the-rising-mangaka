import { describe, expect, it } from 'vitest'
import { RIVAL_SERIES, acceptOffer, closeYear, createGame } from '../index'
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

  it('gives a save from before studios a studio with a desk for every assistant it has, and no equipment', () => {
    const old = (assistants: number): GameState => {
      const g = createGame('Rin', 42)
      const save = { ...g, assistants: g.candidates.slice(0, assistants) } as Partial<GameState>
      delete save.studio
      return save as GameState
    }
    expect(upgradeSave(old(3)).studio).toEqual({ tier: 'loft', owned: [] })
    expect(upgradeSave(old(2)).studio).toEqual({ tier: 'flat', owned: [] })
    expect(upgradeSave(old(1)).studio).toEqual({ tier: 'apartment', owned: [] })
    expect(upgradeSave(old(0)).studio).toEqual({ tier: 'apartment', owned: [] })
    // a save missing its assistant list too reads the defaulted empty list: the apartment
    const bare = old(0) as Partial<GameState>
    delete bare.assistants
    expect(upgradeSave(bare as GameState).studio).toEqual({ tier: 'apartment', owned: [] })
  })

  it('keeps the studio a newer save already has', () => {
    const studio: GameState['studio'] = { tier: 'flat', owned: ['lamp', 'coffee'] }
    const g = createGame('Rin', 42)
    expect(upgradeSave({ ...g, assistants: g.candidates.slice(0, 3), studio }).studio).toEqual(studio)
  })

  it('gives a save from before anime adaptations no deals, no offer and no series offered one yet', () => {
    const save = { ...runningOnDay30() } as Partial<GameState>
    delete save.anime
    delete save.animeOffer
    delete save.animeOfferedFor
    const up = upgradeSave(save as GameState)
    expect(up.anime).toEqual([])
    expect(up.animeOffer).toBeNull()
    expect(up.animeOfferedFor).toEqual([])
  })

  it('keeps the deals, the offer and the offered series a newer save already has', () => {
    const g = runningOnDay30()
    const anime = [{ studio: 'kumo', serialId: 7, signedDay: 10, airsDay: 52, endsDay: 136, tailEndsDay: 220 }] as const
    const up = upgradeSave({ ...g, anime: [...anime], animeOffer: { serialId: 1, expiresDay: 40 }, animeOfferedFor: [7, 1] })
    expect(up.anime).toEqual(anime)
    expect(up.animeOffer).toEqual({ serialId: 1, expiresDay: 40 })
    expect(up.animeOfferedFor).toEqual([7, 1])
  })

  it('gives a save from before the year end a year start from its current values, no reviews and no awards', () => {
    const old = (day: number): GameState => {
      const g = runningOnDay30()
      const serial = { ...g.serial!, totalCopies: 9000, volumes: 2 }
      const save = {
        ...g, day, player: { ...g.player, money: 12_345, fans: 2100, level: 5 }, serial,
        serials: [{ ...serial, id: 99, status: 'ended', totalCopies: 4000, volumes: 1 }],
      } as Partial<GameState>
      delete save.yearStart
      delete save.yearReviews
      delete save.reviewUnread
      delete save.awards
      return save as GameState
    }
    // day 700 is in year three (700 / 336 = 2.08), which began on day 672; copies 9,000 + 4,000, volumes 2 + 1
    const up = upgradeSave(old(700))
    expect(up.yearStart).toEqual({ day: 672, money: 12_345, fans: 2100, level: 5, copies: 13_000, volumes: 3 })
    expect(up.yearReviews).toEqual([])
    expect(up.reviewUnread).toBeNull()
    expect(up.awards).toEqual([])
    // day 335 is still year one; day 336 is the first day of year two
    expect(upgradeSave(old(335)).yearStart.day).toBe(0)
    expect(upgradeSave(old(336)).yearStart.day).toBe(336)
  })

  it('keeps the year start, reviews, unread review and awards a newer save already has', () => {
    const g = createGame('Rin', 4)
    const yearStart = { day: 336, money: 800, fans: 40, level: 3, copies: 500, volumes: 1 }
    const review = closeYear({ ...g, day: 336 }).yearReviews[0]
    const up = upgradeSave({
      ...g, day: 400, yearStart, yearReviews: [review], reviewUnread: 1, awards: [{ id: 'critics', year: 1 }],
    })
    expect(up.yearStart).toEqual(yearStart)
    expect(up.yearReviews).toEqual([review])
    expect(up.reviewUnread).toBe(1)
    expect(up.awards).toEqual([{ id: 'critics', year: 1 }])
  })

  it('keeps the event, event seed and next roll a newer save already has', () => {
    const event = { id: 'letter', day: 31, expiresDay: 38 } as const
    const up = upgradeSave({ ...createGame('Rin', 4), day: 33, event, eventSeed: 12345, nextEventDay: 45 })
    expect(up).toMatchObject({ event, eventSeed: 12345, nextEventDay: 45 })
  })
})
