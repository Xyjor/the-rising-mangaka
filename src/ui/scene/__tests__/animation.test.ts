// The animation player is pure (no clock of its own): node environment, literal timings.
import { describe, expect, it } from 'vitest'
import { QUEUE_MAX, advance, animLength, enqueue, interrupt, poseAt, settle, startPlayer, stepAt, switchBase } from '../animation'
import type { Anim } from '../animation'

const BREATH: Anim = { id: 'breath', posture: 'stand', loop: true, steps: [{ pose: 'a', ms: 100 }, { pose: 'b', ms: 200 }, { pose: 'c', ms: 100 }] }
const SIP: Anim = { id: 'sip', posture: 'stand', loop: false, steps: [{ pose: 'sip0', ms: 150 }, { pose: 'sip1', ms: 250 }] }
const WAVE: Anim = { id: 'wave', posture: 'stand', loop: false, steps: [{ pose: 'wave', ms: 300 }] }
const NOD: Anim = { id: 'nod', posture: 'stand', loop: false, steps: [{ pose: 'nod', ms: 50 }] }
const DRAW: Anim = { id: 'draw', posture: 'seat', loop: true, steps: [{ pose: 'pen0', ms: 150 }, { pose: 'pen1', ms: 150 }] }
const REST: Anim = { id: 'rest', posture: 'seat', loop: true, steps: [{ pose: 'rest', ms: 500 }] }
const SIT: Anim = { id: 'sit', posture: 'seat', loop: false, steps: [{ pose: 'half', ms: 140 }] }
const SEAT_SIP: Anim = { ...SIP, posture: 'seat' }

describe('stepAt', () => {
  it('finds the step showing t ms in: a loop wraps (1000 % 400 = 200, b), a one-shot holds its last step', () => {
    expect(animLength(BREATH)).toBe(400)
    expect([0, 99, 100, 299, 300, 399, 400, 1000, -5].map((t) => stepAt(BREATH, t).pose)).toEqual(['a', 'a', 'b', 'b', 'c', 'c', 'a', 'b', 'a'])
    expect([0, 149, 150, 399, 400, 5000].map((t) => stepAt(SIP, t).pose)).toEqual(['sip0', 'sip0', 'sip1', 'sip1', 'sip1', 'sip1'])
  })
})

describe('the player', () => {
  const p0 = startPlayer(BREATH, 1000)

  it('plays the base loop from its start (before it, its first step)', () => {
    expect([900, 1000, 1100, 1350, 1400].map((t) => poseAt(p0, t))).toEqual(['a', 'a', 'b', 'c', 'a'])
  })

  it('plays a one-shot over the base, then the base again in its own phase', () => {
    const p1 = enqueue(p0, SIP, 1050)
    expect(p1.over).toEqual({ anim: SIP, at: 1050 })
    expect([1050, 1199, 1200, 1449].map((t) => poseAt(p1, t))).toEqual(['sip0', 'sip0', 'sip1', 'sip1'])
    expect(advance(p1, 1449)).toBe(p1) // nothing ended: the same object
    const p2 = advance(p1, 1450)
    expect(p2.over).toBeNull()
    expect(p2.baseAt).toBe(1000)
    // 450 into the 400 ms loop is 50 (a); 500 is 100 (b)
    expect([poseAt(p2, 1450), poseAt(p2, 1500)]).toEqual(['a', 'b'])
  })

  it('queues one-shots, each starting as the one before ends, and drops one past QUEUE_MAX', () => {
    const q1 = enqueue(enqueue(enqueue(p0, SIP, 1000), WAVE, 1100), NOD, 1200)
    expect(q1.queue.map((a) => a.id)).toEqual(['wave', 'nod'])
    expect(QUEUE_MAX).toBe(2)
    expect(enqueue(q1, SIP, 1250)).toBe(q1)
    // the sip ends at 1400: the wave starts then, not when it was queued
    const q3 = advance(q1, 1400)
    expect([q3.over?.anim.id, q3.over?.at, q3.queue.length]).toEqual(['wave', 1400, 1])
    // at 1720 the wave (1400-1699) is done and the nod (from 1700) plays
    const q5 = advance(q1, 1720)
    expect([q5.over?.anim.id, q5.over?.at]).toEqual(['nod', 1700])
    // a long gap (a hidden window) ends everything at once
    const q4 = advance(q1, 5000)
    expect([q4.over, q4.queue.length]).toEqual([null, 0])
  })

  it('lets a one-shot cut in: it replaces the one playing, at once, and what waits keeps waiting', () => {
    const q = enqueue(enqueue(p0, SIP, 1000), WAVE, 1100)
    const cut = interrupt(q, NOD, 1200)
    expect([cut.over?.anim.id, cut.over?.at, cut.queue.map((a) => a.id), cut.baseAt]).toEqual(['nod', 1200, ['wave'], 1000])
    // the nod ends at 1250 and the wave starts then
    expect([advance(cut, 1250).over?.anim.id, advance(cut, 1250).over?.at]).toEqual(['wave', 1250])
    expect(interrupt(p0, NOD, 1300).over).toEqual({ anim: NOD, at: 1300 })
  })

  it('switches base: a transition first, the new base starting as it ends', () => {
    const t1 = switchBase(p0, DRAW, SIT, 2000)
    expect([t1.over?.anim.id, t1.over?.at, t1.baseAt]).toEqual(['sit', 2000, 2140])
    expect([2000, 2139, 2140, 2290].map((t) => poseAt(advance(t1, t), t))).toEqual(['half', 'half', 'pen0', 'pen1'])
  })

  it('keeps the moment playing within one posture, drops it across postures, and ignores the same base', () => {
    const m1 = enqueue(startPlayer(DRAW, 0), SEAT_SIP, 100)
    const m2 = switchBase(m1, REST, null, 200)
    expect([m2.base.id, m2.baseAt, m2.over?.anim.id]).toEqual(['rest', 200, 'sip'])
    const m3 = switchBase(m1, BREATH, null, 200)
    expect([m3.base.id, m3.over, m3.queue.length]).toEqual(['breath', null, 0])
    expect(switchBase(m1, DRAW, null, 300)).toBe(m1)
  })

  it('settles: the base alone from now, everything else played out', () => {
    const q1 = enqueue(enqueue(p0, SIP, 1000), WAVE, 1100)
    const s1 = settle(q1, 3000)
    expect([s1.over, s1.queue.length, s1.baseAt, s1.base.id]).toEqual([null, 0, 3000, 'breath'])
    expect(settle(p0, 3000)).toBe(p0)
  })
})
