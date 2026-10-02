// @vitest-environment happy-dom
//
// happy-dom does no layout (every rect is zero), so these tests assert what the guide finds and where it mounts,
// not the pixels it lands on; the placement is checked by eye in the browser.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { acceptOffer, createGame, startProject } from '../../sim'
import type { GameState } from '../../sim'
import type { Modal as ModalId } from '../../state/store'
import { useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { STEPS } from '../../state/tutorial'
import { DRAFT, KIDS_OFFER, withPendingResult, withReadyOneShot } from '../../test/fixtures'
import { App } from '../App'

let restore: () => void = () => {}
afterEach(() => { restore(); restore = () => {} })

/** The game and the open window each step is written for. */
function fixtureFor(step: number): { game: GameState; modal: ModalId } {
  const fresh = createGame('Rin', 1)
  if (step === 0) return { game: fresh, modal: 'none' }
  if (step === 1) return { game: fresh, modal: 'wizard' }
  if (step <= 4) return { game: startProject(fresh, DRAFT), modal: 'none' }
  if (step <= 6) return { game: withReadyOneShot(fresh, DRAFT, 40, 40), modal: step === 6 ? 'submit' : 'none' }
  if (step === 7) {
    restore = stubReducedMotion(true)
    return { game: withPendingResult(), modal: 'none' }
  }
  return { game: fresh, modal: 'none' }
}

function at(step: number) {
  const { game, modal } = fixtureFor(step)
  useStore.setState({ game, speed: 0, modal, toasts: [], tutorialStep: step, readOnly: false, deskHidden: false })
}

const bubble = () => document.querySelector<HTMLElement>('.tutorial-bubble')
const nextFrame = () => act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))) })

beforeEach(() => {
  useClock.setState({ guideVisible: false })
  useStore.setState({ game: null, speed: 0, modal: 'none', toasts: [], tutorialStep: -1, readOnly: false, deskHidden: false })
})

describe('TutorialGuide: every step finds its anchor and says its line', () => {
  for (let i = 0; i < STEPS.length; i++) {
    it(`step ${i} (${STEPS[i].id}) points at "${STEPS[i].anchor}"`, () => {
      at(i)
      render(<App />)
      const anchor = document.querySelector(`[data-tutorial="${STEPS[i].anchor}"]`)
      expect(anchor).not.toBeNull()
      const b = bubble()
      expect(b).not.toBeNull()
      expect(b!.textContent).toContain(STEPS[i].line)
      expect(b!.getAttribute('role')).toBe('note')
      expect(b!.getAttribute('aria-live')).toBe('polite')
      expect(b!.querySelector('.who')?.textContent).toBe('Editor')
      const inDialog = b!.closest('dialog')
      if (i === 1 || i === 6 || i === 7) {
        expect(inDialog).not.toBeNull()
        expect(inDialog!.contains(anchor)).toBe(true)
        // after the body, so the modal's autofocus never lands on the guide
        expect(inDialog!.querySelector('.modal-body')!.contains(b)).toBe(false)
        // the backdrop already dims: only the ring
        expect(inDialog!.querySelector('.tutorial-ring')).not.toBeNull()
        expect(document.querySelector('.tutorial-hole')).toBeNull()
      } else {
        expect(inDialog).toBeNull()
        expect(document.querySelector('.tutorial-hole')).not.toBeNull()
      }
    })
  }
})

describe('TutorialGuide: buttons', () => {
  it('Skip ends the tutorial and the guide goes', () => {
    at(0)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip the tutorial' }))
    expect(useStore.getState().tutorialStep).toBe(-1)
    expect(bubble()).toBeNull()
    expect(document.querySelector('.tutorial-hole')).toBeNull()
  })

  it('Skip works from inside a dialog too', () => {
    at(6)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip the tutorial' }))
    expect(useStore.getState().tutorialStep).toBe(-1)
    expect(bubble()).toBeNull()
  })

  it('action steps show no Next button', () => {
    for (const i of [0, 1, 4, 5, 6, 7]) {
      at(i)
      const { unmount } = render(<App />)
      expect(bubble()).not.toBeNull()
      expect(screen.queryByRole('button', { name: /^(Next|Done)$/ })).toBeNull()
      unmount()
      restore()
      restore = () => {}
    }
  })

  for (const i of [2, 3, 8, 9, 10]) {
    it(`Next moves step ${i} on`, () => {
      at(i)
      render(<App />)
      expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(useStore.getState().tutorialStep).toBe(i + 1)
    })
  }

  it('the last step says Done and ends the tutorial', () => {
    at(11)
    render(<App />)
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(useStore.getState().tutorialStep).toBe(-1)
    expect(bubble()).toBeNull()
  })

  it('an info step moves focus to Next on entry; an action step leaves it alone', () => {
    at(8)
    const { unmount } = render(<App />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }))
    unmount()
    at(0)
    render(<App />)
    expect(bubble()!.contains(document.activeElement)).toBe(false)
  })

  it('Enter inside the bubble is Next, once', () => {
    at(8)
    render(<App />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next' }), { key: 'Enter' })
    expect(useStore.getState().tutorialStep).toBe(9)
  })

  it('Enter on Skip does not move on', () => {
    at(8)
    render(<App />)
    const skip = screen.getByRole('button', { name: 'Skip the tutorial' })
    fireEvent.keyDown(skip, { key: 'Enter' })
    expect(useStore.getState().tutorialStep).toBe(8)
  })
})

describe('TutorialGuide: when it shows', () => {
  it('a missing anchor renders nothing: the step waits', () => {
    // the pitch step with nothing ready to pitch
    useStore.setState({ game: createGame('Rin', 1), tutorialStep: 5 })
    render(<App />)
    expect(document.querySelector('[data-tutorial="pitch"]')).toBeNull()
    expect(bubble()).toBeNull()
    expect(document.querySelector('.tutorial-hole')).toBeNull()
  })

  it('shows up once the anchor appears', async () => {
    useStore.setState({ game: createGame('Rin', 1), tutorialStep: 5 })
    render(<App />)
    expect(bubble()).toBeNull()
    act(() => useStore.setState({ game: withReadyOneShot(createGame('Rin', 1), DRAFT, 40, 40) }))
    await nextFrame()
    expect(bubble()?.textContent).toContain(STEPS[5].line)
  })

  it('waits while the desk is hidden', () => {
    at(0)
    useStore.setState({ deskHidden: true })
    render(<App />)
    expect(bubble()).toBeNull()
  })

  it('waits while another window covers an anchor outside it', async () => {
    at(8)
    useStore.setState({ modal: 'stats' })
    render(<App />)
    expect(bubble()).toBeNull()
    act(() => useStore.setState({ modal: 'none' }))
    await nextFrame()
    expect(bubble()?.textContent).toContain(STEPS[8].line)
  })

  it('never shows in a read-only tab, or once the tutorial is done', () => {
    at(0)
    useStore.setState({ readOnly: true })
    const { unmount } = render(<App />)
    expect(bubble()).toBeNull()
    unmount()
    at(0)
    useStore.setState({ tutorialStep: -1 })
    render(<App />)
    expect(bubble()).toBeNull()
  })

  it('marks the app (data-guide, never an anchor name) and the presentation clock while a step shows, and clears both', () => {
    at(0)
    render(<App />)
    const app = document.querySelector('.app')!
    expect(app.hasAttribute('data-guide')).toBe(true)
    expect(app.hasAttribute('data-tutorial')).toBe(false)
    expect(useClock.getState().guideVisible).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Skip the tutorial' }))
    expect(app.hasAttribute('data-guide')).toBe(false)
    expect(useClock.getState().guideVisible).toBe(false)
  })

  it('a waiting step is not visible: the presentation flag stays clear', () => {
    useStore.setState({ game: startProject(createGame('Rin', 1), DRAFT), tutorialStep: 5 })
    render(<App />)
    expect(bubble()).toBeNull()
    expect(useClock.getState().guideVisible).toBe(false)
  })

  it('the first step finds the Plan button of a desk whose serial is still in the poll', () => {
    const running = acceptOffer({ ...createGame('Rin', 1), pendingOffer: KIDS_OFFER })
    const game: GameState = { ...running, project: null, serial: { ...running.serial!, status: 'ended' } }
    useStore.setState({ game, tutorialStep: 0 })
    render(<App />)
    expect(screen.getByText(/still waiting for reader votes/)).toBeTruthy()
    expect(bubble()?.textContent).toContain(STEPS[0].line)
  })

  it('dismissing the result at step 7 hands focus to Next on step 8', () => {
    at(7)
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Back to the studio' }))
    expect(useStore.getState().tutorialStep).toBe(8)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }))
  })

  it('the N hotkey still opens the wizard and moves the guide into it', () => {
    at(0)
    render(<App />)
    fireEvent.keyDown(window, { key: 'n' })
    expect(useStore.getState().tutorialStep).toBe(1)
    const b = bubble()
    expect(b?.closest('dialog')).not.toBeNull()
    expect(b!.textContent).toContain(STEPS[1].line)
  })

  it('mounts after the rail, so the shell order holds', () => {
    at(0)
    render(<App />)
    const rail = screen.getByRole('navigation', { name: 'Studio menus' })
    expect(rail.compareDocumentPosition(bubble()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
