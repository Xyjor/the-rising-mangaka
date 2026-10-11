// The scene's render is a pure function of (snapshot, time of day, frame) onto a 2D context: no DOM needed, so this
// runs in the default node environment against the recording context from src/test/fakeCanvas.ts.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { covers, coversAny, fakeContext, fakeImage, fakeSceneArt, sceneSnapshot } from '../../../test/fakeCanvas'
import type { FillCall, ImageCall } from '../../../test/fakeCanvas'
import type { StudioTierId } from '../../../sim'
import { H, PROP_BOX, PROP_FOOTPRINT, SKY_LUT, W, assistantDesk, poseOrigin, render, skyColor } from '../render'
import type { Snapshot } from '../render'
import { TIER_FLOOR, drawRoomShell } from '../roomArt'
import { DOORWAY_BOX, DOOR_BOX, NO_EQUIPMENT } from '../studioArt'
import { DESK_PROPS, NO_ART, PROP_ALIGN, PROP_MIN_H, PROP_SPRITE, ROOM_NIGHT_DIM, fitDesk, fitSprite, hangSprite, placeSprite, ready } from '../sceneArt'
import type { SceneArt, ScenePropId } from '../sceneArt'
import type { Season } from '../season'
import { CAT_BED, MANGAKA_BED, MANGAKA_BED_FRAME, MANGAKA_SEAT, newActorTable, planActors, setRigLive, settleActors } from '../actors'
import { ANIMS } from '../rig/anims'
import { rigFrame } from '../rig/frames'
import { MARK_ART } from '../rig/head'
import type { Actor, ActorTable } from '../actors'

/** The image a render drew at (x, y) from the sprite cache, if any. */
const castAt = (images: readonly ImageCall[], x: number, y: number) => images.find((i) => i.id.startsWith('cast/') && i.x === x && i.y === y)
/** Every image but the cast's (the generated room and props). */
const artOnly = (images: readonly ImageCall[]) => images.filter((i) => !i.id.startsWith('cast/'))

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
 * sprites' 1x1 pixels became runs (the hero, the assistant, the clock and the cat). Task B (0.2.1) re-measured it the same way at 430: the mangaka a 24x32 sprite and the stock chair's new back. Task C (0.2.1) re-measured it the same way at 596: the assistant a 24x32 seated frame, its stool and the page's wider lines, the cat's 12x8 sleeping frame. Upgrade 0.3.0 re-measured it the same way at 649: the tatami room 61 in place of the striped room's 58 (+3), five floor shadows and the staff desk's (+6), the corkboard 10 (board 2, four cards at 2), the calendar 7, the apartment's front row 12 and the bin 7 (5 and two crumpled pages), and the light 8 (the daylight shaft 4, the vignette 4). Upgrade 0.4.0's chibi cast (Task 6) re-measured it the same way at 659 (+10): redrawing MANGAKA_SIT[0] to the chibi proportions (an 18-wide, 16-row head in place of the old frame's narrower crown) costs 5 more fillRect runs than the old frame, and the reference scene paints two seated figures from that map at frame 100 (the mangaka and its one assistant, both landing on index 0: `floor(100/8)%2` for the mangaka, `floor((100+0*3)/8)%2` for the assistant) — 5 + 5 = 10. The mood overlay adds nothing here: the reference scene's mood is neutral (home, no editor, no cheer, stamina 80), and `drawMood` returns early for `neutral`. Upgrade 0.5.0 Task 6.1 re-measured it the same way at 659 (+0): the daylight shaft keeps its four steps, each now wider and fainter. Upgrade 0.5.0 Task 6.2 re-measured it the same way at 659 (+0): the wood-beam frame is the flat's and the loft's, and this scene is the apartment. Upgrade 0.5.0 Task 6.3 re-measured it the same way at 665 (+6): the reference scene is spring, and the cherry now spills past the pane onto the wall (`drawSeasonWall`: a branch, a twig and four blossom clusters, 6 fills). Upgrade 0.5.0 Task 6.4 re-measured it the same way at 663 (-2): the corkboard pins a card per sixth of the pages (a 2x3 grid), so half the pages drawn shows 3 cards in place of 4, at 2 fills each. Upgrade 0.5.0 Task 6.5 re-measured it the same way at 667 (+4): the cat sleeps on a round cushion (4 fills: its top, body, rim and bottom); its cream chest patch is only in the frames where the chest shows, never the curled `CAT_SLEEP` this scene draws. Upgrade 0.5.0 Task 6.6 re-measured it the same way at 667 (+0): `MANGAKA_PANIC`'s hands-on-head redraw only paints while a chapter is late, and this scene is not. Upgrade 0.5.0 Task 6.7 re-measured it the same way at 667 (+0): the mood marks move to the head's top-right edge (x+20, y-2), and this scene's neutral mood draws none. Upgrade 0.5.0 Task 6.8 re-measured it the same way at 673 (+6): the collar (K) and tie (Y/y) split each `MANGAKA_SIT` frame's neckline into 3 more runs (row 16 +1, the collar points on row 17 +2; the tie keeps the stripe's run count), and this scene draws two seated figures (the mangaka and its assistant): 3 + 3 = 6. drawSprite merges runs by key, so the hoodie's K painted in J's colour still costs its own fills. Upgrade 0.9.0 Task B3 re-measured it the same way at 693 (+20): MANGAKA_SIT[0] goes from 184 to 194 runs (task B3's seat on task B1's standing body: rows 17-19 +7, each sleeve its own j run seamed from the torso by an L with the V narrowing to RYR between them; rows 20-22 -3, the old frame's W/y stripe cells gone from the plain Y drawstring column; row 23 +2, the forearm's transparent gap splitting the outline run (+1) and the new j cell (+1); rows 28-29 +4, the shins L,F,f,L under the knee in place of one L line and the thighs' bottom outline), and this scene draws two seated figures from that map at frame 100 (the mangaka and its assistant, both landing on index 0): 10 + 10 = 20. Upgrade 0.9.0 Task B5 re-measured it the same way at 701 (+8): CAT_SLEEP goes from 31 to 39 runs (two stripes down the curled back, `c` between fur at cols 5 and 8 on rows 4-5: each row's one fur run splits into fur, stripe, fur, stripe, fur, +4 a row), and every reference scene draws the cat asleep on its cushion. Upgrade 0.11.0 Task 6 re-measured it the same way at 274 (-427): every character is one drawImage from the sprite cache (spriteCache.ts) now, so its runs leave the fill log: the seated mangaka and the assistant from MANGAKA_SIT[0] (194 runs each) and the cat asleep, CAT_SLEEP (39): 701 - 194 - 194 - 39 = 274, three drawImage calls in their place. Upgrade 0.11.0 Task 17 re-measured it the same way at 274 (+0): the mangaka draws from the rig only, seat-draw's first frame at (124, 58) and its rows 0-39 again over the page stack (two drawImage calls in place of MANGAKA_SIT[0]'s one), and this scene's mood is neutral, so no overlay leaves the log. Upgrade 0.11.0 Task 19 re-measured it the same way at 273 (-1): the assistant draws from the rig only, seat-draw's first frame at the 0.11 seat (21, 80) in its look (one drawImage in place of MANGAKA_SIT[0]'s), and the 0.10 row's stool (one 10x4 fill at the seat + 7, y 118) goes, since a 32x48 seated body covers it; the assistant's mood is neutral, so `drawMood` (gone) took nothing out; its desk (2 fills and the shadow 1) and its page 3 move after the main desk group, the same count: 274 - 1 = 273. Every scene must stay under 1.5 times this.
 */
const BASELINE_FILLS = 273
const BUDGET = BASELINE_FILLS * 1.5

/**
 * fillRect calls for the same reference scene with every generated image ready (`fakeSceneArt`: the apartment's room
 * image and its six props, 7 drawImage calls), measured the same way (0.9.0 R2): 546. By hand, the 673 less what the
 * images replace: the apartment's shell 61, the kitchenette 17, the window frame 1, the bookshelf 34, the stock poster
 * 4, the bed 5 and the plain door 5 (673 - 127 = 546). The night dim adds 1 at night. 0.10.0 P1 re-measured it the
 * same way at 521 (-25, 14 drawImage calls): the stock chair 4 and the stock desk 7, and the apartment's front row, the
 * zabuton 4, the boxes 6 and the bin 4 (each piece's contact shadow is still one fill, moved across its sprite, and the
 * bin's crumpled pages stay code-drawn): 546 - 25 = 521. Upgrade 0.9.0 Task B3 re-measured it the same way at 541
 * (+20): the two seated figures from MANGAKA_SIT[0], 184 to 194 runs each, as the 693's +20 (the images replace no
 * sprite): 521 + 20 = 541. Upgrade 0.9.0 Task B5 re-measured it the same way at 549 (+8): CAT_SLEEP 31 to 39, as the
 * 701's +8 (the images replace no sprite): 541 + 8 = 549. Upgrade 0.10.0 Task C0 re-measured it the same way at 584
 * (+35): the room image is the wall alone now, and the apartment's code-drawn floor paints under it (`TIER_FLOOR`: the
 * tatami fill 1, the weave lines every 3 px from y 117, 21, the three heri 3 and the staggered seams 5 + 5): 549 + 35 =
 * 584. Upgrade 0.11.0 Task 6 re-measured it the same way at 157 (-427, 15 drawImage calls: the 12 images and the 3 characters): the
 * same 427 as the 274's (the images replace no sprite): 584 - 194 - 194 - 39 = 157. Upgrade 0.11.0 Task 17 re-measured it
 * the same way at 157 (+0, 16 drawImage calls: the seated rig mangaka's rows 0-39 go on a second time), as the 274's.
 * Upgrade 0.11.0 Task 19 re-measured it the same way at 156 (-1), as the 273's: the assistant's stool goes (the images
 * replace no stool): 157 - 1 = 156. Every scene with the art ready must stay under 1.5 times this (234; its own budget:
 * the images leave fewer fills, so 273's budget would hide growth).
 */
const ART_BASELINE_FILLS = 156
const ART_BUDGET = ART_BASELINE_FILLS * 1.5

/**
 * fillRect calls for the worst scene of the art loop (every tier, season and time of day with every generated image
 * ready): the flat in spring at night, `sceneSnapshot({ tier: 'flat', season: 'spring' })` at t = 0.9 and frame 100:
 * 235 (Upgrade 0.11.0 Task 6, measured the same way by rendering it into the recording context and reading
 * `log.length`). ART_BASELINE_FILLS' 157 is the apartment by day, so once the characters' runs left the fill log the
 * loop's old budget, 235.5, was cleared by half a fill: this scene has its own pin. By hand, against the 157: the flat's
 * code-drawn wall and floor 83 (it has no room image since 0.10.1) in place of the apartment's floor 35 under its
 * image, +48; and the night, +30: the stars 9 and the moon 2 in place of the sun 1 (+10), the sleepy face 12 and its
 * mark 5 on the working mangaka (+17), the night overlay 1 and the working glow 1 (+2), the lamp pool 3 in place of the
 * daylight shaft's 4 (-1) and the lit doorway's halo and spill 2 (+2); no room-image dim, since the flat has no image
 * (the apartment at night is 157 + 29 = 186, with that dim and no doorway light): 157 + 48 + 30 = 235. The same
 * scene by day is 205, the loft at night 185. Upgrade 0.11.0 Task 17 re-measured it the same way at 218 (-17): the
 * working mangaka is the rig's seat-draw frame, its sleepy face and mark baked in (`~closed.closed.zee`), so the 0.10
 * overlay's face 12 and mark 5 leave the fill log: 235 - 17 = 218. The same scene by day is still 205 (neutral, no
 * overlay), the loft at night 168 and the apartment at night 169 (each -17 too). Upgrade 0.11.0 Task 19 re-measured it
 * the same way at 217 (-1): the one assistant's stool goes, a 32x48 seated rig body covering it; its mood overlay took
 * nothing out (the assistant is neutral here: stamina 80, no cheer, and assistants never go sleepy), so `drawMood`'s
 * removal is 0: 218 - 1 = 217. The same scene by day is 204, the loft at night 167 and the apartment at night 168 (each
 * -1). Every scene in the loop must stay under 1.5 times this (325.5).
 */
const ART_WORST_FILLS = 217
const ART_WORST_BUDGET = ART_WORST_FILLS * 1.5

/**
 * fillRect calls for the rest scene (`sceneSnapshot({ activity: 'rest' })`: the reference scene on a rest day, the
 * assistant dozing at the desk under the generated ASSISTANT_DOZE, 0.11.0) at t = 0.3 and frame 100, measured the same
 * way: 509. By hand, from the 673: the seated mangaka goes to bed (MANGAKA_SIT[0] 184 out; MANGAKA_LIE 72, the blanket
 * and its fold 2 and frame 100's three Zs at 9 each, 101 in), the cat leaves its cushion for the kitchen (the cushion
 * 4 and CAT_SLEEP 31 out; frame 100 is catFrame's sit, CAT_SIT 34 in), the assistant dozes (MANGAKA_SIT[0] 184 and its
 * page 3 out; ASSISTANT_DOZE 100 and its Z 9 in), and nobody works (the lamp's glow and the mug's steam, 2 out):
 * 673 - 184 + 101 - 35 + 34 - 187 + 109 - 2 = 509. Upgrade 0.9.0 Task B3 re-measured it the same way at 500 (-9):
 * ASSISTANT_DOZE goes from 100 to 91 runs (the manifest's remap of its folded arms' J to j, sleeves, merges the J and j
 * runs on rows 27-30: -1, -2, -3, -3), MANGAKA_LIE keeps 72 (its j shoulder band, J body and j underside are one run a
 * row, as the old J and j rows were) and CAT_SIT 34; the seated frame this scene replaces is the redrawn one (194,
 * with its page 3): 693 - 194 + 101 - 35 + 34 - 197 + 100 - 2 = 500. Upgrade 0.9.0 Task B5 re-measured it the same way
 * at 506 (+6): the cushion and the redrawn CAT_SLEEP (39) leave together, 43 out, and CAT_SIT goes from 34 to 40 (row 3
 * +1, the eye a column forward with the cream muzzle in front of it, L,Q,E,C,c,L in place of L,CC,E,c,L; row 5 +3, two
 * stripes hang from the back, L,QQ,C,c,C,c,C,LL in place of L,QQ,CCCC,c,LL; row 6 +2, the first stripe reaching the
 * belly): 701 - 194 + 101 - 43 + 40 - 197 + 100 - 2 = 506. Upgrade 0.11.0 Task 6 re-measured it the same way at 303 (-203): the mangaka in bed (MANGAKA_LIE 72), the cat sitting
 * (CAT_SIT 40) and the dozing assistant (ASSISTANT_DOZE 91) are drawImage calls now and their runs leave the fill log;
 * the blanket and its fold 2, frame 100's three Zs 27 and the doze's Z 9 stay fills: 506 - 72 - 40 - 91 = 303. Upgrade
 * 0.11.0 Task 17 re-measured it the same way at 303 (+0): the mangaka in bed is the rig's bed.lie-0 (one drawImage at
 * the bed frame's origin (201, 90) in place of MANGAKA_LIE's), its blanket and fold still 2 fills (now from (196, 112),
 * 29 wide) and frame 100's three Zs still 27, from the bed frame's (36, 2). Upgrade 0.11.0 Task 19 re-measured it the
 * same way at 302 (-1): the dozing assistant is the rig's key.doze-0 at the 0.11 seat (21, 80) (one drawImage in place
 * of ASSISTANT_DOZE's), its Z still 9 fills (now at the seat's (25, 11)), and the 0.10 stool's one fill goes: 303 - 1 =
 * 302. Every rest scene must stay under 1.5 times this (453).
 */
const REST_BASELINE_FILLS = 302
const REST_BUDGET = REST_BASELINE_FILLS * 1.5

describe('render', () => {
  it('paints every pixel from a palette (an unknown sprite key would paint magenta)', () => {
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 100)
    expect(log.length).toBeGreaterThan(0)
    expect(log.some((c) => c.style === '#f0f')).toBe(false)
  })

  it('keeps every fillRect and every drawn image inside the 320x180 canvas', () => {
    expect([W, H]).toEqual([320, 180])
    for (const t of [0.3, 0.9]) {
      const { ctx, log, images } = fakeContext()
      render(ctx, sceneSnapshot(), t, 100)
      for (const c of log) {
        expect(c.x).toBeGreaterThanOrEqual(0)
        expect(c.y).toBeGreaterThanOrEqual(0)
        expect(c.x + c.w).toBeLessThanOrEqual(320)
        expect(c.y + c.h).toBeLessThanOrEqual(180)
      }
      expect(images.length).toBeGreaterThan(0)
      for (const i of images) expect(i.x >= 0 && i.y >= 0 && i.x + i.w <= 320 && i.y + i.h <= 180, JSON.stringify(i)).toBe(true)
    }
  })

  it("draws the reference scene's three characters from the cache where they stand, the seated mangaka's top rows twice", () => {
    const ref = fakeContext()
    render(ref.ctx, sceneSnapshot(), 0.3, 100)
    // the seated rig mangaka is two images: the frame, then its rows 0-39 (32x40) over the page stack
    // before the main desk, the assistant (from the rig, at the 0.11 seat) after the desk group
    expect(ref.images.map(({ id, x, y, w, h }) => [id, x, y, w, h])).toEqual([
      ['cast/seat.draw-a~open.closed.none/pal', 124, 58, 32, 48], ['cast/seat.draw-a~open.closed.none/pal', 124, 58, 32, 40],
      ['cast/seat.draw-a~open.closed.none/look0', 21, 80, 32, 48], ['cast/cat.sleep/pal', 202, 118, 12, 8],
    ])
    // the assistants' block after the desk group, the sleeping mangaka in the front pass after it, then the cat
    const rest = fakeContext()
    render(rest.ctx, sceneSnapshot({ activity: 'rest' }), 0.3, 100)
    expect(rest.images.map((i) => i.id)).toEqual(['cast/key.doze-0/look0', 'cast/bed.lie-0/pal', 'cast/cat.sit/pal'])
    // the bed frames wear the level's outfit too
    const blazer = fakeContext()
    render(blazer.ctx, sceneSnapshot({ activity: 'rest', level: 10 }), 0.3, 100)
    expect(castAt(blazer.images, 201, 90)?.id).toBe('cast/bed.lie-0/blazer')
  })

  it("paints the tier's wall and floor across the whole canvas, first", () => {
    for (const tier of ['apartment', 'flat', 'loft'] as const) {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot({ tier }), 0.3, 100)
      expect(log[0], tier).toMatchObject({ x: 0, y: 0, w: 320, h: 114 })
      expect(log.some((c) => c.x === 0 && c.y === 114 && c.w === 320 && c.h === 66), tier).toBe(true)
    }
  })

  it('stays under 1.5 times its own measured worst case with every generated image ready, in every tier and season', () => {
    expect(ART_BUDGET).toBe(234)
    const ref = fakeContext()
    render(ref.ctx, sceneSnapshot(), 0.3, 100, fakeSceneArt())
    expect(ref.log).toHaveLength(ART_BASELINE_FILLS)
    expect(ref.images.map((i) => i.id)).toEqual([
      'room/apartment', 'kitchenette', 'window', 'bookshelf', 'poster', 'bed', 'door', 'chair',
      'cast/seat.draw-a~open.closed.none/pal', 'desk', 'cast/seat.draw-a~open.closed.none/pal', 'cast/seat.draw-a~open.closed.none/look0',
      'cast/cat.sleep/pal', 'zabuton', 'boxes', 'bin',
    ])
    // the loop's worst scene has its own pin (the flat in spring at night, ART_WORST_FILLS), and the loop is held to 1.5
    // times that
    expect(ART_WORST_BUDGET).toBe(325.5)
    const worst = fakeContext()
    render(worst.ctx, sceneSnapshot({ tier: 'flat', season: 'spring' }), 0.9, 100, fakeSceneArt())
    expect(worst.log).toHaveLength(ART_WORST_FILLS)
    let most = 0
    for (const tier of ['apartment', 'flat', 'loft'] as StudioTierId[]) {
      for (const season of ['spring', 'summer', 'autumn', 'winter'] as Season[]) {
        for (const t of [0.3, 0.9]) {
          const { ctx, log } = fakeContext()
          render(ctx, sceneSnapshot({ tier, season }), t, 100, fakeSceneArt())
          expect(log.length, `${tier} ${season} t ${t}`).toBeLessThan(ART_WORST_BUDGET)
          most = Math.max(most, log.length)
        }
      }
    }
    // no other scene has overtaken the pinned one
    expect(most).toBe(ART_WORST_FILLS)
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
    expect(b.images).toEqual(a.images)
  })

  it('stays under 1.5 times the measured baseline of fillRect calls in every season, by day and by night', () => {
    expect(BUDGET).toBe(409.5)
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
    expect(REST_BUDGET).toBe(453)
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
  function paintWith(table: ActorTable, over = {}): { log: FillCall[]; images: ImageCall[] } {
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot({ ...over, actors: table }), 0.3, 0)
    return { log, images }
  }
  function walking(over: Partial<Actor>): ActorTable {
    const t = newActorTable()
    Object.assign(t.mangaka, { x: 150, y: 81, targetX: 100, targetY: 81, state: 'walking', goal: 'standing', facing: -1, anim: 0 }, over)
    return t
  }

  it('seats the mangaka at the desk in the reference scene, over the chair back and under the desk top', () => {
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 0)
    // seat (124, 58): the seated frame (seat-draw's first step), drawn after the chair back and before the desk top
    const hero = castAt(images, 124, 58)
    expect(hero?.id).toBe('cast/seat.draw-a~open.closed.none/pal')
    const chair = covers(log, '#4a4a55', 140, 90)
    expect(chair).toBeGreaterThan(-1)
    expect(chair).toBeLessThan(hero!.at)
    expect(covers(log, '#8b5a2b', 116, 98)).toBeGreaterThanOrEqual(hero!.at)
  })

  it('stands the mangaka beside the desk between projects, after the desk top', () => {
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'idle' }), 0.3, 0)
    const hero = castAt(images, 170, 81)
    expect(hero?.id).toBe('cast/stand.idle~open.closed.none/pal')
    const desk = covers(log, '#8b5a2b', 116, 98)
    expect(desk).toBeGreaterThan(-1)
    expect(hero!.at).toBeGreaterThan(desk)
    // the shadow under its feet (row 47, y 128) goes on first
    const under = log.findIndex((c) => c.style === 'rgba(40, 24, 16, 0.28)' && c.x === 176 && c.y === 127 && c.w === 20 && c.h === 2)
    expect(under).toBeGreaterThan(-1)
    expect(hero!.at).toBeGreaterThan(under)
  })

  it('walks the mangaka through the walk loop, mirrored when facing right', () => {
    // the pose the cast driver set; facing right is the mirrored surface; with none (a settled table), the loop's first step
    expect(castAt(paintWith(walking({ pose: 'walk.pass-l' })).images, 150, 81)?.id).toBe('cast/walk.pass-l~open.closed.none/pal')
    expect(castAt(paintWith(walking({ pose: 'walk.pass-l', facing: 1 })).images, 150, 81)?.id).toBe('cast/walk.pass-l~open.closed.none/pal/r')
    expect(castAt(paintWith(walking({})).images, 150, 81)?.id).toBe('cast/walk.contact-l~open.closed.none/pal')
  })

  it('opens the late loop on the panic', () => {
    const at = (late: boolean) => {
      const { ctx, images } = fakeContext()
      render(ctx, sceneSnapshot({ late }), 0.3, 0)
      return images
    }
    // a settled table shows its base loop's first step: seat-draw-late's is the panic (a key frame, its face its own)
    expect(castAt(at(true), 124, 58)?.id).toBe('cast/key.panic-0/pal')
    expect(castAt(at(false), 124, 58)?.id).toBe('cast/seat.draw-a~open.closed.none/pal')
  })

  it('shows the sleepy face and z mark for the seated, working mangaka late at night, but not during the day', () => {
    // the sleepy face (closed eyes, the zee mark) is baked into the seated frame: no outline fill in the mangaka's box
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot(), 0.9, 0)
    expect(castAt(images, 124, 58)?.id).toBe('cast/seat.draw-a~closed.closed.zee/pal')
    expect(log.some((c) => c.style === '#1c1a26' && c.x >= 124 && c.x <= 155 && c.y >= 58 && c.y <= 105)).toBe(false)

    const day = fakeContext()
    render(day.ctx, sceneSnapshot(), 0.3, 0)
    expect(castAt(day.images, 124, 58)?.id).toBe('cast/seat.draw-a~open.closed.none/pal')
  })

  function editorAt(facing: -1 | 1, over: Partial<Actor> = {}): ActorTable {
    const t = newActorTable()
    Object.assign(t.editor, { x: 198, y: 85, targetX: 198, targetY: 85, state: 'standing', goal: 'standing', facing }, over)
    return t
  }

  it('paints the editor at the spot, mirrored when facing right', () => {
    // (198, 85): standing, the first of the two idle frames at frame 0; facing right is the mirrored surface
    expect(castAt(paintWith(editorAt(-1), { visitor: 'editor' }).images, 198, 85)?.id).toBe('cast/editor.idle.0/pal')
    expect(castAt(paintWith(editorAt(1), { visitor: 'editor' }).images, 198, 85)?.id).toBe('cast/editor.idle.0/pal/r')
  })

  it('walks the editor with their own four frames', () => {
    // floor(anim / 100) % 4: the briefcase's bob on the pass frame is in the maps (sprites.test checks it)
    const walk = (anim: number) => paintWith(editorAt(-1, { state: 'walking', targetX: 150, anim }), { visitor: 'editor' })
    expect(castAt(walk(0).images, 198, 85)?.id).toBe('cast/editor.walk.0/pal')
    expect(castAt(walk(100).images, 198, 85)?.id).toBe('cast/editor.walk.1/pal')
    expect(castAt(walk(200).images, 198, 85)?.id).toBe('cast/editor.walk.2/pal')
  })

  it('puts the mangaka to bed to rest, the Zz rising over the pillow', () => {
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot({ activity: 'rest' }), 0.3, 0)
    // the actor lies at (220, 90); the bed's frames go at their own origin (201, 90): the lying frame, 48x32, then the
    // blanket over the shoulders after it; frame 0's one Z from the bed frame's (36, 2)
    expect(sceneSnapshot({ activity: 'rest' }).actors.mangaka).toMatchObject({ x: 220, y: 90, state: 'sleeping' })
    const lie = castAt(images, 201, 90)
    expect(lie).toMatchObject({ id: 'cast/bed.lie-0/pal', w: 48, h: 32 })
    const blanket = log.findIndex((c) => c.style === '#c94b4b' && c.x === 196 && c.y === 112 && c.w === 29 && c.h === 10)
    expect(blanket).toBeGreaterThanOrEqual(lie!.at)
    expect(has(log, '#2f5ecf', 238, 92)).toBe(true)
  })

  it('hands the editor their prop and bobs the ! above them while they stand facing left', () => {
    const at = (over: Parameters<typeof sceneSnapshot>[0], frame: number) => {
      const { ctx, log, images } = fakeContext()
      render(ctx, sceneSnapshot(over), 0.3, frame)
      return { log, images }
    }
    const env = at({ visitor: 'editor', visitorProp: 'envelope' }, 100)
    expect(castAt(env.images, 198, 85)).toBeDefined()
    // the envelope sprite at (198 - 2, 85 + 20) = (196, 105), the hand row 22's level: its corner, and row 1 col 2 paper
    expect(covers(env.log, '#1c1a26', 196, 105)).toBeGreaterThan(-1)
    expect(covers(env.log, '#fdfcf7', 198, 106)).toBeGreaterThan(-1)
    expect(covers(env.log, '#fdfcf7', 198, 105)).toBe(-1)
    // frame 100: floor(100 / 16) % 2 = 0, so the ! tops out at 85 - 8 = 77 from x 209, its stroke in the glyph's middle
    // column (x 210)
    expect(covers(env.log, '#e5484d', 210, 77)).toBeGreaterThan(-1)
    // the trophy at (198 - 2, 85 + 18) = (196, 103): row 1 col 2 is gold
    expect(covers(at({ visitor: 'editor', visitorProp: 'trophy' }, 100).log, '#f5b700', 198, 104)).toBeGreaterThan(-1)
    expect(covers(at({ visitor: 'editor', visitorProp: 'envelope' }, 16).log, '#e5484d', 210, 76)).toBeGreaterThan(-1)
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
  const full = (over: Parameters<typeof sceneSnapshot>[0], t = 0.3, frame = 100) => {
    const f = fakeContext()
    render(f.ctx, sceneSnapshot(over), t, frame)
    return f
  }
  const at = (over: Parameters<typeof sceneSnapshot>[0], t = 0.3, frame = 100) => full(over, t, frame).log
  const px = (style: string, x: number, y: number, w = 1, h = 1) => ({ style, x, y, w, h })
  const lines = (log: FillCall[]) => log.filter((c) => c.style === '#b8b2a5' && c.x === 25 && c.w === 4 && c.h === 1)
  const page = (log: FillCall[]) => log.findIndex((c) => c.style === '#fdfcf7' && c.x === 24 && c.y === 120 && c.w === 6 && c.h === 4)

  it('seats the assistant at (21, 80) after the main desk, then its desk, then the page on it', () => {
    const ref = full({})
    // the seated rig frame in the assistant's look, after the main desk's top (116, 98): the row is in front of it
    const a0 = castAt(ref.images, 21, 80)
    expect(a0?.id).toBe('cast/seat.draw-a~open.closed.none/look0')
    const main = covers(ref.log, '#8b5a2b', 116, 98)
    expect(main).toBeGreaterThan(-1)
    expect(a0!.at).toBeGreaterThan(main)
    // the assistants' desk top (from 2 px left of the seat, 36 wide) after the assistant, and the page after the desk
    const desk = ref.log.findIndex((c) => c.style === '#8b5a2b' && c.x === 19 && c.y === 120 && c.w === 36 && c.h === 3)
    expect(desk).toBeGreaterThanOrEqual(a0!.at)
    expect(page(ref.log)).toBeGreaterThan(desk)
    // progress 0.5: round(1.5) = 2 lines, at y 121 and 122
    expect(lines(ref.log).map((c) => c.y)).toEqual([121, 122])
    expect(lines(at({ progress: 1 })).map((c) => c.y)).toEqual([121, 122, 123])
    expect(lines(at({ progress: 0 }))).toHaveLength(0)
    const paused = at({ running: false })
    expect(page(paused)).toBe(-1)
    expect(lines(paused)).toHaveLength(0)
  })

  it('widens the desk with the staff: 36 + 34 per further assistant, no stools', () => {
    const three = at({ assistants: [{ look: 0, stamina: 80 }, { look: 1, stamina: 80 }, { look: 2, stamina: 80 }] })
    expect(three).toContainEqual(px('#8b5a2b', 19, 120, 104, 3))
    expect(three).toContainEqual(px('#70461f', 19, 123, 104, 9))
    expect(three.some((c) => c.style === '#4a4a55' && c.y === 118 && c.w === 10 && c.h === 4)).toBe(false)
  })

  it('dresses each assistant in its own look, one seat 34 px along the row each', () => {
    const crew = [{ look: 0, stamina: 80 }, { look: 1, stamina: 80 }, { look: 8, stamina: 80 }]
    const { images } = full({ assistants: crew })
    // a settled table shows seat-draw's first step on each (the cast driver offsets their pens, castPlay's PHASE_MS);
    // look 8 wraps to look2
    expect(images.filter((i) => i.id.startsWith('cast/') && i.y === 80).map((i) => [i.id, i.x])).toEqual([
      ['cast/seat.draw-a~open.closed.none/look0', 21], ['cast/seat.draw-a~open.closed.none/look1', 55],
      ['cast/seat.draw-a~open.closed.none/look2', 89],
    ])
  })

  it('dozes a sleeping assistant, head on the folded arms, with the Z, and seats a working one upright', () => {
    const rest = full({ activity: 'rest' }, 0.3, 0)
    // the rig's doze key frame in the assistant's look, drawn at the seat
    expect(castAt(rest.images, 21, 80)?.id).toBe('cast/key.doze-0/look0')
    // the Z beside the bowed head at (21 + 25, 80 + 11), its top row 91
    expect(covers(rest.log, '#2f5ecf', 47, 91)).toBeGreaterThan(-1)
    expect(covers(rest.log, '#2f5ecf', 47, 87)).toBe(-1)
    expect(page(rest.log)).toBe(-1)
    // working, the upright seated frame instead
    expect(castAt(full({}, 0.3, 0).images, 21, 80)?.id).toBe('cast/seat.draw-a~open.closed.none/look0')
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
    const ref = full({})
    // CAT_SLEEP at (202, 118), 12x8: the curled frame, one image
    const cat = castAt(ref.images, 202, 118)
    expect(cat?.id).toBe('cast/cat.sleep/pal')
    expect([cat!.w, cat!.h]).toEqual([12, 8])
    // the round cushion under it: 16 wide from x 200, its body y 122-125 (the rim at 126-127); drawn before the cat
    const cushion = covers(ref.log, '#c9a24a', 201, 124)
    expect(cushion).toBeGreaterThan(-1)
    expect(cushion).toBeLessThan(cat!.at)
    expect(covers(ref.log, '#a8832f', 206, 127)).toBeGreaterThan(-1)
    // on a rest day the cat sits in the kitchen at (44, 150), no cushion (frame 100 is catFrame's sit)
    const rest = full({ activity: 'rest' })
    expect(rest.log.some((c) => c.style === '#c9a24a')).toBe(false)
    expect(castAt(rest.images, 44, 150)?.id).toBe('cast/cat.sit/pal')
  })

  it('draws the cat after the mangaka in bed and before the editor', () => {
    const table = newActorTable()
    Object.assign(table.cat, { x: 202, y: 118, targetX: 202, targetY: 118, state: 'sleeping', goal: 'sleeping' })
    Object.assign(table.mangaka, { x: 220, y: 90, targetX: 220, targetY: 90, state: 'sleeping', goal: 'sleeping' })
    Object.assign(table.editor, { x: 198, y: 85, targetX: 198, targetY: 85, state: 'standing', goal: 'standing', facing: -1 })
    const { images } = full({ activity: 'rest', visitor: 'editor', actors: table })
    const lie = images.findIndex((i) => i.id.startsWith('cast/bed.lie-0/'))
    const cat = images.findIndex((i) => i.id.startsWith('cast/cat.'))
    const editor = images.findIndex((i) => i.id.startsWith('cast/editor.'))
    expect(lie).toBeGreaterThan(-1)
    expect(cat).toBeGreaterThan(lie)
    expect(editor).toBeGreaterThan(cat)
  })

  it('walks the cat with the two-frame cycle', () => {
    const walk = (anim: number) => {
      const table = newActorTable()
      Object.assign(table.cat, { x: 120, y: 104, targetX: 100, targetY: 104, state: 'walking', goal: 'sleeping', facing: -1, anim })
      const { ctx, images } = fakeContext()
      render(ctx, sceneSnapshot({ actors: table }), 0.3, 100)
      return images
    }
    // floor(anim / 125) % 2
    expect(castAt(walk(125), 120, 104)?.id).toBe('cast/cat.walk.1/pal')
    expect(castAt(walk(0), 120, 104)?.id).toBe('cast/cat.walk.0/pal')
  })

  /** Fills inside the seated mangaka's head box (x 124-155, y 58-85) from the fill log's index `from` on. */
  const inHead = (log: readonly FillCall[], from: number) => log.slice(from).filter((c) => c.x >= 124 && c.x + c.w <= 156 && c.y >= 58 && c.y + c.h <= 86)

  it('bakes the mood face and mark into the seated frame when cheer is on: no overlay fills', () => {
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot({ cheer: true }), 0.3, 0)
    const hero = castAt(images, 124, 58)
    expect(hero?.id).toBe('cast/seat.draw-a~happy.smile.sparkle/pal')
    expect(inHead(log, hero!.at)).toEqual([])
  })

  it('shows a sweat mark for a tired seated mangaka, and no more low-stamina !', () => {
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot({ stamina: 10 }), 0.3, 0)
    expect(castAt(images, 124, 58)?.id).toBe('cast/seat.draw-a~squint.frown.sweat/pal')
    // nothing red above the head (the head's top row 6 is y 64; the mark slot cols 28-30 at x 152-154)
    expect(log.some((c) => c.style === '#e5484d' && c.x + c.w > 140 && c.x < 159 && c.y < 64 && c.y + c.h > 50)).toBe(false)
  })

  it('draws the neutral face in the image, no fill after it in the head', () => {
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot(), 0.3, 0)
    const hero = castAt(images, 124, 58)
    expect(hero?.id).toBe('cast/seat.draw-a~open.closed.none/pal')
    expect(inHead(log, hero!.at)).toEqual([])
  })

  it('shows the mood walking too', () => {
    const table = newActorTable()
    Object.assign(table.mangaka, { x: 150, y: 81, targetX: 100, targetY: 81, state: 'walking', goal: 'standing', facing: -1, anim: 0 })
    const { ctx, images } = fakeContext()
    render(ctx, sceneSnapshot({ cheer: true, actors: table }), 0.3, 0)
    expect(castAt(images, 150, 81)?.id).toBe('cast/walk.contact-l~happy.smile.sparkle/pal')
  })

  it('lets the ready manuscript exclamation beat a tired mood mark above the standing mangaka (fix round 1)', () => {
    // standing at MANGAKA_STAND (170, 81): the '!' in the rig's mark slot (170 + 28, 81), its stroke in col 1; the
    // ready frame wears the tired face without its mark
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'ready', stamina: 10 }), 0.3, 100)
    expect(castAt(images, 170, 81)?.id).toBe('cast/ready.idle~squint.frown.none/pal')
    expect(covers(log, '#e5484d', 199, 82)).toBeGreaterThan(-1)
  })

  it('lets a happy mood mark beat the idle question mark above the standing mangaka (fix round 1)', () => {
    // idle phase, cheer on, frame 0 (frame % 120 < 40, when the '?' would show): the sparkle is in the frame
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'idle', cheer: true }), 0.3, 0)
    expect(castAt(images, 170, 81)?.id).toBe('cast/stand.idle~happy.smile.sparkle/pal')
    expect(log.some((c) => c.style === '#2f5ecf')).toBe(false)
  })

  it('shows a sweat mark on a tired assistant', () => {
    // baked into the assistant's rig frame (the tired face and its sweat mark), in its look
    const { ctx, images } = fakeContext()
    render(ctx, sceneSnapshot({ assistants: [{ look: 0, stamina: 10 }] }), 0.3, 0)
    expect(castAt(images, 21, 80)?.id).toBe('cast/seat.draw-a~squint.frown.sweat/look0')
  })

  it('stamps the mark in the seated frame\'s slot, cols 28-30, rows 6-10', () => {
    expect(rigFrame('seat.draw-a', 'sleepy', false).map.slice(6, 11).map((r) => r.slice(28, 31))).toEqual(MARK_ART.zee)
  })

  it('holds the manuscript in the ready stance', () => {
    const { ctx, images } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'ready' }), 0.3, 300)
    expect(castAt(images, 170, 81)?.id).toBe('cast/ready.idle~open.closed.none/pal')
  })

  it('paints the groom paw in fur at CAT_KITCHEN on frame 360 (fix round 1)', () => {
    // resting sends the cat to CAT_KITCHEN (44, 150), unflipped (facing -1 by default); frame 360 is catFrame's
    // groom, index 0
    const { ctx, images } = fakeContext()
    render(ctx, sceneSnapshot({ phase: 'drawing', activity: 'rest' }), 0.3, 360)
    expect(castAt(images, 44, 150)?.id).toBe('cast/cat.groom.0/pal')
  })

  it('keeps the cat clear of the mangaka\'s, the editor\'s and the bed\'s spots', () => {
    type Box = readonly [number, number, number, number]
    // the seat frame, the standing frame, the editor's and the lying head (the bed frame's cols 23-46, rows 8-29)
    const boxes: Box[] = [[124, 155, 58, 105], [170, 201, 81, 128], [198, 221, 85, 116], [224, 247, 98, 119]]
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
  // standing at MANGAKA_STAND (170, 81): the standing loop's first frame in the palette the level picks (the palettes'
  // colours are spriteCache.test's)
  it('dresses the standing mangaka in the outfit for their level', () => {
    const table = newActorTable()
    Object.assign(table.mangaka, { x: 170, y: 81, targetX: 170, targetY: 81, state: 'standing', goal: 'standing' })
    const at = (level: number) => {
      const { ctx, images } = fakeContext()
      render(ctx, sceneSnapshot({ level, actors: table }), 0.3, 0)
      return castAt(images, 170, 81)?.id
    }
    expect(at(1)).toBe('cast/stand.idle~open.closed.none/pal')
    expect(at(5)).toBe('cast/stand.idle~open.closed.none/cardigan')
    expect(at(10)).toBe('cast/stand.idle~open.closed.none/blazer')
  })

  it('leaves an assistant\'s look palette unaffected by the player\'s level', () => {
    // the assistant seated at (21, 80) stays in its look at level 10, while the mangaka wears the blazer
    const { ctx, images } = fakeContext()
    render(ctx, sceneSnapshot({ level: 10 }), 0.3, 0)
    expect(castAt(images, 21, 80)?.id).toBe('cast/seat.draw-a~open.closed.none/look0')
    expect(castAt(images, 124, 58)?.id).toBe('cast/seat.draw-a~open.closed.none/blazer')
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
  const loadingImage = (id: string) => ({ ...fakeImage(id, 320, 114), complete: false }) as unknown as CanvasImageSource

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
    expect(artOnly(none.images)).toEqual([])
    expect(none.images).toEqual(plain.images)
  })

  it("draws a ready room image as the wall, at 0,0,320,114, then the tier's code-drawn floor, in place of the shell", () => {
    for (const tier of TIERS) {
      const shell = fakeContext()
      drawRoomShell(shell.ctx, tier, false)
      const floor = fakeContext()
      TIER_FLOOR[tier](floor.ctx, false)
      expect(shell.log.length, tier).toBeGreaterThan(0)
      const plain = paint({ tier }, 0.3)
      const art = paint({ tier }, 0.3, withRoom(tier, fakeImage('room', 320, 114)))
      expect(art.images[0], tier).toEqual({ id: 'room', x: 0, y: 0, w: 320, h: 114, at: 0 })
      expect(plain.log.slice(0, shell.log.length), tier).toEqual(shell.log)
      // the floor's first fill, the whole floor in the tier's colour, comes right after the image
      expect(art.log[0], tier).toEqual({ style: floor.log[0].style, x: 0, y: 114, w: 320, h: 66 })
      expect(art.log, tier).toEqual([...floor.log, ...plain.log.slice(shell.log.length)])
    }
  })

  it('draws the room image of the whole art set at height 114', () => {
    const art = paint({}, 0.3, fakeSceneArt())
    expect(art.images[0]).toMatchObject({ id: 'room/apartment', x: 0, y: 0, w: 320, h: 114, at: 0 })
  })

  it("paints the flat's wall and floor in code with the whole art set ready: the flat has no wall image (0.10.1)", () => {
    expect(fakeSceneArt().room.flat).toBeNull()
    for (const t of [0.3, 0.9]) {
      const night = t > 0.72
      const shell = fakeContext()
      drawRoomShell(shell.ctx, 'flat', night)
      const art = paint({ tier: 'flat' }, t, fakeSceneArt())
      expect(art.images.some((i) => i.id.startsWith('room/')), `t ${t}`).toBe(false)
      // its own night colours, no dim: the shell's fills first, exactly
      expect(art.log.slice(0, shell.log.length), `t ${t}`).toEqual(shell.log)
      expect(art.log.some((c) => c.style === ROOM_NIGHT_DIM), `t ${t}`).toBe(false)
    }
  })

  it('still paints the sky over the pane after the room image', () => {
    const art = paint({}, 0.3, withRoom('apartment', fakeImage('room', 320, 114)))
    expect(covers(art.log, skyColor(0.3), 200, 60)).toBeGreaterThanOrEqual(art.images[0].at)
  })

  it('dims a room image at night with one 320x114 fill right after it, then the night floor, and keeps the night overlay on top', () => {
    const shell = fakeContext()
    drawRoomShell(shell.ctx, 'apartment', true)
    const floor = fakeContext()
    TIER_FLOOR.apartment(floor.ctx, true)
    const plain = paint({}, 0.9)
    const art = paint({}, 0.9, withRoom('apartment', fakeImage('room', 320, 114)))
    expect(ROOM_NIGHT_DIM).toBe('rgba(20,24,60,0.25)')
    expect(art.images[0].at).toBe(0)
    expect(art.log[0]).toEqual({ style: ROOM_NIGHT_DIM, x: 0, y: 0, w: 320, h: 114 })
    expect(art.log.slice(1)).toEqual([...floor.log, ...plain.log.slice(shell.log.length)])
    expect(art.log.findIndex((c) => c.style === 'rgba(20, 24, 60, 0.28)')).toBeGreaterThan(0)
    // by day, no dim
    expect(paint({}, 0.3, withRoom('apartment', fakeImage('room', 320, 114))).log.some((c) => c.style === ROOM_NIGHT_DIM)).toBe(false)
  })

  it("falls back to the shell's fills while the room image is still loading, or when only another tier has one", () => {
    const plain = paint({}, 0.3)
    const art = paint({}, 0.3, withRoom('apartment', loadingImage('room')))
    expect(artOnly(art.images)).toEqual([])
    expect(art.log).toEqual(plain.log)
    const other = paint({}, 0.3, withRoom('loft', fakeImage('room', 320, 114)))
    expect(artOnly(other.images)).toEqual([])
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
        const props = artOnly(art.images)
        expect(props, label).toHaveLength(1)
        const { at } = props[0]
        expect(props[0], label).toEqual({ id, ...PROP_BOX[id], at })
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
    Object.assign(table.mangaka, { x: 220, y: 90, targetX: 220, targetY: 90, state: 'sleeping', goal: 'sleeping' })
    const bed = paint({ activity: 'rest', phase: 'idle', actors: table }, 0.3, withProp('bed', fakeImage('bed', 1, 1)))
    const blanket = covers(bed.log, '#c94b4b', 200, 116)
    expect(blanket).toBeGreaterThan(-1)
    expect(artOnly(bed.images)[0].at).toBeLessThanOrEqual(blanket)
    const win = paint({}, 0.3, withProp('window', fakeImage('window', 1, 1)))
    expect(artOnly(win.images)[0].at).toBeLessThanOrEqual(covers(win.log, skyColor(0.3), 200, 60))
  })

  it('draws a prop image only where its piece shows: no door in the flat, no stock poster under a serial or an anime', () => {
    expect(artOnly(paint({ tier: 'flat' }, 0.3, withProp('door', fakeImage('door', 1, 1))).images)).toEqual([])
    expect(artOnly(paint({ tier: 'apartment' }, 0.3, withProp('doorway', fakeImage('doorway', 1, 1))).images)).toEqual([])
    expect(artOnly(paint({ serialOn: true }, 0.3, withProp('poster', fakeImage('poster', 1, 1))).images)).toEqual([])
    expect(artOnly(paint({ animePoster: true }, 0.3, withProp('poster', fakeImage('poster', 1, 1))).images)).toEqual([])
  })

  it("falls back to a prop's own fills while its image is still loading", () => {
    const plain = paint({}, 0.3)
    const art = paint({}, 0.3, withProp('bed', loadingImage('bed')))
    expect(artOnly(art.images)).toEqual([])
    expect(art.log).toEqual(plain.log)
  })
})

describe('furniture, equipment and the front row as sprites (0.10.0 P1)', () => {
  const NONE = NO_EQUIPMENT
  const ALL = { coffee: true, lamp: true, shelf: true, chair: true, 'drafting-table': true, tablet: true }
  const SHADOW = 'rgba(40, 24, 16, 0.28)'
  /** The seated mangaka at MANGAKA_SEAT (32x48 at 124, 58), its face in the frame. */
  const SEATED = { x0: 124, x1: 155, y0: 58, y1: 105 }
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

  it('draws the assistants, their desk and their pages after the main desk, in front of it', () => {
    const crew = [{ look: 0, stamina: 80 }, { look: 1, stamina: 80 }, { look: 2, stamina: 80 }]
    const owned = { ...NONE, 'drafting-table': true }
    const isPage = (f: FillCall) => f.style === '#fdfcf7' && f.y === 120 && f.w === 6 && f.h === 4
    const { log, images } = paint({ owned, assistants: crew, progress: 1 })
    const d = imageAt(images, 'drafting-table')
    // three seated assistants, every one drawn after the drafting table's image (the third head over its overhang)
    const row = images.filter((i) => i.id.startsWith('cast/') && i.y === 80)
    expect(row.map((i) => i.x)).toEqual([21, 55, 89])
    for (const i of row) expect(i.at, i.id).toBeGreaterThanOrEqual(d)
    expect(images.indexOf(row[0])).toBeGreaterThan(images.findIndex((i) => i.id === 'drafting-table'))
    // their desk and every page after it too, each page on their own desk: none under either main desk's box
    expect(log.findIndex((c) => c.style === '#8b5a2b' && c.x === 19 && c.y === 120 && c.w === 104)).toBeGreaterThanOrEqual(d)
    const pages = log.flatMap((f, i) => (isPage(f) ? [i] : []))
    expect(pages.map((i) => log[i].x)).toEqual([24, 58, 92])
    for (const i of pages) {
      expect(i).toBeGreaterThanOrEqual(d)
      const f = log[i]
      for (const id of ['desk', 'drafting-table'] as const) {
        const b = PROP_BOX[id]
        expect(f.x + f.w <= b.x || f.x >= b.x + b.w || f.y + f.h <= b.y || f.y >= b.y + b.h, `${id} ${JSON.stringify(f)}`).toBe(true)
      }
    }
    // the desk image is drawn once, so nothing of it lands after the pages
    expect(images.filter((im) => im.id === 'drafting-table')).toHaveLength(1)
  })

  it('draws the chair before the seated mangaka and the desk after him, before the pages, the stock pieces and the owned ones alike', () => {
    for (const [owned, chair, desk] of [[NONE, 'chair', 'desk'], [ALL, 'tall-chair', 'drafting-table']] as const) {
      const { log, images } = paint({ owned })
      const c = imageAt(images, chair)
      const d = imageAt(images, desk)
      // the seated mangaka is one cache image between the chair and the desk, by the fill log and by the draw order
      const hero = castAt(images, 124, 58)
      expect(hero?.id, chair).toBe('cast/seat.draw-a~open.closed.none/pal')
      expect(hero!.at, chair).toBeGreaterThanOrEqual(c)
      expect(hero!.at, chair).toBeLessThanOrEqual(d)
      expect(images.findIndex((i) => i.id === chair), chair).toBeLessThan(images.indexOf(hero!))
      expect(images.indexOf(hero!), chair).toBeLessThan(images.findIndex((i) => i.id === desk))
      // everything painted between the chair and the desk is the seated mangaka's overlay, when there is one
      const between = log.slice(c, d)
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
      // every character is drawn before the front row
      const lastCast = images.map((i) => i.id.startsWith('cast/')).lastIndexOf(true)
      expect(lastCast, tier).toBeGreaterThan(-1)
      expect(lastCast, tier).toBeLessThan(images.length - 3)
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

describe('the rig path (0.11.0 task 10)', () => {
  const standing = (over: Partial<Actor> = {}) => {
    const t = newActorTable()
    Object.assign(t.mangaka, { x: 170, y: 81, targetX: 170, targetY: 81, state: 'standing', goal: 'standing', pose: 'stand.idle' }, over)
    return t
  }
  const draw = (over: Partial<Snapshot>, frame = 0) => {
    const f = fakeContext()
    render(f.ctx, sceneSnapshot({ phase: 'idle', ...over }), 0.3, frame)
    return f
  }

  it('draws a posed mangaka from the rig: one image of the pose with the mood\'s face, in the outfit\'s palette, at the actor', () => {
    expect(castAt(draw({ actors: standing() }).images, 170, 81)).toMatchObject({ id: 'cast/stand.idle~open.closed.none/pal', w: 32, h: 48 })
    expect(castAt(draw({ actors: standing(), cheer: true }).images, 170, 81)?.id).toBe('cast/stand.idle~happy.smile.sparkle/pal')
    expect(castAt(draw({ actors: standing(), level: 10 }).images, 170, 81)?.id).toBe('cast/stand.idle~open.closed.none/blazer')
  })

  it('grounds a standing or walking rig figure with a shadow under its feet, and mirrors the walk facing right', () => {
    const { log, images } = draw({ actors: standing() })
    const under = log.findIndex((c) => c.style === 'rgba(40, 24, 16, 0.28)' && c.x === 176 && c.y === 127 && c.w === 20 && c.h === 2)
    expect(under).toBeGreaterThan(-1)
    expect(castAt(images, 170, 81)!.at).toBeGreaterThan(under)
    const walk = draw({ actors: standing({ state: 'walking', targetX: 100, facing: 1 }) })
    expect(castAt(walk.images, 170, 81)?.id).toBe('cast/stand.idle~open.closed.none/pal/r')
  })

  it('shows the ready ! in the rig\'s mark slot, the face\'s own mark left out', () => {
    const { log, images } = draw({ actors: standing(), phase: 'ready', stamina: 10 })
    expect(castAt(images, 170, 81)?.id).toBe('cast/stand.idle~squint.frown.none/pal')
    expect(covers(log, '#e5484d', 199, 81)).toBeGreaterThan(-1) // the '!' at (170 + 28, 81), its stroke in col 1
  })

  it('draws a posed assistant from the rig in its look', () => {
    const t = newActorTable()
    planActors(t, sceneSnapshot({ actors: t }))
    settleActors(t)
    t.assistants[0].pose = 'stand.idle'
    expect(castAt(draw({ phase: 'drawing', actors: t }).images, 21, 80)?.id).toBe('cast/stand.idle~open.closed.none/look0')
  })

  it('draws the seated rig mangaka\'s rows 0-39 again over the page stack, so the pen and its hand lie on the pages', () => {
    const s = sceneSnapshot({ phase: 'drawing', progress: 0.5 })
    expect([s.actors.mangaka.x, s.actors.mangaka.y]).toEqual([124, 58])
    const f = fakeContext()
    render(f.ctx, s, 0.3, 0)
    const id = `cast/${rigFrame(ANIMS['seat-draw'].steps[0].pose, 'neutral', false).id}/pal`
    const seated = f.images.filter((i) => i.id === id)
    expect(seated.map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual([{ x: 124, y: 58, w: 32, h: 48 }, { x: 124, y: 58, w: 32, h: 40 }])
    // the whole frame goes on before the stock desk's top (room (52, 62), canvas (116, 98)); its rows 0-39 after the
    // page stack's last fill, the line at its top (stack round(1 + 0.5 * 8) = 5: room (59, 58 - 5), canvas (123, 89)),
    // and before the ink pot (room (90, 58), canvas (154, 94)), the mug, the tablet and the cups
    const desk = f.log.findIndex((c) => c.style === '#8b5a2b' && c.x === 116 && c.y === 98)
    const stackTop = f.log.findIndex((c) => c.style === '#b8b2a5' && c.x === 123 && c.y === 89 && c.w === 7 && c.h === 1)
    const ink = f.log.findIndex((c) => c.style === '#1b1b1b' && c.x === 154 && c.y === 94 && c.w === 4 && c.h === 4)
    expect([desk, stackTop, ink].map((i) => i > -1)).toEqual([true, true, true])
    expect(seated[0].at).toBeLessThanOrEqual(desk)
    expect(seated[1].at).toBeGreaterThan(stackTop)
    expect(seated[1].at).toBeLessThanOrEqual(ink)
  })

  it('draws the mangaka once standing or in bed: only the seated frame goes on twice', () => {
    // counted where the frame goes: at the actor, or in bed at the bed frame's origin
    const once = (s: Snapshot, at: { x: number; y: number } = s.actors.mangaka) => {
      const f = fakeContext()
      render(f.ctx, s, 0.3, 0)
      return [f.images.filter((i) => i.id.startsWith('cast/') && i.x === at.x && i.y === at.y).length, f.images.filter((i) => i.h === 40).length]
    }
    expect(once(sceneSnapshot({ phase: 'drawing', progress: 0.5 }))).toEqual([2, 1])
    expect(once(sceneSnapshot({ phase: 'idle', actors: standing() }))).toEqual([1, 0])
    const bed = sceneSnapshot({ activity: 'rest' })
    expect(bed.actors.mangaka.state).toBe('sleeping')
    expect(once(bed, { x: 201, y: 90 })).toEqual([1, 0])
  })

  it('places the seat\'s poses at the seat spot and the bed\'s at the bed frame\'s origin, everything else at the actor', () => {
    const a = { x: 5, y: 6 }
    expect([poseOrigin('actor', a), poseOrigin('seat', a), poseOrigin('bed', a)]).toEqual([a, MANGAKA_SEAT, MANGAKA_BED_FRAME])
    expect(MANGAKA_BED_FRAME).not.toEqual(MANGAKA_BED) // the actor stands 19 px right of it, on the lying head
  })

  it('rises the Zs over the sleep loop\'s lying poses only, never over the sitting-up frame (lying down)', () => {
    // frame 0: one Z at the bed frame's (36, 2), canvas (201 + 36, 90 + 2): rows ###, ..#, .#., #.., ### (9 fills)
    const zs = (pose: 'bed.lie-0' | 'bed.lie-1' | 'bed.sit') => {
      const s = sceneSnapshot({ activity: 'rest' })
      expect(s.actors.mangaka.state).toBe('sleeping')
      s.actors.mangaka.pose = pose
      const f = fakeContext()
      render(f.ctx, s, 0.3, 0)
      return f.log.filter((c) => c.style === '#2f5ecf' && c.x >= 196).map((c) => [c.x, c.y])
    }
    const z = [[237, 92], [238, 92], [239, 92], [239, 93], [238, 94], [237, 95], [237, 96], [238, 96], [239, 96]]
    expect(zs('bed.lie-0')).toEqual(z)
    expect(zs('bed.lie-1')).toEqual(z)
    expect(zs('bed.sit')).toEqual([])
  })

  it('lays the assistants\' desk under their row: from 2 px left of the first seat, 36 + 34 per further one', () => {
    expect([1, 2, 3].map((n) => assistantDesk(n))).toEqual([{ x: 19, w: 36 }, { x: 19, w: 70 }, { x: 19, w: 104 }])
    expect(assistantDesk(1)).toBe(assistantDesk(1)) // a constant: nothing allocated per frame
  })
})

describe('the rig editor behind the switch (0.12.0, task 7)', () => {
  beforeEach(() => setRigLive({ editor: true }))
  afterEach(() => setRigLive({ editor: false }))
  function rigEditorAt(facing: -1 | 1, over: Partial<Actor> = {}): ActorTable {
    const t = newActorTable()
    Object.assign(t.editor, { x: 205, y: 90, targetX: 205, targetY: 90, state: 'standing', goal: 'standing', facing }, over)
    // the cat asleep in its bed, so "after the cat" is a real order (a new table leaves it hidden)
    Object.assign(t.cat, { x: CAT_BED.x, y: CAT_BED.y, targetX: CAT_BED.x, targetY: CAT_BED.y, state: 'sleeping', goal: 'sleeping' })
    return t
  }
  const at = (over: Parameters<typeof sceneSnapshot>[0], table: ActorTable, frame = 100) => {
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot({ ...over, actors: table }), 0.3, frame)
    return { log, images }
  }

  it('draws the standing editor from the rig at (205, 90) in his palette, mirrored facing right, over a 20 px shadow, after the cat', () => {
    const left = at({ visitor: 'editor' }, rigEditorAt(-1))
    const img = castAt(left.images, 205, 90)
    expect(img).toMatchObject({ id: 'cast/editor.stand~open.closed.none/editor', w: 32, h: 48 })
    const shadow = left.log.findIndex((c) => c.x === 211 && c.y === 136 && c.w === 20 && c.h === 2)
    expect(shadow).toBeGreaterThan(-1)
    expect(shadow).toBeLessThan(img!.at)
    const cat = left.images.findIndex((i) => i.id === 'cast/cat.sleep/pal')
    expect(cat).toBeGreaterThan(-1)
    expect(cat).toBeLessThan(left.images.indexOf(img!))
    expect(left.images.some((i) => i.id.startsWith('cast/editor.idle'))).toBe(false)
    expect(castAt(at({ visitor: 'editor' }, rigEditorAt(1)).images, 205, 90)?.id).toBe('cast/editor.stand~open.closed.none/editor/r')
  })

  it('walks him through his walk loop: the pose the driver set, else the loop\'s first step', () => {
    const walk = (pose: Actor['pose']) => at({ visitor: 'editor' }, rigEditorAt(-1, { state: 'walking', targetX: 150, pose }))
    expect(castAt(walk('').images, 205, 90)?.id).toBe(`cast/${ANIMS['editor-walk'].steps[0].pose}~open.closed.none/editor`)
    expect(castAt(walk('editor.breath').images, 205, 90)?.id).toBe('cast/editor.breath~open.closed.none/editor')
  })

  it('hands him the visit\'s prop at the front hand after the body, and bobs the ! in the mark slot, standing facing the desk', () => {
    const con = at({ visitor: 'editor', visitorProp: 'contract' }, rigEditorAt(-1))
    const body = castAt(con.images, 205, 90)!
    // the standing pose's front hand (8, 33) on the contract's hand cell (2, 1): the 5x7 frame at (211, 122), after the body
    const prop = con.images.find((i) => i.id === 'cast/prop.contract/editor')
    expect(prop).toMatchObject({ x: 211, y: 122, w: 5, h: 7 })
    expect(con.images.indexOf(prop!)).toBeGreaterThan(con.images.indexOf(body))
    // frame 100: floor(100 / 16) % 2 = 0, the ! from (233, 90), its stroke in the glyph's middle column; frame 16 a row higher
    expect(covers(con.log, '#e5484d', 234, 90)).toBeGreaterThan(-1)
    expect(covers(at({ visitor: 'editor', visitorProp: 'envelope' }, rigEditorAt(-1), 16).log, '#e5484d', 234, 89)).toBeGreaterThan(-1)
    // the prop is an image now: nothing of it is a fill (the seal's red only ever paints the ! above the head)
    expect(con.log.filter((c) => c.style === '#e5484d').every((c) => c.y < 100)).toBe(true)
    expect(at({ visitor: 'editor', visitorProp: 'trophy' }, rigEditorAt(-1)).images.some((i) => i.id === 'cast/prop.trophy/editor')).toBe(true)
  })

  it('shows no prop and no ! empty-handed, walking, or facing away from the desk', () => {
    const cases: [Parameters<typeof sceneSnapshot>[0], ActorTable][] = [
      [{ visitor: 'editor', visitorProp: 'none' }, rigEditorAt(-1)],
      [{ visitor: 'editor', visitorProp: 'envelope' }, rigEditorAt(-1, { state: 'walking', targetX: 150 })],
      [{ visitor: 'editor', visitorProp: 'envelope' }, rigEditorAt(1)],
    ]
    for (const [over, table] of cases) {
      const f = at(over, table)
      expect(f.images.some((i) => i.id.startsWith('cast/prop.')), JSON.stringify(over)).toBe(false)
      expect(covers(f.log, '#e5484d', 234, 90), JSON.stringify(over)).toBe(-1)
    }
  })

  it('draws the 0.10 editor\'s idle frame while the switch is off', () => {
    setRigLive({ editor: false })
    const t = newActorTable()
    Object.assign(t.editor, { x: 198, y: 85, targetX: 198, targetY: 85, state: 'standing', goal: 'standing', facing: -1 })
    expect(castAt(at({ visitor: 'editor' }, t).images, 198, 85)?.id).toBe('cast/editor.idle.0/pal')
  })
})
