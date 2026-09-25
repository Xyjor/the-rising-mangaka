import { describe, expect, it } from 'vitest'
import { acceptOffer, createGame, startProject, submitProject } from '../index'
import type { ChapterResult, GameState, PollResult } from '../index'
import { CARELESS, SENSIBLE, STRESS_BOLT, botStep, runBot } from '../bot'
import { DRAFT, drawUntilReady, withPendingResult } from '../../test/fixtures'

const OFFER = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const

/** Fantasy x magic rated Perfect, magic for kids rated Great, as if both had been tested already. */
function withMagicNotebook(s: GameState): GameState {
  return { ...s, notebook: { genreTheme: { 'fantasy|magic': 4 }, themeAudience: { 'magic|kids': 3 } } }
}

/** A real poll result relabelled as a fantasy x magic one-shot, for staleness. */
function fantasyMagicResult(): PollResult {
  return { ...withPendingResult().pendingResult!, genre: 'fantasy', theme: 'magic', audience: 'kids' }
}

/** A running serial with `results` chapters polled at `popularity`, and chapter results + 1 on the desk. */
function serialWith(results: number, popularity: number): GameState {
  const s = acceptOffer({ ...createGame('Rin', 42), pendingOffer: OFFER })
  const r: ChapterResult = {
    chapter: 1, day: 1, score: 60, rank: 4, entrants: 11,
    breakdown: { art: 60, story: 60, pacing: 60, audienceFit: 60, freshness: 60 },
    rewards: { money: 1000, fans: 100, xp: 50 },
  }
  const done = Array.from({ length: results }, (_, i) => ({ ...r, chapter: i + 1 }))
  return { ...s, serial: { ...s.serial!, results: done, chaptersSent: results, popularity } }
}

describe('balance bot', () => {
  it('runs the same career twice for the same seed', () => {
    const a = runBot(42, SENSIBLE, { days: 200 })
    const b = runBot(42, SENSIBLE, { days: 200 })
    expect(a).toEqual(b)
    expect(a.final.day).toBe(200)
    // day 0 plus one entry per simulated day
    expect(a.moneyAtDay).toHaveLength(201)
    expect(a.moneyAtDay[0]).toBe(3000)
  })

  it('stops at maxOneShots when that comes before the day limit', () => {
    const run = runBot(42, SENSIBLE, { days: 336, maxOneShots: 2 })
    expect(run.oneShots).toHaveLength(2)
    expect(run.final.day).toBeLessThan(336)
    // the run ends on the day the second poll lands
    expect(run.final.day).toBe(run.oneShots[1].day)
  })

  it('stops at the day limit when that comes first', () => {
    const run = runBot(42, CARELESS, { days: 30, maxOneShots: 6 })
    expect(run.final.day).toBe(30)
    // one 20-page one-shot takes 17 days to draw and 7 to poll: exactly one result by day 30
    expect(run.oneShots).toHaveLength(1)
  })

  it('sensible spends every point: every third point on pacing, the rest on art', () => {
    const s = createGame('Rin', 42)
    const next = botStep({ ...s, player: { ...s.player, skillPoints: 5 } }, SENSIBLE)
    // 5 art 40, 4 art 42, 3 pacing 32, 2 art 44, 1 art 46
    expect(next.player.stats).toEqual({ art: 46, story: 34, pacing: 32 })
    expect(next.player.skillPoints).toBe(0)
  })

  it('careless never spends its points', () => {
    const run = runBot(42, CARELESS, { days: 200 })
    expect(run.final.player.skillPoints).toBeGreaterThanOrEqual(3)
    expect(run.final.player.stats).toEqual({ art: 38, story: 34, pacing: 30 })
  })

  it('sensible plans the best known pairing for the magazine with the best odds', () => {
    const s = withMagicNotebook(createGame('Rin', 42))
    const plan = SENSIBLE.planDraft(s)
    expect(plan.draft).toMatchObject({ genre: 'fantasy', theme: 'magic', audience: 'kids' })
    // estimate 55 against a rival mean of 45 at Kids Comic Go!: about a 0.68 chance of an offer, the best of the four
    expect(plan.target).toBe('kids-comic')
  })

  it('sensible drops a pairing it has used in each of its last three one-shots', () => {
    const r = fantasyMagicResult()
    const twice = { ...withMagicNotebook(createGame('Rin', 42)), history: [r, r] }
    // 100 + 80 - 2 x 15 = 150 still beats an untested genre with magic for kids (57 + 80 = 137)
    expect(SENSIBLE.planDraft(twice).draft).toMatchObject({ genre: 'fantasy', theme: 'magic', audience: 'kids' })
    // 100 + 80 - 3 x 15 = 135 does not
    const thrice = SENSIBLE.planDraft({ ...twice, history: [r, r, r] }).draft
    expect(thrice.genre).not.toBe('fantasy')
    expect(thrice).toMatchObject({ theme: 'magic', audience: 'kids' })
  })

  it('sensible pitches the seed-42 teens manuscript where an offer is least unlikely', () => {
    const s = drawUntilReady(startProject(createGame('Rin', 42), DRAFT))
    // estimates: Weekly Bolt 43 vs 58, Kids Comic Go! 39 vs 45, Monthly Petal 39 vs 52, Ultra Seinen 39 vs 62
    expect(SENSIBLE.pickMagazine(s)).toBe('kids-comic')
  })

  it('takes shifts after submitting only while money is under two weeks of costs', () => {
    const submitted = submitProject(drawUntilReady(startProject(createGame('Rin', 42), DRAFT)), 'weekly-bolt')
    const at = (money: number, stamina: number) => ({ ...submitted, player: { ...submitted.player, money, stamina } })
    // 799 < 800: a shift pays 120 and costs 3 stamina
    const poor = botStep(at(799, 50), SENSIBLE)
    expect(poor.activity).toBe('job')
    expect(poor.player).toMatchObject({ money: 919, stamina: 47 })
    // 800 is two full weeks: rest, +14 stamina
    const ok = botStep(at(800, 50), SENSIBLE)
    expect(ok.activity).toBe('rest')
    expect(ok.player).toMatchObject({ money: 800, stamina: 64 })
    // 40 stamina is enough for a shift, 39 is not
    expect(botStep(at(799, 40), SENSIBLE).activity).toBe('job')
    expect(botStep(at(799, 39), SENSIBLE).activity).toBe('rest')
  })

  it('draws from 20 stamina, rests under it, and lets a collapse recover to 60%', () => {
    const drawing = startProject(createGame('Rin', 42), DRAFT)
    const at = (stamina: number, recovering = false) =>
      ({ ...drawing, recovering, player: { ...drawing.player, stamina } })
    // 20 - 5 = 15 after a working day
    const worked = botStep(at(20), SENSIBLE)
    expect(worked.activity).toBe('work')
    expect(worked.player.stamina).toBe(15)
    expect(worked.project!.pagesDone).toBeGreaterThan(0)
    // 19 + 14 = 33 after resting
    const rested = botStep(at(19), SENSIBLE)
    expect(rested.player.stamina).toBe(33)
    expect(rested.project!.pagesDone).toBe(0)
    // recovering at 30: rest to 44 and stay in recovery (it ends at 60)
    const recovering = botStep({ ...at(30, true), activity: 'rest' }, SENSIBLE)
    expect(recovering).toMatchObject({ activity: 'rest', recovering: true })
    expect(recovering.player.stamina).toBe(44)
  })

  it('records the first organic offer and accepts it the step after the poll', () => {
    const run = runBot(42, SENSIBLE, { days: 200 })
    expect(run.firstOfferAt).not.toBeNull()
    const i = run.firstOfferAt! - 1
    expect(run.oneShots.slice(0, i).every((o) => !o.offer)).toBe(true)
    expect(run.oneShots[i].offer).toBe(true)
    expect(run.serials[0]).toMatchObject({ magazineId: run.oneShots[i].magazineId, startedDay: run.oneShots[i].day })
    for (const o of run.oneShots) expect(run.moneyAtDay[o.day]).toBe(o.money)
  })

  it('careless ignores the notebook and pitches where it planned', () => {
    const s = createGame('Rin', 42)
    const plan = CARELESS.planDraft(s)
    expect(CARELESS.planDraft(withMagicNotebook(s))).toEqual(plan)
    expect(CARELESS.pickMagazine(startProject(s, plan.draft))).toBe(plan.target)
  })

  it('accepts an organic offer and wraps the serial at 16 results with popularity 50', () => {
    const accepted = botStep({ ...createGame('Rin', 42), pendingOffer: OFFER }, SENSIBLE)
    expect(accepted.serial).toMatchObject({ magazineId: 'kids-comic', status: 'running' })
    expect(botStep(serialWith(15, 50), SENSIBLE).serial?.status).toBe('running')
    expect(botStep(serialWith(16, 49), SENSIBLE).serial?.status).toBe('running')
    const wrapped = botStep(serialWith(16, 50), SENSIBLE)
    expect(wrapped.serial).toBeNull()
    expect(wrapped.serials[0].status).toBe('ended')
  })

  it('stress case: six rotating one-shots, then one forced Weekly Bolt serial, organic offers declined', () => {
    const run = runBot(42, STRESS_BOLT, { days: 480 })
    expect(run.oneShots.slice(0, 6).map((o) => o.magazineId)).toEqual([
      'weekly-bolt', 'kids-comic', 'monthly-petal', 'ultra-seinen', 'weekly-bolt', 'kids-comic',
    ])
    expect(run.final.history.slice(0, 6).map((r) => `${r.genre}/${r.theme}/${r.audience}`)).toEqual([
      'action/samurai/teens', 'mystery/detective/adults', 'horror/cooking/kids',
      'romance/school/teens', 'action/samurai/teens', 'scifi/space/young-adults',
    ])
    expect(run.serials).toHaveLength(1)
    expect(run.serials[0]).toMatchObject({ magazineId: 'weekly-bolt', startedDay: run.oneShots[5].day })
    expect(run.final.player.stats).toEqual({ art: 38, story: 34, pacing: 30 })
  })
})
