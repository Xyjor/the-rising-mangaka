// @vitest-environment happy-dom
// StudioScene hands the generated scene images to render, and repaints once when one finishes loading (the loop
// skips a frame identical to the last one, so a load alone would otherwise never show). sceneImages is mocked: a room
// image that starts out loading, and the load hook captured so the test can fire it.
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { fakeContext, fakeImage } from '../../test/fakeCanvas'
import type { FakeContext } from '../../test/fakeCanvas'
import { createGame } from '../../sim'
import { useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { NO_ART } from '../scene/sceneArt'
import type { SceneArt } from '../scene/sceneArt'

const hooks = vi.hoisted(() => ({ listeners: [] as (() => void)[] }))
const room = fakeImage('room/apartment', 320, 114)
const art: SceneArt = { room: { ...NO_ART.room, apartment: room }, prop: {} }

vi.mock('../scene/sceneImages', () => ({
  sceneImages: () => art,
  onSceneImageLoad: (cb: () => void) => {
    hooks.listeners.push(cb)
    return () => { hooks.listeners.splice(hooks.listeners.indexOf(cb), 1) }
  },
}))

const { StudioScene } = await import('../scene/StudioScene')

let fake: FakeContext
let restoreMotion: () => void

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  // reduced motion: frame 0 and one loop step a second, so the loop repaints only when something changed
  restoreMotion = stubReducedMotion(true)
  fake = fakeContext()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake.ctx as never)
  useStore.setState({ game: createGame('Rin', 1), speed: 0, modal: 'none', toasts: [], tutorialStep: 0, readOnly: false })
  useClock.setState({ t: 0.3 })
  room.complete = false
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  restoreMotion()
})

describe('StudioScene with generated art', () => {
  it('paints the code-drawn room while the image loads, then repaints once with the image when it has loaded', () => {
    render(<StudioScene running={false} />)
    vi.advanceTimersByTime(1100)
    expect(fake.log.length).toBeGreaterThan(0)
    expect(fake.images).toEqual([])

    // nothing changed: the loop skips the frame
    fake.log.length = 0
    vi.advanceTimersByTime(1100)
    expect(fake.log).toHaveLength(0)

    room.complete = true
    expect(hooks.listeners).toHaveLength(1)
    hooks.listeners[0]()
    vi.advanceTimersByTime(1100)
    expect(fake.images[0]).toMatchObject({ id: 'room/apartment', x: 0, y: 0, w: 320, h: 114 })
  })

  it('stops listening for loads when it unmounts', () => {
    const view = render(<StudioScene running={false} />)
    expect(hooks.listeners).toHaveLength(1)
    view.unmount()
    expect(hooks.listeners).toHaveLength(0)
  })
})
