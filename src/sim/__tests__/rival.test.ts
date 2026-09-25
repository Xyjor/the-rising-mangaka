import { describe, expect, it } from 'vitest'
import {
  RIVAL_MAX_CRAFT, RIVAL_NAMES, RIVAL_SERIES, acceptOffer, createGame, evaluateChapter, evaluateProject, makeRival,
  pollField, rivalMagazineFor, rivalRecord,
} from '../index'
import type { ChapterResult, GameState, MagazineId, PendingChapter, PollResult, Rival } from '../index'
import { draw } from '../rng'
import { withReadyOneShot } from '../../test/fixtures'

const KIDS_DRAFT = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'kids' } as const
const TEENS_DRAFT = { ...KIDS_DRAFT, audience: 'teens' } as const

/** A rival of `craft` running in `magazineId`. */
function rivalAt(magazineId: MagazineId, craft = 50): Rival {
  return { name: 'Touya Kagami', craft, magazineId, seriesTitle: 'Robo Pals Go!' }
}

// gaussian(u1, u2) = sqrt(-2 ln u1) x cos(2 pi u2): (e^-0.5, 0) gives +1, (e^-0.5, 0.5) gives -1, (0.5, 0.25) gives 0
// (cos(pi / 2) is 6e-17, which vanishes next to a mean of 47). Times RIVAL_SCORE_SD 8.
const UP = [Math.exp(-0.5), 0]
const DOWN = [Math.exp(-0.5), 0.5]
const MID = [0.5, 0.25]

/** A Kids Comic Go! draw (2 pacing values, then 10 entrants): entrant 0 and 1 as given, entrants 2..9 at the mean. */
function kidsValues(first: number[], second: number[]): number[] {
  return [0.5, 0.5, ...first, ...second, ...Array.from({ length: 8 }, () => MID).flat()]
}

describe('makeRival', () => {
  it('a fresh rival has craft 50 and runs in Kids Comic Go!, named from the world seed', () => {
    // seed 1: world seed 1 x 7919 = 7919; FNV-1a of "rival:7919" is 2016469609, mod 6 = 1 (Iori Hayama);
    // FNV-1a of "rival:7919:kids-comic" mod 3 = 0 (the first Kids title). Derived with a separate FNV-1a script.
    expect(makeRival(7919, 0)).toEqual({
      name: 'Iori Hayama', craft: 50, magazineId: 'kids-comic', seriesTitle: RIVAL_SERIES['kids-comic'][0],
    })
    // seed 4 (world 31676) hashes to 0 (Touya Kagami), seed 42 (world 332598) to 5 (Natsume Kujo)
    expect(makeRival(31676, 0).name).toBe('Touya Kagami')
    expect(makeRival(332598, 0).name).toBe('Natsume Kujo')
    expect(RIVAL_NAMES).toEqual([
      'Touya Kagami', 'Iori Hayama', 'Mikoto Sakuraba', 'Chihiro Ishida', 'Asahi Morikawa', 'Natsume Kujo',
    ])
  })

  it('grows 4 craft a year from 50, capped at 76, and moves up the magazines', () => {
    const at = (years: number) => makeRival(7919, years)
    expect([0, 1, 2, 3, 4, 5, 6, 7, 10].map((y) => at(y).craft)).toEqual([50, 54, 58, 62, 66, 70, 74, 76, 76])
    expect(RIVAL_MAX_CRAFT).toBe(76)
    expect([0, 1, 2, 3, 4].map((y) => at(y).magazineId)).toEqual([
      'kids-comic', 'monthly-petal', 'monthly-petal', 'weekly-bolt', 'ultra-seinen',
    ])
    // the name never changes; the series is one of that magazine's three titles
    for (const y of [0, 1, 3, 4]) {
      const r = at(y)
      expect(r.name).toBe('Iori Hayama')
      expect(RIVAL_SERIES[r.magazineId]).toContain(r.seriesTitle)
    }
    expect(Object.values(RIVAL_SERIES).every((titles) => titles.length === 3)).toBe(true)
  })

  it('createGame starts every career with the fresh rival for its world', () => {
    const s = createGame('Rin', 1)
    expect(s.rival).toEqual(makeRival(s.worldSeed, 0))
    expect(s.rival).toMatchObject({ name: 'Iori Hayama', craft: 50, magazineId: 'kids-comic' })
  })
})

describe('rivalMagazineFor', () => {
  it('picks the magazine with the highest rival mean at most craft - 2, else Kids Comic Go!', () => {
    // means: Kids 47, Petal 52, Bolt 58, Ultra 62
    expect([50, 54, 58, 62, 66].map(rivalMagazineFor)).toEqual([
      'kids-comic', 'monthly-petal', 'monthly-petal', 'weekly-bolt', 'ultra-seinen',
    ])
    // boundaries: 53 - 2 = 51 < 52 (Kids), 54 - 2 = 52 (Petal); 59 - 2 = 57 < 58 (Petal), 60 - 2 = 58 (Bolt);
    // 63 - 2 = 61 < 62 (Bolt), 64 - 2 = 62 (Ultra)
    expect([53, 54, 59, 60, 63, 64].map(rivalMagazineFor)).toEqual([
      'kids-comic', 'monthly-petal', 'monthly-petal', 'weekly-bolt', 'weekly-bolt', 'ultra-seinen',
    ])
    // below every mean (48 - 2 = 46 < 47) falls back to Kids; far above stays at Ultra
    expect(rivalMagazineFor(48)).toBe('kids-comic')
    expect(rivalMagazineFor(10)).toBe('kids-comic')
    expect(rivalMagazineFor(100)).toBe('ultra-seinen')
  })
})

describe('pollField', () => {
  it('scores entrant 0 at the rival\'s craft where the rival runs and ranks the rival in the same field', () => {
    // rival 50 + 8 = 58, entrant 1 47 + 8 = 55, eight more at 47. Player 52: 58 and 55 above, rank 3.
    // The rival: no one above 58, and 52 < 58, so first with 58.
    const up = kidsValues(UP, UP)
    expect(pollField(rivalAt('kids-comic'), 'kids-comic', 52, up, 2)).toEqual({
      rank: 3, rival: { name: 'Touya Kagami', score: 58, rank: 1 },
    })
    // Player 60: nobody above, rank 1; the rival is second behind the player.
    expect(pollField(rivalAt('kids-comic'), 'kids-comic', 60, up, 2)).toEqual({
      rank: 1, rival: { name: 'Touya Kagami', score: 58, rank: 2 },
    })
    // rival 50 - 8 = 42, entrant 1 55, eight at 47. Player 45: nine above, rank 10.
    // The rival: nine others above 42, and the player's 45 too, so last of 11 with 42.
    expect(pollField(rivalAt('kids-comic'), 'kids-comic', 45, kidsValues(DOWN, UP), 2)).toEqual({
      rank: 10, rival: { name: 'Touya Kagami', score: 42, rank: 11 },
    })
  })

  it('uses the magazine\'s rival mean for entrant 0 when the rival runs elsewhere, and names no rival', () => {
    // entrant 0 is 47 + 8 = 55 like entrant 1: player 52 has two above, rank 3
    expect(pollField(rivalAt('monthly-petal'), 'kids-comic', 52, kidsValues(UP, UP), 2)).toEqual({ rank: 3, rival: null })
    expect(pollField(null, 'kids-comic', 52, kidsValues(UP, UP), 2)).toEqual({ rank: 3, rival: null })
  })
})

describe('the rival in real polls', () => {
  const kidsReady = (rival: Rival) => withReadyOneShot({ ...createGame('Rin', 42), rival }, KIDS_DRAFT, 50, 50)
  const teensReady = (rival: Rival) => withReadyOneShot({ ...createGame('Rin', 42), rival }, TEENS_DRAFT, 50, 50)

  it('shows up in Kids Comic Go! results and not in Weekly Bolt results', () => {
    const s = kidsReady(rivalAt('kids-comic'))
    const kids = evaluateProject(s, s.project!, 'kids-comic').result
    expect(kids.rival).toMatchObject({ name: 'Touya Kagami' })
    expect(kids.rival!.rank).toBeGreaterThanOrEqual(1)
    expect(kids.rival!.rank).toBeLessThanOrEqual(11)
    expect(kids.rival!.rank).not.toBe(kids.rank)
    expect(evaluateProject(s, s.project!, 'weekly-bolt').result.rival).toBeUndefined()
  })

  it('craft 1000 always places first with 100; craft -1000 always last with 0, one place better for the player', () => {
    const high = kidsReady(rivalAt('kids-comic', 1000))
    const low = kidsReady(rivalAt('kids-comic', -1000))
    const top = evaluateProject(high, high.project!, 'kids-comic').result
    const bottom = evaluateProject(low, low.project!, 'kids-comic').result
    expect(top.rival).toEqual({ name: 'Touya Kagami', score: 100, rank: 1 })
    expect(bottom.rival).toEqual({ name: 'Touya Kagami', score: 0, rank: 11 })
    // same draws: entrant 0 is above the player in one poll and below in the other, everyone else is the same
    expect(top.score).toBe(bottom.score)
    expect(top.rank).toBe(bottom.rank + 1)
  })

  it('draws exactly 2 + entrants x 2 values whether or not the rival runs in the poll', () => {
    for (const craft of [50, 1000, -1000]) {
      const s = kidsReady(rivalAt('kids-comic', craft))
      expect(evaluateProject(s, s.project!, 'kids-comic').seed).toBe(draw(s.seed, 2 + 10 * 2).seed)
    }
  })

  it('leaves Weekly Bolt polls exactly as they were whether the rival sits at Ultra Seinen or Kids Comic Go!', () => {
    const atUltra = teensReady(rivalAt('ultra-seinen'))
    const atKids = teensReady(rivalAt('kids-comic'))
    expect(evaluateProject(atKids, atKids.project!, 'weekly-bolt')).toEqual(
      evaluateProject(atUltra, atUltra.project!, 'weekly-bolt'),
    )
  })

  it('places in chapter polls of the magazine it runs in', () => {
    const offer = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const
    const running = acceptOffer({ ...createGame('Rin', 42), pendingOffer: offer })
    const pc: PendingChapter = { chapter: 1, pages: 16, artQ: 50, storyQ: 50, submittedDay: 0, resultsDay: 7 }
    const here = evaluateChapter({ ...running, rival: rivalAt('kids-comic', -1000) }, running.serial!, pc)
    expect(here.result.rival).toEqual({ name: 'Touya Kagami', score: 0, rank: 11 })
    expect(here.seed).toBe(draw(running.seed, 2 + 10 * 2).seed)
    const away = evaluateChapter({ ...running, rival: rivalAt('weekly-bolt') }, running.serial!, pc)
    expect(away.result.rival).toBeUndefined()
  })
})

describe('rivalRecord', () => {
  const placing = (rank: number, rivalRank?: number) =>
    rivalRank === undefined ? { rank } : { rank, rival: { name: 'Touya Kagami', score: 50, rank: rivalRank } }

  it('counts a win when the player placed above the rival and a loss when below, over one-shots and chapters', () => {
    const g = createGame('Rin', 1)
    const offer = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const
    const serial = acceptOffer({ ...g, pendingOffer: offer }).serial!
    const s: GameState = {
      ...g,
      history: [placing(2, 5), placing(6, 1), placing(3)] as PollResult[],
      serial: { ...serial, results: [placing(1, 2), placing(4, 4)] as ChapterResult[] },
      serials: [{ ...serial, id: 99, status: 'ended', results: [placing(9, 3), placing(7)] as ChapterResult[] }],
    }
    // wins: 2 < 5, 1 < 2; losses: 6 > 1, 9 > 3; 4 = 4 is neither; results without the rival do not count
    expect(rivalRecord(s)).toEqual({ wins: 2, losses: 2 })
    expect(rivalRecord(g)).toEqual({ wins: 0, losses: 0 })
  })
})
