import { describe, expect, it } from 'vitest'
import {
  MILESTONES, acceptOffer, createGame, dismissResult, doneIds, getPhase, hireAssistant, nextMilestone,
  pendingMilestones, setActivity, startProject, submitProject, tick, tickMany, xpToNext,
} from '../index'
import type { GameState } from '../index'

const draft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'teens' } as const

function drawUntilReady(state = startProject(createGame('Rin', 42), draft)) {
  let s = state
  let guard = 0
  while (getPhase(s) !== 'ready' && guard++ < 400) s = tick(s)
  return s
}

function withStats(s: GameState, v: number): GameState {
  return { ...s, player: { ...s.player, stats: { art: v, story: v, pacing: v } } }
}

function strongOneShot(): GameState {
  let s = withStats(createGame('Rin', 42), 90)
  s = drawUntilReady(startProject(s, draft))
  s = submitProject(s, 'weekly-bolt')
  s = tickMany(s, 7)
  return s
}

describe('milestone ladder', () => {
  it('has unique ids and positive xp', () => {
    const ids = MILESTONES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const m of MILESTONES) expect(m.xp).toBeGreaterThan(0)
    expect(MILESTONES.reduce((a, m) => a + m.xp, 0)).toBe(1840)
  })

  it('points a fresh game at the first manuscript', () => {
    const s = createGame('Rin', 42)
    expect(doneIds(s)).toEqual([])
    expect(nextMilestone(s)?.id).toBe('first-manuscript')
    expect(pendingMilestones(s)).toEqual([])
    // the selector returns the constant object so React selectors stay reference-stable
    expect(nextMilestone(s)).toBe(MILESTONES[0])
  })

  it('awards the first manuscript at the end of the tick it becomes ready', () => {
    let s = startProject(createGame('Rin', 42), draft)
    let guard = 0
    while (getPhase(s) !== 'ready' && guard++ < 400) {
      const before = s
      s = tick(s)
      if (getPhase(s) !== 'ready') expect(s.milestonesDone).toEqual(before.milestonesDone)
    }
    expect(s.milestonesDone).toContain('first-manuscript')
    expect(nextMilestone(s)?.id).toBe('first-poll')
    const toasts = s.log.filter((e) => e.toast && e.text.startsWith('Milestone:'))
    expect(toasts).toHaveLength(1)
    expect(toasts[0].text).toBe('Milestone: First manuscript. +40 XP.')
  })

  it('adds the milestone xp to the player', () => {
    // a ready manuscript on the desk with the milestone not yet awarded: exactly one tick awards it
    let s = drawUntilReady()
    s = { ...s, milestonesDone: [], player: { ...s.player, xp: 0, level: 1 } }
    const before = s.player
    s = tick(s)
    const total = s.player.xp + (s.player.level - before.level) * xpToNext(before.level)
    expect(total).toBe(before.xp + 40)
  })

  it('records serial milestones once each over a serial run', () => {
    let s = dismissResult(strongOneShot())
    s = acceptOffer(s)
    let guard = 0
    while (s.serial!.chaptersSent < 5 && guard++ < 600) {
      if (s.player.stamina < 20) s = setActivity(s, 'rest')
      else s = setActivity(s, 'work')
      s = tick(s)
    }
    s = tickMany(s, 8)
    expect(s.serial!.volumes).toBe(1)
    expect(s.milestonesDone).toContain('first-serial')
    expect(s.milestonesDone).toContain('first-volume')
    expect(s.milestonesDone).toContain('big-league')
    expect(new Set(s.milestonesDone).size).toBe(s.milestonesDone.length)
  })

  it('awards the first hire on the next tick', () => {
    let s = createGame('Rin', 42)
    s = hireAssistant(s, s.candidates[0].id)
    expect(s.milestonesDone).not.toContain('first-hire')
    s = tick(s)
    expect(s.milestonesDone).toContain('first-hire')
  })

  it('tolerates an old save without the milestones field', () => {
    const base = createGame('Rin', 42)
    const old = { ...base } as Partial<GameState>
    delete old.milestonesDone
    let s = old as GameState
    expect(doneIds(s)).toEqual([])
    expect(nextMilestone(s)?.id).toBe('first-manuscript')
    s = hireAssistant(s, s.candidates[0].id)
    expect(() => { s = tick(s) }).not.toThrow()
    expect(s.milestonesDone).toEqual(['first-hire'])
  })

  it('stays deterministic: awarding milestones consumes no rng', () => {
    const run = () => {
      let s = hireAssistant(createGame('Rin', 42), createGame('Rin', 42).candidates[0].id)
      s = startProject(s, draft)
      return tickMany(s, 60)
    }
    const a = run()
    const b = run()
    expect(a).toEqual(b)
    expect(a.milestonesDone.length).toBeGreaterThan(0)
  })
})
