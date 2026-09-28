// The room around the studio, all in canvas space (`rawRect`): each tier's walls and floor (`TIER_ROOM`: the
// apartment's tatami and wooden pillars, the flat's teal wallpaper, wainscot and honey planks, the loft's brick accent
// and pale concrete), the front row of props on the floor (`TIER_FRONT`, drawn after the actors so they pass behind
// it), the story props that picture the game (the corkboard, the calendar, the coffee cups, the serial's cover, the
// fan letters and the bin; story.ts reads their inputs) and the light (`drawAmbient`: the daylight shaft, the lamp's
// pool, the monitor glow and the vignette, after the night overlay). Every piece keeps inside the phone's visible band
// (x 60-260 for anything that matters) and off the actors' spots. Nothing here allocates per frame. Raw hex is
// deliberate: sprite colours, not UI tokens.
import type { StudioTierId } from '../../sim'
import { rawRect, shadow } from './paint'
import type { Snapshot } from './render'
import type { Art } from './studioArt'

/** Paints one tier's walls and floor across the whole 320x180 canvas (the wall to y 113, the floor from y 114). */
export type RoomArt = (ctx: CanvasRenderingContext2D, night: boolean) => void

// ---------- palette ----------

const PAPER = '#fdfcf7'
const INK = '#16161a'
const RED = '#e5484d'
const GOLD = '#f5b700'
const METAL = '#3b3b45'
const METAL_LIGHT = '#6b6b78'
const METAL_DARK = '#4a4a55'
const SKIN = '#f4cfa5'
const CUP = '#f2efe6'
const COFFEE = '#5a3618'
const NOTE = '#fff7c2'
const URGENT = '#f7b8b0'
const GRID = '#d9d3c5'
const CORK = '#b88a55'
const CORK_FRAME = '#8b5a2b'
const SWITCH = '#f0ead6'
const SWITCH_EDGE = '#b8b2a5'
const CARDBOARD = '#c49a6c'
const CARDBOARD_EDGE = '#8b6a44'
const TAPE = '#e0c48f'
const ZABUTON = '#8a3a52'
const ZABUTON_SHADE = '#6e2c41'
const TASSEL = '#f5b700'
const LEAF = '#3a8f4e'
const LEAF_LIGHT = '#5fbf6a'
const POT = '#c0643a'
const POT_RIM = '#a04f2c'
const SOFA = '#3b6f8f'
const SOFA_SHADE = '#2d566f'
const SOFA_CUSHION = '#4f86a8'
const LAMP_SHADE = '#f0ead6'
const BOOKS = ['#3b6fd6', '#e07b39', '#3fa66c'] as const
/** The daylight shaft's four steps, top to bottom: each one wider and fainter, a broad warm wedge. */
const DAYLIGHT = [
  'rgba(255, 244, 214, 0.14)', 'rgba(255, 244, 214, 0.12)', 'rgba(255, 244, 214, 0.1)', 'rgba(255, 244, 214, 0.08)',
] as const
const LAMP_POOL = 'rgba(255, 236, 170, 0.14)'
const MONITOR_GLOW = 'rgba(140, 200, 255, 0.18)'
const VIGNETTE = 'rgba(24, 16, 40, 0.12)'
/** The serial's cover by genre (story.ts `posterHue`). */
const HUES = ['#e5484d', '#3b6fd6', '#3fa66c', '#7c4dff', '#e07b39', '#1f9aa0'] as const

// ---------- the trim every room has ----------

/** A light switch by the door (x 244-247, y 84-89) and an outlet by the kitchenette (x 66-69, y 104-107). */
function trim(ctx: CanvasRenderingContext2D) {
  rawRect(ctx, 244, 84, 4, 6, SWITCH); rawRect(ctx, 245, 85, 2, 2, SWITCH_EDGE)
  rawRect(ctx, 66, 104, 4, 4, SWITCH); rawRect(ctx, 67, 105, 2, 1, SWITCH_EDGE)
}

// ---------- the tiers' rooms ----------

/**
 * The starter apartment: a six-mat room. Sand plaster with faint streaks, a wooden ceiling molding and a nageshi beam,
 * two pillars (x 62-65, by the kitchenette, and x 252-255, by the door), a baseboard, and tatami across the floor in
 * two rows of mats: straw weave lines every 3 px, the dark-green cloth edges (heri) along the mats' long sides and the
 * short seams staggered between the rows. 59 fills.
 */
function apartmentRoom(ctx: CanvasRenderingContext2D, night: boolean) {
  const wood = night ? '#5f4a36' : '#9c7550'
  rawRect(ctx, 0, 0, 320, 114, night ? '#857559' : '#e6d3a8')
  for (let x = 12; x < 320; x += 24) rawRect(ctx, x, 3, 1, 108, night ? '#8c7c60' : '#ecdcb6')
  rawRect(ctx, 0, 0, 320, 3, wood)
  rawRect(ctx, 0, 40, 320, 3, wood); rawRect(ctx, 0, 43, 320, 1, night ? '#6f6048' : '#c9b48a')
  rawRect(ctx, 62, 3, 4, 108, wood); rawRect(ctx, 252, 3, 4, 108, wood)
  rawRect(ctx, 62, 3, 1, 108, night ? '#6f5840' : '#b88d62'); rawRect(ctx, 252, 3, 1, 108, night ? '#6f5840' : '#b88d62')
  rawRect(ctx, 0, 111, 320, 3, night ? '#4f3e2e' : '#7a5a3e')
  rawRect(ctx, 0, 114, 320, 66, night ? '#8c8252' : '#cdbd7c')
  for (let y = 117; y < 180; y += 3) rawRect(ctx, 0, y, 320, 1, night ? '#7f7548' : '#bfae6c')
  const heri = night ? '#262f25' : '#3d4a3a'
  rawRect(ctx, 0, 114, 320, 2, heri); rawRect(ctx, 0, 146, 320, 2, heri); rawRect(ctx, 0, 178, 320, 2, heri)
  const seam = night ? '#6f6640' : '#a8984f'
  for (let x = 40; x < 320; x += 64) rawRect(ctx, x, 116, 1, 30, seam)
  for (let x = 8; x < 320; x += 64) rawRect(ctx, x, 148, 1, 30, seam)
  trim(ctx)
}

/** A rug on the floor in front of the desk (x 104-195, y 122-137): a field, a border and a fringe at each end. */
function rug(ctx: CanvasRenderingContext2D, field: string, border: string) {
  rawRect(ctx, 106, 122, 88, 16, border)
  rawRect(ctx, 108, 124, 84, 12, field)
  rawRect(ctx, 104, 124, 2, 12, PAPER); rawRect(ctx, 194, 124, 2, 12, PAPER)
}

/**
 * The flat: dusty teal wallpaper with pale stripes above a wood wainscot (rail at y 84, panel grooves every 32 px),
 * a baseboard, honey planks (rows every 8 px, seams every 80 px staggered row by row) and a red rug. 76 fills.
 */
function flatRoom(ctx: CanvasRenderingContext2D, night: boolean) {
  rawRect(ctx, 0, 0, 320, 114, night ? '#56716c' : '#8fb5ac')
  for (let x = 10; x < 320; x += 20) rawRect(ctx, x, 3, 2, 81, night ? '#5e7a74' : '#9dc2b9')
  rawRect(ctx, 0, 0, 320, 3, night ? '#5a4432' : '#8a5f3a')
  rawRect(ctx, 0, 86, 320, 25, night ? '#735638' : '#b98a5c')
  rawRect(ctx, 0, 84, 320, 2, night ? '#5a4432' : '#8a5f3a')
  for (let x = 16; x < 320; x += 32) rawRect(ctx, x, 88, 1, 21, night ? '#634a31' : '#a0764c')
  rawRect(ctx, 0, 111, 320, 3, night ? '#4a3626' : '#6e4a2c')
  rawRect(ctx, 0, 114, 320, 66, night ? '#7d5634' : '#c8894e')
  const line = night ? '#654428' : '#a86d3a'
  for (let y = 121; y < 180; y += 8) rawRect(ctx, 0, y, 320, 1, line)
  for (let row = 0; row < 8; row++) {
    const y = 114 + row * 8
    for (let x = (row * 28) % 80; x < 320; x += 80) rawRect(ctx, x, y, 1, 7, line)
  }
  rug(ctx, night ? '#7a342d' : '#b04a3f', night ? '#9a7a3e' : '#e0b25a')
  trim(ctx)
}

/**
 * The loft: pale plaster with an exposed brick accent between the window and the door (x 230-253: mortar rows every
 * 5 px, the joints alternating), a steel baseboard, and polished concrete (a sheen band, expansion joints) under an
 * indigo rug. 64 fills.
 */
function loftRoom(ctx: CanvasRenderingContext2D, night: boolean) {
  rawRect(ctx, 0, 0, 320, 114, night ? '#7e7b86' : '#dcd8cf')
  rawRect(ctx, 0, 0, 320, 3, night ? '#55535c' : '#a9a59c')
  rawRect(ctx, 230, 3, 24, 108, night ? '#6e3a3a' : '#b5574a')
  const mortar = night ? '#8a6e6e' : '#d9b7a5'
  for (let y = 8, row = 0; y < 111; y += 5, row++) {
    rawRect(ctx, 230, y, 24, 1, mortar)
    rawRect(ctx, row % 2 ? 246 : 238, y - 4, 1, 4, mortar)
  }
  rawRect(ctx, 0, 111, 320, 3, night ? '#34343c' : METAL_DARK)
  rawRect(ctx, 0, 114, 320, 66, night ? '#6c6a72' : '#bdb8ae')
  rawRect(ctx, 0, 150, 320, 3, night ? '#77757e' : '#cbc7bf')
  const joint = night ? '#5c5a62' : '#a9a49a'
  rawRect(ctx, 0, 146, 320, 1, joint)
  for (let x = 16; x < 320; x += 64) rawRect(ctx, x, 114, 1, 32, joint)
  for (let x = 48; x < 320; x += 64) rawRect(ctx, x, 147, 1, 33, joint)
  rug(ctx, night ? '#2c3656' : '#3f4f7a', night ? '#56627e' : '#8aa0c8')
  trim(ctx)
}

/** Each tier's walls and floor, painted first. */
export const TIER_ROOM: Record<StudioTierId, RoomArt> = {
  apartment: apartmentRoom,
  flat: flatRoom,
  loft: loftRoom,
}

// ---------- the front row ----------

/** The waste bin (x 233-243, y 151-167): a crumpled page on top per quarter of the manuscript drawn, while drawing. */
export function drawBin(ctx: CanvasRenderingContext2D, s: Snapshot) {
  const balls = s.phase === 'drawing' ? Math.min(3, Math.floor(s.progress * 4)) : 0
  for (let i = 0; i < balls; i++) rawRect(ctx, 234 + i * 3, 151 + (i % 2), 3, 3, PAPER)
  rawRect(ctx, 233, 154, 11, 2, METAL_DARK)
  rawRect(ctx, 234, 156, 9, 10, METAL_LIGHT)
  rawRect(ctx, 236, 158, 1, 6, METAL_DARK); rawRect(ctx, 240, 158, 1, 6, METAL_DARK)
  shadow(ctx, 233, 166, 11)
}

/** The apartment's front row: a zabuton floor cushion and a stack of manga boxes, and the bin. */
const apartmentFront: Art = (ctx, s) => {
  rawRect(ctx, 88, 161, 22, 7, ZABUTON); rawRect(ctx, 88, 166, 22, 2, ZABUTON_SHADE)
  rawRect(ctx, 87, 161, 1, 1, TASSEL); rawRect(ctx, 110, 161, 1, 1, TASSEL)
  shadow(ctx, 88, 168, 22)
  rawRect(ctx, 150, 148, 18, 10, CARDBOARD); rawRect(ctx, 148, 158, 22, 12, CARDBOARD)
  rawRect(ctx, 158, 148, 2, 10, TAPE); rawRect(ctx, 148, 163, 22, 2, TAPE)
  rawRect(ctx, 150, 157, 18, 1, CARDBOARD_EDGE); rawRect(ctx, 148, 169, 22, 1, CARDBOARD_EDGE)
  shadow(ctx, 148, 170, 22)
  drawBin(ctx, s)
}

/** The flat's front row: a potted fern, a stack of reference books on the floor, and the bin. */
const flatFront: Art = (ctx, s, frame) => {
  const sway = Math.floor(frame / 30) % 2
  rawRect(ctx, 76 + sway, 144, 4, 4, LEAF_LIGHT); rawRect(ctx, 71, 149, 6, 4, LEAF); rawRect(ctx, 81, 148, 6, 4, LEAF)
  rawRect(ctx, 73, 154, 12, 4, LEAF_LIGHT); rawRect(ctx, 78, 148, 1, 12, LEAF)
  rawRect(ctx, 72, 159, 14, 2, POT_RIM); rawRect(ctx, 73, 161, 12, 10, POT)
  shadow(ctx, 72, 171, 14)
  for (let i = 0; i < 3; i++) rawRect(ctx, 152 + (i % 2) * 2, 164 - i * 3, 16, 3, BOOKS[i])
  shadow(ctx, 151, 167, 20)
  drawBin(ctx, s)
}

/** The loft's front row: a floor lamp, the corner of a sofa, and the bin. */
const loftFront: Art = (ctx, s) => {
  rawRect(ctx, 64, 142, 12, 7, LAMP_SHADE); rawRect(ctx, 65, 149, 10, 1, SWITCH_EDGE)
  rawRect(ctx, 69, 150, 2, 24, METAL); rawRect(ctx, 65, 174, 10, 2, METAL)
  shadow(ctx, 64, 176, 12)
  rawRect(ctx, 196, 150, 34, 8, SOFA_SHADE); rawRect(ctx, 196, 158, 34, 16, SOFA)
  rawRect(ctx, 198, 158, 28, 5, SOFA_CUSHION); rawRect(ctx, 226, 154, 6, 20, SOFA_SHADE)
  rawRect(ctx, 198, 174, 2, 2, METAL); rawRect(ctx, 228, 174, 2, 2, METAL)
  shadow(ctx, 196, 176, 36)
  drawBin(ctx, s)
}

/** Each tier's front row, painted after every actor (and before the night overlay). */
export const TIER_FRONT: Record<StudioTierId, Art> = {
  apartment: apartmentFront,
  flat: flatFront,
  loft: loftFront,
}

// ---------- the story props ----------

/**
 * The corkboard above the desk (x 140-154, y 46-63): one storyboard card per eighth of the pages drawn (3x4 each, a
 * 3x3 grid, while a manuscript is on the desk), and in the last slot the last poll's note: a gold star for the top
 * three, a red mark for the bottom third.
 */
export function drawCorkboard(ctx: CanvasRenderingContext2D, s: Snapshot) {
  rawRect(ctx, 140, 46, 15, 18, CORK_FRAME)
  rawRect(ctx, 141, 47, 13, 16, CORK)
  const onDesk = s.phase === 'drawing' || s.phase === 'ready'
  const cards = onDesk ? Math.min(8, Math.floor(s.progress * 8)) : 0
  for (let i = 0; i < cards; i++) {
    const x = 142 + (i % 3) * 4
    const y = 48 + Math.floor(i / 3) * 5
    rawRect(ctx, x, y, 3, 4, PAPER)
    rawRect(ctx, x + 1, y + 1, 1, 2, GRID)
  }
  if (s.rankTone !== 'none') {
    rawRect(ctx, 150, 58, 3, 4, NOTE)
    if (s.rankTone === 'top') rawRect(ctx, 151, 59, 1, 1, GOLD)
    else if (s.rankTone === 'low') rawRect(ctx, 151, 59, 1, 2, RED)
  }
}

/**
 * The wall calendar right of the clock (x 164-177, y 50-63): the chapter's due day circled in red (a cell per day left,
 * up to 8), the grid reddened in the last three days, and the binding blinking red while the chapter runs late.
 */
export function drawCalendar(ctx: CanvasRenderingContext2D, s: Snapshot, frame: number) {
  rawRect(ctx, 164, 50, 14, 14, PAPER)
  rawRect(ctx, 164, 50, 14, 2, s.late && frame % 24 < 12 ? RED : METAL)
  if (s.daysLeft >= 0 && s.daysLeft <= 3) rawRect(ctx, 165, 53, 12, 9, URGENT)
  rawRect(ctx, 165, 55, 12, 1, GRID); rawRect(ctx, 165, 58, 12, 1, GRID); rawRect(ctx, 165, 61, 12, 1, GRID)
  rawRect(ctx, 168, 53, 1, 9, GRID); rawRect(ctx, 172, 53, 1, 9, GRID)
  if (s.daysLeft >= 0) {
    const d = Math.min(8, s.daysLeft)
    const x = 165 + (d % 3) * 4
    const y = 53 + Math.floor(d / 3) * 3
    rawRect(ctx, x, y, 3, 1, RED); rawRect(ctx, x, y + 2, 3, 1, RED)
    rawRect(ctx, x, y + 1, 1, 1, RED); rawRect(ctx, x + 2, y + 1, 1, 1, RED)
  }
}

/** Empty coffee cups on the floor under the desk's front (x 136-150, y 120-123): one each below 60, 40 and 20 stamina. */
export function drawCups(ctx: CanvasRenderingContext2D, s: Snapshot) {
  const n = s.stamina < 20 ? 3 : s.stamina < 40 ? 2 : s.stamina < 60 ? 1 : 0
  for (let i = 0; i < n; i++) {
    const x = 136 + i * 5
    rawRect(ctx, x, 120, 3, 4, CUP)
    rawRect(ctx, x, 120, 3, 1, COFFEE)
    rawRect(ctx, x + 3, 121, 1, 2, CUP)
  }
}

/** The running serial's cover in the poster's place (x 116-137, y 50-77): the title bar, the hero, the genre's colour. */
export function drawSeriesPoster(ctx: CanvasRenderingContext2D, hue: number) {
  rawRect(ctx, 116, 50, 22, 28, PAPER)
  rawRect(ctx, 118, 52, 18, 24, HUES[hue % HUES.length])
  rawRect(ctx, 118, 52, 18, 5, INK)
  rawRect(ctx, 120, 53, 5, 3, PAPER); rawRect(ctx, 126, 53, 7, 3, PAPER)
  rawRect(ctx, 124, 59, 6, 6, SKIN)
  rawRect(ctx, 123, 58, 8, 2, INK)
  rawRect(ctx, 121, 65, 12, 11, INK)
  rawRect(ctx, 126, 65, 2, 4, PAPER)
}

/** Fan letters on the doormat (x 259-273, y 108-113): one per fan level. */
export function drawFanLetters(ctx: CanvasRenderingContext2D, level: Snapshot['fanLevel']) {
  for (let i = 0; i < level; i++) {
    const x = 259 + i * 4
    const y = 111 - (i % 2) * 2
    rawRect(ctx, x, y, 6, 3, PAPER)
    rawRect(ctx, x + 4, y, 1, 1, RED)
  }
}

// ---------- the light ----------

/**
 * The light, after the night overlay and the studio's lights: by day, a shaft from the window on the floor that slides
 * with the sun (4 steps down the floor); at night while working, the desk lamp's pool on the desk (3 steps); the pen
 * tablet's glow while working; and always a soft vignette on the four edges.
 */
export function drawAmbient(ctx: CanvasRenderingContext2D, s: Snapshot, t: number, night: boolean, working: boolean) {
  if (!night && t > 0.12 && t < 0.66) {
    const shift = Math.round(40 - ((t - 0.12) / 0.54) * 80)
    // four steps (4 fills), each 8 px wider than the last (44 to 68) and grown 4 px each side, fading as it spreads
    for (let i = 0; i < 4; i++) {
      rawRect(ctx, 182 - i * 4 + Math.round((shift * (i + 1)) / 4), 114 + i * 16, 44 + i * 8, 16, DAYLIGHT[i])
    }
  }
  if (night && working) {
    rawRect(ctx, 158, 89, 13, 4, LAMP_POOL)
    rawRect(ctx, 154, 93, 21, 5, LAMP_POOL)
    rawRect(ctx, 150, 98, 29, 4, LAMP_POOL)
  }
  if (working && s.owned.tablet) rawRect(ctx, 150, 94, 12, 4, MONITOR_GLOW)
  rawRect(ctx, 0, 0, 320, 6, VIGNETTE)
  rawRect(ctx, 0, 172, 320, 8, VIGNETTE)
  rawRect(ctx, 0, 6, 8, 166, VIGNETTE)
  rawRect(ctx, 312, 6, 8, 166, VIGNETTE)
}
