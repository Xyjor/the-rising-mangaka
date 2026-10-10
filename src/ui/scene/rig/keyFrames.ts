// The rig's key frames (0.11.0): the poses the parts cannot make, each hand-drawn whole with its face baked in (no
// mood), in PAL keys (uppercase the base, lowercase its shade, L the outline, the light from the top left), drawn in
// the outfit's palette. Each starts from the nearest assembled pose's map (the rig head, `rig/head.ts`, with the face
// it shows). Pure data; no DOM, so scripts/ can load the rig.
import type { SpriteMap } from './types'

/**
 * Asleep in bed, 48 wide x 32 tall, drawn at the bed frame (`RIG_BED_FRAME`, canvas (201, 90); the actor's bed spot
 * is (220, 90), so the standing head lands on the lying one), after 0.10's `MANGAKA_LIE`:
 * the rig head lying on the pillow, upright and frontal, at cols 23-46, rows 8-29 (the crown's outline on row 8; canvas
 * x 224-247, y 98-119, over the pillow), the eyes closed (`FACE_ART.eyes.closed`, a downward curve), the mouth closed;
 * the shoulders lying to its left under the blanket at cols 3-26, rows 24-31: the top outline on row 24 (meeting the
 * jaw's outline), the hood's shade j over them on row 25, the hoodie J on rows 26-29 and its underside j on row 30,
 * the outline on row 31, the left end's corners round (col 3 clear on rows 24 and 31); the collar K at their end
 * under the jaw (col 25, rows 27-29: the hoodie's own grey in the hoodie, a white collar in the cardigan and the
 * blazer). Render's blanket (canvas x 196-224, y 112-121: frame cols -5..23, rows 22-31) covers them but for that end
 * by the chin (cols 24-26), and render's Zs rise from (36, 2), clear of the head; rows 0-7, and cols 0-22 down to row
 * 23, stay clear.
 */
export const BED_LIE_0: SpriteMap = [
  '................................................', // 0
  '................................................', // 1
  '................................................', // 2
  '................................................', // 3
  '................................................', // 4
  '................................................', // 5
  '................................................', // 6
  '................................................', // 7
  '..............................LLLLLLLLLL........', // 8  the crown's outline
  '............................LLHHHHHHHHHHLL......', // 9
  '..........................LLHHHHHHHHHHHHhhLL....', // 10
  '.........................LHHHHHHHHHHHHHHHHhhL...', // 11
  '........................LHHHHHHHHHHHHHHHHHHhhL..', // 12
  '........................LHHHHHHHHHHHHHHHHHHhhL..', // 13
  '.......................LHHHHHHHHHHHHHHHHHHHHhhL.', // 14 the hair at its widest
  '.......................LHHHHHHHHHHHHHHHHHHHHhhL.', // 15
  '.......................LHHHHHHHSHHHHHHSHHHHHhhL.', // 16
  '.......................LHHHHHHSSHHHHHSSHHHHHhhL.', // 17
  '........................LHHSSSSSSSSSSSSSSSShhL..', // 18 the eye slot under the bangs
  '.......................LSHHSSSSSSSSSSSSSSSShhsL.', // 19
  '.......................LSHHSLSSLSSSSSSLSSLShhsL.', // 20 the eyes closed, a downward curve
  '.......................LSLSSSLLSSSSSSSSLLSSSLsL.', // 21
  '.......................LSLSBBBSSSSSSSSSSBBBSLsL.', // 22 the blush
  '........................LSSSSSSSSSSSSSSSSSSSsL..', // 23
  '....LLLLLLLLLLLLLLLLLLLLLLSSSSSSSSLLSSSSSSSsL...', // 24 the shoulders' top outline meets the jaw; the closed mouth
  '...LjjjjjjjjjjjjjjjjjjjjjLSSSSSSSSSSSSSSSSSsL...', // 25 the hood's shade over the shoulders
  '...LJJJJJJJJJJJJJJJJJJJJJJLSSSSSSSSSSSSSSSsL....', // 26
  '...LJJJJJJJJJJJJJJJJJJJJJKLLLSSSSSSSSSSSsLL.....', // 27 the collar under the jaw
  '...LJJJJJJJJJJJJJJJJJJJJJKL..LLssssssssLL.......', // 28
  '...LJJJJJJJJJJJJJJJJJJJJJKL....LLLLLLLL.........', // 29 the chin's outline
  '...LjjjjjjjjjjjjjjjjjjjjjjL.....................', // 30 the underside in shade
  '....LLLLLLLLLLLLLLLLLLLLLLL.....................', // 31
]

/**
 * The breath in bed: `BED_LIE_0` with the shoulders a row lower (their top outline on row 25, the hood's shade on row
 * 26, the hoodie J and the collar on rows 27-29, rows 30-31 as before), the head unchanged (rows 0-23 the same; row 24
 * the jaw alone, the closed mouth).
 */
export const BED_LIE_1: SpriteMap = [
  ...BED_LIE_0.slice(0, 24),
  '.........................LSSSSSSSSLLSSSSSSSsL...', // 24 the jaw alone; the closed mouth
  '....LLLLLLLLLLLLLLLLLLLLLLSSSSSSSSSSSSSSSSSsL...', // 25 the shoulders' top outline, a row lower
  '...LjjjjjjjjjjjjjjjjjjjjjjLSSSSSSSSSSSSSSSsL....', // 26 the hood's shade
  '...LJJJJJJJJJJJJJJJJJJJJJKLLLSSSSSSSSSSSsLL.....', // 27
  ...BED_LIE_0.slice(28),
]

/**
 * Sitting up in bed for the transitions (lying down, getting up), 48 x 32, drawn at the bed: the rig head upright at
 * cols 23-46, rows 0-21, the eyes open, the mouth closed; the standing torso under it (as `stand.idle`, 19 columns to
 * the right: the collar K beside the jaw, the shirt R in the V, the drawstring Y, the hoodie J with its shade j down
 * the right), the arms at its sides (the sleeves j, cols 25-29 and 40-44), shorter than standing by three rows, so the
 * fists S/s rest on rows 29-30 beside the hem j (row 30) and the outline closes the bust on row 31 (canvas y 121),
 * the lap under the bedding.
 */
export const BED_SIT: SpriteMap = [
  '..............................LLLLLLLLLL........', // 0  the crown's outline
  '............................LLHHHHHHHHHHLL......', // 1
  '..........................LLHHHHHHHHHHHHhhLL....', // 2
  '.........................LHHHHHHHHHHHHHHHHhhL...', // 3
  '........................LHHHHHHHHHHHHHHHHHHhhL..', // 4
  '........................LHHHHHHHHHHHHHHHHHHhhL..', // 5
  '.......................LHHHHHHHHHHHHHHHHHHHHhhL.', // 6  the hair at its widest
  '.......................LHHHHHHHHHHHHHHHHHHHHhhL.', // 7
  '.......................LHHHHHHHSHHHHHHSHHHHHhhL.', // 8
  '.......................LHHHHHHSSHHHHHSSHHHHHhhL.', // 9
  '........................LHHSSSEESSSSSSEESSShhL..', // 10 the eyes open
  '.......................LSHHSSWEESSSSSSWEESShhsL.', // 11
  '.......................LSHHSSEEESSSSSSEEESShhsL.', // 12
  '.......................LSLSSSEEESSSSSSEEESSSLsL.', // 13
  '.......................LSLSBBBSSSSSSSSSSBBBSLsL.', // 14 the blush
  '........................LSSSSSSSSSSSSSSSSSSSsL..', // 15
  '.........................LSSSSSSSSLLSSSSSSSsL...', // 16 the closed mouth
  '.........................LSSSSSSSSSSSSSSSSSsL...', // 17
  '..........................LSSSSSSSSSSSSSSSsL....', // 18
  '...........................LLSSSSSSSSSSSsLL.....', // 19
  '.............................LLssssssssLL.......', // 20
  '...........................LLKKLLLLLLLLKKLL.....', // 21 the chin over the neck, the collar beside it
  '..........................LjjjKKKssssKKKjjjL....', // 22
  '.........................LjjjLjKKRRRRKKjLjjjL...', // 23 the shoulder caps over the sleeves
  '.........................LjjjLJjKKRYKKjjLjjjL...', // 24
  '.........................LjjjLJJJJJYJJJjLjjjL...', // 25
  '.........................LjjjLJJJJJYJJJjLjjjL...', // 26
  '.........................LjjjLJJJJJYJJJjLjjjL...', // 27
  '.........................LjjjLJJJJJYJJJjLjjjL...', // 28
  '.........................LSSsLJJJJJYJJJjLSSsL...', // 29 the fists at the sides
  '.........................LSssLjjjjjjjjjjLSssL...', // 30 the hem
  '..........................LLLLLLLLLLLLLLLLLL....', // 31 the bust's outline, the lap under the bedding
]
