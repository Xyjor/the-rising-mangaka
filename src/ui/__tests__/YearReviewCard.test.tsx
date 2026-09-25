// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame } from '../../sim'
import type { GameState, YearReview } from '../../sim'
import { useStore } from '../../state/store'
import { App } from '../App'
import { YearReviewCard } from '../YearReviewCard'
import { CareerModal } from '../panels/CareerModal'
import { DeskPanel } from '../panels/DeskPanel'
import { YearModal } from '../panels/YearModal'

const CARD = 'Year 1 in review: 2 awards, 1 near miss.'

/** Year one of seed 1 (rival Iori Hayama): the Rookie Prize and the Critics' Prize won, the Golden Pen missed. */
const REVIEW: YearReview = {
  year: 1, oneShots: 4, bestOneShot: { title: 'Blade Club', rank: 1, entrants: 13, score: 71 }, chapters: 9, volumes: 2,
  copies: 24_800, bestScore: 77, moneyDelta: 14_250, fansDelta: 3400, levelFrom: 1, levelTo: 4,
  awards: ['rookie', 'critics'], nearMisses: [{ id: 'golden-pen', have: 24_800, need: 37_000 }],
  rival: {
    name: 'Iori Hayama', wins: 3, losses: 2, fromMagazine: 'kids-comic', toMagazine: 'monthly-petal',
    craftBefore: 57, craftAfter: 61, series: 'Glasshouse Summer',
  },
  rivalAward: null,
}

/** Seed 1 on day 336 with `review` (by default REVIEW) closed, its awards won, and the review still unread. */
function reviewed(review: YearReview = REVIEW, unread = true): GameState {
  return {
    ...createGame('Rin', 1), day: 336, yearReviews: [review], reviewUnread: unread ? review.year : null,
    awards: review.awards.map((id) => ({ id, year: review.year })),
  }
}

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), speed: 0, modal: 'none', toasts: [], tutorialStep: -1, readOnly: false })
})

describe('YearReviewCard', () => {
  it('renders nothing without an unread review', () => {
    const { container } = render(<YearReviewCard />)
    expect(container.firstChild).toBeNull()
    useStore.setState({ game: reviewed(REVIEW, false) })
    const again = render(<YearReviewCard />)
    expect(again.container.firstChild).toBeNull()
  })

  it('counts the awards and near misses, and sits on the desk panel', () => {
    useStore.setState({ game: reviewed() })
    render(<DeskPanel />)
    const card = screen.getByRole('region', { name: CARD })
    expect(within(card).getByRole('button', { name: 'Read the year review' })).toBeTruthy()
  })

  it('says so when a year brought nothing', () => {
    useStore.setState({ game: reviewed({ ...REVIEW, awards: [], nearMisses: [] }) })
    render(<YearReviewCard />)
    expect(screen.getByRole('region', { name: 'Year 1 in review: no awards, no near misses.' })).toBeTruthy()
  })

  it('opens the review from the card, and the card leaves the desk once it is read', () => {
    useStore.setState({ game: reviewed() })
    render(<App />)
    const card = screen.getByRole('region', { name: CARD })
    fireEvent.click(within(card).getByRole('button', { name: 'Read the year review' }))
    const dialog = screen.getByRole('dialog', { name: 'Year 1 in review' })
    expect(useStore.getState().game!.reviewUnread).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Year 1 in review' })).toBeNull()
    expect(screen.queryByRole('region', { name: CARD })).toBeNull()
  })
})

describe('YearModal', () => {
  it('shows the year in numbers, the awards with their prizes, the near misses and the rival', () => {
    useStore.setState({ game: reviewed(), modal: 'year' })
    const { container } = render(<YearModal />)
    const tiles = [...container.querySelectorAll('.reward')].map((el) => [
      el.querySelector('.n')!.textContent, el.querySelector('.l')!.textContent,
    ])
    expect(tiles).toEqual([
      ['+¥14,250', 'Money'], ['+3,400', 'Fans'], ['1 to 4', 'Level'], ['4', 'One-shots'], ['9', 'Chapters'],
      ['2', 'Volumes'], ['24.8k', 'Copies sold'], ['77', 'Best score'],
    ])
    expect(screen.getByText('Best one-shot: "Blade Club", #1 of 13 with a score of 71.')).toBeTruthy()
    const awards = within(screen.getByRole('region', { name: 'Awards' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(awards).toEqual([
      'Rookie Prize: +¥3,000, +500 fans, +100 XP. Won for a serial started or a #1 one-shot, in year one only.',
      "Critics' Prize: +¥4,000, +1,000 fans, +150 XP. Won for a poll score of 75 or more.",
    ])
    const near = within(screen.getByRole('region', { name: 'Near misses' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(near).toEqual(['Golden Pen: 24,800 copies of 37,000.'])
    // craft 61 plus or minus RIVAL_SCORE_SD 8
    expect(screen.getByRole('region', { name: 'Rival' }).textContent).toContain(
      'Head to head this year: 3 wins, 2 losses. Iori Hayama\'s craft grew from 57 to 61, so they move up to Monthly Petal '
      + 'with a new series, "Glasshouse Summer". They usually score 53 to 69 now.',
    )
  })

  it('names the prize the rival took, words every near miss, and says what the awards need when none was won', () => {
    const review: YearReview = {
      ...REVIEW, oneShots: 2, bestOneShot: { title: 'Blade Club', rank: 3, entrants: 13, score: 70 }, bestScore: 70,
      moneyDelta: -19_200, fansDelta: 0, levelFrom: 2, levelTo: 2, awards: [],
      nearMisses: [
        { id: 'rookie', have: 3, need: 1 }, { id: 'readers', have: 3.2, need: 3 }, { id: 'critics', have: 70, need: 75 },
      ],
      rival: { ...REVIEW.rival, wins: 0, losses: 0 },
      rivalAward: 'rookie',
    }
    useStore.setState({ game: reviewed(review), modal: 'year' })
    const { container } = render(<YearModal />)
    expect(screen.getByText('No awards, 3 near misses')).toBeTruthy()
    const values = [...container.querySelectorAll('.reward .n')].map((el) => el.textContent)
    expect(values.slice(0, 3)).toEqual(['-¥19,200', '0', '2'])
    const awards = screen.getByRole('region', { name: 'Awards' })
    expect(awards.textContent).toContain('No awards this year.')
    expect(within(awards).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      "Readers' Choice: a serial with 8 or more chapter results in the year, averaging rank 3.0 or better.",
      "Critics' Prize: a poll score of 75 or more.",
      'Golden Pen: 37,000 copies sold in the year.',
    ])
    const near = within(screen.getByRole('region', { name: 'Near misses' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(near).toEqual([
      'Rookie Prize: best one-shot #3, a #1 or a serial wins it.',
      "Readers' Choice: average rank 3.2, 3.0 or better wins it.",
      "Critics' Prize: best score 70 of 75.",
    ])
    expect(screen.getByRole('region', { name: 'Rival' }).textContent).toContain(
      'Iori Hayama won the Rookie Prize. You never met Iori Hayama in a poll this year.',
    )
  })

  it('tells a rival who stays put, and one at the top of their game', () => {
    const stays: YearReview = {
      ...REVIEW, year: 2, rival: { ...REVIEW.rival, fromMagazine: 'monthly-petal', craftBefore: 54, craftAfter: 58 },
    }
    useStore.setState({ game: reviewed(stays), modal: 'year' })
    const { unmount } = render(<YearModal />)
    expect(screen.getByRole('region', { name: 'Rival' }).textContent).toContain(
      'Iori Hayama\'s craft grew from 54 to 58. They stay in Monthly Petal with "Glasshouse Summer". They usually score 50 to 66 now.',
    )
    unmount()
    const top: YearReview = {
      ...REVIEW, year: 8, rival: {
        ...REVIEW.rival, fromMagazine: 'ultra-seinen', toMagazine: 'ultra-seinen', craftBefore: 76, craftAfter: 76,
        series: 'The Quiet Prosecutor',
      },
    }
    useStore.setState({ game: reviewed(top), modal: 'year' })
    render(<YearModal />)
    expect(screen.getByRole('region', { name: 'Rival' }).textContent).toContain(
      'Iori Hayama is at the top of their game at craft 76 and stays in Ultra Seinen with "The Quiet Prosecutor". They usually score 68 to 84 now.',
    )
  })
})

describe('CareerModal awards', () => {
  it('lists the awards won and a line for every past year', () => {
    const second: YearReview = {
      ...REVIEW, year: 2, moneyDelta: -2000, fansDelta: 150, levelFrom: 4, levelTo: 4, awards: [], nearMisses: [],
    }
    useStore.setState({ game: { ...reviewed(), day: 672, yearReviews: [REVIEW, second], reviewUnread: null } })
    render(<CareerModal />)
    const awards = within(screen.getByRole('region', { name: 'Awards' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(awards).toEqual(['Rookie Prize, year 1', "Critics' Prize, year 1"])
    const years = within(screen.getByRole('region', { name: 'Past years' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(years).toEqual([
      'Year 1: 2 awards, 1 near miss. Money +¥14,250, fans +3,400, level 1 to 4.',
      'Year 2: no awards, no near misses. Money -¥2,000, fans +150, level 4.',
    ])
  })

  it('says when the first awards come before any are won', () => {
    render(<CareerModal />)
    expect(screen.getByRole('region', { name: 'Awards' }).textContent).toContain(
      'No awards yet. Awards are handed out when year 1 ends.',
    )
    expect(screen.queryByRole('region', { name: 'Past years' })).toBeNull()
  })
})
