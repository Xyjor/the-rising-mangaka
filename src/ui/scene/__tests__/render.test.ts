// The scene's render is a pure function of (snapshot, time of day, frame) onto a 2D context: no DOM needed, so this
// runs in the default node environment against the recording context from src/test/fakeCanvas.ts.
import { describe, expect, it } from 'vitest'
import { covers, coversAny, fakeContext, sceneSnapshot } from '../../../test/fakeCanvas'
import type { FillCall } from '../../../test/fakeCanvas'
import { H, SKY_LUT, W, render, skyColor } from '../render'
import type { Season } from '../season'
import { newActorTable } from '../actors'
import type { Actor, ActorTable } from '../actors'

/**
 * fillRect calls for one frame of the reference scene (`sceneSnapshot()`: drawing phase, working, running,
 * one assistant, spring, the bare apartment) at t = 0.3 (day, the sun up) and frame 100, re-measured for the 320x180
 * canvas (Task 2.1), then again for the actor table (Task 2.3), by rendering it into the recording context and reading
 * `log.length`: 384 (Task 2.1's 364 plus the cat asleep in its bed, 20 sprite pixels). By hand: the room 58
 * (wall 1, 27 stripes, skirting 1, floor 1, 20 plank seams, 8 plank rows), the kitchenette 17, window 8 (frame, pane,
 * sun, two cloud rects, two bars, sill), spring's pane art 22, bookshelf 34, poster 4, bed 5, the apartment's plain
 * door 5, the entrance 6 (mat 2, rack 3, the coat), the assistant 89 (84 sprite pixels, arm, 4 desk rects), chair 3,
 * the player 92 (90 sprite pixels, arm, pen) and the desk 21 (7 wood, lamp 2 and its glow, the 5-page stack 4 and its
 * 2 lines, ink pot 2, mug 2 and its steam). Task 2.5 re-measured it the same way at 444: the wall clock 47 (45 sprite
 * pixels and two hands), the cat's two 8x6 frames 30 pixels in place of the placeholder's 20 (+10) and the assistant's
 * page 3 (the sheet and round(0.5 * 3) = 2 ink lines). Task A (0.2.1) re-measured it the same way at 281 once
 * drawSprite merged each horizontal run of one key into one fillRect (the art unchanged, the same pixels painted): the
 * sprites' 1x1 pixels became runs (the hero, the assistant, the clock and the cat). Task B (0.2.1) re-measured it the same way at 430: the mangaka a 24x32 sprite and the stock chair's new back. Task C (0.2.1) re-measured it the same way at 596: the assistant a 24x32 seated frame, its stool and the page's wider lines, the cat's 12x8 sleeping frame. Upgrade 0.3.0 re-measured it the same way at 649: the tatami room 61 in place of the striped room's 58 (+3), five floor shadows and the staff desk's (+6), the corkboard 10 (board 2, four cards at 2), the calendar 7, the apartment's front row 12 and the bin 7 (5 and two crumpled pages), and the light 8 (the daylight shaft 4, the vignette 4). Every scene must stay under 1.5 times this.
 */
const BASELINE_FILLS = 649
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

  it("paints the tier's wall and floor across the whole canvas, first", () => {
    for (const tier of ['apartment', 'flat', 'loft'] as const) {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot({ tier }), 0.3, 100)
      expect(log[0], tier).toMatchObject({ x: 0, y: 0, w: 320, h: 114 })
      expect(log.some((c) => c.x === 0 && c.y === 114 && c.w === 320 && c.h === 66), tier).toBe(true)
    }
  })

  it('renders frame 0 the same way twice (a pure function of its inputs)', () => {
    const a = fakeContext()
    const b = fakeContext()
    render(a.ctx, sceneSnapshot(), 0.3, 0)
    render(b.ctx, sceneSnapshot(), 0.3, 0)
    expect(b.log).toEqual(a.log)
  })

  it('stays under 1.5 times the measured baseline of fillRect calls in every season, by day and by night', () => {
    expect(BUDGET).toBe(973.5)
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

describe('covers, the fill-log pixel lookup', () => {
  const log: FillCall[] = [
    { style: '#a', x: 0, y: 0, w: 3, h: 1 },
    { style: '#b', x: 1, y: 0, w: 1, h: 1 },
    { style: '#a', x: 5, y: 5, w: 1, h: 1 },
  ]
  it('finds the last fill of a style covering a pixel, or -1', () => {
    expect(covers(log, '#a', 2, 0)).toBe(0)
    expect(covers(log, '#b', 1, 0)).toBe(1)
    expect(covers(log, '#a', 1, 0)).toBe(0)
    expect(covers(log, '#a', 3, 0)).toBe(-1)
  })
  it('finds the last fill of any style covering a pixel, or -1', () => {
    expect(coversAny(log, 1, 0)).toBe(1)
    expect(coversAny(log, 4, 0)).toBe(-1)
  })
})

describe('the characters, from the actor table', () => {
  const has = (log: FillCall[], style: string, x: number, y: number) => covers(log, style, x, y) >= 0
  function paintWith(table: ActorTable, over = {}): FillCall[] {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ ...over, actors: table }), 0.3, 0)
    return log
  }
  function walking(over: Partial<Actor>): ActorTable {
    const t = newActorTable()
    Object.assign(t.mangaka, { x: 150, y: 81, targetX: 100, targetY: 81, state: 'walking', goal: 'standing', facing: -1, anim: 0 }, over)
    return t
  }

  it('seats the mangaka at the desk in the reference scene, over the chair back and under the desk top', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 0)
    // seat (132, 67): the anchor's row 2 col 8 is hair, row 13 col 8 skin, row 9 col 6 an eye
    const hair = covers(log, '#2b2140', 140, 69)
    expect(hair).toBeGreaterThanOrEqual(0)
    const chair = covers(log, '#4a4a55', 140, 90)
    expect(chair).toBeGreaterThan(-1)
    expect(chair).toBeLessThan(hair)
    expect(covers(log, '#8b5a2b', 116, 98)).toBeGreaterThan(hair)
    expect(has(log, '#f4cfa5', 140, 80)).toBe(true)
    expect(has(log, '#1b1b1b', 138, 76)).toBe(true)
  })

  it('stands the mangaka beside the desk between projects, after the desk top', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'idle' }), 0.3, 0)
    const hair = covers(log, '#2b2140', 178, 83)
    expect(hair).toBeGreaterThan(covers(log, '#8b5a2b', 116, 98))
    expect(covers(log, '#8b5a2b', 116, 98)).toBeGreaterThan(-1)
    // row 30 col 7, a shoe
    expect(has(log, '#c0392b', 177, 111)).toBe(true)
  })

  it('walks the mangaka with the four-frame cycle, mirrored when facing right', () => {
    // contact (anim 0): WALK[0] row 30 '....LOOOOL...LOOOoL.....', the leading shoe's O at cols 5-8 (col 5 at x 155);
    // pass (anim 100): the shoes together at cols 8-14, nothing at col 5
    expect(has(paintWith(walking({})), '#c0392b', 155, 111)).toBe(true)
    expect(has(paintWith(walking({ anim: 100 })), '#c0392b', 155, 111)).toBe(false)
    // facing right, col 5 mirrors to x 150 + 23 - 5 = 168
    expect(has(paintWith(walking({ facing: 1 })), '#c0392b', 168, 111)).toBe(true)
  })

  it('has the seated mangaka throw up their hands for 40 frames in 240 when the chapter is late', () => {
    const at = (late: boolean, frame: number) => {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot({ late }), 0.3, frame)
      return log
    }
    // PANIC[0] row 5 col 1 is the leading fist (SIT's row 5 col 1 is clear)
    expect(covers(at(true, 0), '#f4cfa5', 133, 72)).toBeGreaterThanOrEqual(0)
    expect(covers(at(true, 40), '#f4cfa5', 133, 72)).toBe(-1)
    expect(covers(at(false, 0), '#f4cfa5', 133, 72)).toBe(-1)
  })

  function editorAt(facing: -1 | 1, over: Partial<Actor> = {}): ActorTable {
    const t = newActorTable()
    Object.assign(t.editor, { x: 198, y: 85, targetX: 198, targetY: 85, state: 'standing', goal: 'standing', facing }, over)
    return t
  }

  it('paints the editor at the spot, mirrored when facing right', () => {
    // (198, 85): the suit at row 18 col 5, hair row 2 col 8, glasses row 10 col 5, the briefcase row 24 col 20
    const left = paintWith(editorAt(-1), { visitor: 'editor' })
    expect(has(left, '#5b6270', 203, 103)).toBe(true)
    expect(has(left, '#2b2140', 206, 87)).toBe(true)
    expect(has(left, '#3b3b45', 203, 95)).toBe(true)
    // (the bed frame behind is the same brown, so the case is found by its exact run: row 24's FFF, cols 19-21)
    expect(left).toContainEqual({ style: '#6d4c33', x: 217, y: 109, w: 3, h: 1 })
    // facing right, col 5 mirrors to x 198 + 23 - 5 = 216; x 203 is then row 18's col 18, the outline, so no suit there
    const log = paintWith(editorAt(1), { visitor: 'editor' })
    expect(has(log, '#5b6270', 216, 103)).toBe(true)
    expect(has(log, '#5b6270', 203, 103)).toBe(false)
  })

  it('walks the editor with their own four frames, the briefcase bobbing a row on the pass', () => {
    // the case at cols 18-23: WALK[0] (anim 0) and WALK[2] (anim 200) have row 24's FFF at cols 19-21 (x 217, y 109);
    // WALK[1] (anim 100, the pass) has it a row lower, row 25 (y 110), and row 24 there is the case's top edge only
    const brown = (log: FillCall[], y: number) => log.filter((c) => c.style === '#6d4c33' && c.y === y && c.h === 1 && c.w === 3)
    const walk = (anim: number) => paintWith(editorAt(-1, { state: 'walking', targetX: 150, anim }), { visitor: 'editor' })
    expect(brown(walk(0), 109).map((c) => c.x)).toEqual([217])
    expect(brown(walk(200), 109).map((c) => c.x)).toEqual([217])
    expect(brown(walk(100), 110).map((c) => c.x)).toEqual([217])
  })

  it('puts the mangaka to bed to rest, the Zz rising over the pillow', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ activity: 'rest' }), 0.3, 0)
    // bed (216, 106): LIE row 2's first H is col 16 (x 232); the blanket over the body after it; the first Z at (234, 100)
    const hair = covers(log, '#2b2140', 232, 108)
    expect(hair).toBeGreaterThanOrEqual(0)
    expect(covers(log, '#c94b4b', 200, 116)).toBeGreaterThan(hair)
    expect(has(log, '#2f5ecf', 235, 100)).toBe(true)
  })

  it('hands the editor their prop and bobs the ! above them while they stand facing left', () => {
    const at = (over: Parameters<typeof sceneSnapshot>[0], frame: number) => {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot(over), 0.3, frame)
      return log
    }
    const env = at({ visitor: 'editor', visitorProp: 'envelope' }, 100)
    expect(covers(env, '#2b2140', 206, 87)).toBeGreaterThan(-1)
    // the envelope sprite at (198 - 2, 85 + 20) = (196, 105), the hand row 22's level: its corner, and row 1 col 2 paper
    expect(covers(env, '#1c1a26', 196, 105)).toBeGreaterThan(-1)
    expect(covers(env, '#fdfcf7', 198, 106)).toBeGreaterThan(-1)
    expect(covers(env, '#fdfcf7', 198, 105)).toBe(-1)
    // frame 100: floor(100 / 16) % 2 = 0, so the ! tops out at 85 - 8 = 77 from x 209, its stroke in the glyph's middle
    // column (x 210)
    expect(covers(env, '#e5484d', 210, 77)).toBeGreaterThan(-1)
    // the trophy at (198 - 2, 85 + 18) = (196, 103): row 1 col 2 is gold
    expect(covers(at({ visitor: 'editor', visitorProp: 'trophy' }, 100), '#f5b700', 198, 104)).toBeGreaterThan(-1)
    expect(covers(at({ visitor: 'editor', visitorProp: 'envelope' }, 16), '#e5484d', 210, 76)).toBeGreaterThan(-1)
  })

  it('merges horizontal runs of one sprite key into a single fill', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 0)
    // the seated mangaka's row 1 '....LLHHHHHHHHHhLL......' at (132, 67): one 9x1 hair fill from x 138 (cols 6-14)
    expect(log).toContainEqual({ style: '#2b2140', x: 138, y: 68, w: 9, h: 1 })
    expect(log).not.toContainEqual({ style: '#2b2140', x: 139, y: 68, w: 1, h: 1 })
    // the editor facing right at (198, 85), row 24 '.......LggggggggL.LFFFfL' mirrored: FFF (cols 19-21) at x 200-202,
    // the suit's shade hem (cols 8-15) at x 206-213
    const ed = paintWith(editorAt(1), { visitor: 'editor' })
    expect(ed).toContainEqual({ style: '#6d4c33', x: 200, y: 109, w: 3, h: 1 })
    expect(ed).toContainEqual({ style: '#454a55', x: 206, y: 109, w: 8, h: 1 })
  })

  it('paints no prop while the editor walks', () => {
    const table = editorAt(-1, { state: 'walking', targetX: 180 })
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ visitor: 'editor', visitorProp: 'envelope', actors: table }), 0.3, 100)
    expect(covers(log, '#fdfcf7', 198, 106)).toBe(-1)
    expect(covers(log, '#e5484d', 210, 77)).toBe(-1)
  })
})

describe('the assistants, the wall clock and the cat (Task 2.5)', () => {
  const at = (over: Parameters<typeof sceneSnapshot>[0], t = 0.3, frame = 100) => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(over), t, frame)
    return log
  }
  const px = (style: string, x: number, y: number, w = 1, h = 1) => ({ style, x, y, w, h })
  const lines = (log: FillCall[]) => log.filter((c) => c.style === '#b8b2a5' && c.x === 70 && c.w === 4 && c.h === 1)
  const page = (log: FillCall[]) => covers(log, '#fdfcf7', 70, 121)

  it('seats the assistant on a stool at (66, 89), then the desk, then the page on it with round(progress * 3) ink lines', () => {
    const ref = at({})
    // SIT row 2 col 8 is hair; the stool (seat + 7, 118) before it
    const hair = covers(ref, '#2b2140', 74, 91)
    expect(hair).toBeGreaterThan(-1)
    const stool = ref.findIndex((c) => c.style === '#4a4a55' && c.x === 73 && c.y === 118 && c.w === 10 && c.h === 4)
    expect(stool).toBeGreaterThan(-1)
    expect(stool).toBeLessThan(hair)
    // the desk top (x 62, width 8 + 20) after the assistant, and the page after the desk, so it shows
    expect(ref).toContainEqual(px('#8b5a2b', 62, 120, 28, 3))
    const desk = covers(ref, '#8b5a2b', 66, 120)
    expect(desk).toBeGreaterThan(hair)
    expect(page(ref)).toBeGreaterThan(desk)
    // progress 0.5: round(1.5) = 2 lines, at y 121 and 122
    expect(lines(ref).map((c) => c.y)).toEqual([121, 122])
    expect(lines(at({ progress: 1 })).map((c) => c.y)).toEqual([121, 122, 123])
    expect(lines(at({ progress: 0 }))).toHaveLength(0)
    const paused = at({ running: false })
    expect(page(paused)).toBe(-1)
    expect(lines(paused)).toHaveLength(0)
  })

  it('widens the desk with the staff: 8 + 20 per assistant, three stools', () => {
    const three = at({ assistants: [{ look: 0, stamina: 80 }, { look: 1, stamina: 80 }, { look: 2, stamina: 80 }] })
    expect(three).toContainEqual(px('#8b5a2b', 62, 120, 68, 3))
    expect(three).toContainEqual(px('#70461f', 62, 123, 68, 9))
    for (const x of [73, 93, 113]) expect(three).toContainEqual(px('#4a4a55', x, 118, 10, 4))
  })

  it('dozes a sleeping assistant, head on the folded arms, with the Z, and seats a working one upright', () => {
    const rest = at({ activity: 'rest' }, 0.3, 0)
    // DOZE row 8 col 10 is hair (the head down 6 and right 2); the Z at (66 + 18, 89 - 6)
    expect(covers(rest, '#2b2140', 76, 97)).toBeGreaterThan(-1)
    expect(covers(rest, '#2f5ecf', 85, 83)).toBeGreaterThan(-1)
    expect(page(rest)).toBe(-1)
    // no hair where the upright head's row 2 col 8 would be
    expect(covers(rest, '#2b2140', 74, 91)).toBe(-1)
    expect(covers(at({}, 0.3, 0), '#2b2140', 74, 91)).toBeGreaterThan(-1)
  })

  it('hangs the wall clock at (156, 52), its hands turning with the week', () => {
    const noon = at({}, 0.3)
    expect(covers(noon, '#3b3b45', 157, 52)).toBeGreaterThan(-1)
    // t 0.3: minute floor(19.2) % 8 = 3, hour floor(4.8) % 8 = 4
    expect(noon).toContainEqual(px('#1b1b1b', 160, 56))
    expect(noon).toContainEqual(px('#1b1b1b', 159, 56))
    const zero = at({}, 0)
    expect(zero).toContainEqual(px('#1b1b1b', 159, 53, 1, 2))
    expect(zero).toContainEqual(px('#1b1b1b', 159, 54))
    for (let i = 0; i < 100; i++) {
      const hands = at({}, i / 100).filter((c) => c.style === '#1b1b1b' && c.x >= 150 && c.x <= 170 && c.y >= 45 && c.y <= 65)
      expect(hands.length, `t ${i / 100}`).toBe(2)
      for (const c of hands) expect(c.x >= 156 && c.x + c.w <= 163 && c.y >= 52 && c.y + c.h <= 59, `t ${i / 100}`).toBe(true)
    }
  })

  it('curls the cat asleep at the foot of the bed, and sits it awake in the kitchen on a rest day', () => {
    const ref = at({})
    // CAT_SLEEP at (196, 118): row 3 col 1 is fur, and it has no eye
    expect(covers(ref, '#e39a4a', 197, 121)).toBeGreaterThan(-1)
    expect(ref.some((c) => c.style === '#1b1b1b' && c.x < 208 && c.x + c.w > 196 && c.y < 126 && c.y + c.h > 118)).toBe(false)
    const rest = at({ activity: 'rest' })
    // CAT_SIT at (44, 150): the eye row 3 col 3, fur row 1 col 1
    expect(covers(rest, '#1b1b1b', 47, 153)).toBeGreaterThan(-1)
    expect(covers(rest, '#e39a4a', 45, 151)).toBeGreaterThan(-1)
  })

  it('draws the cat after the mangaka in bed and before the editor', () => {
    const table = newActorTable()
    Object.assign(table.cat, { x: 196, y: 118, targetX: 196, targetY: 118, state: 'sleeping', goal: 'sleeping' })
    Object.assign(table.mangaka, { x: 216, y: 106, targetX: 216, targetY: 106, state: 'sleeping', goal: 'sleeping' })
    Object.assign(table.editor, { x: 198, y: 85, targetX: 198, targetY: 85, state: 'standing', goal: 'standing', facing: -1 })
    const log = at({ activity: 'rest', visitor: 'editor', actors: table })
    const cat = covers(log, '#e39a4a', 197, 121)
    expect(cat).toBeGreaterThan(covers(log, '#c94b4b', 200, 116))
    expect(cat).toBeLessThan(covers(log, '#2b2140', 206, 87))
  })

  it('walks the cat with the two-frame cycle', () => {
    const walk = (anim: number) => {
      const table = newActorTable()
      Object.assign(table.cat, { x: 120, y: 104, targetX: 100, targetY: 104, state: 'walking', goal: 'sleeping', facing: -1, anim })
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot({ actors: table }), 0.3, 100)
      return log
    }
    // WALK[1] row 6 col 1 is a paw; WALK[0] has the outline there
    expect(covers(walk(125), '#e39a4a', 121, 110)).toBeGreaterThan(-1)
    expect(covers(walk(0), '#e39a4a', 121, 110)).toBe(-1)
  })

  it('keeps the cat clear of the mangaka\'s, the editor\'s and the bed\'s spots', () => {
    type Box = readonly [number, number, number, number]
    const boxes: Box[] = [[132, 155, 67, 98], [170, 193, 81, 112], [198, 221, 85, 116], [216, 245, 106, 119]]
    for (const over of [{}, { activity: 'rest' as const }]) {
      const s = sceneSnapshot(over)
      const c = s.actors.cat
      for (const [x0, x1, y0, y1] of boxes) {
        const clear = c.x + 11 < x0 || c.x > x1 || c.y + 7 < y0 || c.y > y1
        expect(clear, JSON.stringify([c.x, c.y, x0, y0])).toBe(true)
      }
    }
  })
})
