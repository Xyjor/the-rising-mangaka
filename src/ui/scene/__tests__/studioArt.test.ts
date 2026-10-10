// The player's studio in the scene: the tier, the equipment, the volumes, the anime poster and the trophies, asserted
// through what render paints into the recording context (src/test/fakeCanvas.ts). Pure drawing, no DOM: the default
// node environment.
import { describe, expect, it } from 'vitest'
import { EQUIPMENT_IDS } from '../../../sim'
import type { EquipmentId, StudioTierId } from '../../../sim'
import { fakeContext, fakeSceneArt, sceneSnapshot } from '../../../test/fakeCanvas'
import type { FillCall } from '../../../test/fakeCanvas'
import { PROP_BOX, render } from '../render'
import type { Snapshot } from '../render'
import {
  EQUIPMENT_ART, TIER_ART, TIER_DOOR, drawAnimePoster, drawEntrance, drawKitchenette, drawStudioLights, drawTrophies,
  drawVolumes, ownedFlags,
} from '../studioArt'

/** The tier's piece of the room as render paints it with no generated art: its door (`TIER_DOOR`), then `TIER_ART`. */
function tierRoom(tier: StudioTierId, ctx: CanvasRenderingContext2D, s: Snapshot, frame: number, night: boolean) {
  TIER_DOOR[tier].draw(ctx)
  TIER_ART[tier](ctx, s, frame, night)
}

const NONE: Record<EquipmentId, boolean> = {
  coffee: false, lamp: false, shelf: false, chair: false, 'drafting-table': false, tablet: false,
}
const ALL: Record<EquipmentId, boolean> = {
  coffee: true, lamp: true, shelf: true, chair: true, 'drafting-table': true, tablet: true,
}
const THREE_ASSISTANTS = [{ look: 0, stamina: 80 }, { look: 1, stamina: 80 }, { look: 2, stamina: 80 }]
/** The full scene with no studio look: three assistants in winter (rendered at night, t 0.9). */
const BARE_FULL: Partial<Snapshot> = { assistants: THREE_ASSISTANTS, season: 'winter' }
/** The full scene: all the equipment, the loft, 24 volumes, the anime poster, 4 trophies, three assistants, winter. */
const EVERYTHING: Partial<Snapshot> = {
  ...BARE_FULL, tier: 'loft', owned: ALL, volumes: 24, animePoster: true, trophies: 4,
}

/**
 * fillRect calls for the full scene with no studio look (`BARE_FULL`: three assistants, looks 0-2 at stamina 80, in
 * winter, otherwise the reference scene) at night, t 0.9, frame 100: 571, re-measured for the actor table (Task 2.3) by
 * rendering it into the recording context and reading `log.length`: Task 2.1's 551 plus the cat asleep in its bed (20
 * sprite pixels). Task 2.1's 551, measured the same way for the 320x180 canvas, was by hand the 192x108 scene's 499 (the
 * reference scene's 290 before the season layer, two more assistants at 85 each 170, night 12, winter 27), the room's
 * 58 fills in place of the old wall and floor's 34 (+24), the kitchenette 17, the apartment's plain door 5 and the
 * entrance 6. The full scene must stay under 1.5 times this (controller ruling: each assistant costs 85 fills, so the
 * one-assistant baseline cannot bound a three-assistant scene). Task 2.5 re-measured it the same way at 637: the wall
 * clock 47, the cat's 30 pixels in place of 20 (+10) and three assistants' pages at 3 each (9). Task A (0.2.1) re-measured it the same
 * way at 356 once drawSprite merged each horizontal run of one sprite key into one fillRect (same pixels, fewer fills).
 * Task B (0.2.1) re-measured it the same way at 505: the mangaka's 24x32 seated frame and the stock chair's back.
 * Task C (0.2.1) re-measured it the same way at 973: three 24x32 assistants on stools and the 12x8 cat (the full scene,
 * with the editor and a contract, measures 1083, under the 1500 ceiling). Upgrade 0.3.0 re-measured it the same way at
 * 1025 (+52): render.test's +53 by day for the room, the shadows, the corkboard, the calendar, the front row, the bin and
 * the light, less the daylight shaft (4) at night and plus the lamp's pool on the desk (3) (the full scene with every
 * story prop measures 1371). Upgrade 0.4.0's chibi cast (Task 6) re-measured it the same way at 1048 (+23):
 * MANGAKA_SIT[0] costs 5 more fillRect runs than the old frame (the chibi head's 18-wide, 16-row redraw), and
 * MANGAKA_SIT[1] costs 8 more (its pen hand moved a row, redrawing more of the chibi torso). `BARE_FULL` draws four
 * seated figures from those maps at frame 100, night: the mangaka and assistants 0-1 land on index 0
 * (`floor(100/8)%2` for the mangaka, `floor((100+i*3)/8)%2` for i 0 and 1), the third assistant lands on index 1
 * (`floor((100+2*3)/8)%2 = floor(106/8)%2 = 1`) — 5 + 5 + 5 + 8 = 23. The cat is asleep (`CAT_SLEEP`, unchanged) and
 * every mood is neutral (stamina 80 on everyone, no editor, no cheer), so `drawMood` adds nothing. The full scene
 * must stay under 1.5 times this. The final whole-branch review's fix (sleepy = working late at night, not the dead
 * `resting && night` check) re-measured it the same way at 1065 (+17): `BARE_FULL`'s mangaka is seated, working
 * (`phase: 'drawing'`, `running: true`), at night (t 0.9) — exactly `lateNight` — so the sleepy face and mark now
 * paint where neutral used to. `FACES.sleepy` (14x4) runs to 12 fillRect calls (row 0 and row 2 are one run each of
 * plain `S`; row 1 is 5 runs, `S,LL,S,LL,S`; row 3 is 5 runs, `BB,S,M,S,BB`), and `MARKS.sleepy` (3x5, only the `L`
 * cells drawn, `.` skipped) is 5 runs, one per row — 12 + 5 = 17. The three assistants stay neutral (Decision 5:
 * assistants never go sleepy), so nothing else in the scene changes. Upgrade 0.5.0 Task 6.1 re-measured it the same way at 1065 (+0): the wider daylight shaft keeps its four steps, and it does not paint at night anyway.
 * Upgrade 0.9.0 Task B3 re-measured it the same way at 1117 (+38, from the 1079 the constant held): MANGAKA_SIT[0]
 * goes from 184 to 194 runs (task B3's seat on task B1's standing body: rows 17-19 +7, each sleeve its own j run
 * seamed from the torso by an L with the V narrowing to RYR between them; rows 20-22 -3, the old frame's W/y stripe
 * cells gone from the plain Y drawstring column; row 23 +2, the forearm's transparent gap splitting the outline run (+1) and the new j cell (+1); rows
 * 28-29 +4, the shins L,F,f,L under the knee in place of one L line and the thighs' bottom outline),
 * and MANGAKA_SIT[1] from 187 to 195 (rows 17-19 +7 and rows 28-29 +4 as frame 0's, rows 20-22 -4, row 23 +1: the
 * stroke frame's pen hand sits on row 23 beside the torso). `BARE_FULL` draws three seated figures from index 0 (the
 * mangaka and assistants 0-1) and one from index 1 (the third assistant), as the 0.4.0 term: 10 + 10 + 10 + 8 = 38.
 * Upgrade 0.9.0 Task B5 re-measured it the same way at 1125 (+8): CAT_SLEEP goes from 31 to 39 runs (two stripes down
 * the curled back, `c` between fur at cols 5 and 8 on rows 4-5, each row +4), and `BARE_FULL` draws the cat asleep.
 * Upgrade 0.11.0 Task 6 re-measured it the same way at 309 (-816): every character is one drawImage from the sprite
 * cache (spriteCache.ts) now, so its runs leave the fill log: MANGAKA_SIT[0] three times (the mangaka and assistants 0
 * and 1) 582, MANGAKA_SIT[1] once (assistant 2) 195 and CAT_SLEEP 39: 1125 - 582 - 195 - 39 = 309. The sleepy face's 17
 * fills over the mangaka stay fills (the mood overlay is code-drawn until the rig head bakes it). Upgrade 0.11.0 Task 17
 * re-measured it the same way at 292 (-17): BARE_FULL's mangaka is seated, working, at night, so sleepy, and its face
 * and mark (FACES.sleepy 12 runs, MARKS.sleepy 5) are in its rig frame now: 309 - 17 = 292.
 */
const FULL_BASELINE = 292

/**
 * fillRect calls for `BARE_FULL` at night, t 0.9, frame 100, with every generated image ready (`fakeSceneArt`),
 * measured the same way (0.9.0 R2): 953. By hand, the 1079 less the fills the apartment's images replace (the shell 61,
 * the kitchenette 17, the window frame 1, the bookshelf 34, the stock poster 4, the bed 5, the plain door 5: 127), plus
 * the room image's night dim (1): 1079 - 127 + 1 = 953. 0.10.0 P1 re-measured it the same way at 928 (-25): the stock
 * chair 4, the stock desk 7, the zabuton 4, the boxes 6 and the bin 4 are sprites now (their contact shadows stay one
 * fill each, the bin's pages stay code-drawn): 953 - 25 = 928. Upgrade 0.9.0 Task B3 re-measured it the same way at
 * 966 (+38): the four seated figures (three from MANGAKA_SIT[0], 184 to 194, one from MANGAKA_SIT[1], 187 to 195), as
 * the 1117's +38 (the images replace no sprite): 928 + 38 = 966. Upgrade 0.9.0 Task B5 re-measured it the same way at
 * 974 (+8): CAT_SLEEP 31 to 39, as the 1125's +8 (the images replace no sprite): 966 + 8 = 974. Upgrade 0.10.0 Task C0
 * re-measured it the same way at 1009 (+35): the room image is the wall alone now, and the apartment's code-drawn
 * floor paints under it (`TIER_FLOOR`: the tatami fill 1, the weave lines 21, the three heri 3 and the seams 10), as
 * the 584's +35: 974 + 35 = 1009. Upgrade 0.11.0 Task 6 re-measured it the same way at 193 (-816), as the 309's (the
 * images replace no sprite): 1009 - 582 - 195 - 39 = 193. Upgrade 0.11.0 Task 17 re-measured it the same way at 176
 * (-17), as the 292's (the sleepy face 12 and mark 5 in the rig frame; the images replace no sprite): 193 - 17 = 176.
 * The full scene with the art ready must stay under 1.5 times this (its own budget, 264).
 */
const FULL_ART_BASELINE = 176

/**
 * fillRect calls for the worst scene of the full-scene loop with no art (`EVERYTHING`: the loft, every piece of
 * equipment, 24 volumes, the anime poster, 4 trophies, three assistants, winter) with the editor visiting and a contract
 * in hand, at night, t 0.9, frame 100: 462 (Upgrade 0.11.0 Task 6, measured the same way by rendering it into the
 * recording context and reading `log.length`). FULL_BASELINE's 309 is the bare apartment, so once the characters' runs
 * left the fill log the loop's old budget, 463.5, was cleared by 1.5 fills: this scene has its own pin. By hand, each
 * change measured alone against the 309 (they add up with no interaction): the loft +27 (its room 70 for the
 * apartment's 61 +9, its doorway 6 for the plain door's 5 +1, the sill plant and the floor plant 15, the doorway's halo
 * and spill at night 2; the front row is 19 in both), the coffee machine +6, the arm lamp +9 (its 9 for the stock lamp's
 * 3 +6, its bulb and glow at night 3), the reference shelf +14, the tall chair +4 (8 for the stock chair's 4), the
 * drafting table +4 (11 for the stock desk's 7), the pen tablet +4 (3 and its glow 1), 24 volumes +24, the anime poster
 * +12 (16 for the stock poster's 4) and 4 trophies +16: 309 + 120 = 429. The editor's visit adds 33: his contact shadow
 * 1, the contract 19 and the ! above him 4 (24), and the mangaka's mood goes from sleepy (face 12, mark 5) to surprised
 * (face 22, mark 4), +9: 429 + 33 = 462. The loop's other scenes are 429 (frame 0), 429 and 399 (by day). Upgrade 0.11.0
 * Task 17 re-measured it the same way at 436 (-26): the mangaka's surprised face (22) and mark (4) are in its rig frame
 * now (`~ring.o.bang`), so they leave the fill log: 462 - 26 = 436 (the visit itself adds 24, his shadow, the contract and
 * the !). The loop's other scenes lose the sleepy face and mark (-17) at night, 412 (frame 0) and 412, and stay 399 by
 * day (neutral). Every scene in the loop must stay under 1.5 times this (654).
 */
const VISIT_FULL_BASELINE = 436

/**
 * fillRect calls for the same worst scene (the editor visiting, t 0.9, frame 100) with every generated image ready
 * (`fakeSceneArt`): 285 (Upgrade 0.11.0 Task 6; the loop's old budget, 289.5, was cleared by 4.5 fills). By hand, each
 * change measured alone against the 193: the loft -1 (its floor 17 under the room image for the apartment's 35 -18, the
 * sill plant and the floor plant +15, the doorway's halo and spill +2), the coffee machine, arm lamp, reference shelf,
 * tall chair and drafting table 0 each (sprites; the lamp's bulb and glow 3 replace the stock lamp's 3), the pen tablet
 * +4 (3 and its glow 1; it has no sprite), 24 volumes +24, the anime poster +16 (code-drawn, the stock poster's image
 * is not drawn) and 4 trophies +16: 193 + 59 = 252. The visit adds the same 33 as the 462's (shadow 1, contract 19, ! 4,
 * sleepy to surprised +9): 252 + 33 = 285. The loop's other scenes are 252 (frame 0), 252 and 221 (by day). Upgrade
 * 0.11.0 Task 17 re-measured it the same way at 259 (-26), as the 436's (the surprised face 22 and mark 4 in the rig
 * frame): 285 - 26 = 259; the loop's other scenes are 235 (frame 0), 235 (-17 each, the sleepy overlay) and 221 (by
 * day). Every scene in the loop must stay under 1.5 times this (388.5).
 */
const VISIT_ART_BASELINE = 259

function paint(over: Partial<Snapshot> = {}, t = 0.3, frame = 100): FillCall[] {
  const { ctx, log } = fakeContext()
  render(ctx, sceneSnapshot(over), t, frame)
  return log
}

function key(log: FillCall[]): string {
  return JSON.stringify(log)
}

/** What one painter puts down on its own. */
function alone(draw: (ctx: CanvasRenderingContext2D) => void): FillCall[] {
  const { ctx, log } = fakeContext()
  draw(ctx)
  return log
}

/** An inclusive pixel box, as the brief's region table gives them: columns x0-x1, rows y0-y1. */
type Box = readonly [x0: number, x1: number, y0: number, y1: number]

function inBox(c: FillCall, [x0, x1, y0, y1]: Box): boolean {
  return c.x >= x0 && c.x + c.w <= x1 + 1 && c.y >= y0 && c.y + c.h <= y1 + 1
}

function overlaps(c: FillCall, [x0, x1, y0, y1]: Box): boolean {
  return c.x <= x1 && c.x + c.w > x0 && c.y <= y1 && c.y + c.h > y0
}

/** Where each fill of `piece` first lands in `log` (-1 when it is missing). */
function at(log: FillCall[], piece: FillCall[]): number[] {
  return piece.map((p) => log.findIndex((c) => c.style === p.style && c.x === p.x && c.y === p.y && c.w === p.w && c.h === p.h))
}

const EQUIPMENT_REGION: Record<EquipmentId, Box[]> = {
  coffee: [[182, 190, 73, 81]],
  lamp: [[156, 169, 76, 98]],
  shelf: [[107, 114, 56, 93]],
  chair: [[132, 156, 74, 108]],
  // x 108-175 in the desk's rows (y 98-117); above the desk top only the lightbox, 109-118 x 95-97
  'drafting-table': [[108, 175, 98, 117], [109, 118, 95, 97]],
  tablet: [[147, 159, 96, 98]],
}
const LIGHTBOX: Box = [109, 118, 95, 97]
const DOORWAY: Box = [258, 274, 56, 113]
const SILL_PLANT: Box = [214, 219, 74, 80]
const FLOOR_PLANT: Box = [236, 248, 116, 142]
const TIER_REGION: Record<StudioTierId, Box[]> = {
  apartment: [DOORWAY],
  flat: [DOORWAY],
  loft: [DOORWAY, SILL_PLANT, FLOOR_PLANT],
}
const VOLUMES: Box = [74, 104, 49, 54]
const POSTER: Box = [116, 138, 50, 78]
const TROPHIES: Box = [194, 210, 74, 80]
/** All the studio's art keeps inside the phone crop, x 24-296: object-fit: cover crops the rest at 375x667. */
const PHONE_CROP: Box = [24, 296, 0, 179]
/** The mangaka (the 32x48 rig) seated at the desk (down to the desk top's line, row 39), and standing beside it. */
const SEATED: Box = [124, 155, 58, 97]
const STANDING: Box = [170, 201, 81, 128]
/** Where the editor stands on a visit (Task 2.3): the furniture keeps off it too. */
const EDITOR_SPOT_BOX: Box = [198, 221, 85, 116]
const LAMP_GLOW = 'rgba(255,236,170,0.18)'
const DOOR_LIGHT = '#f2d49b'

/** The snapshot the art is handed in these tests: everything owned and won. */
const FULL = sceneSnapshot(EVERYTHING)
/** Every way the art is asked to paint: still (frame 0, reduced motion) and moving, by day and by night. */
const CALLS: [frame: number, night: boolean][] = [[0, false], [100, false], [0, true], [100, true]]

function expectInside(log: FillCall[], boxes: Box[], what: string) {
  expect(log.length, what).toBeGreaterThan(0)
  for (const c of log) {
    const where = `${what}: ${JSON.stringify(c)}`
    expect(boxes.some((b) => inBox(c, b)), where).toBe(true)
    expect(inBox(c, PHONE_CROP), where).toBe(true)
  }
}

describe('the studio in the scene', () => {
  it('changes the painting for every piece of equipment', () => {
    expect([...EQUIPMENT_IDS]).toEqual(['coffee', 'lamp', 'shelf', 'chair', 'drafting-table', 'tablet'])
    const bare = key(paint())
    for (const id of EQUIPMENT_IDS) {
      expect(key(paint({ owned: { ...NONE, [id]: true } })), id).not.toBe(bare)
      expect(key(paint({ owned: { ...NONE, [id]: true } }, 0.9)), `${id} at night`).not.toBe(key(paint({}, 0.9)))
    }
  })

  it('paints the studio flat and the loft, each its own way, and the apartment as the bare scene', () => {
    const [apartment, flat, loft] = (['apartment', 'flat', 'loft'] as const).map((tier) => key(paint({ tier })))
    expect(apartment).toBe(key(paint()))
    expect(new Set([apartment, flat, loft]).size).toBe(3)
  })

  it('changes the painting for 3 volumes against none, the anime poster and a trophy', () => {
    const bare = key(paint())
    expect(key(paint({ volumes: 3 }))).not.toBe(bare)
    expect(key(paint({ volumes: 3 }))).not.toBe(key(paint({ volumes: 2 })))
    expect(key(paint({ animePoster: true }))).not.toBe(bare)
    expect(key(paint({ trophies: 1 }))).not.toBe(bare)
    expect(key(paint({ trophies: 2 }))).not.toBe(key(paint({ trophies: 1 })))
  })

  it('paints the scene with no studio look in its measured 292 fills', () => {
    expect(paint(BARE_FULL, 0.9, 100)).toHaveLength(FULL_BASELINE)
    expect(FULL_BASELINE * 1.5).toBe(438)
  })

  it('keeps the full scene inside the canvas, free of magenta and under 1.5 times its own worst case', () => {
    // the loop's worst scene, the editor visiting, has its own pin (VISIT_FULL_BASELINE), and the loop is held to 1.5
    // times that
    const budget = VISIT_FULL_BASELINE * 1.5
    expect(budget).toBe(654)
    let most = 0
    for (const [t, frame, visiting] of [[0.9, 100, 0], [0.9, 0, 0], [0.3, 100, 0], [0.9, 100, 1]]) {
      const log = paint(visiting ? { ...EVERYTHING, visitor: 'editor', visitorProp: 'contract' } : EVERYTHING, t, frame)
      expect(log.some((c) => c.style === '#f0f'), `t ${t} frame ${frame}`).toBe(false)
      for (const c of log) {
        const where = `t ${t} frame ${frame}: ${JSON.stringify(c)}`
        expect(c.x >= 0 && c.y >= 0 && c.x + c.w <= 320 && c.y + c.h <= 180, where).toBe(true)
      }
      // the studio art is really there, and the whole scene stays within its budget
      expect(log.length, `t ${t} frame ${frame}`).toBeGreaterThan(FULL_BASELINE)
      expect(log.length, `t ${t} frame ${frame}`).toBeLessThan(budget)
      if (visiting) expect(log, `t ${t} frame ${frame}`).toHaveLength(VISIT_FULL_BASELINE)
      most = Math.max(most, log.length)
    }
    // no other scene has overtaken the pinned one
    expect(most).toBe(VISIT_FULL_BASELINE)
  })

  it('keeps the full scene with every generated image ready under 1.5 times its own measured worst case', () => {
    const art = fakeSceneArt()
    const bare = fakeContext()
    render(bare.ctx, sceneSnapshot(BARE_FULL), 0.9, 100, art)
    expect(bare.log).toHaveLength(FULL_ART_BASELINE)
    expect(FULL_ART_BASELINE * 1.5).toBe(264)
    // the loop's worst scene, the editor visiting, has its own pin (VISIT_ART_BASELINE), and the loop is held to 1.5
    // times that
    const budget = VISIT_ART_BASELINE * 1.5
    expect(budget).toBe(388.5)
    let most = 0
    for (const [t, frame, visiting] of [[0.9, 100, 0], [0.9, 0, 0], [0.3, 100, 0], [0.9, 100, 1]]) {
      const { ctx, log, images } = fakeContext()
      render(ctx, sceneSnapshot(visiting ? { ...EVERYTHING, visitor: 'editor', visitorProp: 'contract' } : EVERYTHING), t, frame, art)
      // the loft: its room, the doorway and four more props (the anime poster hides the stock one), every piece of
      // equipment but the pen tablet in its own place in the order, then the loft's front row (the characters are cache
      // images too, left out here)
      expect(images.filter((i) => !i.id.startsWith('cast/')).map((i) => i.id), `t ${t} frame ${frame}`).toEqual([
        'room/loft', 'kitchenette', 'window', 'coffee-machine', 'bookshelf', 'reference-shelf', 'bed', 'doorway',
        'tall-chair', 'drafting-table', 'arm-lamp', 'floor-lamp', 'sofa', 'bin',
      ])
      expect(log.length, `t ${t} frame ${frame}`).toBeGreaterThan(FULL_ART_BASELINE)
      expect(log.length, `t ${t} frame ${frame}`).toBeLessThan(budget)
      if (visiting) expect(log, `t ${t} frame ${frame}`).toHaveLength(VISIT_ART_BASELINE)
      most = Math.max(most, log.length)
    }
    // no other scene has overtaken the pinned one
    expect(most).toBe(VISIT_ART_BASELINE)
  })

  it('replaces the stock lamp, chair, desk and poster instead of painting over them', () => {
    const stock = paint()
    const replaced: [Partial<Snapshot>, FillCall[]][] = [
      [{ owned: { ...NONE, lamp: true } }, [
        { style: '#3b3b45', x: 164, y: 86, w: 1, h: 12 },
        { style: '#3fa66c', x: 160, y: 83, w: 9, h: 4 },
        { style: '#fff2a8', x: 161, y: 87, w: 7, h: 2 },
      ]],
      [{ owned: { ...NONE, chair: true } }, [
        { style: '#4a4a55', x: 134, y: 90, w: 20, h: 4 },
        { style: '#4a4a55', x: 135, y: 94, w: 2, h: 14 },
        { style: '#4a4a55', x: 151, y: 94, w: 2, h: 14 },
      ]],
      [{ owned: { ...NONE, 'drafting-table': true } }, [
        { style: '#8b5a2b', x: 116, y: 98, w: 58, h: 4 },
        { style: '#70461f', x: 116, y: 102, w: 58, h: 14 },
        { style: '#5a3618', x: 118, y: 102, w: 2, h: 16 },
        { style: '#5a3618', x: 170, y: 102, w: 2, h: 16 },
        { style: '#5a3618', x: 124, y: 106, w: 20, h: 8 },
        { style: '#8b5a2b', x: 126, y: 108, w: 16, h: 1 },
        { style: '#8b5a2b', x: 126, y: 111, w: 16, h: 1 },
      ]],
      [{ animePoster: true }, [
        { style: '#fff', x: 116, y: 50, w: 22, h: 28 },
        { style: '#e5484d', x: 118, y: 52, w: 18, h: 24 },
        { style: '#fff', x: 121, y: 58, w: 12, h: 12 },
        { style: '#16161a', x: 124, y: 61, w: 6, h: 6 },
      ]],
    ]
    for (const [over, piece] of replaced) {
      const log = paint(over)
      for (const c of piece) {
        expect(stock, JSON.stringify(c)).toContainEqual(c)
        expect(log, `${JSON.stringify(over)}: ${JSON.stringify(c)}`).not.toContainEqual(c)
      }
    }
  })

  it('moves the ink pot right, off the pen tablet (x 154 to 160)', () => {
    const inkPot = (x: number): FillCall[] => [
      { style: '#1b1b1b', x, y: 94, w: 4, h: 4 },
      { style: '#1b1b1b', x: x + 1, y: 93, w: 2, h: 1 },
    ]
    const stock = paint()
    const tablet = paint({ owned: { ...NONE, tablet: true } })
    for (const c of inkPot(154)) {
      expect(stock).toContainEqual(c)
      expect(tablet).not.toContainEqual(c)
    }
    for (const c of inkPot(160)) expect(tablet).toContainEqual(c)
  })
})

describe('the studio art', () => {
  it('has art for every piece of equipment and every tier, and the apartment paints its plain front door', () => {
    expect(Object.keys(EQUIPMENT_ART).sort()).toEqual(['chair', 'coffee', 'drafting-table', 'lamp', 'shelf', 'tablet'])
    expect(Object.keys(TIER_ART).sort()).toEqual(['apartment', 'flat', 'loft'])
    expect(Object.keys(TIER_DOOR).sort()).toEqual(['apartment', 'flat', 'loft'])
    expect([TIER_DOOR.apartment.id, TIER_DOOR.flat.id, TIER_DOOR.loft.id]).toEqual(['door', 'doorway', 'doorway'])
    for (const [frame, night] of CALLS) {
      const door = alone((ctx) => tierRoom('apartment', ctx, FULL, frame, night))
      expect(door).toHaveLength(5)
      expectInside(door, [DOORWAY], `apartment frame ${frame} night ${night}`)
      expect(door.some((c) => c.style === DOOR_LIGHT)).toBe(false)
    }
  })

  it('paints the kitchenette in 17 fills inside x 2-61, y 56-113', () => {
    const log = alone((ctx) => drawKitchenette(ctx))
    expect(log).toHaveLength(17)
    for (const c of log) expect(inBox(c, [2, 61, 56, 113]), JSON.stringify(c)).toBe(true)
  })

  it('hangs the coat on the rack by the door only while the mangaka is in', () => {
    const coat = { style: '#2e3a78', x: 287, y: 73, w: 5, h: 14 }
    const home = alone((ctx) => drawEntrance(ctx, false))
    const away = alone((ctx) => drawEntrance(ctx, true))
    expect(home).toContainEqual(coat)
    expect(away).not.toContainEqual(coat)
    for (const c of [...home, ...away]) expect(inBox(c, [257, 291, 70, 116]), JSON.stringify(c)).toBe(true)
  })

  it('keeps each piece of equipment inside its region from the brief', () => {
    for (const id of EQUIPMENT_IDS) {
      for (const [frame, night] of CALLS) {
        const log = alone((ctx) => EQUIPMENT_ART[id](ctx, FULL, frame, night))
        expectInside(log, EQUIPMENT_REGION[id], `${id} frame ${frame} night ${night}`)
      }
    }
    // the drafting table has its lightbox
    const table = alone((ctx) => EQUIPMENT_ART['drafting-table'](ctx, FULL, 0, false))
    expect(table.some((c) => inBox(c, LIGHTBOX))).toBe(true)
  })

  it('keeps the doorway and the loft\'s two plants inside their regions', () => {
    for (const tier of ['flat', 'loft'] as const) {
      for (const [frame, night] of CALLS) {
        const log = alone((ctx) => tierRoom(tier, ctx, FULL, frame, night))
        expectInside(log, TIER_REGION[tier], `${tier} frame ${frame} night ${night}`)
        // something in every region: the doorway, and in the loft the sill plant and the floor plant too
        for (const box of TIER_REGION[tier]) expect(log.some((c) => inBox(c, box)), `${tier} ${box.join(' ')}`).toBe(true)
      }
    }
  })

  it('keeps the volumes, the anime poster, the trophies and the lights inside their regions', () => {
    expectInside(alone((ctx) => drawVolumes(ctx, 24)), [VOLUMES], 'volumes')
    expectInside(alone((ctx) => drawAnimePoster(ctx)), [POSTER], 'anime poster')
    expectInside(alone((ctx) => drawTrophies(ctx, 4)), [TROPHIES], 'trophies')
    const lights = alone((ctx) => drawStudioLights(ctx, FULL, true, true))
    expectInside(lights, [EQUIPMENT_REGION.lamp[0], DOORWAY], 'lights')
  })

  it('keeps off the hero at the desk (but for the chair behind and the table in front) and at the standing spot', () => {
    const pieces: [string, FillCall[]][] = [
      ...EQUIPMENT_IDS.map((id): [string, FillCall[]] => [id, alone((ctx) => EQUIPMENT_ART[id](ctx, FULL, 100, true))]),
      ['flat', alone((ctx) => tierRoom('flat', ctx, FULL, 100, true))],
      ['loft', alone((ctx) => tierRoom('loft', ctx, FULL, 100, true))],
      ['volumes', alone((ctx) => drawVolumes(ctx, 24))],
      ['anime poster', alone((ctx) => drawAnimePoster(ctx))],
      ['trophies', alone((ctx) => drawTrophies(ctx, 4))],
      ['lights', alone((ctx) => drawStudioLights(ctx, FULL, true, true))],
    ]
    for (const [what, log] of pieces) {
      for (const c of log) {
        const where = `${what}: ${JSON.stringify(c)}`
        // the drafting table's top overhangs to x 175, under the standing mangaka's leading arm (drawn after it)
        expect(overlaps(c, what === 'drafting-table' ? [176, 201, 81, 128] : STANDING), where).toBe(false)
        expect(overlaps(c, EDITOR_SPOT_BOX), where).toBe(false)
        // the mangaka sits in the chair, drawn over it, and in front of the poster on the wall (x 116-137, y 50-77)
        if (what === 'chair' || what === 'anime poster') continue
        // the drafting table stands in the desk's place: its top (y 98) runs under the waist line, as the desk's does;
        // the pen tablet (x 150-159, y 96-97) lies inside the seated box, right of the pen hand (x 124-149)
        const box: Box = what === 'tablet' ? [124, 149, 58, 97] : SEATED
        expect(overlaps(c, box), where).toBe(false)
      }
    }
  })

  it('stands one spine per volume on the bookshelf, in sets of six, at most 24', () => {
    const spines = (n: number) => alone((ctx) => drawVolumes(ctx, n))
    expect(spines(0)).toEqual([])
    expect(spines(3).map((c) => c.x)).toEqual([74, 75, 76])
    expect(spines(7).map((c) => c.x)).toEqual([74, 75, 76, 77, 78, 79, 81])
    const shelf = spines(24)
    expect(shelf).toHaveLength(24)
    expect(shelf[23].x).toBe(100)
    expect(spines(30)).toEqual(shelf)
    for (const c of shelf) expect([c.w, c.y, c.h]).toEqual([1, 49, 5])
    // neighbours never share a colour
    for (let i = 1; i < shelf.length; i++) expect(shelf[i].style, `spine ${i}`).not.toBe(shelf[i - 1].style)
  })

  it('puts one gold trophy per award on the sill, 3 px wide with 1 px gaps, at most 4', () => {
    const cups = (n: number) => alone((ctx) => drawTrophies(ctx, n)).filter((c) => c.style === '#f5b700' && c.w === 3)
    expect(alone((ctx) => drawTrophies(ctx, 0))).toEqual([])
    expect(cups(1).map((c) => c.x)).toEqual([194])
    expect(cups(4).map((c) => c.x)).toEqual([194, 198, 202, 206])
    expect(alone((ctx) => drawTrophies(ctx, 6))).toEqual(alone((ctx) => drawTrophies(ctx, 4)))
    // each trophy keeps to its own 3 columns, so x 197, 201 and 205 stay empty
    for (const c of alone((ctx) => drawTrophies(ctx, 4))) {
      const k = Math.floor((c.x - 194) / 4)
      expect(c.x >= 194 + 4 * k && c.x + c.w <= 197 + 4 * k, JSON.stringify(c)).toBe(true)
    }
  })

  it('lights the arm lamp at night or while working, and not on an idle day', () => {
    const glow = (owned: Record<EquipmentId, boolean>, night: boolean, working: boolean) =>
      alone((ctx) => drawStudioLights(ctx, sceneSnapshot({ owned }), night, working)).filter((c) => c.style === LAMP_GLOW)
    const lamp = { ...NONE, lamp: true }
    expect(glow(lamp, false, false)).toEqual([])
    expect(glow(lamp, true, false).length).toBeGreaterThan(0)
    expect(glow(lamp, false, true).length).toBeGreaterThan(0)
    expect(glow(NONE, true, true)).toEqual([])
  })

  it("puts the arm lamp's bulb on the lamp sprite's once its image is ready (its glow below is the same), else keeps the old bulb", () => {
    const bulb = '#fff2a8'
    const lights = (lampImage: boolean) =>
      alone((ctx) => drawStudioLights(ctx, sceneSnapshot({ owned: { ...NONE, lamp: true } }), true, false, false, lampImage))
    const glow = (log: FillCall[]) => log.filter((c) => c.style === LAMP_GLOW)
    expect(lights(false).filter((c) => c.style === bulb)).toEqual([{ style: bulb, x: 158, y: 83, w: 4, h: 1 }])
    // the sprite's bulb: the opening under its shade, cols 1-5 of row 5
    const b = PROP_BOX['arm-lamp']
    expect(lights(true).filter((c) => c.style === bulb)).toEqual([{ style: bulb, x: b.x + 1, y: b.y + 5, w: 5, h: 1 }])
    expect(glow(lights(true))).toEqual(glow(lights(false)))
    // render tells it whether the image is ready
    const { ctx, log } = fakeContext()
    render(ctx, sceneSnapshot({ owned: { ...NONE, lamp: true } }), 0.9, 100, fakeSceneArt())
    expect(log.filter((c) => c.style === bulb)).toEqual([{ style: bulb, x: 157, y: 83, w: 5, h: 1 }])
  })

  it('spills warm light from the doorway at night, in the flat and the loft only', () => {
    const lights = (tier: StudioTierId, night: boolean) =>
      alone((ctx) => drawStudioLights(ctx, sceneSnapshot({ tier }), night, false))
    for (const tier of ['flat', 'loft'] as const) expectInside(lights(tier, true), [DOORWAY], `${tier} at night`)
    expect(lights('flat', false)).toEqual([])
    expect(lights('apartment', true)).toEqual([])
  })

  it("keys the doorway's night halo and spill to the doorway sprite once its image is ready, else keeps the old rects", () => {
    const halo = 'rgba(255,214,150,0.12)'
    const spill = 'rgba(255,214,150,0.35)'
    const [bx, by, bw, bh] = [PROP_BOX.doorway.x, PROP_BOX.doorway.y, PROP_BOX.doorway.w, PROP_BOX.doorway.h]
    const sprite: Box = [bx, bx + bw - 1, by, by + bh - 1]
    for (const tier of ['flat', 'loft'] as const) {
      const plain = paint({ tier }, 0.9)
      expect(plain, tier).toContainEqual({ style: halo, x: 258, y: 66, w: 17, h: 48 })
      expect(plain, tier).toContainEqual({ style: spill, x: 260, y: 71, w: 13, h: 43 })
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot({ tier }), 0.9, 100, fakeSceneArt())
      const lit = log.filter((c) => c.style === halo || c.style === spill)
      expect(lit.map((c) => c.style), tier).toEqual([halo, spill])
      for (const c of lit) expect(inBox(c, sprite), `${tier} ${JSON.stringify(c)}`).toBe(true)
      // the halo takes in the noren's hem, the spill only the opening below it
      expect(lit[0], tier).toEqual({ style: halo, x: 255, y: 87, w: 23, h: 27 })
      expect(lit[1], tier).toEqual({ style: spill, x: 256, y: 92, w: 21, h: 22 })
    }
  })

  it('widens the doormat across the door sprite once its image is ready, and keeps the old mat without it', () => {
    const mat = (c: FillCall) => c.y === 114 && c.h === 3
    expect(paint({}).filter(mat)).toEqual([{ style: '#c94b4b', x: 257, y: 114, w: 19, h: 3 }])
    for (const tier of ['apartment', 'flat', 'loft'] as const) {
      const { ctx, log } = fakeContext()
      render(ctx, sceneSnapshot({ tier }), 0.3, 100, fakeSceneArt())
      const box = PROP_BOX[TIER_DOOR[tier].id]
      expect(log.filter(mat), tier).toEqual([{ style: '#c94b4b', x: box.x, y: 114, w: box.w, h: 3 }])
      expect(log, tier).toContainEqual({ style: '#a83c3c', x: box.x + 2, y: 115, w: box.w - 4, h: 1 })
    }
  })

  it('turns the owned list into one flag per piece of equipment', () => {
    expect(ownedFlags([])).toEqual(NONE)
    expect(ownedFlags(['tablet', 'lamp'])).toEqual({ ...NONE, lamp: true, tablet: true })
    expect(ownedFlags([...EQUIPMENT_IDS])).toEqual(ALL)
  })
})

describe('the studio\'s draw order', () => {
  it('puts the sill things in front of the window bars and the sill snow', () => {
    const log = paint(EVERYTHING, 0.9, 100)
    const bar = log.findIndex((c) => c.x === 203 && c.y === 48 && c.w === 2 && c.h === 32)
    const snow = log.findIndex((c) => c.style === '#f4f8ff' && c.x === 178 && c.y === 81 && c.w === 52 && c.h === 1)
    expect(bar).toBeGreaterThan(-1)
    expect(snow).toBeGreaterThan(bar)
    const sill = [
      ...alone((ctx) => EQUIPMENT_ART.coffee(ctx, FULL, 100, true)),
      ...alone((ctx) => drawTrophies(ctx, 4)),
      ...alone((ctx) => tierRoom('loft', ctx, FULL, 100, true)).filter((c) => inBox(c, SILL_PLANT)),
    ]
    for (const i of at(log, sill)) expect(i).toBeGreaterThan(snow)
  })

  it('seats the hero in the tall chair (drawn before the hero) behind the drafting table (drawn after)', () => {
    const { ctx, log, images } = fakeContext()
    render(ctx, sceneSnapshot(EVERYTHING), 0.3, 100)
    // the seated mangaka's cached frame, drawn at the seat (124, 58) (its rows 0-39 again after the page stack)
    const seated = images.find((i) => i.id === 'cast/seat.draw-a~open.closed.none/pal')
    expect(seated).toBeDefined()
    const hero = seated!.at
    for (const i of at(log, alone((ctx) => EQUIPMENT_ART.chair(ctx, FULL, 100, false)))) {
      expect(i).toBeGreaterThan(-1)
      expect(i).toBeLessThan(hero)
    }
    for (const i of at(log, alone((ctx) => EQUIPMENT_ART['drafting-table'](ctx, FULL, 100, false)))) {
      expect(i).toBeGreaterThanOrEqual(hero)
    }
  })

  it('lights the lamp and the doorway after the night overlay, so they glow', () => {
    const log = paint(EVERYTHING, 0.9, 100)
    const overlay = log.findIndex((c) => c.style === 'rgba(20, 24, 60, 0.28)')
    expect(overlay).toBeGreaterThan(-1)
    const lights = alone((ctx) => drawStudioLights(ctx, FULL, true, true))
    expect(lights.some((c) => c.style === LAMP_GLOW)).toBe(true)
    expect(lights.some((c) => inBox(c, DOORWAY))).toBe(true)
    for (const i of at(log, lights)) expect(i).toBeGreaterThan(overlay)
  })

  it('stands the loft\'s floor plant in front of the bed, and the sleeper\'s Zz in front of the doorway', () => {
    const log = paint(EVERYTHING, 0.3, 100)
    const bed = log.findIndex((c) => c.style === '#6d4c33' && c.x === 192 && c.y === 102 && c.w === 58 && c.h === 26)
    expect(bed).toBeGreaterThan(-1)
    const plant = alone((ctx) => tierRoom('loft', ctx, FULL, 100, false)).filter((c) => inBox(c, FLOOR_PLANT))
    for (const i of at(log, plant)) expect(i).toBeGreaterThan(bed)
    // a rest day in the drawing phase: the mangaka sleeps, and at frame 100 three Zs rise from x 234
    const resting = paint({ tier: 'flat', activity: 'rest' }, 0.3, 100)
    const doorway = at(resting, alone((ctx) => tierRoom('flat', ctx, FULL, 100, false)))
    for (const i of doorway) expect(i).toBeGreaterThan(-1)
    const zz = resting.flatMap((c, i) => (c.style === '#2f5ecf' && c.x >= 234 ? [i] : []))
    expect(zz.length).toBeGreaterThan(0)
    expect(Math.min(...zz)).toBeGreaterThan(Math.max(...doorway))
  })

  it('sways the top leaf of the loft floor plant every 30 frames, inside the plant', () => {
    const leaf = (frame: number) => alone((ctx) => tierRoom('loft', ctx, FULL, frame, false))
      .filter((c) => c.style === '#5fbf6a' && c.y === 116 && c.w === 3 && c.h === 3)
    expect(leaf(0)).toEqual([{ style: '#5fbf6a', x: 240, y: 116, w: 3, h: 3 }])
    expect(leaf(30)).toEqual([{ style: '#5fbf6a', x: 241, y: 116, w: 3, h: 3 }])
    for (const f of [0, 30]) for (const c of leaf(f)) expect(inBox(c, FLOOR_PLANT)).toBe(true)
  })
})
