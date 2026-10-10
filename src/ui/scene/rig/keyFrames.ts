// The rig's key frames (0.11.0): the poses the parts cannot make, each hand-drawn whole with its face baked in (no
// mood), in PAL keys (uppercase the base, lowercase its shade, L the outline, the light from the top left), drawn in
// the outfit's palette. Each starts from the nearest assembled pose's map (the rig head, `rig/head.ts`, with the face
// it shows). Pure data; no DOM, so scripts/ can load the rig.
import type { SpriteMap } from './types'

/**
 * Asleep in bed, 48 wide x 32 tall, drawn at the bed frame (`MANGAKA_BED_FRAME`, canvas (201, 90); the actor's bed spot
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

/**
 * The panic, seated (32 x 48, at the actor, as `seat.rest`; after 0.10's `MANGAKA_PANIC`): the rig head at (4, 6) with
 * the ringed eyes (`FACE_ART.eyes.ring`) and the mouth open (`MOUTHS.open`); both hands clamped on the hair's top
 * corners (the left hand spread over cols 6-12, rows 4-8, the right mirrored at cols 19-25), the forearms out and down to the
 * elbows beside the head (cols 0-4 and 27-31 from row 9), the sleeves down the head's sides and in to the shoulder caps
 * (rows 22-29); the torso alone under them (its caps closed on row 29), the seated legs behind the desk (rows 41-47).
 */
export const PANIC_0: SpriteMap = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '.......LLLLL........LLLLL.......', // 4
  '......LSSSSSL......LSSSSSL......', // 5
  '....LLLSSSSSsLLLLLLSSSSSsLLL....', // 6
  '...LjjLSSSSsLHHHHHHLSSSSsLjjL...', // 7
  '..LjjjLLLLLLHHHHHHHHLLLLLLjjjL..', // 8
  '.LjjjLLHHHHHHHHHHHHHHHHhhLLjjjL.', // 9
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 10
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 11
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 12
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 13
  'LjjjLHHHHHHHSHHHHHHSHHHHHhhLjjjL', // 14
  'LjjjLHHHHHHSSHHHHHSSHHHHHhhLjjjL', // 15
  'LjjjLLHHSSWWSSSSSSSSWWSShhLLjjjL', // 16
  'LjjjLSHHSWEEWSSSSSSWEEWShhsLjjjL', // 17
  'LjjjLSHHSWEEWSSSSSSWEEWShhsLjjjL', // 18
  'LjjjLSLSSSWWSSSSSSSSWWSSSLsLjjjL', // 19
  'LjjjLSLSBBBSSSSSSSSSSBBBSLsLjjjL', // 20
  'LjjjLLSSSSSSSSLLLLSSSSSSSsLLjjjL', // 21
  '.LjjjLLSSSSSSSLMMLSSSSSSsLLjjjL.', // 22
  '..LjjjLSSSSSSSSSSSSSSSSSsLjjjL..', // 23
  '...LjjjLSSSSSSSSSSSSSSSsLjjjL...', // 24
  '....LjjjLLSSSSSSSSSSSsLLjjjL....', // 25
  '.....LjjjLLLssssssssLLLjjjL.....', // 26
  '......LjjjKKLLLLLLLLKKjjjL......', // 27
  '......LjjjjKKKssssKKKjjjjL......', // 28
  '......LLLLLjKKRRRRKKjLLLLL......', // 29
  '..........LJjKKRYKKjjL..........', // 30
  '..........LJJJJJYJJJjL..........', // 31
  '..........LJJJJJYJJJjL..........', // 32
  '..........LJJJJJYJJJjL..........', // 33
  '..........LJJJJJYJJJjL..........', // 34
  '..........LJJJJJYJJJjL..........', // 35
  '..........LJJJJJYJJJjL..........', // 36
  '..........LJJJJJYJJJjL..........', // 37
  '..........LJJJJJYJJJjL..........', // 38
  '..........LjjjjjjjjjjL..........', // 39
  '..........LLLLLLLLLLLL..........', // 40
  '..........LFFFFLLFFffL..........', // 41
  '..........LFFFfLLFFffL..........', // 42
  '...........LLffLLffLL...........', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/** The panic's second beat: `PANIC_0` with the hands pressed a row lower on the hair (the forearms a row lower too). */
export const PANIC_1: SpriteMap = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '................................', // 4
  '.......LLLLL........LLLLL.......', // 5
  '......LSSSSSLLLLLLLLSSSSSL......', // 6
  '....LLLSSSSSsLHHHHLSSSSSsLLL....', // 7
  '...LjjLSSSSsLHHHHHHLSSSSsLjjL...', // 8
  '..LjjjLLLLLLHHHHHHHHLLLLLLjjjL..', // 9
  '.LjjjLHHHHHHHHHHHHHHHHHHhhLjjjL.', // 10
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 11
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 12
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 13
  'LjjjLHHHHHHHSHHHHHHSHHHHHhhLjjjL', // 14
  'LjjjLHHHHHHSSHHHHHSSHHHHHhhLjjjL', // 15
  'LjjjLLHHSSWWSSSSSSSSWWSShhLLjjjL', // 16
  'LjjjLSHHSWEEWSSSSSSWEEWShhsLjjjL', // 17
  'LjjjLSHHSWEEWSSSSSSWEEWShhsLjjjL', // 18
  'LjjjLSLSSSWWSSSSSSSSWWSSSLsLjjjL', // 19
  'LjjjLSLSBBBSSSSSSSSSSBBBSLsLjjjL', // 20
  'LjjjLLSSSSSSSSLLLLSSSSSSSsLLjjjL', // 21
  '.LjjjLLSSSSSSSLMMLSSSSSSsLLjjjL.', // 22
  '..LjjjLSSSSSSSSSSSSSSSSSsLjjjL..', // 23
  '...LjjjLSSSSSSSSSSSSSSSsLjjjL...', // 24
  '....LjjjLLSSSSSSSSSSSsLLjjjL....', // 25
  '.....LjjjLLLssssssssLLLjjjL.....', // 26
  '......LjjjKKLLLLLLLLKKjjjL......', // 27
  '......LjjjjKKKssssKKKjjjjL......', // 28
  '......LLLLLjKKRRRRKKjLLLLL......', // 29
  '..........LJjKKRYKKjjL..........', // 30
  '..........LJJJJJYJJJjL..........', // 31
  '..........LJJJJJYJJJjL..........', // 32
  '..........LJJJJJYJJJjL..........', // 33
  '..........LJJJJJYJJJjL..........', // 34
  '..........LJJJJJYJJJjL..........', // 35
  '..........LJJJJJYJJJjL..........', // 36
  '..........LJJJJJYJJJjL..........', // 37
  '..........LJJJJJYJJJjL..........', // 38
  '..........LjjjjjjjjjjL..........', // 39
  '..........LLLLLLLLLLLL..........', // 40
  '..........LFFFFLLFFffL..........', // 41
  '..........LFFFfLLFFffL..........', // 42
  '...........LLffLLffLL...........', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/**
 * The cheer standing (32 x 48, at the actor): a crouch so the hands can go up: the head a crown lower than standing
 * (at (4, 5), the crown's outline on row 5), the torso a row under it (at (7, 26)), the knees bent (the seated legs'
 * shape, rows 40-47, the shoes on row 47); both arms straight up beside the head, banzai, the fists closed over them
 * (rows 1-4, cols 0-4 and 27-31, the cuffs on row 5). Face happy (`happy` eyes, the smile).
 */
export const CHEER_STAND_0: SpriteMap = [
  '................................', // 0
  '.LLL........................LLL.', // 1
  'LSSsL......................LSSsL', // 2
  'LSSsL......................LSSsL', // 3
  'LSssL......................LSssL', // 4
  'LLLLL......LLLLLLLLLL......LLLLL', // 5
  'LjjjL....LLHHHHHHHHHHLL....LjjjL', // 6
  'LjjjL..LLHHHHHHHHHHHHhhLL..LjjjL', // 7
  'LjjjL.LHHHHHHHHHHHHHHHHhhL.LjjjL', // 8
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 9
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 10
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 11
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 12
  'LjjjLHHHHHHHSHHHHHHSHHHHHhhLjjjL', // 13
  'LjjjLHHHHHHSSHHHHHSSHHHHHhhLjjjL', // 14
  'LjjjLLHHSSSSSSSSSSSSSSSShhLLjjjL', // 15
  'LjjjLSHHSSLLSSSSSSSSLLSShhsLjjjL', // 16
  'LjjjLSHHSLSSLSSSSSSLSSLShhsLjjjL', // 17
  'LjjjLSLSSSSSSSSSSSSSSSSSSLsLjjjL', // 18
  'LjjjLSLSBBBSSSSSSSSSSBBBSLsLjjjL', // 19
  'LjjjLLSSSSSSSSLSSLSSSSSSSsLLjjjL', // 20
  '.LjjjLLSSSSSSSSLLSSSSSSSsLLjjjL.', // 21
  '..LjjjLSSSSSSSSSSSSSSSSSsLjjjL..', // 22
  '...LjjjLSSSSSSSSSSSSSSSsLjjjL...', // 23
  '....LjjjLLSSSSSSSSSSSsLLjjjL....', // 24
  '.....LjjjLLLssssssssLLLjjjL.....', // 25
  '......LjjjKKLLLLLLLLKKjjjL......', // 26
  '......LjjjjKKKssssKKKjjjjL......', // 27
  '......LLLLLjKKRRRRKKjLLLLL......', // 28
  '..........LJjKKRYKKjjL..........', // 29
  '..........LJJJJJYJJJjL..........', // 30
  '..........LJJJJJYJJJjL..........', // 31
  '..........LJJJJJYJJJjL..........', // 32
  '..........LJJJJJYJJJjL..........', // 33
  '..........LJJJJJYJJJjL..........', // 34
  '..........LJJJJJYJJJjL..........', // 35
  '..........LJJJJJYJJJjL..........', // 36
  '..........LJJJJJYJJJjL..........', // 37
  '..........LjjjjjjjjjjL..........', // 38
  '..........LLLLLLLLLLLL..........', // 39
  '..........LFFFFLLFFffL..........', // 40
  '..........LFFFfLLFFffL..........', // 41
  '...........LLffLLffLL...........', // 42
  '............LffLLffL............', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/**
 * The cheer's spring: up a row out of the crouch (the head at (4, 4), the torso at (7, 25), the thighs a row longer),
 * the hands open a row higher (rows 0-4: two fingers parted by an L, the thumb out towards the head), the mouth open.
 */
export const CHEER_STAND_1: SpriteMap = [
  'LLLLL......................LLLLL', // 0
  'LSLSL......................LSLSL', // 1
  'LSLSLL....................LLSLSL', // 2
  'LSSSSL....................LSSSSL', // 3
  'LSSsLL.....LLLLLLLLLL.....LLSSsL', // 4
  'LLLLL....LLHHHHHHHHHHLL....LLLLL', // 5
  'LjjjL..LLHHHHHHHHHHHHhhLL..LjjjL', // 6
  'LjjjL.LHHHHHHHHHHHHHHHHhhL.LjjjL', // 7
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 8
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 9
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 10
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 11
  'LjjjLHHHHHHHSHHHHHHSHHHHHhhLjjjL', // 12
  'LjjjLHHHHHHSSHHHHHSSHHHHHhhLjjjL', // 13
  'LjjjLLHHSSSSSSSSSSSSSSSShhLLjjjL', // 14
  'LjjjLSHHSSLLSSSSSSSSLLSShhsLjjjL', // 15
  'LjjjLSHHSLSSLSSSSSSLSSLShhsLjjjL', // 16
  'LjjjLSLSSSSSSSSSSSSSSSSSSLsLjjjL', // 17
  'LjjjLSLSBBBSSSSSSSSSSBBBSLsLjjjL', // 18
  'LjjjLLSSSSSSSSLLLLSSSSSSSsLLjjjL', // 19
  '.LjjjLLSSSSSSSLMMLSSSSSSsLLjjjL.', // 20
  '..LjjjLSSSSSSSSSSSSSSSSSsLjjjL..', // 21
  '...LjjjLSSSSSSSSSSSSSSSsLjjjL...', // 22
  '....LjjjLLSSSSSSSSSSSsLLjjjL....', // 23
  '.....LjjjLLLssssssssLLLjjjL.....', // 24
  '......LjjjKKLLLLLLLLKKjjjL......', // 25
  '......LjjjjKKKssssKKKjjjjL......', // 26
  '......LLLLLjKKRRRRKKjLLLLL......', // 27
  '..........LJjKKRYKKjjL..........', // 28
  '..........LJJJJJYJJJjL..........', // 29
  '..........LJJJJJYJJJjL..........', // 30
  '..........LJJJJJYJJJjL..........', // 31
  '..........LJJJJJYJJJjL..........', // 32
  '..........LJJJJJYJJJjL..........', // 33
  '..........LJJJJJYJJJjL..........', // 34
  '..........LJJJJJYJJJjL..........', // 35
  '..........LJJJJJYJJJjL..........', // 36
  '..........LjjjjjjjjjjL..........', // 37
  '..........LLLLLLLLLLLL..........', // 38
  '..........LFFFFLLFFffL..........', // 39
  '..........LFFFFLLFFffL..........', // 40
  '..........LFFFfLLFFffL..........', // 41
  '...........LLffLLffLL...........', // 42
  '............LffLLffL............', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/**
 * The cheer seated (32 x 48, at the actor; also the assistants' good-poll reaction): the seated body (the head at
 * (4, 6) as `seat.rest`, the torso alone at (7, 27), its caps closed on row 29), both arms straight up beside the head
 * from the shoulder caps, the fists closed over them (rows 1-4); face happy. Everything but the legs reads above the
 * desk (row 40).
 */
export const CHEER_SEAT_0: SpriteMap = [
  '................................', // 0
  '.LLL........................LLL.', // 1
  'LSSsL......................LSSsL', // 2
  'LSSsL......................LSSsL', // 3
  'LSssL......................LSssL', // 4
  'LLLLL......................LLLLL', // 5
  'LjjjL......LLLLLLLLLL......LjjjL', // 6
  'LjjjL....LLHHHHHHHHHHLL....LjjjL', // 7
  'LjjjL..LLHHHHHHHHHHHHhhLL..LjjjL', // 8
  'LjjjL.LHHHHHHHHHHHHHHHHhhL.LjjjL', // 9
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 10
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 11
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 12
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 13
  'LjjjLHHHHHHHSHHHHHHSHHHHHhhLjjjL', // 14
  'LjjjLHHHHHHSSHHHHHSSHHHHHhhLjjjL', // 15
  'LjjjLLHHSSSSSSSSSSSSSSSShhLLjjjL', // 16
  'LjjjLSHHSSLLSSSSSSSSLLSShhsLjjjL', // 17
  'LjjjLSHHSLSSLSSSSSSLSSLShhsLjjjL', // 18
  'LjjjLSLSSSSSSSSSSSSSSSSSSLsLjjjL', // 19
  'LjjjLSLSBBBSSSSSSSSSSBBBSLsLjjjL', // 20
  'LjjjLLSSSSSSSSLSSLSSSSSSSsLLjjjL', // 21
  '.LjjjLLSSSSSSSSLLSSSSSSSsLLjjjL.', // 22
  '..LjjjLSSSSSSSSSSSSSSSSSsLjjjL..', // 23
  '...LjjjLSSSSSSSSSSSSSSSsLjjjL...', // 24
  '....LjjjLLSSSSSSSSSSSsLLjjjL....', // 25
  '.....LjjjLLLssssssssLLLjjjL.....', // 26
  '......LjjjKKLLLLLLLLKKjjjL......', // 27
  '......LjjjjKKKssssKKKjjjjL......', // 28
  '......LLLLLjKKRRRRKKjLLLLL......', // 29
  '..........LJjKKRYKKjjL..........', // 30
  '..........LJJJJJYJJJjL..........', // 31
  '..........LJJJJJYJJJjL..........', // 32
  '..........LJJJJJYJJJjL..........', // 33
  '..........LJJJJJYJJJjL..........', // 34
  '..........LJJJJJYJJJjL..........', // 35
  '..........LJJJJJYJJJjL..........', // 36
  '..........LJJJJJYJJJjL..........', // 37
  '..........LJJJJJYJJJjL..........', // 38
  '..........LjjjjjjjjjjL..........', // 39
  '..........LLLLLLLLLLLL..........', // 40
  '..........LFFFFLLFFffL..........', // 41
  '..........LFFFfLLFFffL..........', // 42
  '...........LLffLLffLL...........', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/** The seated cheer's second beat: the hands open a row higher (rows 0-4), the mouth open. */
export const CHEER_SEAT_1: SpriteMap = [
  'LLLLL......................LLLLL', // 0
  'LSLSL......................LSLSL', // 1
  'LSLSLL....................LLSLSL', // 2
  'LSSSSL....................LSSSSL', // 3
  'LSSsLL....................LLSSsL', // 4
  'LLLLL......................LLLLL', // 5
  'LjjjL......LLLLLLLLLL......LjjjL', // 6
  'LjjjL....LLHHHHHHHHHHLL....LjjjL', // 7
  'LjjjL..LLHHHHHHHHHHHHhhLL..LjjjL', // 8
  'LjjjL.LHHHHHHHHHHHHHHHHhhL.LjjjL', // 9
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 10
  'LjjjLLHHHHHHHHHHHHHHHHHHhhLLjjjL', // 11
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 12
  'LjjjLHHHHHHHHHHHHHHHHHHHHhhLjjjL', // 13
  'LjjjLHHHHHHHSHHHHHHSHHHHHhhLjjjL', // 14
  'LjjjLHHHHHHSSHHHHHSSHHHHHhhLjjjL', // 15
  'LjjjLLHHSSSSSSSSSSSSSSSShhLLjjjL', // 16
  'LjjjLSHHSSLLSSSSSSSSLLSShhsLjjjL', // 17
  'LjjjLSHHSLSSLSSSSSSLSSLShhsLjjjL', // 18
  'LjjjLSLSSSSSSSSSSSSSSSSSSLsLjjjL', // 19
  'LjjjLSLSBBBSSSSSSSSSSBBBSLsLjjjL', // 20
  'LjjjLLSSSSSSSSLLLLSSSSSSSsLLjjjL', // 21
  '.LjjjLLSSSSSSSLMMLSSSSSSsLLjjjL.', // 22
  '..LjjjLSSSSSSSSSSSSSSSSSsLjjjL..', // 23
  '...LjjjLSSSSSSSSSSSSSSSsLjjjL...', // 24
  '....LjjjLLSSSSSSSSSSSsLLjjjL....', // 25
  '.....LjjjLLLssssssssLLLjjjL.....', // 26
  '......LjjjKKLLLLLLLLKKjjjL......', // 27
  '......LjjjjKKKssssKKKjjjjL......', // 28
  '......LLLLLjKKRRRRKKjLLLLL......', // 29
  '..........LJjKKRYKKjjL..........', // 30
  '..........LJJJJJYJJJjL..........', // 31
  '..........LJJJJJYJJJjL..........', // 32
  '..........LJJJJJYJJJjL..........', // 33
  '..........LJJJJJYJJJjL..........', // 34
  '..........LJJJJJYJJJjL..........', // 35
  '..........LJJJJJYJJJjL..........', // 36
  '..........LJJJJJYJJJjL..........', // 37
  '..........LJJJJJYJJJjL..........', // 38
  '..........LjjjjjjjjjjL..........', // 39
  '..........LLLLLLLLLLLL..........', // 40
  '..........LFFFFLLFFffL..........', // 41
  '..........LFFFfLLFFffL..........', // 42
  '...........LLffLLffLL...........', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/**
 * The slump standing (32 x 48, at the actor): `stand.idle`'s body with the head bowed into the shoulders (at (4, 4),
 * the crown's outline on row 4, the chin over the collar, the shoulders showing either side), the arms hanging; the
 * eyes closed (`FACE_ART.eyes.closed`, no E), the frown.
 */
export const SLUMP_STAND_0: SpriteMap = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '...........LLLLLLLLLL...........', // 4
  '.........LLHHHHHHHHHHLL.........', // 5
  '.......LLHHHHHHHHHHHHhhLL.......', // 6
  '......LHHHHHHHHHHHHHHHHhhL......', // 7
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 8
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 9
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 10
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 11
  '....LHHHHHHHSHHHHHHSHHHHHhhL....', // 12
  '....LHHHHHHSSHHHHHSSHHHHHhhL....', // 13
  '.....LHHSSSSSSSSSSSSSSSShhL.....', // 14
  '....LSHHSSSSSSSSSSSSSSSShhsL....', // 15
  '....LSHHSLSSLSSSSSSLSSLShhsL....', // 16
  '....LSLSSSLLSSSSSSSSLLSSSLsL....', // 17
  '....LSLSBBBSSSSSSSSSSBBBSLsL....', // 18
  '.....LSSSSSSSSSLLSSSSSSSSsL.....', // 19
  '......LSSSSSSSLSSLSSSSSSsL......', // 20
  '......LSSSSSSSSSSSSSSSSSsL......', // 21
  '.......LSSSSSSSSSSSSSSSsL.......', // 22
  '......LjLLSSSSSSSSSSSsLLjL......', // 23
  '......LjjjLLssssssssLLjjjL......', // 24
  '......LjjjLJLLLLLLLLjLjjjL......', // 25
  '......LjjjLJJJJJYJJJjLjjjL......', // 26
  '......LjjjLJJJJJYJJJjLjjjL......', // 27
  '......LjjjLJJJJJYJJJjLjjjL......', // 28
  '......LjjjLJJJJJYJJJjLjjjL......', // 29
  '......LjjjLJJJJJYJJJjLjjjL......', // 30
  '......LjjjLJJJJJYJJJjLjjjL......', // 31
  '......LSSsLJJJJJYJJJjLSSsL......', // 32
  '......LSssLjjjjjjjjjjLSssL......', // 33
  '.......LLLLLLLLLLLLLLLLLL.......', // 34
  '...........LFFfLLFffL...........', // 35
  '...........LFFfLLFffL...........', // 36
  '...........LFFfLLFffL...........', // 37
  '...........LFFfLLFffL...........', // 38
  '...........LFFfLLFffL...........', // 39
  '...........LFFfLLFffL...........', // 40
  '...........LFFfLLFffL...........', // 41
  '...........LFFfLLFffL...........', // 42
  '...........LFFfLLFffL...........', // 43
  '...........LFffLLfffL...........', // 44
  '..........LOOOoLLOOOoL..........', // 45
  '..........LOOooLLOOooL..........', // 46
  '..........LLLLLLLLLLLL..........', // 47
]

/** The slump's sigh: `SLUMP_STAND_0` with the head a row lower (at (4, 5)). */
export const SLUMP_STAND_1: SpriteMap = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '................................', // 4
  '...........LLLLLLLLLL...........', // 5
  '.........LLHHHHHHHHHHLL.........', // 6
  '.......LLHHHHHHHHHHHHhhLL.......', // 7
  '......LHHHHHHHHHHHHHHHHhhL......', // 8
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 9
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 10
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 11
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 12
  '....LHHHHHHHSHHHHHHSHHHHHhhL....', // 13
  '....LHHHHHHSSHHHHHSSHHHHHhhL....', // 14
  '.....LHHSSSSSSSSSSSSSSSShhL.....', // 15
  '....LSHHSSSSSSSSSSSSSSSShhsL....', // 16
  '....LSHHSLSSLSSSSSSLSSLShhsL....', // 17
  '....LSLSSSLLSSSSSSSSLLSSSLsL....', // 18
  '....LSLSBBBSSSSSSSSSSBBBSLsL....', // 19
  '.....LSSSSSSSSSLLSSSSSSSSsL.....', // 20
  '......LSSSSSSSLSSLSSSSSSsL......', // 21
  '......LSSSSSSSSSSSSSSSSSsL......', // 22
  '......LLSSSSSSSSSSSSSSSsLL......', // 23
  '......LjLLSSSSSSSSSSSsLLjL......', // 24
  '......LjjjLLssssssssLLjjjL......', // 25
  '......LjjjLJLLLLLLLLjLjjjL......', // 26
  '......LjjjLJJJJJYJJJjLjjjL......', // 27
  '......LjjjLJJJJJYJJJjLjjjL......', // 28
  '......LjjjLJJJJJYJJJjLjjjL......', // 29
  '......LjjjLJJJJJYJJJjLjjjL......', // 30
  '......LjjjLJJJJJYJJJjLjjjL......', // 31
  '......LSSsLJJJJJYJJJjLSSsL......', // 32
  '......LSssLjjjjjjjjjjLSssL......', // 33
  '.......LLLLLLLLLLLLLLLLLL.......', // 34
  '...........LFFfLLFffL...........', // 35
  '...........LFFfLLFffL...........', // 36
  '...........LFFfLLFffL...........', // 37
  '...........LFFfLLFffL...........', // 38
  '...........LFFfLLFffL...........', // 39
  '...........LFFfLLFffL...........', // 40
  '...........LFFfLLFffL...........', // 41
  '...........LFFfLLFffL...........', // 42
  '...........LFFfLLFffL...........', // 43
  '...........LFffLLfffL...........', // 44
  '..........LOOOoLLOOOoL..........', // 45
  '..........LOOooLLOOooL..........', // 46
  '..........LLLLLLLLLLLL..........', // 47
]

/**
 * The slump seated (32 x 48, at the actor): the head down towards the desk (at (4, 9), the crown's outline on row 9,
 * three rows under `seat.rest`'s), over the shoulders; the arms limp at the sides (the standing arms hanging from the
 * seated shoulders, the hands on rows 38-39 behind the desk's edge); eyes closed, the frown.
 */
export const SLUMP_SEAT_0: SpriteMap = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '................................', // 4
  '................................', // 5
  '................................', // 6
  '................................', // 7
  '................................', // 8
  '...........LLLLLLLLLL...........', // 9
  '.........LLHHHHHHHHHHLL.........', // 10
  '.......LLHHHHHHHHHHHHhhLL.......', // 11
  '......LHHHHHHHHHHHHHHHHhhL......', // 12
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 13
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 14
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 15
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 16
  '....LHHHHHHHSHHHHHHSHHHHHhhL....', // 17
  '....LHHHHHHSSHHHHHSSHHHHHhhL....', // 18
  '.....LHHSSSSSSSSSSSSSSSShhL.....', // 19
  '....LSHHSSSSSSSSSSSSSSSShhsL....', // 20
  '....LSHHSLSSLSSSSSSLSSLShhsL....', // 21
  '....LSLSSSLLSSSSSSSSLLSSSLsL....', // 22
  '....LSLSBBBSSSSSSSSSSBBBSLsL....', // 23
  '.....LSSSSSSSSSLLSSSSSSSSsL.....', // 24
  '......LSSSSSSSLSSLSSSSSSsL......', // 25
  '......LSSSSSSSSSSSSSSSSSsL......', // 26
  '.......LSSSSSSSSSSSSSSSsL.......', // 27
  '.......LLLSSSSSSSSSSSsLLL.......', // 28
  '......LjjjLLssssssssLLjjjL......', // 29
  '......LjjjLJLLLLLLLLjLjjjL......', // 30
  '......LjjjLJJJJJYJJJjLjjjL......', // 31
  '......LjjjLJJJJJYJJJjLjjjL......', // 32
  '......LjjjLJJJJJYJJJjLjjjL......', // 33
  '......LjjjLJJJJJYJJJjLjjjL......', // 34
  '......LjjjLJJJJJYJJJjLjjjL......', // 35
  '......LjjjLJJJJJYJJJjLjjjL......', // 36
  '......LjjjLJJJJJYJJJjLjjjL......', // 37
  '......LSSsLJJJJJYJJJjLSSsL......', // 38
  '......LSssLjjjjjjjjjjLSssL......', // 39
  '.......LLLLLLLLLLLLLLLLLL.......', // 40
  '..........LFFFFLLFFffL..........', // 41
  '..........LFFFfLLFFffL..........', // 42
  '...........LLffLLffLL...........', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/** The seated slump's sigh: `SLUMP_SEAT_0` with the head a row lower (at (4, 10)). */
export const SLUMP_SEAT_1: SpriteMap = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '................................', // 4
  '................................', // 5
  '................................', // 6
  '................................', // 7
  '................................', // 8
  '................................', // 9
  '...........LLLLLLLLLL...........', // 10
  '.........LLHHHHHHHHHHLL.........', // 11
  '.......LLHHHHHHHHHHHHhhLL.......', // 12
  '......LHHHHHHHHHHHHHHHHhhL......', // 13
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 14
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 15
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 16
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 17
  '....LHHHHHHHSHHHHHHSHHHHHhhL....', // 18
  '....LHHHHHHSSHHHHHSSHHHHHhhL....', // 19
  '.....LHHSSSSSSSSSSSSSSSShhL.....', // 20
  '....LSHHSSSSSSSSSSSSSSSShhsL....', // 21
  '....LSHHSLSSLSSSSSSLSSLShhsL....', // 22
  '....LSLSSSLLSSSSSSSSLLSSSLsL....', // 23
  '....LSLSBBBSSSSSSSSSSBBBSLsL....', // 24
  '.....LSSSSSSSSSLLSSSSSSSSsL.....', // 25
  '......LSSSSSSSLSSLSSSSSSsL......', // 26
  '......LSSSSSSSSSSSSSSSSSsL......', // 27
  '.......LSSSSSSSSSSSSSSSsL.......', // 28
  '......LjLLSSSSSSSSSSSsLLjL......', // 29
  '......LjjjLLssssssssLLjjjL......', // 30
  '......LjjjLJLLLLLLLLjLjjjL......', // 31
  '......LjjjLJJJJJYJJJjLjjjL......', // 32
  '......LjjjLJJJJJYJJJjLjjjL......', // 33
  '......LjjjLJJJJJYJJJjLjjjL......', // 34
  '......LjjjLJJJJJYJJJjLjjjL......', // 35
  '......LjjjLJJJJJYJJJjLjjjL......', // 36
  '......LjjjLJJJJJYJJJjLjjjL......', // 37
  '......LSSsLJJJJJYJJJjLSSsL......', // 38
  '......LSssLjjjjjjjjjjLSssL......', // 39
  '.......LLLLLLLLLLLLLLLLLL.......', // 40
  '..........LFFFFLLFFffL..........', // 41
  '..........LFFFfLLFFffL..........', // 42
  '...........LLffLLffLL...........', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/**
 * Tearing a page, seated (32 x 48, at the actor): the rig head at (4, 6) with open eyes and the frown; a page held up at
 * the chest in both hands (cols 9-22, rows 29-37: W with three ruled lines w, its shade down the right and along the
 * bottom), the sleeves down from the shoulders behind it, the hands over its sides (rows 32-35). Above the desk.
 */
export const TEAR_0: SpriteMap = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '................................', // 4
  '................................', // 5
  '...........LLLLLLLLLL...........', // 6
  '.........LLHHHHHHHHHHLL.........', // 7
  '.......LLHHHHHHHHHHHHhhLL.......', // 8
  '......LHHHHHHHHHHHHHHHHhhL......', // 9
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 10
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 11
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 12
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 13
  '....LHHHHHHHSHHHHHHSHHHHHhhL....', // 14
  '....LHHHHHHSSHHHHHSSHHHHHhhL....', // 15
  '.....LHHSSSEESSSSSSEESSShhL.....', // 16
  '....LSHHSSWEESSSSSSWEESShhsL....', // 17
  '....LSHHSSEEESSSSSSEEESShhsL....', // 18
  '....LSLSSSEEESSSSSSEEESSSLsL....', // 19
  '....LSLSBBBSSSSSSSSSSBBBSLsL....', // 20
  '.....LSSSSSSSSSLLSSSSSSSSsL.....', // 21
  '......LSSSSSSSLSSLSSSSSSsL......', // 22
  '......LSSSSSSSSSSSSSSSSSsL......', // 23
  '.......LSSSSSSSSSSSSSSSsL.......', // 24
  '........LLSSSSSSSSSSSsLL........', // 25
  '..........LLssssssssLL..........', // 26
  '........LLKKLLLLLLLLKKLL........', // 27
  '.......LjjjKKKssssKKKjjjL.......', // 28
  '......LjjLLLLLLLLLLLLLLjjL......', // 29
  '......LjjLWWWWWWWWWWWwLjjL......', // 30
  '......LjjLWwwwwwwwwWWwLjjL......', // 31
  '.......LSSSLWWWWWWWWLSSSL.......', // 32
  '.......LSSsLwwwwwwWWLSSsL.......', // 33
  '.......LSssLWWWWWWWWLSssL.......', // 34
  '........LLLwwwwwwwwwWLLL........', // 35
  '.........LwwwwwwwwwwwwL.........', // 36
  '.........LLLLLLLLLLLLLL.........', // 37
  '..........LJJJJJYJJJjL..........', // 38
  '..........LjjjjjjjjjjL..........', // 39
  '..........LLLLLLLLLLLL..........', // 40
  '..........LFFFFLLFFffL..........', // 41
  '..........LFFFfLLFFffL..........', // 42
  '...........LLffLLffLL...........', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/** The page creased: `TEAR_0` with the page's top notched at the middle (cols 15-16) and a fold w down from it. */
export const TEAR_1: SpriteMap = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '................................', // 4
  '................................', // 5
  '...........LLLLLLLLLL...........', // 6
  '.........LLHHHHHHHHHHLL.........', // 7
  '.......LLHHHHHHHHHHHHhhLL.......', // 8
  '......LHHHHHHHHHHHHHHHHhhL......', // 9
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 10
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 11
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 12
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 13
  '....LHHHHHHHSHHHHHHSHHHHHhhL....', // 14
  '....LHHHHHHSSHHHHHSSHHHHHhhL....', // 15
  '.....LHHSSSEESSSSSSEESSShhL.....', // 16
  '....LSHHSSWEESSSSSSWEESShhsL....', // 17
  '....LSHHSSEEESSSSSSEEESShhsL....', // 18
  '....LSLSSSEEESSSSSSEEESSSLsL....', // 19
  '....LSLSBBBSSSSSSSSSSBBBSLsL....', // 20
  '.....LSSSSSSSSSLLSSSSSSSSsL.....', // 21
  '......LSSSSSSSLSSLSSSSSSsL......', // 22
  '......LSSSSSSSSSSSSSSSSSsL......', // 23
  '.......LSSSSSSSSSSSSSSSsL.......', // 24
  '........LLSSSSSSSSSSSsLL........', // 25
  '..........LLssssssssLL..........', // 26
  '........LLKKLLLLLLLLKKLL........', // 27
  '.......LjjjKKKssssKKKjjjL.......', // 28
  '......LjjLLLLLLRRLLLLLLjjL......', // 29
  '......LjjLWWWWWLLWWWWwLjjL......', // 30
  '......LjjLWwwwwwwwwWWwLjjL......', // 31
  '.......LSSSLWWWwWWWWLSSSL.......', // 32
  '.......LSSsLwwwwwwWWLSSsL.......', // 33
  '.......LSssLWWWwWWWWLSssL.......', // 34
  '........LLLwwwwwwwwwWLLL........', // 35
  '.........LwwwwwwwwwwwwL.........', // 36
  '.........LLLLLLLLLLLLLL.........', // 37
  '..........LJJJJJYJJJjL..........', // 38
  '..........LjjjjjjjjjjL..........', // 39
  '..........LLLLLLLLLLLL..........', // 40
  '..........LFFFFLLFFffL..........', // 41
  '..........LFFFfLLFFffL..........', // 42
  '...........LLffLLffLL...........', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]

/**
 * The page torn: two halves pulled apart (cols 5-13, rows 30-38 and cols 18-26, rows 29-37, a row out of step), their
 * torn edges zigzagged, the shirt showing in the gap; the arms out from the shoulders, a hand over each half's outer edge.
 */
export const TEAR_2: SpriteMap = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '................................', // 4
  '................................', // 5
  '...........LLLLLLLLLL...........', // 6
  '.........LLHHHHHHHHHHLL.........', // 7
  '.......LLHHHHHHHHHHHHhhLL.......', // 8
  '......LHHHHHHHHHHHHHHHHhhL......', // 9
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 10
  '.....LHHHHHHHHHHHHHHHHHHhhL.....', // 11
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 12
  '....LHHHHHHHHHHHHHHHHHHHHhhL....', // 13
  '....LHHHHHHHSHHHHHHSHHHHHhhL....', // 14
  '....LHHHHHHSSHHHHHSSHHHHHhhL....', // 15
  '.....LHHSSSEESSSSSSEESSShhL.....', // 16
  '....LSHHSSWEESSSSSSWEESShhsL....', // 17
  '....LSHHSSEEESSSSSSEEESShhsL....', // 18
  '....LSLSSSEEESSSSSSEEESSSLsL....', // 19
  '....LSLSBBBSSSSSSSSSSBBBSLsL....', // 20
  '.....LSSSSSSSSSLLSSSSSSSSsL.....', // 21
  '......LSSSSSSSLSSLSSSSSSsL......', // 22
  '......LSSSSSSSSSSSSSSSSSsL......', // 23
  '.......LSSSSSSSSSSSSSSSsL.......', // 24
  '........LLSSSSSSSSSSSsLL........', // 25
  '..........LLssssssssLL..........', // 26
  '........LLKKLLLLLLLLKKLL........', // 27
  '.......LjjjKKKssssKKKjjjL.......', // 28
  '......LjjjLjKKRRRRKLLLLLLLL.....', // 29
  '.....LLLLLLLLKKRYKKLWWWWWWL.....', // 30
  '....LLWWWWWWLJJJYJLWWwwwwWLL....', // 31
  '...LSSSLwwwWWLJJYJJLWWWWLSSSL...', // 32
  '...LSSsLWWWWLJJJYJLWWwwwLSSsL...', // 33
  '...LSssLwwwWWLJJYJJLWWWWLSssL...', // 34
  '....LLLWWWWWLJJJYJLWWwwwwLLL....', // 35
  '.....LWwwwwWWLJJYJJLwwwwwwL.....', // 36
  '.....LwwwwwwLJJJYJJLLLLLLLL.....', // 37
  '.....LLLLLLLLJJJYJJJjL..........', // 38
  '..........LjjjjjjjjjjL..........', // 39
  '..........LLLLLLLLLLLL..........', // 40
  '..........LFFFFLLFFffL..........', // 41
  '..........LFFFfLLFFffL..........', // 42
  '...........LLffLLffLL...........', // 43
  '............LffLLffL............', // 44
  '...........LOOoLLOOoL...........', // 45
  '...........LOooLLOooL...........', // 46
  '...........LLLLLLLLLL...........', // 47
]
