import { describe, expect, it } from 'vitest'
import {
  acceptOffer, addLog, buyEquipment, createGame, dismissResult, doneIds, getPhase, grantXp, hireAssistant, setActivity,
  startProject, startTrip, submitProject, tick, tickMany,
} from '../../sim'
import type { AnimeDeal, AwardId, ChapterResult, GameState, Serial, YearReview } from '../../sim'
import { DRAFT, KIDS_OFFER, drawUntilReady, withPendingResult } from '../../test/fixtures'
import { cuesForTransition, speedCue } from '../triggers'

const game = () => createGame('Rin', 42)
const cues = cuesForTransition

/** Tick `s` until `until` first holds: the state the tick before, and the state that tick made. */
function stepInto(s: GameState, until: (g: GameState) => boolean): [GameState, GameState] {
  let prev = s
  let next = tick(s)
  for (let guard = 0; !until(next); guard++) {
    if (guard > 400) throw new Error('stepInto: condition never held')
    prev = next
    next = tick(next)
  }
  return [prev, next]
}

const withMoney = (s: GameState, money: number): GameState => ({ ...s, player: { ...s.player, money } })
const nextDay = (s: GameState): GameState => ({ ...s, day: s.day + 1 })

/** A one-shot on the desk with `pages` drawn. */
function withPages(s: GameState, pages: number): GameState {
  return { ...s, project: { ...s.project!, pagesDone: pages } }
}

/** A running Kids Comic Go! serial ("Magic Club"), fresh from acceptOffer: no chapters sent, no results. */
const serialGame = () => acceptOffer({ ...game(), pendingOffer: KIDS_OFFER })

function withSerial(s: GameState, patch: Partial<Serial>): GameState {
  return { ...s, serial: { ...s.serial!, ...patch } }
}

function chapterResult(rank: number, entrants: number): ChapterResult {
  return {
    chapter: 1, day: 0, score: 50, rank, entrants,
    breakdown: { art: 50, story: 50, pacing: 50, audienceFit: 50, freshness: 50 },
    rewards: { money: 0, fans: 0, xp: 0 },
  }
}

function review(awards: AwardId[]): YearReview {
  return {
    year: 1, oneShots: 3, bestOneShot: null, chapters: 0, volumes: 0, copies: 0, bestScore: 60, moneyDelta: 0,
    fansDelta: 0, levelFrom: 1, levelTo: 2, awards, nearMisses: [],
    rival: {
      name: 'Aoi', wins: 0, losses: 0, fromMagazine: 'weekly-bolt', toMagazine: 'weekly-bolt', craftBefore: 57,
      craftAfter: 61, series: 'Iron Tide',
    },
    rivalAward: null,
  }
}

describe('cuesForTransition: the brief table', () => {
  it('plays start when a one-shot begins', () => {
    const prev = game()
    expect(cues(prev, startProject(prev, DRAFT))).toEqual(['start'])
  })

  it('plays the milestone cue for a badge', () => {
    const prev = game()
    const next = { ...prev, badges: [{ id: 'century' as const, day: prev.day }] }
    expect(cues(prev, next)).toEqual(['milestone'])
  })

  it('plays page only when the whole page count goes up', () => {
    const base = startProject(game(), DRAFT)
    expect(cues(withPages(base, 3.9), withPages(base, 4.1))).toEqual(['page'])
    expect(cues(withPages(base, 4.1), withPages(base, 4.9))).toEqual([])
  })

  it('plays ready first on the tick a manuscript is finished, with its milestone', () => {
    const [prev, next] = stepInto(startProject(game(), DRAFT), (g) => getPhase(g) === 'ready')
    expect(getPhase(prev)).toBe('drawing')
    // first-manuscript lands on the same tick; nothing ranks above ready here (no event before day 28, 40 XP < 100)
    expect(cues(prev, next)).toEqual(['ready', 'milestone'])
    // a manuscript left waiting on the desk plays nothing more
    expect(cues(next, nextDay(next))).toEqual([])
  })

  it('plays submit when a manuscript is pitched', () => {
    const prev = drawUntilReady(startProject(game(), DRAFT))
    expect(cues(prev, submitProject(prev, 'weekly-bolt'))).toEqual(['submit'])
  })

  it('stays silent on the tick a poll result lands, milestone and all', () => {
    const submitted = submitProject(drawUntilReady(startProject(game(), DRAFT)), 'weekly-bolt')
    const [prev, next] = stepInto(submitted, (g) => !!g.pendingResult)
    expect(doneIds(next)).toContain('first-poll')
    expect(cues(prev, next)).toEqual([])
  })

  it('plays offer when a result is dismissed and its offer is waiting', () => {
    const prev: GameState = { ...withPendingResult(), pendingOffer: KIDS_OFFER }
    expect(cues(prev, dismissResult(prev))).toEqual(['offer'])
    // nothing while the result is still open
    expect(cues(prev, { ...prev, focus: 'art' })).toEqual([])
  })

  it('plays nothing when a result without an offer is dismissed', () => {
    const prev: GameState = { ...withPendingResult(), pendingOffer: null }
    expect(cues(prev, dismissResult(prev))).toEqual([])
  })

  it('plays serialised when an offer is accepted', () => {
    const prev = dismissResult({ ...withPendingResult(), pendingOffer: KIDS_OFFER })
    expect(cues(prev, acceptOffer(prev))).toEqual(['serialised'])
    // a serial that was already there did not come from the offer
    const running: GameState = { ...serialGame(), pendingOffer: KIDS_OFFER }
    expect(cues(running, nextDay(running))).toEqual([])
  })

  it('plays levelup on reaching level 2', () => {
    const prev = game()
    const next = grantXp(prev, 100)
    expect(next.player.level).toBe(2)
    expect(cues(prev, next)).toEqual(['levelup'])
  })

  it('plays chapter-top, chapter or chapter-weak by the new result\'s rank', () => {
    const prev = serialGame()
    const at = (rank: number) => cues(prev, withSerial(prev, { results: [chapterResult(rank, 12)] }))
    expect(at(1)).toEqual(['chapter-top'])
    expect(at(5)).toEqual(['chapter'])
    expect(at(11)).toEqual(['chapter-weak'])
    // boundaries: podium is rank 3 or better; weak is below ceil(12 x 0.7) = 9
    expect(at(3)).toEqual(['chapter-top'])
    expect(at(4)).toEqual(['chapter'])
    expect(at(9)).toEqual(['chapter'])
    expect(at(10)).toEqual(['chapter-weak'])
  })

  it('stays silent over a two-day jump', () => {
    const prev = startProject(game(), DRAFT)
    expect(cues(prev, tickMany(prev, 2))).toEqual([])
  })

  it('stays silent across different worlds', () => {
    expect(cues(game(), startProject(createGame('Rin', 7), DRAFT))).toEqual([])
  })

  it('plays warn when money drops below zero', () => {
    const g = game()
    expect(cues(withMoney(g, 100), withMoney(g, -50))).toEqual(['warn'])
    expect(cues(withMoney(g, 0), withMoney(g, -1))).toEqual(['warn'])
    expect(cues(withMoney(g, -10), withMoney(g, -50))).toEqual([])
  })

  it('plays hire when an assistant joins', () => {
    const prev = game()
    const cheapest = [...prev.candidates].sort((a, b) => a.salary - b.salary)[0]
    expect(cues(prev, hireAssistant(prev, cheapest.id))).toEqual(['hire'])
  })

  it('plays event when an event arrives', () => {
    const prev = game()
    const next: GameState = { ...prev, event: { id: 'letter', day: prev.day, expiresDay: prev.day + 7 } }
    expect(cues(prev, next)).toEqual(['event'])
    expect(cues(next, nextDay(next))).toEqual([])
  })

  it('plays award first when a closed year brings an award', () => {
    const prev = game()
    const grown = grantXp(nextDay(prev), 100)
    expect(cues(prev, { ...grown, yearReviews: [review(['rookie'])] })).toEqual(['award', 'levelup'])
    expect(cues(prev, { ...grown, yearReviews: [review([])] })).toEqual(['levelup'])
  })

  it('plays coins when equipment is bought', () => {
    const prev = withMoney(game(), 30000)
    const next = buyEquipment(prev, 'coffee')
    expect(next.studio.owned).toEqual(['coffee'])
    expect(cues(prev, next)).toEqual(['coins'])
  })
})

describe('cuesForTransition: the other cues', () => {
  it('plays cancel when the running serial is cancelled', () => {
    const prev = serialGame()
    expect(cues(prev, withSerial(prev, { status: 'cancelled' }))).toEqual(['cancel'])
  })

  it('plays cancel alone when a weak chapter archives a cancelled serial', () => {
    const prev = serialGame()
    const cancelled: Serial = { ...prev.serial!, status: 'cancelled', results: [chapterResult(11, 12)] }
    const next = addLog({ ...prev, serial: null, serials: [cancelled] }, 'warn', 'Cancelled.', true)
    expect(cues(prev, next)).toEqual(['cancel'])
  })

  it('plays cancel alone when a third missed issue cancels the serial, over its warning toasts', () => {
    // Past the 4-chapter grace, resting at the desk: Kids chapter 5 misses days 21, 42 and 63, warnings 1, 2 and 3.
    const g = setActivity(serialGame(), 'rest')
    const r = chapterResult(4, 10)
    const start: GameState = {
      ...g,
      serial: { ...g.serial!, results: [1, 2, 3, 4].map((chapter) => ({ ...r, chapter })), chaptersSent: 4 },
      project: { ...g.project!, chapter: 5 },
      player: { ...g.player, money: 10000 },
    }
    const [prev, next] = stepInto(start, (s) => !s.serial)
    expect(next.day).toBe(63)
    expect(next.serials[0].status).toBe('cancelled')
    // the missed-issue warning and the cancellation both land as warning toasts on this tick
    expect(next.log.filter((e) => e.id >= prev.nextLogId && e.kind === 'warn' && e.toast)).toHaveLength(2)
    expect(cues(prev, next)).toEqual(['cancel'])
  })

  it('does not replay cancel for a serial already archived as cancelled', () => {
    const g = serialGame()
    const archived: GameState = { ...g, serial: null, serials: [{ ...g.serial!, status: 'cancelled' }] }
    expect(cues(archived, nextDay(archived))).toEqual([])
  })

  it('plays offer when an offer arrives with no result, once', () => {
    const prev = game()
    const next: GameState = { ...prev, pendingOffer: KIDS_OFFER }
    expect(cues(prev, next)).toEqual(['offer'])
    expect(cues(next, nextDay(next))).toEqual([])
  })

  it('plays coins when a volume ships', () => {
    const prev = serialGame()
    expect(cues(prev, withSerial(prev, { volumes: 1 }))).toEqual(['coins'])
  })

  it('plays coins on an anime pay day, from the deal\'s days', () => {
    const g = serialGame()
    const deal: AnimeDeal = { studio: 'kumo', serialId: g.serial!.id, signedDay: 0, airsDay: 10, endsDay: 94, tailEndsDay: 178 }
    const on = (day: number, money: number): GameState => ({ ...withMoney(g, money), day, anime: [deal] })
    expect(cues(on(16, 1000), on(17, 1500))).toEqual(['coins'])
    // the premiere, a day that is not a week on air, money falling on a pay day, a same-day change on a pay day, and
    // day 101 (13 weeks after the premiere, past the day-94 finale)
    expect(cues(on(9, 1000), on(10, 1500))).toEqual([])
    expect(cues(on(17, 1000), on(18, 1500))).toEqual([])
    expect(cues(on(16, 1000), on(17, 900))).toEqual([])
    expect(cues(on(17, 1000), on(17, 1500))).toEqual([])
    expect(cues(on(100, 1000), on(101, 1500))).toEqual([])
  })

  it('plays send when a chapter goes to the magazine', () => {
    const prev = serialGame()
    expect(cues(prev, withSerial(prev, { chaptersSent: 1 }))).toEqual(['send'])
  })

  it('plays depart when a trip starts and return when it ends', () => {
    const away = startTrip(game(), 'library')
    expect(cues(game(), away)).toEqual(['depart'])
    const [prev, next] = stepInto(away, (g) => !g.trip)
    expect(cues(prev, next)).toEqual(['return'])
  })

  it('plays warn for a new warning toast only', () => {
    const prev = game()
    const warned = addLog(prev, 'warn', 'Stamina is low.', true)
    expect(cues(prev, warned)).toEqual(['warn'])
    expect(cues(prev, addLog(prev, 'warn', 'Too exhausted for a shift.', false))).toEqual([])
    expect(cues(prev, addLog(prev, 'info', 'Recovered.', true))).toEqual([])
    expect(cues(warned, nextDay(warned))).toEqual([])
  })

  it('plays no page when a new project takes over the desk', () => {
    const base = startProject(game(), DRAFT)
    const next = withPages(base, 4.1)
    expect(cues(withPages(base, 3.9), { ...next, project: { ...next.project!, id: next.project!.id + 1 } })).toEqual([])
  })

  it('keeps the two most important cues, in priority order', () => {
    const prev = withPages(startProject(game(), DRAFT), 3.9)
    const next: GameState = {
      ...withPages(grantXp(prev, 100), 4.1),
      event: { id: 'letter', day: prev.day, expiresDay: prev.day + 7 },
      assistants: [prev.candidates[0]],
    }
    expect(cues(prev, next)).toEqual(['event', 'levelup'])
  })

  it('drops page when anything else plays', () => {
    const prev = withPages(startProject(game(), DRAFT), 3.9)
    expect(cues(prev, { ...withPages(prev, 4.1), assistants: [prev.candidates[0]] })).toEqual(['hire'])
  })

  it('plays nothing when nothing changed', () => {
    const g = startProject(game(), DRAFT)
    expect(cues(g, g)).toEqual([])
  })
})

describe('speedCue', () => {
  it('resumes, pauses, clicks, or stays quiet', () => {
    expect(speedCue(0, 1)).toBe('resume')
    expect(speedCue(2, 0)).toBe('pause')
    expect(speedCue(1, 3)).toBe('click')
    expect(speedCue(2, 2)).toBeNull()
    expect(speedCue(0, 0)).toBeNull()
  })
})
