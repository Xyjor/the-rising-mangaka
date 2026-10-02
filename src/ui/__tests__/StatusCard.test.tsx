// @vitest-environment happy-dom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame, startProject, startTrip, submitProject, tickMany } from '../../sim'
import { useStore } from '../../state/store'
import { DRAFT, drawUntilReady } from '../../test/fixtures'
import { StatusCard } from '../hud/StatusCard'
import { PLACE_ART } from '../art/registry'

beforeEach(() => {
  useStore.setState({ game: createGame('Rin', 1), tutorialStep: -1, readOnly: false, modal: 'none' })
})

function region() {
  return within(screen.getByRole('region', { name: 'Current project' }))
}

describe('StatusCard', () => {
  it('offers a fresh game a new manga, rest or a job', () => {
    render(<StatusCard />)
    expect(region().getByText('Your desk is clear')).toBeTruthy()
    expect(region().getByRole('button', { name: /Plan a new manga/ })).toBeTruthy()
    const activity = within(region().getByRole('group', { name: 'Activity' }))
    expect(activity.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual(['Rest', 'Job'])
  })

  it('shows drawing controls and page progress while drawing', () => {
    useStore.setState({ game: tickMany(startProject(createGame('Rin', 1), DRAFT), 2) })
    const { container } = render(<StatusCard />)
    const activity = within(region().getByRole('group', { name: 'Activity' }))
    expect(activity.getAllByRole('button').map((b) => b.textContent?.trim())).toEqual(['Draw', 'Rest', 'Job'])
    expect(region().getByRole('group', { name: 'Focus' })).toBeTruthy()
    expect(region().getByRole('progressbar', { name: 'Pages drawn' }).getAttribute('aria-valuemax')).toBe('20')
    expect(container.querySelector('[class~="ring"]')).toBeNull()
  })

  it('pitches a finished manuscript', () => {
    useStore.setState({ game: drawUntilReady(startProject(createGame('Rin', 1), DRAFT)) })
    render(<StatusCard />)
    fireEvent.click(region().getByRole('button', { name: /Pitch to a magazine/ }))
    expect(useStore.getState().modal).toBe('submit')
  })

  it('waits for poll results once submitted', () => {
    useStore.setState({ game: submitProject(drawUntilReady(startProject(createGame('Rin', 1), DRAFT)), 'weekly-bolt') })
    render(<StatusCard />)
    expect(region().getByRole('progressbar', { name: 'Waiting for results' })).toBeTruthy()
  })

  it('shows the trip while away', () => {
    const g = createGame('Rin', 1)
    useStore.setState({ game: startTrip({ ...g, player: { ...g.player, money: 100000 } }, 'library') })
    render(<StatusCard />)
    expect(region().getByText('Away')).toBeTruthy()
    expect(document.querySelector(`.postcard img[src="${PLACE_ART.library.src}"]`)).not.toBeNull()
    expect(region().getByRole('progressbar', { name: 'Trip progress' })).toBeTruthy()
  })
})
