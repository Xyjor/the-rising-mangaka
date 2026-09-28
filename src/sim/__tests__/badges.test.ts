import { describe, expect, it } from 'vitest'
import {
  BADGES, EQUIPMENT_IDS, awardBadges, createGame, hireAssistant, startProject, tick, tickMany,
} from '../index'
import type { BadgeId, GameState, PollResult, Serial } from '../index'
import { upgradeSave } from '../migrate'
import { DRAFT } from '../../test/fixtures'

const base = () => createGame('Rin', 42)

function badge(id: BadgeId) {
  return BADGES.find((b) => b.id === id)!
}

/** a poll result with just the fields the rules read */
function poll(rank: number, extra: Partial<PollResult> = {}): PollResult {
  return { rank, entrants: 8, day: 10, ...extra } as PollResult
}

function serial(extra: Partial<Serial>): Serial {
  return { id: 1, status: 'running', missedIssues: 0, chaptersSent: 0, results: [], volumes: 0, ...extra } as Serial
}

/** done(prev, s) for a state-derivable rule: the same state on both sides */
function holds(id: BadgeId, s: GameState): boolean {
  return badge(id).done(s, s)
}

describe('badges', () => {
  it('has 15 unique badges with titles and hints', () => {
    const ids = BADGES.map((b) => b.id)
    expect(ids).toHaveLength(15)
    expect(new Set(ids).size).toBe(15)
    for (const b of BADGES) expect(b.title && b.hint).toBeTruthy()
  })

  it('none hold for a fresh game', () => {
    const s = base()
    for (const b of BADGES) expect(b.done(s, s)).toBe(false)
    expect(s.badges).toEqual([])
  })

  it('all-nighter: collapsing at the desk', () => {
    const prev = { ...base(), activity: 'work' as const, recovering: false }
    expect(badge('all-nighter').done(prev, { ...prev, recovering: true })).toBe(true)
    expect(badge('all-nighter').done({ ...prev, activity: 'job' }, { ...prev, recovering: true })).toBe(false)
    expect(badge('all-nighter').done({ ...prev, recovering: true }, { ...prev, recovering: true })).toBe(false)
  })

  it('cancelled: a cancelled serial', () => {
    expect(holds('cancelled', { ...base(), serials: [serial({ status: 'cancelled' })] })).toBe(true)
    expect(holds('cancelled', { ...base(), serials: [serial({ status: 'ended' })] })).toBe(false)
  })

  it('stop-presses: a missed issue', () => {
    expect(holds('stop-presses', { ...base(), serial: serial({ missedIssues: 1 }) })).toBe(true)
  })

  it('ramen-budget: a week ends in debt', () => {
    const s = base()
    const prev = { ...s, day: 6 }
    const now = { ...s, day: 7, player: { ...s.player, money: -5 } }
    expect(badge('ramen-budget').done(prev, now)).toBe(true)
    expect(badge('ramen-budget').done(now, now)).toBe(false)
    expect(badge('ramen-budget').done({ ...prev, day: 5 }, { ...now, day: 6 })).toBe(false)
  })

  it('first-place: a rank 1 in any poll', () => {
    expect(holds('first-place', { ...base(), history: [poll(1)] })).toBe(true)
    expect(holds('first-place', { ...base(), serials: [serial({ results: [poll(1) as unknown as Serial['results'][number]] })] })).toBe(true)
    expect(holds('first-place', { ...base(), history: [poll(2)] })).toBe(false)
  })

  it('golden-pen and grand-slam: awards', () => {
    const one = { ...base(), awards: [{ id: 'golden-pen' as const, year: 1 }] }
    expect(holds('golden-pen', one)).toBe(true)
    expect(holds('grand-slam', one)).toBe(false)
    const all = { ...base(), awards: (['rookie', 'readers', 'critics', 'golden-pen'] as const).map((id) => ({ id, year: 1 })) }
    expect(holds('grand-slam', all)).toBe(true)
  })

  it('rival-10: ten wins over the rival', () => {
    const win = poll(1, { rival: { name: 'X', score: 40, rank: 3 } })
    expect(holds('rival-10', { ...base(), history: Array(10).fill(win) })).toBe(true)
    expect(holds('rival-10', { ...base(), history: Array(9).fill(win) })).toBe(false)
  })

  it('perfect-pair: a genre-theme pairing at its best rating', () => {
    const s = base()
    expect(holds('perfect-pair', { ...s, notebook: { ...s.notebook, genreTheme: { 'a:b': 4 } } })).toBe(true)
    expect(holds('perfect-pair', { ...s, notebook: { ...s.notebook, genreTheme: { 'a:b': 3 } } })).toBe(false)
  })

  it('anime-signed and anime-declined', () => {
    const deal = { studio: 'kumo' as const, serialId: 1, signedDay: 1, airsDay: 2, endsDay: 3, tailEndsDay: 4 }
    expect(holds('anime-signed', { ...base(), anime: [deal], animeOfferedFor: [1] })).toBe(true)
    expect(holds('anime-declined', { ...base(), anime: [deal], animeOfferedFor: [1] })).toBe(false)
    // an offer still on the desk is not declined yet
    expect(holds('anime-declined', { ...base(), animeOfferedFor: [2], animeOffer: { serialId: 2, expiresDay: 9 } })).toBe(false)
    expect(holds('anime-declined', { ...base(), animeOfferedFor: [2] })).toBe(true)
  })

  it('the-loft and fully-equipped: the studio', () => {
    const s = base()
    expect(holds('the-loft', { ...s, studio: { ...s.studio, tier: 'loft' } })).toBe(true)
    expect(holds('fully-equipped', { ...s, studio: { ...s.studio, owned: [...EQUIPMENT_IDS] } })).toBe(true)
    expect(holds('fully-equipped', { ...s, studio: { ...s.studio, owned: EQUIPMENT_IDS.slice(1) } })).toBe(false)
  })

  it('century: 100 chapters across serials', () => {
    expect(holds('century', { ...base(), serial: serial({ chaptersSent: 40 }), serials: [serial({ chaptersSent: 60 })] })).toBe(true)
    expect(holds('century', { ...base(), serials: [serial({ chaptersSent: 99 })] })).toBe(false)
  })

  it('millionaire: ¥1,000,000', () => {
    const s = base()
    expect(holds('millionaire', { ...s, player: { ...s.player, money: 1_000_000 } })).toBe(true)
    expect(holds('millionaire', { ...s, player: { ...s.player, money: 999_999 } })).toBe(false)
  })

  it('awardBadges records the day, toasts once, and is idempotent', () => {
    const s0 = base()
    const s = { ...s0, day: 12, player: { ...s0.player, money: 1_000_000 } }
    const a = awardBadges(s, s)
    expect(a.badges).toEqual([{ id: 'millionaire', day: 12 }])
    const lines = a.log.filter((e) => e.text === 'Badge: Millionaire.')
    expect(lines).toHaveLength(1)
    expect(lines[0].toast).toBe(true)
    expect(awardBadges(a, a)).toEqual(a)
  })

  it('consumes no rng and grants no xp or money', () => {
    const s0 = base()
    const s = { ...s0, player: { ...s0.player, money: 1_000_000 }, history: [poll(1)] }
    const a = awardBadges(s, s)
    expect(a.badges.length).toBe(2)
    expect(a.seed).toBe(s.seed)
    expect(a.eventSeed).toBe(s.eventSeed)
    expect(a.player).toEqual(s.player)
  })

  it('is the last step of tick: a badge lands on the tick its rule turns true', () => {
    const s0 = base()
    const rich = { ...s0, player: { ...s0.player, money: 1_000_000 } }
    const t = tick(rich)
    expect(t.badges).toEqual([{ id: 'millionaire', day: t.day }])
    // the badge's line comes after every other line of that tick
    // after the milestone the same tick awards (the ¥50,000 one): badges are the last step, after awardMilestones
    expect(t.milestonesDone).toContain('money-50k')
    const texts = t.log.map((e) => e.text)
    expect(texts.indexOf('Badge: Millionaire.')).toBeGreaterThan(texts.findIndex((x) => x.startsWith('Milestone: Fifty thousand')))
    expect(texts[texts.length - 1]).toBe('Badge: Millionaire.')
  })

  it('stays deterministic over a run', () => {
    const run = () => tickMany(startProject(hireAssistant(base(), base().candidates[0].id), DRAFT), 60)
    expect(run()).toEqual(run())
  })

  it('upgradeSave defaults the list and grants state-derivable badges quietly', () => {
    const s0 = base()
    const old = { ...s0, day: 50, player: { ...s0.player, money: 1_000_000 } } as Partial<GameState>
    delete old.badges
    const up = upgradeSave(old as GameState)
    expect(up.badges).toEqual([{ id: 'millionaire', day: 50 }])
    expect(up.log).toEqual(s0.log)
    const fresh = { ...s0 } as Partial<GameState>
    delete fresh.badges
    expect(upgradeSave(fresh as GameState).badges).toEqual([])
  })
})
