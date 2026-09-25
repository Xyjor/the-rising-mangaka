// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/dom'
import {
  SERIAL_GRACE_CHAPTERS, acceptOffer, createGame, dismissResult, setActivity, startProject, submitProject, tick,
  tickMany,
} from '../../sim'
import type { ChapterResult, GameState } from '../../sim'
import { DRAFT, drawUntilReady, withStats } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { SeriesModal } from '../panels/SeriesModal'

/** A strong one-shot, submitted to Weekly Bolt and its offer waiting. */
function strongOneShot(): GameState {
  let s = withStats(createGame('Rin', 42), 90)
  s = drawUntilReady(startProject(s, DRAFT))
  s = submitProject(s, 'weekly-bolt')
  return tickMany(s, 7)
}

/** A running Weekly Bolt serial with at least `count` chapter results in. */
function serialWithResults(count: number): GameState {
  let s = acceptOffer(dismissResult(strongOneShot()))
  let guard = 0
  while (s.serial!.results.length < count && guard++ < 900) {
    s = tick(setActivity(s, s.player.stamina < 20 ? 'rest' : 'work'))
  }
  return s
}

describe('SeriesModal grace line', () => {
  it('shows "New series: no warnings until chapter 5." before the grace period ends', () => {
    useStore.setState({ game: serialWithResults(2), readOnly: false })
    render(<SeriesModal />)
    expect(screen.getByText('New series: no warnings until chapter 5.')).toBeTruthy()
    // The grace line replaces the warning pips while it is showing.
    expect(document.querySelector('.warnings')).toBeNull()
  })

  it('switches to the warning pips once the grace period has passed', () => {
    const game = serialWithResults(SERIAL_GRACE_CHAPTERS + 1)
    useStore.setState({ game, readOnly: false })
    render(<SeriesModal />)
    expect(screen.queryByText('New series: no warnings until chapter 5.')).toBeNull()
    expect(document.querySelector('.warnings')).not.toBeNull()
  })
})

describe('SeriesModal rival column', () => {
  const chapter = (n: number, rank: number, rivalRank?: number): ChapterResult => ({
    chapter: n, day: 7 * n, score: 50, rank, entrants: 11,
    breakdown: { art: 50, story: 50, pacing: 30, audienceFit: 60, freshness: 60 },
    rewards: { money: 900, fans: 100, xp: 45 },
    ...(rivalRank ? { rival: { name: 'Iori Hayama', score: 49, rank: rivalRank } } : {}),
  })

  it("shows the rival's rank in each chapter poll, and a dash where the rival was not in it", () => {
    const offer = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const
    const g = acceptOffer({ ...createGame('Rin', 1), pendingOffer: offer })
    useStore.setState({ game: { ...g, serial: { ...g.serial!, results: [chapter(1, 3, 7), chapter(2, 5)] } }, readOnly: false })
    render(<SeriesModal />)
    const table = screen.getByRole('table')
    const head = within(table).getAllByRole('columnheader').map((th) => th.textContent)
    expect(head).toEqual(['Chapter', 'Rank', 'Rival', 'Score', 'Art', 'Story', 'Freshness', 'Paid'])
    // newest first: chapter 2 had no rival, chapter 1's rival placed 7th
    const rows = within(table).getAllByRole('row').slice(1).map((tr) => within(tr).getAllByRole('cell').map((td) => td.textContent))
    expect(rows.map((cells) => [cells[0], cells[2]])).toEqual([['Ch.2', '—'], ['Ch.1', '#7']])
  })
})

describe('SeriesModal anime line', () => {
  const offer = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const
  /** Seed 1's Kids Comic Go! serial (id 1) with a Studio Kumo deal signed on day 100, viewed on `day`. */
  function kumoOn(day: number): GameState {
    const g = acceptOffer({ ...createGame('Rin', 1), pendingOffer: offer })
    const deal = { studio: 'kumo', serialId: 1, signedDay: 100, airsDay: 142, endsDay: 226, tailEndsDay: 310 } as const
    return { ...g, day, anime: [deal] }
  }

  it('says when a signed anime airs, what it pays each week on air, and how long the boost lasts after', () => {
    const cases: [number, string][] = [
      [100, 'Signed with Studio Kumo, airs in 6 weeks; volumes sell 1.3x.'],
      [156, 'On air, week 3 of 12: +400 fans and ¥500 a week; volumes sell 1.3x.'],
      [226, 'The anime has ended; volumes sell 1.3x for 12 more weeks.'],
      [311, 'The Studio Kumo anime has ended, and volumes sell at the normal rate again.'],
    ]
    for (const [day, line] of cases) {
      useStore.setState({ game: kumoOn(day), readOnly: false })
      const { unmount } = render(<SeriesModal />)
      expect(screen.getByText(line)).toBeTruthy()
      unmount()
    }
  })

  it('shows no anime line for a series without a deal', () => {
    useStore.setState({ game: acceptOffer({ ...createGame('Rin', 1), pendingOffer: offer }), readOnly: false })
    render(<SeriesModal />)
    expect(screen.queryByText(/anime|On air/)).toBeNull()
  })
})
