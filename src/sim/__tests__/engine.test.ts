import { describe, expect, it } from 'vitest'
import {
  CHAPTER_PAGES, JOB_PAY_PER_DAY, LOW_STAMINA_THRESHOLD, MAGAZINE_MISMATCH_PENALTY, ONE_SHOT_PAGES,
  PACING_NOISE_SD, RATING_SCORE, REST_STAMINA_GAIN, SERIAL_CLIMAX_VOLUME_MULT, SERIAL_GRACE_CHAPTERS, VOLUME_PRICE,
  WEEKLY_LIVING_COST,
  WORK_STAMINA_COST, acceptOffer, chapterDeadline, chapterWorkDays, clamp, createGame, deadlineStatus, declineOffer,
  describeDate, dismissResult, endSerial, evaluateChapter, evaluateProject, fireAssistant, genreThemeRating, getPhase,
  hireAssistant, magazineById, previewCombo, previewSubmission, projectArtQuality, serialFatigue, setActivity,
  spendSkillPoint, stalenessCount, startProject, startTrip, submitProject, themeAudienceKey, tick, tickMany,
  volumeCopies, PLACES, GENRES, THEMES, MAGAZINES, RETREAT_MAX_STAMINA_CAP, placeById, genreThemeKey, biggestLoss,
  pointsLost,
} from '../index'
import type {
  Assistant, AssistantTrait, ChapterResult, GameState, LogEntry, MagazineId, PendingChapter, Rating,
} from '../index'
import { bumpEditor } from '../editors'
import { draw, gaussian } from '../rng'
import { DRAFT as draft, drawUntilReady as drawUntilReadyFrom, noDeadline, withStats } from '../../test/fixtures'

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
    s = noDeadline(acceptOffer(s))
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

  it('grants a grace period: the first 4 results never warn, even when weak', () => {
    let s = withStats(noDeadline(acceptOffer(dismissResult(strongOneShot()))), 5)
    let guard = 0
    while (s.serial && s.serial.results.length < SERIAL_GRACE_CHAPTERS && guard++ < 900) s = autoDay(s)
    expect(s.serial!.results).toHaveLength(SERIAL_GRACE_CHAPTERS)
    expect(s.serial!.warnings).toBe(0)
    expect(s.serial!.status).toBe('running')
    // Popularity still moves during grace, only warnings are held back.
    expect(s.serial!.popularity).not.toBe(50)
  })

  it('cancels a forced-weak serial at exactly its 7th result once the grace period ends', () => {
    let s = withStats(noDeadline(acceptOffer(dismissResult(strongOneShot()))), 5)
    let guard = 0
    while (s.serial && s.serial.status === 'running' && guard++ < 900) s = autoDay(s)
    const ser = s.serial ?? s.serials[0]
    expect(ser.status).toBe('cancelled')
    expect(ser.results).toHaveLength(7)
    // Weak chapters and missed issues share the warning count, so the cancellation names warnings, not weak chapters.
    expect(lastLine(s).text).toMatch(
      /^Weekly Bolt cancelled "Blade Club" after 3 warnings in a row\. Fans -\d+\. A one-shot that places top 3 or scores 65\+ earns a new offer\.$/,
    )
  })
})

const KIDS_OFFER = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const

/** Seed 4, a Kids Comic Go! serial accepted on day 0 (chapter 1 due on day 21), resting from then on. */
function kidsSerial(): GameState {
  return setActivity(acceptOffer({ ...createGame('Rin', 4), pendingOffer: KIDS_OFFER }), 'rest')
}

/** `kidsSerial` with `n` chapter results already in, chapter n + 1 on the desk, ¥10,000 and 1,000 fans. */
function kidsSerialWithResults(n: number): GameState {
  const s = kidsSerial()
  const r: ChapterResult = {
    chapter: 1, day: 0, score: 60, rank: 4, entrants: 11,
    breakdown: { art: 60, story: 60, pacing: 60, audienceFit: 60, freshness: 60 },
    rewards: { money: 1000, fans: 100, xp: 50 },
  }
  const results = Array.from({ length: n }, (_, i) => ({ ...r, chapter: i + 1 }))
  return {
    ...s,
    serial: { ...s.serial!, results, chaptersSent: n },
    project: { ...s.project!, chapter: n + 1 },
    player: { ...s.player, money: 10000, fans: 1000 },
  }
}

function missLogs(s: GameState): LogEntry[] {
  return s.log.filter((e) => e.text.includes('missed its issue'))
}

describe('chapter deadlines', () => {
  it('sets chapter 1 due by magazine: Kids 21 days, Weekly Bolt 14, Monthly Petal 28, Ultra Seinen 21', () => {
    const g = createGame('Rin', 4)
    const dueDay = (magazineId: MagazineId) => acceptOffer({ ...g, pendingOffer: { ...KIDS_OFFER, magazineId } }).serial!
    expect(dueDay('kids-comic')).toMatchObject({ nextDueDay: 21, missedIssues: 0 })
    expect(dueDay('weekly-bolt')).toMatchObject({ nextDueDay: 14, missedIssues: 0 })
    expect(dueDay('monthly-petal')).toMatchObject({ nextDueDay: 28, missedIssues: 0 })
    expect(dueDay('ultra-seinen')).toMatchObject({ nextDueDay: 21, missedIssues: 0 })
  })

  it('runs the next due day from the previous one: chapter 1 done on day 5 makes chapter 2 due on day 42', () => {
    let s = tickMany(kidsSerial(), 4)
    expect(s.day).toBe(4)
    s = setActivity({ ...s, project: { ...s.project!, pagesDone: 15.5 } }, 'work')
    s = tick(s)
    expect(s.day).toBe(5)
    expect(s.serial!.chaptersSent).toBe(1)
    expect(s.project!.chapter).toBe(2)
    // 21 + 21, not 5 + 21
    expect(s.serial!.nextDueDay).toBe(42)
  })

  it('counts a chapter finished on its due day as on time', () => {
    let s = tickMany(kidsSerial(), 20)
    s = setActivity({ ...s, project: { ...s.project!, pagesDone: 15.5 } }, 'work')
    s = tick(s)
    expect(s.day).toBe(21)
    expect(s.serial!.chaptersSent).toBe(1)
    expect(s.serial!).toMatchObject({ nextDueDay: 42, missedIssues: 0, popularity: 50 })
    expect(missLogs(s)).toHaveLength(0)
  })

  it('misses the issue the day chapter 1 is due and not ready; a new series only loses popularity', () => {
    let s = tickMany(kidsSerial(), 20)
    expect(s.day).toBe(20)
    expect(s.serial!).toMatchObject({ popularity: 50, nextDueDay: 21, missedIssues: 0 })
    expect(missLogs(s)).toHaveLength(0)
    s = tick(s)
    expect(s.serial!).toMatchObject({ popularity: 40, nextDueDay: 42, missedIssues: 1, warnings: 0, status: 'running' })
    expect(s.project!.chapter).toBe(1)
    const logs = missLogs(s)
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      kind: 'warn',
      toast: true,
      text: '"Magic Club" missed its issue: chapter 1 was not ready. Popularity -10. New series get 4 chapters of grace.',
    })
  })

  it('keeps the grace period through 3 results: a miss then still adds no warning', () => {
    const s = tickMany(kidsSerialWithResults(3), 21)
    expect(s.serial!).toMatchObject({ popularity: 40, missedIssues: 1, warnings: 0 })
    expect(missLogs(s)[0].text).toBe(
      '"Magic Club" missed its issue: chapter 4 was not ready. Popularity -10. New series get 4 chapters of grace.',
    )
  })

  it('after 4 results, three misses warn 1, 2 and 3, and the third cancels the serial for 10% of fans', () => {
    let s = tickMany(kidsSerialWithResults(4), 21)
    expect(s.serial!).toMatchObject({ popularity: 40, nextDueDay: 42, missedIssues: 1, warnings: 1, status: 'running' })
    expect(missLogs(s)[0].text).toBe(
      '"Magic Club" missed its issue: chapter 5 was not ready. Popularity -10. Warning 1 of 3.',
    )
    s = tickMany(s, 21)
    expect(s.serial!).toMatchObject({ popularity: 30, nextDueDay: 63, missedIssues: 2, warnings: 2, status: 'running' })
    expect(missLogs(s)[1].text).toBe(
      '"Magic Club" missed its issue: chapter 5 was not ready. Popularity -10. Warning 2 of 3.',
    )
    s = tickMany(s, 21)
    expect(s.day).toBe(63)
    // No chapter was waiting for a poll, so the cancelled serial is archived at once.
    expect(s.serial).toBeNull()
    expect(s.serials[0]).toMatchObject({ status: 'cancelled', endedDay: 63, popularity: 20, missedIssues: 3, warnings: 3 })
    expect(s.project).toBeNull()
    expect(s.activity).toBe('rest')
    // 1,000 fans, 10% lost
    expect(s.player.fans).toBe(900)
    expect(missLogs(s)[2].text).toBe(
      '"Magic Club" missed its issue: chapter 5 was not ready. Popularity -10. Warning 3 of 3.',
    )
    expect(lastLine(s)).toMatchObject({
      kind: 'warn',
      toast: true,
      text: 'Kids Comic Go! cancelled "Magic Club" after 3 warnings in a row. Fans -100. A one-shot that places top 3 or scores 65+ earns a new offer.',
    })
  })

  it('checks the deadline after the day\'s chapter polls: a 4th result landing on the due day ends grace first', () => {
    // Chapter 4 polls on day 21, the day chapter 5 is due. resolveChapters runs first, so the miss sees 4 results
    // and counts as a warning (the 4th result itself is still inside grace, so it adds none).
    const s0 = kidsSerialWithResults(3)
    const pc: PendingChapter = { chapter: 4, pages: CHAPTER_PAGES, artQ: 50, storyQ: 50, submittedDay: 14, resultsDay: 21 }
    const s = tickMany({
      ...s0,
      serial: { ...s0.serial!, pending: [pc], chaptersSent: 4 },
      project: { ...s0.project!, chapter: 5 },
    }, 21)
    expect(s.serial!.results).toHaveLength(4)
    expect(s.serial!).toMatchObject({ missedIssues: 1, warnings: 1 })
    expect(missLogs(s)[0].text).toBe('"Magic Club" missed its issue: chapter 5 was not ready. Popularity -10. Warning 1 of 3.')
  })

  it('cancels after a missed issue and two weak chapters, naming the warnings in a row', () => {
    // Seed 4 rates Sports x Vampires and Vampires for Kids both Bad (20). Chapters drawn at quality 0 by a stats-5
    // mangaka score about (0 x 35 + 0 x 15 + 5 x 10 + 20 x 20 + 20 x 20) / 100 = 8.5, some 5 sd under Kids Comic Go!'s
    // rivals at 47 and the named rival at 57 (sd 8): last of 11, so weak (rank above ceil(0.7 x 11) = 8).
    const s0 = withStats(kidsSerialWithResults(4), 5)
    const weak = (chapter: number, resultsDay: number): PendingChapter =>
      ({ chapter, pages: CHAPTER_PAGES, artQ: 0, storyQ: 0, submittedDay: resultsDay - 7, resultsDay })
    let s: GameState = {
      ...s0,
      serial: { ...s0.serial!, genre: 'sports', theme: 'vampires', pending: [weak(5, 22), weak(6, 23)], chaptersSent: 6 },
      project: { ...s0.project!, chapter: 7 },
    }
    // Day 21: chapter 7 misses its issue, the first warning (4 results are in).
    s = tickMany(s, 21)
    expect(s.serial!).toMatchObject({ missedIssues: 1, warnings: 1, status: 'running' })
    // Day 22: chapter 5 polls last, the second warning.
    s = tick(s)
    expect(s.serial!.results[4].rank).toBe(11)
    expect(s.serial!).toMatchObject({ warnings: 2, status: 'running' })
    // Day 23: chapter 6 polls last, the third warning cancels.
    s = tick(s)
    expect(s.serial).toBeNull()
    expect(s.serials[0].results[5].rank).toBe(11)
    expect(s.serials[0]).toMatchObject({ status: 'cancelled', warnings: 3, missedIssues: 1 })
    expect(lastLine(s).text).toMatch(
      /^Kids Comic Go! cancelled "Magic Club" after 3 warnings in a row\. Fans -\d+\. A one-shot that places top 3 or scores 65\+ earns a new offer\.$/,
    )
  })

  it('misses the issue while the mangaka is away: the magazine goes to print regardless', () => {
    // Away across the due day: an art class from day 19 ends on day 23.
    let s = startTrip(tickMany(kidsSerial(), 19), 'art-class')
    s = tickMany(s, 2)
    expect(s.day).toBe(21)
    expect(s.trip).not.toBeNull()
    expect(s.serial!).toMatchObject({ missedIssues: 1, popularity: 40, nextDueDay: 42 })
    // Home on the due day itself: the trip ends first in the tick, then the deadline is checked, and the day home
    // draws nothing, so the issue is missed.
    let t = startTrip(tickMany(kidsSerial(), 18), 'library')
    expect(t.trip!.endsDay).toBe(21)
    t = tickMany(t, 3)
    expect(t.trip).toBeNull()
    expect(t.activity).toBe('work')
    expect(t.project!.pagesDone).toBe(0)
    expect(t.serial!).toMatchObject({ missedIssues: 1, popularity: 40, nextDueDay: 42 })
    const home = t.log.findIndex((e) => e.text.startsWith('Back from the City Library'))
    const missed = t.log.findIndex((e) => e.text.includes('missed its issue'))
    expect(home).toBeGreaterThanOrEqual(0)
    expect(missed).toBeGreaterThan(home)
  })

  it('never takes popularity below 0', () => {
    const s0 = kidsSerial()
    const s = tickMany({ ...s0, serial: { ...s0.serial!, popularity: 5 } }, 21)
    expect(s.serial!).toMatchObject({ popularity: 0, missedIssues: 1 })
  })

  it('stops counting deadlines once the serial is wrapped up', () => {
    const s = tickMany(endSerial(kidsSerial()), 30)
    expect(s.serials[0]).toMatchObject({ status: 'ended', missedIssues: 0 })
    expect(missLogs(s)).toHaveLength(0)
  })

  it('reports the deadline: 16 pages at 1.24 a day is 13 working days; on track, tight or late by the days left', () => {
    // Stats 40 art, 34 story: 0.5 + 37 x 0.02 = 1.24 pages a day; 16 / 1.24 = 12.9, so 13 working days.
    const s = kidsSerial()
    const at = (day: number) => chapterDeadline({ ...s, day })
    expect(at(0)).toEqual({ dueDay: 21, daysLeft: 21, workDaysLeft: 13, status: 'on-track' })
    // 13 x 1.25 = 16.25: 17 days left is on track, 16 is tight
    expect(at(4)!.status).toBe('on-track')
    expect(at(5)).toEqual({ dueDay: 21, daysLeft: 16, workDaysLeft: 13, status: 'tight' })
    // 13 working days in 13 days is still tight; 12 is late
    expect(at(8)!.status).toBe('tight')
    expect(at(9)).toEqual({ dueDay: 21, daysLeft: 12, workDaysLeft: 13, status: 'late' })
    // 4 pages left: 4 / 1.24 = 3.2, so 4 working days
    expect(chapterDeadline({ ...s, project: { ...s.project!, pagesDone: 12 } })!.workDaysLeft).toBe(4)
  })

  it('counts working days for a page count at the studio pace, and rates them against the days left', () => {
    const s = createGame('Rin', 4)
    // 1.24 pages a day: 16 / 1.24 = 12.9 -> 13, 20 / 1.24 = 16.1 -> 17, 4 / 1.24 = 3.2 -> 4
    expect(chapterWorkDays(s, 16)).toBe(13)
    expect(chapterWorkDays(s, 20)).toBe(17)
    expect(chapterWorkDays(s, 4)).toBe(4)
    // 13 x 1.25 = 16.25
    expect(deadlineStatus(13, 21)).toBe('on-track')
    expect(deadlineStatus(13, 17)).toBe('on-track')
    expect(deadlineStatus(13, 16)).toBe('tight')
    expect(deadlineStatus(13, 13)).toBe('tight')
    expect(deadlineStatus(13, 12)).toBe('late')
  })

  it('reports no deadline without a running serial chapter on the desk', () => {
    expect(chapterDeadline(createGame('Rin', 4))).toBeNull()
    expect(chapterDeadline(startProject(createGame('Rin', 4), draft))).toBeNull()
    expect(chapterDeadline(endSerial(kidsSerial()))).toBeNull()
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
    expect(lastLine(s).kind).toBe('warn')
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
    let s = withStats(noDeadline(acceptOffer(dismissResult(strongOneShot()))), 5)
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

  it('draws exactly 2 + entrants x 2 values from the seed for a one-shot poll, and scores pacing noise at PACING_NOISE_SD', () => {
    const s = drawUntilReady()
    const mag = magazineById('kids-comic')
    const { values, seed: wantSeed } = draw(s.seed, 2 + mag.entrants * 2)
    const { result, seed } = evaluateProject(s, s.project!, 'kids-comic')
    // RNG discipline: a poll always draws 2 + entrants x 2 values, whatever the pacing/rival scale is.
    expect(seed).toBe(wantSeed)
    const expectedPacing = clamp(Math.round(s.player.stats.pacing + gaussian(values[0], values[1]) * PACING_NOISE_SD), 0, 100)
    expect(result.breakdown.pacing).toBe(expectedPacing)
  })

  it('draws exactly 2 + entrants x 2 values from the seed for a chapter poll, and scores pacing noise at PACING_NOISE_SD', () => {
    const s = acceptOffer(dismissResult(strongOneShot()))
    const ser = s.serial!
    const pc: PendingChapter = { chapter: 1, pages: CHAPTER_PAGES, artQ: 50, storyQ: 50, submittedDay: s.day, resultsDay: s.day + 7 }
    const mag = magazineById(ser.magazineId)
    const { values, seed: wantSeed } = draw(s.seed, 2 + mag.entrants * 2)
    const { result, seed } = evaluateChapter(s, ser, pc)
    expect(seed).toBe(wantSeed)
    const expectedPacing = clamp(Math.round(s.player.stats.pacing + gaussian(values[0], values[1]) * PACING_NOISE_SD), 0, 100)
    expect(result.breakdown.pacing).toBe(expectedPacing)
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

  it('sells round((circulation x 20 + 40 x sqrt(fans)) x popularity / 100) copies a volume', () => {
    const s = createGame('Rin', 1)
    const withFans = (fans: number) => ({ ...s, player: { ...s.player, fans } })
    const kids = magazineById('kids-comic') // circulation 120
    // no fans: (2,400 + 0) x 50 / 100 = 1,200
    expect(volumeCopies(s, kids, 50)).toBe(1200)
    // 2,500 fans: (2,400 + 40 x 50) x 80 / 100 = 4,400 x 0.8 = 3,520
    expect(volumeCopies(withFans(2500), kids, 80)).toBe(3520)
    // 1,000 fans: 40 x sqrt(1,000) = 1,264.91; (2,400 + 1,264.91) x 0.65 = 2,382.19, rounds to 2,382
    expect(volumeCopies(withFans(1000), kids, 65)).toBe(2382)
    // 10,000 fans at Weekly Bolt (circulation 180): (3,600 + 40 x 100) x 70 / 100 = 7,600 x 0.7 = 5,320
    expect(volumeCopies(withFans(10_000), magazineById('weekly-bolt'), 70)).toBe(5320)
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
    let s = withStats(noDeadline(acceptOffer(dismissResult(strongOneShot()))), 5)
    let guard = 0
    let seen = 0
    while (s.serial && s.serial.status === 'running' && guard++ < 900) {
      const prev = s.serial.warnings
      s = autoDay(s)
      const ser = s.serial ?? s.serials[0]
      if (ser.results.length > seen) {
        seen = ser.results.length
        const r = ser.results[seen - 1]
        // The first SERIAL_GRACE_CHAPTERS results never warn, even when weak.
        expect(ser.warnings).toBe(seen > SERIAL_GRACE_CHAPTERS && r.rank >= firstWeak(r.entrants) ? prev + 1 : 0)
      }
    }
    expect(seen).toBeGreaterThanOrEqual(3)
  })
})

describe('editor comments', () => {
  it('names the pairing that never clicked when freshness is the biggest loss', () => {
    // At 90 in every stat, art, story and pacing lose little; Horror x Cooking freshness loses the most at Ultra Seinen
    const s = drawUntilReady(startProject(withStats(createGame('Rin', 42), 90), { title: 'Bad Soup', genre: 'horror', theme: 'cooking', audience: 'adults' }))
    const { result } = evaluateProject(s, s.project!, 'ultra-seinen')
    expect(result.editorComment).toContain('Horror and Cooking')
    expect(result.editorComment).not.toContain('seen this pairing')
    // The same pairing again is stale, and the editor says so instead.
    const again = evaluateProject({ ...s, history: [result] }, s.project!, 'ultra-seinen').result
    expect(again.editorComment).toContain('seen this pairing')
  })

  it('names both audiences when the magazine mismatch is the biggest loss', () => {
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

/** the tick's last log line before the badges (the last step of every tick) */
function lastLine(s: GameState) {
  return s.log.filter((e) => !e.text.startsWith('Badge:')).at(-1)!
}

describe('Task C places: the Manga Museum and the Mountain Retreat', () => {
  it('both are listed on the Trips panel (not event-only); the signing is event-only', () => {
    const listed = PLACES.filter((p) => !p.eventOnly).map((p) => p.id)
    expect(listed).toContain('manga-museum')
    expect(listed).toContain('mountain-retreat')
    expect(placeById('signing').eventOnly).toBe(true)
    expect(placeById('manga-museum')).toMatchObject({ days: 3, cost: 700 })
    expect(placeById('mountain-retreat')).toMatchObject({ days: 5, cost: 1500 })
  })

  it('the museum reveals the first unknown pairing of the first genre never drawn, drawing no RNG', () => {
    // one action one-shot in the history: action is drawn, so the museum skips to romance x school
    let s: GameState = { ...createGame('Rin', 1), day: 10 }
    s = { ...s, history: [{ ...strongOneShot().history[0], genre: 'action' }] }
    const back = tickMany(startTrip(s, 'manga-museum'), 3)
    expect(back.trip).toBeNull()
    expect(back.notebook.genreTheme[genreThemeKey('romance', 'school')]).toBe(genreThemeRating(s.worldSeed, 'romance', 'school'))
    expect(Object.keys(back.notebook.genreTheme)).toHaveLength(1)
    expect(back.player.money).toBe(s.player.money - 700)
    expect(back.seed).toBe(s.seed)
  })

  it('the museum falls back to any unknown pairing once every undrawn genre is known', () => {
    const s = createGame('Rin', 1)
    const genreTheme: Record<string, Rating> = {}
    for (const g of GENRES) for (const t of THEMES) if (g.id !== 'action') genreTheme[genreThemeKey(g.id, t.id)] = 2
    const known = { ...s, history: [{ ...strongOneShot().history[0], genre: 'action' as const }], notebook: { ...s.notebook, genreTheme } }
    const back = tickMany(startTrip(known, 'manga-museum'), 3)
    expect(back.notebook.genreTheme[genreThemeKey('action', 'school')]).toBeDefined()
  })

  it('the retreat restores stamina and adds 5 max stamina, never above 150', () => {
    const s = { ...createGame('Rin', 1), day: 10 }
    const tired = { ...s, player: { ...s.player, stamina: 30 } }
    const back = tickMany(startTrip(tired, 'mountain-retreat'), 5)
    expect(back.player).toMatchObject({ maxStamina: 105, stamina: 105 })
    const near = { ...s, player: { ...s.player, maxStamina: 148, stamina: 10 } }
    expect(tickMany(startTrip(near, 'mountain-retreat'), 5).player).toMatchObject({ maxStamina: RETREAT_MAX_STAMINA_CAP, stamina: 150 })
    const over = { ...s, player: { ...s.player, maxStamina: 160, stamina: 10 } }
    expect(tickMany(startTrip(over, 'mountain-retreat'), 5).player).toMatchObject({ maxStamina: 160, stamina: 160 })
  })
})

describe('Task C editor personas', () => {
  it('every magazine has a persona, a line saying what it does, and a tip cadence (Sato 2, Kuroda 4, others 3)', () => {
    expect(MAGAZINES.map((m) => [m.editor, m.persona, m.tipEvery])).toEqual([
      ['Tanaka', 'deadline hawk', 3], ['Sato', 'mentor', 2], ['Kuroda', 'critic', 4], ['Mori', 'cheerleader', 3],
    ])
    for (const m of MAGAZINES) expect(m.personaLine).toContain(m.editor)
  })

  it('tips land every tipEvery relationship points', () => {
    const s = createGame('Rin', 1)
    const tipsAt = (id: MagazineId, points: number) => {
      let x = s
      for (let i = 0; i < points; i++) x = bumpEditor(x, id, 1)
      return x.editors[id].tips
    }
    expect(tipsAt('monthly-petal', 4)).toBe(2)
    expect(tipsAt('ultra-seinen', 4)).toBe(1)
    expect(tipsAt('ultra-seinen', 3)).toBe(0)
    expect(tipsAt('kids-comic', 6)).toBe(2)
  })

  it("Kuroda's results comment quotes the points the costliest component lost; the others' do not", () => {
    const ready = drawUntilReady(startProject(createGame('Rin', 42), draft))
    const kuroda = evaluateProject(ready, ready.project!, 'ultra-seinen').result
    const worst = biggestLoss(kuroda.breakdown, magazineById('ultra-seinen').taste)
    const lost = pointsLost(kuroda.breakdown, magazineById('ultra-seinen').taste, worst)
    expect(kuroda.editorComment.endsWith(` That cost you ${lost} points.`)).toBe(true)
    expect(evaluateProject(ready, ready.project!, 'weekly-bolt').result.editorComment).not.toContain('That cost you')
  })

  it('Tanaka logs (no toast) the day a Weekly Bolt chapter deadline turns tight', () => {
    // a Weekly Bolt serial whose chapter is due in 14 days with nothing drawn and the mangaka resting: each idle day
    // brings the due day closer until the pages no longer fit with rest days
    const offer = { magazineId: 'weekly-bolt', title: 'Bolt Club', genre: 'action', theme: 'samurai', audience: 'teens' } as const
    const accepted = setActivity(acceptOffer({ ...createGame('Rin', 1), pendingOffer: offer }), 'rest')
    // half the pages already drawn, so the deadline starts on track
    let s: GameState = { ...accepted, project: { ...accepted.project!, pagesDone: 8 } }
    expect(chapterDeadline(s)!.status).toBe('on-track')
    const turned: LogEntry[] = []
    for (let i = 0; i < 14; i++) {
      const before = chapterDeadline(s)!.status
      const next = tick(s)
      const after = chapterDeadline(next)?.status
      const hawk = next.log.filter((e) => e.id >= s.nextLogId && e.text.startsWith('Tanaka calls'))
      if (before === 'on-track' && after && after !== 'on-track') expect(hawk).toHaveLength(1)
      else expect(hawk).toHaveLength(0)
      turned.push(...hawk)
      s = next
    }
    expect(turned).toHaveLength(1)
    expect(turned[0]).toMatchObject({ kind: 'warn', toast: false })
  })
})
