import { describe, expect, it } from 'vitest'
import {
  CHAPTER_PAGES, JOB_PAY_PER_DAY, ONE_SHOT_PAGES, WEEKLY_LIVING_COST, acceptOffer, createGame, declineOffer,
  describeDate, dismissResult, endSerial, fireAssistant, getPhase, hireAssistant, previewCombo,
  previewSubmission, setActivity, spendSkillPoint, startProject, startTrip, submitProject, tick, tickMany,
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

describe('core loop', () => {
  it('is deterministic for a given seed', () => {
    const a = tickMany(startProject(createGame('A', 7), draft), 30)
    const b = tickMany(startProject(createGame('A', 7), draft), 30)
    expect(a).toEqual(b)
  })

  it('draws pages while working and completes the manuscript', () => {
    const s = drawUntilReady()
    expect(getPhase(s)).toBe('ready')
    expect(s.project?.pagesDone).toBe(ONE_SHOT_PAGES)
    expect(s.activity).toBe('rest')
    expect(s.day).toBeGreaterThan(10)
    expect(s.day).toBeLessThan(60)
  })

  it('drains stamina while working and restores it while resting', () => {
    let s = startProject(createGame('Rin', 1), draft)
    const before = s.player.stamina
    s = tick(s)
    expect(s.player.stamina).toBeLessThan(before)
    s = setActivity(s, 'rest')
    const mid = s.player.stamina
    s = tick(s)
    expect(s.player.stamina).toBeGreaterThan(mid)
  })

  it('runs the full submit -> poll -> reward loop and records the notebook', () => {
    let s = drawUntilReady()
    const money = s.player.money
    s = submitProject(s, 'weekly-bolt')
    expect(getPhase(s)).toBe('submitted')
    s = tickMany(s, 7)
    expect(s.pendingResult).not.toBeNull()
    expect(s.project).toBeNull()
    expect(s.history).toHaveLength(1)
    const r = s.pendingResult!
    expect(r.rank).toBeGreaterThanOrEqual(1)
    expect(r.rank).toBeLessThanOrEqual(r.entrants)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(s.player.money).toBeGreaterThan(money)
    expect(s.player.fans).toBeGreaterThan(0)
    const combo = previewCombo(s, 'action', 'samurai', 'teens')
    expect(combo.genreTheme).toBe(3)
    expect(combo.themeAudience).not.toBeNull()
    expect(s.editors['weekly-bolt'].relationship).toBeGreaterThan(0)
    s = dismissResult(s)
    expect(s.pendingResult).toBeNull()
  })

  it('previews a submission with magazine mismatch flagged', () => {
    const s = drawUntilReady()
    const p = previewSubmission(s, 'ultra-seinen')!
    expect(p.mismatch).toBe(true)
    expect(previewSubmission(s, 'weekly-bolt')!.mismatch).toBe(false)
    expect(p.freshness).toBeNull()
  })

  it('levels up and lets the player spend skill points', () => {
    let s = drawUntilReady()
    s = submitProject(s, 'kids-comic')
    s = tickMany(s, 7)
    for (let i = 0; i < 3 && s.player.level === 1; i++) {
      s = dismissResult(s)
      s = declineOffer(s)
      s = drawUntilReady(startProject(s, { ...draft, title: `Blade Club ${i}` }))
      s = submitProject(s, 'kids-comic')
      s = tickMany(s, 7)
    }
    expect(s.player.level).toBeGreaterThanOrEqual(2)
    expect(s.player.skillPoints).toBeGreaterThanOrEqual(3)
    const art = s.player.stats.art
    s = spendSkillPoint(s, 'art')
    expect(s.player.stats.art).toBe(art + 2)
  })

  it('collapses at zero stamina, rests, and resumes work automatically', () => {
    let s = startProject(createGame('Rin', 4), draft)
    s = { ...s, player: { ...s.player, stamina: 5 } }
    s = tick(s)
    expect(s.player.stamina).toBe(0)
    expect(s.recovering).toBe(true)
    expect(s.activity).toBe('rest')
    const collapses = s.log.filter((e) => e.text.startsWith('You collapsed')).length
    let guard = 0
    while (s.recovering && guard++ < 20) s = tick(s)
    expect(s.recovering).toBe(false)
    expect(s.activity).toBe('work')
    expect(s.player.stamina).toBeGreaterThanOrEqual(s.player.maxStamina * 0.6)
    expect(s.log.filter((e) => e.text.startsWith('You collapsed')).length).toBe(collapses)
  })

  it('charges weekly living costs', () => {
    let s = createGame('Rin', 3)
    const money = s.player.money
    s = tickMany(s, 7)
    expect(s.player.money).toBe(money - WEEKLY_LIVING_COST)
  })

  it('describes dates', () => {
    expect(describeDate(0)).toEqual({ year: 1, month: 1, week: 1, day: 1 })
    expect(describeDate(7)).toEqual({ year: 1, month: 1, week: 2, day: 1 })
    expect(describeDate(28)).toEqual({ year: 1, month: 2, week: 1, day: 1 })
    expect(describeDate(336)).toEqual({ year: 2, month: 1, week: 1, day: 1 })
  })
})

describe('studio', () => {
  it('pays for part-time work and costs stamina', () => {
    let s = setActivity(createGame('Rin', 5), 'job')
    const money = s.player.money
    s = tick(s)
    expect(s.player.money).toBe(money + JOB_PAY_PER_DAY)
    expect(s.player.stamina).toBeLessThan(100)
  })

  it('starts with three candidates and hiring speeds up drawing', () => {
    const base = createGame('Rin', 42)
    expect(base.candidates).toHaveLength(3)
    const alone = drawUntilReady(startProject(base, draft))
    let hired = hireAssistant(base, base.candidates[0].id)
    expect(hired.assistants).toHaveLength(1)
    expect(hired.candidates).toHaveLength(2)
    hired = drawUntilReady(startProject(hired, draft))
    expect(hired.day).toBeLessThan(alone.day)
    const fired = fireAssistant(hired, hired.assistants[0].id)
    expect(fired.assistants).toHaveLength(0)
  })

  it('charges assistant salaries weekly', () => {
    let s = createGame('Rin', 42)
    const c = s.candidates[0]
    s = hireAssistant(s, c.id)
    const money = s.player.money
    s = tickMany(s, 7)
    expect(s.player.money).toBe(money - WEEKLY_LIVING_COST - c.salary)
  })

  it('refreshes candidates every four weeks', () => {
    let s = createGame('Rin', 42)
    const ids = s.candidates.map((c) => c.id)
    s = tickMany(s, 28)
    expect(s.candidates.map((c) => c.id)).not.toEqual(ids)
  })

  it('trips cost money, take days, and apply their effect', () => {
    let s = createGame('Rin', 9)
    const art = s.player.stats.art
    const money = s.player.money
    s = startTrip(s, 'art-class')
    expect(s.trip).not.toBeNull()
    expect(s.player.money).toBe(money - 600)
    s = tickMany(s, 3)
    expect(s.trip).not.toBeNull()
    s = tick(s)
    expect(s.trip).toBeNull()
    expect(s.player.stats.art).toBe(art + 2)
    // library reveals a notebook cell
    s = startTrip(s, 'library')
    s = tickMany(s, 3)
    expect(Object.keys(s.notebook.genreTheme)).toHaveLength(1)
  })

  it('refuses a trip the player cannot afford', () => {
    let s = createGame('Rin', 9)
    s = { ...s, player: { ...s.player, money: 100 } }
    expect(startTrip(s, 'library').trip).toBeNull()
  })
})

describe('serialisation', () => {
  function strongOneShot(): GameState {
    let s = withStats(createGame('Rin', 42), 90)
    s = drawUntilReady(startProject(s, draft))
    s = submitProject(s, 'weekly-bolt')
    s = tickMany(s, 7)
    return s
  }

  it('offers serialisation after a strong one-shot', () => {
    const s = strongOneShot()
    expect(s.pendingResult!.score).toBeGreaterThanOrEqual(65)
    expect(s.pendingOffer).not.toBeNull()
    expect(s.pendingOffer!.magazineId).toBe('weekly-bolt')
  })

  it('runs chapters, polls, volumes, and can be ended', () => {
    let s = dismissResult(strongOneShot())
    s = acceptOffer(s)
    expect(s.serial).not.toBeNull()
    expect(s.project?.kind).toBe('serial')
    expect(s.project?.chapter).toBe(1)
    expect(s.project?.pagesTarget).toBe(CHAPTER_PAGES)
    // draw until 5 chapters have been sent
    let guard = 0
    while (s.serial!.chaptersSent < 5 && guard++ < 600) {
      if (s.player.stamina < 20) s = setActivity(s, 'rest')
      else s = setActivity(s, 'work')
      s = tick(s)
    }
    expect(s.serial!.chaptersSent).toBe(5)
    s = tickMany(s, 8)
    expect(s.serial!.results.length).toBeGreaterThanOrEqual(4)
    expect(s.serial!.volumes).toBe(1)
    expect(s.serial!.popularity).toBeGreaterThan(50)
    expect(s.pendingResult).toBeNull() // chapter results never block
    const fans = s.player.fans
    s = endSerial(s)
    expect(s.player.fans).toBeGreaterThan(fans)
    expect(s.project).toBeNull()
    // once pending chapters resolve, the serial is archived
    s = tickMany(s, 8)
    expect(s.serial).toBeNull()
    expect(s.serials).toHaveLength(1)
    expect(s.serials[0].status).toBe('ended')
  })

  it('cancels a serial after three weak chapters', () => {
    let s = dismissResult(strongOneShot())
    s = acceptOffer(s)
    s = withStats(s, 5)
    let guard = 0
    while (s.serial && s.serial.status === 'running' && guard++ < 900) {
      if (s.player.stamina < 20) s = setActivity(s, 'rest')
      else s = setActivity(s, 'work')
      s = tick(s)
    }
    expect(s.serials.length + (s.serial ? 1 : 0)).toBe(1)
    const ser = s.serial ?? s.serials[0]
    expect(ser.status).toBe('cancelled')
    expect(s.project).toBeNull()
  })
})
