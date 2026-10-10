// The actor table is pure: node environment, hand-derived literals (40 px/s, so 4 px per 100 ms).
import { describe, expect, it } from 'vitest'
import { sceneSnapshot } from '../../../test/fakeCanvas'
import type { Snapshot } from '../render'
import { EDITOR_SPOT, EDITOR_WALK_MS, RIG_BED_FRAME, RIG_SPOTS, editorWalksIn, newActorTable, planActors, settleActors, stepActors } from '../actors'
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
    expect([m.x, m.y, m.state, m.goal, m.facing, m.legs, m.anim]).toEqual([254, 85, 'hidden', 'hidden', -1, 'xy', 0])
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
    expect([t.mangaka.targetX, t.mangaka.targetY, t.mangaka.goal]).toEqual([132, 67, 'seated'])
    const a = t.assistants
    expect([a[0].x, a[0].y, a[0].state]).toEqual([66, 89, 'seated'])
    expect([a[1].state, a[2].state]).toEqual(['hidden', 'hidden'])
    expect(t.editor.goal).toBe('hidden')
    expect([t.cat.targetX, t.cat.targetY, t.cat.goal, t.cat.legs]).toEqual([196, 118, 'sleeping', 'xy'])
  })

  it('sends everyone to rest, stands the mangaka between projects, away on a trip, to bed when spent', () => {
    const rest = planned({ activity: 'rest' })
    expect([rest.mangaka.targetX, rest.mangaka.targetY, rest.mangaka.goal]).toEqual([216, 106, 'sleeping'])
    expect(rest.assistants[0].state).toBe('sleeping')
    expect([rest.cat.targetX, rest.cat.targetY, rest.cat.goal, rest.cat.legs]).toEqual([44, 150, 'sitting', 'yx'])
    const idle = planned({ phase: 'idle' }).mangaka
    expect([idle.targetX, idle.targetY, idle.goal]).toEqual([170, 81, 'standing'])
    const away = planned({ away: true }).mangaka
    expect([away.targetX, away.targetY, away.goal]).toEqual([254, 85, 'away'])
    const spent = planned({ stamina: 0 }).mangaka
    expect([spent.targetX, spent.targetY, spent.goal]).toEqual([216, 106, 'sleeping'])
  })

  it('brings the editor in through the door and sends them back out', () => {
    const t = newActorTable()
    planActors(t, sceneSnapshot({ visitor: 'editor', actors: t }))
    const e = t.editor
    expect([e.x, e.y, e.targetX, e.targetY, e.goal]).toEqual([254, 85, 198, 85, 'standing'])
    planActors(t, sceneSnapshot({ visitor: 'none', actors: t }))
    expect([e.targetX, e.targetY, e.goal]).toEqual([254, 85, 'away'])
    settleActors(t)
    expect(e.state).toBe('away')
  })

  it('walks the editor to the spot in 1400 ms', () => {
    const t = newActorTable()
    planActors(t, sceneSnapshot({ visitor: 'editor', actors: t }))
    stepActors(t, 700, false)
    stepActors(t, 700, false)
    expect([t.editor.x, t.editor.y, t.editor.state]).toEqual([198, 85, 'standing'])

    const u = newActorTable()
    planActors(u, sceneSnapshot({ visitor: 'editor', actors: u }))
    stepActors(u, 1000, false)
    stepActors(u, 399, false)
    expect(u.editor.state).toBe('walking')
    expect(u.editor.x).toBeCloseTo(198.04, 6)
    stepActors(u, 1, false)
    expect([u.editor.x, u.editor.state]).toEqual([198, 'standing'])
  })
})

describe('editorWalksIn', () => {
  it('puts a settled editor back outside the door, still headed for the spot: a fresh walk in', () => {
    const t = newActorTable()
    planActors(t, sceneSnapshot({ visitor: 'editor', actors: t }))
    settleActors(t)
    expect([t.editor.x, t.editor.y, t.editor.state]).toEqual([198, 85, 'standing'])
    editorWalksIn(t)
    expect([t.editor.x, t.editor.y, t.editor.state]).toEqual([254, 85, 'hidden'])
    stepActors(t, EDITOR_WALK_MS, false)
    expect([t.editor.x, t.editor.y, t.editor.state]).toEqual([198, 85, 'standing'])
  })
})

describe('the 0.11 spots (task 9)', () => {
  it('starts every actor with no pose: the 0.10 frames until the cast driver sets one', () => {
    const t = newActorTable()
    expect([t.mangaka.pose, t.editor.pose, t.cat.pose]).toEqual(['', '', ''])
  })

  it('plans the rig spots when asked: the mangaka in through its own door, the assistants\' row, the cat\'s bed', () => {
    const t = newActorTable()
    planActors(t, sceneSnapshot({ actors: t }), RIG_SPOTS)
    expect([t.mangaka.x, t.mangaka.y, t.mangaka.targetX, t.mangaka.targetY, t.mangaka.goal]).toEqual([250, 69, 124, 58, 'seated'])
    expect(t.assistants.map((a) => [a.x, a.y, a.state])).toEqual([[21, 80, 'seated'], [254, 85, 'hidden'], [254, 85, 'hidden']])
    expect([t.cat.targetX, t.cat.targetY]).toEqual([202, 118])
    const plan = (over: Partial<Snapshot>) => {
      const u = newActorTable()
      planActors(u, sceneSnapshot({ ...over, actors: u }), RIG_SPOTS)
      return [u.mangaka.targetX, u.mangaka.targetY, u.mangaka.goal]
    }
    expect(plan({ activity: 'rest' })).toEqual([220, 90, 'sleeping'])
    expect(plan({ phase: 'idle' })).toEqual([170, 81, 'standing'])
    expect(plan({ away: true })).toEqual([250, 69, 'away'])
    const three = newActorTable()
    planActors(three, sceneSnapshot({ assistants: [{ look: 0, stamina: 80 }, { look: 1, stamina: 80 }, { look: 2, stamina: 80 }], actors: three }), RIG_SPOTS)
    expect(three.assistants.map((a) => a.x)).toEqual([21, 55, 89])
  })

  it('fits the 0.11 spots around the furniture', () => {
    const { seat, stand, bed } = RIG_SPOTS.mangaka
    expect(seat.y + 40).toBe(98) // the seated waist (row 40) on the desk top
    expect(seat.x + 31).toBeLessThanOrEqual(155) // clear of the arm lamp (x 156)
    expect(seat.y + 6).toBeGreaterThan(63) // the seated head (row 6) under the corkboard (to y 63)
    expect(stand.x).toBeGreaterThanOrEqual(170) // clear of the arm lamp (to x 169)
    expect(stand.y).toBeGreaterThanOrEqual(81) // below the sill's coffee machine and trophies (to y 80)
    expect(stand.y + 47).toBe(128)
    const { xs, y } = RIG_SPOTS.seats
    expect(xs.map((x, i) => (i ? x - xs[i - 1] : 0))).toEqual([0, 34, 34])
    expect(y + 40).toBe(120) // the assistants' waist on their desk top
    expect(xs[0] + 3).toBeGreaterThanOrEqual(24) // the first page and head inside the phone crop (x 24)
    expect(xs[2] + 27).toBeLessThanOrEqual(116) // the third head ends at the stock desk's left edge
    // the bed's key frames at their own origin: the lying head (cols 23-46) over the pillow (x 232-245)
    expect([RIG_BED_FRAME.x + 23, RIG_BED_FRAME.x + 46]).toEqual([224, 247])
    // the actor's bed spot puts its standing head (cols 4-27, rows 0-21) on the lying and sitting-up head, so walking
    // in or out of bed the head never jumps
    expect([bed.x + 4, bed.y]).toEqual([RIG_BED_FRAME.x + 23, RIG_BED_FRAME.y])
    const cat = RIG_SPOTS.catBed
    expect(cat.x).toBeGreaterThan(stand.x + 31)
    expect(cat.x + 11).toBeLessThan(RIG_BED_FRAME.x + 23) // clear of the lying head
    expect(cat.x + 11).toBeLessThan(bed.x) // and of the standing frame at the bed
    expect(cat.y).toBeGreaterThan(EDITOR_SPOT.y + 31)
  })
})
