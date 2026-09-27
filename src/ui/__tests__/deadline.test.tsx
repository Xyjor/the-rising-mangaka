// @vitest-environment happy-dom
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { acceptOffer, createGame } from '../../sim'
import type { GameState, MagazineId } from '../../sim'
import { withStats } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { StatusCard } from '../hud/StatusCard'
import { OfferModal } from '../panels/OfferModal'
import { SeriesModal } from '../panels/SeriesModal'

const OFFER = { magazineId: 'kids-comic', title: 'Magic Club', genre: 'fantasy', theme: 'magic', audience: 'kids' } as const
const LATE = 'You will miss issues at this pace: hire help first.'
const TIGHT = 'Rest days could make you miss issues.'

/**
 * Seed 1 (art 40, story 34: 0.5 + 37 x 0.02 = 1.24 pages a day) with a Kids Comic Go! serial, chapter 3 on the desk
 * with `pagesDone` of 16 drawn, due in `daysLeft` days.
 */
function chapterDue(daysLeft: number, pagesDone = 12): GameState {
  const s = acceptOffer({ ...createGame('Rin', 1), pendingOffer: OFFER })
  return {
    ...s,
    project: { ...s.project!, chapter: 3, pagesDone },
    serial: { ...s.serial!, chaptersSent: 2, nextDueDay: s.day + daysLeft },
  }
}

function offerFrom(magazineId: MagazineId, stats?: number): GameState {
  const g = createGame('Rin', 1)
  return { ...(stats === undefined ? g : withStats(g, stats)), pendingOffer: { ...OFFER, magazineId } }
}

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), tutorialStep: -1, readOnly: false })
})

describe('desk: the serial chapter deadline', () => {
  it('says when the chapter is due and whether the studio is on track', () => {
    // 4 pages left / 1.24 = 3.2, so 4 working days; 4 x 1.25 = 5 is not more than 5 days left
    useStore.setState({ game: chapterDue(5) })
    render(<StatusCard />)
    expect(screen.getByText('Chapter 3 due in 5 days. About 4 working days left: on track.')).toBeTruthy()
  })

  it('calls it tight when rest days could make the chapter miss', () => {
    // 4 x 1.25 = 5 is more than 4 days left
    useStore.setState({ game: chapterDue(4) })
    render(<StatusCard />)
    expect(screen.getByText('Chapter 3 due in 4 days. About 4 working days left: tight, rest days could make you miss it.'))
      .toBeTruthy()
  })

  it('warns when the chapter will miss its issue at this pace, and counts one day in the singular', () => {
    useStore.setState({ game: chapterDue(3) })
    const { unmount } = render(<StatusCard />)
    expect(screen.getByText('Chapter 3 due in 3 days. About 4 working days left: at this pace you will miss the issue.'))
      .toBeTruthy()
    unmount()
    // 1 page left / 1.24 = 0.8, so 1 working day; 1 x 1.25 = 1.25 is more than 1 day left, so tight
    useStore.setState({ game: chapterDue(1, 15) })
    render(<StatusCard />)
    expect(screen.getByText('Chapter 3 due in 1 day. About 1 working day left: tight, rest days could make you miss it.'))
      .toBeTruthy()
  })
})

describe('offer: the chapter deadline and the studio pace', () => {
  it('shows the deadline tile and the working days a chapter takes', () => {
    // 16 / 1.24 = 12.9, so 13 working days against 21; 13 x 1.25 = 16.25 still fits, so no caution
    useStore.setState({ game: offerFrom('kids-comic') })
    render(<OfferModal />)
    const terms = within(document.querySelector<HTMLElement>('.terms')!)
    expect(terms.getByText('Every 21 days')).toBeTruthy()
    expect(screen.getByText('At your pace a chapter takes about 13 working days.')).toBeTruthy()
    expect(screen.queryByText(TIGHT)).toBeNull()
    expect(screen.queryByText(LATE)).toBeNull()
  })

  it('cautions, without the late warning, when a chapter fits only without rest days', () => {
    // 13 working days against Weekly Bolt's 14: fits, but 13 x 1.25 = 16.25 does not
    useStore.setState({ game: offerFrom('weekly-bolt') })
    render(<OfferModal />)
    expect(screen.getByText('At your pace a chapter takes about 13 working days.')).toBeTruthy()
    expect(screen.getByText(TIGHT)).toBeTruthy()
    expect(screen.queryByText(LATE)).toBeNull()
  })

  it('warns when a chapter takes longer than the magazine gives', () => {
    // stats 5: 0.5 + 5 x 0.02 = 0.6 pages a day, 16 / 0.6 = 26.7, so 27 working days against Weekly Bolt's 14
    useStore.setState({ game: offerFrom('weekly-bolt', 5) })
    render(<OfferModal />)
    expect(within(document.querySelector<HTMLElement>('.terms')!).getByText('Every 14 days')).toBeTruthy()
    expect(screen.getByText('At your pace a chapter takes about 27 working days.')).toBeTruthy()
    expect(screen.getByText(LATE)).toBeTruthy()
    expect(screen.queryByText(TIGHT)).toBeNull()
  })

  it('tells a screen reader the page rate the tile shows: the full rate at a score of 80', () => {
    // Kids Comic Go!: ¥90 a page, 120k readers, 10 rival series
    useStore.setState({ game: offerFrom('kids-comic') })
    render(<OfferModal />)
    expect(document.getElementById('offer-summary')!.textContent).toBe(
      'Kids Comic Go! offers to serialise Magic Club at ¥90 a page at a score of 80, 120k readers, 10 rival series.',
    )
  })

  it('states the deal: pages every chapterDays, and weak chapters or missed issues cancel after grace', () => {
    useStore.setState({ game: offerFrom('kids-comic') })
    render(<OfferModal />)
    expect(screen.getByText(
      'Readers loved it. Give me 16 pages every 21 days, keep the polls healthy, and we release a volume every 4 chapters. '
      + 'The first 4 chapters are guaranteed; after that, 3 weak chapters or missed issues in a row and I have to cancel. Deal?',
    )).toBeTruthy()
  })
})

describe('series: the chapter rhythm and missed issues', () => {
  it('names how often a chapter is due and how many issues were missed', () => {
    const s = chapterDue(10)
    useStore.setState({ game: { ...s, serial: { ...s.serial!, missedIssues: 1 } } })
    render(<SeriesModal />)
    expect(screen.getByText('A chapter every 21 days. Missed issues: 1.')).toBeTruthy()
    expect(screen.getByText(
      'A moving average of recent poll placements, minus 10 for each missed issue. '
      + 'Three weak chapters or missed issues in a row and the magazine pulls the plug.',
    )).toBeTruthy()
  })
})
