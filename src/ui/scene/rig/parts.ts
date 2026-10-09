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

/** Every part a pose may name, by name. */
export const PARTS: PartLib = {
  head: HEAD, torso: TORSO, 'arm-l-hang': ARM_L_HANG, 'arm-r-hang': ARM_R_HANG,
  'leg-l-stand': LEG_L_STAND, 'leg-r-stand': LEG_R_STAND,
}
