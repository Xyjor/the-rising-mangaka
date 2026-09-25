// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../test/dom'
import {
  SERIAL_GRACE_CHAPTERS, acceptOffer, createGame, dismissResult, setActivity, startProject, submitProject, tick,
  tickMany,
} from '../../sim'
import type { GameState } from '../../sim'
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
