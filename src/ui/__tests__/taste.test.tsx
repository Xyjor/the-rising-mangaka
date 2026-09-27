// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { acceptOffer, createGame, startProject } from '../../sim'
import { DRAFT, drawUntilReady, withPendingResult } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { focusHint, weightSpan } from '../labels'
import { StatusCard } from '../hud/StatusCard'
import { NewMangaWizard } from '../panels/NewMangaWizard'
import { ResultsModal } from '../panels/ResultsModal'
import { StatsModal } from '../panels/StatsModal'
import { SubmitModal } from '../panels/SubmitModal'

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), tutorialStep: -1, readOnly: false })
})

describe('taste labels', () => {
  it('names the magazines each focus suits, from the magazine table', () => {
    expect(focusHint(null)).toBe(
      'Art focus suits Weekly Bolt and Kids Comic Go! (art 35%). Story focus suits Monthly Petal and Ultra Seinen (story 35%).',
    )
  })

  it('names only the serial\'s magazine while a serial runs', () => {
    expect(focusHint('weekly-bolt')).toBe('Art focus suits Weekly Bolt (art 35%, story 15%), where your serial runs.')
    expect(focusHint('ultra-seinen')).toBe('Story focus suits Ultra Seinen (art 15%, story 35%), where your serial runs.')
  })

  it('spans each component\'s weight across the magazines', () => {
    expect(weightSpan('art')).toBe('15% to 35% depending on the magazine')
    expect(weightSpan('story')).toBe('15% to 35% depending on the magazine')
    expect(weightSpan('pacing')).toBe('10% to 20% depending on the magazine')
    expect(weightSpan('freshness')).toBe('20% in every magazine')
  })
})

describe('taste copy in the panels', () => {
  it('results: each component shows the weight this magazine gave it', () => {
    // withPendingResult polls at Weekly Bolt: art 35, story 15, pacing 20, fit 10, freshness 20
    useStore.setState({ game: withPendingResult() })
    const { container } = render(<ResultsModal />)
    const weights = [...container.querySelectorAll('.breakdown .item .l small')].map((el) => el.textContent)
    expect(weights).toEqual(['weight 35%', 'weight 15%', 'weight 20%', 'weight 10%', 'weight 20%'])
  })

  it('pitch: every magazine shows what its readers want and its art and story weights', () => {
    useStore.setState({ game: drawUntilReady(startProject(createGame('Rin', 1), DRAFT)) })
    render(<SubmitModal />)
    const bolt = within(screen.getByRole('button', { name: /Weekly Bolt/ }))
    expect(bolt.getByText('Readers love big art and fast pacing.')).toBeTruthy()
    expect(bolt.getByText('Art 35%, story 15%')).toBeTruthy()
    const petal = within(screen.getByRole('button', { name: /Monthly Petal/ }))
    expect(petal.getByText('Readers want a story, and a manga made for them.')).toBeTruthy()
    expect(petal.getByText('Art 15%, story 35%')).toBeTruthy()
  })

  it('desk: the focus hint names the magazines, or the serial\'s magazine while one runs', () => {
    useStore.setState({ game: startProject(createGame('Rin', 1), DRAFT) })
    const { unmount } = render(<StatusCard />)
    expect(screen.getByText(focusHint(null))).toBeTruthy()
    unmount()

    const offer = { ...DRAFT, magazineId: 'monthly-petal', audience: 'young-adults' } as const
    useStore.setState({ game: acceptOffer({ ...createGame('Rin', 1), pendingOffer: offer }) })
    render(<StatusCard />)
    expect(screen.getByText('Story focus suits Monthly Petal (art 15%, story 35%), where your serial runs.')).toBeTruthy()
  })

  it('wizard: each audience names the magazine that reads it and what those readers want', () => {
    render(<NewMangaWizard />)
    fireEvent.click(screen.getByRole('button', { name: /Action/ }))
    fireEvent.click(screen.getByRole('button', { name: /Samurai/ }))
    const kids = within(screen.getByRole('button', { name: /^Kids/ }))
    expect(kids.getByText('Read by Kids Comic Go!: Readers love bright art, and a manga made for them.')).toBeTruthy()
    const adults = within(screen.getByRole('button', { name: /^Adults/ }))
    expect(adults.getByText('Read by Ultra Seinen: Readers prize story and pacing.')).toBeTruthy()
  })

  it('stats: art, story and pacing say how much polls weigh them across magazines', () => {
    render(<StatsModal />)
    expect(screen.getByText('Art score in polls (15% to 35% depending on the magazine), and pages per day')).toBeTruthy()
    expect(screen.getByText('Story score in polls (15% to 35% depending on the magazine), and pages per day')).toBeTruthy()
    expect(screen.getByText(
      'Pacing score in polls (10% to 20% depending on the magazine). Raise it with points or the Editing Seminar',
    )).toBeTruthy()
  })
})
