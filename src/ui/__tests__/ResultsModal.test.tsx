// @vitest-environment happy-dom
import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { installSound, nullEngine } from '../../audio/instance'
import { createGame, startProject, submitProject, tickMany } from '../../sim'
import type { GameState, RivalPlacing } from '../../sim'
import { DRAFT, drawUntilReady, withPendingResult } from '../../test/fixtures'
import { createFakeSound } from '../../test/fakeSound'
import type { FakeSound } from '../../test/fakeSound'
import { useStore } from '../../state/store'
import { ResultsModal } from '../panels/ResultsModal'
import { revealClock } from '../panels/useReveal'

/**
 * The reveal runs on a frozen clock in every test here: time stands still at mount until a test calls `advanceTo`
 * (frames every 16 ms, as a visible window gets them) or `jumpTo` (one late frame, as after a hidden window). Mount
 * happens at clock time 1000, so a hook that forgot to subtract its start time would read 1000 ms in, not 0. Each
 * requested frame gets a new id, and cancelling clears the pending frame only when given that id.
 */
const realClock = { ...revealClock }
const MOUNT_AT = 1000
const FRAME_MS = 16
let now = MOUNT_AT
let frame: FrameRequestCallback | null = null
let lastId = 0
let pendingId = 0

beforeEach(() => {
  useStore.setState({ game: withPendingResult(), tutorialStep: 0, readOnly: false })
  now = MOUNT_AT
  frame = null
  lastId = 0
  pendingId = 0
  revealClock.now = () => now
  revealClock.raf = (cb) => {
    frame = cb
    pendingId = ++lastId
    return pendingId
  }
  revealClock.caf = (id) => {
    if (id === pendingId) frame = null
  }
})

afterEach(() => {
  Object.assign(revealClock, realClock)
})

/** Moves the frozen clock to `ms` after mount in one step and runs the pending frame, if any. */
function jumpTo(ms: number) {
  now = MOUNT_AT + ms
  const f = frame
  frame = null
  act(() => f?.(now))
}

/** Moves the frozen clock to `ms` after mount in 16 ms frames, the last one landing exactly on `ms`. */
function advanceTo(ms: number) {
  let t = now - MOUNT_AT
  while (t < ms) {
    t = Math.min(ms, t + FRAME_MS)
    jumpTo(t)
  }
}

/**
 * A key press on `el` as a browser handles it: keydown, then, for Enter or Space on a button and unless the keydown
 * was cancelled, the click that activates it. Returns whether the keydown was cancelled.
 */
function press(el: HTMLElement, key: string): boolean {
  const cancelled = !fireEvent.keyDown(el, { key })
  if (!cancelled && (key === 'Enter' || key === ' ') && el.tagName === 'BUTTON') fireEvent.click(el)
  return cancelled
}

/**
 * ResultsModal assumes it is only ever mounted while `pendingResult` is set (App.tsx renders it as
 * `{hasResult && <ResultsModal />}` and unmounts it the instant dismissal clears the result). Mirror
 * that guard here so the component is not asked to render itself against a null result.
 */
function Harness() {
  const hasResult = useStore((s) => !!s.game?.pendingResult)
  return hasResult ? <ResultsModal /> : null
}

/** The seed-42 Weekly Bolt result, recast with the player at `rank` and the rival placing `rival`. */
function withRival(rank: number, rival?: RivalPlacing): GameState {
  const g = withPendingResult()
  return { ...g, pendingResult: { ...g.pendingResult!, rank, rival } }
}

describe('ResultsModal', () => {
  it('clears the pending result and the tutorial hint when closed', () => {
    render(<Harness />)
    const closeButton = screen.getByRole('button', { name: /Back to the studio/i })

    fireEvent.click(closeButton)

    expect(useStore.getState().game!.pendingResult).toBeNull()
    expect(useStore.getState().tutorialStep).toBe(-1)
  })
})

describe('ResultsModal rival line', () => {
  it('says where the rival placed and that the player finished ahead', () => {
    useStore.setState({ game: withRival(2, { name: 'Natsume Kujo', score: 51, rank: 4 }) })
    render(<Harness />)
    expect(screen.getByText('Natsume Kujo placed #4 with 51. You finished ahead.')).toBeTruthy()
  })

  it('or behind', () => {
    useStore.setState({ game: withRival(9, { name: 'Natsume Kujo', score: 51, rank: 4 }) })
    render(<Harness />)
    expect(screen.getByText('Natsume Kujo placed #4 with 51. You finished behind.')).toBeTruthy()
  })

  it('says nothing about a rival who was not in the poll', () => {
    // the seed-42 poll is at Weekly Bolt; the year-one rival runs in Kids Comic Go!
    expect(useStore.getState().game!.pendingResult!.rival).toBeUndefined()
    render(<Harness />)
    expect(screen.queryByText(/ placed #/)).toBeNull()
  })

  it('shows the line for a real Kids Comic Go! poll, where the year-one rival runs', () => {
    let s = drawUntilReady(startProject(createGame('Rin', 42), { ...DRAFT, audience: 'kids' }))
    s = tickMany(submitProject(s, 'kids-comic'), 7)
    const r = s.pendingResult!
    expect(r.rival).toBeDefined()
    useStore.setState({ game: s })
    render(<Harness />)
    // seed 42's rival is Natsume Kujo; the line names the rival's own rank and score from the result
    const line = screen.getByText((text) => text.startsWith('Natsume Kujo placed #'))
    expect(line.textContent).toContain(`placed #${r.rival!.rank} with ${r.rival!.score}`)
    expect(line.textContent).toMatch(r.rank < r.rival!.rank ? /You finished (just )?ahead\.$/ : /You finished (just )?behind\.$/)
  })
})

/**
 * The seed-42 fixture (withPendingResult): Blade Club ranks 12 of 13 at Weekly Bolt, a weak finish, score 45.
 * Breakdown art 33, story 34, pacing 32, audience fit 60, freshness 80; rewards ¥866, 567 fans, 66 XP; no offer.
 * Its plan (5 bars, 3 reward tiles): drumroll 150 ms; bars start 350, 600, 850, 1100, 1350 and take 400 ms each;
 * the score counts 1750-2200; stamp 2300; jingle 2420; reward tiles land at 2550, 2700, 2850 over 400 ms; end 3250.
 */
describe('ResultsModal reveal', () => {
  let sound: FakeSound
  let restoreMotion: () => void

  beforeEach(() => {
    sound = createFakeSound()
    installSound(sound)
    restoreMotion = stubReducedMotion(false)
  })

  afterEach(() => {
    installSound(nullEngine)
    restoreMotion()
  })

  const values = (c: HTMLElement) => [...c.querySelectorAll('.breakdown .v')].map((el) => el.textContent)
  const tiles = (c: HTMLElement) => [...c.querySelectorAll('.rewards .reward .n')].map((el) => el.textContent)
  const landed = (c: HTMLElement) => [...c.querySelectorAll('.rewards .reward')].map((el) => el.getAttribute('data-landed'))
  const hero = (c: HTMLElement) => c.querySelector<HTMLElement>('.result-hero')!
  /** The visible texts among `selector`'s elements (a hidden swap state keeps its space with visibility: hidden). */
  const shown = (c: HTMLElement, selector: string) =>
    [...c.querySelectorAll<HTMLElement>(selector)].filter((el) => el.style.visibility !== 'hidden').map((el) => el.textContent)
  /** The visible hero heading; two visible headings would read "a | b" and fail the comparison. */
  const headline = (c: HTMLElement) => shown(c, '.hero-head > h3').join(' | ')
  const shownLine = (c: HTMLElement) => shown(c, '.hero-line > *')
  /** Each hero heading as [text, aria-hidden, visibility]. */
  const headings = (c: HTMLElement) =>
    [...c.querySelectorAll<HTMLElement>('.hero-head > h3')].map((el) => [el.textContent, el.getAttribute('aria-hidden'), el.style.visibility])
  const ariaValues = () => screen.getAllByRole('progressbar').map((el) => el.getAttribute('aria-valuenow'))
  const FINAL = ['33', '34', '32', '60', '80']
  const RANKED = 'Ranked #12 of 13 works, with an overall score of 45 out of 100.'

  it('with reduced motion shows the final result on the first frame and plays only the stamp and the jingle', () => {
    restoreMotion()
    restoreMotion = stubReducedMotion(true)
    const { container } = render(<Harness />)

    expect(values(container)).toEqual(FINAL)
    expect(hero(container).getAttribute('data-stamped')).toBe('true')
    expect(headline(container)).toBe('Back of the pack.')
    expect(tiles(container)).toEqual(['+¥866', '+567', '+66'])
    // rank 12 of 13 is a weak finish, so the stamp is followed by the falling jingle
    expect(sound.plays).toEqual(['stamp', 'jingle-down'])
    expect(frame).toBeNull()
  })

  it('on a clock that has not moved, counts from zero under "Counting the votes" and a dashed "?" badge', () => {
    const { container } = render(<Harness />)

    expect(values(container)).toEqual(['0', '0', '0', '0', '0'])
    expect(hero(container).getAttribute('data-stamped')).toBe('false')
    expect(headline(container)).toBe('Counting the votes')
    // both headings share one grid cell so the hero keeps its height; the one not shown is hidden from screen readers
    expect(headings(container)).toEqual([['Counting the votes', null, ''], ['Back of the pack.', 'true', 'hidden']])
    expect(shownLine(container)).toEqual(['Readers scored it 0 out of 100.'])
    const badge = container.querySelector('.rank-badge')!
    expect(badge.textContent).toBe('?')
    expect(badge.getAttribute('data-tier')).toBeNull()
    expect(landed(container)).toEqual(['false', 'false', 'false'])
    expect(sound.plays).toEqual([])
  })

  it('a pointer-down in the body skips to the end: final values, the stamp and the jingle once, no bar or coin', () => {
    const { container } = render(<Harness />)

    fireEvent.pointerDown(container.querySelector('.breakdown')!)

    expect(values(container)).toEqual(FINAL)
    expect(hero(container).getAttribute('data-stamped')).toBe('true')
    expect(headline(container)).toBe('Back of the pack.')
    expect(headings(container)).toEqual([['Counting the votes', 'true', 'hidden'], ['Back of the pack.', null, '']])
    expect(shownLine(container)).toEqual([RANKED])
    expect(container.querySelector('.rank-badge')!.textContent).toBe('#12')
    expect(tiles(container)).toEqual(['+¥866', '+567', '+66'])
    expect(landed(container)).toEqual(['true', 'true', 'true'])
    expect(sound.plays).toEqual(['stamp', 'jingle-down'])
    expect(frame).toBeNull()

    fireEvent.pointerDown(container.querySelector('.speech')!)
    expect(sound.plays).toEqual(['stamp', 'jingle-down'])
  })

  it('any key skips too', () => {
    const { container } = render(<Harness />)

    // a key that does not activate the button is left alone
    expect(press(screen.getByRole('button', { name: 'Back to the studio' }), 'Shift')).toBe(false)

    expect(values(container)).toEqual(FINAL)
    expect(hero(container).getAttribute('data-stamped')).toBe('true')
    expect(sound.plays).toEqual(['stamp', 'jingle-down'])
  })

  it('a skip after the drumroll stops it and plays only the stamp and jingle still due', () => {
    const { container } = render(<Harness />)
    advanceTo(400)
    expect(sound.stops).toEqual([])

    fireEvent.pointerDown(container.querySelector('.breakdown')!)

    expect(sound.plays).toEqual(['drumroll', 'bar', 'stamp', 'jingle-down'])
    expect(sound.stops).toEqual(['drumroll'])
  })

  it('ducks the music to 0.3 while open and back to 1 on unmount', () => {
    const { unmount } = render(<Harness />)
    expect(sound.ducks).toEqual([0.3])

    unmount()

    expect(sound.ducks).toEqual([0.3, 1])
  })

  it('at 400 ms the first bar has counted up, after the drumroll and the first bar cue', () => {
    const { container } = render(<Harness />)

    advanceTo(400)

    // bar 1 (art 33) grows over 350-750 ms: at 400 ms, 1 - (1 - 50/400)^3 = 0.330078125 of 33 = 10.89, shown as 11
    expect(values(container)).toEqual(['11', '0', '0', '0', '0'])
    // the widths count, but each progressbar tells screen readers its final value
    expect(ariaValues()).toEqual(FINAL)
    expect(sound.plays).toEqual(['drumroll', 'bar'])
    // the bar cue's pitch: 33/100 of 12 semitones = 3.96, rounded to 4
    expect(sound.pitches).toEqual([undefined, 4])
  })

  it('unmounting mid-reveal stops the drumroll and cancels the next frame', () => {
    const { unmount } = render(<Harness />)
    advanceTo(400)
    expect(frame).not.toBeNull()

    unmount()

    expect(sound.stops).toEqual(['drumroll'])
    expect(frame).toBeNull()
  })

  // About 200 renders of 16 ms frames: its own budget, so a slow CI runner (release.yml runs on windows-latest) cannot
  // time it out at vitest's 5 s default.
  it('plays the whole sequence: the bars at their pitches, the score count, the stamp, the jingle and a coin per tile', { timeout: 15000 }, () => {
    const { container } = render(<Harness />)
    advanceTo(400)

    advanceTo(1975)
    // every bar is done by 1750; the score counts 1750-2200: at 1975, 1 - 0.5^3 = 0.875 of 45 = 39.4, shown as 39
    expect(values(container)).toEqual(FINAL)
    expect(shownLine(container)).toEqual(['Readers scored it 39 out of 100.'])
    expect(hero(container).getAttribute('data-stamped')).toBe('false')
    expect(sound.stops).toEqual([])

    advanceTo(2300)
    expect(hero(container).getAttribute('data-stamped')).toBe('true')
    expect(headline(container)).toBe('Back of the pack.')
    expect(shownLine(container)).toEqual([RANKED])
    expect(container.querySelector('.rank-badge')!.textContent).toBe('#12')
    expect(sound.stops).toEqual(['drumroll'])
    expect(landed(container)).toEqual(['false', 'false', 'false'])

    advanceTo(2700)
    // the payment tile lands 2550-2950: at 2700, 1 - (1 - 150/400)^3 = 0.755859375 of ¥866 = 654.6, shown as ¥655
    expect(landed(container)).toEqual(['true', 'true', 'false'])
    expect(tiles(container)).toEqual(['+¥655', '+0', '+0'])

    advanceTo(3250)
    expect(tiles(container)).toEqual(['+¥866', '+567', '+66'])
    expect(landed(container)).toEqual(['true', 'true', 'true'])
    expect(sound.plays).toEqual([
      'drumroll', 'bar', 'bar', 'bar', 'bar', 'bar', 'stamp', 'jingle-down', 'coins', 'coins', 'coins',
    ])
    // bar pitches: 33, 34, 32, 60 and 80 of 100 over 12 semitones, rounded: 4, 4, 4, 7, 10
    expect(sound.pitches).toEqual([undefined, 4, 4, 4, 7, 10, undefined, undefined, undefined, undefined, undefined])
    // the reveal is over, so no further frame is asked for
    expect(frame).toBeNull()
  })

  it('keeps the rival line, the pay line and the offer line hidden until the stamp', () => {
    useStore.setState({ game: withRival(12, { name: 'Natsume Kujo', score: 51, rank: 4 }) })
    const { container } = render(<Harness />)
    const rival = screen.getByText('Natsume Kujo placed #4 with 51. You finished behind.')
    const pay = screen.getByText((text) => text.includes('scaled by your score'))
    const offer = screen.getByText((text) => text.startsWith('Rank 12 of 13, score 45: no serial offer this time.'))
    expect([rival, pay, offer].map((el) => el.style.visibility)).toEqual(['hidden', 'hidden', 'hidden'])

    fireEvent.pointerDown(container.querySelector('.breakdown')!)

    expect([rival, pay, offer].map((el) => el.style.visibility)).toEqual(['', '', ''])
  })

  it('under StrictMode plays the stamp and the jingle once and leaves the music unducked after unmount', () => {
    restoreMotion()
    restoreMotion = stubReducedMotion(true)
    const { unmount } = render(<StrictMode><Harness /></StrictMode>)

    expect(sound.plays).toEqual(['stamp', 'jingle-down'])
    unmount()
    // StrictMode mounts, unmounts and remounts once in development: 0.3, 1, 0.3, then 1 at the real unmount
    expect(sound.ducks).toEqual([0.3, 1, 0.3, 1])
  })

  it('under StrictMode without reduced motion plays the drumroll once and stops it on unmount', () => {
    const { unmount } = render(<StrictMode><Harness /></StrictMode>)
    advanceTo(200)
    expect(sound.plays).toEqual(['drumroll'])

    unmount()

    expect(sound.stops).toEqual(['drumroll'])
    expect(sound.ducks).toEqual([0.3, 1, 0.3, 1])
    expect(frame).toBeNull()
  })

  it('a gap of more than 250 ms between frames (a hidden window) is a skip, never a burst of every beat missed', () => {
    const { container } = render(<Harness />)
    advanceTo(200)
    expect(sound.plays).toEqual(['drumroll'])

    jumpTo(2200)

    expect(sound.plays).toEqual(['drumroll', 'stamp', 'jingle-down'])
    expect(sound.stops).toEqual(['drumroll'])
    expect(values(container)).toEqual(FINAL)
    expect(hero(container).getAttribute('data-stamped')).toBe('true')
    expect(tiles(container)).toEqual(['+¥866', '+567', '+66'])
    expect(frame).toBeNull()
  })

  it('a gap of exactly 250 ms is still an ordinary frame', () => {
    const { container } = render(<Harness />)
    advanceTo(100)

    jumpTo(350)

    // (100, 350] holds the drumroll at 150 and the first bar at 350
    expect(sound.plays).toEqual(['drumroll', 'bar'])
    expect(hero(container).getAttribute('data-stamped')).toBe('false')
    expect(frame).not.toBeNull()
  })

  it('a first frame more than 250 ms after mount (opened in a hidden window) lands on the final state', () => {
    const { container } = render(<Harness />)

    jumpTo(1000)

    expect(sound.plays).toEqual(['stamp', 'jingle-down'])
    expect(values(container)).toEqual(FINAL)
    expect(hero(container).getAttribute('data-stamped')).toBe('true')
  })

  it('Enter on "Back to the studio" mid-reveal only skips; the next Enter dismisses', () => {
    const { container } = render(<Harness />)
    advanceTo(400)
    const button = screen.getByRole('button', { name: 'Back to the studio' })

    expect(press(button, 'Enter')).toBe(true)

    expect(values(container)).toEqual(FINAL)
    expect(hero(container).getAttribute('data-stamped')).toBe('true')
    expect(useStore.getState().game!.pendingResult).not.toBeNull()

    expect(press(button, 'Enter')).toBe(false)

    expect(useStore.getState().game!.pendingResult).toBeNull()
  })

  it('Space mid-reveal only skips too', () => {
    const { container } = render(<Harness />)

    expect(press(screen.getByRole('button', { name: 'Back to the studio' }), ' ')).toBe(true)

    expect(hero(container).getAttribute('data-stamped')).toBe('true')
    expect(useStore.getState().game!.pendingResult).not.toBeNull()
  })

  it('with reduced motion the reveal is already over, so the first Enter dismisses', () => {
    restoreMotion()
    restoreMotion = stubReducedMotion(true)
    render(<Harness />)

    expect(press(screen.getByRole('button', { name: 'Back to the studio' }), 'Enter')).toBe(false)

    expect(useStore.getState().game!.pendingResult).toBeNull()
  })

  it('stays silent in a read-only tab, which mirrors another tab\'s game', () => {
    useStore.setState({ readOnly: true })
    const { container } = render(<Harness />)
    advanceTo(400)

    fireEvent.pointerDown(container.querySelector('.breakdown')!)

    expect(values(container)).toEqual(FINAL)
    expect(sound.plays).toEqual([])
  })

  it('"Back to the studio" dismisses on the first click mid-reveal', () => {
    render(<Harness />)
    advanceTo(400)

    fireEvent.click(screen.getByRole('button', { name: 'Back to the studio' }))

    expect(useStore.getState().game!.pendingResult).toBeNull()
    expect(sound.stops).toEqual(['drumroll'])
    expect(sound.ducks).toEqual([0.3, 1])
  })
})
