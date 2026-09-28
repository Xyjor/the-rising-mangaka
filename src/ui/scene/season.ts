// The window's four seasons: which one a day falls in, and the layer render paints for it. The art lives in the window
// pane (x 118-161, y 12-43), except winter's snow: the sill's top row (x 114-165, y 45; the sill is y 45-47) and two
// drifts at y 44 on the frame's bottom border. Particles are 1 px (leaves 2 px wide) and move by a pure function of
// (index, frame) over module-level seed tables, wrapping inside the pane; with frame 0 (reduced motion) they hold
// still. Nothing here allocates per frame. Raw hex is deliberate: sprite colours, not UI tokens.
import { describeDate } from '../../sim'
import { BAR_X, PANE_H, PANE_W, PANE_X, PANE_Y, rect } from './paint'

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** The sim's calendar month: 1-3 spring, 4-6 summer, 7-9 autumn, 10-12 winter, so every year opens in spring. */
export function seasonOf(day: number): Season {
  const month = describeDate(day).month
  return month <= 3 ? 'spring' : month <= 6 ? 'summer' : month <= 9 ? 'autumn' : 'winter'
}

// ---------- the pane and its particles ----------

const PETAL_A = '#f7b6c8'
const PETAL_B = '#f29bb4'
const BRANCH = '#5b3a2e'
const LEAF_GREEN = '#2f7a3a'
const LEAF_GREEN_LIGHT = '#5aa845'
const LEAF_RUST = '#b5502a'
const LEAF_AMBER = '#d98a2b'
const FALLING_LEAVES = ['#e2733a', '#c9442e', '#e8a33d'] as const
const CHIME_STRING = '#3b3b45'
const CHIME_GLASS = '#bfe6f0'
const CHIME_STRIP = '#e5484d'
const SNOW = '#f4f8ff'
const FIREFLY = '#e8ff8a'

// Seed tables, three bytes a particle: x offset in the pane (0-43), speed (1-3), phase (the starting row, 0-31).
const PETAL_SEEDS = Uint8Array.of(
  3, 2, 0, 17, 1, 11, 29, 3, 22, 40, 2, 5,
  9, 1, 16, 23, 3, 27, 35, 2, 8, 1, 3, 19,
  14, 1, 30, 27, 2, 13, 38, 3, 24, 20, 1, 3,
)
const LEAF_SEEDS = Uint8Array.of(
  5, 2, 4, 19, 1, 15, 31, 3, 26, 42, 2, 9,
  11, 3, 20, 25, 1, 31, 36, 2, 12, 2, 1, 23,
  16, 2, 1, 28, 3, 17, 39, 1, 28, 22, 2, 7,
)
const SNOW_SEEDS = Uint8Array.of(
  1, 1, 0, 7, 2, 18, 13, 1, 9, 19, 3, 27,
  25, 2, 4, 31, 1, 22, 37, 2, 13, 43, 1, 30,
  4, 3, 6, 10, 1, 25, 16, 2, 15, 22, 1, 2,
  28, 3, 20, 34, 2, 11, 40, 1, 28, 21, 2, 17,
)
// Fireflies hover: an even phase keeps one in rows 18-25, an odd one in rows 29-36 (clear of the bar at y 27-28 and
// of the sill), and the phase offsets its wander. Phases 13 and 21 (5 mod 8) wander across the lower band's edges, 6
// across the upper band's, and x offset 20 across the vertical bar.
const FIREFLY_SEEDS = Uint8Array.of(
  6, 1, 13, 20, 2, 6, 27, 1, 8, 36, 2, 19, 12, 3, 21,
)
/** A back-and-forth wander of up to 3 px, indexed by (step + phase) mod 8. */
const SWAY = Uint8Array.of(0, 1, 2, 3, 3, 2, 1, 0)

/** How far particle i has fallen by this frame, in whole pixels before wrapping: frame x its speed / div. */
function fallen(seeds: Uint8Array, i: number, frame: number, div: number): number {
  return Math.floor((frame * seeds[i * 3 + 1]) / div)
}

/** Particle i's row: its phase plus how far it has fallen, wrapped top to bottom inside the pane. */
function rowOf(seeds: Uint8Array, i: number, fall: number): number {
  return PANE_Y + ((seeds[i * 3 + 2] + fall) % PANE_H)
}

/** Particle i's column: its x offset plus a drift, wrapped across `span` columns (the pane less a wide particle). */
function colOf(seeds: Uint8Array, i: number, drift: number, span: number): number {
  return PANE_X + ((seeds[i * 3] + drift) % span)
}

// ---------- the static art ----------

/** A branch reaching in from the top-left corner (spring and winter). */
function branch(ctx: CanvasRenderingContext2D) {
  rect(ctx, 118, 15, 8, 1, BRANCH); rect(ctx, 125, 16, 6, 1, BRANCH); rect(ctx, 130, 17, 5, 1, BRANCH)
  rect(ctx, 123, 13, 1, 2, BRANCH); rect(ctx, 128, 17, 1, 2, BRANCH)
}

/** A tree's canopy hanging into the top-left of the pane (summer green, autumn rust). */
function canopy(ctx: CanvasRenderingContext2D, dark: string, light: string) {
  rect(ctx, 118, 12, 20, 3, dark); rect(ctx, 118, 15, 14, 2, dark); rect(ctx, 118, 17, 8, 2, dark)
  rect(ctx, 121, 13, 6, 2, light); rect(ctx, 129, 12, 5, 2, light); rect(ctx, 119, 16, 4, 1, light)
}

// ---------- the layer ----------

/** The season inside the window pane: drawn after the sky, the sun or moon and the clouds, before the window bars. */
export function drawSeasonPane(ctx: CanvasRenderingContext2D, season: Season, frame: number) {
  switch (season) {
    case 'spring': {
      branch(ctx)
      rect(ctx, 118, 13, 3, 2, PETAL_A); rect(ctx, 126, 14, 3, 2, PETAL_A); rect(ctx, 133, 15, 2, 2, PETAL_A)
      rect(ctx, 122, 12, 2, 2, PETAL_B); rect(ctx, 129, 18, 2, 2, PETAL_B)
      // petals blow down and to the right
      for (let i = 0; i < 12; i++) {
        const fall = fallen(PETAL_SEEDS, i, frame, 24)
        const x = colOf(PETAL_SEEDS, i, Math.floor(fall / 2), PANE_W)
        rect(ctx, x, rowOf(PETAL_SEEDS, i, fall), 1, 1, i % 2 ? PETAL_B : PETAL_A)
      }
      return
    }
    case 'summer': {
      canopy(ctx, LEAF_GREEN, LEAF_GREEN_LIGHT)
      // a wind chime (furin) hanging in the right pane, its paper strip swinging
      rect(ctx, 146, 12, 1, 4, CHIME_STRING); rect(ctx, 144, 16, 5, 3, CHIME_GLASS)
      rect(ctx, 146 + (Math.floor(frame / 16) % 2), 19, 1, 5, CHIME_STRIP)
      return
    }
    case 'autumn': {
      canopy(ctx, LEAF_RUST, LEAF_AMBER)
      // leaves swing side to side as they fall; 2 px wide, so they wrap one column short of the pane's edge
      for (let i = 0; i < 12; i++) {
        const fall = fallen(LEAF_SEEDS, i, frame, 28)
        const drift = SWAY[(fall + LEAF_SEEDS[i * 3 + 2]) % 8]
        rect(ctx, colOf(LEAF_SEEDS, i, drift, PANE_W - 1), rowOf(LEAF_SEEDS, i, fall), 2, 1, FALLING_LEAVES[i % 3])
      }
      return
    }
    case 'winter': {
      branch(ctx)
      rect(ctx, 118, 14, 6, 1, SNOW); rect(ctx, 125, 15, 4, 1, SNOW); rect(ctx, 131, 16, 3, 1, SNOW)
      // snow drifts slowly down with a one-pixel wobble
      for (let i = 0; i < 16; i++) {
        const fall = fallen(SNOW_SEEDS, i, frame, 48)
        rect(ctx, colOf(SNOW_SEEDS, i, Math.floor((fall + i) / 4) % 2, PANE_W), rowOf(SNOW_SEEDS, i, fall), 1, 1, SNOW)
      }
      return
    }
  }
}

/**
 * Winter's snow: over the sill's top row (x 114-165, y 45; the sill is y 45-47) and two drifts at y 44 on the frame's
 * bottom border. Drawn after the sill, before anything that stands on it.
 */
export function drawSeasonSill(ctx: CanvasRenderingContext2D, season: Season) {
  if (season !== 'winter') return
  rect(ctx, 114, 45, 52, 1, SNOW); rect(ctx, 117, 44, 7, 1, SNOW); rect(ctx, 148, 44, 10, 1, SNOW)
}

/**
 * Spring's cherry spilling past the pane: the branch carries on over the frame's top-left corner onto the wall (room
 * x 107-117, y 6-12; canvas x 171-181, y 42-48) with three blossom clusters, so the tree reads as bigger than the
 * window. Drawn after the window bars and the sill (the pane's art stays between the sky and the bars), clear of the
 * calendar (canvas y 50 and down) and the corkboard (canvas x 140-154). 6 fills, spring only.
 */
export function drawSeasonWall(ctx: CanvasRenderingContext2D, season: Season) {
  if (season !== 'spring') return
  rect(ctx, 111, 10, 7, 1, BRANCH); rect(ctx, 113, 8, 1, 2, BRANCH)
  rect(ctx, 109, 9, 3, 2, PETAL_A); rect(ctx, 112, 6, 3, 2, PETAL_B); rect(ctx, 115, 7, 2, 2, PETAL_A)
  rect(ctx, 107, 11, 2, 2, PETAL_B)
}

/** Summer's fireflies: drawn after the night overlay, so they glow, and only at night (the caller checks). */
export function drawSeasonNight(ctx: CanvasRenderingContext2D, season: Season, frame: number) {
  if (season !== 'summer') return
  for (let i = 0; i < 5; i++) {
    const step = fallen(FIREFLY_SEEDS, i, frame, 32)
    const phase = FIREFLY_SEEDS[i * 3 + 2]
    // they draw over the window bars, so they keep off them: 42 columns, skipping the vertical bar (x 139-140)
    const col = colOf(FIREFLY_SEEDS, i, SWAY[(step + phase) % 8], PANE_W - 2)
    const x = col >= BAR_X ? col + 2 : col
    const y = (phase % 2 ? 29 : 18) + ((phase + SWAY[(step + phase + 2) % 8]) % 8)
    rect(ctx, x, y, 1, 1, FIREFLY)
  }
}
