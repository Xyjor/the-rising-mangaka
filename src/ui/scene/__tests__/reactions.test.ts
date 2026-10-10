// Which reaction a store change brings: pure, node environment, game states from the shared fixtures.
import { describe, expect, it } from 'vitest'
import { acceptOffer, createGame } from '../../../sim'
import type { ChapterResult, GameState } from '../../../sim'
import { KIDS_OFFER, withPendingResult } from '../../../test/fixtures'
import type { PopState } from '../Pops'
import { missedIssuesOf, offerShown, reactionFor } from '../reactions'

const st = (game: GameState | null, over: Partial<PopState> = {}): PopState => ({ game, saveLoads: 0, readOnly: false, ...over })
const g = createGame('Rin', 1)
const RESULT = withPendingResult().pendingResult!
const poll = (rank: number, entrants: number) => ({ ...RESULT, rank, entrants })
const chapter = (rank: number, entrants: number) => ({ rank, entrants }) as ChapterResult
const serial = acceptOffer({ ...createGame('Rin', 1), pendingOffer: KIDS_OFFER })

describe('reactionFor', () => {
  it('cheers a one-shot in the top three and slumps one in the bottom third once it is dismissed, never as it arrives', () => {
    const seen = (rank: number) => reactionFor(st({ ...g, pendingResult: poll(rank, 12) }), st({ ...g, pendingResult: null }))
    expect(seen(2)).toBe('good-poll')
    expect(seen(9)).toBe('bad-poll') // 9 x 3 = 27 > 12 x 2 = 24: the bottom third
    expect(seen(5)).toBeNull() // 15 <= 24: in between
    expect(reactionFor(st({ ...g, pendingResult: null }), st({ ...g, pendingResult: poll(1, 12) }))).toBeNull()
  })

  it('reacts to a new serial chapter result, even when the same tick archived the serial', () => {
    const next = (r: ChapterResult) => ({ ...serial, serial: { ...serial.serial!, results: [r] } })
    expect(reactionFor(st(serial), st(next(chapter(1, 10))))).toBe('good-poll')
    expect(reactionFor(st(serial), st(next(chapter(10, 10))))).toBe('bad-poll')
    const archived = { ...serial, serial: null, serials: [{ ...serial.serial!, status: 'cancelled' as const, results: [chapter(10, 10)] }] }
    expect(reactionFor(st(serial), st(archived))).toBe('bad-poll')
  })

  it('cheers a level-up, panics when the chapter turns late, tears a page when an issue is missed', () => {
    expect(reactionFor(st(g), st({ ...g, player: { ...g.player, level: g.player.level + 1 } }))).toBe('level-up')
    const due = (days: number): GameState => ({ ...serial, activity: 'work', serial: { ...serial.serial!, nextDueDay: serial.day + days } })
    expect(reactionFor(st(due(60)), st(due(-1)))).toBe('late')
    expect(reactionFor(st(due(-1)), st(due(-1)))).toBeNull()
    expect(reactionFor(st(serial), st({ ...serial, serial: { ...serial.serial!, missedIssues: 1 } }))).toBe('missed')
    expect(reactionFor(st(serial), st({ ...serial, serial: null, serials: [{ ...serial.serial!, missedIssues: 1 }] }))).toBe('missed')
  })

  it('picks one by priority: missed, bad poll, good poll, offer, level-up, late', () => {
    const both = { ...serial, serial: { ...serial.serial!, missedIssues: 1, results: [chapter(1, 10)] } }
    expect(reactionFor(st(serial), st(both))).toBe('missed')
    const up = { ...serial, player: { ...serial.player, level: serial.player.level + 1 }, serial: { ...serial.serial!, results: [chapter(1, 10)] } }
    expect(reactionFor(st(serial), st(up))).toBe('good-poll')
    const offerAndLevel = { ...g, pendingOffer: KIDS_OFFER, player: { ...g.player, level: g.player.level + 1 } }
    expect(reactionFor(st(g), st(offerAndLevel))).toBe('offer')
  })

  it('nods on an offer once it is in view: the result dismissed with the offer behind it, or an offer set with no result in front', () => {
    const behind = { ...g, pendingResult: poll(5, 12), pendingOffer: KIDS_OFFER }
    // rank 5 of 12 is neither top three nor the bottom third, so only the offer speaks
    expect(reactionFor(st(behind), st({ ...behind, pendingResult: null }))).toBe('offer')
    expect(reactionFor(st(g), st({ ...g, pendingOffer: KIDS_OFFER }))).toBe('offer')
    // the result's own tick sets both: the offer waits behind the envelope, no cue yet
    expect(reactionFor(st(g), st(behind))).toBeNull()
    // the offer already in view: nothing new
    const shown = { ...g, pendingOffer: KIDS_OFFER }
    expect(reactionFor(st(shown), st({ ...shown, day: g.day + 1 }))).toBeNull()
    // a top-three result with the offer behind it: the poll speaks (the editor nods either way, the mangaka cheers)
    const top = { ...g, pendingResult: poll(2, 12), pendingOffer: KIDS_OFFER }
    expect(reactionFor(st(top), st({ ...top, pendingResult: null }))).toBe('good-poll')
    expect([offerShown(shown), offerShown(behind), offerShown(g)]).toEqual([true, false, false])
  })

  it('never reacts across a save load, another career, a jump of days, a read-only tab, no game, or the same game', () => {
    const before = st({ ...g, pendingResult: poll(1, 12) })
    const after = { ...g, pendingResult: null }
    expect(reactionFor(before, st(after, { saveLoads: 1 }))).toBeNull()
    expect(reactionFor(before, st({ ...after, worldSeed: g.worldSeed + 1 }))).toBeNull()
    expect(reactionFor(before, st({ ...after, day: g.day + 2 }))).toBeNull()
    expect(reactionFor(before, st(after, { readOnly: true }))).toBeNull()
    expect(reactionFor(st(null), st(after))).toBeNull()
    // a store change that leaves the game object as it was (a modal, a toast): the fast path most changes take
    expect(reactionFor(st(serial), st(serial))).toBeNull()
  })
})

describe('missedIssuesOf', () => {
  it('counts the issues every serial missed, the running one and the archived ones', () => {
    const s = { ...serial, serial: { ...serial.serial!, missedIssues: 1 }, serials: [{ ...serial.serial!, missedIssues: 2 }] }
    expect(missedIssuesOf(s)).toBe(3)
    expect(missedIssuesOf(g)).toBe(0)
  })
})
