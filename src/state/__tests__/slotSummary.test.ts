import { describe, expect, it } from 'vitest'
import type { GameState, Serial } from '../../sim'
import { withPendingResult } from '../../test/fixtures'
import { slotSummary, trimLog } from '../saveFile'

/** A slot's stored text, as the store writes it. */
const stored = (game: GameState) =>
  JSON.stringify({ version: 2, state: { game: trimLog(game), tutorialStep: -1, resumeSpeed: 1 } })

describe('slotSummary', () => {
  it('is null for an empty slot or garbage', () => {
    expect(slotSummary(null)).toBeNull()
    expect(slotSummary('not json')).toBeNull()
    expect(slotSummary('{"state":{"game":null}}')).toBeNull()
    expect(slotSummary('[1,2]')).toBeNull()
  })

  it('reads a real save', () => {
    const g = withPendingResult()
    expect(slotSummary(stored(g))).toEqual({
      penName: g.player.name, dateLabel: 'Month 1', money: g.player.money, fans: g.player.fans, serialTitle: null,
    })
  })

  it('names the running serial and dates a later year', () => {
    const g = withPendingResult()
    const game = { ...g, day: 400, serial: { title: 'Night Bus' } as Serial }
    const s = slotSummary(stored(game))!
    expect(s.serialTitle).toBe('Night Bus')
    expect(s.dateLabel).toBe('Year 2, month 3')
  })
})
