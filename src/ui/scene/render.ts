// The studio scene's painter: palettes, sprites and their helpers, the snapshot it reads and `render`, one frame of the
// 320x180 canvas (room-space literals, offset by paint.ts's OX/OY; the wall and floor in canvas space). Pure drawing: no React, no store, and nothing allocated per frame (tables are built once here).
// Generated images come in as a `SceneArt` (sceneArt.ts): a ready room image replaces the code-drawn shell and a ready
// prop image replaces its piece at the same footprint and the same place in the draw order. This module never imports
// the art registry.
import type { EquipmentId, StudioTierId } from '../../sim'
import { ASSISTANT_SEAT_X, MANGAKA_BED_FRAME, MANGAKA_SEAT, RIG_LIVE } from './actors'
import type { Actor, ActorTable, Spot } from './actors'
import { baseAnimFor } from './castPlay'
import type { CastContext, CastWho } from './castPlay'
import type { ReactionCue } from './reactions'
import { ANIMS } from './rig/anims'
import { frontHand, rigFrame } from './rig/frames'
import { POSES } from './rig/poses'
import { VISIT_PROPS } from './rig/props'
import type { PoseDef, PoseId } from './rig/poses'
import { PROP_CONTRACT, PROP_ENVELOPE, PROP_LETTER, PROP_PAL, PROP_TROPHY, drawSprite } from './sprites'
import { OLD_CAST } from './oldCast'
import { drawCast, drawCastTop, getCastCache, lookPalette, outfitPalette } from './spriteCache'
import type { CastFrame, PaletteId, SpriteCache } from './spriteCache'
import { catFrame, moodOf } from './mood'
import type { Mood, MoodInput } from './mood'
import { BAR_X, paneRect, rawRect, rect, shadow } from './paint'
import { drawSeasonNight, drawSeasonPane, drawSeasonSill, drawSeasonWall } from './season'
import type { Season } from './season'
import {
  ARM_LAMP_BOX, ARM_LAMP_FOOTPRINT, COFFEE_MACHINE_BOX, COFFEE_MACHINE_FOOTPRINT, DOORWAY_BOX, DOORWAY_FOOTPRINT, DOOR_BOX,
  DOOR_FOOTPRINT, DRAFTING_TABLE_BOX, DRAFTING_TABLE_FOOTPRINT, EQUIPMENT_ART, EQUIPMENT_SPRITE, KITCHENETTE_FOOTPRINT,
  REFERENCE_SHELF_BOX, REFERENCE_SHELF_FOOTPRINT, TALL_CHAIR_BOX, TALL_CHAIR_FOOTPRINT, TIER_ART, TIER_DOOR,
  drawAnimePoster, drawEntrance, drawKitchenette, drawStudioLights, drawTrophies, drawVolumes,
} from './studioArt'
import type { Owned } from './studioArt'
import {
  FRONT_BOX, FRONT_FOOTPRINT, TIER_FLOOR, TIER_FRONT, drawAmbient, drawCalendar, drawCorkboard, drawCups, drawFanLetters, drawRoomShell, drawSeriesPoster,
} from './roomArt'
import { NO_ART, PROP_SPRITE, ROOM_NIGHT_DIM, drawProp, hangSprite, ready, spriteBox } from './sceneArt'
import type { Fallback, Footprint, SceneArt, ScenePropId } from './sceneArt'
import type { StoryLook } from './story'

export const W = 320
export const H = 180
/** The wall's height in canvas rows (0-113): a room image covers it, and each tier's code-drawn floor starts below it. */
export const WALL_H = 114

// ---------- palette & sprites ----------

const BOOK_COLS = ['#c94b4b', '#3b6fd6', '#3fa66c', '#f5b700', '#7c4dff', '#e07b39']

/** The cat's round cushion on the blanket (mustard, the cardigan's colours). */
const CUSHION = '#c9a24a'
const CUSHION_SHADE = '#a8832f'

/** The wall clock (7x7): the rim and the face, with its 12 and 6 marks. */
const CLOCK = [
  '.DDDDD.',
  'DWWDWWD',
  'DWWWWWD',
  'DDWWWDD',
  'DWWWWWD',
  'DWWDWWD',
  '.DDDDD.',
]
const CLOCK_PAL: Record<string, string> = { D: '#3b3b45', W: '#f6f6f6' }
const CLOCK_X = 156
const CLOCK_Y = 52
/** The minute hand per direction 0-7 clockwise from 12: x, y, w, h from the clock's corner. */
const HAND_LONG = Int8Array.from([3, 1, 1, 2, 4, 2, 1, 1, 4, 3, 2, 1, 4, 4, 1, 1, 3, 4, 1, 2, 2, 4, 1, 1, 1, 3, 2, 1, 2, 2, 1, 1])
/** The hour hand per direction: one pixel at x, y. */
const HAND_SHORT = Int8Array.from([3, 2, 4, 2, 4, 3, 4, 4, 3, 4, 2, 4, 2, 3, 2, 2])

/** The wall clock: the minute hand laps 8 times a visual week (t), the hour hand twice. */
function drawClock(ctx: CanvasRenderingContext2D, t: number) {
  drawSprite(ctx, CLOCK, CLOCK_X, CLOCK_Y, 7, CLOCK_PAL)
  const m = (Math.floor(t * 64) % 8) * 4
  const h = (Math.floor(t * 16) % 8) * 2
  rawRect(ctx, CLOCK_X + HAND_LONG[m], CLOCK_Y + HAND_LONG[m + 1], HAND_LONG[m + 2], HAND_LONG[m + 3], '#1b1b1b')
  rawRect(ctx, CLOCK_X + HAND_SHORT[h], CLOCK_Y + HAND_SHORT[h + 1], 1, 1, '#1b1b1b')
}

const GLYPH: Record<string, string[]> = {
  Z: ['###', '..#', '.#.', '#..', '###'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '.': ['...', '...', '...', '...', '.#.'],
  '?': ['###', '..#', '.##', '...', '.#.'],
}
/** A 3x5 glyph in canvas space, its top-left at (x, y) rounded. */
function glyph(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, color: string) {
  const g = GLYPH[ch]
  if (!g) return
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  ctx.fillStyle = color
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r][c] === '#') ctx.fillRect(x0 + c, y0 + r, 1, 1)
}

/**
 * One scratch object moodOf reads from, mutated field by field before each call so render allocates nothing per
 * frame; `home` is true at every call site (the mangaka or an assistant, always in the studio when this runs). The
 * mood's face and mark are baked into each rig frame (`rigFrame`), so no overlay is drawn over a character.
 */
const moodScratch: MoodInput = { home: true, editorHere: false, cheer: false, stamina: 0, lateNight: false }

/** moodOf via the shared scratch object: no per-frame `{...}` literal. */
function moodFor(editorHere: boolean, cheer: boolean, stamina: number, lateNight: boolean): Mood {
  moodScratch.editorHere = editorHere
  moodScratch.cheer = cheer
  moodScratch.stamina = stamina
  moodScratch.lateNight = lateNight
  return moodOf(moodScratch)
}

// ---------- the characters (canvas space, from the actor table) ----------

const PROP_PAPER = '#fdfcf7'
const PROP_LINE = '#b8b2a5'

/** What the standing editor holds in the leading hand (row 22: the envelope at y + 20, the others at y + 18; sprites in
 * PROP_PAL), and the ! bobbing above them. */
function drawVisitorProp(ctx: CanvasRenderingContext2D, prop: Snapshot['visitorProp'], x: number, y: number, frame: number) {
  switch (prop) {
    case 'envelope': drawSprite(ctx, PROP_ENVELOPE, x - 2, y + 20, 4, PROP_PAL); break
    case 'letter': drawSprite(ctx, PROP_LETTER, x - 2, y + 18, 6, PROP_PAL); break
    case 'contract': drawSprite(ctx, PROP_CONTRACT, x - 2, y + 18, 7, PROP_PAL); break
    case 'trophy': drawSprite(ctx, PROP_TROPHY, x - 2, y + 18, 6, PROP_PAL); break
    case 'none': return
  }
  glyph(ctx, '!', x + 11, y - 8 - (Math.floor(frame / 16) % 2), '#e5484d')
}

/** The scene is drawing: at the desk, with the clock running (render's `working`, shared with the cast driver). */
export function workingOf(s: Snapshot): boolean {
  const absent = s.away || s.activity === 'job'
  return !absent && s.phase === 'drawing' && s.activity === 'work' && s.stamina > 0 && s.running
}

/**
 * Where a rig pose is drawn: at the actor, the seat's half pose at the seat, the bed's frames at their own origin
 * (`MANGAKA_BED_FRAME`, 19 px left of the actor's bed spot, which stands on the lying head).
 */
export function poseOrigin(at: PoseDef['at'], a: Spot): Spot {
  return at === 'actor' ? a : at === 'seat' ? MANGAKA_SEAT : MANGAKA_BED_FRAME
}

/** The assistants' desks: from 2 px left of the first seat, 36 wide for one, 34 more per further assistant. */
const ASSISTANT_DESKS = [36, 70, 104].map((w) => ({ x: ASSISTANT_SEAT_X[0] - 2, w }))

/** The assistants' desk under `shown` (1-3) seats, a constant (nothing allocated per frame). */
export function assistantDesk(shown: number): { x: number; w: number } {
  return ASSISTANT_DESKS[shown - 1]
}

/** The rig's mark slot column in a frame (the head at col 4, its slot at col 24): the '!' and '?' go there. */
const RIG_MARK_X = 28
/** The standing loop's own poses: the idle '?' shows only on them, never mid-moment. */
const STAND_POSES: ReadonlySet<PoseId> = new Set(ANIMS.stand.steps.map((st) => st.pose))
/** The sleep loop's lying poses: the Zs rise only over them, never over the sitting-up frame of lying down. */
const SLEEP_POSES: ReadonlySet<PoseId> = new Set(ANIMS.sleep.steps.map((st) => st.pose))
const castCtx: CastContext = { working: false, late: false, ready: false }

/** The seated frame's rows above the desk top's line (row 40, y 98 at the seat): drawn a second time over the pages. */
const SEAT_TOP_ROWS = 40
/**
 * The seated rig mangaka as `drawRigMangaka` drew it this frame (its frame, palette and place), for the second draw of
 * its rows 0-39 over the page stack; `render` clears it at the start of every frame. Mutated, never rebuilt.
 */
const seatedTop: { frame: CastFrame | null; pal: PaletteId; x: number; y: number } = { frame: null, pal: 'pal', x: 0, y: 0 }

/**
 * The pose an actor shows: the one the cast driver set, else (a settled table, reduced motion) its base loop's first;
 * '' when it has none (away or hidden).
 */
function poseOf(a: Actor, who: CastWho, s: Snapshot, working: boolean): PoseId | '' {
  if (a.pose) return a.pose
  castCtx.working = working
  castCtx.late = s.late
  castCtx.ready = s.phase === 'ready'
  const base = baseAnimFor(who, a.state, castCtx)
  return base === null ? '' : ANIMS[base].steps[0].pose
}

/** The rig mangaka: its frame (the mood's face baked in), the shadow under its feet, the bed's blanket and Zz, the ! or ?. */
function drawRigMangaka(
  ctx: CanvasRenderingContext2D, cast: SpriteCache, s: Snapshot, a: Actor, pose: PoseId, frame: number, working: boolean, night: boolean,
) {
  const def = POSES[pose]
  const ready = s.phase === 'ready' && a.state === 'standing'
  const mood = a.state === 'sleeping' ? 'neutral' : moodFor(s.actors.editor.state === 'standing', s.cheer, s.stamina, night && working && a.state === 'seated')
  const o = poseOrigin(def.at, a)
  // a pose drawn at the seat or the bed (a transition while the actor already walks) has no feet under the actor
  const afoot = def.at === 'actor' && (a.state === 'standing' || a.state === 'walking')
  if (afoot) shadow(ctx, a.x + 6, a.y + 46, 20)
  const castFrame = rigFrame(pose, mood, ready)
  const pal = outfitPalette(s.level)
  drawCast(ctx, cast, castFrame, pal, o.x, o.y, afoot && a.state === 'walking' && a.facing === 1)
  if (a.state === 'seated' && def.at === 'actor') {
    // remembered for its rows 0-39 again over the page stack (render, after the stack's lines)
    seatedTop.frame = castFrame
    seatedTop.pal = pal
    seatedTop.x = o.x
    seatedTop.y = o.y
  }
  if (def.at === 'bed') {
    // the blanket over the shoulders, up to the lying head's left edge (x 224)
    rawRect(ctx, 196, 112, 29, 10, '#c94b4b')
    rawRect(ctx, 196, 112, 29, 2, '#a83c3c')
  }
  if (a.state === 'sleeping' && SLEEP_POSES.has(pose)) {
    // beside the lying head, from the bed frame's (36, 2), clear of it (the lying head starts on row 8)
    const zz = Math.floor(frame / 20) % 3
    for (let i = 0; i <= zz; i++) glyph(ctx, 'Z', o.x + 36 + i * 3, o.y + 2 - i * 4, '#2f5ecf')
  }
  if (a.state === 'standing') {
    if (ready) glyph(ctx, '!', a.x + RIG_MARK_X, a.y, '#e5484d')
    else if (mood === 'neutral' && STAND_POSES.has(pose) && frame % 120 < 40) glyph(ctx, '?', a.x + RIG_MARK_X, a.y, '#2f5ecf')
  }
}

/**
 * The mangaka, always from the rig (since 0.11.0's task 17): the pose the cast driver set, or its base loop's first
 * step on a settled table (reduced motion), one drawImage from the sprite cache (`cast`) by `drawRigMangaka`; nothing
 * while away or hidden. Called twice: before the desk (paints only when y < 75: seated, behind the desk top, or at
 * its door) and after it (only when y >= 75: standing, walking or in bed, in front of it).
 */
function drawMangaka(
  ctx: CanvasRenderingContext2D, s: Snapshot, a: Actor, frame: number, working: boolean, front: boolean, night: boolean,
  cast: SpriteCache,
) {
  if ((a.y >= 75) !== front) return
  const pose = poseOf(a, 'mangaka', s, working)
  if (pose) drawRigMangaka(ctx, cast, s, a, pose, frame, working, night)
}

/** The 0.10 editor (until the 0.12.0 switch): his idle or walk frames, mirrored facing right, the code-drawn prop and the ! standing facing left. */
function drawOldEditor(ctx: CanvasRenderingContext2D, cast: SpriteCache, s: Snapshot, editor: Actor, frame: number) {
  const flip = editor.facing === 1
  shadow(ctx, editor.x + 4, editor.y + 30, 16)
  if (editor.state === 'walking') drawCast(ctx, cast, OLD_CAST.editorWalk[Math.floor(editor.anim / 100) % 4], 'pal', editor.x, editor.y, flip)
  else drawCast(ctx, cast, OLD_CAST.editorIdle[Math.floor(frame / 16) % 2], 'pal', editor.x, editor.y, flip)
  if (s.visitor === 'editor' && editor.state === 'standing' && editor.facing === -1) drawVisitorProp(ctx, s.visitorProp, editor.x, editor.y, frame)
}

/**
 * The rig editor (0.12.0): the pose the cast driver set (or his base loop's first step), one drawImage of its neutral
 * frame in the editor's palette, mirrored facing right, over a 20 px contact shadow; standing at the spot facing the
 * desk with something to deliver, the visit's prop (rig/props.ts) at the pose's front hand (its hand cell on the
 * hand's), drawn after the body, and the ! bobbing in the rig's mark slot.
 */
function drawRigEditor(ctx: CanvasRenderingContext2D, cast: SpriteCache, s: Snapshot, editor: Actor, frame: number, working: boolean) {
  const pose = poseOf(editor, 'editor', s, working)
  if (!pose) return
  shadow(ctx, editor.x + 6, editor.y + 46, 20)
  drawCast(ctx, cast, rigFrame(pose, 'neutral', false), 'editor', editor.x, editor.y, editor.facing === 1)
  if (s.visitor !== 'editor' || editor.state !== 'standing' || editor.facing !== -1 || s.visitorProp === 'none') return
  const hand = frontHand(pose)
  const p = VISIT_PROPS[s.visitorProp]
  const held = p.anchors.hand
  if (hand && held) drawCast(ctx, cast, p.frame, 'editor', editor.x + hand.x - held.x, editor.y + hand.y - held.y, false)
  glyph(ctx, '!', editor.x + RIG_MARK_X, editor.y - (Math.floor(frame / 16) % 2), '#e5484d')
}

// ---------- the props (each a generated sprite when one is ready, else these fills) ----------

/** The window's frame (room 116,10 48x36; canvas x 180-227, y 46-81); the pane, sky, bars and sill paint over it. */
export const WINDOW_FOOTPRINT: Footprint = { x: 180, y: 46, w: 48, h: 36 }
function windowFrame(ctx: CanvasRenderingContext2D) {
  rect(ctx, 116, 10, 48, 36, '#5a4634')
}

/** The bookshelf (room 8,18 34x58; canvas x 72-105, y 54-111): its frame, back, four boards and the stock books. */
export const BOOKSHELF_FOOTPRINT: Footprint = { x: 72, y: 54, w: 34, h: 58 }
function bookshelf(ctx: CanvasRenderingContext2D) {
  rect(ctx, 8, 18, 34, 58, '#6d4c33')
  rect(ctx, 10, 20, 30, 54, '#8b6543')
  for (let shelf = 0; shelf < 4; shelf++) {
    const y = 22 + shelf * 13
    rect(ctx, 10, y + 11, 30, 2, '#5a3d28')
    for (let b = 0; b < 7; b++) {
      const bh = 7 + ((b * 3 + shelf) % 4)
      rect(ctx, 11 + b * 4, y + 11 - bh, 3, bh, BOOK_COLS[(b + shelf) % BOOK_COLS.length])
    }
  }
}

/** The stock poster (room 52,14 22x28; canvas x 116-137, y 50-77), while no serial or anime takes its place. */
export const POSTER_FOOTPRINT: Footprint = { x: 116, y: 50, w: 22, h: 28 }
function stockPoster(ctx: CanvasRenderingContext2D) {
  rect(ctx, 52, 14, 22, 28, '#fff'); rect(ctx, 54, 16, 18, 24, '#e5484d'); rect(ctx, 57, 22, 12, 12, '#fff'); rect(ctx, 60, 25, 6, 6, '#16161a')
}

/** The bed (room 128,66 58x26; canvas x 192-249, y 102-127): its frame, sheet, pillow and blanket with its fold. */
export const BED_FOOTPRINT: Footprint = { x: 192, y: 102, w: 58, h: 26 }
function bed(ctx: CanvasRenderingContext2D) {
  rect(ctx, 128, 66, 58, 26, '#6d4c33')
  rect(ctx, 130, 68, 54, 20, '#f0ead6')
  rect(ctx, 168, 70, 14, 8, '#ffffff')
  rect(ctx, 130, 74, 40, 14, '#c94b4b')
  rect(ctx, 130, 74, 40, 2, '#a83c3c')
}

/**
 * The stock desk (room 52,62 58x20; canvas x 116-173, y 98-117): its top (y 98, where the pages, the ink pot and the
 * pen sit), its front, two legs and a drawer.
 */
export const DESK_FOOTPRINT: Footprint = { x: 116, y: 98, w: 58, h: 20 }
function stockDesk(ctx: CanvasRenderingContext2D) {
  rect(ctx, 52, 62, 58, 4, '#8b5a2b'); rect(ctx, 52, 66, 58, 14, '#70461f')
  rect(ctx, 54, 66, 2, 16, '#5a3618'); rect(ctx, 106, 66, 2, 16, '#5a3618')
  rect(ctx, 60, 70, 20, 8, '#5a3618'); rect(ctx, 62, 72, 16, 1, '#8b5a2b'); rect(ctx, 62, 75, 16, 1, '#8b5a2b')
}

/** The stock chair (room 70,42 20x30; canvas x 134-153, y 78-107): its back, seat and two legs, behind the seated mangaka. */
export const STOCK_CHAIR_FOOTPRINT: Footprint = { x: 134, y: 78, w: 20, h: 30 }
function stockChair(ctx: CanvasRenderingContext2D) {
  rect(ctx, 72, 42, 16, 12, '#4a4a55'); rect(ctx, 70, 54, 20, 4, '#4a4a55'); rect(ctx, 71, 58, 2, 14, '#4a4a55'); rect(ctx, 87, 58, 2, 14, '#4a4a55')
}

/** Every prop's footprint: the box its code-drawn fallback paints in, and the base its sprite is sized and placed on. */
export const PROP_FOOTPRINT: Record<ScenePropId, Footprint> = {
  window: WINDOW_FOOTPRINT,
  door: DOOR_FOOTPRINT,
  doorway: DOORWAY_FOOTPRINT,
  kitchenette: KITCHENETTE_FOOTPRINT,
  bookshelf: BOOKSHELF_FOOTPRINT,
  bed: BED_FOOTPRINT,
  poster: POSTER_FOOTPRINT,
  desk: DESK_FOOTPRINT,
  'drafting-table': DRAFTING_TABLE_FOOTPRINT,
  chair: STOCK_CHAIR_FOOTPRINT,
  'tall-chair': TALL_CHAIR_FOOTPRINT,
  'arm-lamp': ARM_LAMP_FOOTPRINT,
  'reference-shelf': REFERENCE_SHELF_FOOTPRINT,
  'coffee-machine': COFFEE_MACHINE_FOOTPRINT,
  zabuton: FRONT_FOOTPRINT.zabuton,
  boxes: FRONT_FOOTPRINT.boxes,
  fern: FRONT_FOOTPRINT.fern,
  books: FRONT_FOOTPRINT.books,
  'floor-lamp': FRONT_FOOTPRINT['floor-lamp'],
  sofa: FRONT_FOOTPRINT.sofa,
  bin: FRONT_FOOTPRINT.bin,
}

/**
 * Where each prop's generated sprite lands (canvas space): its native size (sceneArt.ts `PROP_SPRITE`, under
 * `PROP_MAX_W` and `PROP_MIN_H`) bottom-aligned and centred on its footprint (`spriteBox`, or flush right where
 * `PROP_ALIGN` says), but a desk, which hangs from its footprint's top row (`hangSprite`, so
 * the tabletop stays at y 98). The code-drawn fallback keeps painting inside `PROP_FOOTPRINT`. The one table of where
 * every sprite goes: the equipment's and the front row's boxes come from studioArt.ts and roomArt.ts, which draw with
 * them.
 */
export const PROP_BOX: Record<ScenePropId, Footprint> = {
  window: spriteBox('window', WINDOW_FOOTPRINT),
  door: DOOR_BOX,
  doorway: DOORWAY_BOX,
  kitchenette: spriteBox('kitchenette', KITCHENETTE_FOOTPRINT),
  bookshelf: spriteBox('bookshelf', BOOKSHELF_FOOTPRINT),
  bed: spriteBox('bed', BED_FOOTPRINT),
  poster: spriteBox('poster', POSTER_FOOTPRINT),
  desk: hangSprite(DESK_FOOTPRINT, ...PROP_SPRITE.desk),
  'drafting-table': DRAFTING_TABLE_BOX,
  chair: spriteBox('chair', STOCK_CHAIR_FOOTPRINT),
  'tall-chair': TALL_CHAIR_BOX,
  'arm-lamp': ARM_LAMP_BOX,
  'reference-shelf': REFERENCE_SHELF_BOX,
  'coffee-machine': COFFEE_MACHINE_BOX,
  zabuton: FRONT_BOX.zabuton,
  boxes: FRONT_BOX.boxes,
  fern: FRONT_BOX.fern,
  books: FRONT_BOX.books,
  'floor-lamp': FRONT_BOX['floor-lamp'],
  sofa: FRONT_BOX.sofa,
  bin: FRONT_BOX.bin,
}

/** A working assistant's page on their own desk (from the seat's col 3, on the desk top, y 120) and its ink lines. */
const PAGE_X = 3
const PAGE_Y = 120
const PAGE_W = 6
const PAGE_H = 4

/** The working assistants' pages and their ink lines (round(progress x 3), one a row from y 121), on their desk. */
function drawPages(ctx: CanvasRenderingContext2D, s: Snapshot, shown: number) {
  const inked = Math.round(s.progress * 3)
  for (let i = 0; i < shown; i++) {
    const actor = s.actors.assistants[i]
    if (actor.state !== 'seated') continue
    rawRect(ctx, actor.x + PAGE_X, PAGE_Y, PAGE_W, PAGE_H, PROP_PAPER)
    for (let k = 0; k < inked; k++) rawRect(ctx, actor.x + 4, 121 + k, 4, 1, PROP_LINE)
  }
}

/**
 * The assistants' row (front left, only when staff exists; the plan's decision 3): each one seated or dozing from the
 * rig in its look, the doze's Z beside the bowed head, then their desk, then each working assistant's page on it. The
 * row stands in front of the main desk by depth (its desk's floor line y 132 against the main desk's 118-131), so
 * `render` calls this after the desk group: the third head goes over the drafting table's overhang, never under it.
 */
function drawAssistants(ctx: CanvasRenderingContext2D, s: Snapshot, working: boolean, cast: SpriteCache) {
  const shown = Math.min(3, s.assistants.length)
  for (let i = 0; i < shown; i++) {
    const actor = s.actors.assistants[i]
    const pose = poseOf(actor, 'assistant', s, working)
    if (!pose) continue
    // assistants only ever go tired or happy (Decision 5): editorHere and lateNight stay false, so surprised and sleepy
    // never fire here; asleep, the doze's face is its own
    const mood = actor.state === 'sleeping' ? 'neutral' : moodFor(false, s.cheer, s.assistants[i].stamina, false)
    drawCast(ctx, cast, rigFrame(pose, mood, false), lookPalette(s.assistants[i].look), actor.x, actor.y, false)
    if (actor.state === 'sleeping') glyph(ctx, 'Z', actor.x + 25, actor.y + 11, '#2f5ecf')
  }
  const desk = assistantDesk(shown)
  shadow(ctx, desk.x, 132, desk.w)
  rawRect(ctx, desk.x, 120, desk.w, 3, '#8b5a2b'); rawRect(ctx, desk.x, 123, desk.w, 9, '#70461f')
  if (working) drawPages(ctx, s, shown)
}

/** `drawProp` at the prop's sprite box (its image) or its footprint (its fallback fills, which carry their own coordinates). */
function prop(ctx: CanvasRenderingContext2D, art: SceneArt, id: ScenePropId, fallback: Fallback) {
  const b = PROP_BOX[id]
  drawProp(ctx, art, id, b.x, b.y, b.w, b.h, fallback)
}

/**
 * An owned piece of equipment: its sprite (studioArt.ts `EQUIPMENT_SPRITE`) at its `PROP_BOX` once the image is
 * ready, else its code-drawn `EQUIPMENT_ART`, in the same place in the draw order.
 */
function equipment(
  ctx: CanvasRenderingContext2D, s: Snapshot, art: SceneArt, id: EquipmentId, frame: number, night: boolean,
) {
  // mirrors drawProp's ready-or-fallback rule (equipment fallbacks take (s, frame, night), so drawProp cannot be used)
  const sprite = EQUIPMENT_SPRITE[id]
  const img = sprite === null ? null : art.prop[sprite]
  if (sprite !== null && ready(img)) {
    const b = PROP_BOX[sprite]
    ctx.drawImage(img, b.x, b.y, b.w, b.h)
  } else EQUIPMENT_ART[id](ctx, s, frame, night)
}

// ---------- sky ----------

const SKY: [number, [number, number, number]][] = [
  [0.0, [246, 166, 160]],
  [0.25, [143, 211, 255]],
  [0.55, [143, 211, 255]],
  [0.7, [242, 163, 90]],
  [0.82, [28, 35, 82]],
  [1.0, [246, 166, 160]],
]
function skyAt(t: number): string {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [t0, c0] = SKY[i]
    const [t1, c1] = SKY[i + 1]
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0)
      const c = c0.map((v, j) => Math.round(v + (c1[j] - v) * k))
      return `rgb(${c[0]},${c[1]},${c[2]})`
    }
  }
  return 'rgb(143,211,255)'
}

function buildSkyLut(): string[] {
  const lut: string[] = []
  for (let i = 0; i < 256; i++) lut.push(skyAt(i / 255))
  return lut
}
/** The sky's `rgb(...)` at 256 evenly spaced times of day (entry i is t = i / 255), built once: no per-frame strings. */
export const SKY_LUT: readonly string[] = buildSkyLut()

/** The sky colour for a time of day: t clamped to [0, 1], then the nearest of the 256 entries. */
export function skyColor(t: number): string {
  return SKY_LUT[Math.round(Math.min(1, Math.max(0, t)) * 255)]
}

// ---------- scene ----------

/**
 * What one frame needs from the game, copied out of the store by the component (primitives and small objects); the
 * story props' inputs come from story.ts.
 */
export interface Snapshot extends StoryLook {
  phase: 'idle' | 'drawing' | 'ready' | 'submitted'
  activity: 'work' | 'rest' | 'job'
  progress: number
  stamina: number
  /** The player's level (Decision 7): picks the mangaka's outfit via outfitOf/OUTFIT_PALS. */
  level: number
  running: boolean
  away: boolean
  assistants: { look: number; stamina: number }[]
  /** The game day's season, painted in the window (season.ts). */
  season: Season
  /** The studio (studioLook, painted by studioArt.ts): its tier. */
  tier: StudioTierId
  /** One flag per piece of equipment the studio owns. */
  owned: Owned
  /** Volume spines on the bookshelf, 0-24. */
  volumes: number
  /** The anime's key visual hangs in the poster's place. */
  animePoster: boolean
  /** Trophies on the sill, 0-4: one per award, the most recent. */
  trophies: number
  /** Who is visiting the studio (the editor walks in from the door). */
  visitor: 'none' | 'editor'
  /** What the visitor carries (rig/props.ts, at the front hand). */
  visitorProp: 'none' | 'envelope' | 'letter' | 'contract' | 'trophy'
  /** The running serial's chapter cannot make its deadline (the seated mangaka panics now and then). */
  late: boolean
  /** Set for CHEER_MS after a fans or level pop fires (mood.ts): a happy mood for the mangaka and the assistants. */
  cheer: boolean
  /** A one-shot reaction cue (reactions.ts), consumed once per character by the cast driver; render does not read it. */
  reaction: ReactionCue | null
  /** Every character's place and pose, planned and walked by actors.ts; render only reads it. */
  actors: ActorTable
}

/**
 * Paints one frame. `t` is the time of day (0..1; night when t > 0.72 or t < 0.06); `frame` drives the animation and
 * is 0 under reduced motion, so everything that moves holds still there. `art` holds the generated images; each one
 * missing or still loading paints its code-drawn piece instead (`NO_ART`, the default, is today's scene exactly).
 * `cast` is the sprite cache the characters are drawn from (the session's by default; a test passes a recording one).
 */
export function render(
  ctx: CanvasRenderingContext2D, s: Snapshot, t: number, frame: number, art: SceneArt = NO_ART, cast: SpriteCache = getCastCache(),
) {
  const night = t > 0.72 || t < 0.06
  const absent = s.away || s.activity === 'job'
  seatedTop.frame = null
  // working = seated at the desk (the pose, which actors.ts plans) with the clock running (the animation). Pausing
  // freezes the mangaka mid-stroke instead of sending them to bed.
  const working = workingOf(s)
  const sky = skyColor(t)

  // a room image is the wall alone (canvas rows 0-113), dimmed at night; the tier's floor is always code-drawn
  const room = art.room[s.tier]
  if (ready(room)) {
    ctx.drawImage(room, 0, 0, W, WALL_H)
    if (night) { ctx.fillStyle = ROOM_NIGHT_DIM; ctx.fillRect(0, 0, W, WALL_H) }
    TIER_FLOOR[s.tier](ctx, night)
  } else drawRoomShell(ctx, s.tier, night)
  prop(ctx, art, 'kitchenette', drawKitchenette)
  // the bookshelf's shadow spans its sprite when the image is ready, else the code-drawn shelf (x 72, 35 wide)
  const shelfReady = ready(art.prop.bookshelf)
  const shelfX = shelfReady ? PROP_BOX.bookshelf.x : 72
  const shelfW = shelfReady ? PROP_BOX.bookshelf.w : 35
  // the desk's shadow lies under its sprite's feet when the image is ready (the stock desk's or the drafting table's,
  // whichever stands there), else under the code-drawn desk (x 116, 58 wide, y 118)
  const deskId: ScenePropId = s.owned['drafting-table'] ? 'drafting-table' : 'desk'
  const deskBox = PROP_BOX[deskId]
  const deskSpriteReady = ready(art.prop[deskId])
  // contact shadows on the floor: the fridge, the counter, the bookshelf, the desk and the bed
  shadow(ctx, 2, 114, 16); shadow(ctx, 20, 114, 42); shadow(ctx, shelfX, 114, shelfW)
  if (deskSpriteReady) shadow(ctx, deskBox.x, deskBox.y + deskBox.h, deskBox.w)
  else shadow(ctx, 116, 118, 58)
  shadow(ctx, 192, 128, 58)

  // window
  prop(ctx, art, 'window', windowFrame)
  rect(ctx, 118, 12, 44, 32, sky)
  if (night) {
    for (let i = 0; i < 9; i++) rect(ctx, 120 + ((i * 37) % 40), 14 + ((i * 23) % 26), 1, 1, '#fff')
    rect(ctx, 150, 16, 6, 6, '#f5f1c9'); rect(ctx, 152, 16, 4, 4, sky)
  } else if (t > 0.12 && t < 0.66) {
    const sx = 122 + (t - 0.12) * 70
    const sy = 30 - Math.sin(((t - 0.12) / 0.54) * Math.PI) * 14
    paneRect(ctx, sx, sy, 5, 5, '#ffe47a')
  }
  // the cloud drifts right and slides out behind the frame; frame 0 (reduced motion) shows it whole at the left edge
  const cx = ((frame * 0.15 + 10) % 60) - 10
  const cloud = night ? '#3a4470' : '#fff'
  paneRect(ctx, 118 + cx, 20, 10, 3, cloud); paneRect(ctx, 120 + cx, 18, 6, 2, cloud)
  drawSeasonPane(ctx, s.season, frame)
  // window bars, then the sill (and anything on it) in front of the pane
  rect(ctx, BAR_X, 12, 2, 32, '#5a4634'); rect(ctx, 118, 27, 44, 2, '#5a4634')
  rect(ctx, 114, 45, 52, 3, '#4a3828')
  drawSeasonSill(ctx, s.season)
  drawSeasonWall(ctx, s.season)
  if (s.owned.coffee) equipment(ctx, s, art, 'coffee', frame, night)
  drawTrophies(ctx, s.trophies)

  // bookshelf, with the volumes on top and the reference shelf beside it
  prop(ctx, art, 'bookshelf', bookshelf)
  drawVolumes(ctx, s.volumes)
  if (s.owned.shelf) equipment(ctx, s, art, 'shelf', frame, night)

  drawClock(ctx, t)
  drawCorkboard(ctx, s)
  drawCalendar(ctx, s, frame)

  // poster: the anime's key visual while the show is on, else the running serial's cover, else the stock poster
  if (s.animePoster) drawAnimePoster(ctx)
  else if (s.serialOn) drawSeriesPoster(ctx, s.posterHue)
  else prop(ctx, art, 'poster', stockPoster)

  // bed
  prop(ctx, art, 'bed', bed)
  // the tier's room: the door or the doorway above the bed's head (before the Zz that rise over it), the loft's plants
  const door = TIER_DOOR[s.tier]
  prop(ctx, art, door.id, door.draw)
  TIER_ART[s.tier](ctx, s, frame, night)
  drawEntrance(ctx, absent, ready(art.prop[door.id]))
  drawFanLetters(ctx, s.fanLevel)

  // chair (before the player: they sit in it)
  if (s.owned.chair) equipment(ctx, s, art, 'chair', frame, night)
  else prop(ctx, art, 'chair', stockChair)

  // the mangaka seated at the desk (behind its top)
  drawMangaka(ctx, s, s.actors.mangaka, frame, working, false, night, cast)

  // desk (or the drafting table in its place) and the lamp
  if (s.owned['drafting-table']) equipment(ctx, s, art, 'drafting-table', frame, night)
  else prop(ctx, art, 'desk', stockDesk)
  if (s.owned.lamp) equipment(ctx, s, art, 'lamp', frame, night)
  else { rect(ctx, 100, 50, 1, 12, '#3b3b45'); rect(ctx, 96, 47, 9, 4, '#3fa66c'); if (night || working) rect(ctx, 97, 51, 7, 2, '#fff2a8') }
  const stack = Math.round(1 + s.progress * 8)
  rect(ctx, 57, 62 - stack, 14, stack, '#fdfcf7'); for (let i = 0; i < stack; i += 2) rect(ctx, 57, 62 - stack + i, 14, 1, '#e9e5da')
  rect(ctx, 59, 60 - stack, 10, 1, '#b8b2a5'); rect(ctx, 59, 58 - stack, 7, 1, '#b8b2a5')
  // the seated rig mangaka's rows 0-39 again, over the pages, so the pen and its hand lie on the stack (the stack itself
  // stays after the desk: the drafting table's sprite box starts at y 95 and would hide its foot)
  if (seatedTop.frame) drawCastTop(ctx, cast, seatedTop.frame, seatedTop.pal, seatedTop.x, seatedTop.y, SEAT_TOP_ROWS)
  // the ink pot moves right to make room for the pen tablet
  const ink = s.owned.tablet ? 96 : 90
  rect(ctx, ink, 58, 4, 4, '#1b1b1b'); rect(ctx, ink + 1, 57, 2, 1, '#1b1b1b')
  rect(ctx, 76, 58, 5, 4, '#fff'); rect(ctx, 81, 59, 1, 2, '#fff'); if (working) { const st = Math.floor(frame / 10) % 2; rect(ctx, 77 + st, 55, 1, 2, '#d9d3c5') }
  if (s.owned.tablet) EQUIPMENT_ART.tablet(ctx, s, frame, night)
  drawCups(ctx, s, ready(art.prop[deskId]))
  if (absent) { rect(ctx, 96, 58, 8, 5, '#fff7c2'); rect(ctx, 97, 59, 6, 1, '#b8b2a5'); rect(ctx, 97, 61, 4, 1, '#b8b2a5') }

  // the assistants' row, in front of the main desk by depth (the plan's decision 3), after the desk group
  if (s.assistants.length) drawAssistants(ctx, s, working, cast)

  // the mangaka in front of the desk (standing, walking or in bed), then the editor on a visit
  drawMangaka(ctx, s, s.actors.mangaka, frame, working, true, night, cast)
  if (!absent && s.phase === 'submitted') {
    const d = Math.floor((s.running ? frame : 0) / 12) % 4
    for (let i = 0; i < d; i++) glyph(ctx, '.', 214 + i * 3, 92, '#16161a')
  }
  // the cat (after the mangaka's front pass, so it curls on the blanket), then the editor
  const cat = s.actors.cat
  const catFlip = cat.facing === 1
  if (cat.state === 'sleeping') {
    // a round cushion under the curled cat (16x7 from 2 px left of and 3 px below the frame's top: 4 fills)
    const cx = Math.round(cat.x) - 2
    const cy = Math.round(cat.y) + 3
    rawRect(ctx, cx + 3, cy, 10, 1, CUSHION); rawRect(ctx, cx, cy + 1, 16, 4, CUSHION)
    rawRect(ctx, cx + 1, cy + 5, 14, 1, CUSHION_SHADE); rawRect(ctx, cx + 3, cy + 6, 10, 1, CUSHION_SHADE)
    drawCast(ctx, cast, OLD_CAST.catSleep, 'pal', cat.x, cat.y, catFlip)
  }
  else if (cat.state === 'walking') drawCast(ctx, cast, OLD_CAST.catWalk[Math.floor(cat.anim / 125) % 2], 'pal', cat.x, cat.y, catFlip)
  else if (cat.state !== 'hidden' && cat.state !== 'away') {
    // the sitting cat's own idle cycle (Decision 6): sit, then a groom, then a stretch
    const pose = catFrame(frame)
    const catCast = pose.set === 'sit' ? OLD_CAST.catSit : pose.set === 'groom' ? OLD_CAST.catGroom[pose.index] : OLD_CAST.catStretch
    drawCast(ctx, cast, catCast, 'pal', cat.x, cat.y, catFlip)
  }
  const editor = s.actors.editor
  if (editor.state !== 'hidden' && editor.state !== 'away') {
    if (RIG_LIVE.editor) drawRigEditor(ctx, cast, s, editor, frame, working)
    else drawOldEditor(ctx, cast, s, editor, frame)
  }

  // the front row, in front of everyone
  TIER_FRONT[s.tier](ctx, s, frame, night, art)

  if (night) {
    ctx.fillStyle = 'rgba(20, 24, 60, 0.28)'; ctx.fillRect(0, 0, W, H)
    if (working) rect(ctx, 60, 46, 50, 34, 'rgba(255, 240, 180, 0.12)')
    // lights that glow through the dark go after the overlay
    drawSeasonNight(ctx, s.season, frame)
  }
  // the arm lamp (at night or while working) and the doorway's spill (at night), after the overlay so they glow
  drawStudioLights(ctx, s, night, working, ready(art.prop.doorway), ready(art.prop['arm-lamp']))
  drawAmbient(ctx, s, t, night, working)
}
