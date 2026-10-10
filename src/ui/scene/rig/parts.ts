// The rig's parts (0.11.0): every torso, arm, leg and prop the cast is built from, each a hand-drawn string map in PAL
// keys (uppercase the base, lowercase its shade, L the outline, the light from the top left) with its named anchors,
// after art/raw/sprites/mangaka-front.png. Each part is outlined all round but where it joins another: the torso's neck
// row under the head's jaw, its shoulder caps over the arms' tops, the legs' tops under its hem (closeSilhouette closes
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

/**
 * The near (left) leg seated, 6 x 8, placed from the hip on frame row 40 (hipL (3, 0)), so it fills rows 40-47 behind
 * the desk (drawn for the sheet; the desk hides it in the scene). The thigh comes toward the viewer,
 * foreshortened: its lit top F a column wider than the standing trousers on rows 1-2 (the knee, its shade f on the
 * right); under the knee (row 3) the outline creases in and the shin, in the thigh's shade f, turns in toward the other
 * one (rows 3-4), so the knees sit apart over the feet; the shoe O/o on rows 5-6, three wide (its toe toward the
 * viewer), the sole L on row 7.
 */
const LEG_L_SEAT: Part = {
  map: [
    '.LFFfL', // 0
    'LFFFFL', // 1
    'LFFFfL', // 2
    '.LLffL', // 3
    '..LffL', // 4
    '.LOOoL', // 5
    '.LOooL', // 6
    '.LLLLL', // 7
  ],
  anchors: { hipL: { x: 3, y: 0 } },
}

/** The far (right) leg seated: LEG_L_SEAT's mirror in LEG_R_STAND's shading (the shade on the right of every run), 6 x 8 (hipR (2, 0)). */
const LEG_R_SEAT: Part = {
  map: [
    'LFffL.', // 0
    'LFFffL', // 1
    'LFFffL', // 2
    'LffLL.', // 3
    'LffL..', // 4
    'LOOoL.', // 5
    'LOooL.', // 6
    'LLLLL.', // 7
  ],
  anchors: { hipR: { x: 2, y: 0 } },
}

/**
 * The near (left) leg half-sitting, 6 x 11, placed from the hip on frame row 37 (hipL (3, 0)), so it fills rows 37-47,
 * between standing (14 rows) and seated (8): the knee bent halfway down to the chair. The thigh leaves the hip as the
 * standing trousers (row 1), then comes forward toward the viewer, its lit top F a column wider out down to the knee
 * (rows 2-4, its shade f on the right); under the knee the outline steps back in and the shin is in the knee's shade f
 * (rows 5-7), as LEG_L_SEAT's shin is, so the lit thigh over the dark shin reads as the bend; the shoe O/o on rows 8-9,
 * its toe out a column as the standing shoe's, the sole L on row 10. (A first draw, the shin lit again under a shaded
 * band, read at 8x as baggy trousers.)
 */
const LEG_L_HALF: Part = {
  map: [
    '.LFFfL', // 0  under the hem
    '.LFFfL', // 1
    'LFFFfL', // 2  the thigh forward, a column wider out
    'LFFFfL', // 3
    'LFFFfL', // 4  the knee
    '.LfffL', // 5  the shin, in the knee's shade
    '.LfffL', // 6
    '.LfffL', // 7
    'LOOOoL', // 8  the shoe, its toe out a column
    'LOOooL', // 9
    'LLLLLL', // 10 the sole
  ],
  anchors: { hipL: { x: 3, y: 0 } },
}

/** The far (right) leg half-sitting: LEG_L_HALF's mirror in LEG_R_STAND's shading (the shade on the right of every run), 6 x 11 (hipR (2, 0)). */
const LEG_R_HALF: Part = {
  map: [
    'LFffL.', // 0  under the hem
    'LFffL.', // 1
    'LFFffL', // 2  the thigh forward, a column wider out
    'LFFffL', // 3
    'LFFffL', // 4  the knee
    'LfffL.', // 5  the shin, in the knee's shade
    'LfffL.', // 6
    'LfffL.', // 7
    'LOOOoL', // 8  the shoe, its toe out a column
    'LOOooL', // 9
    'LLLLLL', // 10 the sole
  ],
  anchors: { hipR: { x: 2, y: 0 } },
}

/**
 * The near (left) arm drawing at the page's left, 10 x 11 (shoulderL (8, 0), so the part's left edge is frame col 1):
 * the sleeve j hangs from the shoulder cap as ARM_L_HANG's (frame cols 7-9, rows 29-35), then the forearm lies out
 * along the desk to the left (rows 37-38, its top edge on row 36 from the elbow out over the fist), the fist S/s round
 * the pen at its end (frame cols 3-5, rows 37-38, the shade on the right and underneath), the outline under the
 * forearm and fist on row 39, the desk top's line. The hand (1, 9) is the fist's left edge on its lower row (frame
 * (2, 38)), so the pen stands a row higher than in the other two steps: lifted at the far end of the stroke. The pen
 * runs down the fist's left edge, which it covers.
 */
const ARM_L_DESK_A: Part = {
  map: [
    '.....LjjjL', // 0
    '.....LjjjL', // 1
    '.....LjjjL', // 2
    '.....LjjjL', // 3
    '.....LjjjL', // 4
    '.....LjjjL', // 5
    '.....LjjjL', // 6
    '..LLLLjjjL', // 7
    '.LSSsjjjjL', // 8
    '.LSssjjjjL', // 9
    '.LLLLLLLLL', // 10
  ],
  anchors: { shoulderL: { x: 8, y: 0 }, hand: { x: 1, y: 9 } },
}

/**
 * The near (left) arm drawing at the page's middle, 9 x 11 (shoulderL (7, 0), the part's left edge frame col 2): the
 * sleeve down to row 34, the elbow a column wider on rows 35-36 (the forearm coming forward and out), the fist two
 * columns out from the shoulder (frame cols 5-7, rows 37-38) with the forearm's end j beside it, the outline on row 39.
 * The hand (2, 10) is the outline under the fist's left edge (frame (4, 39)), where the pen's nib lands.
 */
const ARM_L_DESK_B: Part = {
  map: [
    '....LjjjL', // 0
    '....LjjjL', // 1
    '....LjjjL', // 2
    '....LjjjL', // 3
    '....LjjjL', // 4
    '....LjjjL', // 5
    '...LjjjjL', // 6
    '...LjjjjL', // 7
    '..LSSsjjL', // 8
    '..LSssjjL', // 9
    '..LLLLLLL', // 10
  ],
  anchors: { shoulderL: { x: 7, y: 0 }, hand: { x: 2, y: 10 } },
}

/**
 * The near (left) arm drawing at the page's right, 8 x 11 (shoulderL (6, 0), the part's left edge frame col 3): the
 * sleeve down to row 33, then the forearm toward the viewer, foreshortened, two wide and turned in toward the page's
 * right (frame cols 8-9, rows 34-36), the fist under it (frame cols 7-9, rows 37-38), the outline on row 39. The hand
 * (3, 10) is the outline under the fist's left edge (frame (6, 39)); the pen's top rises a column clear of the forearm.
 */
const ARM_L_DESK_C: Part = {
  map: [
    '...LjjjL', // 0
    '...LjjjL', // 1
    '...LjjjL', // 2
    '...LjjjL', // 3
    '...LjjjL', // 4
    '....LjjL', // 5
    '....LjjL', // 6
    '....LjjL', // 7
    '...LSSsL', // 8
    '...LSssL', // 9
    '...LLLLL', // 10
  ],
  anchors: { shoulderL: { x: 6, y: 0 }, hand: { x: 3, y: 10 } },
}

/**
 * The near (left) arm resting, 8 x 11 (shoulderL (6, 0), the part's left edge frame col 3): the sleeve down to row 34,
 * the forearm on the desk coming toward the viewer, a column wider (rows 35-36), and the open hand flat on the desk
 * (frame cols 4-7, rows 37-38: the back of the hand S, its shade s on the right, the fingers' underside s), a column out
 * past the cuff, its top edge outlined on row 36; the outline on row 39, the desk top's line (hand (2, 10), frame
 * (5, 39)).
 */
const ARM_L_REST: Part = {
  map: [
    '...LjjjL', // 0
    '...LjjjL', // 1
    '...LjjjL', // 2
    '...LjjjL', // 3
    '...LjjjL', // 4
    '...LjjjL', // 5
    '..LjjjjL', // 6
    '.LLjjjjL', // 7
    'LSSSsjjL', // 8
    'LssssjjL', // 9
    '.LLLLLLL', // 10
  ],
  anchors: { shoulderL: { x: 6, y: 0 }, hand: { x: 2, y: 10 } },
}

/**
 * The far (right) arm on the desk, 7 x 11 (shoulderR (1, 0), the part's left edge on the torso's seam, frame col 21):
 * the sleeve down to row 34, the trailing forearm on the desk a column wider out to the right (rows 35-36), the hand
 * S/s on the desk at its end (frame cols 24-26, rows 37-38), the outline on row 39 (hand (3, 10), frame (24, 39)).
 * Both the drawing and the resting poses keep it; the near arm's open hand mirrors it, a column wider.
 */
const ARM_R_DESK: Part = {
  map: [
    'LjjjL..', // 0
    'LjjjL..', // 1
    'LjjjL..', // 2
    'LjjjL..', // 3
    'LjjjL..', // 4
    'LjjjL..', // 5
    'LjjjjL.', // 6
    'LjjjjL.', // 7
    'LjjSSsL', // 8
    'LjjSssL', // 9
    'LLLLLL.', // 10
  ],
  anchors: { shoulderR: { x: 1, y: 0 }, hand: { x: 3, y: 10 } },
}

/**
 * The pen, 2 x 6: a line one cell wide in L rising up and left from the hand (1, 5), where its steel nib P is: up the
 * hand's column (rows 2-5), then a column out to the left for its last two cells (rows 0-1), so it leans away from the
 * fist. Drawn over the drawing arm (the prop layer), it covers the fist's left edge. The nib lands on the silhouette's
 * edge in every drawing step (the frame's lowest row there, or beside a clear cell), so the assembler's outline closes
 * it to L; it shows as steel only where a hand encloses it.
 */
const PEN: Part = {
  map: [
    'L.', // 0
    'L.', // 1
    '.L', // 2
    '.L', // 3
    '.L', // 4
    '.P', // 5
  ],
  anchors: { hand: { x: 1, y: 5 } },
}

/**
 * The near (left) arm holding the manuscript at the chest, 7 x 9 (shoulderL (5, 0), so the part's left edge is frame
 * col 4): the sleeve j hangs from the shoulder cap as ARM_L_HANG's (frame cols 6-10, rows 23-26), the elbow bends and
 * the forearm comes forward and out to the left a column a row (rows 27-28), and the hand S/s lies across on rows
 * 29-30 (frame cols 5-9), its shade on the right and underneath, the outline under it on row 31, its corners round.
 * The hand (2, 7) holds the manuscript's right edge (frame (6, 30)); the manuscript, drawn over it, hides the forearm
 * and the fingers (frame cols 0-7), so the sleeve shows two wide between the pages' edge and the torso's seam, the
 * fist at its foot gripping them.
 */
const ARM_L_HOLD: Part = {
  map: [
    '..LjjjL', // 0  under the shoulder cap
    '..LjjjL', // 1
    '..LjjjL', // 2
    '..LjjjL', // 3
    '.LjjjjL', // 4  the forearm comes forward
    'LjjjjjL', // 5
    'LSSSSsL', // 6  the hand across, gripping the pages
    'LSSSssL', // 7
    '.LLLLL.', // 8
  ],
  anchors: { shoulderL: { x: 5, y: 0 }, hand: { x: 2, y: 7 } },
}

/**
 * The manuscript, 8 x 10: a stack of pages held up by its right edge (hand (6, 6)), the top sheet W ruled with w lines
 * (rows 2, 4 and 6, the last one short), the sheets under it showing as a w edge along the bottom (row 8, the shade
 * underneath), all in an L outline. Drawn over the holding arm (the prop layer), at frame (0, 24), beside the chest.
 */
const MANUSCRIPT: Part = {
  map: [
    'LLLLLLLL', // 0
    'LWWWWWWL', // 1
    'LWwwwwWL', // 2  the lines
    'LWWWWWWL', // 3
    'LWwwwwWL', // 4
    'LWWWWWWL', // 5
    'LWwwWWWL', // 6  the last line short; the hand at col 6
    'LWWWWWWL', // 7
    'LwwwwwwL', // 8  the sheets under it
    'LLLLLLLL', // 9
  ],
  anchors: { hand: { x: 6, y: 6 } },
}

/**
 * The near (left) arm raising the mug to the mouth, 7 x 9 (shoulderL (2, 8), so standing the part's top-left is frame
 * (7, 15), seated (7, 21)): the sleeve j rises from the shoulder (its underside an L row on the shoulder line, row 8,
 * over the torso's cap, as 0.10's raised sleeve was closed) a column in every two rows to the cuff (rows 4-7), the
 * upper arm foreshortened toward the viewer, and the fist S/s three rows tall on rows 1-3 (frame cols 10-12 standing,
 * rows 16-18), its shade on the right and underneath, by the mug's left wall. The hand (5, 1) is the fist's right
 * column, where the mug's left wall lands. Drawn after the head (the front arm), the fist and the sleeve close their
 * own outline against the face, which the assembler cannot (skin beside skin).
 */
const ARM_L_MUG: Part = {
  map: [
    '..LLLL.', // 0  the fist's top (the mug's wall covers col 6)
    '..LSSSL', // 1  the fist round the mug
    '..LSSsL', // 2
    '..LSssL', // 3
    '.LjjjL.', // 4  the cuff
    '.LjjjL.', // 5
    'LjjjL..', // 6  the sleeve, a column out toward the shoulder
    'LjjjL..', // 7
    'LLLLL..', // 8  the raised sleeve's underside on the shoulder line
  ],
  anchors: { shoulderL: { x: 2, y: 8 }, hand: { x: 5, y: 1 } },
}

/**
 * The near (left) arm half raised, the mug under the chin, 6 x 6 (shoulderL (2, 5), standing top-left (7, 18)): the
 * fist S/s on rows 1-2 (frame rows 19-20 standing, by the jaw), the cuff on row 3, the sleeve on row 4 a column out
 * toward the shoulder, its underside an L row on the shoulder line (row 5). The hand (4, 1) is the fist's right column,
 * under the mug's left wall. Its own outline all round, over the jaw.
 */
const ARM_L_MUG_HALF: Part = {
  map: [
    '.LLLL.', // 0  the fist's top
    '.LSSSL', // 1  the fist; the mug's wall covers col 5
    '.LSssL', // 2
    '.LjjjL', // 3  the cuff
    'LjjjL.', // 4  the sleeve
    'LLLLL.', // 5  the underside on the shoulder line
  ],
  anchors: { shoulderL: { x: 2, y: 5 }, hand: { x: 4, y: 1 } },
}

/**
 * The mug, 5 x 4: a white body W three wide and two tall, its shade w at the bottom right, in an L outline (the rim on
 * row 0, the base on row 3). The hand (0, 2) is its left wall, where the fist holds it, so the handle is turned into
 * the hand: at this width a drawn handle left the body two whites wide, which read at 8x as a lens, not a cup. At the
 * mouth (frame (12, 14) standing, (12, 20) seated) the body covers the mouth slot; under the chin it sits a column left
 * and three rows lower, clear of it.
 */
const MUG: Part = {
  map: [
    'LLLLL', // 0  the rim
    'LWWWL', // 1
    'LWWwL', // 2  the hand at the left wall
    'LLLLL', // 3  the base
  ],
  anchors: { hand: { x: 0, y: 2 } },
}

/**
 * The near (left) arm out to the side at shoulder height, 8 x 5 (shoulderL (7, 1), seated top-left (2, 28)): the
 * sleeve j three rows tall (rows 1-3, frame rows 29-31) runs out level from the shoulder cap to the fist S/s at its end
 * (cols 1-2, frame cols 3-4), lit from the top left; the top outline (row 0) ends at col 5, on the torso's own
 * shoulder outline (frame (7, 28)), which the shoulder rises from, and the underside closes it on row 4. The hand
 * (1, 2) is the fist.
 */
const ARM_L_OUT: Part = {
  map: [
    '.LLLLL..', // 0  the arm's top, up to the torso's shoulder
    'LSSjjjjj', // 1  the fist; the sleeve level to the shoulder cap
    'LSsjjjjj', // 2
    'Lssjjjjj', // 3
    '.LLLLLLL', // 4  the underside
  ],
  anchors: { shoulderL: { x: 7, y: 1 }, hand: { x: 1, y: 2 } },
}

/**
 * The far (right) arm out to the side, ARM_L_OUT's mirror, 8 x 5 (shoulderR (0, 1), seated top-left (22, 28)), its
 * fist lit from the left too (the shade on the right and underneath). Drawn behind the torso, which covers its first
 * three columns on the shoulder rows (frame rows 28-29); its top outline starts where the torso's shoulder outline ends
 * (frame (24, 28)).
 */
const ARM_R_OUT: Part = {
  map: [
    '..LLLLL.', // 0  the arm's top, from the torso's shoulder
    'jjjjjSSL', // 1  the sleeve level from the shoulder cap; the fist
    'jjjjjSsL', // 2
    'jjjjjssL', // 3
    'LLLLLLL.', // 4  the underside
  ],
  anchors: { shoulderR: { x: 0, y: 1 }, hand: { x: 6, y: 2 } },
}

/**
 * The near (left) arm flung up and out beside the head, 8 x 10 (shoulderL (7, 9), seated top-left (2, 20)), after
 * 0.10's MANGAKA_STRETCH at 1.5x: the sleeve j rises from the shoulder (its underside an L row over the cap, row 9) a
 * column out every row up to row 3 along the jaw's outline, and the fist S/s beside the jaw on rows 1-2 (frame cols
 * 3-5, rows 21-22), its top on row 0, its right edge over the head's outline. The hand (1, 0) is the fist's
 * top, frame (3, 20), left of the head's col 0 (frame col 4). Drawn after the head, it closes its own outline against
 * the ear and the jaw.
 */
const ARM_L_UP: Part = {
  map: [
    '.LLL....', // 0  the fist's top
    'LSSsL...', // 1  the fist beside the jaw
    'LSssL...', // 2
    'LjjjL...', // 3  the cuff
    '.LjjjL..', // 4  the sleeve, down along the jaw to the shoulder
    '..LjjjL.', // 5
    '...LjjjL', // 6
    '....Ljjj', // 7  into the shoulder
    '....Ljjj', // 8
    '....LLLL', // 9  the raised sleeve's underside over the shoulder cap
  ],
  anchors: { shoulderL: { x: 7, y: 9 }, hand: { x: 1, y: 0 } },
}

/**
 * The far (right) arm flung up and out beside the head, ARM_L_UP's mirror, 8 x 10 (shoulderR (0, 9), seated top-left
 * (22, 20)), its fist lit from the left too. Drawn behind the head and the torso: the fist shows beside the jaw (frame
 * cols 26-29, the hand (6, 0) at frame col 28, right of the head's col 23 at frame col 27) and the sleeve outside the
 * jaw and the shoulder; the assembler closes the far shoulder cap's underside (frame row 29), which the torso draws
 * over the arm's own.
 */
const ARM_R_UP: Part = {
  map: [
    '....LLL.', // 0  the fist's top
    '...LSSsL', // 1  the fist beside the jaw
    '...LSssL', // 2
    '...LjjjL', // 3  the cuff
    '..LjjjL.', // 4  the sleeve, down along the jaw to the shoulder
    '.LjjjL..', // 5
    'LjjjL...', // 6
    'jjjL....', // 7  into the shoulder
    'jjjL....', // 8
    'LLLL....', // 9  the underside
  ],
  anchors: { shoulderR: { x: 0, y: 9 }, hand: { x: 6, y: 0 } },
}

/**
 * The near (left) arm reaching for the page by the body, 6 x 11 (shoulderL (2, 0), seated top-left (7, 29)): the
 * sleeve j hangs from the shoulder cap (rows 0-5, a column in from the resting arm's, the arm turning in), the forearm
 * comes forward a column wider (row 6), and the fist S/s on rows 7-9 (frame cols 8-10, rows 36-38) grips the page at
 * its foot; the page, drawn over it at frame (9, 36), leaves the fist's left column showing at its left edge. The hand
 * (4, 10) is the outline under the fist, frame (11, 39), the page's foot.
 */
const ARM_L_FLIP_A: Part = {
  map: [
    'LjjjL.', // 0  under the shoulder cap
    'LjjjL.', // 1
    'LjjjL.', // 2
    'LjjjL.', // 3
    'LjjjL.', // 4
    'LjjjL.', // 5
    'LjjjjL', // 6  the forearm, coming forward
    'LSSSjL', // 7  the fist at the page's foot (the page covers cols 2-5)
    'LSSssL', // 8
    'LSsssL', // 9
    '.LLLLL', // 10 the desk top's line under it
  ],
  anchors: { shoulderL: { x: 2, y: 0 }, hand: { x: 4, y: 10 } },
}

/**
 * The near (left) arm lifting the page, 7 x 9 (shoulderL (5, 0), seated top-left (4, 29)): the sleeve hangs from the
 * shoulder cap (rows 0-2), then the arm comes down and out to the left a column every two rows (rows 3-5) to the fist
 * S/s on rows 6-7 (frame cols 5-7, rows 35-36), which holds the page up by its foot: the page, drawn over it at frame
 * (4, 32), rises above the fist in front of the sleeve. The hand (2, 6) is the fist, frame (6, 35).
 */
const ARM_L_FLIP_B: Part = {
  map: [
    '..LjjjL', // 0  under the shoulder cap
    '..LjjjL', // 1
    '..LjjjL', // 2
    '.LjjjL.', // 3  down and out to the left
    '.LjjjL.', // 4
    'LjjjL..', // 5
    'LSSsL..', // 6  the fist under the page
    'LSssL..', // 7
    '.LLL...', // 8
  ],
  anchors: { shoulderL: { x: 5, y: 0 }, hand: { x: 2, y: 6 } },
}

/**
 * The near (left) arm laying the page down on the left, 9 x 10 (shoulderL (8, 0), seated top-left (1, 29)): the
 * sleeve leaves the shoulder cap (rows 0-1) and reaches down and out to the left a column a row (rows 2-4), the
 * forearm down to the fist S/s on rows 7-8 (frame cols 3-6, rows 36-37), its knuckles showing at the right edge of the
 * page, which lies over it at frame (0, 35). The hand (1, 9) is the outline under the fist, frame (2, 38), the page's
 * foot.
 */
const ARM_L_FLIP_C: Part = {
  map: [
    '.....Ljjj', // 0  under the shoulder cap
    '.....Ljjj', // 1
    '....LjjjL', // 2  down and out to the left
    '...LjjjL.', // 3
    '..LjjjL..', // 4
    '..LjjjL..', // 5
    '..LjjjL..', // 6
    '.LSSSsL..', // 7  the fist; the page covers cols 0-3
    '.LSSssL..', // 8
    '.LLLLLL..', // 9
  ],
  anchors: { shoulderL: { x: 8, y: 0 }, hand: { x: 1, y: 9 } },
}

/**
 * The page the hand flips, 5 x 4: a sheet W three wide, a short ruled line w on its lower row (the paper's lines, as
 * the manuscript's), in an L outline. The hand (2, 3) is the middle of its foot, so it rises above the hand: by the
 * body at frame (9, 36), lifted at (4, 32), laid down on the left at (0, 35), over the page stack in the scene.
 */
const PAGE: Part = {
  map: [
    'LLLLL', // 0
    'LWWWL', // 1
    'LwwWL', // 2  the line
    'LLLLL', // 3  the hand at col 2
  ],
  anchors: { hand: { x: 2, y: 3 } },
}

/**
 * The near (left) arm rubbing the left eye, 6 x 14 (shoulderL (2, 13), seated top-left (7, 16)): the fist S/s four
 * wide on rows 1-2 over the left eye (frame cols 8-11, rows 17-18), its top on row 0; the forearm j straight up from
 * the elbow in front of the cheek (rows 3-7, a column in from the upper arm's rows 8-12), the underside an L row over
 * the shoulder cap (row 13). The hand (3, 1) is the fist, frame (10, 17), in the eye slot's left half; the squinting
 * right eye and the mouth stay clear. Drawn after the head, it closes its own outline against the face.
 */
const ARM_L_RUB_A: Part = {
  map: [
    '.LLLL.', // 0  the fist's top
    'LSSSsL', // 1  the fist over the left eye
    'LSSssL', // 2
    '.LjjjL', // 3  the forearm, up in front of the cheek
    '.LjjjL', // 4
    '.LjjjL', // 5
    '.LjjjL', // 6
    '.LjjjL', // 7
    'LjjjL.', // 8  the upper arm, from the elbow down to the shoulder
    'LjjjL.', // 9
    'LjjjL.', // 10
    'LjjjL.', // 11
    'LjjjL.', // 12
    'LLLLL.', // 13 the raised sleeve's underside over the shoulder cap
  ],
  anchors: { shoulderL: { x: 2, y: 13 }, hand: { x: 3, y: 1 } },
}

/**
 * The rub's other step, ARM_L_RUB_A with the fist a row lower, 6 x 13 (shoulderL (2, 12), hand (3, 1), frame
 * (10, 18)): the forearm a row shorter.
 */
const ARM_L_RUB_B: Part = {
  map: [
    '.LLLL.', // 0  the fist's top
    'LSSSsL', // 1  the fist, a row lower
    'LSSssL', // 2
    '.LjjjL', // 3  the forearm
    '.LjjjL', // 4
    '.LjjjL', // 5
    '.LjjjL', // 6
    'LjjjL.', // 7  the upper arm
    'LjjjL.', // 8
    'LjjjL.', // 9
    'LjjjL.', // 10
    'LjjjL.', // 11
    'LLLLL.', // 12 the underside
  ],
  anchors: { shoulderL: { x: 2, y: 12 }, hand: { x: 3, y: 1 } },
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
  'leg-l-seat': LEG_L_SEAT, 'leg-r-seat': LEG_R_SEAT, 'leg-l-half': LEG_L_HALF, 'leg-r-half': LEG_R_HALF,
  'arm-l-desk-a': ARM_L_DESK_A, 'arm-l-desk-b': ARM_L_DESK_B, 'arm-l-desk-c': ARM_L_DESK_C, 'arm-l-rest': ARM_L_REST,
  'arm-r-desk': ARM_R_DESK, pen: PEN,
  'arm-l-hold': ARM_L_HOLD, manuscript: MANUSCRIPT,
  'arm-l-mug': ARM_L_MUG, 'arm-l-mug-half': ARM_L_MUG_HALF, mug: MUG,
  'arm-l-out': ARM_L_OUT, 'arm-r-out': ARM_R_OUT, 'arm-l-up': ARM_L_UP, 'arm-r-up': ARM_R_UP,
  'arm-l-flip-a': ARM_L_FLIP_A, 'arm-l-flip-b': ARM_L_FLIP_B, 'arm-l-flip-c': ARM_L_FLIP_C, page: PAGE,
  'arm-l-rub-a': ARM_L_RUB_A, 'arm-l-rub-b': ARM_L_RUB_B,
}
