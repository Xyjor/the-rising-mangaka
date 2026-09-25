import { beforeEach, describe, expect, it } from 'vitest'
import {
  acceptOffer, createGame, dismissResult, startProject, submitProject, tickMany,
} from '../../sim'
import type { GameState } from '../../sim'
import { draw } from '../../sim/rng'
import { useStore } from '../store'
import { DRAFT, drawUntilReady, withStats } from '../../test/fixtures'

/** A running serial whose author has just lost all their skill: the way engine.test.ts builds a cancellation. */
function doomedSerial(): GameState {
  let s = withStats(createGame('Rin', 42), 90)
  s = drawUntilReady(startProject(s, DRAFT))
  s = submitProject(s, 'weekly-bolt')
  s = tickMany(s, 7)
  s = dismissResult(s)
  s = acceptOffer(s)
  return withStats(s, 5)
}

function load(game: GameState) {
  useStore.setState({ game, speed: 1, resumeSpeed: 1, modal: 'none', toasts: [] })
}

describe('store auto-pause', () => {
  beforeEach(() => useStore.setState({ game: null, speed: 0, modal: 'none', toasts: [] }))

  it('stops the clock when a serial is cancelled and the desk empties', () => {
    load(doomedSerial())
    const st = useStore.getState()
    let guard = 0
    let cancelled = false
    while (!cancelled && guard++ < 900) {
      const g = useStore.getState().game!
      if (g.player.stamina < 20) st.setActivity('rest')
      else st.setActivity('work')
      useStore.setState({ speed: 1 })
      st.tick()
      const next = useStore.getState().game!
      cancelled = [...next.serials, ...(next.serial ? [next.serial] : [])].some((x) => x.status === 'cancelled')
    }
    expect(cancelled).toBe(true)
    expect(useStore.getState().speed).toBe(0)
    expect(useStore.getState().game!.project).toBeNull()
  })

  it('stops the clock when a trip ends', () => {
    load(createGame('Rin', 9))
    const st = useStore.getState()
    st.startTrip('art-class')
    const trip = useStore.getState().game!.trip!
    expect(useStore.getState().speed).toBe(1)
    let guard = 0
    while (useStore.getState().game!.day < trip.endsDay && guard++ < 30) {
      useStore.setState({ speed: 1 })
      st.tick()
    }
    expect(useStore.getState().game!.trip).toBeNull()
    expect(useStore.getState().speed).toBe(0)
  })

  it('stops the clock once when a random event lands, and answering it clears the desk card', () => {
    // the first event seed whose first draw hits (under 0.35)
    let eventSeed = 1
    while (draw(eventSeed, 1).values[0] >= 0.35) eventSeed++
    // day 30 with the roll due: tomorrow is day 31, a roll day, and a fresh career can only catch a cold
    load({ ...createGame('Rin', 9), day: 30, nextEventDay: 0, eventSeed })
    const st = useStore.getState()
    st.tick()
    expect(useStore.getState().game!.event).toMatchObject({ id: 'cold', day: 31 })
    expect(useStore.getState().speed).toBe(0)
    expect(useStore.getState().toasts.map((t) => t.text)).toContain('You caught a cold. Answer on your desk within 7 days.')
    // the event is still waiting the next day, but it only paused the clock the day it landed
    useStore.setState({ speed: 1 })
    st.tick()
    expect(useStore.getState().game!.event).not.toBeNull()
    expect(useStore.getState().speed).toBe(1)
    st.resolveEvent('b')
    expect(useStore.getState().game!.event).toBeNull()
  })

  it('refuses to open the wizard or the pitch in the wrong phase', () => {
    let s = drawUntilReady(startProject(createGame('Rin', 42), DRAFT))
    s = submitProject(s, 'weekly-bolt')
    s = tickMany(s, 7)
    expect(s.pendingResult).not.toBeNull()
    load(s)
    useStore.getState().openModal('wizard')
    expect(useStore.getState().modal).toBe('none')

    load(startProject(createGame('Rin', 42), DRAFT))
    useStore.getState().openModal('submit')
    expect(useStore.getState().modal).toBe('none')

    load(drawUntilReady(startProject(createGame('Rin', 42), DRAFT)))
    useStore.getState().openModal('submit')
    expect(useStore.getState().modal).toBe('submit')
  })
})
