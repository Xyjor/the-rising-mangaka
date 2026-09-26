import { describe, expect, it } from 'vitest'
import {
  CHAPTER_PAGES, WEEKLY_LIVING_COST, acceptOffer, createGame, dismissResult, evaluateChapter, evaluateProject,
  magazineById, pollPay, startProject, submitProject, tickMany,
} from '../index'
import type { GameState, PendingChapter } from '../index'
import { DRAFT as draft, drawUntilReady, withStats } from '../../test/fixtures'

/** A strong, resolved Weekly Bolt one-shot, ready to accept a serial offer from. */
function strongOneShot(): GameState {
  let s = withStats(createGame('Rin', 42), 90)
  s = drawUntilReady(startProject(s, draft))
  s = submitProject(s, 'weekly-bolt')
  s = tickMany(s, 7)
  return s
}

describe('pollPay', () => {
  // Formula: round(pageRate x pages x score x RANK_MULTIPLIER_PCT[tier] / 8000). Every case below is
  // multiplied out by hand, not by calling the code under test.

  it('pays a weak-finish Weekly Bolt one-shot: 110 x 20 x 45 x 70 / 8000 = 6,930,000 / 8000 = 866.25 -> 866', () => {
    const mag = magazineById('weekly-bolt')
    expect(pollPay(mag, 20, 45, 13, 13)).toBe(866)
  })

  it('pays a podium Kids Comic one-shot: 90 x 20 x 52 x 140 / 8000 = 13,104,000 / 8000 = 1,638', () => {
    const mag = magazineById('kids-comic')
    expect(pollPay(mag, 20, 52, 2, 11)).toBe(1638)
  })

  it('pays a first-place Weekly Bolt one-shot: 110 x 20 x 70 x 200 / 8000 = 30,800,000 / 8000 = 3,850', () => {
    const mag = magazineById('weekly-bolt')
    expect(pollPay(mag, 20, 70, 1, 13)).toBe(3850)
  })

  it('pays a mid-table Monthly Petal one-shot: 130 x 20 x 50 x 100 / 8000 = 13,000,000 / 8000 = 1,625', () => {
    const mag = magazineById('monthly-petal')
    expect(pollPay(mag, 20, 50, 4, 9)).toBe(1625)
  })

  it('pays a mid-table Kids Comic chapter: 90 x 16 x 50 x 100 / 8000 = 7,200,000 / 8000 = 900', () => {
    const mag = magazineById('kids-comic')
    expect(pollPay(mag, CHAPTER_PAGES, 50, 5, 11)).toBe(900)
  })

  it('rounds an exact x.5 last place up, not down: 110 x 20 x 50 x 70 / 8000 = 7,700,000 / 8000 = 962.5 -> 963', () => {
    const mag = magazineById('weekly-bolt')
    const pay = pollPay(mag, 20, 50, 13, 13)
    expect(pay).toBe(963)
    // A weak last-place finish should still stay well under a month's living cost.
    expect(pay).toBeLessThan(3 * WEEKLY_LIVING_COST)
  })

  it('pays a one-shot poll exactly what pollPay says for its own score, rank and entrants', () => {
    const s = drawUntilReady(startProject(withStats(createGame('Rin', 42), 60), draft))
    const mag = magazineById('weekly-bolt')
    const { result } = evaluateProject(s, s.project!, 'weekly-bolt')
    expect(result.rewards.money).toBe(pollPay(mag, s.project!.pagesDone, result.score, result.rank, result.entrants))
  })

  it('pays a chapter poll exactly what pollPay says for its own score, rank and entrants', () => {
    const s = acceptOffer(dismissResult(strongOneShot()))
    const ser = s.serial!
    const mag = magazineById(ser.magazineId)
    const pc: PendingChapter = { chapter: 1, pages: CHAPTER_PAGES, artQ: 50, storyQ: 50, submittedDay: s.day, resultsDay: s.day + 7 }
    const { result } = evaluateChapter(s, ser, pc)
    expect(result.rewards.money).toBe(pollPay(mag, pc.pages, result.score, result.rank, result.entrants))
  })
})
