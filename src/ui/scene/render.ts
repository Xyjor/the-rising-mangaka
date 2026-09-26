// The studio scene's painter: palettes, sprites and their helpers, the snapshot it reads and `render`, one frame of the
// 320x180 canvas (room-space literals, offset by paint.ts's OX/OY; the wall and floor in canvas space). Pure drawing: no React, no store, and nothing allocated per frame (tables are built once here).
import { LOW_STAMINA_THRESHOLD } from '../../sim'
import type { StudioTierId } from '../../sim'
import type { Actor, ActorTable } from './actors'
import { LOOK_HAIRS, LOOK_SHIRTS } from '../looks'
import { BAR_X, paneRect, rawRect, rect } from './paint'
import { drawSeasonNight, drawSeasonPane, drawSeasonSill } from './season'
import type { Season } from './season'
import {
  EQUIPMENT_ART, TIER_ART, drawAnimePoster, drawEntrance, drawKitchenette, drawStudioLights, drawTrophies, drawVolumes,
} from './studioArt'
import type { Owned } from './studioArt'

export const W = 320
export const H = 180

// ---------- palette & sprites ----------

const PAL: Record<string, string> = {
  K: '#2b2140', H: '#f4cfa5', E: '#1b1b1b', R: '#3b6fd6', B: '#2c2c3a', S: '#1b1b1b', M: '#c0392b',
  G: '#5b6270', W: '#f6f6f6', F: '#6d4c33', O: '#e39a4a',
}
/** One palette per assistant look, built once so render() allocates nothing per frame. */
const ASSISTANT_PALS: Record<string, string>[] = LOOK_SHIRTS.map((_, i) => ({ ...PAL, R: LOOK_SHIRTS[i], K: LOOK_HAIRS[i] }))
const BOOK_COLS = ['#c94b4b', '#3b6fd6', '#3fa66c', '#f5b700', '#7c4dff', '#e07b39']

const HERO = [
  '...KKKKKK...',
  '..KKKKKKKK..',
  '..KKHHHHKK..',
  '..KHHHHHHK..',
  '..KHEHHEHK..',
  '...HHHHHH...',
  '....HMMH....',
  '..RRRRRRRR..',
  '.RRRRRRRRRR.',
  '.HRRRRRRRRH.',
  '..RRRRRRRR..',
  '...BBBBBB...',
  '...BB..BB...',
  '...BB..BB...',
  '..SS....SS..',
]

/** The walk cycle's two frames, facing left (flipped to face right), 125 ms each. */
const HERO_WALK: readonly (readonly string[])[] = [
  [
    '...KKKKKK...',
    '..KKKKKKKK..',
    '..KKHHHHKK..',
    '..KHHHHHHK..',
    '..KHEHHEHK..',
    '...HHHHHH...',
    '....HMMH....',
    '..RRRRRRRR..',
    '.RRRRRRRRRR.',
    '.HRRRRRRRRH.',
    '..RRRRRRRR..',
    '...BBBBBB...',
    '..BBB...BB..',
    '.SSB.....B..',
    '.........SS.',
  ],
  [
    '...KKKKKK...',
    '..KKKKKKKK..',
    '..KKHHHHKK..',
    '..KHHHHHHK..',
    '..KHEHHEHK..',
    '...HHHHHH...',
    '....HMMH....',
    '..RRRRRRRR..',
    '.RRRRRRRRRR.',
    '.HRRRRRRRRH.',
    '..RRRRRRRR..',
    '...BBBBBB...',
    '..BB...BBB..',
    '..B.....BSS.',
    '.SS.........',
  ],
]

/** The editor: glasses, grey suit, white collar, red tie, the briefcase in the left hand (12x15, facing left). */
const EDITOR = [
  '...KKKKKK...',
  '..KKKKKKKK..',
  '..KHHHHHHK..',
  '..KEEHHEEK..',
  '..KHHHHHHK..',
  '...HHHHHH...',
  '....HWWH....',
  '..GGGWWGGG..',
  '.GGGGMMGGGG.',
  '.HGGGGGGGGH.',
  '..GGGGGGG.FF',
  '...GGGGGG.FF',
  '...GG..GG.FF',
  '...GG..GG.FF',
  '..SS..SS....',
]

/** The cat (8x6, facing left): frame 0 stands (and sits and sleeps), frames 0 and 1 are the walk, 125 ms each. */
const CAT: readonly (readonly string[])[] = [
  [
    '.O..O..O',
    '.OOOO.O.',
    '.OEOOOO.',
    '.OOOOOO.',
    '.OOOOOO.',
    '.O.O.O.O',
  ],
  [
    '.O..O.O.',
    '.OOOO..O',
    '.OEOOOO.',
    '.OOOOOO.',
    '.OOOOOO.',
    'O.O.O.O.',
  ],
]
const CAT_PAL: Record<string, string> = { O: '#e39a4a', E: '#1b1b1b' }
/** Asleep, the eye closes into the fur. */
const CAT_PAL_ASLEEP: Record<string, string> = { O: '#e39a4a', E: '#e39a4a' }

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

const HEAD_SLEEP = [
  '...KKKKKK...',
  '..KKKKKKKK..',
  '..KKHHHHKK..',
  '..KHHHHHHK..',
  '..KHEEHEEK..',
  '...HHHHHH...',
  '....HHHH....',
]

/**
 * A string-map sprite in canvas space, its top-left at (x, y) rounded: rows `fromRow` to `rows - 1`, mirrored left to
 * right when `flip`.
 */
function drawSprite(
  ctx: CanvasRenderingContext2D, map: readonly string[], x: number, y: number, rows = map.length,
  pal: Record<string, string> = PAL, flip = false, fromRow = 0,
) {
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  for (let r = fromRow; r < rows; r++) {
    const line = map[r]
    const n = line.length
    for (let c = 0; c < n; c++) {
      const ch = line[c]
      if (ch === '.') continue
      ctx.fillStyle = pal[ch] ?? '#f0f'
      ctx.fillRect(x0 + (flip ? n - 1 - c : c), y0 + r, 1, 1)
    }
  }
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

// ---------- the characters (canvas space, from the actor table) ----------

const PROP_PAPER = '#fdfcf7'
const PROP_LINE = '#b8b2a5'
const PROP_BLUE = '#3b6fd6'
const PROP_RED = '#e5484d'
const PROP_GOLD = '#f5b700'
const PROP_BASE = '#8b5a2b'

/** What the standing editor holds in the leading hand, and the ! bobbing above them. */
function drawVisitorProp(ctx: CanvasRenderingContext2D, prop: Snapshot['visitorProp'], x: number, y: number, frame: number) {
  switch (prop) {
    case 'envelope':
      rawRect(ctx, x - 4, y + 8, 5, 3, PROP_PAPER); rawRect(ctx, x - 4, y + 9, 5, 1, PROP_LINE); break
    case 'letter':
      rawRect(ctx, x - 4, y + 7, 4, 5, PROP_PAPER); rawRect(ctx, x - 4, y + 8, 4, 1, PROP_LINE); rawRect(ctx, x - 4, y + 10, 4, 1, PROP_LINE); break
    case 'contract':
      rawRect(ctx, x - 4, y + 7, 4, 6, PROP_PAPER); rawRect(ctx, x - 4, y + 9, 4, 1, PROP_BLUE); rawRect(ctx, x - 4, y + 11, 4, 1, PROP_RED); break
    case 'trophy':
      rawRect(ctx, x - 4, y + 7, 3, 3, PROP_GOLD); rawRect(ctx, x - 3, y + 10, 1, 2, PROP_GOLD); rawRect(ctx, x - 4, y + 12, 3, 1, PROP_BASE); break
    case 'none': return
  }
  glyph(ctx, '!', x + 5, y - 10 - (Math.floor(frame / 16) % 2), '#e5484d')
}

/**
 * The mangaka, in whatever pose the table holds. Called twice: before the desk (paints only when y < 92: seated,
 * behind the desk top) and after it (only when y >= 92: standing, walking or in bed, in front of it).
 */
function drawMangaka(ctx: CanvasRenderingContext2D, s: Snapshot, a: Actor, frame: number, working: boolean, front: boolean) {
  if ((a.y >= 92) !== front) return
  const x = a.x
  const y = a.y
  switch (a.state) {
    case 'seated': {
      const bob = working ? (Math.floor(frame / 8) % 2) : 0
      drawSprite(ctx, HERO, x, y + bob, 12)
      const armY = working ? y + 9 + (Math.floor(frame / 4) % 2) : y + 10
      rawRect(ctx, x + 10, armY, 3, 2, PAL.H); rawRect(ctx, x + 13, armY - 1, 1, 3, '#1b1b1b')
      if (working && s.stamina < LOW_STAMINA_THRESHOLD) glyph(ctx, '!', x + 12, y - 8, '#e5484d')
      return
    }
    case 'standing': {
      const bob = Math.floor(frame / 16) % 2
      drawSprite(ctx, HERO, x, y + bob)
      if (s.phase === 'ready') {
        rawRect(ctx, x - 8, y + 8, 8, 10, '#fdfcf7'); rawRect(ctx, x - 7, y + 10, 6, 1, '#b8b2a5'); rawRect(ctx, x - 7, y + 12, 6, 1, '#b8b2a5')
        glyph(ctx, '!', x + 5, y - 10, '#e5484d')
      } else if (frame % 120 < 40) glyph(ctx, '?', x + 5, y - 10, '#2f5ecf')
      return
    }
    case 'walking':
      drawSprite(ctx, HERO_WALK[Math.floor(a.anim / 125) % 2], x, y, 15, PAL, a.facing === 1)
      return
    case 'sleeping': {
      rect(ctx, 138, 72, 30, 4, '#d95d5d')
      drawSprite(ctx, HEAD_SLEEP, x, y)
      const zz = Math.floor(frame / 20) % 3
      for (let i = 0; i <= zz; i++) glyph(ctx, 'Z', x + 9 + i * 3, y - 8 - i * 4, '#2f5ecf')
      return
    }
    default:
      return
  }
}

// ---------- the room ----------

/**
 * The wall and the floor, in canvas space across the whole 320x180: the wall to y 113 with 27 stripes (x 4 + 12k) and
 * the skirting at y 112-113, the floor below with 20 plank seams (x 16k) and 8 plank rows (y 122 + 8k). 58 fills.
 */
function drawRoom(ctx: CanvasRenderingContext2D, night: boolean) {
  rawRect(ctx, 0, 0, W, 114, night ? '#8f8272' : '#e8dcc8')
  for (let x = 4; x < W; x += 12) rawRect(ctx, x, 0, 1, 114, night ? '#847763' : '#ddd0ba')
  rawRect(ctx, 0, 112, W, 2, night ? '#5a4a3a' : '#8a6a4f')
  rawRect(ctx, 0, 114, W, 66, night ? '#6f5438' : '#b0855b')
  for (let x = 0; x < W; x += 16) rawRect(ctx, x, 114, 1, 66, night ? '#5c4530' : '#96704a')
  for (let y = 122; y < H; y += 8) rawRect(ctx, 0, y, W, 1, night ? '#5c4530' : '#a37b52')
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

/** What one frame needs from the game, copied out of the store by the component (primitives and small objects). */
export interface Snapshot {
  phase: 'idle' | 'drawing' | 'ready' | 'submitted'
  activity: 'work' | 'rest' | 'job'
  progress: number
  stamina: number
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
  /** Every character's place and pose, planned and walked by actors.ts; render only reads it. */
  actors: ActorTable
}

/**
 * Paints one frame. `t` is the time of day (0..1; night when t > 0.72 or t < 0.06); `frame` drives the animation and
 * is 0 under reduced motion, so everything that moves holds still there.
 */
export function render(ctx: CanvasRenderingContext2D, s: Snapshot, t: number, frame: number) {
  const night = t > 0.72 || t < 0.06
  const absent = s.away || s.activity === 'job'
  // busy = seated at the desk (the pose, which actors.ts plans); working = busy and the clock runs (the animation).
  // Pausing freezes the mangaka mid-stroke instead of sending them to bed.
  const busy = !absent && s.phase === 'drawing' && s.activity === 'work' && s.stamina > 0
  const working = busy && s.running
  const sky = skyColor(t)

  drawRoom(ctx, night)
  drawKitchenette(ctx)

  // window
  rect(ctx, 116, 10, 48, 36, '#5a4634')
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
  if (s.owned.coffee) EQUIPMENT_ART.coffee(ctx, s, frame, night)
  drawTrophies(ctx, s.trophies)

  // bookshelf, with the volumes on top and the reference shelf beside it
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
  drawVolumes(ctx, s.volumes)
  if (s.owned.shelf) EQUIPMENT_ART.shelf(ctx, s, frame, night)

  drawClock(ctx, t)

  // poster, or the anime's key visual while the show is on
  if (s.animePoster) drawAnimePoster(ctx)
  else { rect(ctx, 52, 14, 22, 28, '#fff'); rect(ctx, 54, 16, 18, 24, '#e5484d'); rect(ctx, 57, 22, 12, 12, '#fff'); rect(ctx, 60, 25, 6, 6, '#16161a') }

  // bed
  rect(ctx, 128, 66, 58, 26, '#6d4c33')
  rect(ctx, 130, 68, 54, 20, '#f0ead6')
  rect(ctx, 168, 70, 14, 8, '#ffffff')
  rect(ctx, 130, 74, 40, 14, '#c94b4b')
  rect(ctx, 130, 74, 40, 2, '#a83c3c')
  // the tier's room: the doorway above the bed's head (before the Zz that rise over it), the loft's plants
  TIER_ART[s.tier](ctx, s, frame, night)
  drawEntrance(ctx, absent)

  // assistants' desk (front left), only when staff exists
  if (s.assistants.length) {
    const ax = 6
    const shown = Math.min(3, s.assistants.length)
    for (let i = 0; i < shown; i++) {
      const actor = s.actors.assistants[i]
      if (actor.state === 'hidden' || actor.state === 'away') continue
      const pal = ASSISTANT_PALS[s.assistants[i].look % ASSISTANT_PALS.length]
      const x = actor.x
      if (actor.state === 'sleeping') {
        // head down on the desk: the head a column back and a row down, the body where it sat
        drawSprite(ctx, HERO, x - 1, actor.y + 1, 6, pal)
        drawSprite(ctx, HERO, x, actor.y, 11, pal, false, 6)
        glyph(ctx, 'Z', x + 12, 98, '#2f5ecf')
        continue
      }
      const bob = working ? (Math.floor((frame + i * 3) / 8) % 2) : 0
      drawSprite(ctx, HERO, x, actor.y + bob, 11, pal)
      if (working) {
        const armY = actor.y + 9 + (Math.floor((frame + i * 5) / 4) % 2); rawRect(ctx, x + 10, armY, 3, 2, PAL.H)
        // the page on the desk, inked as the chapter fills
        rawRect(ctx, x + 1, 120, 5, 4, PROP_PAPER)
        const inked = Math.round(s.progress * 3)
        for (let k = 0; k < inked; k++) rawRect(ctx, x + 2, 121 + k, 3, 1, PROP_LINE)
      }
    }
    const dw = 12 + s.assistants.length * 15
    rect(ctx, ax, 84, dw, 3, '#8b5a2b'); rect(ctx, ax, 87, dw, 9, '#70461f')
    rect(ctx, ax + 2, 84, 8, 1, '#fdfcf7'); rect(ctx, ax + 2, 83, 8, 1, '#fdfcf7')
  }
  // the cat, in front of the assistants' desk
  const cat = s.actors.cat
  if (cat.state === 'sleeping') drawSprite(ctx, CAT[0], cat.x, cat.y, 6, CAT_PAL_ASLEEP, cat.facing === 1)
  else if (cat.state === 'walking') drawSprite(ctx, CAT[Math.floor(cat.anim / 125) % 2], cat.x, cat.y, 6, CAT_PAL, cat.facing === 1)
  else if (cat.state !== 'hidden' && cat.state !== 'away') drawSprite(ctx, CAT[0], cat.x, cat.y, 6, CAT_PAL, cat.facing === 1)

  // chair (before the player: they sit in it)
  if (s.owned.chair) EQUIPMENT_ART.chair(ctx, s, frame, night)
  else { rect(ctx, 70, 54, 20, 4, '#4a4a55'); rect(ctx, 71, 58, 2, 14, '#4a4a55'); rect(ctx, 87, 58, 2, 14, '#4a4a55') }

  // the mangaka seated at the desk (behind its top)
  drawMangaka(ctx, s, s.actors.mangaka, frame, working, false)

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
  if (absent) { rect(ctx, 96, 58, 8, 5, '#fff7c2'); rect(ctx, 97, 59, 6, 1, '#b8b2a5'); rect(ctx, 97, 61, 4, 1, '#b8b2a5') }

  // the mangaka in front of the desk (standing, walking or in bed), then the editor on a visit
  drawMangaka(ctx, s, s.actors.mangaka, frame, working, true)
  if (!absent && s.phase === 'submitted') {
    const d = Math.floor((s.running ? frame : 0) / 12) % 4
    for (let i = 0; i < d; i++) glyph(ctx, '.', 214 + i * 3, 92, '#16161a')
  }
  const editor = s.actors.editor
  if (editor.state !== 'hidden' && editor.state !== 'away') drawSprite(ctx, EDITOR, editor.x, editor.y, 15, PAL, editor.facing === 1)
  if (s.visitor === 'editor' && editor.state === 'standing' && editor.facing === -1) drawVisitorProp(ctx, s.visitorProp, editor.x, editor.y, frame)

  if (night) {
    ctx.fillStyle = 'rgba(20, 24, 60, 0.28)'; ctx.fillRect(0, 0, W, H)
    if (working) rect(ctx, 60, 46, 50, 34, 'rgba(255, 240, 180, 0.12)')
    // lights that glow through the dark go after the overlay
    drawSeasonNight(ctx, s.season, frame)
  }
  // the arm lamp (at night or while working) and the doorway's spill (at night), after the overlay so they glow
  drawStudioLights(ctx, s, night, working)
}
