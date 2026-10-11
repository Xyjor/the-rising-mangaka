// The cast driver: pure rules plus a table of tracks mutated in place, node environment. Assertions name animations
// by id and poses through ANIMS, so they hold as each animation's art replaces its stand-in.
import { describe, expect, it } from 'vitest'
import { newActorTable, planActors, settleActors, stepActors } from '../actors'
import { animLength } from '../animation'
import {
  EDITOR_SEAT, IDLE_MOMENTS, PHASE_MS, VERDICT_HOLD_SLACK_MS, baseAnimFor, headCentre, headTop, idlePool, newCastPlay, previewFits,
  reactionAnim, resumeCast, settleCast, stepCast, transitionFor, verdictHoldMs,
} from '../castPlay'
import type { CastInput } from '../castPlay'
import { nextIdle } from '../idleSchedule'
import { ANIMS } from '../rig/anims'
import { sceneSnapshot } from '../../../test/fakeCanvas'

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
    expect(baseAnimFor('editor', 'standing', c)).toBe('editor-stand')
    expect(baseAnimFor('editor', 'walking', c)).toBe('editor-walk')
    for (const st of ['seated', 'sleeping', 'sitting', 'away', 'hidden'] as const) expect(baseAnimFor('editor', st, c), st).toBeNull()
  })

  it('plays a transition between the states that have one, per character: the editor turns at the spot and at the door', () => {
    expect([transitionFor('mangaka', 'walking', 'seated'), transitionFor('mangaka', 'seated', 'walking'), transitionFor('mangaka', 'walking', 'sleeping'), transitionFor('mangaka', 'sleeping', 'walking')])
      .toEqual(['sit-down', 'stand-up', 'lie-down', 'get-up'])
    expect([transitionFor('mangaka', 'standing', 'walking'), transitionFor('mangaka', 'seated', 'sleeping')]).toEqual([null, null])
    expect(transitionFor('assistant', 'walking', 'seated')).toBe('sit-down')
    expect([transitionFor('editor', 'walking', 'standing'), transitionFor('editor', 'standing', 'walking')]).toEqual(['editor-arrive', 'editor-leave'])
    expect([transitionFor('editor', 'walking', 'seated'), transitionFor('editor', 'standing', 'away')]).toEqual([null, null])
  })

  it('draws idle moments from the posture\'s pool, rubbing the eyes and sipping when tired', () => {
    expect(idlePool('stand', false)).toEqual(['stand-look', 'stand-sip'])
    expect(idlePool('seat-draw', false)).toEqual(['seat-stretch', 'seat-sip', 'seat-flip'])
    expect(idlePool('seat-idle', true)).toEqual(['seat-rub', 'seat-sip'])
    expect(idlePool('editor-stand', false)).toEqual(['editor-glasses', 'editor-watch', 'editor-glance'])
    for (const base of ['walk', 'sleep', 'doze', 'stand-ready', 'seat-draw-late', 'editor-walk'] as const) expect(idlePool(base, false)).toEqual([])
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
    expect(reactionAnim('offer', 'editor', 'standing')).toBe('editor-nod')
    expect(reactionAnim('good-poll', 'editor', 'standing')).toBe('editor-nod')
    expect(reactionAnim('bad-poll', 'editor', 'standing')).toBe('editor-sigh')
    expect([reactionAnim('level-up', 'editor', 'standing'), reactionAnim('late', 'editor', 'standing'), reactionAnim('missed', 'editor', 'standing')]).toEqual([null, null, null])
    expect([reactionAnim('offer', 'editor', 'walking'), reactionAnim('offer', 'mangaka', 'standing'), reactionAnim('offer', 'assistant', 'seated')]).toEqual([null, null, null])
  })

  it('puts the head\'s top 6 rows down seated and 8 in bed, its centre 16 columns in, in bed too (the actor stands on the lying head)', () => {
    expect([headTop('standing'), headTop('walking'), headTop('seated'), headTop('sleeping')]).toEqual([0, 0, 6, 8])
    expect([headCentre('standing'), headCentre('walking'), headCentre('seated'), headCentre('sleeping')]).toEqual([16, 16, 16, 16])
  })

  it('counts the idle pools\' animations as moments a reaction may cut short', () => {
    expect([...IDLE_MOMENTS].sort()).toEqual(['editor-glance', 'editor-glasses', 'editor-watch', 'seat-flip', 'seat-rub', 'seat-sip', 'seat-stretch', 'stand-look', 'stand-sip'])
  })

  it('lets a dev preview play on its own character only: editor-* on the editor, everything else on everyone else', () => {
    expect([previewFits('editor', ANIMS['editor-glasses']), previewFits('editor', ANIMS['stand-look'])]).toEqual([true, false])
    expect([previewFits('mangaka', ANIMS['editor-glasses']), previewFits('assistant', ANIMS['seat-stretch'])]).toEqual([false, true])
    expect(EDITOR_SEAT).toBe(4)
  })
})

describe('stepCast', () => {
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
    t.editor.state = 'standing'
    const one = input({ assistants: [{ stamina: 80 }] })
    stepCast(play, t, one, 0, false)
    const [m, a, e] = [play.mangaka.player, play.assistants[0].player, play.editor.player]
    // 24 fps up to just short of the shortest idle wait (6 s)
    for (let ms = 41; ms < 6000; ms += 41) stepCast(play, t, one, ms, false)
    expect([e !== null, play.mangaka.player === m, play.assistants[0].player === a, play.editor.player === e]).toEqual([true, true, true, true])
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

  it('resumes the assistants one seat phase apart, and re-arms every idle wait', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.assistants[0].state = 'seated'
    t.assistants[1].state = 'seated'
    const two = input({ assistants: [{ stamina: 80 }, { stamina: 80 }], preview: 'seat-stretch' })
    settleCast(play, t, two, 0)
    stepCast(play, t, two, 100, false)
    expect([play.assistants[0].player?.over, play.assistants[1].player?.over].map((o) => o !== null && o !== undefined)).toEqual([true, true])
    play.assistants[0].nextIdleAt = 5
    resumeCast(play, 900)
    const [a, b] = [play.assistants[0].player, play.assistants[1].player]
    expect([a?.over, b?.over, a?.baseAt, b?.baseAt]).toEqual([null, null, 900 - PHASE_MS, 900 - 2 * PHASE_MS])
    expect([play.mangaka.nextIdleAt, play.assistants[0].nextIdleAt, play.assistants[1].nextIdleAt]).toEqual([-1, -1, -1])
  })

  it('turns the editor at the spot on arriving and back toward the door on leaving, his loops at the fifth seat\'s phase', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.editor.state = 'walking'
    stepCast(play, t, input(), 1000, false)
    expect([play.editor.player?.base.id, play.editor.player?.baseAt]).toEqual(['editor-walk', 1000 - EDITOR_SEAT * PHASE_MS])
    t.editor.state = 'standing'
    stepCast(play, t, input(), 1500, false)
    const arrive = animLength(ANIMS['editor-arrive'])
    expect([play.editor.player?.base.id, play.editor.player?.over?.anim.id, play.editor.player?.baseAt]).toEqual(['editor-stand', 'editor-arrive', 1500 + arrive])
    expect(t.editor.pose).toBe(ANIMS['editor-arrive'].steps[0].pose)
    stepCast(play, t, input(), 1500 + arrive, false)
    expect([play.editor.player?.over, t.editor.pose]).toEqual([null, ANIMS['editor-stand'].steps[0].pose])
    t.editor.state = 'walking'
    stepCast(play, t, input(), 5000, false)
    expect([play.editor.player?.base.id, play.editor.player?.over?.anim.id]).toEqual(['editor-walk', 'editor-leave'])
    t.editor.state = 'away'
    stepCast(play, t, input(), 7000, false)
    expect([play.editor.player, t.editor.pose]).toEqual([null, ''])
  })

  it('fires the editor\'s first waiting moment after its seeded wait, from his own pool, at the fifth seat', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.editor.state = 'standing'
    stepCast(play, t, input(), 0, false)
    // nextIdle(12, 4, 0) = { gapMs: 7617, pick: 58763 }: 58763 % 3 = 2, the pool's third
    expect(play.editor.nextIdleAt).toBe(7617)
    stepCast(play, t, input(), 7616, false)
    expect(play.editor.player?.over).toBeNull()
    stepCast(play, t, input(), 7617, false)
    expect(play.editor.player?.over?.anim.id).toBe('editor-glance')
    expect([play.editor.idleN, play.editor.nextIdleAt]).toEqual([1, 7617 + nextIdle(12, 4, 1).gapMs])
    expect(nextIdle(12, 4, 1).gapMs).toBe(13451)
  })

  it('nods on an offer or a good poll and sighs on a bad poll, standing at the spot; the mangaka ignores the offer; walking, he drops it', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.editor.state = 'standing'
    t.mangaka.state = 'standing'
    stepCast(play, t, input(), 0, false)
    stepCast(play, t, input({ reaction: { id: 1, kind: 'offer' } }), 100, false)
    expect([play.editor.player?.over?.anim.id, play.mangaka.player?.over, play.editor.cue, play.mangaka.cue]).toEqual(['editor-nod', null, 1, 1])
    stepCast(play, t, input({ reaction: { id: 2, kind: 'bad-poll' } }), 100 + animLength(ANIMS['editor-nod']), false)
    expect([play.editor.player?.over?.anim.id, play.mangaka.player?.over?.anim.id]).toEqual(['editor-sigh', 'stand-slump'])
    const u = newActorTable()
    const walking = newCastPlay()
    u.editor.state = 'walking'
    stepCast(walking, u, input(), 0, false)
    stepCast(walking, u, input({ reaction: { id: 3, kind: 'offer' } }), 100, false)
    expect([walking.editor.player?.over, walking.editor.cue]).toEqual([null, 3])
  })

  it('plays a dev preview on its own character only, and holds the editor\'s first step under reduced motion', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.mangaka.state = 'standing'
    t.editor.state = 'standing'
    stepCast(play, t, input({ preview: 'editor-glasses' }), 0, false)
    expect([play.editor.player?.over?.anim.id, play.mangaka.player?.over]).toEqual(['editor-glasses', null])
    const u = newActorTable()
    const other = newCastPlay()
    u.mangaka.state = 'standing'
    u.editor.state = 'standing'
    stepCast(other, u, input({ preview: 'stand-look' }), 0, false)
    expect([other.mangaka.player?.over?.anim.id, other.editor.player?.over]).toEqual(['stand-look', null])
    const v = newActorTable()
    const still = newCastPlay()
    v.editor.state = 'walking'
    stepCast(still, v, input(), 0, true)
    v.editor.state = 'standing'
    stepCast(still, v, input({ reaction: { id: 4, kind: 'offer' } }), 10, true)
    expect([still.editor.player?.over, v.editor.pose, still.editor.cue]).toEqual([null, ANIMS['editor-stand'].steps[0].pose, 4])
  })

  it('settles the editor on his base from now and resumes him at the fifth seat\'s phase, his wait re-armed', () => {
    const t = newActorTable()
    const play = newCastPlay()
    t.editor.state = 'standing'
    settleCast(play, t, input(), 500)
    expect([play.editor.player?.base.id, play.editor.player?.baseAt, t.editor.pose]).toEqual(['editor-stand', 500 - EDITOR_SEAT * PHASE_MS, ANIMS['editor-stand'].steps[0].pose])
    stepCast(play, t, input({ preview: 'editor-watch' }), 600, false)
    expect(play.editor.player?.over).not.toBeNull()
    resumeCast(play, 900)
    expect([play.editor.player?.over, play.editor.player?.baseAt, play.editor.nextIdleAt]).toEqual([null, 900 - EDITOR_SEAT * PHASE_MS, -1])
  })

  it('holds the editor for his verdict: the length of the nod or the sigh plus the slack, standing; nothing otherwise', () => {
    const t = newActorTable()
    t.editor.state = 'standing'
    expect(verdictHoldMs('bad-poll', t.editor)).toBe(animLength(ANIMS['editor-sigh']) + VERDICT_HOLD_SLACK_MS)
    expect(verdictHoldMs('good-poll', t.editor)).toBe(animLength(ANIMS['editor-nod']) + VERDICT_HOLD_SLACK_MS)
    expect(verdictHoldMs('offer', t.editor)).toBe(animLength(ANIMS['editor-nod']) + VERDICT_HOLD_SLACK_MS)
    expect([verdictHoldMs('level-up', t.editor), verdictHoldMs('late', t.editor), verdictHoldMs('missed', t.editor)]).toEqual([0, 0, 0])
    t.editor.state = 'walking'
    expect(verdictHoldMs('bad-poll', t.editor)).toBe(0)
    expect(VERDICT_HOLD_SLACK_MS).toBe(50)
  })

  it('keeps the editor at the spot through his sigh when the dismissal sends him away, then lets him leave through the turn (the loop\'s real order)', () => {
    const t = newActorTable()
    planActors(t, sceneSnapshot({ visitor: 'editor', actors: t }))
    settleActors(t)
    const play = newCastPlay()
    settleCast(play, t, input(), 0)
    expect([t.editor.x, t.editor.y, t.editor.state]).toEqual([205, 90, 'standing'])
    // the store change: the reaction subscription holds him first, then the plan effect sends him to the door
    const cue = { id: 1, kind: 'bad-poll' } as const
    const sigh = animLength(ANIMS['editor-sigh'])
    const hold = sigh + VERDICT_HOLD_SLACK_MS
    t.editor.holdMs = verdictHoldMs(cue.kind, t.editor)
    planActors(t, sceneSnapshot({ visitor: 'none', actors: t }))
    expect([t.editor.holdMs, t.editor.targetX, t.editor.targetY, t.editor.goal]).toEqual([hold, 250, 69, 'away'])
    // the plan's literal timings, now the sigh is drawn (task 10): the sigh 300 + 900 ms, the hold 1200 + 50
    expect([sigh, hold]).toEqual([1200, 1250])
    // the loop: the actors walk (and the hold counts down), then the driver steps, 41 ms apart
    let now = 0
    let steps = 0
    while (t.editor.state === 'standing' && steps < 60) {
      stepActors(t, 41, false)
      now += 41
      stepCast(play, t, input({ reaction: cue }), now, false)
      steps++
      if (now <= 41 + sigh) {
        // the sigh, taken on the first step at 41, plays out in place: he is at the spot with it over him
        expect([t.editor.x, t.editor.y, play.editor.player?.over?.anim.id], `${now} ms`).toEqual([205, 90, 'editor-sigh'])
      }
    }
    // the hold reaches 0 on the step whose 41 ms cover it, and he walks on the next, after the sigh (taken at 41) ended
    const release = Math.ceil(hold / 41) + 1
    expect([steps, now]).toEqual([release, release * 41])
    expect(now).toBeGreaterThan(41 + sigh)
    // by hand: 31 steps of 41 ms (1271) cover the 1250 ms hold, so he walks on the 32nd (1312), after the sigh taken
    // on the first step ended at 41 + 1200 = 1241
    expect([steps, now, 41 + sigh]).toEqual([32, 1312, 1241])
    expect([t.editor.state, play.editor.player?.base.id, play.editor.player?.over?.anim.id]).toEqual(['walking', 'editor-walk', 'editor-leave'])
    expect(t.editor.x).toBeGreaterThan(205)
  })
})
