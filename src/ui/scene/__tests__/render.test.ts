// The scene's render is a pure function of (snapshot, time of day, frame) onto a 2D context: no DOM needed, so this
// runs in the default node environment against the recording context from src/test/fakeCanvas.ts.
import { describe, expect, it } from 'vitest'
import { covers, coversAny, fakeContext, fakeImage, fakeSceneArt, sceneSnapshot } from '../../../test/fakeCanvas'
import type { FillCall } from '../../../test/fakeCanvas'
import type { StudioTierId } from '../../../sim'
import { H, PROP_BOX, PROP_FOOTPRINT, SKY_LUT, W, render, skyColor } from '../render'
import type { Snapshot } from '../render'
import { drawRoomShell } from '../roomArt'
import { DOORWAY_BOX, DOOR_BOX, NO_EQUIPMENT } from '../studioArt'
import { DESK_PROPS, NO_ART, PROP_ALIGN, PROP_MIN_H, PROP_SPRITE, ROOM_NIGHT_DIM, fitDesk, fitSprite, hangSprite, placeSprite, ready } from '../sceneArt'
import type { SceneArt, ScenePropId } from '../sceneArt'
import type { Season } from '../season'
import { newActorTable } from '../actors'
import { ASSISTANT_DOZE, CAT_SIT, CAT_SLEEP, MANGAKA_LIE, MANGAKA_SIT } from '../sprites'
import { runCount } from '../../art/pixelOps'
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
 * sprites' 1x1 pixels became runs (the hero, the assistant, the clock and the cat). Task B (0.2.1) re-measured it the same way at 430: the mangaka a 24x32 sprite and the stock chair's new back. Task C (0.2.1) re-measured it the same way at 596: the assistant a 24x32 seated frame, its stool and the page's wider lines, the cat's 12x8 sleeping frame. Upgrade 0.3.0 re-measured it the same way at 649: the tatami room 61 in place of the striped room's 58 (+3), five floor shadows and the staff desk's (+6), the corkboard 10 (board 2, four cards at 2), the calendar 7, the apartment's front row 12 and the bin 7 (5 and two crumpled pages), and the light 8 (the daylight shaft 4, the vignette 4). Upgrade 0.4.0's chibi cast (Task 6) re-measured it the same way at 659 (+10): redrawing MANGAKA_SIT[0] to the chibi proportions (an 18-wide, 16-row head in place of the old frame's narrower crown) costs 5 more fillRect runs than the old frame, and the reference scene paints two seated figures from that map at frame 100 (the mangaka and its one assistant, both landing on index 0: `floor(100/8)%2` for the mangaka, `floor((100+0*3)/8)%2` for the assistant) — 5 + 5 = 10. The mood overlay adds nothing here: the reference scene's mood is neutral (home, no editor, no cheer, stamina 80), and `drawMood` returns early for `neutral`. Upgrade 0.5.0 Task 6.1 re-measured it the same way at 659 (+0): the daylight shaft keeps its four steps, each now wider and fainter. Upgrade 0.5.0 Task 6.2 re-measured it the same way at 659 (+0): the wood-beam frame is the flat's and the loft's, and this scene is the apartment. Upgrade 0.5.0 Task 6.3 re-measured it the same way at 665 (+6): the reference scene is spring, and the cherry now spills past the pane onto the wall (`drawSeasonWall`: a branch, a twig and four blossom clusters, 6 fills). Upgrade 0.5.0 Task 6.4 re-measured it the same way at 663 (-2): the corkboard pins a card per sixth of the pages (a 2x3 grid), so half the pages drawn shows 3 cards in place of 4, at 2 fills each. Upgrade 0.5.0 Task 6.5 re-measured it the same way at 667 (+4): the cat sleeps on a round cushion (4 fills: its top, body, rim and bottom); its cream chest patch is only in the frames where the chest shows, never the curled `CAT_SLEEP` this scene draws. Upgrade 0.5.0 Task 6.6 re-measured it the same way at 667 (+0): `MANGAKA_PANIC`'s hands-on-head redraw only paints while a chapter is late, and this scene is not. Upgrade 0.5.0 Task 6.7 re-measured it the same way at 667 (+0): the mood marks move to the head's top-right edge (x+20, y-2), and this scene's neutral mood draws none. Upgrade 0.5.0 Task 6.8 re-measured it the same way at 673 (+6): the collar (K) and tie (Y/y) split each `MANGAKA_SIT` frame's neckline into 3 more runs (row 16 +1, the collar points on row 17 +2; the tie keeps the stripe's run count), and this scene draws two seated figures (the mangaka and its assistant): 3 + 3 = 6. drawSprite merges runs by key, so the hoodie's K painted in J's colour still costs its own fills. Every scene must stay under 1.5 times this.
 */
const BASELINE_FILLS = 673
const BUDGET = BASELINE_FILLS * 1.5

/**
 * fillRect calls for the same reference scene with every generated image ready (`fakeSceneArt`: the apartment's room
 * image and its six props, 7 drawImage calls), measured the same way (0.9.0 R2): 546. By hand, the 673 less what the
 * images replace: the apartment's shell 61, the kitchenette 17, the window frame 1, the bookshelf 34, the stock poster
 * 4, the bed 5 and the plain door 5 (673 - 127 = 546). The night dim adds 1 at night. 0.10.0 P1 re-measured it the
 * same way at 521 (-25, 14 drawImage calls): the stock chair 4 and the stock desk 7, and the apartment's front row, the
 * zabuton 4, the boxes 6 and the bin 4 (each piece's contact shadow is still one fill, moved across its sprite, and the
 * bin's crumpled pages stay code-drawn): 546 - 25 = 521. Every scene with the art ready must stay under 1.5 times this
 * (781.5; its own budget: the images leave fewer fills, so 673's budget would hide growth).
 */
const ART_BASELINE_FILLS = 521
const ART_BUDGET = ART_BASELINE_FILLS * 1.5

/**
 * fillRect calls for the rest scene (`sceneSnapshot({ activity: 'rest' })`: the reference scene on a rest day, the
 * assistant dozing at the desk under the generated ASSISTANT_DOZE, 0.11.0) at t = 0.3 and frame 100, measured the same
 * way: 509. By hand, from the 673: the seated mangaka goes to bed (MANGAKA_SIT[0] 184 out; MANGAKA_LIE 72, the blanket
 * and its fold 2 and frame 100's three Zs at 9 each, 101 in), the cat leaves its cushion for the kitchen (the cushion
 * 4 and CAT_SLEEP 31 out; frame 100 is catFrame's sit, CAT_SIT 34 in), the assistant dozes (MANGAKA_SIT[0] 184 and its
 * page 3 out; ASSISTANT_DOZE 100 and its Z 9 in), and nobody works (the lamp's glow and the mug's steam, 2 out):
 * 673 - 184 + 101 - 35 + 34 - 187 + 109 - 2 = 509. Every rest scene must stay under 1.5 times this (763.5).
 */
const REST_BASELINE_FILLS = 509
const REST_BUDGET = REST_BASELINE_FILLS * 1.5

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

  it('stays under 1.5 times its own measured baseline with every generated image ready, in every tier and season', () => {
    expect(ART_BUDGET).toBe(781.5)
    const ref = fakeContext()
    render(ref.ctx, sceneSnapshot(), 0.3, 100, fakeSceneArt())
    expect(ref.log).toHaveLength(ART_BASELINE_FILLS)
    expect(ref.images.map((i) => i.id)).toEqual([
      'room/apartment', 'kitchenette', 'window', 'bookshelf', 'poster', 'bed', 'door', 'chair', 'desk', 'zabuton', 'boxes', 'bin',
    ])
    for (const tier of ['apartment', 'flat', 'loft'] as StudioTierId[]) {
      for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
        for (const t of [0.3, 0.9]) {
          const { ctx, log } = fakeContext()
          render(ctx, sceneSnapshot({ tier, season }), t, 100, fakeSceneArt())
          expect(log.length, `${tier} ${season} t ${t}`).toBeLessThan(ART_BUDGET)
        }
      }
    }
  })

  it("spans the bookshelf's contact shadow over its sprite when the image is ready, and keeps the old one without art", () => {
    const shadowAt = (log: readonly FillCall[]) => log.find((c) => c.style === 'rgba(40, 24, 16, 0.28)' && c.y === 114 && c.x >= 64 && c.x < 74)
    const ready = fakeContext()
    render(ready.ctx, sceneSnapshot(), 0.3, 100, fakeSceneArt())
    expect(shadowAt(ready.log)).toMatchObject({ x: PROP_BOX.bookshelf.x, w: PROP_BOX.bookshelf.w })
    const bare = fakeContext()
    render(bare.ctx, sceneSnapshot(), 0.3, 100)
    expect(shadowAt(bare.log)).toMatchObject({ x: 72, w: 35 })
  })

  it('renders frame 0 the same way twice (a pure function of its inputs)', () => {
    const a = fakeContext()
    const b = fakeContext()
    render(a.ctx, sceneSnapshot(), 0.3, 0)
    render(b.ctx, sceneSnapshot(), 0.3, 0)
    expect(b.log).toEqual(a.log)
  })

  it('stays under 1.5 times the measured baseline of fillRect calls in every season, by day and by night', () => {
    expect(BUDGET).toBe(1009.5)
    const ref = fakeContext()
    render(ref.ctx, sceneSnapshot(), 0.3, 100)
    expect(ref.log).toHaveLength(BASELINE_FILLS)
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
      for (const t of [0.3, 0.9]) {
        const { ctx, log } = fakeContext()
        render(ctx, sceneSnapshot({ season }), t, 100)
        expect(log.length, `${season} t ${t}`).toBeLessThan(BUDGET)
      }
    }
  })

  it('stays under 1.5 times the measured rest-scene baseline, the assistant dozing, in every season, by day and by night', () => {
    expect(REST_BUDGET).toBe(763.5)
    // the by-hand terms (see REST_BASELINE_FILLS)
    expect([MANGAKA_SIT[0], MANGAKA_LIE, CAT_SLEEP, CAT_SIT, ASSISTANT_DOZE].map(runCount)).toEqual([184, 72, 31, 34, 100])
    const ref = fakeContext()
    const rest = sceneSnapshot({ activity: 'rest' })
    expect([rest.actors.mangaka.state, rest.actors.cat.state, rest.actors.assistants[0].state]).toEqual(['sleeping', 'sitting', 'sleeping'])
    render(ref.ctx, rest, 0.3, 100)
    expect(ref.log).toHaveLength(REST_BASELINE_FILLS)
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
      for (const t of [0.3, 0.9]) {
        const { ctx, log } = fakeContext()
        render(ctx, sceneSnapshot({ activity: 'rest', season }), t, 100)
        expect(log.length, `${season} t ${t}`).toBeLessThan(REST_BUDGET)
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
    // contact (anim 0): WALK[0] row 30 '..LOOOOoL...LOOoL.......', the forward shoe's O at cols 3-6 (col 5 at x 155);
    // pass (anim 100): the shoes together at cols 9-14, nothing at col 5
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
    // PANIC[0] row 1 col 3 is the leading hand on top of the head (SIT's row 1 col 3 is clear), at (132+3, 67+1)
    expect(covers(at(true, 0), '#f4cfa5', 135, 68)).toBeGreaterThanOrEqual(0)
    expect(covers(at(true, 40), '#f4cfa5', 135, 68)).toBe(-1)
    expect(covers(at(false, 0), '#f4cfa5', 135, 68)).toBe(-1)
  })

  it('shows the sleepy face and z mark for the seated, working mangaka late at night, but not during the day', () => {
    // seated (132, 67): the overlay's origin is (x+4, y+9) = (136, 76); FACES.sleepy row 1 col 1 is the closed-eye
    // L, at (137, 77), painted after the base sprite's eye E at (138, 76) (the earlier test above)
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.9, 0)
    const eye = covers(log, '#1b1b1b', 138, 76)
    expect(eye).toBeGreaterThanOrEqual(0)
    const sleepyEye = covers(log, '#1c1a26', 137, 77)
    expect(sleepyEye).toBeGreaterThan(eye)
    // the z mark (MARKS.sleepy, MARK_PAL.L) at the head's top-right edge, (x+20, y-2) = (152, 65)
    expect(covers(log, '#1c1a26', 152, 65)).toBeGreaterThan(-1)

    const { ctx: dayCtx, log: dayLog } = fakeContext()
    render(dayCtx, sceneSnapshot(), 0.3, 0)
    expect(covers(dayLog, '#1c1a26', 137, 77)).toBe(-1)
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
    // DOZE (generated, task C2) row 11 col 9 is hair (the head down on the arms); the Z just above the head
    // at (66 + 18, 89 - 2), its top row 87 (the doze's first painted row is 10, y 99)
    expect(covers(rest, '#2b2140', 75, 100)).toBeGreaterThan(-1)
    expect(covers(rest, '#2f5ecf', 85, 87)).toBeGreaterThan(-1)
    expect(covers(rest, '#2f5ecf', 85, 83)).toBe(-1)
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
    // the round cushion under it: 16 wide from x 194, its body y 122-125 (the rim at 126-127); drawn before the cat,
    // so the fur at (197, 121) is the cat's own, and below the sprite (y 126) only the cushion shows
    const cushion = covers(ref, '#c9a24a', 195, 124)
    expect(cushion).toBeGreaterThan(-1)
    expect(cushion).toBeLessThan(covers(ref, '#e39a4a', 197, 121))
    expect(covers(ref, '#a8832f', 200, 127)).toBeGreaterThan(-1)
    const rest = at({ activity: 'rest' })
    expect(rest.some((c) => c.style === '#c9a24a')).toBe(false)
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

  it('overlays the mood face and mark on the seated mangaka when cheer is on, over the base eye fill', () => {
    // seated (132, 67), overlay at (136, 76): happy row 10 col 1 is L; the base sprite's eye fill at (138, 76) is
    // painted first, so the overlay's L at (137, 77) must come after it
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ cheer: true }), 0.3, 0)
    const eye = covers(log, '#1b1b1b', 138, 76)
    expect(eye).toBeGreaterThanOrEqual(0)
    const overlay = covers(log, '#1c1a26', 137, 77)
    expect(overlay).toBeGreaterThan(eye)
    // sparkle (happy's mark) at (x + 20, y - 2) = (152, 65), row 0 col 1
    expect(covers(log, '#f5b700', 153, 65)).toBeGreaterThan(-1)
  })

  it('shows a sweat mark for a tired seated mangaka, and no more low-stamina !', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ stamina: 10 }), 0.3, 0)
    expect(covers(log, '#8fd3ff', 153, 66)).toBeGreaterThan(-1)
    expect(covers(log, '#e5484d', 153, 65)).toBe(-1)
  })

  it('paints no overlay for a neutral mood', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 0)
    const before = covers(log, '#f4cfa5', 137, 77)
    // nothing else paints at (137, 77) after the base sprite's own fill there
    const after = coversAny(log, 137, 77)
    expect(after).toBe(before)
  })

  it('skips the mood overlay while the mangaka walks, even with cheer on', () => {
    const table = newActorTable()
    Object.assign(table.mangaka, { x: 150, y: 81, targetX: 100, targetY: 81, state: 'walking', goal: 'standing', facing: -1, anim: 0 })
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ cheer: true, actors: table }), 0.3, 0)
    expect(log.some((c) => c.style === '#1c1a26' && c.x === 154 && c.y === 90)).toBe(false)
  })

  it('lets the ready manuscript exclamation beat a tired mood mark above the standing mangaka (fix round 1)', () => {
    // standing at MANGAKA_STAND (170, 81): mark slot (170+20, 81-2) = (190, 79); glyph '!' row 1 col 1 -> (191, 80)
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'ready', stamina: 10 }), 0.3, 100)
    expect(covers(log, '#e5484d', 191, 80)).toBeGreaterThan(-1)
    expect(covers(log, '#8fd3ff', 191, 80)).toBe(-1)
  })

  it('lets a happy mood mark beat the idle question mark above the standing mangaka (fix round 1)', () => {
    // idle phase, cheer on, frame 0 (frame % 120 < 40, when the '?' would show): sparkle row 0 col 1 -> (191, 79)
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'idle', cheer: true }), 0.3, 0)
    expect(covers(log, '#f5b700', 191, 79)).toBeGreaterThan(-1)
    expect(log.some((c) => c.style === '#2f5ecf')).toBe(false)
  })

  it('shows a sweat mark on a tired assistant', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ assistants: [{ look: 0, stamina: 10 }] }), 0.3, 0)
    // assistant at (66, 89): mark at (66 + 20, 89 - 2) = (86, 87), row 1 col 1
    expect(covers(log, '#8fd3ff', 87, 88)).toBeGreaterThan(-1)
  })

  it('puts the mark at the top-right edge, right of the hair and clear of its outline', () => {
    // seated (132, 67), sleepy at night: every MARK fill sits in cols 20-22, rows -2 to 2 of the frame, and the frame's
    // own cells there (MANGAKA_SIT rows 0-2, cols 20-22) are empty, so the mark never touches the hair
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.9, 0)
    const z = log.filter((c) => c.style === '#1c1a26' && c.y < 70 && c.x >= 152)
    expect(z.length).toBeGreaterThan(0)
    for (const c of z) expect(c.x >= 152 && c.x + c.w <= 155 && c.y >= 65 && c.y + c.h <= 70, JSON.stringify(c)).toBe(true)
    expect(MANGAKA_SIT[0].slice(0, 3).map((row) => row.slice(19))).toEqual(['.....', '.....', '.....'])
  })

  it('shows the sip mug at frame 300 (idle cycle), standing and not ready', () => {
    // standing at MANGAKA_STAND (170, 81): SIP row 12 col 9 (the mug rim) -> (170+9, 81+12) = (179, 93)
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'idle' }), 0.3, 300)
    expect(covers(log, '#f6f6f6', 179, 93)).toBeGreaterThan(-1)
  })

  it('holds the manuscript instead of the mug at frame 300 when the phase is ready', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'ready' }), 0.3, 300)
    expect(covers(log, '#f6f6f6', 179, 93)).toBe(-1)
  })

  it('shows the plain idle at frame 0', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'idle' }), 0.3, 0)
    const hair = covers(log, '#2b2140', 178, 83)
    expect(hair).toBeGreaterThan(-1)
    expect(covers(log, '#f6f6f6', 179, 93)).toBe(-1)
  })

  it('paints the groom paw in fur at CAT_KITCHEN on frame 360 (fix round 1)', () => {
    // resting sends the cat to CAT_KITCHEN (44, 150), unflipped (facing -1 by default); frame 360 is catFrame's
    // groom, index 0: the paw's fur cell at local (row 1, col 2) -> canvas (44+2, 150+1) = (46, 151)
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'drawing', activity: 'rest' }), 0.3, 360)
    expect(covers(log, '#e39a4a', 46, 151)).toBeGreaterThan(-1)
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

describe('outfits by level (Task 5, Decision 7)', () => {
  // standing at MANGAKA_STAND (170, 81): the anchor's row 19 col 10 'J' (a torso cell on either facing; task B1 made
  // row 18 col 6 a sleeve, j) -> (170+10, 81+19) = (180, 100)
  it('dresses the standing mangaka in the outfit for their level', () => {
    const table = newActorTable()
    Object.assign(table.mangaka, { x: 170, y: 81, targetX: 170, targetY: 81, state: 'standing', goal: 'standing' })
    const at = (level: number) => {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot({ level, actors: table }), 0.3, 0)
      return log
    }
    expect(covers(at(1), '#6f7a8c', 180, 100)).toBeGreaterThan(-1)
    expect(covers(at(5), '#c9a24a', 180, 100)).toBeGreaterThan(-1)
    expect(covers(at(10), '#2e3a78', 180, 100)).toBeGreaterThan(-1)
  })

  it('leaves an assistant\'s look palette unaffected by the player\'s level', () => {
    // the assistant seated at (66, 89): the same anchor cell -> (66+6, 89+18) = (72, 107)
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ level: 10 }), 0.3, 0)
    expect(covers(log, '#6f7a8c', 72, 107)).toBeGreaterThan(-1)
  })
})

describe('scene art (0.9.0 R1): generated images with the code-drawn look as the fallback', () => {
  const TIERS: StudioTierId[] = ['apartment', 'flat', 'loft']
  const withRoom = (tier: StudioTierId, img: CanvasImageSource): SceneArt => ({ room: { ...NO_ART.room, [tier]: img }, prop: {} })
  const withProp = (id: ScenePropId, img: CanvasImageSource): SceneArt => ({ room: NO_ART.room, prop: { [id]: img } })
  function paint(over: Partial<Snapshot>, t: number, art?: SceneArt) {
    const f = fakeContext()
    if (art) render(f.ctx, sceneSnapshot(over), t, 100, art)
    else render(f.ctx, sceneSnapshot(over), t, 100)
    return f
  }
  const loadingImage = (id: string) => ({ ...fakeImage(id, 320, 180), complete: false }) as unknown as CanvasImageSource

  it('accepts only a loaded image', () => {
    expect(ready(null)).toBe(false)
    expect(ready(undefined)).toBe(false)
    expect(ready(fakeImage('a', 4, 4))).toBe(true)
    expect(ready(loadingImage('a'))).toBe(false)
    expect(ready({ ...fakeImage('a', 4, 4), naturalWidth: 0 } as unknown as CanvasImageSource)).toBe(false)
    // anything that is not an <img> counts by its width (a canvas, a bitmap)
    expect(ready({ width: 8, height: 8 } as unknown as CanvasImageSource)).toBe(true)
    expect(ready({ width: 0, height: 0 } as unknown as CanvasImageSource)).toBe(false)
  })

  it('has no art at all in NO_ART, and paints the measured baseline with it (nothing changed)', () => {
    expect(Object.values(NO_ART.room).every((v) => v === null)).toBe(true)
    expect(Object.values(NO_ART.prop).every((v) => v === null)).toBe(true)
    const plain = paint({}, 0.3)
    const none = paint({}, 0.3, NO_ART)
    expect(none.log).toHaveLength(BASELINE_FILLS)
    expect(none.log).toEqual(plain.log)
    expect(none.images).toEqual([])
  })

  it("draws a ready room image first, at 0,0,320,180, in place of every one of the shell's fills", () => {
    for (const tier of TIERS) {
      const shell = fakeContext()
      drawRoomShell(shell.ctx, tier, false)
      expect(shell.log.length, tier).toBeGreaterThan(0)
      const plain = paint({ tier }, 0.3)
      const art = paint({ tier }, 0.3, withRoom(tier, fakeImage('room', 320, 180)))
      expect(art.images[0], tier).toEqual({ id: 'room', x: 0, y: 0, w: 320, h: 180, at: 0 })
      expect(plain.log.slice(0, shell.log.length), tier).toEqual(shell.log)
      expect(art.log, tier).toEqual(plain.log.slice(shell.log.length))
    }
  })

  it('still paints the sky over the pane after the room image', () => {
    const art = paint({}, 0.3, withRoom('apartment', fakeImage('room', 320, 180)))
    expect(covers(art.log, skyColor(0.3), 200, 60)).toBeGreaterThanOrEqual(art.images[0].at)
  })

  it('dims a room image at night with one fill right after it, and keeps the night overlay on top', () => {
    const shell = fakeContext()
    drawRoomShell(shell.ctx, 'apartment', true)
    const plain = paint({}, 0.9)
    const art = paint({}, 0.9, withRoom('apartment', fakeImage('room', 320, 180)))
    expect(ROOM_NIGHT_DIM).toBe('rgba(20,24,60,0.25)')
    expect(art.images[0].at).toBe(0)
    expect(art.log[0]).toEqual({ style: ROOM_NIGHT_DIM, x: 0, y: 0, w: 320, h: 180 })
    expect(art.log.slice(1)).toEqual(plain.log.slice(shell.log.length))
    expect(art.log.findIndex((c) => c.style === 'rgba(20, 24, 60, 0.28)')).toBeGreaterThan(0)
    // by day, no dim
    expect(paint({}, 0.3, withRoom('apartment', fakeImage('room', 320, 180))).log.some((c) => c.style === ROOM_NIGHT_DIM)).toBe(false)
  })

  it("falls back to the shell's fills while the room image is still loading, or when only another tier has one", () => {
    const plain = paint({}, 0.3)
    const art = paint({}, 0.3, withRoom('apartment', loadingImage('room')))
    expect(art.images).toEqual([])
    expect(art.log).toEqual(plain.log)
    const other = paint({}, 0.3, withRoom('loft', fakeImage('room', 320, 180)))
    expect(other.images).toEqual([])
    expect(other.log).toEqual(plain.log)
  })

  it("measures each structural prop's footprint from the code-drawn piece it replaces (canvas space)", () => {
    expect(PROP_FOOTPRINT).toEqual({
      window: { x: 180, y: 46, w: 48, h: 36 },
      door: { x: 258, y: 56, w: 17, h: 58 },
      doorway: { x: 258, y: 56, w: 17, h: 58 },
      kitchenette: { x: 2, y: 56, w: 60, h: 58 },
      bookshelf: { x: 72, y: 54, w: 34, h: 58 },
      bed: { x: 192, y: 102, w: 58, h: 26 },
      poster: { x: 116, y: 50, w: 22, h: 28 },
      // 0.10.0 P1: the desk and the chairs, the equipment and each tier's front row
      desk: { x: 116, y: 98, w: 58, h: 20 },
      'drafting-table': { x: 108, y: 95, w: 68, h: 23 },
      chair: { x: 134, y: 78, w: 20, h: 30 },
      'tall-chair': { x: 132, y: 74, w: 24, h: 34 },
      'arm-lamp': { x: 156, y: 78, w: 14, h: 20 },
      'reference-shelf': { x: 107, y: 56, w: 8, h: 38 },
      'coffee-machine': { x: 182, y: 73, w: 9, h: 8 },
      zabuton: { x: 87, y: 161, w: 24, h: 7 },
      boxes: { x: 148, y: 148, w: 22, h: 22 },
      fern: { x: 71, y: 144, w: 16, h: 27 },
      books: { x: 152, y: 158, w: 18, h: 9 },
      'floor-lamp': { x: 64, y: 142, w: 12, h: 34 },
      sofa: { x: 196, y: 150, w: 36, h: 26 },
      bin: { x: 233, y: 154, w: 11, h: 12 },
    })
  })

  it("sizes a prop sprite by its footprint's height and its own aspect, shrinking it only to a maximum width", () => {
    const fp = { x: 10, y: 20, w: 10, h: 20 }
    expect(fitSprite(0.5, fp)).toEqual([10, 20])
    expect(fitSprite(2, fp)).toEqual([40, 20])
    expect(fitSprite(0.65, fp)).toEqual([13, 20])
    expect(fitSprite(2, fp, 30)).toEqual([30, 15])
    expect(fitSprite(2, fp, 50)).toEqual([40, 20])
  })

  it('raises a small prop to its minimum readable height (fix round 1), its width still from its aspect', () => {
    const fp = { x: 10, y: 20, w: 10, h: 8 }
    expect(fitSprite(2, fp, Infinity, 12)).toEqual([24, 12])
    expect(fitSprite(2, fp, Infinity, 6)).toEqual([16, 8])
    expect(fitSprite(2, fp, 20, 12)).toEqual([20, 10])
    expect(PROP_MIN_H).toEqual({ zabuton: 12, books: 18, 'coffee-machine': 14 })
  })

  it('right-aligns a sprite on its footprint where asked, still on its bottom row', () => {
    const fp = { x: 10, y: 20, w: 10, h: 20 }
    expect(placeSprite(fp, 16, 12, 'right')).toEqual({ x: 4, y: 28, w: 16, h: 12 })
    expect(placeSprite(fp, 16, 12, 'centre')).toEqual(placeSprite(fp, 16, 12))
    expect(PROP_ALIGN).toEqual({ 'reference-shelf': 'right' })
    // every listed alignment takes effect in the placement table: a right-aligned box ends on its footprint's right edge
    for (const [id, align] of Object.entries(PROP_ALIGN) as [ScenePropId, string][]) {
      expect(align, id).toBe('right')
      expect(PROP_BOX[id].x + PROP_BOX[id].w, id).toBe(PROP_FOOTPRINT[id].x + PROP_FOOTPRINT[id].w)
    }
  })

  it("sizes a desk sprite by its footprint's width instead, its height from its aspect, and hangs it from the footprint's top row", () => {
    const fp = { x: 10, y: 20, w: 30, h: 10 }
    expect(fitDesk(2, fp)).toEqual([30, 15])
    expect(fitDesk(1.75, fp)).toEqual([30, 17])
    expect(hangSprite(fp, 30, 15)).toEqual({ x: 10, y: 20, w: 30, h: 15 })
    expect(hangSprite(fp, 27, 15)).toEqual({ x: 11, y: 20, w: 27, h: 15 })
    expect([...DESK_PROPS]).toEqual(['desk', 'drafting-table'])
  })

  it('places a prop sprite bottom-aligned on its footprint and centred across it (a half pixel rounds left)', () => {
    const fp = { x: 10, y: 20, w: 10, h: 20 }
    expect(placeSprite(fp, 10, 20)).toEqual(fp)
    expect(placeSprite(fp, 40, 20)).toEqual({ x: -5, y: 20, w: 40, h: 20 })
    expect(placeSprite(fp, 10, 15)).toEqual({ x: 10, y: 25, w: 10, h: 15 })
    expect(placeSprite(fp, 13, 20)).toEqual({ x: 8, y: 20, w: 13, h: 20 })
    expect(placeSprite(fp, 7, 20)).toEqual({ x: 11, y: 20, w: 7, h: 20 })
  })

  it("places each generated sprite by that rule: its box from PROP_SPRITE on PROP_FOOTPRINT, clear of what it must not hide", () => {
    const desk = (id: ScenePropId) => (DESK_PROPS as readonly ScenePropId[]).includes(id)
    for (const id of Object.keys(PROP_FOOTPRINT) as ScenePropId[]) {
      const box = desk(id) ? hangSprite(PROP_FOOTPRINT[id], ...PROP_SPRITE[id]) : placeSprite(PROP_FOOTPRINT[id], ...PROP_SPRITE[id], PROP_ALIGN[id])
      expect(PROP_BOX[id], id).toEqual(box)
    }
    expect(PROP_BOX).toEqual({
      window: { x: 180, y: 46, w: 48, h: 36 },
      door: { x: 250, y: 64, w: 33, h: 50 },
      doorway: { x: 250, y: 73, w: 33, h: 41 },
      kitchenette: { x: 3, y: 56, w: 58, h: 58 },
      bookshelf: { x: 64, y: 54, w: 50, h: 58 },
      bed: { x: 192, y: 105, w: 58, h: 23 },
      poster: { x: 116, y: 50, w: 22, h: 28 },
      desk: { x: 116, y: 98, w: 58, h: 33 },
      'drafting-table': { x: 108, y: 95, w: 68, h: 35 },
      chair: { x: 134, y: 78, w: 19, h: 30 },
      'tall-chair': { x: 132, y: 74, w: 24, h: 34 },
      'arm-lamp': { x: 156, y: 78, w: 14, h: 20 },
      'reference-shelf': { x: 95, y: 70, w: 20, h: 24 },
      'coffee-machine': { x: 181, y: 67, w: 11, h: 14 },
      zabuton: { x: 87, y: 156, w: 24, h: 12 },
      boxes: { x: 148, y: 148, w: 22, h: 22 },
      fern: { x: 64, y: 144, w: 30, h: 27 },
      books: { x: 151, y: 149, w: 20, h: 18 },
      'floor-lamp': { x: 61, y: 142, w: 18, h: 34 },
      sofa: { x: 195, y: 153, w: 37, h: 23 },
      bin: { x: 232, y: 154, w: 13, h: 12 },
    })
    // the doormat (drawn at DOOR_BOX's columns) must sit under the doorway sprite too
    expect([DOOR_BOX.x, DOOR_BOX.w]).toEqual([DOORWAY_BOX.x, DOORWAY_BOX.w])
    const right = (b: { x: number; w: number }) => b.x + b.w
    // the door and the doorway are drawn after the bed: they stop short of it (the coat rack at x 283 is drawn after them)
    expect(PROP_BOX.door.x).toBeGreaterThanOrEqual(right(PROP_BOX.bed))
    expect(PROP_BOX.doorway.x).toBeGreaterThanOrEqual(right(PROP_BOX.bed))
    expect(right(PROP_BOX.door)).toBeLessThanOrEqual(283)
    expect(right(PROP_BOX.doorway)).toBeLessThanOrEqual(283)
    // the bookshelf is drawn after the kitchenette, and clear of it; the poster clear of the corkboard (x 140)
    expect(PROP_BOX.bookshelf.x).toBeGreaterThanOrEqual(right(PROP_BOX.kitchenette))
    expect(right(PROP_BOX.poster)).toBeLessThanOrEqual(140)
    // every sprite stands on its footprint's bottom row, but a desk, whose tabletop (and the drafting table's lightbox)
    // keeps the footprint's top row, where the pages, the ink pot and the pen sit
    for (const id of Object.keys(PROP_BOX) as ScenePropId[]) {
      if (desk(id)) expect(PROP_BOX[id].y, id).toBe(PROP_FOOTPRINT[id].y)
      else expect(PROP_BOX[id].y + PROP_BOX[id].h, id).toBe(PROP_FOOTPRINT[id].y + PROP_FOOTPRINT[id].h)
    }
    // 0.10.0 P1: the reference shelf stays clear of the poster (x 116, drawn after it); the sofa of the bin (x 232, drawn
    // after it); the desk top spans the pages (x 121) to the lamp's clamp (x 169)
    expect(right(PROP_BOX['reference-shelf'])).toBeLessThanOrEqual(116)
    // fix round 1: the reference shelf stands in front of the bookshelf's right side, above the desk top (y 98)
    expect(PROP_BOX['reference-shelf'].x).toBeGreaterThanOrEqual(PROP_BOX.bookshelf.x)
    expect(PROP_BOX['reference-shelf'].y + PROP_BOX['reference-shelf'].h).toBeLessThanOrEqual(98)
    // the coffee machine on the sill: clear of the trophies (x 194), the pane's middle bar (x 203) and its cross bar
    // (y 63-64), above the sill (y 81)
    const coffee = PROP_BOX['coffee-machine']
    expect(right(coffee)).toBeLessThanOrEqual(194)
    expect(coffee.y).toBeGreaterThan(64)
    expect(coffee.y + coffee.h).toBe(81)
    // the zabuton and the book stack stay inside the phone crop (x 24-296) and clear of the bin (x 232)
    for (const id of ['zabuton', 'books'] as const) {
      expect(PROP_BOX[id].x, id).toBeGreaterThanOrEqual(24)
      expect(right(PROP_BOX[id]), id).toBeLessThanOrEqual(PROP_BOX.bin.x)
    }
    expect(right(PROP_BOX.sofa)).toBeLessThanOrEqual(PROP_BOX.bin.x)
    expect(PROP_BOX.desk.x).toBeLessThanOrEqual(121)
    expect(right(PROP_BOX.desk)).toBeGreaterThanOrEqual(170)
  })

  /**
   * Each prop and a scene that shows it: the door is the apartment's, the doorway the flat's and the loft's; a piece of
   * equipment shows only when owned; each front-row piece in its tier, the bin in all three.
   */
  const own = (id: keyof typeof NO_EQUIPMENT): Partial<Snapshot> => ({ owned: { ...NO_EQUIPMENT, [id]: true } })
  const CASES: [ScenePropId, Partial<Snapshot>][] = [
    ['window', {}], ['door', {}], ['doorway', { tier: 'flat' }], ['doorway', { tier: 'loft' }], ['kitchenette', {}],
    ['bookshelf', {}], ['bed', {}], ['poster', {}],
    ['desk', {}], ['drafting-table', own('drafting-table')], ['chair', {}], ['tall-chair', own('chair')],
    ['arm-lamp', own('lamp')], ['reference-shelf', own('shelf')], ['coffee-machine', own('coffee')],
    ['zabuton', {}], ['boxes', {}], ['fern', { tier: 'flat' }], ['books', { tier: 'flat' }],
    ['floor-lamp', { tier: 'loft' }], ['sofa', { tier: 'loft' }], ['bin', {}], ['bin', { tier: 'flat' }], ['bin', { tier: 'loft' }],
  ]
  /** The front row and the desks: a ready sprite moves its contact shadow across itself (same fill count). */
  const SHADOWED: readonly ScenePropId[] = ['desk', 'drafting-table', 'zabuton', 'boxes', 'fern', 'books', 'floor-lamp', 'sofa', 'bin']

  it("draws each ready prop at its sprite's box, in its fallback's place in the draw order, skipping its fallback fills (all inside the old footprint)", () => {
    for (const t of [0.3, 0.9]) {
      for (const [id, over] of CASES) {
        const label = `${id} ${over.tier ?? 'apartment'} t ${t}`
        const plain = paint(over, t)
        const art = paint(over, t, withProp(id, fakeImage(id, 1, 1)))
        const box = PROP_FOOTPRINT[id]
        expect(art.images, label).toHaveLength(1)
        const { at } = art.images[0]
        expect(art.images[0], label).toEqual({ id, ...PROP_BOX[id], at })
        const skipped = plain.log.length - art.log.length
        expect(skipped, label).toBeGreaterThan(0)
        // the same fills in the same order before and after; the skipped block lies inside the footprint
        // a ready door or doorway also moves the doormat and the doorway's night light onto its sprite (same fill counts;
        // studioArt.test checks where they go), so those are compared by style only
        // (a ready bookshelf likewise widens its contact shadow onto its sprite)
        // (and a ready desk or front-row piece its own shadow, a ready arm lamp its bulb)
        const moved = (c: FillCall) => (SHADOWED.includes(id) && c.style === 'rgba(40, 24, 16, 0.28)') ||
          (id === 'arm-lamp' && c.style === '#fff2a8') ||
          (id === 'bookshelf' && c.style === 'rgba(40, 24, 16, 0.28)' && c.y === 114 && c.x >= 64 && c.x < 74) || (id === 'door' || id === 'doorway') && (
          (c.style === '#c94b4b' && c.y === 114 && c.h === 3) || (c.style === '#a83c3c' && c.y === 115 && c.h === 1) ||
          c.style === 'rgba(255,214,150,0.12)' || c.style === 'rgba(255,214,150,0.35)')
        const sameFill = (c: FillCall) => (moved(c) ? { style: c.style } : c)
        expect(art.log.slice(0, at).map(sameFill), label).toEqual(plain.log.slice(0, at).map(sameFill))
        expect(art.log.slice(at).map(sameFill), label).toEqual(plain.log.slice(at + skipped).map(sameFill))
        for (const c of plain.log.slice(at, at + skipped)) {
          const inside = c.x >= box.x && c.y >= box.y && c.x + c.w <= box.x + box.w && c.y + c.h <= box.y + box.h
          expect(inside, `${label} ${JSON.stringify(c)}`).toBe(true)
        }
      }
    }
  })

  it('keeps the bed image under the sleeping mangaka and the window image under the sky', () => {
    const table = newActorTable()
    Object.assign(table.mangaka, { x: 216, y: 106, targetX: 216, targetY: 106, state: 'sleeping', goal: 'sleeping' })
    const bed = paint({ activity: 'rest', phase: 'idle', actors: table }, 0.3, withProp('bed', fakeImage('bed', 1, 1)))
    const blanket = covers(bed.log, '#c94b4b', 200, 116)
    expect(blanket).toBeGreaterThan(-1)
    expect(bed.images[0].at).toBeLessThanOrEqual(blanket)
    const win = paint({}, 0.3, withProp('window', fakeImage('window', 1, 1)))
    expect(win.images[0].at).toBeLessThanOrEqual(covers(win.log, skyColor(0.3), 200, 60))
  })

  it('draws a prop image only where its piece shows: no door in the flat, no stock poster under a serial or an anime', () => {
    expect(paint({ tier: 'flat' }, 0.3, withProp('door', fakeImage('door', 1, 1))).images).toEqual([])
    expect(paint({ tier: 'apartment' }, 0.3, withProp('doorway', fakeImage('doorway', 1, 1))).images).toEqual([])
    expect(paint({ serialOn: true }, 0.3, withProp('poster', fakeImage('poster', 1, 1))).images).toEqual([])
    expect(paint({ animePoster: true }, 0.3, withProp('poster', fakeImage('poster', 1, 1))).images).toEqual([])
  })

  it("falls back to a prop's own fills while its image is still loading", () => {
    const plain = paint({}, 0.3)
    const art = paint({}, 0.3, withProp('bed', loadingImage('bed')))
    expect(art.images).toEqual([])
    expect(art.log).toEqual(plain.log)
  })
})

describe('furniture, equipment and the front row as sprites (0.10.0 P1)', () => {
  const NONE = NO_EQUIPMENT
  const ALL = { coffee: true, lamp: true, shelf: true, chair: true, 'drafting-table': true, tablet: true }
  const SHADOW = 'rgba(40, 24, 16, 0.28)'
  /** The seated mangaka at MANGAKA_SEAT (24x32 at 132, 67), mood overlay included. */
  const SEATED = { x0: 132, x1: 155, y0: 67, y1: 98 }
  function paint(over: Partial<Snapshot>, t = 0.3, art: SceneArt = fakeSceneArt()) {
    const f = fakeContext()
    render(f.ctx, sceneSnapshot(over), t, 100, art)
    return f
  }
  const imageAt = (images: readonly { id: string; at: number }[], id: string) => {
    const i = images.find((x) => x.id === id)
    expect(i, id).toBeDefined()
    return i!.at
  }

  it('draws seat 3 page and its ink lines after the drafting table sprite that overlaps them, and keeps the old order otherwise', () => {
    const crew = [{ look: 0, stamina: 80 }, { look: 1, stamina: 80 }, { look: 2, stamina: 80 }]
    const owned = { ...NONE, 'drafting-table': true }
    const isPage = (f: FillCall) => f.style === '#fdfcf7' && f.x === 109 && f.y === 120 && f.w === 6 && f.h === 4
    const isLine = (f: FillCall) => f.style === '#b8b2a5' && f.x === 110 && f.w === 4 && f.h === 1 && f.y >= 121
    const { log, images } = paint({ owned, assistants: crew, progress: 1 })
    const d = imageAt(images, 'drafting-table')
    const page = log.findIndex(isPage)
    expect(page).toBeGreaterThanOrEqual(d)
    log.forEach((f, i) => { if (isLine(f)) expect(i).toBeGreaterThanOrEqual(d) })
    expect(log.filter(isLine)).toHaveLength(3)
    // the desk image is drawn once, so nothing of it lands after the page
    expect(images.filter((im) => im.id === 'drafting-table')).toHaveLength(1)
    // the drafting table still loading: pages before the (code-drawn) desk, as before
    const loading = { ...fakeSceneArt(), prop: { ...fakeSceneArt().prop, 'drafting-table': null } }
    const old = paint({ owned, assistants: crew, progress: 1 }, 0.3, loading)
    expect(old.log.findIndex(isPage)).toBeGreaterThan(-1)
    expect(old.log.findIndex(isPage)).toBeLessThan(old.log.findIndex((f) => f.style === '#fdfcf7' && f.x === 121))
  })

  it('draws the chair before the seated mangaka and the desk after him, before the pages, the stock pieces and the owned ones alike', () => {
    for (const [owned, chair, desk] of [[NONE, 'chair', 'desk'], [ALL, 'tall-chair', 'drafting-table']] as const) {
      const { log, images } = paint({ owned })
      const c = imageAt(images, chair)
      const d = imageAt(images, desk)
      // everything painted between the chair and the desk is the seated mangaka
      const between = log.slice(c, d)
      expect(between.length, chair).toBeGreaterThan(40)
      for (const f of between) {
        const inside = f.x >= SEATED.x0 && f.x + f.w <= SEATED.x1 + 1 && f.y >= SEATED.y0 && f.y + f.h <= SEATED.y1 + 1
        expect(inside, `${chair}: ${JSON.stringify(f)}`).toBe(true)
      }
      // the page stack (x 121, on the desk top at y 98) goes on after the desk
      const pages = log.findIndex((f) => f.style === '#fdfcf7' && f.x === 121 && f.y + f.h === 98)
      expect(pages, desk).toBeGreaterThanOrEqual(d)
      // the lamp after the desk
      if (owned === ALL) expect(imageAt(images, 'arm-lamp')).toBeGreaterThanOrEqual(d)
    }
  })

  it('draws an owned piece in place of the stock one, and an unowned piece not at all', () => {
    const ids = (owned: typeof NONE) => paint({ owned }).images.map((i) => i.id)
    const stock = ids(NONE)
    expect(stock).toContain('desk')
    expect(stock).toContain('chair')
    for (const id of ['drafting-table', 'tall-chair', 'arm-lamp', 'reference-shelf', 'coffee-machine']) expect(stock).not.toContain(id)
    const all = ids(ALL)
    for (const id of ['drafting-table', 'tall-chair', 'arm-lamp', 'reference-shelf', 'coffee-machine']) expect(all).toContain(id)
    expect(all).not.toContain('desk')
    expect(all).not.toContain('chair')
    expect(ids({ ...NONE, 'drafting-table': true })).toEqual(expect.arrayContaining(['drafting-table', 'chair']))
    expect(ids({ ...NONE, 'drafting-table': true })).not.toContain('desk')
    expect(ids({ ...NONE, chair: true })).toEqual(expect.arrayContaining(['tall-chair', 'desk']))
    expect(ids({ ...NONE, chair: true })).not.toContain('chair')
  })

  it("draws each tier's own front row, after every actor, and the bin in all three", () => {
    const FRONT: Record<StudioTierId, string[]> = {
      apartment: ['zabuton', 'boxes', 'bin'], flat: ['fern', 'books', 'bin'], loft: ['floor-lamp', 'sofa', 'bin'],
    }
    for (const tier of ['apartment', 'flat', 'loft'] as StudioTierId[]) {
      const { log, images } = paint({ tier })
      expect(images.slice(-3).map((i) => i.id), tier).toEqual(FRONT[tier])
      // the cat sleeps on its cushion before the front row
      expect(covers(log, '#c9a24a', 200, 122), tier).toBeLessThan(images[images.length - 3].at)
    }
  })

  it("lays each front-row piece's and the desk's contact shadow across its sprite once the image is ready", () => {
    const shadowUnder = (log: readonly FillCall[], b: { x: number; y: number; w: number; h: number }) =>
      log.some((f) => f.style === SHADOW && f.x === b.x && f.y === b.y + b.h && f.w === b.w && f.h === 2)
    const cases: [ScenePropId, Partial<Snapshot>][] = [
      ['zabuton', {}], ['boxes', {}], ['bin', {}], ['fern', { tier: 'flat' }], ['books', { tier: 'flat' }],
      ['floor-lamp', { tier: 'loft' }], ['sofa', { tier: 'loft' }], ['desk', {}],
      ['drafting-table', { owned: { ...NONE, 'drafting-table': true } }],
    ]
    for (const [id, over] of cases) expect(shadowUnder(paint(over).log, PROP_BOX[id]), id).toBe(true)
    // the desk's: under its sprite's feet (y 131), the drafting table's (y 130); the code-drawn desk's at y 118
    expect(shadowUnder(paint({}).log, { x: 116, y: 131, w: 58, h: 0 })).toBe(true)
    expect(shadowUnder(paint({ owned: { ...NONE, 'drafting-table': true } }).log, { x: 108, y: 130, w: 68, h: 0 })).toBe(true)
    const bare = paint({}, 0.3, NO_ART).log
    expect(shadowUnder(bare, { x: 116, y: 118, w: 58, h: 0 })).toBe(true)
    // the drafting table owned but its image still loading: the old shadow, as today
    const loading = { ...fakeSceneArt(), prop: { ...fakeSceneArt().prop, 'drafting-table': null } }
    expect(shadowUnder(paint({ owned: { ...NONE, 'drafting-table': true } }, 0.3, loading).log, { x: 116, y: 118, w: 58, h: 0 })).toBe(true)
  })

  it("stands the stamina cups in the desk sprite's open knee hole (y 126) once it is ready, else where they were (y 120)", () => {
    const CUP = '#f2efe6'
    const cups = (log: readonly FillCall[]) => log.filter((f) => (f.style === CUP || f.style === '#5a3618') && f.x >= 136 && f.x <= 150 && f.y >= 120 && f.y <= 130)
    const tables: [string, Partial<Snapshot>][] = [['desk', {}], ['drafting-table', { owned: { ...NONE, 'drafting-table': true } }]]
    for (const [desk, over] of tables) {
      const low = { ...over, stamina: 10 }
      const plain = cups(paint(low, 0.3, NO_ART).log)
      const art = cups(paint(low).log)
      expect(plain, desk).toHaveLength(9)
      expect(art, desk).toHaveLength(9)
      expect(Math.min(...plain.map((f) => f.y)), desk).toBe(120)
      expect(art.map((f) => f.y - 6), desk).toEqual(plain.map((f) => f.y))
      // between the legs: inside the sprite's columns, below its apron, above its feet
      const b = PROP_BOX[desk as ScenePropId]
      for (const f of art) {
        expect(f.x >= b.x + 19 && f.x + f.w <= b.x + 46, `${desk} ${JSON.stringify(f)}`).toBe(true)
        expect(f.y + f.h <= b.y + b.h, `${desk} ${JSON.stringify(f)}`).toBe(true)
      }
    }
    // the drafting table owned but its image still loading: the cups stay at y 120
    const loading = { ...fakeSceneArt(), prop: { ...fakeSceneArt().prop, 'drafting-table': null } }
    const stay = cups(paint({ owned: { ...NONE, 'drafting-table': true }, stamina: 10 }, 0.3, loading).log)
    expect(Math.min(...stay.map((f) => f.y))).toBe(120)
  })

  it('keeps the crumpled pages code-drawn, above the bin sprite, while drawing', () => {
    const { log, images } = paint({ progress: 0.9 })
    const bin = imageAt(images, 'bin')
    const pages = log.filter((f, i) => f.style === '#fdfcf7' && f.y >= 151 && f.y <= 152 && f.x >= 234 && i <= bin)
    expect(pages).toHaveLength(3)
  })
})
