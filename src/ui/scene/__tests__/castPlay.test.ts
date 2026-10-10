// The cast driver: pure rules plus a table of tracks mutated in place, node environment. Assertions name animations
// by id and poses through ANIMS, so they hold as each animation's art replaces its stand-in.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { newActorTable, setRigLive } from '../actors'
import { animLength } from '../animation'
import {
  IDLE_MOMENTS, PHASE_MS, baseAnimFor, headCentre, headTop, idlePool, newCastPlay, reactionAnim, resumeCast, settleCast,
  stepCast, transitionFor,
} from '../castPlay'
import type { CastInput } from '../castPlay'
import { nextIdle } from '../idleSchedule'
import { ANIMS } from '../rig/anims'

const input = (over: Partial<CastInput> = {}): CastInput => ({
  day: 12, working: true, late: false, ready: false, stamina: 100, assistants: [], reaction: null, preview: null, ...over,
})

describe('the driver\'s rules', () => {
  it('picks the base loop for a state', () => {
    const c = { working: true, late: false, ready: false }
    expect(baseAnimFor('mangaka', 'seated', c)).toBe('seat-draw')
    expect(baseAnimFor('mangaka', 'seated', { ...c, late: true })).toBe('seat-draw-late')
    expect(baseAnimFor('mangaka', 'seated', { ...c, working: false })).toBe('seat-idle')
    expect(baseAnimFor('mangaka', 'standing', c)).toBe('stand')
    expect(baseAnimFor('mangaka', 'standing', { ...c, ready: true })).toBe('stand-ready')
    expect(baseAnimFor('mangaka', 'walking', c)).toBe('walk')
    expect(baseAnimFor('mangaka', 'sleeping', c)).toBe('sleep')
    expect(baseAnimFor('mangaka', 'away', c)).toBeNull()
    expect(baseAnimFor('assistant', 'seated', { ...c, late: true })).toBe('seat-draw')
    expect(baseAnimFor('assistant', 'sleeping', c)).toBe('doze')
    expect(baseAnimFor('assistant', 'hidden', c)).toBeNull()
  })

  it('plays a transition between the states that have one', () => {
    expect([transitionFor('walking', 'seated'), transitionFor('seated', 'walking'), transitionFor('walking', 'sleeping'), transitionFor('sleeping', 'walking')])
      .toEqual(['sit-down', 'stand-up', 'lie-down', 'get-up'])
    expect([transitionFor('standing', 'walking'), transitionFor('seated', 'sleeping')]).toEqual([null, null])
  })

  it('draws idle moments from the posture\'s pool, rubbing the eyes and sipping when tired', () => {
    expect(idlePool('stand', false)).toEqual(['stand-look', 'stand-sip'])
    expect(idlePool('seat-draw', false)).toEqual(['seat-stretch', 'seat-sip', 'seat-flip'])
    expect(idlePool('seat-idle', true)).toEqual(['seat-rub', 'seat-sip'])
    for (const base of ['walk', 'sleep', 'doze', 'stand-ready', 'seat-draw-late'] as const) expect(idlePool(base, false)).toEqual([])
  })

  it('maps each reaction to the character and its state (decision 7)', () => {
    expect(reactionAnim('good-poll', 'mangaka', 'standing')).toBe('stand-cheer')
    expect(reactionAnim('level-up', 'mangaka', 'seated')).toBe('seat-cheer')
    expect(reactionAnim('bad-poll', 'mangaka', 'standing')).toBe('stand-slump')
    expect(reactionAnim('bad-poll', 'mangaka', 'seated')).toBe('seat-slump')
    expect(reactionAnim('late', 'mangaka', 'seated')).toBe('seat-panic')
    expect(reactionAnim('missed', 'mangaka', 'seated')).toBe('seat-tear')
    expect(reactionAnim('missed', 'mangaka', 'sleeping')).toBeNull()
    expect(reactionAnim('good-poll', 'assistant', 'seated')).toBe('seat-cheer')
    expect(reactionAnim('level-up', 'assistant', 'seated')).toBeNull()
    expect(reactionAnim('good-poll', 'assistant', 'sleeping')).toBeNull()
  })

  it('puts the head\'s top 6 rows down seated and 8 in bed, its centre 16 columns in, in bed too (the actor stands on the lying head)', () => {
    expect([headTop('standing'), headTop('walking'), headTop('seated'), headTop('sleeping')]).toEqual([0, 0, 6, 8])
    expect([headCentre('standing'), headCentre('walking'), headCentre('seated'), headCentre('sleeping')]).toEqual([16, 16, 16, 16])
  })

  it('counts the idle pools\' animations as moments a reaction may cut short', () => {
    expect([...IDLE_MOMENTS].sort()).toEqual(['seat-flip', 'seat-rub', 'seat-sip', 'seat-stretch', 'stand-look', 'stand-sip'])
  })
})

describe('stepCast', () => {
  beforeEach(() => setRigLive({ assistants: true }))
  afterEach(() => setRigLive({ assistants: false }))

  it('sits down on arriving at the desk, then draws; stands up on leaving it', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.mangaka.state = 'walking'
    stepCast(play, t, input(), 1000, false)
    expect(play.mangaka.player?.base.id).toBe('walk')
    t.mangaka.state = 'seated'
    stepCast(play, t, input(), 1500, false)
    const sit = animLength(ANIMS['sit-down'])
    expect([play.mangaka.player?.base.id, play.mangaka.player?.over?.anim.id, play.mangaka.player?.baseAt]).toEqual(['seat-draw', 'sit-down', 1500 + sit])
    expect(t.mangaka.pose).toBe(ANIMS['sit-down'].steps[0].pose)
    stepCast(play, t, input(), 1500 + sit, false)
    expect(play.mangaka.player?.over).toBeNull()
    expect(t.mangaka.pose).toBe(ANIMS['seat-draw'].steps[0].pose)
    t.mangaka.state = 'walking'
    stepCast(play, t, input(), 5000, false)
    expect([play.mangaka.player?.base.id, play.mangaka.player?.over?.anim.id]).toEqual(['walk', 'stand-up'])
  })

  it('plays a reaction cue once, and never one a track found waiting when it started', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.mangaka.state = 'seated'
    stepCast(play, t, input(), 0, false)
    const cue = { id: 1, kind: 'good-poll' } as const
    stepCast(play, t, input({ reaction: cue }), 100, false)
    expect([play.mangaka.player?.over?.anim.id, play.mangaka.cue]).toEqual(['seat-cheer', 1])
    stepCast(play, t, input({ reaction: cue }), 100 + animLength(ANIMS['seat-cheer']), false)
    expect(play.mangaka.player?.over).toBeNull()
    t.assistants[0].state = 'seated'
    stepCast(play, t, input({ reaction: cue, assistants: [{ stamina: 80 }] }), 3000, false)
    expect([play.assistants[0].player?.over, play.assistants[0].cue]).toEqual([null, 1])
  })

  it('fires the day\'s first idle moment after its seeded wait, from the posture\'s pool, then schedules the next', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.mangaka.state = 'standing'
    const idle = input({ working: false })
    stepCast(play, t, idle, 0, false)
    // nextIdle(12, 0, 0) = { gapMs: 9238, pick: 61578 }: 61578 % 2 = 0, the stand pool's first
    expect(play.mangaka.nextIdleAt).toBe(9238)
    stepCast(play, t, idle, 9237, false)
    expect(play.mangaka.player?.over).toBeNull()
    stepCast(play, t, idle, 9238, false)
    expect(play.mangaka.player?.over?.anim.id).toBe('stand-look')
    expect([play.mangaka.idleN, play.mangaka.nextIdleAt]).toEqual([1, 9238 + nextIdle(12, 0, 1).gapMs])
  })

  it('keeps the wait across new game days while the clock runs: a new day resets the count, never the wait', () => {
    // a step every 41 ms (24 fps) with the game day turning every 1000 ms (speed 1) or every 220 ms (the fastest): the
    // wait scheduled on the first step (9238 ms) still fires, at the first step at or after it (41 x 226 = 9266), its
    // pick from the day then and the day's count, 0: day 21 picks 59854 % 2 = 0, day 54 picks 16555 % 2 = 1
    for (const [dayMs, moment] of [[1000, 'stand-look'], [220, 'stand-sip']] as const) {
      const t = newActorTable()
      const play = newCastPlay()
      t.mangaka.state = 'standing'
      let first = -1
      let id: string | undefined
      for (let ms = 0; ms < 10000 && first < 0; ms += 41) {
        stepCast(play, t, input({ working: false, day: 12 + Math.floor(ms / dayMs) }), ms, false)
        if (play.mangaka.player?.over) {
          first = ms
          id = play.mangaka.player.over.anim.id
        }
      }
      expect([first, id], `${dayMs} ms days`).toEqual([9266, moment])
    }
  })

  it('keeps the assistants\' loops PHASE_MS apart through every change of base', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.assistants[0].state = 'seated'
    t.assistants[1].state = 'seated'
    const two = [{ stamina: 80 }, { stamina: 80 }]
    for (const [now, working] of [[0, true], [500, false], [1000, true]] as const) {
      stepCast(play, t, input({ working, assistants: two }), now, false)
      const [a, b] = [play.assistants[0].player!, play.assistants[1].player!]
      expect([a.base.id, a.baseAt - b.baseAt], `at ${now}`).toEqual([working ? 'seat-draw' : 'seat-idle', PHASE_MS])
    }
    // seat 1 at 1000 - 150, seat 2 at 1000 - 300
    expect([play.assistants[0].player?.baseAt, play.assistants[1].player?.baseAt]).toEqual([850, 700])
  })

  it('cuts an idle moment short for a reaction, queues it behind a transition, and drops one the state cannot play', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.mangaka.state = 'seated'
    stepCast(play, t, input(), 0, false)
    // the day's first moment at 9238: the desk pool's 61578 % 3 = 0, the stretch
    stepCast(play, t, input(), 9238, false)
    expect(play.mangaka.player?.over?.anim.id).toBe('seat-stretch')
    stepCast(play, t, input({ reaction: { id: 1, kind: 'good-poll' } }), 9300, false)
    expect([play.mangaka.player?.over?.anim.id, play.mangaka.player?.over?.at, play.mangaka.player?.queue.length]).toEqual(['seat-cheer', 9300, 0])

    const u = newActorTable()
    const behind = newCastPlay()
    u.mangaka.state = 'walking'
    stepCast(behind, u, input(), 0, false)
    u.mangaka.state = 'seated'
    stepCast(behind, u, input({ reaction: { id: 2, kind: 'good-poll' } }), 100, false)
    expect([behind.mangaka.player?.over?.anim.id, behind.mangaka.player?.queue.map((a) => a.id)]).toEqual(['sit-down', ['seat-cheer']])

    const v = newActorTable()
    const asleep = newCastPlay()
    v.mangaka.state = 'sleeping'
    stepCast(asleep, v, input(), 0, false)
    stepCast(asleep, v, input({ reaction: { id: 3, kind: 'missed' } }), 100, false)
    expect([asleep.mangaka.player?.over, asleep.mangaka.cue]).toEqual([null, 3])
  })

  it('holds the base loop\'s first step under reduced motion: no transition, no reaction', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.mangaka.state = 'walking'
    stepCast(play, t, input(), 0, true)
    t.mangaka.state = 'seated'
    stepCast(play, t, input({ reaction: { id: 3, kind: 'good-poll' } }), 10, true)
    expect([play.mangaka.player?.over, t.mangaka.pose, play.mangaka.cue]).toEqual([null, ANIMS['seat-draw'].steps[0].pose, 3])
  })

  it('starts each assistant PHASE_MS after the one before, poses nobody away or hidden, and plays a dev preview', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.assistants[1].state = 'seated'
    t.mangaka.state = 'away'
    stepCast(play, t, input({ assistants: [{ stamina: 80 }, { stamina: 80 }] }), 1000, false)
    expect(play.assistants[1].player?.baseAt).toBe(1000 - 2 * PHASE_MS)
    expect([t.mangaka.pose, play.mangaka.player]).toEqual(['', null])
    t.mangaka.state = 'seated'
    stepCast(play, t, input({ preview: 'seat-stretch' }), 2000, false)
    expect(play.mangaka.player?.over?.anim.id).toBe('seat-stretch')
  })

  it('keeps each track\'s player object through steps where nothing starts or ends (nothing is allocated per frame)', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.mangaka.state = 'seated'
    t.assistants[0].state = 'seated'
    const one = input({ assistants: [{ stamina: 80 }] })
    stepCast(play, t, one, 0, false)
    const [m, a] = [play.mangaka.player, play.assistants[0].player]
    // 24 fps up to just short of the shortest idle wait (6 s)
    for (let ms = 41; ms < 6000; ms += 41) stepCast(play, t, one, ms, false)
    expect([play.mangaka.player === m, play.assistants[0].player === a]).toEqual([true, true])
  })

  it('sets no pose while the rig is off for a character', () => {
    setRigLive({ assistants: false })
    const t = newActorTable()
    t.mangaka.state = 'seated'
    t.assistants[0].state = 'seated'
    stepCast(newCastPlay(), t, input(), 0, false)
    expect([t.mangaka.pose, t.assistants[0].pose]).toEqual([ANIMS['seat-draw'].steps[0].pose, ''])
  })

  it('settles every track to its base from now, and resumes with everything played out', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.mangaka.state = 'sleeping'
    settleCast(play, t, input({ reaction: { id: 9, kind: 'late' } }), 500)
    expect([play.mangaka.player?.base.id, play.mangaka.player?.baseAt, play.mangaka.cue, t.mangaka.pose]).toEqual(['sleep', 500, 9, ANIMS.sleep.steps[0].pose])
    stepCast(play, t, input({ preview: 'lie-down' }), 600, false)
    expect(play.mangaka.player?.over).not.toBeNull()
    resumeCast(play, 900)
    expect([play.mangaka.player?.over, play.mangaka.player?.baseAt]).toEqual([null, 900])
  })
})
