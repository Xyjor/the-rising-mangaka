import { describe, expect, it } from 'vitest'
import {
  HIRE_RUNWAY_WEEKS, OVERDRAFT_FEE_MIN, OVERDRAFT_FEE_RATE, WEEKLY_LIVING_COST, createGame, hireAssistant,
  tickMany, weeklyCosts,
} from '../index'
import type { GameState, LogEntry } from '../index'

function withMoney(s: GameState, money: number): GameState {
  return { ...s, player: { ...s.player, money } }
}

function toasts(s: GameState): LogEntry[] {
  // badge lines (the last step of every tick) are left out: these tests read the tick's own toasts
  return s.log.filter((e) => e.toast && !e.text.startsWith('Badge:'))
}

describe('money floor', () => {
  it('keeps the seed-42 day-0 hire affordable for the existing engine tests', () => {
    // engine.test.ts hires candidates[0] on day 0 with the starting ¥3000; if a salary change ever breaks
    // that, this assertion names the reason instead of an unrelated test failing.
    const s = createGame('Rin', 42)
    expect(s.player.money).toBe(3000)
    for (const c of s.candidates) expect(c.salary * HIRE_RUNWAY_WEEKS).toBeLessThanOrEqual(3000)
  })

  it('needs two weeks of that salary in the bank to hire', () => {
    const base = createGame('Rin', 42)
    const c = base.candidates[0]
    const short = withMoney(base, c.salary * HIRE_RUNWAY_WEEKS - 1)
    expect(hireAssistant(short, c.id)).toBe(short)
    const enough = withMoney(base, c.salary * HIRE_RUNWAY_WEEKS)
    const hired = hireAssistant(enough, c.id)
    expect(hired.assistants).toHaveLength(1)
    expect(hired.assistants[0].id).toBe(c.id)
  })

  it('makes unpaid assistants quit and charges an overdraft fee', () => {
    let s = createGame('Rin', 42)
    s = hireAssistant(s, s.candidates[0].id)
    expect(s.assistants).toHaveLength(1)
    const cost = weeklyCosts(s)
    s = withMoney(s, 100)
    s = tickMany(s, 7)
    expect(s.assistants).toEqual([])
    const fee = Math.max(OVERDRAFT_FEE_MIN, Math.round(OVERDRAFT_FEE_RATE * (cost - 100)))
    expect(s.player.money).toBe(100 - cost - fee)
    const last = toasts(s).slice(-2)
    expect(last[0].kind).toBe('warn')
    expect(last[0].text).toContain('quit')
    expect(last[1].kind).toBe('money')
    expect(last[1].text).toContain(`Overdraft fee: -¥${fee}`)
  })

  it('charges the fee as a percentage of the debt once it is past the minimum', () => {
    let s = withMoney(createGame('Rin', 42), -2000)
    s = tickMany(s, 7)
    const fee = Math.round(OVERDRAFT_FEE_RATE * (2000 + WEEKLY_LIVING_COST))
    expect(fee).toBe(120)
    expect(s.player.money).toBe(-2000 - WEEKLY_LIVING_COST - fee)
    const feeLines = toasts(s).filter((e) => e.text.startsWith('Overdraft fee'))
    expect(feeLines).toHaveLength(1)
    expect(feeLines[0].text).toContain(`-¥${fee}`)
  })

  it('warns a week ahead when the balance drops below a week of costs', () => {
    let s = createGame('Rin', 42)
    s = withMoney(s, weeklyCosts(s) + 10)
    s = tickMany(s, 7)
    expect(s.player.money).toBeGreaterThanOrEqual(0)
    const tight = toasts(s).filter((e) => e.kind === 'warn' && e.text.startsWith('Money is tight'))
    expect(tight).toHaveLength(1)
  })

  it('stays quiet on a fresh game with a healthy balance', () => {
    const s = tickMany(createGame('Rin', 42), 7)
    expect(s.player.money).toBe(3000 - WEEKLY_LIVING_COST)
    expect(toasts(s).filter((e) => e.kind === 'warn')).toHaveLength(0)
    expect(toasts(s).filter((e) => e.text.startsWith('Overdraft fee'))).toHaveLength(0)
  })
})
