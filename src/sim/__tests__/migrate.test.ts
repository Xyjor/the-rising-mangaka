import { describe, expect, it } from 'vitest'
import { acceptOffer, createGame } from '../index'
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
})
