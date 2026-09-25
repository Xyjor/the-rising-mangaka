import { describe, expect, it } from 'vitest'
import {
  CHAPTER_PAGES, JOB_PAY_PER_DAY, LOW_STAMINA_THRESHOLD, MAGAZINE_MISMATCH_PENALTY, ONE_SHOT_PAGES,
  RATING_SCORE, REST_STAMINA_GAIN, SERIAL_CLIMAX_VOLUME_MULT, VOLUME_PRICE, WEEKLY_LIVING_COST,
  WORK_STAMINA_COST, acceptOffer, createGame, declineOffer, describeDate, dismissResult, endSerial,
  evaluateChapter, evaluateProject, fireAssistant, genreThemeRating, getPhase, hireAssistant, magazineById,
  previewCombo, previewSubmission, projectArtQuality, serialFatigue, setActivity, spendSkillPoint,
  stalenessCount, startProject, startTrip, submitProject, themeAudienceKey, tick, tickMany, volumeCopies,
} from '../index'
import type { Assistant, AssistantTrait, GameState, PendingChapter } from '../index'
import { DRAFT as draft, drawUntilReady as drawUntilReadyFrom, withStats } from '../../test/fixtures'

/** Thin wrapper keeping this file's default-argument call sites (`drawUntilReady()`) working. */
function drawUntilReady(state = startProject(createGame('Rin', 42), draft)) {
  return drawUntilReadyFrom(state)
}

function strongOneShot(): GameState {
  let s = withStats(createGame('Rin', 42), 90)
  s = drawUntilReady(startProject(s, draft))
  s = submitProject(s, 'weekly-bolt')
  s = tickMany(s, 7)
  return s
}

/** Rest under 20 stamina, otherwise work: the same policy the balance script uses. */
function autoDay(s: GameState): GameState {
  return tick(setActivity(s, s.player.stamina < LOW_STAMINA_THRESHOLD ? 'rest' : 'work'))
}

/** Accept the Weekly Bolt offer after a strong one-shot and draw until `chapters` have been sent, then wait 8 days. */
function serialAfter(chapters: number): GameState {
  let s = acceptOffer(dismissResult(strongOneShot()))
  let guard = 0
  while (s.serial!.chaptersSent < chapters && guard++ < 600) s = autoDay(s)
  return tickMany(s, 8)
}

function countLogs(s: GameState, prefix: string): number {
  return s.log.filter((e) => e.text.startsWith(prefix)).length
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

describe('exhaustion', () => {
  it('warns about low stamina once, and again only after recovering to 60% of max', () => {
    let s = startProject(createGame('Rin', 4), draft)
    s = { ...s, player: { ...s.player, stamina: 22 } }
    for (let d = 0; d < 60 && getPhase(s) === 'drawing'; d++) s = autoDay(s)
    expect(countLogs(s, 'Stamina is low')).toBe(1)
    // Resting up to 60% of max stamina re-arms the warning.
    s = setActivity(s, 'rest')
    while (s.player.stamina < s.player.maxStamina * 0.6) s = tick(s)
    expect(s.lowStaminaWarned).toBe(false)
    if (getPhase(s) !== 'drawing') {
      s = submitProject(s, 'kids-comic')
      s = tickMany(s, 7)
      s = declineOffer(dismissResult(s))
      s = startProject(s, { ...draft, title: 'Blade Club 2' })
    }
    s = { ...s, player: { ...s.player, stamina: s.player.maxStamina * 0.6 } }
    let guard = 0
    while (s.player.stamina >= LOW_STAMINA_THRESHOLD && guard++ < 40) s = autoDay(s)
    expect(countLogs(s, 'Stamina is low')).toBe(2)
  })

  it('refuses to work at zero stamina and returns to the desk once recovered', () => {
    let s = startProject(createGame('Rin', 4), draft)
    s = setActivity({ ...s, player: { ...s.player, stamina: 0 } }, 'work')
    expect(s.activity).toBe('rest')
    expect(s.recovering).toBe(true)
    let guard = 0
    while (s.recovering && guard++ < 20) s = tick(s)
    expect(s.recovering).toBe(false)
    expect(s.activity).toBe('work')
    expect(s.player.stamina).toBeGreaterThanOrEqual(s.player.maxStamina * 0.6)
    // The job is still a choice at zero stamina; the tick decides whether it pays.
    const j = setActivity({ ...s, recovering: true, player: { ...s.player, stamina: 0 } }, 'job')
    expect(j.activity).toBe('job')
    expect(j.recovering).toBe(false)
  })

  it('pays the part-time job by stamina: full, half when low, nothing at zero', () => {
    const jobAt = (stamina: number) => {
      const g = createGame('Rin', 5)
      return setActivity({ ...g, player: { ...g.player, stamina } }, 'job')
    }
    const money = createGame('Rin', 5).player.money
    let s = tick(jobAt(0))
    expect(s.player.money).toBe(money)
    expect(s.player.stamina).toBe(REST_STAMINA_GAIN)
    expect(s.activity).toBe('rest')
    s = tick(jobAt(3))
    expect(s.player.money).toBe(money + JOB_PAY_PER_DAY / 2)
    expect(s.player.stamina).toBe(0)
    expect(s.recovering).toBe(true)
    expect(s.activity).toBe('rest')
    expect(s.log[s.log.length - 1].kind).toBe('warn')
    expect(countLogs(s, 'You collapsed')).toBe(1)
    expect(tick(jobAt(10)).player.money).toBe(money + 60)
    expect(tick(jobAt(25)).player.money).toBe(money + 120)
  })

  it('collapses after finishing a chapter at zero stamina and resumes the next one', () => {
    let s = createGame('Rin', 4)
    s = { ...s, pendingOffer: { title: 'X', genre: 'action', theme: 'ninja', audience: 'teens', magazineId: 'weekly-bolt' } }
    s = acceptOffer(s)
    s = { ...s, project: { ...s.project!, pagesDone: s.project!.pagesTarget - 0.5 }, player: { ...s.player, stamina: 5 } }
    s = tick(s)
    expect(s.serial!.chaptersSent).toBe(1)
    expect(s.project!.chapter).toBe(2)
    expect(s.activity).toBe('rest')
    expect(s.recovering).toBe(true)
    expect(countLogs(s, 'You collapsed')).toBe(1)
    let guard = 0
    while (s.recovering && guard++ < 20) s = tick(s)
    expect(s.activity).toBe('work')
  })

  it('starts a project in rest while recovering and picks up the pen once recovered', () => {
    let s = createGame('Rin', 4)
    s = tick(setActivity({ ...s, player: { ...s.player, stamina: 3 } }, 'job'))
    expect(s.recovering).toBe(true)
    expect(countLogs(s, 'You collapsed')).toBe(1)
    s = startProject(s, draft)
    expect(s.project).not.toBeNull()
    expect(s.activity).toBe('rest')
    expect(s.recovering).toBe(true)
    let guard = 0
    while (s.recovering && guard++ < 20) {
      s = tick(s)
      if (s.recovering) expect(s.project!.pagesDone).toBe(0)
    }
    expect(s.activity).toBe('work')
    expect(countLogs(s, 'You collapsed')).toBe(1)
  })

  it('accepts an offer during a trip and starts drawing when the trip ends', () => {
    let s = withStats(createGame('Rin', 42), 90)
    s = drawUntilReady(startProject(s, draft))
    s = submitProject(s, 'weekly-bolt')
    s = tickMany(s, 4)
    s = startTrip(s, 'art-class')
    s = tickMany(s, 3)
    expect(s.pendingOffer).not.toBeNull()
    expect(s.trip).not.toBeNull()
    s = acceptOffer(dismissResult(s))
    expect(s.serial).not.toBeNull()
    expect(s.activity).toBe('rest')
    expect(s.trip).not.toBeNull()
    s = tick(s)
    expect(s.trip).toBeNull()
    expect(s.activity).toBe('work')
    s = tick(s)
    expect(s.project!.pagesDone).toBeGreaterThan(0)
  })
})

describe('endings', () => {
  it('pays nothing for a serial dropped before any chapter polled', () => {
    const s = acceptOffer(dismissResult(strongOneShot()))
    const e = endSerial(s)
    expect(e.player.fans).toBe(s.player.fans)
    expect(e.player.money).toBe(s.player.money)
    expect(e.serial).toBeNull()
    expect(e.serials).toHaveLength(1)
    expect(e.serials[0].chaptersSent).toBe(0)
    expect(e.serials[0].volumes).toBe(0)
    expect(e.serials[0].status).toBe('ended')
    expect(e.log[e.log.length - 1].text).toContain('dropped')
  })

  it('ships a climax volume at 1.5x copies when wrapping a popular serial after a volume', () => {
    const s = serialAfter(5)
    const ser = s.serial!
    expect(ser.results.length).toBeGreaterThanOrEqual(4)
    expect(ser.popularity).toBeGreaterThan(50)
    const mag = magazineById(ser.magazineId)
    const copies = Math.round(volumeCopies(s, mag, ser.popularity) * SERIAL_CLIMAX_VOLUME_MULT)
    const e = endSerial(s)
    const ended = e.serial ?? e.serials[0]
    expect(e.player.fans).toBe(s.player.fans + Math.round(ser.popularity * 20))
    expect(e.player.money).toBe(s.player.money + copies * VOLUME_PRICE)
    expect(ended.volumes).toBe(ser.volumes + 1)
    expect(ended.totalCopies).toBe(ser.totalCopies + copies)
    expect(ended.totalMoney).toBe(ser.totalMoney + copies * VOLUME_PRICE)
    expect(e.log[e.log.length - 1].text).toContain('on a high')
  })

  it('pays only the fan bonus when popularity is under 50', () => {
    const s0 = serialAfter(5)
    const s = { ...s0, serial: { ...s0.serial!, popularity: 40 } }
    const e = endSerial(s)
    const ended = e.serial ?? e.serials[0]
    expect(e.player.fans).toBe(s.player.fans + 800)
    expect(e.player.money).toBe(s.player.money)
    expect(ended.volumes).toBe(s.serial.volumes)
    expect(e.log[e.log.length - 1].text).not.toContain('on a high')
  })

  it('ships no climax volume before the first volume, however popular', () => {
    const s0 = serialAfter(5)
    const s = { ...s0, serial: { ...s0.serial!, results: s0.serial!.results.slice(0, 2), popularity: 80 } }
    const e = endSerial(s)
    const ended = e.serial ?? e.serials[0]
    expect(ended.volumes).toBe(s.serial.volumes)
    expect(e.player.money).toBe(s.player.money)
    expect(e.player.fans).toBe(s.player.fans + Math.round(80 * 20 * (2 / 4)))
  })

  it('ignores endSerial on a cancelled or absent serial', () => {
    const none = createGame('Rin', 42)
    expect(endSerial(none)).toBe(none)
    const s0 = serialAfter(5)
    const cancelled = { ...s0, serial: { ...s0.serial!, status: 'cancelled' as const } }
    expect(endSerial(cancelled)).toBe(cancelled)
  })

  it('cancellation removes exactly 10% of fans', () => {
    let s = withStats(acceptOffer(dismissResult(strongOneShot())), 5)
    let guard = 0
    let checked = false
    while (s.serial && s.serial.status === 'running' && guard++ < 900) {
      const before = s.player.fans
      s = autoDay(s)
      const ser = s.serial ?? s.serials[0]
      if (ser.status === 'cancelled') {
        const r = ser.results[ser.results.length - 1]
        const afterReward = before + r.rewards.fans
        expect(s.player.fans).toBe(afterReward - Math.round(afterReward * 0.1))
        checked = true
      }
    }
    expect(checked).toBe(true)
  })
})

describe('rules', () => {
  it('erodes freshness by 2 per chapter after chapter 8', () => {
    expect(serialFatigue(8)).toBe(0)
    expect(serialFatigue(12)).toBe(8)
    const s = acceptOffer(dismissResult(strongOneShot()))
    const ser = s.serial!
    const pc: PendingChapter = { chapter: 12, pages: CHAPTER_PAGES, artQ: 50, storyQ: 50, submittedDay: s.day, resultsDay: s.day + 7 }
    const { result } = evaluateChapter(s, ser, pc)
    const rating = genreThemeRating(s.worldSeed, ser.genre, ser.theme)
    expect(result.breakdown.freshness).toBe(Math.max(0, Math.min(100, RATING_SCORE[rating] - 8)))
  })

  it('applies staleness of 0, 15, 30 across three same-combo one-shots', () => {
    let s = createGame('Rin', 42)
    const seen: number[] = []
    const counts: number[] = []
    for (let i = 0; i < 3; i++) {
      counts.push(stalenessCount(s, draft.genre, draft.theme))
      s = drawUntilReady(startProject(s, { ...draft, title: `Blade Club ${i}` }))
      s = submitProject(s, 'kids-comic')
      s = tickMany(s, 7)
      seen.push(s.pendingResult!.penalties.staleness)
      s = declineOffer(dismissResult(s))
    }
    expect(counts).toEqual([0, 1, 2])
    expect(seen).toEqual([0, 15, 30])
  })

  it('has the editor share a tip that reveals a theme for that magazine\'s readers', () => {
    let s = drawUntilReady()
    s = { ...s, editors: { ...s.editors, 'weekly-bolt': { relationship: 2, tips: 0 } } }
    s = submitProject(s, 'weekly-bolt')
    s = tickMany(s, 7)
    expect(s.editors['weekly-bolt'].tips).toBe(1)
    const own = themeAudienceKey(draft.theme, 'teens')
    const teens = Object.keys(s.notebook.themeAudience).filter((k) => k.endsWith('|teens') && k !== own)
    expect(teens).toHaveLength(1)
    expect(s.notebook.themeAudience[own]).toBeDefined()
    expect(s.log.some((e) => e.text.includes('passes on a tip'))).toBe(true)
  })

  it('penalises a magazine whose readers differ from the manga audience', () => {
    const s = drawUntilReady()
    const match = evaluateProject(s, s.project!, 'weekly-bolt').result
    const miss = evaluateProject(s, s.project!, 'ultra-seinen').result
    expect(match.penalties.magazineMismatch).toBe(0)
    expect(miss.penalties.magazineMismatch).toBe(MAGAZINE_MISMATCH_PENALTY)
    expect(miss.breakdown.audienceFit).toBe(match.breakdown.audienceFit - MAGAZINE_MISMATCH_PENALTY)
  })

  it('applies each assistant trait over one working day', () => {
    const mk = (trait: AssistantTrait): Assistant =>
      ({ id: 99, name: 'Test', art: 40, story: 40, salary: 200, stamina: 80, maxStamina: 80, trait, look: 0 })
    const base = startProject(createGame('Rin', 42), draft)
    const run = (trait: AssistantTrait) => tick({ ...base, assistants: [mk(trait)] })
    expect(run('steady').assistants[0].stamina).toBe(80)
    expect(run('fast').assistants[0].stamina).toBe(76)
    expect(run('fast').player.stamina).toBe(base.player.stamina - WORK_STAMINA_COST)
    expect(run('inspiring').player.stamina).toBe(base.player.stamina - (WORK_STAMINA_COST - 1))
    expect(projectArtQuality(run('careful').project!)).toBeGreaterThan(projectArtQuality(run('fast').project!))
    expect(run('fast').project!.pagesDone).toBeGreaterThan(run('careful').project!.pagesDone)
  })

  it('ships a volume after the fourth result with copies from fans, circulation and popularity', () => {
    let s = acceptOffer(dismissResult(strongOneShot()))
    let guard = 0
    while (s.serial!.results.length < 4 && guard++ < 600) s = autoDay(s)
    const ser = s.serial!
    expect(ser.results).toHaveLength(4)
    expect(ser.volumes).toBe(1)
    expect(ser.totalCopies).toBe(volumeCopies(s, magazineById(ser.magazineId), ser.popularity))
  })

  it('counts a chapter as weak below roughly the top 70% of the poll', () => {
    // first weak rank = ceil(0.7 x entrants) + 1
    const firstWeak = (entrants: number) => Math.ceil(entrants * 0.7) + 1
    expect([9, 11, 13].map(firstWeak)).toEqual([8, 9, 11])
    let s = withStats(acceptOffer(dismissResult(strongOneShot())), 5)
    let guard = 0
    let seen = 0
    while (s.serial && s.serial.status === 'running' && guard++ < 900) {
      const prev = s.serial.warnings
      s = autoDay(s)
      const ser = s.serial ?? s.serials[0]
      if (ser.results.length > seen) {
        seen = ser.results.length
        const r = ser.results[seen - 1]
        expect(ser.warnings).toBe(r.rank >= firstWeak(r.entrants) ? prev + 1 : 0)
      }
    }
    expect(seen).toBeGreaterThanOrEqual(3)
  })
})

describe('editor comments', () => {
  it('names the pairing that never clicked when freshness is the weakest component', () => {
    const s = drawUntilReady(startProject(createGame('Rin', 42), { title: 'Bad Soup', genre: 'horror', theme: 'cooking', audience: 'adults' }))
    const { result } = evaluateProject(s, s.project!, 'ultra-seinen')
    expect(result.editorComment).toContain('Horror and Cooking')
    expect(result.editorComment).not.toContain('seen this pairing')
    // The same pairing again is stale, and the editor says so instead.
    const again = evaluateProject({ ...s, history: [result] }, s.project!, 'ultra-seinen').result
    expect(again.editorComment).toContain('seen this pairing')
  })

  it('names both audiences when the magazine mismatch is the weakest component', () => {
    let s = withStats(createGame('Rin', 42), 90)
    s = drawUntilReady(startProject(s, { title: 'Case Closed', genre: 'mystery', theme: 'detective', audience: 'adults' }))
    const { result } = evaluateProject(s, s.project!, 'weekly-bolt')
    expect(result.editorComment).toContain('Teens')
    expect(result.editorComment).toContain('Adults')
  })
})

describe('candidates', () => {
  it('never offers two candidates with the same name', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(new Set(createGame('x', seed).candidates.map((c) => c.name)).size).toBe(3)
    }
  })

  it('never offers a candidate who shares a name with a current assistant', () => {
    for (let seed = 1; seed <= 50; seed++) {
      let s = createGame('x', seed)
      s = hireAssistant(s, s.candidates[0].id)
      s = tickMany(s, 28)
      const taken = new Set(s.assistants.map((a) => a.name))
      expect(s.candidates.some((c) => taken.has(c.name))).toBe(false)
      expect(new Set(s.candidates.map((c) => c.name)).size).toBe(3)
    }
  })
})
