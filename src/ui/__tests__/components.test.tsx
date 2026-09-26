// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, startProject, submitProject, tickMany } from '../../sim'
import { DRAFT, drawUntilReady } from '../../test/fixtures'
import { useStore } from '../../state/store'
import { StatsModal } from '../panels/StatsModal'
import { StatusCard } from '../hud/StatusCard'
import { Metric, Reward, WarningPips } from '../components'

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), readOnly: false })
})

// ---------- characterisation: must pass against today's markup, and again after the Metric/Reward migration ----------

describe('StatsModal (characterisation)', () => {
  it('fresh game: reward tiles read Money/Fans/Max stamina/Published/Best rank/Avg score with their starting values', () => {
    const { container } = render(<StatsModal />)

    const labels = [...container.querySelectorAll('.reward .l')].map((el) => el.textContent)
    const values = [...container.querySelectorAll('.reward .n')].map((el) => el.textContent)

    expect(labels).toEqual(['Money', 'Fans', 'Max stamina', 'Published', 'Best rank', 'Avg score'])
    expect(values).toEqual(['¥3,000', '0', '100', '0', '—', '—'])
  })

  it('fresh game: the Experience head reads 0 / 100', () => {
    const { container } = render(<StatsModal />)

    const head = container.querySelector('.metric .head b.num')

    expect(head?.textContent).toBe('0 / 100')
  })
})

describe('StatusCard (characterisation)', () => {
  it('drawing: shows Art quality and Story quality heads with matching progressbars', () => {
    useStore.setState({
      game: tickMany(startProject(createGame('Rin', 1), DRAFT), 2),
      tutorialStep: -1,
      readOnly: false,
    })
    render(<StatusCard />)

    expect(screen.getByText('Art quality')).toBeTruthy()
    expect(screen.getByText('Story quality')).toBeTruthy()

    const artBar = screen.getByRole('progressbar', { name: 'Art quality' })
    const storyBar = screen.getByRole('progressbar', { name: 'Story quality' })
    const artHead = artBar.closest('.metric')!.querySelector('b.num')!
    const storyHead = storyBar.closest('.metric')!.querySelector('b.num')!

    // The head number is the rounded bar value: the same invariant Metric's default enforces.
    expect(artHead.textContent).toBe(artBar.getAttribute('aria-valuenow'))
    expect(storyHead.textContent).toBe(storyBar.getAttribute('aria-valuenow'))
  })

  it('submitted with resultsDay already in the past: clamps the poll-wait count to 0 days, never -1', () => {
    let game = drawUntilReady(startProject(createGame('Rin', 1), DRAFT))
    game = submitProject(game, 'weekly-bolt')
    // Force a state that should be impossible in play (resultsDay before the current day) to prove the
    // display clamps rather than trusting the sign of resultsDay - day.
    game = { ...game, project: { ...game.project!, resultsDay: game.day - 1 } }
    useStore.setState({ game, tutorialStep: -1, readOnly: false })
    render(<StatusCard />)

    const bar = screen.getByRole('progressbar', { name: 'Waiting for results' })
    const head = bar.closest('.metric')!.querySelector('b.num')!
    expect(head.textContent).toBe('0 days')
    expect(head.textContent).not.toContain('-1')
  })
})

// ---------- unit tests for the new components (fail until they exist) ----------

describe('Metric', () => {
  it('rounds the bar value into the head and the progressbar, defaulting barLabel to label', () => {
    render(<Metric label="Art" bar={41.6} tone="blue" />)

    const bar = screen.getByRole('progressbar', { name: 'Art' })
    expect(screen.getByText('Art')).toBeTruthy()
    expect(bar.getAttribute('aria-valuenow')).toBe('42')
    const head = bar.closest('.metric')!.querySelector('b.num')!
    expect(head.textContent).toBe('42')
  })

  it('uses an explicit value, max, barLabel and striped over the bar-derived defaults', () => {
    render(<Metric label="Back in" value="3 days" bar={2} max={5} tone="green" striped barLabel="Trip progress" />)

    const bar = screen.getByRole('progressbar', { name: 'Trip progress' })
    expect(bar.getAttribute('aria-valuemax')).toBe('5')
    expect(bar.className).toContain('striped')
    const head = bar.closest('.metric')!.querySelector('b.num')!
    expect(head.textContent).toBe('3 days')
  })
})

describe('Reward', () => {
  it('renders a value/label tile', () => {
    const { container } = render(<Reward value="+¥1,200" label="Payment" />)

    expect(container.querySelector('.reward .n')?.textContent).toBe('+¥1,200')
    expect(container.querySelector('.reward .l')?.textContent).toBe('Payment')
  })
})

describe('WarningPips', () => {
  it('lights up the pips at the warning count and labels the total', () => {
    const { container } = render(<WarningPips warnings={2} />)

    const pips = container.querySelectorAll('.warnings i')
    expect(pips).toHaveLength(3)
    expect([...pips].filter((i) => i.classList.contains('on'))).toHaveLength(2)
    expect(container.querySelector('.warnings')?.getAttribute('aria-label')).toBe('2 of 3 warnings')
  })
})
