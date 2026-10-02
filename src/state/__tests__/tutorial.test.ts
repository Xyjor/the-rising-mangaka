import { beforeEach, describe, expect, it } from 'vitest'
import { createGame, getPhase, startProject, submitProject, tickMany } from '../../sim'
import type { GameState } from '../../sim'
import { DRAFT, drawUntilReady, withPendingResult } from '../../test/fixtures'
import { STEPS, firstStepFor, resumeTutorialStep, stepAfter } from '../tutorial'
import type { TutorialTrigger } from '../tutorial'
import { useStore } from '../store'

const st = () => useStore.getState()

const drawing = (day = 0): GameState => startProject(day ? tickMany(createGame('Rin', 42), day) : createGame('Rin', 42), DRAFT)
const ready = (): GameState => drawUntilReady(drawing())
const submitted = (): GameState => submitProject(ready(), 'weekly-bolt')

describe('STEPS', () => {
  it('is the twelve steps in order, each completed by one trigger', () => {
    expect(STEPS.map((s) => s.id)).toEqual([
      'plan', 'wizard', 'today', 'stamina', 'clock', 'pitch', 'forecast', 'why', 'notebook', 'stats', 'rail', 'goal',
    ])
    expect(STEPS.map((s) => s.anchor)).toEqual([
      'plan', 'wizard-steps', 'activity', 'stamina', 'speed', 'pitch', 'forecast', 'breakdown', 'rail-notebook',
      'rail-stats', 'rail', 'next-goal',
    ])
    expect(STEPS.map((s) => s.completes)).toEqual([
      'wizard-opened', 'project-started', 'next', 'next', 'clock-run', 'submit-opened', 'submitted', 'result-dismissed',
      'next', 'next', 'next', 'next',
    ])
    expect(STEPS.map((s) => s.phase)).toEqual([
      'idle', 'idle', 'drawing', 'drawing', 'drawing', 'ready', 'ready', 'submitted', 'any', 'any', 'any', 'any',
    ])
    expect(STEPS.every((s) => s.holds)).toBe(true)
    expect(STEPS[0].line).toBe('Everything starts with a manga. This button plans one: a genre, a theme, and who it is for.')
    expect(STEPS[11].line).toBe(
      'That is the loop. Your next goal waits on the desk, and I will be at the door whenever something needs you.',
    )
  })
})

describe('stepAfter', () => {
  it('advances on the step’s own trigger and ends after the last step', () => {
    const table: [number, TutorialTrigger, number][] = [
      [0, 'wizard-opened', 1],
      [1, 'project-started', 2],
      [2, 'next', 3],
      [3, 'next', 4],
      [4, 'clock-run', 5],
      [5, 'submit-opened', 6],
      [6, 'submitted', 7],
      [7, 'result-dismissed', 8],
      [8, 'next', 9],
      [9, 'next', 10],
      [10, 'next', 11],
      [11, 'next', -1],
    ]
    for (const [step, trigger, after] of table) expect([step, trigger, stepAfter(step, trigger)]).toEqual([step, trigger, after])
  })

  it('steps back when the wizard or the pitch window closes early', () => {
    expect(stepAfter(1, 'wizard-closed')).toBe(0)
    expect(stepAfter(6, 'submit-closed')).toBe(5)
  })

  it('ignores every other trigger, and -1 stays -1', () => {
    expect(stepAfter(0, 'next')).toBe(0)
    expect(stepAfter(0, 'wizard-closed')).toBe(0)
    expect(stepAfter(2, 'clock-run')).toBe(2)
    expect(stepAfter(5, 'submit-closed')).toBe(5)
    expect(stepAfter(7, 'next')).toBe(7)
    expect(stepAfter(-1, 'next')).toBe(-1)
    expect(stepAfter(-1, 'wizard-opened')).toBe(-1)
  })
})

describe('resumeTutorialStep', () => {
  it('keeps step 0 only on a fresh career', () => {
    expect(resumeTutorialStep(0, createGame('Rin', 42))).toBe(0)
    expect(resumeTutorialStep(0, tickMany(createGame('Rin', 42), 40))).toBe(-1)
    expect(resumeTutorialStep(0, drawing())).toBe(-1)
  })

  it('keeps -1, and refuses anything out of range', () => {
    expect(resumeTutorialStep(-1, createGame('Rin', 42))).toBe(-1)
    expect(resumeTutorialStep(12, drawing())).toBe(-1)
    expect(resumeTutorialStep(-2, drawing())).toBe(-1)
    expect(resumeTutorialStep(2.5, drawing())).toBe(-1)
  })

  it('keeps a step whose phase is the game’s, or any', () => {
    expect(resumeTutorialStep(2, drawing())).toBe(2)
    expect(resumeTutorialStep(1, createGame('Rin', 42))).toBe(1)
    expect(resumeTutorialStep(6, ready())).toBe(6)
    expect(resumeTutorialStep(9, tickMany(createGame('Rin', 42), 40))).toBe(9)
  })

  it('moves on to the first later step of the game’s phase, else ends', () => {
    expect(resumeTutorialStep(5, createGame('Rin', 42))).toBe(-1)
    expect(resumeTutorialStep(2, ready())).toBe(5)
    expect(resumeTutorialStep(5, submitted())).toBe(7)
    expect(resumeTutorialStep(7, drawing())).toBe(-1)
  })
})

describe('firstStepFor', () => {
  it('is the first step of the game’s phase', () => {
    expect(firstStepFor(createGame('Rin', 42))).toBe(0)
    expect(firstStepFor(drawing(40))).toBe(2)
    expect(firstStepFor(ready())).toBe(5)
    expect(firstStepFor(submitted())).toBe(7)
  })
})

describe('the tutorial in the store', () => {
  beforeEach(() => {
    useStore.setState({
      game: createGame('Rin', 42), speed: 0, resumeSpeed: 1, modal: 'none', toasts: [], tutorialStep: 0, readOnly: false,
      deskHidden: false,
    })
  })

  it('walks the whole first one-shot through store actions', () => {
    st().openModal('wizard')
    expect(st().tutorialStep).toBe(1)
    st().startProject(DRAFT)
    expect(st().tutorialStep).toBe(2)
    expect(st().speed).toBe(0)
    expect(st().modal).toBe('none')
    st().advanceTutorial('next')
    expect(st().tutorialStep).toBe(3)
    st().advanceTutorial('next')
    expect(st().tutorialStep).toBe(4)
    st().setSpeed(1)
    expect(st().tutorialStep).toBe(5)
    expect(st().speed).toBe(1)

    // The clock runs until the manuscript is ready; the tick's own auto-pause stops it there.
    let guard = 0
    while (getPhase(st().game!) !== 'ready' && guard++ < 400) st().tick()
    expect(getPhase(st().game!)).toBe('ready')
    expect(st().speed).toBe(0)
    expect(st().tutorialStep).toBe(5)

    st().openModal('submit')
    expect(st().tutorialStep).toBe(6)
    st().submitProject('weekly-bolt')
    expect(st().tutorialStep).toBe(7)
    expect(st().speed).toBe(0)

    guard = 0
    while (!st().game!.pendingResult && guard++ < 30) st().tick()
    expect(st().game!.pendingResult).not.toBeNull()
    expect(st().tutorialStep).toBe(7)
    st().dismissResult()
    expect(st().tutorialStep).toBe(8)
    st().advanceTutorial('next')
    st().advanceTutorial('next')
    st().advanceTutorial('next')
    expect(st().tutorialStep).toBe(11)
    st().advanceTutorial('next')
    expect(st().tutorialStep).toBe(-1)
  })

  it('pauses the clock and shows the desk when a step begins', () => {
    useStore.setState({ game: drawing(), tutorialStep: 2, speed: 2, deskHidden: true })
    st().advanceTutorial('next')
    expect(st().tutorialStep).toBe(3)
    expect(st().speed).toBe(0)
    expect(st().deskHidden).toBe(false)
  })

  it('leaves the clock alone for a trigger that does not move the step', () => {
    useStore.setState({ game: drawing(), tutorialStep: 2, speed: 2 })
    st().advanceTutorial('submit-opened')
    expect(st().tutorialStep).toBe(2)
    expect(st().speed).toBe(2)
  })

  it('runs the clock with Space at the clock step', () => {
    useStore.setState({ game: drawing(), tutorialStep: 4, speed: 0, resumeSpeed: 2 })
    st().togglePause()
    expect(st().tutorialStep).toBe(5)
    expect(st().speed).toBe(2)
  })

  it('steps back to the plan button when the wizard closes before a project starts', () => {
    st().openModal('wizard')
    expect(st().tutorialStep).toBe(1)
    st().closeModal()
    expect(st().tutorialStep).toBe(0)
    expect(st().modal).toBe('none')
  })

  it('steps back to the pitch button when the pitch window closes without a submission', () => {
    useStore.setState({ game: ready(), tutorialStep: 5 })
    st().openModal('submit')
    expect(st().tutorialStep).toBe(6)
    st().closeModal()
    expect(st().tutorialStep).toBe(5)
  })

  it('skips the tutorial', () => {
    useStore.setState({ tutorialStep: 3 })
    st().skipTutorial()
    expect(st().tutorialStep).toBe(-1)
  })

  it('keeps today’s behaviour once the tutorial is done: starting a project resumes the clock', () => {
    useStore.setState({ tutorialStep: -1, resumeSpeed: 2 })
    st().openModal('wizard')
    expect(st().tutorialStep).toBe(-1)
    st().startProject(DRAFT)
    expect(st().speed).toBe(2)
    st().setSpeed(1)
    expect(st().tutorialStep).toBe(-1)
  })

  it('replays from a mid-career game at its phase’s first step, stopped, with the window closed', () => {
    useStore.setState({ game: drawing(40), tutorialStep: -1, speed: 2, modal: 'settings' })
    st().replayTutorial()
    expect(st().tutorialStep).toBe(2)
    expect(st().speed).toBe(0)
    expect(st().modal).toBe('none')

    useStore.setState({ game: tickMany(createGame('Rin', 42), 40), tutorialStep: -1 })
    st().replayTutorial()
    expect(st().tutorialStep).toBe(0)
  })

  it('refuses a replay with a result or an offer waiting, or in a read-only tab', () => {
    useStore.setState({ game: withPendingResult(), tutorialStep: -1, speed: 0, modal: 'none' })
    st().replayTutorial()
    expect(st().tutorialStep).toBe(-1)

    const g = createGame('Rin', 42)
    useStore.setState({
      game: { ...g, pendingOffer: { magazineId: 'kids-comic', title: 'X', genre: 'fantasy', theme: 'magic', audience: 'kids' } },
    })
    st().replayTutorial()
    expect(st().tutorialStep).toBe(-1)

    useStore.setState({ game: drawing(40), readOnly: true, modal: 'settings' })
    st().replayTutorial()
    expect(st().tutorialStep).toBe(-1)
    expect(st().modal).toBe('settings')
  })
})
