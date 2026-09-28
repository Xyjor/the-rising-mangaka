// What the studio's story props read from the game (story.ts): pure, the default node environment, fixtures from
// src/test/fixtures.ts, hand-derived literals.
import { describe, expect, it } from 'vitest'
import { acceptOffer, createGame, startProject } from '../../../sim'
import type { GameState } from '../../../sim'
import { DRAFT, KIDS_OFFER, withPendingResult } from '../../../test/fixtures'
import { CORK_CARDS, NO_STORY, corkCards, storyLook } from '../story'

function serialGame(): GameState {
  // a fresh game handed the Kids Comic Go! offer, accepted: the serial runs and its first chapter is on the desk
  const s = acceptOffer({ ...createGame('Rin', 42), pendingOffer: KIDS_OFFER })
  return s
}

describe('corkCards', () => {
  it('pins one card per sixth of the pages drawn, a 2x3 grid, only while a manuscript is on the desk', () => {
    expect(CORK_CARDS).toBe(6)
    expect(corkCards('drawing', 0)).toBe(0)
    expect(corkCards('drawing', 1 / 6)).toBe(1)
    expect(corkCards('drawing', 0.5)).toBe(3)
    expect(corkCards('drawing', 0.99)).toBe(5)
    expect(corkCards('ready', 1)).toBe(6)
    expect(corkCards('idle', 0.5)).toBe(0)
  })
})

describe('storyLook', () => {
  it('is the quiet default without a game', () => {
    expect(storyLook(null)).toEqual(NO_STORY)
    expect(NO_STORY).toEqual({ daysLeft: -1, serialOn: false, posterHue: 0, rankTone: 'none', fanLevel: 0 })
  })

  it('has no deadline, no serial and no rank for a fresh one-shot on the desk', () => {
    const look = storyLook(startProject(createGame('Rin', 42), DRAFT))
    expect(look.daysLeft).toBe(-1)
    expect(look.serialOn).toBe(false)
    expect(look.rankTone).toBe('none')
  })

  it('counts the days left on a running serial\'s chapter and tints the poster by its genre', () => {
    const s = serialGame()
    expect(s.serial?.status).toBe('running')
    const look = storyLook(s)
    expect(look.serialOn).toBe(true)
    expect(look.daysLeft).toBe(s.serial!.nextDueDay - s.day)
    // fantasy is not the first genre, so its hue is not the default 0
    const other = storyLook({ ...s, serial: { ...s.serial!, genre: 'action' } })
    expect(look.posterHue).not.toBe(other.posterHue)
    expect(look.posterHue).toBeGreaterThanOrEqual(0)
    expect(look.posterHue).toBeLessThan(6)
  })

  it('reads the last poll: top three, the bottom third, or in between', () => {
    const s = withPendingResult()
    const last = s.history[s.history.length - 1]
    const at = (rank: number, entrants: number) =>
      storyLook({ ...s, history: [...s.history.slice(0, -1), { ...last, rank, entrants }] }).rankTone
    expect(at(1, 10)).toBe('top')
    expect(at(3, 10)).toBe('top')
    expect(at(4, 10)).toBe('mid')
    expect(at(6, 10)).toBe('mid')
    expect(at(7, 10)).toBe('low')
    expect(at(10, 10)).toBe('low')
  })

  it('buckets the fans: under 100, under 1,000, under 10,000, and beyond', () => {
    const g = createGame('Rin', 42)
    const fans = (n: number) => storyLook({ ...g, player: { ...g.player, fans: n } }).fanLevel
    expect([fans(0), fans(99), fans(100), fans(999), fans(1000), fans(9999), fans(10000)]).toEqual([0, 0, 1, 1, 2, 2, 3])
  })
})
