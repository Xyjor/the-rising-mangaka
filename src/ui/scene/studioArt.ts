// The player's studio in the scene (`studioLook`): the tier's doorway and the loft's plants, the equipment, the volumes
// on the bookshelf, the anime poster and the trophies on the sill. render.ts calls each piece at its own place in the
// draw order; the lamp, the chair, the drafting table and the anime poster replace the stock piece in that place. Every
// piece keeps to its region (all inside x 8-184, which a phone's object-fit: cover never crops) and off the hero at the
// desk (x 74-85, y 48-62, but for the chair behind them and the drafting table's top on the desk's own row, y 62) and
// at the standing spot (x 112-123, y 62-76). Nothing here allocates per frame. Raw hex is deliberate: sprite colours,
// not UI tokens.
import type { EquipmentId, StudioTierId } from '../../sim'
import { rect } from './paint'
import type { Snapshot } from './render'

/** One flag per piece of equipment: studioLook's owned list as flags, set when it changes, never walked per frame. */
export type Owned = Record<EquipmentId, boolean>

/** Paints one piece of the studio. `frame` is 0 under reduced motion; `night` is render's. */
export type Art = (ctx: CanvasRenderingContext2D, s: Snapshot, frame: number, night: boolean) => void

export const NO_EQUIPMENT: Owned = {
  coffee: false, lamp: false, shelf: false, chair: false, 'drafting-table': false, tablet: false,
}

export function ownedFlags(equipment: readonly EquipmentId[]): Owned {
  return {
    coffee: equipment.includes('coffee'),
    lamp: equipment.includes('lamp'),
    shelf: equipment.includes('shelf'),
    chair: equipment.includes('chair'),
    'drafting-table': equipment.includes('drafting-table'),
    tablet: equipment.includes('tablet'),
  }
}

/** The most volumes the shelf top holds (studioLook caps the count there too). */
const MAX_VOLUMES = 24
/** The most trophies the sill holds: the most recent awards. */
export const SHOWN_TROPHIES = 4

// ---------- palette ----------

const WOOD_DARK = '#5a4634'
const METAL = '#3b3b45'
const METAL_DARK = '#2b2b33'
const METAL_LIGHT = '#6b6b78'
const MESH = '#4a5a78'
const PAPER = '#fdfcf7'
const INK = '#16161a'
const SKIN = '#f4cfa5'
const RED = '#e5484d'
const BLUE = '#3b6fd6'
const GREEN = '#3fa66c'
const GOLD = '#f5b700'
const GOLD_SHINE = '#ffe47a'
const VIOLET = '#7c4dff'
const ORANGE = '#e07b39'
const BRICK = '#c94b4b'
const SHELF_FRAME = '#6d4c33'
const SHELF_BACK = '#8b6543'
const SHELF_BOARD = '#5a3d28'
const DOOR_LIGHT = '#f2d49b'
const DOOR_FLOOR = '#dcb97c'
const NOREN = '#2e3a78'
const NOREN_CREST = '#f0ead6'
const LEAF = '#3a8f4e'
const LEAF_LIGHT = '#5fbf6a'
const STEM = '#4a3020'
const POT = '#c0643a'
const POT_RIM = '#a04f2c'
const TABLE_TOP = '#c49a6c'
const TABLE_EDGE = '#8b5a2b'
const TABLE_BODY = '#a0703c'
const TABLE_LEG = '#5a3618'
const LIGHTBOX_TOP = '#f4faff'
const LIGHTBOX_CASE = '#8a8a96'
const SHADE = '#e8e4d8'
const SHADE_RIM = '#b8b2a5'
const BULB_OFF = '#d9d3c5'
const BULB_ON = '#fff2a8'
const LAMP_GLOW = 'rgba(255,236,170,0.18)'
const DOOR_SPILL = 'rgba(255,214,150,0.35)'
const DOOR_HALO = 'rgba(255,214,150,0.12)'
const KV_SKY = '#2c3e8f'
const SPINES = [RED, BLUE, GOLD, GREEN, VIOLET, ORANGE] as const

// ---------- the tiers ----------

/**
 * A doorway in the right wall (x 168-184, from y 20 down to the bed at y 66), lit from the room beyond, with an indigo
 * noren across its top: a white crest and a split up the middle.
 */
function doorway(ctx: CanvasRenderingContext2D) {
  rect(ctx, 168, 20, 17, 46, WOOD_DARK)
  rect(ctx, 170, 22, 13, 44, DOOR_LIGHT)
  rect(ctx, 170, 56, 13, 10, DOOR_FLOOR)
  rect(ctx, 170, 22, 13, 13, NOREN)
  rect(ctx, 175, 24, 3, 3, NOREN_CREST)
  rect(ctx, 176, 28, 1, 7, DOOR_LIGHT)
}

/** A small potted plant on the windowsill's right, x 150-155, y 38-44. */
function sillPlant(ctx: CanvasRenderingContext2D) {
  rect(ctx, 152, 38, 2, 3, LEAF)
  rect(ctx, 150, 39, 2, 2, LEAF_LIGHT); rect(ctx, 154, 39, 2, 2, LEAF_LIGHT)
  rect(ctx, 150, 41, 6, 1, POT_RIM)
  rect(ctx, 151, 42, 4, 3, POT)
}

/** A tall potted plant on the floor in front of the bed's head, x 172-184, y 80-105. */
function floorPlant(ctx: CanvasRenderingContext2D) {
  rect(ctx, 178, 83, 1, 14, STEM)
  rect(ctx, 176, 80, 3, 3, LEAF_LIGHT); rect(ctx, 179, 82, 4, 3, LEAF); rect(ctx, 174, 84, 4, 3, LEAF)
  rect(ctx, 180, 88, 5, 3, LEAF); rect(ctx, 172, 89, 5, 3, LEAF_LIGHT)
  rect(ctx, 175, 93, 3, 2, LEAF); rect(ctx, 179, 92, 3, 2, LEAF_LIGHT)
  rect(ctx, 173, 97, 11, 2, POT_RIM)
  rect(ctx, 174, 99, 9, 7, POT)
}

/**
 * Each tier's room, drawn after the bed (which hides the doorway's foot) and before the sleeping mangaka and the Zz
 * that rise over the doorway. The doorway's warm spill at night is in `drawStudioLights`.
 */
export const TIER_ART: Record<StudioTierId, Art> = {
  apartment: () => {},
  flat: doorway,
  loft: (ctx) => {
    doorway(ctx)
    sillPlant(ctx)
    floorPlant(ctx)
  },
}

/** Which tiers have the lit doorway, so a new tier decides whether it spills light at night. */
const LIT_DOORWAY: Record<StudioTierId, boolean> = { apartment: false, flat: true, loft: true }

// ---------- the equipment ----------

/** A coffee machine on the sill's left, x 118-126, y 37-44: a cup in its bay and a red power light. */
function coffeeMachine(ctx: CanvasRenderingContext2D) {
  rect(ctx, 119, 37, 7, 7, METAL)
  rect(ctx, 119, 37, 7, 1, METAL_LIGHT)
  rect(ctx, 120, 39, 5, 3, '#1b1b1b')
  rect(ctx, 121, 40, 3, 2, PAPER)
  rect(ctx, 124, 38, 1, 1, RED)
  rect(ctx, 118, 44, 9, 1, METAL_DARK)
}

/** An arm lamp clamped at the desk's right, x 92-105, y 42-61, its shade over the page (lit in drawStudioLights). */
function armLamp(ctx: CanvasRenderingContext2D) {
  rect(ctx, 100, 60, 6, 2, METAL)
  rect(ctx, 102, 58, 2, 2, METAL)
  rect(ctx, 103, 45, 1, 13, METAL_LIGHT)
  rect(ctx, 102, 43, 3, 2, METAL)
  rect(ctx, 97, 42, 5, 1, METAL_LIGHT)
  rect(ctx, 94, 43, 4, 1, SHADE)
  rect(ctx, 93, 44, 6, 2, SHADE)
  rect(ctx, 92, 46, 8, 1, SHADE_RIM)
  rect(ctx, 94, 47, 4, 1, BULB_OFF)
}

/** A slim three-shelf unit on the wall between the bookshelf and the poster, x 43-50, y 20-57, above the desk top. */
function referenceShelf(ctx: CanvasRenderingContext2D) {
  rect(ctx, 43, 20, 8, 38, SHELF_FRAME)
  rect(ctx, 44, 21, 6, 36, SHELF_BACK)
  rect(ctx, 44, 32, 6, 1, SHELF_BOARD); rect(ctx, 44, 44, 6, 1, SHELF_BOARD); rect(ctx, 44, 56, 6, 1, SHELF_BOARD)
  // binders, then reference books, then a sketchbook on a pile lying flat
  rect(ctx, 44, 24, 2, 8, BLUE); rect(ctx, 46, 25, 2, 7, BRICK); rect(ctx, 48, 26, 1, 6, GOLD)
  rect(ctx, 44, 37, 2, 7, GREEN); rect(ctx, 46, 36, 1, 8, VIOLET); rect(ctx, 47, 38, 3, 6, ORANGE)
  rect(ctx, 44, 53, 6, 3, BLUE); rect(ctx, 45, 50, 5, 3, ORANGE); rect(ctx, 44, 48, 4, 2, PAPER)
}

/** A tall-backed mesh chair, x 68-91, y 46-71, drawn before the hero, who sits in it (the desk hides its foot). */
function tallChair(ctx: CanvasRenderingContext2D) {
  rect(ctx, 72, 46, 16, 9, METAL_DARK)
  rect(ctx, 73, 47, 14, 7, MESH)
  rect(ctx, 79, 58, 2, 14, METAL_LIGHT)
  rect(ctx, 70, 55, 20, 3, METAL_DARK)
  rect(ctx, 68, 51, 4, 2, METAL_DARK); rect(ctx, 69, 53, 1, 2, METAL_DARK)
  rect(ctx, 88, 51, 4, 2, METAL_DARK); rect(ctx, 90, 53, 1, 2, METAL_DARK)
}

/**
 * A big drafting table in the desk's place, x 44-111: a light top overhanging both ends, a front panel with a drawer
 * cabinet, and a lightbox on the left end (x 45-54, y 59-61).
 */
function draftingTable(ctx: CanvasRenderingContext2D) {
  rect(ctx, 44, 62, 68, 3, TABLE_TOP)
  rect(ctx, 44, 65, 68, 1, TABLE_EDGE)
  rect(ctx, 52, 66, 58, 14, TABLE_BODY)
  rect(ctx, 53, 66, 2, 16, TABLE_LEG); rect(ctx, 107, 66, 2, 16, TABLE_LEG)
  rect(ctx, 88, 68, 16, 10, TABLE_EDGE); rect(ctx, 88, 72, 16, 1, TABLE_LEG)
  rect(ctx, 95, 70, 2, 1, SHADE); rect(ctx, 95, 75, 2, 1, SHADE)
  rect(ctx, 45, 60, 10, 2, LIGHTBOX_CASE)
  rect(ctx, 45, 59, 10, 1, LIGHTBOX_TOP)
}

/** A pen tablet on the desk under the hero's pen, x 86-95, y 60-61 (the ink pot moves right to make room). */
function penTablet(ctx: CanvasRenderingContext2D) {
  rect(ctx, 86, 60, 10, 2, METAL_DARK)
  rect(ctx, 88, 60, 6, 1, MESH)
  rect(ctx, 94, 61, 1, 1, GREEN)
}

/** Each piece of equipment, painted where render calls it (see render's draw order). */
export const EQUIPMENT_ART: Record<EquipmentId, Art> = {
  coffee: coffeeMachine,
  lamp: armLamp,
  shelf: referenceShelf,
  chair: tallChair,
  'drafting-table': draftingTable,
  tablet: penTablet,
}

// ---------- the volumes, the poster, the trophies ----------

/** One spine per volume shipped, standing on the bookshelf (x 10-36, y 13-17) in sets of six, at most 24. */
export function drawVolumes(ctx: CanvasRenderingContext2D, volumes: number) {
  const n = Math.min(MAX_VOLUMES, volumes)
  for (let i = 0; i < n; i++) rect(ctx, 10 + i + Math.floor(i / 6), 13, 1, 5, SPINES[i % SPINES.length])
}

/** The anime's key visual in the poster's place (x 52-73, y 14-41): its hero against a dusk sky, over the title. */
export function drawAnimePoster(ctx: CanvasRenderingContext2D) {
  rect(ctx, 52, 14, 22, 28, PAPER)
  rect(ctx, 54, 16, 18, 24, KV_SKY)
  rect(ctx, 54, 29, 18, 6, VIOLET)
  rect(ctx, 66, 18, 5, 5, GOLD_SHINE)
  // spiky red hair, a determined look, a dark coat
  rect(ctx, 57, 20, 8, 3, RED); rect(ctx, 56, 21, 1, 2, RED); rect(ctx, 65, 21, 1, 2, RED)
  rect(ctx, 58, 23, 6, 4, SKIN)
  rect(ctx, 59, 24, 1, 1, INK); rect(ctx, 62, 24, 1, 1, INK)
  rect(ctx, 56, 27, 10, 8, INK)
  rect(ctx, 60, 27, 2, 3, PAPER)
  // the title
  rect(ctx, 54, 35, 18, 5, GOLD)
  rect(ctx, 56, 36, 3, 3, INK); rect(ctx, 60, 36, 5, 3, INK); rect(ctx, 66, 36, 4, 3, INK)
}

/** One gold trophy per award on the sill (x 130-144, y 38-44), 3 px wide with 1 px gaps, at most 4. */
export function drawTrophies(ctx: CanvasRenderingContext2D, trophies: number) {
  const n = Math.min(SHOWN_TROPHIES, trophies)
  for (let i = 0; i < n; i++) {
    const x = 130 + i * 4
    rect(ctx, x, 38, 3, 3, GOLD)
    rect(ctx, x, 38, 1, 1, GOLD_SHINE)
    rect(ctx, x + 1, 41, 1, 2, GOLD)
    rect(ctx, x, 43, 3, 2, TABLE_EDGE)
  }
}

// ---------- the lights ----------

/**
 * The studio's lights, drawn last so they glow through the night overlay: the arm lamp's bulb and its glow at night or
 * while the mangaka works, and the doorway's warm spill at night.
 */
export function drawStudioLights(ctx: CanvasRenderingContext2D, s: Snapshot, night: boolean, working: boolean) {
  if (s.owned.lamp && (night || working)) {
    rect(ctx, 94, 47, 4, 1, BULB_ON)
    rect(ctx, 93, 48, 6, 4, LAMP_GLOW)
    rect(ctx, 92, 52, 8, 10, LAMP_GLOW)
  }
  if (night && LIT_DOORWAY[s.tier]) {
    rect(ctx, 168, 30, 17, 36, DOOR_HALO)
    rect(ctx, 170, 35, 13, 31, DOOR_SPILL)
  }
}
