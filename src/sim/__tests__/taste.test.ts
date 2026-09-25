import { describe, expect, it } from 'vitest'
import {
  MAGAZINES, SCORE_WEIGHTS, acceptOffer, biggestLoss, createGame, evaluateChapter, evaluateProject, magazineById,
  setFocus, startProject, suitedFocus, weightedScore,
} from '../index'
import type { GameState, MagazineId, PendingChapter, ScoreBreakdown } from '../index'
import { DRAFT, drawUntilReady } from '../../test/fixtures'

const KIDS_DRAFT = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'kids' } as const
const b = (art: number, story: number, pacing: number, audienceFit: number, freshness: number): ScoreBreakdown =>
  ({ art, story, pacing, audienceFit, freshness })
const taste = (id: MagazineId) => magazineById(id).taste

describe('magazine taste', () => {
  it('gives every magazine, and the default, weights that sum to 100', () => {
    const sum = (w: typeof SCORE_WEIGHTS) => w.art + w.story + w.pacing + w.audienceFit + w.freshness
    expect(sum(SCORE_WEIGHTS)).toBe(100)
    for (const m of MAGAZINES) expect(sum(m.taste)).toBe(100)
  })

  it('pins the table: Bolt and Kids want art, Petal and Ultra want story', () => {
    expect(SCORE_WEIGHTS).toEqual({ art: 25, story: 25, pacing: 15, audienceFit: 15, freshness: 20 })
    expect(taste('weekly-bolt')).toEqual({ art: 35, story: 15, pacing: 20, audienceFit: 10, freshness: 20 })
    expect(taste('monthly-petal')).toEqual({ art: 15, story: 35, pacing: 10, audienceFit: 20, freshness: 20 })
    expect(taste('ultra-seinen')).toEqual({ art: 15, story: 35, pacing: 20, audienceFit: 10, freshness: 20 })
    expect(taste('kids-comic')).toEqual({ art: 35, story: 15, pacing: 10, audienceFit: 20, freshness: 20 })
    expect(magazineById('weekly-bolt').tasteLine).toBe('Readers love big art and fast pacing.')
    expect(magazineById('monthly-petal').tasteLine).toBe('Readers want a story, and a manga made for them.')
    expect(magazineById('ultra-seinen').tasteLine).toBe('Readers prize story and pacing.')
    expect(magazineById('kids-comic').tasteLine).toBe('Readers love bright art, and a manga made for them.')
  })

  it('weighs the same breakdown differently at each magazine', () => {
    const x = b(60, 40, 30, 60, 80)
    // 60x35 + 40x15 + 30x20 + 60x10 + 80x20 = 2100 + 600 + 600 + 600 + 1600 = 5500
    expect(weightedScore(x, taste('weekly-bolt'))).toBe(55)
    // 60x15 + 40x35 + 30x10 + 60x20 + 80x20 = 900 + 1400 + 300 + 1200 + 1600 = 5400
    expect(weightedScore(x, taste('monthly-petal'))).toBe(54)
    // 60x15 + 40x35 + 30x20 + 60x10 + 80x20 = 900 + 1400 + 600 + 600 + 1600 = 5100
    expect(weightedScore(x, taste('ultra-seinen'))).toBe(51)
    // 60x35 + 40x15 + 30x10 + 60x20 + 80x20 = 2100 + 600 + 300 + 1200 + 1600 = 5800
    expect(weightedScore(x, taste('kids-comic'))).toBe(58)
    // 60x25 + 40x25 + 30x15 + 60x15 + 80x20 = 1500 + 1000 + 450 + 900 + 1600 = 5450, 54.5 rounds up
    expect(weightedScore(x, SCORE_WEIGHTS)).toBe(55)
    expect(weightedScore(x)).toBe(55)
  })

  it('rounds half up and clamps to 0..100', () => {
    // 49x35 + 49x15 + 30x10 + 60x20 + 60x20 = 1715 + 735 + 300 + 1200 + 1200 = 5150, 51.5 rounds up
    expect(weightedScore(b(49, 49, 30, 60, 60), taste('kids-comic'))).toBe(52)
    expect(weightedScore(b(100, 100, 100, 100, 100), taste('ultra-seinen'))).toBe(100)
    expect(weightedScore(b(0, 0, 0, 0, 0), taste('ultra-seinen'))).toBe(0)
  })

  it('rewards a plan made for Kids Comic Go! and punishes one that ignores it', () => {
    // art focus (40 x 1.25 = 50, 34 x 0.8 = 27.2), Great fit, Great freshness:
    // 50x35 + 27x15 + 30x10 + 80x20 + 80x20 = 1750 + 405 + 300 + 1600 + 1600 = 5655, 56.55 rounds up
    expect(weightedScore(b(50, 27, 30, 80, 80), taste('kids-comic'))).toBe(57)
    // story focus (40 x 0.8 = 32, 34 x 1.25 = 42.5), Good fit minus the 25 mismatch, Meh freshness:
    // 32x35 + 43x15 + 30x10 + 15x20 + 40x20 = 1120 + 645 + 300 + 300 + 800 = 3165, 31.65 rounds up
    expect(weightedScore(b(32, 43, 30, 15, 40), taste('kids-comic'))).toBe(32)
  })

  it('scores one-shots and chapters with the magazine they run in', () => {
    const s = drawUntilReady(startProject(createGame('Rin', 42), DRAFT))
    const pc: PendingChapter = { chapter: 3, pages: 16, artQ: 55, storyQ: 35, submittedDay: s.day, resultsDay: s.day + 7 }
    const differs: MagazineId[] = []
    for (const m of MAGAZINES) {
      const shot = evaluateProject(s, s.project!, m.id).result
      expect(shot.score).toBe(weightedScore(shot.breakdown, m.taste))
      if (shot.score !== weightedScore(shot.breakdown)) differs.push(m.id)

      const running = acceptOffer({ ...s, project: null, pendingOffer: { ...DRAFT, magazineId: m.id } })
      const chapter = evaluateChapter(running, running.serial!, pc).result
      expect(chapter.score).toBe(weightedScore(chapter.breakdown, m.taste))
    }
    // the default weights would score this manuscript differently somewhere, so the magazine's taste is in use
    expect(differs.length).toBeGreaterThan(0)
  })

  it('makes art focus pay at Kids Comic Go! and story focus pay at Monthly Petal (seeds 1-20)', () => {
    let kidsGap = 0
    let petalGap = 0
    for (let seed = 1; seed <= 20; seed++) {
      const start = startProject(createGame('Rin', seed), KIDS_DRAFT)
      const art = drawUntilReady(setFocus(start, 'art'))
      const story = drawUntilReady(setFocus(start, 'story'))
      // focus changes quality, not pages: both runs drew the same days from the same RNG stream
      expect(story.day).toBe(art.day)
      expect(story.seed).toBe(art.seed)
      const score = (s: GameState, m: MagazineId) => evaluateProject(s, s.project!, m).result.score
      kidsGap += score(art, 'kids-comic') - score(story, 'kids-comic')
      petalGap += score(story, 'monthly-petal') - score(art, 'monthly-petal')
    }
    // art focus moves art by 40 x (1.25 - 0.8) = +18 and story by 34 x (0.8 - 1.25) = -15.3.
    // Kids: (35 x 18 - 15 x 15.3) / 100 = 4.005; Petal: (35 x 15.3 - 15 x 18) / 100 = 2.655 the other way.
    // Each is asserted within about 0.5 of that expectation (page noise and rounding move the measured mean).
    expect(kidsGap / 20).toBeGreaterThanOrEqual(3.5)
    expect(kidsGap / 20).toBeLessThanOrEqual(4.5)
    expect(petalGap / 20).toBeGreaterThanOrEqual(2.15)
    expect(petalGap / 20).toBeLessThanOrEqual(3.15)
  })
})

describe('suitedFocus', () => {
  it('suits whichever of art and story the taste weighs higher, balanced on a tie', () => {
    expect(suitedFocus(taste('weekly-bolt'))).toBe('art')
    expect(suitedFocus(taste('kids-comic'))).toBe('art')
    expect(suitedFocus(taste('monthly-petal'))).toBe('story')
    expect(suitedFocus(taste('ultra-seinen'))).toBe('story')
    // the default weighs art and story 25 each
    expect(suitedFocus(SCORE_WEIGHTS)).toBe('balanced')
  })
})

describe('biggestLoss', () => {
  it('names the component that cost the most points at this magazine', () => {
    const x = b(40, 40, 60, 60, 60)
    // Bolt: art 35 x 60 = 2100, story 15 x 60 = 900, pacing 20 x 40 = 800, fit 10 x 40 = 400, freshness 20 x 40 = 800
    expect(biggestLoss(x, taste('weekly-bolt'))).toBe('art')
    // Petal: art 15 x 60 = 900, story 35 x 60 = 2100, pacing 10 x 40 = 400, fit 20 x 40 = 800, freshness 800
    expect(biggestLoss(x, taste('monthly-petal'))).toBe('story')
  })

  it('breaks ties in the order art, story, pacing, audience fit, freshness', () => {
    // Bolt: story 15 x 60 = 900 ties pacing 20 x 45 = 900; the rest lose nothing
    expect(biggestLoss(b(100, 40, 55, 100, 100), taste('weekly-bolt'))).toBe('story')
    // default: every component 50 short; art 25 x 50 = 1250 ties story 25 x 50
    expect(biggestLoss(b(50, 50, 50, 50, 50), SCORE_WEIGHTS)).toBe('art')
    // Kids: fit 20 x 50 = 1000 ties freshness 20 x 50 = 1000; art, story and pacing are perfect
    expect(biggestLoss(b(100, 100, 100, 50, 50), taste('kids-comic'))).toBe('audienceFit')
    // nothing lost anywhere: art, the first key
    expect(biggestLoss(b(100, 100, 100, 100, 100), taste('ultra-seinen'))).toBe('art')
  })

  it('drives the editor comment: the same manuscript gets a different note at Kids and at Petal', () => {
    const s = drawUntilReady(startProject(createGame('Rin', 42), DRAFT))
    const p = { ...s.project!, artSum: 20 * s.project!.pagesDone, storySum: 20 * s.project!.pagesDone }
    // art and story both 20. Kids loses 35 x 80 = 2800 on art, Petal 35 x 80 = 2800 on story; nothing else can
    // lose that much (fit 20 x 100 = 2000 at most, freshness 20 x 80 = 1600, pacing 20 x 76 = 1520)
    expect(evaluateProject(s, p, 'kids-comic').result.editorComment).toContain('The linework is holding you back')
    expect(evaluateProject(s, p, 'monthly-petal').result.editorComment).toContain('the plot loses them halfway')
  })
})
