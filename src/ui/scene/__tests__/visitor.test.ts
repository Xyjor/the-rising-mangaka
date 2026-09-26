import { describe, expect, it } from 'vitest'
import { createGame, startProject, tickMany } from '../../../sim'
import { DRAFT, KIDS_OFFER, drawUntilReady, withPendingResult } from '../../../test/fixtures'
import { GREETING, PROP_FOR, visitorReasonOf } from '../visitor'

describe('visitorReasonOf', () => {
  const fresh = () => createGame('Rin', 1)

  it('no game and a fresh game: nobody visits', () => {
    expect(visitorReasonOf(null)).toBe('none')
    expect(visitorReasonOf(fresh())).toBe('none')
  })

  it('reads each reason', () => {
    expect(visitorReasonOf(withPendingResult())).toBe('result')
    expect(visitorReasonOf({ ...fresh(), pendingOffer: KIDS_OFFER })).toBe('offer')
    expect(visitorReasonOf(drawUntilReady(startProject(fresh(), DRAFT)))).toBe('ready')
    expect(visitorReasonOf({ ...fresh(), animeOffer: { serialId: 1, expiresDay: 100 } })).toBe('anime')
    expect(visitorReasonOf({ ...fresh(), event: { id: 'letter', day: 1, expiresDay: 8 } })).toBe('event')
  })

  it('a quiet year with ¥50,000 leaves the review on the desk', () => {
    const g = { ...fresh(), nextEventDay: 10_000 }
    const start = { ...g, player: { ...g.player, money: 50_000 }, yearStart: { ...g.yearStart, money: 50_000 } }
    expect(visitorReasonOf(tickMany(start, 336))).toBe('review')
  })

  it('the result outranks an event', () => {
    expect(visitorReasonOf({ ...withPendingResult(), event: { id: 'letter', day: 1, expiresDay: 8 } })).toBe('result')
  })

  it('has a prop and a greeting for every reason', () => {
    expect(Object.keys(PROP_FOR)).toHaveLength(7)
    expect(Object.keys(GREETING)).toHaveLength(7)
    expect(PROP_FOR.result).toBe('envelope')
    expect(GREETING.offer).toBe('I have a contract for you.')
  })
})
