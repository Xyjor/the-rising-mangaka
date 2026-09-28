import { describe, expect, it } from 'vitest'
import {
  DAYS_PER_YEAR, MERCH_ITEMS, MERCH_MAX_RUNS, createGame, endSerial, magazineById, merchForecast, merchRefusal,
  merchTick, merchWeekly, orderMerch, tick, volumeCopies,
} from '../index'
import type { GameState, MerchRun } from '../index'
import { CARELESS, SENSIBLE, STRESS_BOLT, runBot } from '../bot'
import { upgradeSave } from '../migrate'
import { withMerchSerial } from '../../test/fixtures'

/** Run only the merch hook, one day at a time, up to `lastDay`. */
function merchDays(s: GameState, lastDay: number): GameState {
  let x = s
  while (x.day < lastDay) x = merchTick({ ...x, day: x.day + 1 })
  return x
}

const KEYCHAIN_RUN: MerchRun = { id: 1, item: 'keychain', serialId: 1, orderedDay: 400, endsDay: 428, sold: 0, money: 0 }

/**
 * The tuning target, on the reference serial (6,700 copies a volume, `withMerchSerial`).
 * Units a week = round(6,700 x share x popularity / 100); total = units x margin x weeks.
 *
 *   item       share  margin weeks  cost   | pop 80: units  total   total/cost | pop 50: units  total   net
 *   keychain   0.02    20     4     6,300  |         107     8,560   1.36      |         67     5,360    -940
 *   poster     0.015   40     6    14,000  |          80    19,200   1.37      |         50    12,000  -2,000
 *   plush      0.01    80     8    25,000  |          54    34,560   1.38      |         34    21,760  -3,240
 *   artbook    0.02    50     6    24,000  |         107    32,100   1.34      |         67    20,100  -3,900
 *   figure     0.008  250     8    64,000  |          43    86,000   1.34      |         27    54,000 -10,000
 */
describe('merch tuning', () => {
  it('at popularity 80 every forecast returns 1.2x-1.5x the cost', () => {
    const s = withMerchSerial(80)
    expect(MERCH_ITEMS.map((m) => merchForecast(s, m.id, 1).total)).toEqual([8560, 19_200, 34_560, 32_100, 86_000])
    for (const m of MERCH_ITEMS) {
      const r = merchForecast(s, m.id, 1).total / m.cost
      expect(r).toBeGreaterThanOrEqual(1.2)
      expect(r).toBeLessThanOrEqual(1.5)
    }
  })

  it('at popularity 50 keychains and posters are a net loss', () => {
    const s = withMerchSerial(50)
    expect(merchForecast(s, 'keychain', 1)).toEqual({ total: 5360, net: -940, weeks: 4 })
    expect(merchForecast(s, 'poster', 1)).toEqual({ total: 12_000, net: -2000, weeks: 6 })
  })
})

describe('merch rules', () => {
  it('a new career has no licence, no runs and nothing earned', () => {
    expect(createGame('Rin', 1).merch).toEqual({ licensedDay: null, runs: [], nextRunId: 1, earned: 0 })
  })

  it('the licence arrives on the first year-two day with a volume shipped, with a toast', () => {
    const y1 = withMerchSerial(80, false)
    const a = merchTick({ ...y1, day: DAYS_PER_YEAR })
    expect(a.merch.licensedDay).toBeNull()
    const b = merchTick({ ...a, day: DAYS_PER_YEAR + 1 })
    expect(b.merch.licensedDay).toBe(DAYS_PER_YEAR + 1)
    expect(b.log.at(-1)).toMatchObject({ text: 'A goods maker wants to license your series.', toast: true })
    expect(merchTick({ ...b, day: DAYS_PER_YEAR + 2 }).log.length).toBe(b.log.length)
    const noVolume = merchTick({ ...y1, serial: { ...y1.serial!, volumes: 0, totalCopies: 0 } })
    expect(noVolume.merch.licensedDay).toBeNull()
  })

  it('weekly pay reads the running popularity, half the final one once archived, and the anime boost', () => {
    const s = withMerchSerial(80)
    expect(merchWeekly(s, KEYCHAIN_RUN)).toEqual({ units: 107, money: 2140 })
    const ended = endSerial(s)
    const final = ended.serials[0].popularity
    expect(merchWeekly(ended, KEYCHAIN_RUN).units).toBe(Math.round((6700 * 0.02 * (final / 2)) / 100))
    const anime: GameState = {
      ...s, anime: [{ studio: 'kumo', serialId: 1, signedDay: 300, airsDay: 350, endsDay: 434, tailEndsDay: 518 }],
    }
    expect(merchWeekly(anime, KEYCHAIN_RUN)).toEqual({ units: 107, money: 2782 })
  })

  it('refuses without the licence, the money, a free slot, for a repeat, or with a gate unmet', () => {
    const s = withMerchSerial(80)
    expect(merchRefusal(withMerchSerial(80, false), 'keychain', 1)).toMatch(/year two/)
    expect(merchRefusal({ ...s, player: { ...s.player, money: 100 } }, 'keychain', 1)).toMatch(/¥6,300/)
    const one = orderMerch(s, 'keychain', 1)
    expect(merchRefusal(one, 'keychain', 1)).toMatch(/already/)
    const two = orderMerch(one, 'poster', 1)
    expect(two.merch.runs.length).toBe(MERCH_MAX_RUNS)
    expect(merchRefusal(two, 'plush', 1)).toMatch(/2 runs/)
    expect(merchRefusal({ ...s, serial: { ...s.serial!, volumes: 3 } }, 'artbook', 1)).toMatch(/4 volumes/)
    expect(merchRefusal(s, 'artbook', 1)).toBeNull()
    expect(merchRefusal(s, 'figure', 1)).toMatch(/anime/)
    const locked = withMerchSerial(80, false)
    expect(orderMerch(locked, 'keychain', 1)).toBe(locked)
  })

  it('ordering pays the cost at once with a money toast', () => {
    const s = orderMerch(withMerchSerial(80), 'keychain', 1)
    expect(s.player.money).toBe(100_000 - 6300)
    expect(s.merch.runs).toEqual([KEYCHAIN_RUN])
    expect(s.merch.nextRunId).toBe(2)
    expect(s.log.at(-1)).toMatchObject({ kind: 'money', toast: true })
  })

  it('pays weekly without a toast, then sells out with a toast and stays in the history', () => {
    const s = orderMerch(withMerchSerial(80), 'keychain', 1)
    const w1 = merchDays(s, 407)
    expect(w1.player.money).toBe(s.player.money + 2140)
    expect(w1.log.at(-1)).toMatchObject({ kind: 'money', toast: false })
    const done = merchDays(s, 428)
    expect(done.player.money).toBe(s.player.money + 8560)
    expect(done.merch.earned).toBe(8560)
    expect(done.merch.runs[0]).toMatchObject({ sold: 428, money: 8560 })
    expect(done.log.at(-1)).toMatchObject({ text: 'Keychains sold out: +¥8,560 over 4 weeks.', toast: true })
    expect(merchRefusal(done, 'keychain', 1)).toBeNull()
    expect(merchDays(done, 450).player.money).toBe(done.player.money)
  })

  it('changes money only, and runs inside tick', () => {
    const s = orderMerch(withMerchSerial(80), 'keychain', 1)
    const after = merchDays(s, 428)
    expect(after.player.fans).toBe(s.player.fans)
    expect(after.serial).toEqual(s.serial)
    const mag = magazineById('kids-comic')
    expect(volumeCopies(after, mag, 80)).toBe(volumeCopies(s, mag, 80))
    let t = s
    for (let i = 0; i < 7; i++) t = tick(t)
    expect(t.merch.earned).toBeGreaterThan(0)
  })
})

describe('merch in saves and bots', () => {
  it('an old save without merch loads with the default', () => {
    const { merch: _, ...old } = withMerchSerial(80)
    expect(upgradeSave(old as GameState).merch).toEqual({ licensedDay: null, runs: [], nextRunId: 1, earned: 0 })
  })

  it('the sensible bot orders goods in year two; the careless bot and the stress case never do', () => {
    expect(runBot(1, SENSIBLE, { days: 500 }).final.merch.runs.length).toBeGreaterThan(0)
    expect(runBot(1, CARELESS, { days: 500 }).final.merch.runs).toEqual([])
    expect(runBot(1, STRESS_BOLT, { days: 500 }).final.merch.runs).toEqual([])
  })
})
