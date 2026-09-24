import { describe, expect, it } from 'vitest'
import { createGame, expectedPagesToday, hireAssistant, startProject, tick } from '../index'
import type { GameState } from '../index'

const draft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'teens' } as const

/** A seed-42 studio with two assistants and a fresh one-shot on the desk, set to draw. */
function studio(): GameState {
  let s = createGame('Rin', 42)
  s = hireAssistant(s, s.candidates[0].id)
  s = hireAssistant(s, s.candidates[0].id)
  s = startProject(s, draft)
  return { ...s, activity: 'work' }
}

/** Mean pages gained by one tick, sampling the noise across many seeds. */
function meanPagesDelta(base: GameState, seeds = 300): number {
  let total = 0
  for (let i = 0; i < seeds; i++) {
    const s = { ...base, seed: (base.seed + i * 7919) | 0 }
    total += tick(s).project!.pagesDone - s.project!.pagesDone
  }
  return total / seeds
}

describe('expectedPagesToday', () => {
  it('matches the average tick when the player is tired', () => {
    const s = studio()
    const tired = { ...s, player: { ...s.player, stamina: 10 } }
    const expected = expectedPagesToday(tired)
    const actual = meanPagesDelta(tired)
    expect(expected).toBeGreaterThan(0)
    expect(Math.abs(expected - actual) / actual).toBeLessThan(0.05)
  })

  it('matches the average tick when every assistant is exhausted', () => {
    const s = studio()
    const worn = { ...s, assistants: s.assistants.map((a) => ({ ...a, stamina: 0 })) }
    const expected = expectedPagesToday(worn)
    const actual = meanPagesDelta(worn)
    expect(expected).toBeGreaterThan(0)
    expect(Math.abs(expected - actual) / actual).toBeLessThan(0.05)
  })

  it('is exactly zero when the player is exhausted', () => {
    const s = studio()
    const asleep = { ...s, player: { ...s.player, stamina: 0 } }
    expect(expectedPagesToday(asleep)).toBe(0)
    expect(tick(asleep).project!.pagesDone).toBe(asleep.project!.pagesDone)
  })
})
