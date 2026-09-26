// The scene's render is a pure function of (snapshot, time of day, frame) onto a 2D context: no DOM needed, so this
// runs in the default node environment against the recording context from src/test/fakeCanvas.ts.
import { describe, expect, it } from 'vitest'
import { fakeContext, sceneSnapshot } from '../../../test/fakeCanvas'
import type { FillCall } from '../../../test/fakeCanvas'
import { H, SKY_LUT, W, render, skyColor } from '../render'
import type { Season } from '../season'
import { newActorTable } from '../actors'
import type { Actor, ActorTable } from '../actors'

/**
 * fillRect calls for one frame of the reference scene (`sceneSnapshot()`: drawing phase, working, running, speed 1,
 * one assistant, spring, the bare apartment) at t = 0.3 (day, the sun up) and frame 100, re-measured for the 320x180
 * canvas (Task 2.1), then again for the actor table (Task 2.3), by rendering it into the recording context and reading
 * `log.length`: 384 (Task 2.1's 364 plus the cat asleep in its bed, 20 sprite pixels). By hand: the room 58
 * (wall 1, 27 stripes, skirting 1, floor 1, 20 plank seams, 8 plank rows), the kitchenette 17, window 8 (frame, pane,
 * sun, two cloud rects, two bars, sill), spring's pane art 22, bookshelf 34, poster 4, bed 5, the apartment's plain
 * door 5, the entrance 6 (mat 2, rack 3, the coat), the assistant 89 (84 sprite pixels, arm, 4 desk rects), chair 3,
 * the player 92 (90 sprite pixels, arm, pen) and the desk 21 (7 wood, lamp 2 and its glow, the 5-page stack 4 and its
 * 2 lines, ink pot 2, mug 2 and its steam). Every scene must stay under 1.5 times this.
 */
const BASELINE_FILLS = 384
const BUDGET = BASELINE_FILLS * 1.5

describe('render', () => {
  it('paints every pixel from a palette (an unknown sprite key would paint magenta)', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 100)
    expect(log.length).toBeGreaterThan(0)
    expect(log.some((c) => c.style === '#f0f')).toBe(false)
  })

  it('keeps every fillRect inside the 320x180 canvas', () => {
    expect([W, H]).toEqual([320, 180])
    for (const t of [0.3, 0.9]) {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot(), t, 100)
      for (const c of log) {
        expect(c.x).toBeGreaterThanOrEqual(0)
        expect(c.y).toBeGreaterThanOrEqual(0)
        expect(c.x + c.w).toBeLessThanOrEqual(320)
        expect(c.y + c.h).toBeLessThanOrEqual(180)
      }
    }
  })

  it('paints the wall stripes and the floor planks across the whole canvas', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 100)
    const has = (x: number, y: number, w: number, h: number) => log.some((c) => c.x === x && c.y === y && c.w === w && c.h === h)
    expect(has(4, 0, 1, 114)).toBe(true)
    expect(has(316, 0, 1, 114)).toBe(true)
    expect(has(0, 178, 320, 1)).toBe(true)
  })

  it('renders frame 0 the same way twice (a pure function of its inputs)', () => {
    const a = fakeContext()
    const b = fakeContext()
    render(a.ctx, sceneSnapshot(), 0.3, 0)
    render(b.ctx, sceneSnapshot(), 0.3, 0)
    expect(b.log).toEqual(a.log)
  })

  it('stays under 1.5 times the measured baseline of fillRect calls in every season, by day and by night', () => {
    expect(BUDGET).toBe(576)
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
      for (const t of [0.3, 0.9]) {
        const { ctx, log } = fakeContext()
        render(ctx, sceneSnapshot({ season }), t, 100)
        expect(log.length, `${season} t ${t}`).toBeLessThan(BUDGET)
      }
    }
  })
})

describe('the window', () => {
  /** The two cloud rects, found by their exact rows: '#fff' is also the poster, the mug and the stars. */
  function isCloud(c: FillCall, colour: string): boolean {
    return c.style === colour && ((c.y === 56 && c.h === 3) || (c.y === 54 && c.h === 2))
  }

  it('keeps the clouds inside the window pane (x 182-225) for frames 0 to 2000, by day and by night', () => {
    let seen = 0
    for (const [t, cloud] of [[0.3, '#fff'], [0.9, '#3a4470']] as const) {
      for (let frame = 0; frame <= 2000; frame += 13) {
        const { ctx, log } = fakeContext()
        render(ctx, sceneSnapshot(), t, frame)
        for (const c of log) {
          if (!isCloud(c, cloud)) continue
          seen++
          expect(c.x >= 182 && c.x + c.w <= 226, `t ${t} frame ${frame}: ${JSON.stringify(c)}`).toBe(true)
        }
      }
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('shows the whole cloud at the left edge of the pane on frame 0 (reduced motion)', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 0)
    expect(log.filter((c) => isCloud(c, '#fff'))).toEqual([
      { style: '#fff', x: 182, y: 56, w: 10, h: 3 },
      { style: '#fff', x: 184, y: 54, w: 6, h: 2 },
    ])
  })

  it('clips a cloud sliding out behind the frame to the pane', () => {
    // frame 360: cx = (54 + 10) mod 60 - 10 = -6, so the big rect starts at 176 (cut to 182-185) and the small one at
    // 178 (cut to 182-183)
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 360)
    expect(log.filter((c) => isCloud(c, '#fff'))).toEqual([
      { style: '#fff', x: 182, y: 56, w: 4, h: 3 },
      { style: '#fff', x: 182, y: 54, w: 2, h: 2 },
    ])
  })

  it('keeps the sun inside the pane all day, from t 0.13 to 0.659', () => {
    const times = [0.659]
    for (let i = 13; i <= 65; i++) times.push(i / 100)
    for (const t of times) {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot(), t, 100)
      const sun = log.filter((c) => c.style === '#ffe47a')
      expect(sun, `t ${t}`).toHaveLength(1)
      const c = sun[0]
      expect(c.x >= 182 && c.x + c.w <= 226 && c.y >= 48 && c.y + c.h <= 80, `t ${t}: ${JSON.stringify(c)}`).toBe(true)
    }
    // at t 0.659 the sun (5 px from x 223.73) is cut at the pane's right edge, x 226
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.659, 100)
    const late = log.find((c) => c.style === '#ffe47a')
    expect(late?.x).toBeCloseTo(223.73, 2)
    expect(late?.w).toBeCloseTo(2.27, 2)
  })
})

describe('the sky', () => {
  it('reads the time of day from a 256-entry table of rgb() strings', () => {
    expect(SKY_LUT).toHaveLength(256)
    // entry i is t = i / 255: t 0 is dawn pink, t 0.4 (entry 102) the midday blue between the 0.25 and 0.55 stops
    expect(SKY_LUT[0]).toBe('rgb(246,166,160)')
    expect(SKY_LUT[Math.round(0.4 * 255)]).toBe('rgb(143,211,255)')
    // entry 209 is t 0.8196, 0.9967 of the way from dusk (242,163,90) to night (28,35,82): 242 - 213.3, 163 - 127.6,
    // 90 - 8.0, rounded
    expect(SKY_LUT[209]).toBe('rgb(29,35,82)')
    expect(SKY_LUT[255]).toBe('rgb(246,166,160)')
  })

  it('clamps t to [0, 1] and rounds it to the nearest entry', () => {
    expect(skyColor(0.4)).toBe('rgb(143,211,255)')
    expect(skyColor(0.82)).toBe('rgb(29,35,82)')
    expect(skyColor(-0.5)).toBe('rgb(246,166,160)')
    expect(skyColor(1.5)).toBe('rgb(246,166,160)')
  })

  it('paints the window pane in the sky colour', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.82, 0)
    expect(log).toContainEqual({ style: 'rgb(29,35,82)', x: 182, y: 48, w: 44, h: 32 })
  })
})

describe('the characters, from the actor table', () => {
  const has = (log: FillCall[], style: string, x: number, y: number) => log.some((c) => c.style === style && c.x === x && c.y === y)
  const find = (log: FillCall[], style: string, x: number, y: number, w?: number, h?: number) =>
    log.findIndex((c) => c.style === style && c.x === x && c.y === y && (w === undefined || (c.w === w && c.h === h)))
  function paintWith(table: ActorTable, over = {}): FillCall[] {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ ...over, actors: table }), 0.3, 0)
    return log
  }
  function walking(over: Partial<Actor>): ActorTable {
    const t = newActorTable()
    Object.assign(t.mangaka, { x: 150, y: 98, targetX: 100, targetY: 98, state: 'walking', goal: 'standing', facing: -1, anim: 0 }, over)
    return t
  }

  it('seats the mangaka at the desk in the reference scene, over the chair and under the desk top', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 0)
    const hair = find(log, '#2b2140', 141, 84)
    expect(hair).toBeGreaterThan(-1)
    expect(find(log, '#4a4a55', 134, 90, 20, 4)).toBeLessThan(hair)
    expect(find(log, '#8b5a2b', 116, 98, 58, 4)).toBeGreaterThan(hair)
  })

  it('stands the mangaka beside the desk between projects, after the desk top', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'idle' }), 0.3, 0)
    const hair = find(log, '#2b2140', 179, 98)
    expect(hair).toBeGreaterThan(find(log, '#8b5a2b', 116, 98, 58, 4))
    expect(find(log, '#8b5a2b', 116, 98, 58, 4)).toBeGreaterThan(-1)
  })

  it('walks the mangaka with the two-frame cycle, mirrored when facing right', () => {
    expect(has(paintWith(walking({})), '#1b1b1b', 151, 111)).toBe(true)
    // HERO_WALK[1] row 13 is '..B.....BSS.': the first shoe pixel is col 9 (the brief's 158 is col 8, a trouser B)
    expect(has(paintWith(walking({ anim: 125 })), '#1b1b1b', 159, 111)).toBe(true)
    expect(has(paintWith(walking({ facing: 1 })), '#1b1b1b', 160, 111)).toBe(true)
  })

  it('paints the editor at the spot, mirrored when facing right', () => {
    const left = newActorTable()
    Object.assign(left.editor, { x: 204, y: 102, targetX: 204, targetY: 102, state: 'standing', goal: 'standing', facing: -1 })
    expect(has(paintWith(left, { visitor: 'editor' }), '#5b6270', 206, 112)).toBe(true)
    const right = newActorTable()
    Object.assign(right.editor, { x: 204, y: 102, targetX: 204, targetY: 102, state: 'standing', goal: 'standing', facing: 1 })
    const log = paintWith(right, { visitor: 'editor' })
    expect(has(log, '#5b6270', 213, 112)).toBe(true)
    expect(has(log, '#5b6270', 206, 112)).toBe(false)
  })

  it('puts the mangaka to bed to rest, the Zz rising over the pillow', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ activity: 'rest' }), 0.3, 0)
    expect(has(log, '#2b2140', 236, 102)).toBe(true)
    expect(log).toContainEqual({ style: '#2f5ecf', x: 242, y: 94, w: 1, h: 1 })
  })

  it('hands the editor their prop and bobs the ! above them while they stand facing left', () => {
    const at = (over: Parameters<typeof sceneSnapshot>[0], frame: number) => {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot(over), 0.3, frame)
      return log
    }
    const env = at({ visitor: 'editor', visitorProp: 'envelope' }, 100)
    expect(env).toContainEqual({ style: '#2b2140', x: 207, y: 102, w: 1, h: 1 })
    expect(env).toContainEqual({ style: '#fdfcf7', x: 200, y: 110, w: 5, h: 3 })
    // frame 100: floor(100 / 16) % 2 = 0, so the ! tops out at 102 - 10 = 92, its stroke in the glyph's middle column
    expect(env).toContainEqual({ style: '#e5484d', x: 210, y: 92, w: 1, h: 1 })
    expect(at({ visitor: 'editor', visitorProp: 'trophy' }, 100)).toContainEqual({ style: '#f5b700', x: 200, y: 109, w: 3, h: 3 })
    expect(at({ visitor: 'editor', visitorProp: 'envelope' }, 16)).toContainEqual({ style: '#e5484d', x: 210, y: 91, w: 1, h: 1 })
  })

  it('paints no prop while the editor walks', () => {
    const table = newActorTable()
    Object.assign(table.editor, { x: 204, y: 102, targetX: 180, targetY: 102, state: 'walking', goal: 'standing', facing: -1 })
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ visitor: 'editor', visitorProp: 'envelope', actors: table }), 0.3, 100)
    expect(log.some((c) => c.style === '#fdfcf7' && c.x === 200 && c.y === 110)).toBe(false)
  })
})
