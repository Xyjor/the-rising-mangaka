import { describe, expect, it } from 'vitest'
import { acceptOffer, createGame, startProject, submitProject } from '../index'
import type { Assistant, AssistantTrait, ChapterResult, GameState, PollResult } from '../index'
import { CARELESS, SENSIBLE, STRESS_BOLT, botStep, firstSixMean, runBot } from '../bot'
import type { BotRun } from '../bot'
import { DRAFT, drawUntilReady, withPendingResult, withReadyOneShot } from '../../test/fixtures'

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

  it('sensible spends every point: every third point on pacing, the rest on art while it aims at Kids Comic Go!', () => {
    const s = createGame('Rin', 42)
    // a fresh seed-42 career plans its first one-shot for Kids Comic Go! (art 35%, story 15%)
    expect(SENSIBLE.planDraft(s).target).toBe('kids-comic')
    const next = botStep({ ...s, player: { ...s.player, skillPoints: 5 } }, SENSIBLE)
    // from art 40: 5 art 42, 4 art 44, 3 pacing 32, 2 art 46, 1 art 48
    expect(next.player.stats).toEqual({ art: 48, story: 34, pacing: 32 })
    expect(next.player.skillPoints).toBe(0)
  })

  it('sensible favours story while its serial runs in Monthly Petal (story 35%, art 15%)', () => {
    const petal = { ...OFFER, magazineId: 'monthly-petal', audience: 'young-adults' } as const
    const s = acceptOffer({ ...createGame('Rin', 42), pendingOffer: petal })
    const next = botStep({ ...s, player: { ...s.player, skillPoints: 5 } }, SENSIBLE)
    // from story 34: 5 story 36, 4 story 38, 3 pacing 32, 2 story 40, 1 story 42; art stays at the starting 40
    expect(next.player.stats).toEqual({ art: 40, story: 42, pacing: 32 })
  })

  it('sensible favours story while its one-shot waits on a Monthly Petal poll', () => {
    // with nothing pitched the next plan would aim at Kids Comic Go! (art); the manuscript already sent decides
    const sent = submitProject(drawUntilReady(startProject(createGame('Rin', 42), DRAFT)), 'monthly-petal')
    const next = botStep({ ...sent, player: { ...sent.player, skillPoints: 5 } }, SENSIBLE)
    // the same spend as above: story 34 -> 42 and pacing 30 -> 32, art stays at 40
    expect(next.player.stats).toEqual({ art: 40, story: 42, pacing: 32 })
  })

  it('sensible draws with the focus the magazine weighs higher', () => {
    const s = createGame('Rin', 42)
    expect(SENSIBLE.focusFor(s, 'weekly-bolt')).toBe('art')
    expect(SENSIBLE.focusFor(s, 'kids-comic')).toBe('art')
    expect(SENSIBLE.focusFor(s, 'monthly-petal')).toBe('story')
    expect(SENSIBLE.focusFor(s, 'ultra-seinen')).toBe('story')
    // the focus follows the pick into the drawing: the fresh seed-42 plan aims at Kids, so it draws with art focus
    expect(botStep(s, SENSIBLE)).toMatchObject({ focus: 'art', project: { audience: 'kids' } })
  })

  it('careless never spends its points', () => {
    const run = runBot(42, CARELESS, { days: 200 })
    expect(run.final.player.skillPoints).toBeGreaterThanOrEqual(3)
    // createGame's starting stats, untouched
    expect(run.final.player.stats).toEqual({ art: 40, story: 34, pacing: 30 })
  })

  it('sensible plans the best known pairing for the magazine with the best odds', () => {
    const s = withMagicNotebook(createGame('Rin', 42))
    const plan = SENSIBLE.planDraft(s)
    expect(plan.draft).toMatchObject({ genre: 'fantasy', theme: 'magic', audience: 'kids' })
    // art focus at Kids Comic Go! (40 x 1.25 = 50, 34 x 0.8 = 27.2): 50x35 + 27x15 + 30x10 + 80x20 + 100x20 = 6055
    // at pacing 30 (61), a forecast of 60 to 61 against 9 rivals at 47 and the named rival at 50 (seed 42's year-one
    // rival runs there): at 61 each finishes above with 1 - Phi(14 / 8) = 0.04, the named rival with 1 - Phi(11 / 8)
    // = 0.085, so at most 2 of 10 above (a top-3 finish) is about 0.99. The best of the rest, Monthly
    // Petal (story focus: art 32, story 43) with magic for young adults untested, scores (4285 + 20 x fit) / 100 = 47,
    // 51, 55, 59 or 63 over the five fit ratings; a top-3 finish against 8 rivals at 52 is then about 0.006, 0.09,
    // 0.42, 0.82 or 0.98, which the prior 0.15/0.25/0.3/0.2/0.1 weighs to about 0.41
    expect(plan.target).toBe('kids-comic')
  })

  it('breaks a tie between certain offers on expected pay', () => {
    // Seed 42 at art 85, story 85, pacing 80, with action x samurai and samurai for every audience rated Perfect.
    const g = createGame('Rin', 42)
    const s: GameState = {
      ...g,
      player: { ...g.player, stats: { art: 85, story: 85, pacing: 80 } },
      notebook: {
        genreTheme: { 'action|samurai': 4 },
        themeAudience: { 'samurai|kids': 4, 'samurai|teens': 4, 'samurai|young-adults': 4, 'samurai|adults': 4 },
      },
    }
    // Art focus (Bolt, Kids) draws art 85 x 1.25 -> 100, story 85 x 0.8 = 68; story focus (Petal, Ultra) the reverse.
    // Fit and freshness 100 everywhere:
    // Weekly Bolt 3500 + 1020 + 1600 + 1000 + 2000 = 9120 -> 91, Kids Comic Go! 3500 + 1020 + 800 + 2000 + 2000 = 9320
    // -> 93, Monthly Petal 1020 + 3500 + 800 + 2000 + 2000 = 9320 -> 93, Ultra Seinen 1020 + 3500 + 1600 + 1000 + 2000
    // = 9120 -> 91. Pacing noise moves these by about a point, so every magazine clears 65: all four offers are certain.
    // First place is all but sure (91 is 3.6 sd above Ultra's 62), paying page rate x 20 x score x 200 / 8000:
    // Bolt 55 x 91 = 5005, Kids 45 x 93 = 4185, Petal 65 x 93 = 6045, Ultra 75 x 91 = 6825. Ultra pays most.
    expect(SENSIBLE.planDraft(s)).toMatchObject({
      draft: { genre: 'action', theme: 'samurai', audience: 'adults' }, target: 'ultra-seinen',
    })
    // The same tie on the desk: an adults manuscript at 100/100 clears 65 everywhere (25 off fit outside Ultra):
    // Bolt 3500 + 1500 + 1600 + 750 + 2000 = 9350 -> 55 x 94 = 5170, Kids 3500 + 1500 + 800 + 1500 + 2000 = 9300
    // -> 45 x 93 = 4185, Petal 1500 + 3500 + 800 + 1500 + 2000 = 9300 -> 65 x 93 = 6045,
    // Ultra 1500 + 3500 + 1600 + 1000 + 2000 = 9600 -> 75 x 96 = 7200.
    const ready = withReadyOneShot(s, { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'adults' }, 100, 100)
    expect(SENSIBLE.pickMagazine(ready)).toBe('ultra-seinen')
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
    // Drawn with balanced focus from art 40, story 34 (quality 38.8 and 33.3 with the page noise, components 39 and 33),
    // pacing 30, both pairings untested, 25 off fit outside teens. The middle case (both pairings Good, 60) against each
    // field, so Kids Comic Go! has the best odds of a top-3 finish:
    // Kids   39x35 + 33x15 + 30x10 + 35x20 + 60x20 = 4060 -> 41 against rivals at 47 (6 short, the closest; one of
    //        the ten is the named rival at 50)
    // Bolt   39x35 + 33x15 + 30x20 + 60x10 + 60x20 = 4260 -> 43 against 58 (15 short)
    // Petal  39x15 + 33x35 + 30x10 + 35x20 + 60x20 = 3940 -> 39 against 52 (13 short)
    // Ultra  39x15 + 33x35 + 30x20 + 35x10 + 60x20 = 3890 -> 39 against 62 (23 short)
    // Even both Perfect (fit 75 or 100, freshness 100) only reaches 57 at Kids, 55 at Bolt and Petal, 51 at Ultra.
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

  it('hires the most pages per yen when a chapter will miss its issue, a desk is free and the bank covers it', () => {
    // pages a day = 0.15 + (art + story) / 2 x 0.008, x 1.3 when fast
    const cand = (id: number, name: string, stat: number, salary: number, trait: AssistantTrait): Assistant =>
      ({ id, name, art: stat, story: stat, salary, stamina: 80, maxStamina: 80, trait, look: 0 })
    const candidates = [
      cand(101, 'Big', 50, 520, 'careful'), // 0.55 a day, 0.55 / 520 = 0.00106 per yen: most pages
      cand(102, 'Cheap', 20, 280, 'steady'), // 0.31 a day, 0.31 / 280 = 0.00111 per yen: cheapest
      cand(103, 'Quick', 30, 360, 'fast'), // 0.39 x 1.3 = 0.507 a day, 0.507 / 360 = 0.00141 per yen: best value
    ]
    const serial = acceptOffer({ ...createGame('Rin', 42), pendingOffer: OFFER })
    // Stats 40/34 draw 0.5 + 37 x 0.02 = 1.24 pages a day: 16 / 1.24 = 12.9, so 13 working days; 12 days left is
    // late and 13 only tight.
    const at = (daysLeft: number, money: number, s: GameState = serial): GameState =>
      ({ ...s, candidates, serial: { ...s.serial!, nextDueDay: s.day + daysLeft }, player: { ...s.player, money } })
    const hired = (s: GameState) => botStep(s, SENSIBLE).assistants.map((a) => a.name)
    // with every candidate affordable, the best value wins over the most pages (Big) and the cheapest (Cheap)
    expect(hired(at(12, 100000))).toEqual(['Quick'])
    // Quick needs 2 x 360 + 2 x 400 weekly costs = 1520 in the bank
    expect(hired(at(12, 1520))).toEqual(['Quick'])
    // one yen short of Quick: Cheap (2 x 280 + 800 = 1360) is the best value still affordable
    expect(hired(at(12, 1519))).toEqual(['Cheap'])
    expect(hired(at(12, 1359))).toEqual([])
    // tight is not late: no hire, however rich
    expect(hired(at(13, 100000))).toEqual([])
    // no hire without a serial chapter on the desk
    expect(hired({ ...createGame('Rin', 42), candidates, player: { ...createGame('Rin', 42).player, money: 100000 } })).toEqual([])
    // every desk taken: 16 pages still cannot be drawn in one day, but there is no room for a fourth
    const full = { ...serial, assistants: candidates.map((c) => ({ ...c, id: c.id + 100 })) }
    expect(hired(at(1, 100000, full))).toEqual(['Big', 'Cheap', 'Quick'])
  })

  it('hires only into a free desk: one assistant fills the apartment, the flat seats a second', () => {
    const candidates: Assistant[] = [
      { id: 101, name: 'Quick', art: 30, story: 30, salary: 360, stamina: 80, maxStamina: 80, trait: 'fast', look: 0 },
    ]
    const helper: Assistant = { ...candidates[0], id: 201, name: 'Aki', trait: 'steady' }
    const s = acceptOffer({ ...createGame('Rin', 42), pendingOffer: OFFER })
    // due tomorrow with 16 pages to draw: late whatever the staff, and the bank covers any salary
    const late: GameState = {
      ...s, candidates, assistants: [helper], serial: { ...s.serial!, nextDueDay: s.day + 1 },
      player: { ...s.player, money: 100000 },
    }
    const names = (g: GameState) => botStep(g, SENSIBLE).assistants.map((a) => a.name)
    expect(names(late)).toEqual(['Aki'])
    expect(names({ ...late, studio: { tier: 'flat', owned: [] } })).toEqual(['Aki', 'Quick'])
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
    // The bot never spends points (stats stay 40/34/30 the whole run, see below), so the pacing component below is
    // clamp(round(30 + gaussian(u0,u1) x 4), 0, 100) (Task 8: PACING_NOISE_SD 4, RIVAL_SCORE_SD 8, Kids rivalMean 47).
    // Task 13 raised the starting art 38 -> 40. At 1.24 pages a day instead of 1.22 every one-shot still takes the
    // same drawing days, so the polls land on the same days (24, 48, 72, 96, 122, 149) with the same raw draws: pacing,
    // fit, freshness and the rival scores are unchanged, story is unchanged, and every drawn art component is 2 higher
    // (37 -> 39, 37 -> 39, 40 -> 42, 39 -> 41, 38 -> 40, 38 -> 40). Components and rival scores read from a throwaway
    // instrumented run (discarded after use); weighted scores and ranks re-derived by hand:
    // Bolt   {39,33,28,60,80}:  39x35 + 33x15 + 28x20 + 60x10 + 80x20  = 4620 -> 46, all 12 rivals above (lowest
    //        46.1; rank 13)
    // Kids   {39,35,27,55,100}: 39x35 + 35x15 + 27x10 + 55x20 + 100x20 = 5260 -> 53, 3 of 10 above (58.8, 57.4, 55.6;
    //        the next is 52.6; rank 4). Task 14: entrant 0 is the named rival (craft 50, not 47), the same draw 3 higher:
    //        48.3 -> 51.3, still under 53. The rival: 5 others above 51.3 (58.8 57.4 55.6 52.6 51.9) and the player,
    //        so #7 with 51.
    // Petal  {42,34,26,15,20}:  42x15 + 34x35 + 26x10 + 15x20 + 20x20  = 2780 -> 28, all 8 rivals above (rank 9)
    // Ultra  {41,35,29,55,80}:  41x15 + 35x35 + 29x20 + 55x10 + 80x20  = 4570 -> 46, all 8 rivals above (lowest
    //        54.4; rank 9)
    // Bolt   {40,34,31,60,80}:  40x35 + 34x15 + 31x20 + 60x10 + 80x20  = 4730 -> 47, 11 of 12 above (only 44.1 is
    //        below; rank 12)
    // Kids   {40,33,27,15,100}: 40x35 + 33x15 + 27x10 + 15x20 + 100x20 = 4465 -> 45, 9 of 10 above (only 44.7 is
    //        below; rank 10). Task 14: that 44.7 was entrant 0's draw, now the rival's 47.7, above 45: all 10 above,
    //        rank 11. The rival: 9 others above 47.7 (60.0 55.9 53.7 53.4 48.4 48.1 47.9 47.9 47.8), the player below,
    //        so #10 with 48.
    // The Weekly Bolt, Monthly Petal and Ultra Seinen polls have no named rival (it runs in Kids Comic Go! in year one).
    expect(run.oneShots.slice(0, 6).map((o) => o.score)).toEqual([46, 53, 28, 46, 47, 45])
    expect(run.oneShots.slice(0, 6).map((o) => o.rank)).toEqual([13, 4, 9, 9, 12, 11])
    expect(run.final.history.slice(0, 6).map((r) => r.rival && { score: r.rival.score, rank: r.rival.rank })).toEqual([
      undefined, { score: 51, rank: 7 }, undefined, undefined, undefined, { score: 48, rank: 10 },
    ])
    expect(run.serials).toHaveLength(1)
    expect(run.serials[0]).toMatchObject({ magazineId: 'weekly-bolt', startedDay: run.oneShots[5].day })
    expect(run.final.player.stats).toEqual({ art: 40, story: 34, pacing: 30 })
  })
})

/** A run whose one-shots scored `scores`, everything else filler. */
function runWithScores(scores: number[]): BotRun {
  return {
    oneShots: scores.map((score, i) => ({
      day: 24 * (i + 1), score, rank: 5, entrants: 11, magazineId: 'kids-comic', money: 3000, offer: false, offerChance: 0,
    })),
    firstOfferAt: null,
    serials: [],
    weeksInDebt: 0,
    moneyAtDay: [3000],
    final: createGame('Rin', 1),
  }
}

describe('balance bot bookkeeping', () => {
  it('first-six mean: the first six one-shots only, or all of them when fewer were published', () => {
    // (40 + 50 + 60 + 30 + 45 + 55) / 6 = 280 / 6; the seventh (90) does not count
    expect(firstSixMean(runWithScores([40, 50, 60, 30, 45, 55, 90]))).toBeCloseTo(46.667, 3)
    // a serial took the rest of the run after two one-shots: (44 + 52) / 2
    expect(firstSixMean(runWithScores([44, 52]))).toBe(48)
    expect(firstSixMean(runWithScores([]))).toBeNull()
  })

  it('counts every week that ends in an overdraft, even one a same-day poll pays back', () => {
    // idle on day 0 with ¥500, drawing all fortnight: day 7 500 - 400 = 100 (tight, not in debt);
    // day 14 100 - 400 = -300, fee 50
    const broke = createGame('Rin', 42)
    const plain = runBot(42, SENSIBLE, { days: 14, start: { ...broke, player: { ...broke.player, money: 500 } } })
    expect(plain.moneyAtDay[7]).toBe(100)
    expect(plain.moneyAtDay[14]).toBe(-350)
    expect(plain.weeksInDebt).toBe(1)

    // a Kids Comic Go! one-shot polls on day 21 with ¥100 in the bank
    const submitted = submitProject(drawUntilReady(startProject(createGame('Rin', 42), DRAFT)), 'kids-comic')
    const start: GameState = {
      ...submitted, day: 20,
      project: { ...submitted.project!, resultsDay: 21 },
      player: { ...submitted.player, money: 100, stamina: 100 },
    }
    const rescued = runBot(42, SENSIBLE, { days: 21, start })
    // shift +120 = 220, costs -400 = -180, fee -50 = -230, then the poll pays at least 90 x 20 x 0.7 = 1260
    expect(rescued.oneShots).toHaveLength(1)
    expect(rescued.final.player.money).toBeGreaterThan(0)
    expect(rescued.weeksInDebt).toBe(1)
  })

  it('stops after the first day `until` holds', () => {
    // seed 42's sensible bot is offered a serial on its second one-shot and accepts it the next morning
    const run = runBot(42, SENSIBLE, { days: 1008, until: (s) => s.serial !== null })
    expect(run.serials).toHaveLength(1)
    expect(run.final.day).toBe(run.serials[0].startedDay + 1)
  })
})
