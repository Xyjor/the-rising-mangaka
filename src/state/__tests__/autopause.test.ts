import { beforeEach, describe, expect, it } from 'vitest'
import {
  acceptOffer, createGame, dismissResult, getPhase, startProject, submitProject, tick, tickMany,
} from '../../sim'
import type { GameState } from '../../sim'
import { useStore } from '../store'

const draft = { title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'teens' } as const

function withStats(s: GameState, v: number): GameState {
  return { ...s, player: { ...s.player, stats: { art: v, story: v, pacing: v } } }
}

function drawUntilReady(state: GameState): GameState {
  let s = state
  let guard = 0
  while (getPhase(s) !== 'ready' && guard++ < 400) s = tick(s)
  return s
}

/** A running serial whose author has just lost all their skill: the way engine.test.ts builds a cancellation. */
function doomedSerial(): GameState {
  let s = withStats(createGame('Rin', 42), 90)
  s = drawUntilReady(startProject(s, draft))
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

  it('refuses to open the wizard or the pitch in the wrong phase', () => {
    let s = drawUntilReady(startProject(createGame('Rin', 42), draft))
    s = submitProject(s, 'weekly-bolt')
    s = tickMany(s, 7)
    expect(s.pendingResult).not.toBeNull()
    load(s)
    useStore.getState().openModal('wizard')
    expect(useStore.getState().modal).toBe('none')

    load(startProject(createGame('Rin', 42), draft))
    useStore.getState().openModal('submit')
    expect(useStore.getState().modal).toBe('none')

    load(drawUntilReady(startProject(createGame('Rin', 42), draft)))
    useStore.getState().openModal('submit')
    expect(useStore.getState().modal).toBe('submit')
  })
})
