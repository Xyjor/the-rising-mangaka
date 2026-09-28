// @vitest-environment happy-dom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '../../test/dom'
import { stubReducedMotion } from '../../test/dom'
import { createGame } from '../../sim'
import type { GameState } from '../../sim'
import { useStore } from '../../state/store'
import { POP_MAX, POP_MS, Pops, popsFor } from '../scene/Pops'
import type { PopState } from '../scene/Pops'

const A = { x: 100, y: 50 }
const base = createGame('Rin', 1)
const st = (game: GameState | null, over: Partial<PopState> = {}): PopState => ({ game, saveLoads: 0, readOnly: false, ...over })
const bump = (g: GameState, p: Partial<GameState['player']>, over: Partial<GameState> = {}): GameState =>
  ({ ...g, ...over, player: { ...g.player, ...p } })

describe('popsFor', () => {
  const m = base.player.money
  it('money up and down', () => {
    expect(popsFor(st(base), st(bump(base, { money: m + 1200 })), A)).toEqual([{ kind: 'money', text: '+¥1,200', x: 100, y: 50 }])
    expect(popsFor(st(base), st(bump(base, { money: m - 400 })), A).map((p) => p.text)).toEqual(['-¥400'])
  })
  it('fans, xp and level', () => {
    expect(popsFor(st(base), st(bump(base, { fans: base.player.fans + 40 })), A)[0].text).toBe('+40 fans')
    const z = bump(base, { xp: 0, level: 1 })
    expect(popsFor(st(z), st(bump(z, { xp: 12 })), A)[0].text).toBe('+12 xp')
    expect(popsFor(st(z), st(bump(z, { xp: 0, level: 2 })), A)[0].text).toBe('Level 2')
  })
  it('marks only the level-up pop with levelUp: true, not a plain xp gain (fix round 1)', () => {
    const z = bump(base, { xp: 0, level: 1 })
    expect(popsFor(st(z), st(bump(z, { xp: 12 })), A)[0].levelUp).toBeUndefined()
    expect(popsFor(st(z), st(bump(z, { xp: 0, level: 2 })), A)[0].levelUp).toBe(true)
  })
  it('stacks later pops 10 px higher', () => {
    const out = popsFor(st(base), st(bump(base, { money: m + 1200, fans: base.player.fans + 40 })), A)
    expect(out.map((p) => [p.kind, p.y])).toEqual([['money', 50], ['fans', 40]])
  })
  it('skips loads, other worlds, jumps and read-only tabs', () => {
    const n = bump(base, { money: m + 1200 })
    expect(popsFor(st(base), st(n, { saveLoads: 1 }), A)).toEqual([])
    expect(popsFor(st(base), st({ ...n, worldSeed: base.worldSeed + 1 }), A)).toEqual([])
    expect(popsFor(st(base), st({ ...n, day: base.day + 2 }), A)).toEqual([])
    expect(popsFor(st(base), st(n, { readOnly: true }), A)).toEqual([])
    expect(popsFor(st(null), st(n), A)).toEqual([])
  })
})

describe('Pops', () => {
  let restore: () => void = () => {}
  beforeEach(() => { useStore.setState({ game: base, readOnly: false }) })
  afterEach(() => { vi.useRealTimers(); restore() })

  it('shows a pop, removes it after POP_MS, keeps at most POP_MAX', () => {
    restore = stubReducedMotion(true)
    vi.useFakeTimers()
    const { container } = render(<Pops rect={{ width: 320, height: 180 }} anchor={() => A} />)
    act(() => useStore.setState({ game: bump(base, { money: base.player.money + 1200 }) }))
    const pop = container.querySelector('.pop[data-kind=money]')
    expect(pop?.textContent).toBe('+¥1,200')
    act(() => { vi.advanceTimersByTime(POP_MS) })
    expect(container.querySelector('.pop')).toBeNull()
    for (let i = 1; i <= 7; i++) {
      act(() => useStore.setState((s) => ({ game: bump(s.game!, { money: s.game!.player.money + 1 }) })))
    }
    expect(container.querySelectorAll('.pop').length).toBe(POP_MAX)
  })
})
