import { describe, expect, it } from 'vitest'
import {
  acceptOffer, createGame, eligibleEvents, eventChoices, eventTick, resolveEvent, startProject, startTrip, themeAudienceKey, tick,
  tickMany,
} from '../index'
import type { Assistant, ChapterResult, EventId, GameEvent, GameState, Player } from '../index'
import { draw, hashString } from '../rng'
import { DRAFT } from '../../test/fixtures'

const KIDS_OFFER = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const

function withPlayer(s: GameState, patch: Partial<Player>): GameState {
  return { ...s, player: { ...s.player, ...patch } }
}

/** `event` pending on the desk, landed today with the usual seven days to answer. */
function withEvent(s: GameState, id: EventId, extra: Partial<GameEvent> = {}): GameState {
  return { ...s, event: { id, day: s.day, expiresDay: s.day + 7, ...extra } }
}

/** Seed 1's first candidate on the payroll at `salary` a week (art, story and stamina as generated). */
function withAssistant(s: GameState, salary: number): { s: GameState; a: Assistant } {
  const a: Assistant = { ...s.candidates[0], salary }
  return { s: { ...s, assistants: [a] }, a }
}

/** A Kids Comic Go! serial that has sold `totalCopies` over `volumes` volumes. */
function withSoldSerial(totalCopies: number, volumes: number): GameState {
  const s = acceptOffer({ ...createGame('Rin', 1), pendingOffer: KIDS_OFFER })
  return { ...s, serial: { ...s.serial!, totalCopies, volumes } }
}

/** The first event seed from 1 up whose two draws are a hit (first < 0.35) and pick pool slot `slot` of `size`. */
function eventSeedPicking(slot: number, size: number): number {
  for (let seed = 1; seed < 100_000; seed++) {
    const [hit, pick] = draw(seed, 2).values
    if (hit < 0.35 && Math.floor(pick * size) === slot) return seed
  }
  throw new Error('no such seed')
}

describe('random events: the roll', () => {
  it('starts a career with no event and the first roll no earlier than day 28', () => {
    const s = createGame('Rin', 1)
    expect(s.event).toBeNull()
    expect(s.nextEventDay).toBe(28)
    // seed 1 is world 7919; FNV-1a of "events:7919" is 2653888552, which is -1641078744 as a signed 32-bit int
    expect(s.eventSeed).toBe(-1641078744)
  })

  it('rolls nothing before day 28, whatever the seed', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const start = createGame('Rin', seed)
      const s = tickMany(start, 27)
      expect(s.event).toBeNull()
      expect(s.eventSeed).toBe(start.eventSeed)
    }
  })

  it('rolls only on days where day % 7 is 3', () => {
    let s: GameState = { ...createGame('Rin', 1), nextEventDay: 0 }
    const rolled: number[] = []
    for (let i = 0; i < 60; i++) {
      // clear any event and the gap after it, so every eligible day rolls
      const before: GameState = { ...s, event: null, nextEventDay: 0 }
      s = tick(before)
      if (s.eventSeed !== before.eventSeed) rolled.push(s.day)
    }
    expect(rolled).toEqual([3, 10, 17, 24, 31, 38, 45, 52, 59])
  })

  it('skips the roll while away on a trip or while an event is waiting', () => {
    const base: GameState = { ...createGame('Rin', 1), day: 30, nextEventDay: 0 }
    // Library: three days away, so day 31 (a roll day) passes on the trip
    const away = tick(startTrip(base, 'library'))
    expect(away.day).toBe(31)
    expect(away.eventSeed).toBe(base.eventSeed)
    expect(away.event).toBeNull()
    const waiting = tick(withEvent(base, 'cold'))
    expect(waiting.eventSeed).toBe(base.eventSeed)
    expect(waiting.event).toEqual({ id: 'cold', day: 30, expiresDay: 37 })
  })

  it('never touches the main RNG stream: 60 days with or without events end on the same seed, stamina and money', () => {
    const start = startProject(createGame('Rin', 7), DRAFT)
    const withEvents = tickMany({ ...start, nextEventDay: 0 }, 60)
    const without = tickMany({ ...start, nextEventDay: 1e9 }, 60)
    expect(withEvents.log.some((e) => e.kind === 'event')).toBe(true)
    expect(without.log.some((e) => e.kind === 'event')).toBe(false)
    expect(withEvents.seed).toBe(without.seed)
    expect(withEvents.player.stamina).toBe(without.player.stamina)
    expect(withEvents.player.money).toBe(without.player.money)
  })

  it('lands on day 31 for the first seed in 1..50 that hits: it expires on day 38 and the next roll waits for day 45', () => {
    let landed: GameState | null = null
    for (let seed = 1; seed <= 50 && !landed; seed++) {
      const start = createGame('Rin', seed)
      const s = tickMany(start, 31)
      if (s.event) landed = s
      else {
        // a miss moves the event seed and nothing else about events
        expect(s.eventSeed).not.toBe(start.eventSeed)
        expect(s.nextEventDay).toBe(28)
      }
    }
    expect(landed).not.toBeNull()
    // a fresh career has no fans, assistants, volumes or levels yet: a cold is the only event it can get
    expect(landed!.event).toEqual({ id: 'cold', day: 31, expiresDay: 38 })
    expect(landed!.nextEventDay).toBe(45)
    expect(landed!.log.at(-1)).toMatchObject({
      day: 31, kind: 'event', toast: true, text: 'You caught a cold. Answer on your desk within 7 days.',
    })
  })

  it('lands an event when the first draw is under 0.35, and only then', () => {
    const firstDrawIn = (lo: number, hi: number) => {
      let seed = 1
      while (!(draw(seed, 1).values[0] >= lo && draw(seed, 1).values[0] < hi)) seed++
      return seed
    }
    const base: GameState = { ...createGame('Rin', 1), day: 30, nextEventDay: 0 }
    const hit = tick({ ...base, eventSeed: firstDrawIn(0.3, 0.35) })
    expect(hit.event).toMatchObject({ id: 'cold', day: 31 })
    const miss = tick({ ...base, eventSeed: firstDrawIn(0.35, 0.4) })
    expect(miss.event).toBeNull()
    expect(miss.nextEventDay).toBe(0)
    // both draws are taken either way
    expect(miss.eventSeed).toBe(draw(firstDrawIn(0.35, 0.4), 2).seed)
  })

  it('picks from the eligible pool in EVENT_IDS order, the six new events appended after the first six', () => {
    // 1,000 fans, ¥3,000, level 3, an assistant, a Kids Comic Go! serial with a volume (the rival starts in Kids): the
    // six original events plus signing (a volume), assistant-sick (an assistant) and rival-challenge (the rival's
    // magazine); interview (2,000 fans), editor-dinner (a relationship of 3) and cover (4 results) are not eligible.
    // The pool grew from 6 to 9, so each slot is now picked by the first seed whose second draw lands in slot / 9.
    const { s: staffed } = withAssistant(withSoldSerial(12_000, 3), 400)
    const all: GameState = { ...withPlayer(staffed, { fans: 1000, level: 3 }), day: 30, nextEventDay: 0 }
    const order: EventId[] = [
      'letter', 'cold', 'convention', 'raise', 'reprint', 'workshop', 'signing', 'assistant-sick', 'rival-challenge',
    ]
    expect(eligibleEvents(all)).toEqual(order)
    order.forEach((id, slot) => {
      const s = tick({ ...all, eventSeed: eventSeedPicking(slot, 9) })
      expect(s.event?.id).toBe(id)
    })
    const s = tick({ ...all, eventSeed: eventSeedPicking(3, 9) })
    expect(s.event).toEqual({ id: 'raise', day: 31, expiresDay: 38, assistantId: all.assistants[0].id })
    const r = tick({ ...all, eventSeed: eventSeedPicking(4, 9) })
    expect(r.event).toEqual({ id: 'reprint', day: 31, expiresDay: 38, serialId: all.serial!.id })
    const g = tick({ ...all, eventSeed: eventSeedPicking(6, 9) })
    expect(g.event).toEqual({ id: 'signing', day: 31, expiresDay: 38, serialId: all.serial!.id })
    const k = tick({ ...all, eventSeed: eventSeedPicking(7, 9) })
    expect(k.event).toEqual({ id: 'assistant-sick', day: 31, expiresDay: 38, assistantId: all.assistants[0].id })
    const c = tick({ ...all, eventSeed: eventSeedPicking(8, 9) })
    expect(c.event).toEqual({ id: 'rival-challenge', day: 31, expiresDay: 38, serialId: all.serial!.id })
  })
})

describe('random events: who can get what', () => {
  it('always offers a cold, and a fan letter from 300 fans', () => {
    const s = createGame('Rin', 1)
    expect(eligibleEvents(s)).toEqual(['cold'])
    expect(eligibleEvents(withPlayer(s, { fans: 299 }))).toEqual(['cold'])
    expect(eligibleEvents(withPlayer(s, { fans: 300 }))).toEqual(['letter', 'cold'])
  })

  it('offers a convention from 1,000 fans with ¥500 in the bank', () => {
    const s = createGame('Rin', 1)
    expect(eligibleEvents(withPlayer(s, { fans: 1000, money: 500 }))).toEqual(['letter', 'cold', 'convention'])
    expect(eligibleEvents(withPlayer(s, { fans: 999, money: 500 }))).toEqual(['letter', 'cold'])
    expect(eligibleEvents(withPlayer(s, { fans: 1000, money: 499 }))).toEqual(['letter', 'cold'])
  })

  it('offers a raise while an assistant has not asked yet', () => {
    const { s, a } = withAssistant(createGame('Rin', 1), 400)
    // any assistant can fall ill, so assistant-sick joins the pool with the raise
    expect(eligibleEvents(s)).toEqual(['cold', 'raise', 'assistant-sick'])
    expect(eligibleEvents({ ...s, assistants: [{ ...a, raised: true }] })).toEqual(['cold', 'assistant-sick'])
  })

  it('offers a reprint once a serial, running or archived, has shipped a volume', () => {
    // the Kids serial runs in the rival's magazine, so rival-challenge is eligible while it runs; a signing wants a
    // volume just like the reprint
    expect(eligibleEvents(withSoldSerial(0, 0))).toEqual(['cold', 'rival-challenge'])
    const running = withSoldSerial(4000, 1)
    expect(eligibleEvents(running)).toEqual(['cold', 'reprint', 'signing', 'rival-challenge'])
    const archived: GameState = { ...running, serial: null, serials: [{ ...running.serial!, status: 'ended' }] }
    expect(eligibleEvents(archived)).toEqual(['cold', 'reprint', 'signing'])
  })

  it('offers a masterclass from level 3 with ¥400 in the bank', () => {
    const s = createGame('Rin', 1)
    expect(eligibleEvents(withPlayer(s, { level: 3, money: 400 }))).toEqual(['cold', 'workshop'])
    expect(eligibleEvents(withPlayer(s, { level: 2, money: 400 }))).toEqual(['cold'])
    expect(eligibleEvents(withPlayer(s, { level: 3, money: 399 }))).toEqual(['cold'])
  })
})

describe('random events: answers', () => {
  it('fan letter: writing back costs 5 stamina for 2% of fans, at least 50 and at most 1,500', () => {
    const at = (fans: number) => resolveEvent(withEvent(withPlayer(createGame('Rin', 1), { fans }), 'letter'), 'a')
    expect(at(10_000).player).toMatchObject({ fans: 10_200, stamina: 95 })
    expect(at(300).player.fans).toBe(350)
    expect(at(100_000).player.fans).toBe(101_500)
    expect(at(10_000).event).toBeNull()
    expect(at(10_000).log.at(-1)).toMatchObject({ kind: 'event', toast: true, text: 'You wrote back. Fans +200, stamina -5.' })
  })

  it('fan letter: keeping it restores 8 stamina, never past the maximum', () => {
    const keep = (stamina: number) =>
      resolveEvent(withEvent(withPlayer(createGame('Rin', 1), { fans: 500, stamina }), 'letter'), 'b').player
    expect(keep(50)).toMatchObject({ stamina: 58, fans: 500 })
    expect(keep(96).stamina).toBe(100)
  })

  it('cold: the doctor costs ¥300 for 25 stamina; tea is free for 8', () => {
    const sick = withEvent(withPlayer(createGame('Rin', 1), { stamina: 40, money: 1000 }), 'cold')
    expect(resolveEvent(sick, 'a').player).toMatchObject({ money: 700, stamina: 65 })
    expect(resolveEvent(sick, 'b').player).toMatchObject({ money: 1000, stamina: 48 })
    expect(resolveEvent(withPlayer(sick, { stamina: 90 }), 'a').player.stamina).toBe(100)
  })

  it('cold: the doctor is not offered without ¥300, so money never goes below zero', () => {
    const broke = withEvent(withPlayer(createGame('Rin', 1), { stamina: 40, money: 299 }), 'cold')
    expect(eventChoices(broke)!.a.blocked).toBe('Need ¥1 more.')
    expect(resolveEvent(broke, 'a')).toBe(broke)
    expect(eventChoices(withPlayer(broke, { money: 300 }))!.a.blocked).toBeNull()
  })

  it('convention: a two-day trip for ¥500 that brings 150 fans plus 4% of fans, at most 5,000', () => {
    const invited = withEvent(withPlayer(createGame('Rin', 1), { fans: 10_000, money: 3000 }), 'convention')
    const booked = resolveEvent(invited, 'a')
    expect(booked.event).toBeNull()
    expect(booked.player.money).toBe(2500)
    expect(booked.trip).toEqual({ placeId: 'convention', startedDay: 0, endsDay: 2 })
    expect(booked.activity).toBe('rest')
    const back = tickMany(booked, 2)
    expect(back.trip).toBeNull()
    expect(back.player.fans).toBe(10_550)
    expect(back.log.at(-1)!.text).toBe('Back from the Comic Convention. Fans +550.')
    // 150 + 4% of 200,000 = 8,150, capped at 5,000
    const big = tickMany(resolveEvent(withPlayer(invited, { fans: 200_000 }), 'a'), 2)
    expect(big.player.fans).toBe(205_000)
  })

  it('convention: skipping it changes nothing but the event', () => {
    const invited = withEvent(withPlayer(createGame('Rin', 1), { fans: 10_000, money: 3000 }), 'convention')
    const skipped = resolveEvent(invited, 'b')
    expect(skipped.event).toBeNull()
    expect(skipped.player).toEqual(invited.player)
    expect(skipped.trip).toBeNull()
  })

  it('raise: salary 400 becomes 480 and art and story go up 3; refusing costs 10 max stamina', () => {
    const { s, a } = withAssistant(createGame('Rin', 1), 400)
    const asked = withEvent(s, 'raise', { assistantId: a.id })
    const given = resolveEvent(asked, 'a').assistants[0]
    expect(given).toMatchObject({ salary: 480, art: a.art + 3, story: a.story + 3, maxStamina: 80, raised: true })
    const refused = resolveEvent(asked, 'b').assistants[0]
    // stamina 80 of 80 becomes 70 of 70
    expect(refused).toMatchObject({ salary: 400, art: a.art, story: a.story, maxStamina: 70, stamina: 70, raised: true })
    // 415 x 1.2 = 498, rounded to the nearest ¥10: 500
    const odd = withAssistant(createGame('Rin', 1), 415)
    expect(resolveEvent(withEvent(odd.s, 'raise', { assistantId: odd.a.id }), 'a').assistants[0].salary).toBe(500)
  })

  it('raise: an assistant who left before the answer takes the event with them', () => {
    const { s, a } = withAssistant(createGame('Rin', 1), 400)
    const gone: GameState = { ...withEvent(s, 'raise', { assistantId: a.id }), assistants: [] }
    expect(eventChoices(gone)).toBeNull()
    expect(resolveEvent(gone, 'a')).toBe(gone)
  })

  it('reprint: 12,000 copies over 3 volumes pays ¥2,000, or ¥3,200 and 12 stamina with a colour page', () => {
    const asked = (s: GameState) => withEvent(withPlayer(s, { money: 1000, stamina: 50 }), 'reprint', { serialId: s.serial!.id })
    const s = asked(withSoldSerial(12_000, 3))
    expect(resolveEvent(s, 'a').player).toMatchObject({ money: 3000, stamina: 50 })
    expect(resolveEvent(s, 'b').player).toMatchObject({ money: 4200, stamina: 38 })
    // a serial wrapped up (archived) before the answer still gets its reprint
    const archived: GameState = { ...s, serial: null, serials: [{ ...s.serial!, status: 'ended' }] }
    expect(resolveEvent(archived, 'a').player.money).toBe(3000)
    // a serial that is not on record at all takes the event with it
    const unknown = withEvent(s, 'reprint', { serialId: 999 })
    expect(eventChoices(unknown)).toBeNull()
    expect(resolveEvent(unknown, 'a')).toBe(unknown)
  })

  it('workshop: a three-day masterclass for ¥400 that adds 3 to the lowest stat', () => {
    // starting stats: story 34, art 40, pacing 30
    const invited = withEvent(withPlayer(createGame('Rin', 1), { level: 3, money: 1000 }), 'workshop')
    const booked = resolveEvent(invited, 'a')
    expect(booked.player.money).toBe(600)
    expect(booked.trip).toEqual({ placeId: 'masterclass', startedDay: 0, endsDay: 3 })
    const back = tickMany(booked, 3)
    expect(back.player.stats).toEqual({ story: 34, art: 40, pacing: 33 })
    expect(back.log.at(-1)!.text).toBe('Back from the Manga Masterclass. Pacing +3.')
    expect(resolveEvent(invited, 'b').player).toEqual(invited.player)
  })

  it('workshop: ties for the lowest stat go to art, then story, then pacing', () => {
    const attend = (stats: Player['stats']) =>
      tickMany(resolveEvent(withEvent(withPlayer(createGame('Rin', 1), { level: 3, stats }), 'workshop'), 'a'), 3)
        .player.stats
    expect(attend({ story: 30, art: 30, pacing: 30 })).toEqual({ story: 30, art: 33, pacing: 30 })
    expect(attend({ story: 30, art: 35, pacing: 30 })).toEqual({ story: 33, art: 35, pacing: 30 })
  })

  it('offers no trip while already away, and ignores an answer with no event waiting', () => {
    const invited = withEvent(withPlayer(createGame('Rin', 1), { fans: 10_000, money: 3000 }), 'convention')
    const away = startTrip(invited, 'library')
    expect(eventChoices(away)!.a.blocked).toBe('You are away. Answer when you are back.')
    expect(resolveEvent(away, 'a')).toBe(away)
    // answers that are not trips still work from the road
    expect(resolveEvent(away, 'b').event).toBeNull()
    const none = createGame('Rin', 1)
    expect(resolveEvent(none, 'a')).toBe(none)
  })
})

describe('random events: ignoring one', () => {
  it('lapses the day after it expires, changing only the event and the log', () => {
    const s: GameState = { ...createGame('Rin', 1), day: 39, nextEventDay: 45, event: { id: 'cold', day: 31, expiresDay: 38 } }
    const after = eventTick(s)
    expect(after.event).toBeNull()
    expect(after.log.at(-1)).toMatchObject({
      day: 39, kind: 'event', toast: false, text: 'The cold passed on its own. Nothing changed.',
    })
    expect({ ...after, event: s.event, log: s.log, nextLogId: s.nextLogId }).toEqual(s)
    // on the expiry day itself it can still be answered
    expect(eventTick({ ...s, day: 38 }).event).toEqual(s.event)
  })

  it('lapses through the daily tick, trip or not', () => {
    const s: GameState = { ...createGame('Rin', 1), day: 38, nextEventDay: 45, event: { id: 'letter', day: 31, expiresDay: 38 } }
    expect(tick(s).event).toBeNull()
    expect(tick(startTrip(s, 'library')).event).toBeNull()
  })

  it('lapses the same day when what it was about is gone, so it never holds up the next roll unseen', () => {
    // A raise asked on day 31 (answerable to day 38) by an assistant who has since left: no card can show it.
    const { s: staffed, a } = withAssistant(createGame('Rin', 1), 400)
    const gone: GameState = {
      ...withEvent({ ...staffed, day: 32, nextEventDay: 45 }, 'raise', { day: 31, expiresDay: 38, assistantId: a.id }),
      assistants: [],
    }
    const after = eventTick(gone)
    expect(after.event).toBeNull()
    expect(after.log.at(-1)).toMatchObject({
      day: 32, kind: 'event', toast: false, text: 'Your assistant stopped asking about the raise. Nothing changed.',
    })
    // day 32 is not a roll day (32 % 7 = 4): nothing is drawn, only the event and the log change
    expect({ ...after, event: gone.event, log: gone.log, nextLogId: gone.nextLogId }).toEqual(gone)
    // a reprint for a serial that is not on record goes the same way
    const reprint = withEvent({ ...createGame('Rin', 1), day: 32 }, 'reprint', { serialId: 999 })
    expect(eventTick(reprint).log.at(-1)!.text).toBe('The reprint offer lapsed. Nothing changed.')
  })

  it('a roll day with such an event cleared rolls as usual', () => {
    // Day 38 is a roll day (38 % 7 = 3) past nextEventDay 0: with the stale raise cleared, the two draws are taken.
    const { s: staffed, a } = withAssistant(createGame('Rin', 1), 400)
    const gone: GameState = {
      ...withEvent({ ...staffed, day: 38, nextEventDay: 0 }, 'raise', { day: 31, expiresDay: 45, assistantId: a.id }),
      assistants: [],
    }
    const after = eventTick(gone)
    expect(after.eventSeed).toBe(draw(gone.eventSeed, 2).seed)
    // a raise whose assistant is still on the payroll keeps waiting, and blocks the roll as before
    const kept = eventTick({ ...gone, assistants: staffed.assistants })
    expect(kept.event).toEqual(gone.event)
    expect(kept.eventSeed).toBe(gone.eventSeed)
  })
})

/** A chapter result at `rank` of 11, the rival (when given) at `rivalRank`. */
function fakeResult(chapter: number, rank: number, rivalRank?: number): ChapterResult {
  return {
    chapter, day: chapter, score: 60, rank, entrants: 11,
    breakdown: { art: 60, story: 60, pacing: 60, audienceFit: 60, freshness: 60 },
    rewards: { money: 0, fans: 0, xp: 0 },
    ...(rivalRank ? { rival: { name: 'Iori Hayama', score: 60, rank: rivalRank } } : {}),
  }
}

/** The serial on the desk with `n` results in. */
function withResults(s: GameState, n: number): GameState {
  const results = Array.from({ length: n }, (_, i) => fakeResult(i + 1, 5))
  return { ...s, serial: { ...s.serial!, results } }
}

describe('random events: the six new ones', () => {
  it('interview: eligible from 2,000 fans with a magazine to talk to (the running serial, else the last one-shot)', () => {
    const serial = withSoldSerial(0, 0)
    expect(eligibleEvents(withPlayer(serial, { fans: 2000 }))).toContain('interview')
    expect(eligibleEvents(withPlayer(serial, { fans: 1999 }))).not.toContain('interview')
    // no serial and no one-shot yet: nobody to run the interview
    expect(eligibleEvents(withPlayer(createGame('Rin', 1), { fans: 5000 }))).not.toContain('interview')
    // pool: letter, cold, convention, interview, rival-challenge (5): slot 3 of 5 is the interview
    const r = tick({ ...withPlayer(serial, { fans: 2000 }), day: 30, nextEventDay: 0, eventSeed: eventSeedPicking(3, 5) })
    expect(r.event).toEqual({ id: 'interview', day: 31, expiresDay: 38, magazineId: 'kids-comic' })
  })

  it('interview: on camera costs 6 stamina for 1% of fans (30 to 800); the written reply is +1 with the editor', () => {
    const base = withEvent(withPlayer(withSoldSerial(0, 0), { fans: 5000 }), 'interview', { magazineId: 'kids-comic' })
    expect(eventChoices(base)!.a.label).toBe('On camera: stamina -6, fans +50 (1% of fans, 30 to 800)')
    expect(eventChoices(base)!.b.label).toBe("Written reply: Mori's relationship +1 (a tip every 3 points)")
    const a = resolveEvent(base, 'a')
    expect(a.player).toMatchObject({ fans: 5050, stamina: 94 })
    expect(resolveEvent(withPlayer(base, { fans: 2000 }), 'a').player.fans).toBe(2030)
    expect(resolveEvent(withPlayer(base, { fans: 200_000 }), 'a').player.fans).toBe(200_800)
    const b = resolveEvent(base, 'b')
    expect(b.editors['kids-comic'].relationship).toBe(1)
    expect(b.player.fans).toBe(5000)
    expect(b.seed).toBe(base.seed)
  })

  it('interview reply that earns a tip reveals the first unknown pairing for those readers, drawing no RNG', () => {
    const s0 = withEvent(withPlayer(withSoldSerial(0, 0), { fans: 5000 }), 'interview', { magazineId: 'kids-comic' })
    const s = { ...s0, editors: { ...s0.editors, 'kids-comic': { relationship: 2, tips: 0 } } }
    const b = resolveEvent(s, 'b')
    expect(b.editors['kids-comic']).toEqual({ relationship: 3, tips: 1 })
    // School is the first theme and nothing is known about kids yet
    expect(b.notebook.themeAudience[themeAudienceKey('school', 'kids')]).toBeDefined()
    expect(b.seed).toBe(s.seed)
  })

  it('signing: eligible with a volume out; a 1-day trip that pays round(average copies x 0.2) x ¥2 on return', () => {
    expect(eligibleEvents(withSoldSerial(12_000, 3))).toContain('signing')
    expect(eligibleEvents(withSoldSerial(0, 0))).not.toContain('signing')
    const sold = withSoldSerial(12_000, 3)
    const ev = withEvent({ ...sold, day: 30 }, 'signing', { serialId: sold.serial!.id })
    // 12,000 / 3 = 4,000 a volume; x 0.2 = 800 copies; x ¥2 = ¥1,600
    expect(eventChoices(ev)!.a.label).toBe('Sign for a day: 1-day trip, +¥1,600 on return')
    const away = resolveEvent(ev, 'a')
    expect(away.trip).toEqual({ placeId: 'signing', startedDay: 30, endsDay: 31 })
    expect(away.player.money).toBe(ev.player.money)
    const back = tick(away)
    expect(back.trip).toBeNull()
    expect(back.player.money).toBe(ev.player.money + 1600)
    expect(back.log.some((e) => e.text === 'Back from the Book Signing. Signed copies of "Magic Club": +¥1,600.')).toBe(true)
    expect(resolveEvent(ev, 'b').trip).toBeNull()
  })

  it('editor dinner: an editor at relationship 3 or more; ¥300 for +1, blocked without the money', () => {
    const s = createGame('Rin', 1)
    expect(eligibleEvents(s)).not.toContain('editor-dinner')
    const friendly = { ...s, editors: { ...s.editors, 'monthly-petal': { relationship: 3, tips: 1 } } }
    expect(eligibleEvents(friendly)).toContain('editor-dinner')
    const ev = withEvent(friendly, 'editor-dinner', { magazineId: 'monthly-petal' })
    expect(eventChoices(ev)!.a.label).toBe("Go: -¥300, Sato's relationship +1 (a tip every 2 points)")
    const a = resolveEvent(ev, 'a')
    // 4 is a multiple of Sato's 2: a tip lands too
    expect(a.editors['monthly-petal']).toEqual({ relationship: 4, tips: 2 })
    expect(a.player.money).toBe(ev.player.money - 300)
    const b = resolveEvent(ev, 'b')
    expect(b.editors['monthly-petal'].relationship).toBe(3)
    const broke = withPlayer(ev, { money: 299 })
    expect(eventChoices(broke)!.a.blocked).toBe('Need ¥1 more.')
    expect(resolveEvent(broke, 'a')).toBe(broke)
  })

  it('cover: a running serial with 4 results; 15 stamina for popularity +3 (at most 100)', () => {
    expect(eligibleEvents(withResults(withSoldSerial(0, 0), 3))).not.toContain('cover')
    const four = withResults(withSoldSerial(0, 0), 4)
    expect(eligibleEvents(four)).toContain('cover')
    const ev = withEvent({ ...four, serial: { ...four.serial!, popularity: 60 } }, 'cover', { serialId: four.serial!.id })
    const a = resolveEvent(ev, 'a')
    expect(a.serial!.popularity).toBe(63)
    expect(a.player.stamina).toBe(85)
    const top = withEvent({ ...four, serial: { ...four.serial!, popularity: 99 } }, 'cover', { serialId: four.serial!.id })
    expect(resolveEvent(top, 'a').serial!.popularity).toBe(100)
    expect(resolveEvent(ev, 'b').serial!.popularity).toBe(60)
  })

  it('assistant sick: half a week of salary for full stamina, or max stamina -5', () => {
    const { s, a } = withAssistant(createGame('Rin', 1), 450)
    const tired = { ...s, assistants: [{ ...a, stamina: 20 }] }
    const ev = withEvent(tired, 'assistant-sick', { assistantId: a.id })
    expect(eventChoices(ev)!.a.label).toBe(`Paid rest: -¥225 (half a week's salary), ${a.name}'s stamina full`)
    const paid = resolveEvent(ev, 'a')
    expect(paid.player.money).toBe(ev.player.money - 225)
    expect(paid.assistants[0].stamina).toBe(a.maxStamina)
    const worked = resolveEvent(ev, 'b')
    expect(worked.assistants[0].maxStamina).toBe(a.maxStamina - 5)
    expect(worked.player.money).toBe(ev.player.money)
    // the assistant left: no card, so it lapses
    expect(eventChoices({ ...ev, assistants: [] })).toBeNull()
    // max stamina never goes below 40
    const worn = withEvent({ ...s, assistants: [{ ...a, maxStamina: 43, stamina: 43 }] }, 'assistant-sick', { assistantId: a.id })
    expect(eventChoices(worn)!.b.label).toBe(`Keep them working: ${a.name}'s max stamina -5 (never below 40)`)
    expect(resolveEvent(worn, 'b').assistants[0]).toMatchObject({ maxStamina: 40, stamina: 40 })
    const floor = withEvent({ ...s, assistants: [{ ...a, maxStamina: 40 }] }, 'assistant-sick', { assistantId: a.id })
    expect(resolveEvent(floor, 'b').assistants[0].maxStamina).toBe(40)
  })

  it('assistant sick: the one who falls ill is a hash of the roll day and event seed, with no extra draw', () => {
    const base = createGame('Rin', 1)
    const staff = base.candidates.slice(0, 3).map((c, i) => ({ ...c, id: 100 + i, raised: true }))
    const s: GameState = { ...base, assistants: staff, day: 30, nextEventDay: 0 }
    const picked = new Set<number>()
    for (let seed = 1; seed < 400 && picked.size < 3; seed++) {
      const out = tick({ ...s, eventSeed: seed })
      if (out.event?.id !== 'assistant-sick') continue
      // the roll takes its two draws and nothing more
      expect(out.eventSeed).toBe(draw(seed, 2).seed)
      const want = staff[hashString(`sick:31:${out.eventSeed}`) % 3].id
      expect(out.event.assistantId).toBe(want)
      picked.add(want)
    }
    expect(picked.size).toBeGreaterThan(1)
  })

  it("rival challenge: only for a running serial in the rival's magazine; accepting stores the serial and result count", () => {
    const kids = withResults(withSoldSerial(0, 0), 2)
    expect(eligibleEvents(kids)).toContain('rival-challenge')
    const elsewhere = { ...kids, rival: { ...kids.rival, magazineId: 'weekly-bolt' as const } }
    expect(eligibleEvents(elsewhere)).not.toContain('rival-challenge')
    const ev = withEvent(kids, 'rival-challenge', { serialId: kids.serial!.id })
    const a = resolveEvent(ev, 'a')
    expect(a.rivalChallenge).toEqual({ serialId: kids.serial!.id, fromResult: 2 })
    // one challenge at a time
    expect(eligibleEvents(a)).not.toContain('rival-challenge')
    expect(resolveEvent(ev, 'b').rivalChallenge).toBeNull()
  })

  it('never changes story, art or pacing', () => {
    const { s } = withAssistant(withResults(withSoldSerial(12_000, 3), 4), 400)
    const rich = withPlayer({ ...s, editors: { ...s.editors, 'kids-comic': { relationship: 3, tips: 1 } } }, { fans: 5000 })
    const extra: [EventId, Partial<GameEvent>][] = [
      ['interview', { magazineId: 'kids-comic' }], ['signing', { serialId: rich.serial!.id }],
      ['editor-dinner', { magazineId: 'kids-comic' }], ['cover', { serialId: rich.serial!.id }],
      ['assistant-sick', { assistantId: rich.assistants[0].id }], ['rival-challenge', { serialId: rich.serial!.id }],
    ]
    for (const [id, x] of extra) {
      for (const k of ['a', 'b'] as const) {
        const out = resolveEvent(withEvent(rich, id, x), k)
        expect(out.event).toBeNull()
        expect(out.player.stats).toEqual(rich.player.stats)
      }
    }
  })
})
