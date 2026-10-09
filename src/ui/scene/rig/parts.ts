// The rig's parts (0.11.0): every torso, arm and leg the cast is built from, each a hand-drawn string map in PAL keys
// (uppercase the base, lowercase its shade, L the outline, the light from the top left) with its named anchors, after
// art/raw/sprites/mangaka-front.png. Each part is outlined all round but where it joins another: the torso's neck row
// under the head's jaw, its shoulder caps over the arms' tops, the legs' tops under its hem (closeSilhouette closes
// them if a pose ever shows them). Sleeve and hand are separate runs, so OUTFIT_PALS' darker j darkens the sleeves.
import { HEAD } from './head'
import type { Part, PartLib } from './types'

/**
 * The standing torso, 18 x 14, placed at (7, 21) standing, so the head's neck lands on its neck (9, 0) and the hips
 * sit on row 34. Row 0: the shoulders' top outline (cols 1-2 and 15-16), the collar K rising beside the jaw (cols 3-4
 * and 13-14), the neck s between (cols 5-12) under the chin. Row 1: the shoulders in the hood's shade j, the collar K
 * (cols 4-6 and 11-13) either side of the neck s (cols 7-10). Row 2: the shoulder caps (cols 0-2 and 15-17, matching
 * the sleeves they sit over, the shoulder anchors at cols 2 and 15), the chest between its seams L (cols 3 and 14)
 * with the shirt R under the neck between the collar's points. Row 3: the V's tip, R beside the drawstring Y. A j
 * edge rings the collar outside (col 4 on row 2, cols 5 and 12 on row 3): the hood's roll in the hoodie, where K is
 * the hoodie's own grey, the lapels' shadow in the cardigan and blazer, where K is a white collar. Rows 3-11: the
 * drawstring Y down col 9 (a tie in the cardigan and blazer), the hoodie J, its shade j down the right (col 13). Row
 * 12: the hem j; row 13: the outline the hips sit on (hipL (6, 13), hipR (11, 13)).
 */
const TORSO: Part = {
  map: [
    '.LLKKssssssssKKLL.', // 0  the shoulders' top; the collar beside the jaw; the neck under the chin
    'LjjjKKKssssKKKjjjL', // 1  the hood's shade on the shoulders; the collar either side of the neck
    'jjjLjKKRRRRKKjLjjj', // 2  the shoulder caps over the sleeves; the seams; the shirt between the collar's points
    '...LJjKKRYKKjjL...', // 3  the V's tip and the drawstring's top
    '...LJJJJJYJJJjL...', // 4
    '...LJJJJJYJJJjL...', // 5
    '...LJJJJJYJJJjL...', // 6
    '...LJJJJJYJJJjL...', // 7
    '...LJJJJJYJJJjL...', // 8
    '...LJJJJJYJJJjL...', // 9
    '...LJJJJJYJJJjL...', // 10
    '...LJJJJJYJJJjL...', // 11 the drawstring's end
    '...LjjjjjjjjjjL...', // 12 the hem
    '...LLLLLLLLLLLL...', // 13 the outline the hips sit on
  ],
  anchors: { neck: { x: 9, y: 0 }, shoulderL: { x: 2, y: 2 }, shoulderR: { x: 15, y: 2 }, hipL: { x: 6, y: 13 }, hipR: { x: 11, y: 13 } },
}

/**
 * The near (left) arm hanging, 5 x 12: a sleeve j three wide in its outline, rows 0-8, its top row meeting the
 * torso's shoulder cap (shoulderL (3, 0); the same cells, so the shoulder reads one whether the arm is drawn over the
 * torso, as the near arm is, or under it); the fist S with its shade s on the right, rows 9-10 (hand (2, 10)), closed
 * by L on row 11 with its corners round.
 */
const ARM_L_HANG: Part = {
  map: [
    'LjjjL', // 0  under the shoulder cap
    'LjjjL', // 1
    'LjjjL', // 2
    'LjjjL', // 3
    'LjjjL', // 4
    'LjjjL', // 5
    'LjjjL', // 6
    'LjjjL', // 7
    'LjjjL', // 8
    'LSSsL', // 9  the fist
    'LSssL', // 10
    '.LLL.', // 11
  ],
  anchors: { shoulderL: { x: 3, y: 0 }, hand: { x: 2, y: 10 } },
}

/** The far (right) arm hanging: ARM_L_HANG's map (it is its own mirror, its fist lit from the left too), shoulderR (1, 0), hand (2, 10). */
const ARM_R_HANG: Part = {
  map: ARM_L_HANG.map,
  anchors: { shoulderR: { x: 1, y: 0 }, hand: { x: 2, y: 10 } },
}

/**
 * The near (left) leg standing, 6 x 14: the trousers F with their shade f on the right, three wide in their outline
 * (cols 1-5, so the hoodie's hem overhangs them a column), rows 0-10 (row 0 under the torso's hem, hipL (3, 0)); the
 * shoe O/o rows 11-12, a column wider on the outside, its toe turned out as the reference's are; the sole L on row 13.
 * Its right outline and the far leg's left one make the line between the legs (frame cols 15-16).
 */
const LEG_L_STAND: Part = {
  map: [
    '.LFFfL', // 0  under the hem
    '.LFFfL', // 1
    '.LFFfL', // 2
    '.LFFfL', // 3
    '.LFFfL', // 4
    '.LFFfL', // 5
    '.LFFfL', // 6
    '.LFFfL', // 7
    '.LFFfL', // 8
    '.LFFfL', // 9
    '.LFffL', // 10 the turn-up
    'LOOOoL', // 11 the shoe, its toe out a column
    'LOOooL', // 12
    'LLLLLL', // 13 the sole
  ],
  anchors: { hipL: { x: 3, y: 0 } },
}

/** The far (right) leg standing, LEG_L_STAND's mirror (hipR (2, 0)), a shade deeper (it is further from the light). */
const LEG_R_STAND: Part = {
  map: [
    'LFffL.', // 0  under the hem
    'LFffL.', // 1
    'LFffL.', // 2
    'LFffL.', // 3
    'LFffL.', // 4
    'LFffL.', // 5
    'LFffL.', // 6
    'LFffL.', // 7
    'LFffL.', // 8
    'LFffL.', // 9
    'LfffL.', // 10 the turn-up
    'LOOOoL', // 11 the shoe, its toe out a column
    'LOOooL', // 12
    'LLLLLL', // 13 the sole
  ],
  anchors: { hipR: { x: 2, y: 0 } },
}

/**
 * The near (left) leg stepping out on the walk's contact, 10 x 14: LEG_L_STAND's trousers (F/f, three wide in their
 * outline) leave the hip (hipL (7, 0), the same cells as the standing leg's top) and step out a column every three
 * rows (rows 2, 5 and 8), a straight leg slanting forward; the turn-up on row 10; the long shoe on rows 11-12 reaches
 * its toe two columns past the trousers to col 0 (frame col 6, four past the standing shoe, as 0.10's contact reached
 * four past its idle), the toe's top cut by the outline (row 11 col 1) so it points; the sole on row 13. The plan's
 * 8 wide (hipL (5, 0)) left the shoe two columns past the stance, and at 1x that contact read as standing.
 */
const LEG_L_STEP: Part = {
  map: [
    '.....LFFfL', // 0  under the hem
    '.....LFFfL', // 1
    '....LFFfL.', // 2  a column out every three rows
    '....LFFfL.', // 3
    '....LFFfL.', // 4
    '...LFFfL..', // 5
    '...LFFfL..', // 6
    '...LFFfL..', // 7
    '..LFFfL...', // 8
    '..LFFfL...', // 9
    '..LFffL...', // 10 the turn-up
    'LLOOOoL...', // 11 the long shoe, its toe pointing
    'LOOOooL...', // 12
    'LLLLLLL...', // 13 the sole
  ],
  anchors: { hipL: { x: 7, y: 0 } },
}

/**
 * The same leg planted on the down step, 10 x 13 (the hips a row lower, hipL (7, 0)): the shoe where LEG_L_STEP put
 * it (rows 10-12, the same frame cells), the knee giving: the thigh slants out a column a row (rows 1-3) to the knee,
 * the shin straight down from it to the shoe.
 */
const LEG_L_STEP_BEND: Part = {
  map: [
    '.....LFFfL', // 0  under the hem
    '....LFFfL.', // 1  the thigh, out a column a row
    '...LFFfL..', // 2
    '..LFFfL...', // 3  the knee
    '..LFFfL...', // 4  the shin, straight down to the shoe
    '..LFFfL...', // 5
    '..LFFfL...', // 6
    '..LFFfL...', // 7
    '..LFFfL...', // 8
    '..LFffL...', // 9  the turn-up
    'LLOOOoL...', // 10 the shoe where the step put it
    'LOOOooL...', // 11
    'LLLLLLL...', // 12
  ],
  anchors: { hipL: { x: 7, y: 0 } },
}

/**
 * The near (left) leg under the hip on the down step, 6 x 13: LEG_L_STAND a trouser row shorter (hipL (3, 0)), so the
 * hips sink a row while the shoe stays planted on rows 10-12 (the knee giving).
 */
const LEG_L_PLANT_BEND: Part = {
  map: [
    '.LFFfL', // 0  under the hem
    '.LFFfL', // 1
    '.LFFfL', // 2
    '.LFFfL', // 3
    '.LFFfL', // 4
    '.LFFfL', // 5
    '.LFFfL', // 6
    '.LFFfL', // 7
    '.LFFfL', // 8
    '.LFffL', // 9  the turn-up
    'LOOOoL', // 10 the shoe, where the standing leg's is
    'LOOooL', // 11
    'LLLLLL', // 12
  ],
  anchors: { hipL: { x: 3, y: 0 } },
}

/**
 * The near (left) leg passing, 6 x 12: LEG_L_STAND two trouser rows shorter (hipL (3, 0)), so the shoe is lifted two
 * rows clear of the floor (its sole on frame row 45) under the hip.
 */
const LEG_L_LIFT: Part = {
  map: [
    '.LFFfL', // 0  under the hem
    '.LFFfL', // 1
    '.LFFfL', // 2
    '.LFFfL', // 3
    '.LFFfL', // 4
    '.LFFfL', // 5
    '.LFFfL', // 6
    '.LFFfL', // 7
    '.LFffL', // 8  the turn-up
    'LOOOoL', // 9  the shoe, lifted
    'LOOooL', // 10
    'LLLLLL', // 11
  ],
  anchors: { hipL: { x: 3, y: 0 } },
}

/**
 * The near (left) leg reaching out to step, 7 x 12 (hipL (4, 0)): lifted as LEG_L_LIFT, the trousers out a column from
 * row 4, so the shoe hangs a column past the standing one, two rows clear of the floor, before the contact puts it down.
 */
const LEG_L_REACH: Part = {
  map: [
    '..LFFfL', // 0  under the hem
    '..LFFfL', // 1
    '..LFFfL', // 2
    '..LFFfL', // 3
    '.LFFfL.', // 4  reaching out a column
    '.LFFfL.', // 5
    '.LFFfL.', // 6
    '.LFFfL.', // 7
    '.LFffL.', // 8  the turn-up
    'LOOOoL.', // 9  the shoe, lifted
    'LOOooL.', // 10
    'LLLLLL.', // 11
  ],
  anchors: { hipL: { x: 4, y: 0 } },
}

/**
 * The far (right) leg stepping out, LEG_L_STEP's mirror, 10 x 14 (hipR (2, 0)): out to the right a column every three
 * rows, its toe on the right (row 11's last column cut by the outline). It keeps LEG_R_STAND's shading, the shade on
 * the right of every run (F then ff, the turn-up fff, the shoe's o at the toe), as each leg does on both halves.
 */
const LEG_R_STEP: Part = {
  map: [
    'LFffL.....', // 0  under the hem
    'LFffL.....', // 1
    '.LFffL....', // 2  a column out every three rows
    '.LFffL....', // 3
    '.LFffL....', // 4
    '..LFffL...', // 5
    '..LFffL...', // 6
    '..LFffL...', // 7
    '...LFffL..', // 8
    '...LFffL..', // 9
    '...LfffL..', // 10 the turn-up
    '...LOOOoLL', // 11 the long shoe, its toe pointing
    '...LOOOooL', // 12
    '...LLLLLLL', // 13 the sole
  ],
  anchors: { hipR: { x: 2, y: 0 } },
}

/** The far (right) leg planted on the down step: LEG_L_STEP_BEND's mirror in LEG_R_STAND's shading, 10 x 13 (hipR (2, 0)). */
const LEG_R_STEP_BEND: Part = {
  map: [
    'LFffL.....', // 0  under the hem
    '.LFffL....', // 1  the thigh, out a column a row
    '..LFffL...', // 2
    '...LFffL..', // 3  the knee
    '...LFffL..', // 4  the shin, straight down to the shoe
    '...LFffL..', // 5
    '...LFffL..', // 6
    '...LFffL..', // 7
    '...LFffL..', // 8
    '...LfffL..', // 9  the turn-up
    '...LOOOoLL', // 10 the shoe where the step put it
    '...LOOOooL', // 11
    '...LLLLLLL', // 12
  ],
  anchors: { hipR: { x: 2, y: 0 } },
}

/** The far (right) leg under the hip on the down step: LEG_R_STAND a trouser row shorter, 6 x 13 (hipR (2, 0)). */
const LEG_R_PLANT_BEND: Part = {
  map: [
    'LFffL.', // 0  under the hem
    'LFffL.', // 1
    'LFffL.', // 2
    'LFffL.', // 3
    'LFffL.', // 4
    'LFffL.', // 5
    'LFffL.', // 6
    'LFffL.', // 7
    'LFffL.', // 8
    'LfffL.', // 9  the turn-up
    'LOOOoL', // 10 the shoe, where the standing leg's is
    'LOOooL', // 11
    'LLLLLL', // 12
  ],
  anchors: { hipR: { x: 2, y: 0 } },
}

/** The far (right) leg passing: LEG_R_STAND two trouser rows shorter, the shoe lifted two rows, 6 x 12 (hipR (2, 0)). */
const LEG_R_LIFT: Part = {
  map: [
    'LFffL.', // 0  under the hem
    'LFffL.', // 1
    'LFffL.', // 2
    'LFffL.', // 3
    'LFffL.', // 4
    'LFffL.', // 5
    'LFffL.', // 6
    'LFffL.', // 7
    'LfffL.', // 8  the turn-up
    'LOOOoL', // 9  the shoe, lifted
    'LOOooL', // 10
    'LLLLLL', // 11
  ],
  anchors: { hipR: { x: 2, y: 0 } },
}

/** The far (right) leg reaching out to step: LEG_L_REACH's mirror in LEG_R_STAND's shading, 7 x 12 (hipR (2, 0)). */
const LEG_R_REACH: Part = {
  map: [
    'LFffL..', // 0  under the hem
    'LFffL..', // 1
    'LFffL..', // 2
    'LFffL..', // 3
    '.LFffL.', // 4  reaching out a column
    '.LFffL.', // 5
    '.LFffL.', // 6
    '.LFffL.', // 7
    '.LfffL.', // 8  the turn-up
    '.LOOOoL', // 9  the shoe, lifted
    '.LOOooL', // 10
    '.LLLLLL', // 11
  ],
  anchors: { hipR: { x: 2, y: 0 } },
}

/**
 * The near (left) arm swung forward, 6 x 10: under the shoulder cap as ARM_L_HANG (shoulderL (4, 0), rows 0-2), then
 * the forearm swung toward the viewer, a column wider out to the left (rows 3-6; its right edge stays on the torso's
 * seam), and the fist S/s four wide on rows 7-8, two rows higher than the hanging fist and a column further out; the
 * outline under it on row 9 (hand (2, 9)).
 */
const ARM_L_SWING_FWD: Part = {
  map: [
    '.LjjjL', // 0  under the shoulder cap
    '.LjjjL', // 1
    '.LjjjL', // 2
    'LjjjjL', // 3  the forearm, swung toward the viewer
    'LjjjjL', // 4
    'LjjjjL', // 5
    'LjjjjL', // 6
    'LSSSsL', // 7  the fist, two rows higher than the hanging one
    'LSSssL', // 8
    '.LLLL.', // 9
  ],
  anchors: { shoulderL: { x: 4, y: 0 }, hand: { x: 2, y: 9 } },
}

/**
 * The near (left) arm swung back, 5 x 12: ARM_L_HANG's sleeve to row 6 (shoulderL (3, 0)), then the forearm turned back
 * behind the hip, two wide against the torso's seam (rows 7-8), and the fist two wide by the hip (rows 9-10), so the
 * arm's outer edge steps in a column; the outline under it on row 11 (hand (1, 11)).
 */
const ARM_L_SWING_BACK: Part = {
  map: [
    'LjjjL', // 0  under the shoulder cap
    'LjjjL', // 1
    'LjjjL', // 2
    'LjjjL', // 3
    'LjjjL', // 4
    'LjjjL', // 5
    'LjjjL', // 6
    '.LjjL', // 7  the forearm, turned back behind the hip
    '.LjjL', // 8
    '.LSsL', // 9  the fist by the hip
    '.LSsL', // 10
    '.LLL.', // 11
  ],
  anchors: { shoulderL: { x: 3, y: 0 }, hand: { x: 1, y: 11 } },
}

/** The far (right) arm swung forward: ARM_L_SWING_FWD's mirror, out to the right, its fist lit from the left too (shoulderR (1, 0), hand (3, 9)). */
const ARM_R_SWING_FWD: Part = {
  map: [
    'LjjjL.', // 0  under the shoulder cap
    'LjjjL.', // 1
    'LjjjL.', // 2
    'LjjjjL', // 3  the forearm, swung toward the viewer
    'LjjjjL', // 4
    'LjjjjL', // 5
    'LjjjjL', // 6
    'LSSSsL', // 7  the fist, two rows higher than the hanging one
    'LSSssL', // 8
    '.LLLL.', // 9
  ],
  anchors: { shoulderR: { x: 1, y: 0 }, hand: { x: 3, y: 9 } },
}

/** The far (right) arm swung back: ARM_L_SWING_BACK's mirror, the fist by the hip against the seam (shoulderR (1, 0), hand (3, 11)). */
const ARM_R_SWING_BACK: Part = {
  map: [
    'LjjjL', // 0  under the shoulder cap
    'LjjjL', // 1
    'LjjjL', // 2
    'LjjjL', // 3
    'LjjjL', // 4
    'LjjjL', // 5
    'LjjjL', // 6
    'LjjL.', // 7  the forearm, turned back behind the hip
    'LjjL.', // 8
    'LSsL.', // 9  the fist by the hip
    'LSsL.', // 10
    '.LLL.', // 11
  ],
  anchors: { shoulderR: { x: 1, y: 0 }, hand: { x: 3, y: 11 } },
}

/** Every part a pose may name, by name. */
export const PARTS: PartLib = {
  head: HEAD, torso: TORSO, 'arm-l-hang': ARM_L_HANG, 'arm-r-hang': ARM_R_HANG,
  'leg-l-stand': LEG_L_STAND, 'leg-r-stand': LEG_R_STAND,
  'leg-l-step': LEG_L_STEP, 'leg-l-step-bend': LEG_L_STEP_BEND, 'leg-l-plant-bend': LEG_L_PLANT_BEND,
  'leg-l-lift': LEG_L_LIFT, 'leg-l-reach': LEG_L_REACH,
  'leg-r-step': LEG_R_STEP, 'leg-r-step-bend': LEG_R_STEP_BEND, 'leg-r-plant-bend': LEG_R_PLANT_BEND,
  'leg-r-lift': LEG_R_LIFT, 'leg-r-reach': LEG_R_REACH,
  'arm-l-swing-fwd': ARM_L_SWING_FWD, 'arm-l-swing-back': ARM_L_SWING_BACK,
  'arm-r-swing-fwd': ARM_R_SWING_FWD, 'arm-r-swing-back': ARM_R_SWING_BACK,
}
