import { describe, expect, it } from 'vitest'
import {
  ANIME_STUDIOS, acceptOffer, animeTick, animeVolumeMult, createGame, declineAnime, endSerial, isPayDay, signAnime,
  studioLook, tick, tickMany,
} from '../index'
import type { AnimeDeal, AnimeStudioId, ChapterResult, GameState, LogEntry } from '../index'
import { KIDS_OFFER, noDeadline } from '../../test/fixtures'

/** Seed 1 with a Kids Comic Go! serial (id 1) accepted on `day`, at `popularity` with `totalCopies` sold. */
function hit(day: number, popularity = 70, totalCopies = 37_000): GameState {
  const s = acceptOffer({ ...createGame('Rin', 1), day, pendingOffer: KIDS_OFFER })
  return { ...s, serial: { ...s.serial!, popularity, totalCopies } }
}

/** The offer for `hit(day)`, signed with `studio` the day it landed. */
function signed(studio: AnimeStudioId, day = 100): GameState {
  return signAnime(animeTick(hit(day)), studio)
}

/** Run only the anime hook, one day at a time, up to `lastDay`. */
function animeDays(s: GameState, lastDay: number): GameState {
  let x = s
  while (x.day < lastDay) x = animeTick({ ...x, day: x.day + 1 })
  return x
}

function last(s: GameState): Pick<LogEntry, 'kind' | 'text' | 'toast'> {
  const e = s.log.at(-1)!
  return { kind: e.kind, text: e.text, toast: e.toast }
}

function chapter(n: number): ChapterResult {
  return {
    chapter: n, day: 7 * n, score: 60, rank: 3, entrants: 11,
    breakdown: { art: 60, story: 60, pacing: 30, audienceFit: 60, freshness: 60 },
    rewards: { money: 900, fans: 100, xp: 50 },
  }
}

const KUMO_AT_100: AnimeDeal = { studio: 'kumo', serialId: 1, signedDay: 100, airsDay: 142, endsDay: 226, tailEndsDay: 310 }

describe('anime data', () => {
  it('has the two studios of the brief: fee, weeks to air, weeks on air, weekly pay, volume boost, premiere lift', () => {
    expect(ANIME_STUDIOS.map((a) => [
      a.id, a.name, a.fee, a.airsAfterWeeks, a.runsWeeks, a.weeklyFans, a.weeklyMoney, a.volumeMult, a.tailWeeks,
      a.premierePopularity,
    ])).toEqual([
      ['kumo', 'Studio Kumo', 2000, 6, 12, 400, 500, 1.3, 12, 5],
      ['hoshi', 'Hoshi Animation', 0, 16, 24, 900, 1000, 1.6, 24, 12],
    ])
  })

  it('a new career has no deals, no offer and nothing offered yet', () => {
    const g = createGame('Rin', 1)
    expect(g.anime).toEqual([])
    expect(g.animeOffer).toBeNull()
    expect(g.animeOfferedFor).toEqual([])
  })
})

describe('anime offers', () => {
  it('lands at popularity 70 with 37,000 copies sold, and not a point or a copy short', () => {
    const s = animeTick(hit(100))
    expect(s.animeOffer).toEqual({ serialId: 1, expiresDay: 114 })
    expect(s.animeOfferedFor).toEqual([1])
    expect(last(s)).toEqual({
      kind: 'series', text: 'Two anime studios want to adapt "Magic Club". Answer on your desk within 14 days.', toast: true,
    })
    for (const short of [hit(100, 69), hit(100, 70, 36_999)]) {
      const t = animeTick(short)
      expect(t.animeOffer).toBeNull()
      expect(t.animeOfferedFor).toEqual([])
    }
  })

  it('comes through tick', () => {
    expect(tick(hit(99)).animeOffer).toEqual({ serialId: 1, expiresDay: 114 })
  })

  it('is made once per series: passing on it means no second offer, however popular the series stays', () => {
    const passed = declineAnime(animeTick(hit(100)))
    expect(passed.animeOffer).toBeNull()
    expect(passed.animeOfferedFor).toEqual([1])
    expect(last(passed)).toEqual({
      kind: 'series', text: 'You passed on the anime offer for "Magic Club". Studios ask once per series.', toast: false,
    })
    expect(animeDays(passed, 130).animeOffer).toBeNull()
    const none = hit(100)
    expect(declineAnime(none)).toBe(none)
  })

  it('stands for 14 days, then lapses with a log line and is never made again', () => {
    const s = noDeadline(animeTick(hit(100)))
    const lastDay = tickMany(s, 14)
    expect(lastDay.day).toBe(114)
    expect(lastDay.animeOffer).toEqual({ serialId: 1, expiresDay: 114 })
    const lapsed = tick(lastDay)
    expect(lapsed.animeOffer).toBeNull()
    expect(lapsed.animeOfferedFor).toEqual([1])
    expect(lapsed.log.filter((e) => e.text.includes('anime')).at(-1)).toMatchObject({
      text: 'The anime offer for "Magic Club" lapsed. Studios ask once per series.', toast: false,
    })
    expect(animeDays(lapsed, 140).animeOffer).toBeNull()
  })

  it('is not made for a series that is no longer running', () => {
    const g = hit(100)
    expect(animeTick({ ...g, serial: { ...g.serial!, status: 'ended' } }).animeOffer).toBeNull()
  })

  it('is withdrawn when the series ends: at once when it is wrapped up, in the same tick as a cancellation', () => {
    const s = animeTick(hit(100))
    const withdrawn = 'The anime offer for "Magic Club" was withdrawn: the series is over.'
    const wrapped = endSerial(s)
    expect(wrapped.animeOffer).toBeNull()
    expect(last(wrapped)).toEqual({ kind: 'series', text: withdrawn, toast: false })
    const cancelled: GameState = { ...s, serial: { ...s.serial!, status: 'cancelled' } }
    expect(signAnime(cancelled, 'kumo')).toBe(cancelled)
    // past grace with 2 warnings, chapter 5 due tomorrow and not drawn: the missed issue is the third warning
    const doomed: GameState = {
      ...s,
      serial: {
        ...s.serial!, results: [chapter(1), chapter(2), chapter(3), chapter(4)], chaptersSent: 4, warnings: 2,
        nextDueDay: 101,
      },
    }
    const next = tick(doomed)
    expect(next.serials[0].status).toBe('cancelled')
    expect(next.animeOffer).toBeNull()
    expect(next.animeOfferedFor).toEqual([1])
    expect(next.log.filter((e) => e.text.includes('anime')).at(-1)).toMatchObject({ text: withdrawn, toast: false })
  })

  it('waits until an earlier deal is past its tail, counting a deal not yet on air, and comes the day after', () => {
    // serial 1's Kumo deal airs on day 142 and boosts volumes up to day 310; serial 5 is the hit now running
    const g = hit(300)
    const s: GameState = { ...g, serial: { ...g.serial!, id: 5 }, anime: [KUMO_AT_100], animeOfferedFor: [1] }
    expect(animeTick({ ...s, day: 120 }).animeOffer).toBeNull()
    expect(animeTick({ ...s, day: 310 }).animeOffer).toBeNull()
    expect(animeTick({ ...s, day: 311 }).animeOffer).toEqual({ serialId: 5, expiresDay: 325 })
  })
})

describe('anime deals', () => {
  it('Studio Kumo signed on day 100 pays ¥2,000 at once, airs on day 142, ends on day 226 and boosts to day 310', () => {
    const s = signed('kumo')
    expect(s.anime).toEqual([KUMO_AT_100])
    expect(s.animeOffer).toBeNull()
    expect(s.player.money).toBe(3000 + 2000)
    expect(last(s)).toEqual({
      kind: 'series', text: 'You signed with Studio Kumo: +¥2,000. The "Magic Club" anime airs in 6 weeks.', toast: true,
    })
  })

  it('Hoshi Animation signed on day 100 pays no fee, airs on day 212, ends on day 380 and boosts to day 548', () => {
    const s = signed('hoshi')
    expect(s.anime).toEqual([{ studio: 'hoshi', serialId: 1, signedDay: 100, airsDay: 212, endsDay: 380, tailEndsDay: 548 }])
    expect(s.player.money).toBe(3000)
    expect(last(s)).toEqual({
      kind: 'series', text: 'You signed with Hoshi Animation. The "Magic Club" anime airs in 16 weeks.', toast: true,
    })
  })

  it('needs an offer waiting', () => {
    const g = hit(100)
    expect(signAnime(g, 'kumo')).toBe(g)
  })

  it('Kumo pays +400 fans and ¥500 at the end of each of its 12 weeks: 4,800 fans and ¥6,000 on top of the fee', () => {
    let s = signed('kumo')
    const paydays: number[] = []
    while (s.day < 320) {
      const next = animeTick({ ...s, day: s.day + 1 })
      if (next.player.fans !== s.player.fans) paydays.push(next.day)
      s = next
    }
    // week k's pay lands on day 142 + 7k: 149 up to 226, never on the premiere day itself
    expect(paydays).toEqual([149, 156, 163, 170, 177, 184, 191, 198, 205, 212, 219, 226])
    expect(s.player.fans).toBe(4800)
    expect(s.player.money).toBe(3000 + 2000 + 6000)
  })

  it('isPayDay: Kumo on day 100 pays on days 149 to 226, a week apart, never on the premiere (142) or after the finale', () => {
    const days = [142, 148, 149, 150, 156, 219, 226, 233]
    expect(days.map((d) => isPayDay(KUMO_AT_100, d))).toEqual([false, false, true, false, true, true, true, false])
  })

  it('Hoshi pays +900 fans and ¥1,000 at the end of each of its 24 weeks: 21,600 fans and ¥24,000', () => {
    let s = signed('hoshi')
    const paydays: number[] = []
    while (s.day < 560) {
      const next = animeTick({ ...s, day: s.day + 1 })
      if (next.player.fans !== s.player.fans) paydays.push(next.day)
      s = next
    }
    expect(paydays).toHaveLength(24)
    expect([paydays[0], paydays.at(-1)]).toEqual([219, 380])
    expect(s.player.fans).toBe(21_600)
    expect(s.player.money).toBe(3000 + 24_000)
  })

  it('toasts the premiere and the finale; the weekly pay and the end of the boost are log lines', () => {
    let s = animeDays(signed('kumo'), 142)
    expect(s.serial!.popularity).toBe(75)
    expect(last(s)).toEqual({
      kind: 'series',
      text: 'The "Magic Club" anime premieres today: popularity +5. It brings +400 fans and ¥500 a week for 12 weeks. Volumes sell 1.3x from today.',
      toast: true,
    })
    expect(last(animeDays(signed('hoshi'), 212)).text).toBe(
      'The "Magic Club" anime premieres today: popularity +12. It brings +900 fans and ¥1,000 a week for 24 weeks. Volumes sell 1.6x from today.',
    )
    s = animeDays(s, 149)
    expect(last(s)).toEqual({ kind: 'money', text: 'The "Magic Club" anime, week 1 of 12: +400 fans, +¥500.', toast: false })
    s = animeDays(s, 226)
    expect(s.log.slice(-2).map((e) => [e.text, e.toast])).toEqual([
      ['The "Magic Club" anime, week 12 of 12: +400 fans, +¥500.', false],
      ['The "Magic Club" anime ended after 12 weeks: +4,800 fans and +¥6,000 in all. Volumes sell 1.3x for 12 more weeks.', true],
    ])
    s = animeDays(s, 310)
    expect(last(s).text).toContain('ended after 12 weeks')
    s = animeDays(s, 311)
    expect(last(s)).toEqual({
      kind: 'series', text: 'Volumes of "Magic Club" sell at the normal rate again: the anime boost is over.', toast: false,
    })
  })

  it('lifts popularity at the premiere through tick', () => {
    const s = noDeadline(signed('kumo'))
    expect(tick({ ...s, day: 141 }).serial!.popularity).toBe(75)
  })

  it('lifts popularity at the premiere only while the series runs, and never past 100', () => {
    const dropped = endSerial(signed('kumo'))
    expect(dropped.serial).toBeNull()
    const aired = animeTick({ ...dropped, day: 142 })
    expect(aired.serials[0].popularity).toBe(70)
    expect(last(aired).text).toBe(
      'The "Magic Club" anime premieres today. The series is over, so popularity stays put. It brings +400 fans and ¥500 a week for 12 weeks.',
    )
    // the anime still pays
    expect(animeTick({ ...aired, day: 149 }).player.fans).toBe(dropped.player.fans + 400)

    const s = signed('kumo')
    const at98: GameState = { ...s, day: 141, serial: { ...s.serial!, popularity: 98 } }
    const capped = animeTick({ ...at98, day: 142 })
    expect(capped.serial!.popularity).toBe(100)
    expect(last(capped).text).toBe(
      'The "Magic Club" anime premieres today: popularity +2. It brings +400 fans and ¥500 a week for 12 weeks. Volumes sell 1.3x from today.',
    )
  })

  it('once the series is over, the finale promises no volume boost and the end of the boost goes unlogged', () => {
    const dropped = endSerial(signed('kumo'))
    const finale = animeDays(dropped, 226)
    expect(last(finale)).toEqual({
      kind: 'series', text: 'The "Magic Club" anime ended after 12 weeks: +4,800 fans and +¥6,000 in all.', toast: true,
    })
    expect(animeDays(finale, 320).log).toHaveLength(finale.log.length)
  })
})

describe('anime volume boost', () => {
  it('multiplies copies for the deal\'s serial from the premiere until 12 weeks after the finale, and 1 otherwise', () => {
    const k = signed('kumo')
    const on = (s: GameState, day: number) => animeVolumeMult({ ...s, day }, 1)
    expect(animeVolumeMult(hit(100), 1)).toBe(1)
    expect([on(k, 100), on(k, 141), on(k, 142), on(k, 226), on(k, 310), on(k, 311)]).toEqual([1, 1, 1.3, 1.3, 1.3, 1])
    expect(animeVolumeMult({ ...k, day: 200 }, 2)).toBe(1)
    const h = signed('hoshi')
    expect([on(h, 211), on(h, 212), on(h, 548), on(h, 549)]).toEqual([1, 1.6, 1.6, 1])
  })

  it('a volume shipped while the anime airs sells round(copies x 1.3)', () => {
    // day 150, week 2 on air: chapter 4's result lands tomorrow and ships volume 1
    const g = noDeadline(hit(150))
    const base: GameState = {
      ...g,
      serial: {
        ...g.serial!, results: [chapter(1), chapter(2), chapter(3)], chaptersSent: 4, totalCopies: 0,
        pending: [{ chapter: 4, pages: 16, artQ: 60, storyQ: 60, submittedDay: 144, resultsDay: 151 }],
      },
      anime: [KUMO_AT_100],
      animeOfferedFor: [1],
    }
    // the anime draws nothing from the RNG, so both runs poll chapter 4 the same way
    const plain = tick({ ...base, anime: [] })
    const aired = tick(base)
    // The poll is the one input the RNG decides: chapter 4 places #1 of 11 at score 69. From there by hand:
    // popularity round(70 x 0.65 + 100 x 0.35) = 81; fans 0 + round(120 x 6 x 0.69 x 2) = 994;
    // copies round((120 x 20 + 40 x sqrt(994)) x 0.81) = round((2,400 + 40 x 31.52777) x 0.81)
    // = round(3,661.1106 x 0.81) = round(2,965.4996) = 2,965; with the anime round(2,965 x 1.3) = round(3,854.5) = 3,855.
    expect(plain.serial!.results[3]).toMatchObject({ rank: 1, entrants: 11, score: 69 })
    expect([plain.serial!.popularity, plain.player.fans]).toEqual([81, 994])
    expect(plain.serial!.volumes).toBe(1)
    expect(plain.serial!.totalCopies).toBe(2965)
    expect(aired.serial!.totalCopies).toBe(3855)
    expect(aired.log.find((e) => e.text.startsWith('Volume 1'))!.text)
      .toBe('Volume 1 of "Magic Club" sold 3855 copies (1.3x with the anime): +¥7710.')
    expect(plain.log.find((e) => e.text.startsWith('Volume 1'))!.text)
      .toBe('Volume 1 of "Magic Club" sold 2965 copies: +¥5930.')
  })

  it('the wrap-up volume sells 1.5x times the anime\'s 1.3x once it has premiered: 9,984 copies instead of 7,680', () => {
    // Kids Comic Go! circulation 120: (120 x 20 + 40 x sqrt(10,000)) x 80% = (2,400 + 4,000) x 0.8 = 5,120 copies a
    // volume; the wrap-up sells 5,120 x 1.5 = 7,680, and 7,680 x 1.3 = 9,984 with the anime (x ¥2: 15,360 and 19,968)
    const s0 = signed('kumo')
    // day 200: on air (142 to 226), inside the boost
    const s: GameState = {
      ...s0,
      day: 200,
      player: { ...s0.player, fans: 10_000 },
      serial: {
        ...s0.serial!, popularity: 80, results: [chapter(1), chapter(2), chapter(3), chapter(4)], chaptersSent: 4,
        volumes: 1, totalCopies: 15_000,
      },
    }
    const sold = (x: GameState) => (x.serial ?? x.serials[0]).totalCopies - 15_000
    const plain = endSerial({ ...s, anime: [] })
    const aired = endSerial(s)
    expect(sold(plain)).toBe(7680)
    expect(sold(aired)).toBe(9984)
    expect(aired.player.money - s.player.money).toBe(19_968)
    expect(aired.log.at(-1)!.text).toContain('The final volume sold 9984 copies (1.3x with the anime): +¥19968.')
    // signed but the day before the premiere: no boost yet, deal or not
    const early = endSerial({ ...s, day: 141 })
    expect(sold(early)).toBe(7680)
    expect(early.log.at(-1)!.text).toContain('The final volume sold 7680 copies: +¥15360.')
  })
})

describe('studioLook.animePoster', () => {
  it('is up from the premiere until the volume boost ends', () => {
    const k = signed('kumo')
    const poster = (day: number) => studioLook({ ...k, day }).animePoster
    expect(studioLook(hit(100)).animePoster).toBe(false)
    expect([poster(141), poster(142), poster(226), poster(310), poster(311)]).toEqual([false, true, true, true, false])
  })
})
