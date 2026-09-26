// The actor table is pure: node environment, hand-derived literals (40 px/s, so 4 px per 100 ms).
import { describe, expect, it } from 'vitest'
import { sceneSnapshot } from '../../../test/fakeCanvas'
import type { Snapshot } from '../render'
import { EDITOR_WALK_MS, newActorTable, planActors, settleActors, stepActors } from '../actors'
import type { Actor, ActorTable } from '../actors'

function walker(over: Partial<Actor> = {}): ActorTable {
  const t = newActorTable()
  Object.assign(t.mangaka, { x: 100, y: 100, targetX: 110, targetY: 105, state: 'standing', goal: 'standing', legs: 'xy', anim: 0 }, over)
  // keep everyone else out of the way: already where they are going
  return t
}

function planned(over: Partial<Snapshot> = {}): ActorTable {
  const t = newActorTable()
  planActors(t, sceneSnapshot({ ...over, actors: t }))
  return t
}

describe('the actor table', () => {
  it('starts everyone hidden at the door; the editor walks in in 1400 ms', () => {
    const m = newActorTable().mangaka
    expect([m.x, m.y, m.state, m.goal, m.facing, m.legs, m.anim]).toEqual([260, 102, 'hidden', 'hidden', -1, 'xy', 0])
    expect(EDITOR_WALK_MS).toBe(1400)
  })

  it('walks x first then y at 40 px/s, and stands on arrival', () => {
    const t = walker()
    const m = t.mangaka
    stepActors(t, 100, false)
    expect([m.x, m.y, m.state, m.facing, m.anim]).toEqual([104, 100, 'walking', 1, 100])
    stepActors(t, 200, false)
    expect([m.x, m.y, m.state, m.anim]).toEqual([110, 102, 'walking', 300])
    stepActors(t, 100, false)
    expect([m.x, m.y, m.state, m.anim]).toEqual([110, 105, 'standing', 0])
    stepActors(t, 100, false)
    expect([m.x, m.y, m.state, m.anim]).toEqual([110, 105, 'standing', 0])
  })

  it('faces left walking left, walks y first on yx legs, and snaps under reduced motion', () => {
    const left = walker({ targetX: 90 })
    stepActors(left, 100, false)
    expect(left.mangaka.facing).toBe(-1)
    const yx = walker({ legs: 'yx' })
    stepActors(yx, 100, false)
    expect([yx.mangaka.x, yx.mangaka.y]).toEqual([100, 104])
    const snap = walker()
    stepActors(snap, 1, true)
    expect([snap.mangaka.x, snap.mangaka.y, snap.mangaka.state]).toEqual([110, 105, 'standing'])
  })
})

describe('planActors', () => {
  it('seats the mangaka and one assistant in the reference scene, the cat asleep in its bed', () => {
    const t = planned()
    expect([t.mangaka.targetX, t.mangaka.targetY, t.mangaka.goal]).toEqual([138, 84, 'seated'])
    const a = t.assistants
    expect([a[0].x, a[0].y, a[0].state]).toEqual([74, 106, 'seated'])
    expect([a[1].state, a[2].state]).toEqual(['hidden', 'hidden'])
    expect(t.editor.goal).toBe('hidden')
    expect([t.cat.targetX, t.cat.targetY, t.cat.goal, t.cat.legs]).toEqual([194, 104, 'sleeping', 'xy'])
  })

  it('sends everyone to rest, stands the mangaka between projects, away on a trip, to bed when spent', () => {
    const rest = planned({ activity: 'rest' })
    expect([rest.mangaka.targetX, rest.mangaka.targetY, rest.mangaka.goal]).toEqual([233, 102, 'sleeping'])
    expect(rest.assistants[0].state).toBe('sleeping')
    expect([rest.cat.targetX, rest.cat.targetY, rest.cat.goal, rest.cat.legs]).toEqual([44, 150, 'sitting', 'yx'])
    const idle = planned({ phase: 'idle' }).mangaka
    expect([idle.targetX, idle.targetY, idle.goal]).toEqual([176, 98, 'standing'])
    const away = planned({ away: true }).mangaka
    expect([away.targetX, away.targetY, away.goal]).toEqual([260, 102, 'away'])
    const spent = planned({ stamina: 0 }).mangaka
    expect([spent.targetX, spent.targetY, spent.goal]).toEqual([233, 102, 'sleeping'])
  })

  it('brings the editor in through the door and sends them back out', () => {
    const t = newActorTable()
    planActors(t, sceneSnapshot({ visitor: 'editor', actors: t }))
    const e = t.editor
    expect([e.x, e.y, e.targetX, e.targetY, e.goal]).toEqual([260, 102, 204, 102, 'standing'])
    planActors(t, sceneSnapshot({ visitor: 'none', actors: t }))
    expect([e.targetX, e.targetY, e.goal]).toEqual([260, 102, 'away'])
    settleActors(t)
    expect(e.state).toBe('away')
  })

  it('walks the editor to the spot in 1400 ms', () => {
    const t = newActorTable()
    planActors(t, sceneSnapshot({ visitor: 'editor', actors: t }))
    stepActors(t, 700, false)
    stepActors(t, 700, false)
    expect([t.editor.x, t.editor.y, t.editor.state]).toEqual([204, 102, 'standing'])

    const u = newActorTable()
    planActors(u, sceneSnapshot({ visitor: 'editor', actors: u }))
    stepActors(u, 1000, false)
    stepActors(u, 399, false)
    expect(u.editor.state).toBe('walking')
    expect(u.editor.x).toBeCloseTo(204.04, 6)
    stepActors(u, 1, false)
    expect([u.editor.x, u.editor.state]).toEqual([204, 'standing'])
  })
})
