// The studio scene's painter: palettes, sprites and their helpers, the snapshot it reads and `render`, one frame of the
// 320x180 canvas (room-space literals, offset by paint.ts's OX/OY; the wall and floor in canvas space). Pure drawing: no React, no store, and nothing allocated per frame (tables are built once here).
// Generated images come in as a `SceneArt` (sceneArt.ts): a ready room image replaces the code-drawn shell and a ready
// prop image replaces its piece at the same footprint and the same place in the draw order. This module never imports
// the art registry.
import type { StudioTierId } from '../../sim'
import { ASSISTANT_SEAT_X } from './actors'
import type { Actor, ActorTable } from './actors'
import {
  ASSISTANT_DOZE, ASSISTANT_PALS, CAT_GROOM, CAT_SIT, CAT_SLEEP, CAT_STRETCH, CAT_WALK, EDITOR_IDLE, EDITOR_WALK, FACES, HEAD_DY,
  MANGAKA_IDLE, MANGAKA_LIE, MANGAKA_PANIC, MANGAKA_SIP, MANGAKA_SIT, MANGAKA_STRETCH, MANGAKA_WALK, MARKS, MARK_PAL, OUTFIT_PALS, PAL,
  PROP_CONTRACT, PROP_ENVELOPE, PROP_LETTER, PROP_PAL, PROP_TROPHY, drawSprite, outfitOf,
} from './sprites'
import type { SpriteMap } from './sprites'
import { BREATHE_POSES, catFrame, idleFrame, moodOf } from './mood'
import type { Mood, MoodInput } from './mood'
import { BAR_X, paneRect, rawRect, rect, shadow } from './paint'
import { drawSeasonNight, drawSeasonPane, drawSeasonSill, drawSeasonWall } from './season'
import type { Season } from './season'
import {
  DOORWAY_FOOTPRINT, DOOR_FOOTPRINT, EQUIPMENT_ART, KITCHENETTE_FOOTPRINT, TIER_ART, TIER_DOOR, drawAnimePoster,
  drawEntrance, drawKitchenette, drawStudioLights, drawTrophies, drawVolumes,
} from './studioArt'
import type { Owned } from './studioArt'
import {
  TIER_FRONT, drawAmbient, drawCalendar, drawCorkboard, drawCups, drawFanLetters, drawRoomShell, drawSeriesPoster,
} from './roomArt'
import { NO_ART, PROP_SPRITE, ROOM_NIGHT_DIM, drawProp, placeSprite, ready } from './sceneArt'
import type { Fallback, Footprint, SceneArt, ScenePropId } from './sceneArt'
import type { StoryLook } from './story'

export const W = 320
export const H = 180

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
 * The mark slot at the head's top-right edge: a 3x5 glyph at cols 20-22, rows -2 to 2 of a 24x32 frame, right of the
 * hair (whose outline reaches col 18 on row 2 and col 19 from row 3) and clear of it; mirrored (cols 1-3) when the
 * frame faces right.
 */
const MARK_DX = 20
const MARK_DY = -2
function markX(x: number, flip = false): number {
  return flip ? x + 24 - MARK_DX - 3 : x + MARK_DX
}

/**
 * The mood overlay for a head-steady pose: the face (FACES[mood], rows 9-12 of the anchor, at x+4/x+6 flipped,
 * y+9+headDy) and, when `mark` is true, its mark at the head's top-right edge (MARKS[mood], at `markX`, y-2, in
 * MARK_PAL). Nothing
 * when neutral. Only one glyph ever occupies the mark slot above the head at once (fix round 1): the standing
 * mangaka's ready-manuscript '!' beats the mood mark, which beats the idle '?', so `mark` lets a caller draw the
 * face without the mark when something else already claims that slot. `face` is false for a pose that is not
 * head-steady (the idle cycle's stretch and sip, Decision 6): the mark may still show, but the pose's own baked-in
 * expression (closed eyes, a mug at the mouth) is left alone.
 */
function drawMood(ctx: CanvasRenderingContext2D, mood: Mood, x: number, y: number, headDy: number, mark = true, face = true) {
  if (mood === 'neutral') return
  if (face) drawSprite(ctx, FACES[mood], x + 4, y + 9 + headDy, 4, PAL)
  if (mark) drawSprite(ctx, MARKS[mood], markX(x), y + MARK_DY, 5, MARK_PAL)
}

/**
 * One scratch object moodOf reads from, mutated field by field before each call so render allocates nothing per
 * frame; `home` is true at every call site (the mangaka or an assistant, always in the studio when this runs).
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

/**
 * The mangaka, in whatever pose the table holds (24x32 frames, 30x14 in bed). Called twice: before the desk (paints only
 * when y < 75: seated at 67, behind the desk top) and after it (only when y >= 75: standing, walking, at the door or in
 * bed, in front of it).
 */
function drawMangaka(
  ctx: CanvasRenderingContext2D, s: Snapshot, a: Actor, frame: number, working: boolean, front: boolean, night: boolean,
) {
  if ((a.y >= 75) !== front) return
  const x = a.x
  const y = a.y
  const outfit = OUTFIT_PALS[outfitOf(s.level)]
  switch (a.state) {
    case 'seated': {
      // late on a chapter, the mangaka throws up their hands for 40 frames in every 240
      const panicking = working && s.late && frame % 240 < 40
      const idx = working ? Math.floor(frame / 8) % 2 : 0
      const map = panicking ? MANGAKA_PANIC[idx] : MANGAKA_SIT[idx]
      drawSprite(ctx, map, x, y, undefined, outfit)
      if (!panicking) {
        const mood = moodFor(s.actors.editor.state === 'standing', s.cheer, s.stamina, night && working)
        drawMood(ctx, mood, x, y, HEAD_DY.sit[idx])
      }
      return
    }
    case 'standing': {
      shadow(ctx, x + 4, y + 30, 16)
      const ready = s.phase === 'ready'
      // the manuscript is in hand while ready, so the idle cycle (Decision 6) applies only otherwise
      const pose = ready ? BREATHE_POSES[Math.floor(frame / 16) % 2] : idleFrame(frame)
      let map: SpriteMap
      let headDy: number
      // only the breathing pose is head-steady: the stretch and sip bake their own expression into the frame
      let faceSteady: boolean
      if (pose.set === 'stretch') { map = MANGAKA_STRETCH[pose.index]; headDy = HEAD_DY.stretch[pose.index]; faceSteady = false }
      else if (pose.set === 'sip') { map = MANGAKA_SIP[pose.index]; headDy = HEAD_DY.sip[pose.index]; faceSteady = false }
      else { map = MANGAKA_IDLE[pose.index]; headDy = HEAD_DY.idle[pose.index]; faceSteady = true }
      drawSprite(ctx, map, x, y, undefined, outfit)
      const mood = moodFor(s.actors.editor.state === 'standing', s.cheer, s.stamina, false)
      // only one mark above the head at a time: the ready manuscript's '!' beats the mood mark, which beats the
      // idle '?' (fix round 1); the face overlay only ever shows on the head-steady breathing pose
      drawMood(ctx, mood, x, y, headDy, !ready, faceSteady)
      if (ready) {
        // the manuscript in the leading hand (row 22)
        rawRect(ctx, x - 8, y + 17, 8, 10, '#fdfcf7'); rawRect(ctx, x - 7, y + 19, 6, 1, '#b8b2a5'); rawRect(ctx, x - 7, y + 21, 6, 1, '#b8b2a5')
        glyph(ctx, '!', markX(x), y + MARK_DY, '#e5484d')
      } else if (faceSteady && mood === 'neutral' && frame % 120 < 40) glyph(ctx, '?', markX(x), y + MARK_DY, '#2f5ecf')
      return
    }
    case 'walking':
      shadow(ctx, x + 4, y + 30, 16)
      drawSprite(ctx, MANGAKA_WALK[Math.floor(a.anim / 100) % 4], x, y, 32, outfit, a.facing === 1)
      return
    case 'sleeping': {
      // the head on the pillow, the body under the blanket (canvas 196-229 x 114-121) and its fold
      drawSprite(ctx, MANGAKA_LIE, x, y)
      rawRect(ctx, 196, 114, 34, 8, '#c94b4b')
      rawRect(ctx, 196, 114, 34, 2, '#a83c3c')
      const zz = Math.floor(frame / 20) % 3
      for (let i = 0; i <= zz; i++) glyph(ctx, 'Z', x + 18 + i * 3, y - 6 - i * 4, '#2f5ecf')
      return
    }
    default:
      return
  }
}

// ---------- the structural props (each a generated sprite when one is ready, else these fills) ----------

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

/** Every structural prop's footprint: the box its code-drawn fallback paints in, and the base its sprite is sized and placed on. */
export const PROP_FOOTPRINT: Record<ScenePropId, Footprint> = {
  window: WINDOW_FOOTPRINT,
  door: DOOR_FOOTPRINT,
  doorway: DOORWAY_FOOTPRINT,
  kitchenette: KITCHENETTE_FOOTPRINT,
  bookshelf: BOOKSHELF_FOOTPRINT,
  bed: BED_FOOTPRINT,
  poster: POSTER_FOOTPRINT,
}

/**
 * Where each prop's generated sprite lands (canvas space): its native size (sceneArt.ts `PROP_SPRITE`) bottom-aligned
 * and centred on its footprint (`placeSprite`). The code-drawn fallback keeps painting inside `PROP_FOOTPRINT`.
 */
export const PROP_BOX: Record<ScenePropId, Footprint> = {
  window: placeSprite(WINDOW_FOOTPRINT, ...PROP_SPRITE.window),
  door: placeSprite(DOOR_FOOTPRINT, ...PROP_SPRITE.door),
  doorway: placeSprite(DOORWAY_FOOTPRINT, ...PROP_SPRITE.doorway),
  kitchenette: placeSprite(KITCHENETTE_FOOTPRINT, ...PROP_SPRITE.kitchenette),
  bookshelf: placeSprite(BOOKSHELF_FOOTPRINT, ...PROP_SPRITE.bookshelf),
  bed: placeSprite(BED_FOOTPRINT, ...PROP_SPRITE.bed),
  poster: placeSprite(POSTER_FOOTPRINT, ...PROP_SPRITE.poster),
}

/** `drawProp` at the prop's sprite box (its image) or its footprint (its fallback fills, which carry their own coordinates). */
function prop(ctx: CanvasRenderingContext2D, art: SceneArt, id: ScenePropId, fallback: Fallback) {
  const b = PROP_BOX[id]
  drawProp(ctx, art, id, b.x, b.y, b.w, b.h, fallback)
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
  /** What the visitor carries (painted from Task 2.4). */
  visitorProp: 'none' | 'envelope' | 'letter' | 'contract' | 'trophy'
  /** The running serial's chapter cannot make its deadline (the seated mangaka panics now and then). */
  late: boolean
  /** Set for CHEER_MS after a fans or level pop fires (mood.ts): a happy mood for the mangaka and the assistants. */
  cheer: boolean
  /** Every character's place and pose, planned and walked by actors.ts; render only reads it. */
  actors: ActorTable
}

/**
 * Paints one frame. `t` is the time of day (0..1; night when t > 0.72 or t < 0.06); `frame` drives the animation and
 * is 0 under reduced motion, so everything that moves holds still there. `art` holds the generated images; each one
 * missing or still loading paints its code-drawn piece instead (`NO_ART`, the default, is today's scene exactly).
 */
export function render(ctx: CanvasRenderingContext2D, s: Snapshot, t: number, frame: number, art: SceneArt = NO_ART) {
  const night = t > 0.72 || t < 0.06
  const absent = s.away || s.activity === 'job'
  // busy = seated at the desk (the pose, which actors.ts plans); working = busy and the clock runs (the animation).
  // Pausing freezes the mangaka mid-stroke instead of sending them to bed.
  const busy = !absent && s.phase === 'drawing' && s.activity === 'work' && s.stamina > 0
  const working = busy && s.running
  const sky = skyColor(t)

  const room = art.room[s.tier]
  if (ready(room)) {
    ctx.drawImage(room, 0, 0, W, H)
    if (night) { ctx.fillStyle = ROOM_NIGHT_DIM; ctx.fillRect(0, 0, W, H) }
  } else drawRoomShell(ctx, s.tier, night)
  prop(ctx, art, 'kitchenette', drawKitchenette)
  // contact shadows on the floor: the fridge, the counter, the bookshelf, the desk and the bed
  shadow(ctx, 2, 114, 16); shadow(ctx, 20, 114, 42); shadow(ctx, 72, 114, 35); shadow(ctx, 116, 118, 58); shadow(ctx, 192, 128, 58)

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
  if (s.owned.coffee) EQUIPMENT_ART.coffee(ctx, s, frame, night)
  drawTrophies(ctx, s.trophies)

  // bookshelf, with the volumes on top and the reference shelf beside it
  prop(ctx, art, 'bookshelf', bookshelf)
  drawVolumes(ctx, s.volumes)
  if (s.owned.shelf) EQUIPMENT_ART.shelf(ctx, s, frame, night)

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
  drawEntrance(ctx, absent)
  drawFanLetters(ctx, s.fanLevel)

  // the assistants (front left, only when staff exists): their stools, each one seated or dozing, then the desk, then
  // each working assistant's page on it (after the desk, so it shows)
  if (s.assistants.length) {
    const shown = Math.min(3, s.assistants.length)
    for (let i = 0; i < shown; i++) rawRect(ctx, ASSISTANT_SEAT_X[i] + 7, 118, 10, 4, '#4a4a55')
    for (let i = 0; i < shown; i++) {
      const actor = s.actors.assistants[i]
      if (actor.state === 'hidden' || actor.state === 'away') continue
      const pal = ASSISTANT_PALS[s.assistants[i].look % ASSISTANT_PALS.length]
      if (actor.state === 'sleeping') {
        drawSprite(ctx, ASSISTANT_DOZE, actor.x, actor.y, 32, pal)
        glyph(ctx, 'Z', actor.x + 18, actor.y - 6, '#2f5ecf')
      } else {
        const idx = working ? Math.floor((frame + i * 3) / 8) % 2 : 0
        drawSprite(ctx, MANGAKA_SIT[idx], actor.x, actor.y, 32, pal)
        // assistants only ever go tired or happy (Decision 5): editorHere and lateNight stay false so surprised and
        // sleepy never fire here
        const mood = moodFor(false, s.cheer, s.assistants[i].stamina, false)
        drawMood(ctx, mood, actor.x, actor.y, HEAD_DY.sit[idx])
      }
    }
    const dw = 8 + 20 * shown
    shadow(ctx, 62, 132, dw)
    rawRect(ctx, 62, 120, dw, 3, '#8b5a2b'); rawRect(ctx, 62, 123, dw, 9, '#70461f')
    if (working) {
      const inked = Math.round(s.progress * 3)
      for (let i = 0; i < shown; i++) {
        const actor = s.actors.assistants[i]
        if (actor.state !== 'seated') continue
        rawRect(ctx, actor.x + 3, 120, 6, 4, PROP_PAPER)
        for (let k = 0; k < inked; k++) rawRect(ctx, actor.x + 4, 121 + k, 4, 1, PROP_LINE)
      }
    }
  }
  // chair (before the player: they sit in it)
  if (s.owned.chair) EQUIPMENT_ART.chair(ctx, s, frame, night)
  else { rect(ctx, 72, 42, 16, 12, '#4a4a55'); rect(ctx, 70, 54, 20, 4, '#4a4a55'); rect(ctx, 71, 58, 2, 14, '#4a4a55'); rect(ctx, 87, 58, 2, 14, '#4a4a55') }

  // the mangaka seated at the desk (behind its top)
  drawMangaka(ctx, s, s.actors.mangaka, frame, working, false, night)

  // desk (or the drafting table in its place) and the lamp
  if (s.owned['drafting-table']) EQUIPMENT_ART['drafting-table'](ctx, s, frame, night)
  else {
    rect(ctx, 52, 62, 58, 4, '#8b5a2b'); rect(ctx, 52, 66, 58, 14, '#70461f')
    rect(ctx, 54, 66, 2, 16, '#5a3618'); rect(ctx, 106, 66, 2, 16, '#5a3618')
    rect(ctx, 60, 70, 20, 8, '#5a3618'); rect(ctx, 62, 72, 16, 1, '#8b5a2b'); rect(ctx, 62, 75, 16, 1, '#8b5a2b')
  }
  if (s.owned.lamp) EQUIPMENT_ART.lamp(ctx, s, frame, night)
  else { rect(ctx, 100, 50, 1, 12, '#3b3b45'); rect(ctx, 96, 47, 9, 4, '#3fa66c'); if (night || working) rect(ctx, 97, 51, 7, 2, '#fff2a8') }
  const stack = Math.round(1 + s.progress * 8)
  rect(ctx, 57, 62 - stack, 14, stack, '#fdfcf7'); for (let i = 0; i < stack; i += 2) rect(ctx, 57, 62 - stack + i, 14, 1, '#e9e5da')
  rect(ctx, 59, 60 - stack, 10, 1, '#b8b2a5'); rect(ctx, 59, 58 - stack, 7, 1, '#b8b2a5')
  // the ink pot moves right to make room for the pen tablet
  const ink = s.owned.tablet ? 96 : 90
  rect(ctx, ink, 58, 4, 4, '#1b1b1b'); rect(ctx, ink + 1, 57, 2, 1, '#1b1b1b')
  rect(ctx, 76, 58, 5, 4, '#fff'); rect(ctx, 81, 59, 1, 2, '#fff'); if (working) { const st = Math.floor(frame / 10) % 2; rect(ctx, 77 + st, 55, 1, 2, '#d9d3c5') }
  if (s.owned.tablet) EQUIPMENT_ART.tablet(ctx, s, frame, night)
  drawCups(ctx, s)
  if (absent) { rect(ctx, 96, 58, 8, 5, '#fff7c2'); rect(ctx, 97, 59, 6, 1, '#b8b2a5'); rect(ctx, 97, 61, 4, 1, '#b8b2a5') }

  // the mangaka in front of the desk (standing, walking or in bed), then the editor on a visit
  drawMangaka(ctx, s, s.actors.mangaka, frame, working, true, night)
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
    drawSprite(ctx, CAT_SLEEP, cat.x, cat.y, 8, undefined, catFlip)
  }
  else if (cat.state === 'walking') drawSprite(ctx, CAT_WALK[Math.floor(cat.anim / 125) % 2], cat.x, cat.y, 8, undefined, catFlip)
  else if (cat.state !== 'hidden' && cat.state !== 'away') {
    // the sitting cat's own idle cycle (Decision 6): sit, then a groom, then a stretch
    const pose = catFrame(frame)
    const map = pose.set === 'sit' ? CAT_SIT : pose.set === 'groom' ? CAT_GROOM[pose.index] : CAT_STRETCH
    drawSprite(ctx, map, cat.x, cat.y, 8, undefined, catFlip)
  }
  const editor = s.actors.editor
  const editorFlip = editor.facing === 1
  if (editor.state !== 'hidden' && editor.state !== 'away') shadow(ctx, editor.x + 4, editor.y + 30, 16)
  if (editor.state === 'walking') drawSprite(ctx, EDITOR_WALK[Math.floor(editor.anim / 100) % 4], editor.x, editor.y, 32, undefined, editorFlip)
  else if (editor.state !== 'hidden' && editor.state !== 'away') drawSprite(ctx, EDITOR_IDLE[Math.floor(frame / 16) % 2], editor.x, editor.y, 32, undefined, editorFlip)
  if (s.visitor === 'editor' && editor.state === 'standing' && editor.facing === -1) drawVisitorProp(ctx, s.visitorProp, editor.x, editor.y, frame)

  // the front row, in front of everyone
  TIER_FRONT[s.tier](ctx, s, frame, night)

  if (night) {
    ctx.fillStyle = 'rgba(20, 24, 60, 0.28)'; ctx.fillRect(0, 0, W, H)
    if (working) rect(ctx, 60, 46, 50, 34, 'rgba(255, 240, 180, 0.12)')
    // lights that glow through the dark go after the overlay
    drawSeasonNight(ctx, s.season, frame)
  }
  // the arm lamp (at night or while working) and the doorway's spill (at night), after the overlay so they glow
  drawStudioLights(ctx, s, night, working)
  drawAmbient(ctx, s, t, night, working)
}
