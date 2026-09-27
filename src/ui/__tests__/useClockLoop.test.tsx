// @vitest-environment happy-dom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { createGame } from '../../sim'
import { syncClockToDay, useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { App } from '../App'
import { clockLoop, useClockLoop } from '../hooks/useClockLoop'

/** The clock loop runs on a frozen clock in every test here, the same stubbing pattern as panels/useReveal's tests. */
const realClock = { ...clockLoop }
const MOUNT_AT = 1000
let now = MOUNT_AT
let frame: FrameRequestCallback | null = null
let lastId = 0
let pendingId = 0

beforeEach(() => {
  now = MOUNT_AT
  frame = null
  lastId = 0
  pendingId = 0
  clockLoop.now = () => now
  clockLoop.raf = (cb) => {
    frame = cb
    pendingId = ++lastId
    return pendingId
  }
  clockLoop.caf = (id) => {
    if (id === pendingId) frame = null
  }
})

afterEach(() => {
  Object.assign(clockLoop, realClock)
})

/** Runs the pending frame, if any, at absolute clock time `now`. */
function fireFrame(atNow: number) {
  now = atNow
  const f = frame
  frame = null
  act(() => f?.(now))
}

function Probe({ running, speed }: { running: boolean; speed: 1 | 2 | 3 }) {
  useClockLoop(running, speed)
  return null
}

describe('useClockLoop', () => {
  beforeEach(() => {
    useClock.setState({ day: 0, fraction: 0, t: 0, logSeenId: 0 })
    syncClockToDay(0)
  })

  it('queues one frame while running', () => {
    render(<Probe running speed={1} />)
    expect(frame).not.toBeNull()
  })

  it('advances the clock and queues the next frame when a frame fires', () => {
    render(<Probe running speed={1} />)
    fireFrame(MOUNT_AT + 500)
    expect(useClock.getState().t).toBeCloseTo(0.5 / 7, 5)
    expect(frame).not.toBeNull()
  })

  it('stops queuing frames once running turns false', () => {
    const { rerender } = render(<Probe running speed={1} />)
    fireFrame(MOUNT_AT + 500)
    rerender(<Probe running={false} speed={1} />)
    expect(frame).toBeNull()
    const t = useClock.getState().t
    fireFrame(MOUNT_AT + 1000)
    expect(useClock.getState().t).toBe(t)
  })
})

describe('useClockSync (through App)', () => {
  beforeEach(() => {
    useClock.setState({ day: 0, fraction: 0, t: 0, logSeenId: 0 })
    useStore.setState({
      game: createGame('Rin', 1), speed: 0, modal: 'none', toasts: [], tutorialStep: 0, readOnly: false,
    })
  })

  it('syncs the clock day and marks the log seen on mount', () => {
    render(<App />)
    const game = useStore.getState().game!
    expect(useClock.getState().day).toBe(0)
    expect(useClock.getState().logSeenId).toBe(game.nextLogId)
  })

  it('follows the day forward when the game advances', () => {
    render(<App />)
    act(() => {
      useStore.setState((s) => ({ game: s.game ? { ...s.game, day: 1 } : s.game }))
    })
    expect(useClock.getState().t).toBeCloseTo(1 / 7, 5)
  })

  it('resets the seen watermark on a new game', () => {
    render(<App />)
    act(() => useStore.getState().newGame('Aki'))
    const game = useStore.getState().game!
    expect(useClock.getState().logSeenId).toBe(game.nextLogId)
  })
})
