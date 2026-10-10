// The rig's head (0.11.0): the hand-drawn chibi head with its three face slots, every eyes, mouth and mark drawing,
// and the face each mood shows. Pure data in PAL keys (uppercase the base, lowercase its shade, L the outline, the
// light from the top left), after art/raw/sprites/mangaka-front.png; no DOM, so scripts/ can load it.
import { stampFace } from './assemble'
import type { Face, FaceArt, HeadPart, Mood, SpriteMap } from './types'

/**
 * The head, 27 wide x 22 tall: cols 0-23 the head, cols 24-26 the mark slot (clear on every row). Row 0 the crown's
 * outline; rows 1-9 the hair H, its shade h two columns down the right, puffing out to the full width on rows 6-9,
 * the bangs over the forehead to row 9 with a parting notch of skin over each eye (cols 7-8 and 14-15, rows 8-9);
 * side locks down the temples to row 12 (cols 2-3, and cols 20-21 in shade); the ears at cols 0-1 and 22-23 on rows
 * 11-14 under the hair's edge, each closed by its outline and parted from the cheek by an L on rows 13-14 (the right
 * one in shade s); the eye slot rows 10-13, cols 4-19 (the open eyes at cols 6-8 and 15-17, skin around them); blush B
 * on row 14 at cols 4-6 and 17-19; the mouth slot rows 15-16, cols 10-13 (the closed mouth); the cheeks S, their shade
 * s down the right, round in to the chin, its underside s on row 20; row 21 the chin's outline (cols 8-15), the neck
 * anchor (12, 21) on it. The slots hold the neutral face, so the bare head is neutral.
 */
export const HEAD: HeadPart = {
  map: [
    '.......LLLLLLLLLL..........', // 0  the crown's outline
    '.....LLHHHHHHHHHHLL........', // 1
    '...LLHHHHHHHHHHHHhhLL......', // 2
    '..LHHHHHHHHHHHHHHHHhhL.....', // 3
    '.LHHHHHHHHHHHHHHHHHHhhL....', // 4
    '.LHHHHHHHHHHHHHHHHHHhhL....', // 5
    'LHHHHHHHHHHHHHHHHHHHHhhL...', // 6  the hair at its widest
    'LHHHHHHHHHHHHHHHHHHHHhhL...', // 7
    'LHHHHHHHSHHHHHHSHHHHHhhL...', // 8  the partings' tips
    'LHHHHHHSSHHHHHSSHHHHHhhL...', // 9  the bangs' edge
    '.LHHSSSEESSSSSSEESSShhL....', // 10 the eye slot (cols 4-19) under the bangs; the side locks either side
    'LSHHSSWEESSSSSSWEESShhsL...', // 11 the ears from under the hair
    'LSHHSSEEESSSSSSEEESShhsL...', // 12
    'LSLSSSEEESSSSSSEEESSSLsL...', // 13 each ear parted from the cheek
    'LSLSBBBSSSSSSSSSSBBBSLsL...', // 14 the blush; the ears' last row
    '.LSSSSSSSSSSSSSSSSSSSsL....', // 15 the mouth slot (cols 10-13)
    '..LSSSSSSSSLLSSSSSSSsL.....', // 16 the closed mouth
    '..LSSSSSSSSSSSSSSSSSsL.....', // 17 the cheeks
    '...LSSSSSSSSSSSSSSSsL......', // 18
    '....LLSSSSSSSSSSSsLL.......', // 19
    '......LLssssssssLL.........', // 20 the chin's underside
    '........LLLLLLLL...........', // 21 the chin's outline, the neck anchor at col 12
  ],
  anchors: { neck: { x: 12, y: 21 } },
  slots: { eyes: { x: 4, y: 10, w: 16, h: 4 }, mouth: { x: 10, y: 15, w: 4, h: 2 }, mark: { x: 24, y: 0, w: 3, h: 5 } },
}

/**
 * The eyes, each 16 x 4 (the eye slot, head cols 4-19, rows 10-13), the left eye in slot cols 1-4 and the right in
 * 11-14 (head cols 5-8 and 15-18, where the editor's glasses will go), skin S around them:
 * - open: tall dark pupils E, 3 wide (head cols 6-8 and 15-17), the outer top corner round, a W highlight on the left
 *   of row 1 (the light from the top left), as the reference's eyes;
 * - blink: a one-row L line per eye on row 2, where the lids meet;
 * - closed: asleep, a downward curve (L, 4 wide, rows 2-3), low and relaxed;
 * - ring: surprised, the whites W round a 2 x 2 pupil E, 4 wide;
 * - squint: tired, a heavy lid L drooping to the outer corner over the lower half of the eye;
 * - happy: an upward curve ^ (L, 4 wide, rows 1-2).
 */
export const EYES: FaceArt['eyes'] = {
  open: [
    'SSSEESSSSSSEESSS',
    'SSWEESSSSSSWEESS',
    'SSEEESSSSSSEEESS',
    'SSEEESSSSSSEEESS',
  ],
  blink: [
    'SSSSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSSSS',
    'SSLLLSSSSSSLLLSS',
    'SSSSSSSSSSSSSSSS',
  ],
  closed: [
    'SSSSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSSSS',
    'SLSSLSSSSSSLSSLS',
    'SSLLSSSSSSSSLLSS',
  ],
  ring: [
    'SSWWSSSSSSSSWWSS',
    'SWEEWSSSSSSWEEWS',
    'SWEEWSSSSSSWEEWS',
    'SSWWSSSSSSSSWWSS',
  ],
  squint: [
    'SSSSSSSSSSSSSSSS',
    'SSSLLSSSSSSLLSSS',
    'SLLEESSSSSSEELLS',
    'SSEEESSSSSSEEESS',
  ],
  happy: [
    'SSSSSSSSSSSSSSSS',
    'SSLLSSSSSSSSLLSS',
    'SLSSLSSSSSSLSSLS',
    'SSSSSSSSSSSSSSSS',
  ],
}

/**
 * The mouths, each 4 x 2 (the mouth slot, head cols 10-13, rows 15-16), skin S around them: closed (a short L line on
 * row 16), open (an L top over the M inside, its corners L), smile (an upward curve), frown (a downward curve), o (a
 * small round L, surprised).
 */
export const MOUTHS: FaceArt['mouths'] = {
  closed: ['SSSS', 'SLLS'],
  open: ['LLLL', 'LMML'],
  smile: ['LSSL', 'SLLS'],
  frown: ['SLLS', 'LSSL'],
  o: ['SLLS', 'SLLS'],
}

/**
 * The marks, each 3 x 5 (the mark slot, cols 24-26, rows 0-4, beside the hair's top right), in mark keys, '.' clear:
 * a sweat drop A in its W highlight (tired), a sparkle X round a W centre (happy), '!' (surprised) and 'z' (sleepy).
 * Ported from 0.10's MARKS (R to A, Y to X).
 */
export const MARK_ART: FaceArt['marks'] = {
  sweat: ['.W.', 'WAW', 'WAW', '.W.', '...'],
  sparkle: ['.X.', 'XWX', '.X.', '...', '...'],
  bang: ['.L.', '.L.', '.L.', '...', '.L.'],
  zee: ['LLL', '..L', '.L.', 'L..', 'LLL'],
}

/** Every face drawing the head takes. */
export const FACE_ART: FaceArt = { eyes: EYES, mouths: MOUTHS, marks: MARK_ART }

/** The face the bare head shows: open eyes, the closed mouth, no mark. */
export const NEUTRAL_FACE: Face = { eyes: 'open', mouth: 'closed', mark: 'none' }

/** The face each mood shows (moodOf picks the mood; a pose may fix slots over it). */
export const FACE_BY_MOOD: Readonly<Record<Mood, Face>> = {
  neutral: NEUTRAL_FACE,
  happy: { eyes: 'happy', mouth: 'smile', mark: 'sparkle' },
  tired: { eyes: 'squint', mouth: 'frown', mark: 'sweat' },
  surprised: { eyes: 'ring', mouth: 'o', mark: 'bang' },
  sleepy: { eyes: 'closed', mouth: 'closed', mark: 'zee' },
}


/**
 * The editor's eyes (0.12.0), each 16 x 4 in face keys (the eye slot, head cols 4-19, rows 10-13): square glasses
 * round the mangaka's eyes. The lens rims L at slot cols 0, 6, 9 and 15 on every row (head cols 4, 10, 13 and 19; the
 * rims are the outline key, so the slot holds face keys only, decision 4 of the 0.12.0 plan), the bridge LL at slot
 * cols 7-8 on row 1 with skin above and below it; inside each 5-wide lens (slot cols 1-5 and 10-14) the mangaka's
 * drawing of the same id, cell for cell from EYES (the ring's whites and the closed eyes' curve touch the rims).
 */
export const EDITOR_EYES: FaceArt['eyes'] = {
  open: ['LSSEESLSSLSEESSL', 'LSWEESLLLLSWEESL', 'LSEEESLSSLSEEESL', 'LSEEESLSSLSEEESL'],
  blink: ['LSSSSSLSSLSSSSSL', 'LSSSSSLLLLSSSSSL', 'LSLLLSLSSLSLLLSL', 'LSSSSSLSSLSSSSSL'],
  closed: ['LSSSSSLSSLSSSSSL', 'LSSSSSLLLLSSSSSL', 'LLSSLSLSSLSLSSLL', 'LSLLSSLSSLSSLLSL'],
  ring: ['LSWWSSLSSLSSWWSL', 'LWEEWSLLLLSWEEWL', 'LWEEWSLSSLSWEEWL', 'LSWWSSLSSLSSWWSL'],
  squint: ['LSSSSSLSSLSSSSSL', 'LSSLLSLLLLSLLSSL', 'LLLEESLSSLSEELLL', 'LSEEESLSSLSEEESL'],
  happy: ['LSSSSSLSSLSSSSSL', 'LSLLSSLLLLSSLLSL', 'LLSSLSLSSLSLSSLL', 'LSSSSSLSSLSSSSSL'],
}

/**
 * The editor's head (0.12.0), 27 wide x 22 tall on HEAD's construction, slots and neck anchor (12, 21), after
 * art/raw/sprites/editor.png: cols 0-23 the head, cols 24-26 the mark slot (clear on every row). Row 0 the crown's
 * outline; rows 1-8 the hair H (its shade h two columns down the right), neat and parted: a parting of h at col 10
 * from row 2 to row 7, the hair swept either side of it (a strand of h off the parting each side, rows 3-6), its
 * edge straight across on row 8 (no bangs on the forehead); row 9 the forehead under the glasses' top edges (L at cols 4-10 and 13-19, skin between); the side locks
 * cols 2-3 on rows 10-12 (H; the right ones cols 20-21 in h); the ears as HEAD's on rows 11-14; the eye slot rows
 * 10-13, cols 4-19 (EDITOR_EYES.open: the lenses' sides and the bridge); row 14 the lenses' bottom edges (no blush);
 * the mouth slot rows 15-16, cols 10-13 (the closed mouth); rows 15-21 HEAD's cheeks and chin.
 */
export const EDITOR_HEAD: HeadPart = {
  map: [
    '.......LLLLLLLLLL..........', // 0  the crown's outline
    '.....LLHHHHHHHHHHLL........', // 1
    '...LLHHHHHhHHHHHHhhLL......', // 2  the parting (col 10) from here down
    '..LHHHHHHHhhHHHHHHHhhL.....', // 3  the hair swept off the parting, a strand each side
    '.LHHHHHHHhhHHhHHHHHHhhL....', // 4
    '.LHHHHHHhHhHHHhHHHHHhhL....', // 5
    'LHHHHHHhHHhHHHHhHHHHHhhL...', // 6
    'LHHHHHHHHHhHHHHHHHHHHhhL...', // 7  the parting's last row
    'LHHHHHHHHHHHHHHHHHHHHhhL...', // 8  the hair's edge, straight across
    'LHHHLLLLLLLSSLLLLLLLHhhL...', // 9  the glasses' top edges on the forehead
    '.LHHLSSEESLSSLSEESSLhhL....', // 10 the eye slot (cols 4-19): the lenses, the side locks either side
    'LSHHLSWEESLLLLSWEESLhhsL...', // 11 the bridge; the ears from under the hair
    'LSHHLSEEESLSSLSEEESLhhsL...', // 12
    'LSLSLSEEESLSSLSEEESLSLsL...', // 13 each ear parted from the cheek
    'LSLSLLLLLLLSSLLLLLLLSLsL...', // 14 the lenses' bottom edges; the ears' last row
    '.LSSSSSSSSSSSSSSSSSSSsL....', // 15 the mouth slot (cols 10-13)
    '..LSSSSSSSSLLSSSSSSSsL.....', // 16 the closed mouth
    '..LSSSSSSSSSSSSSSSSSsL.....', // 17 the cheeks
    '...LSSSSSSSSSSSSSSSsL......', // 18
    '....LLSSSSSSSSSSSsLL.......', // 19
    '......LLssssssssLL.........', // 20 the chin's underside
    '........LLLLLLLL...........', // 21 the chin's outline, the neck anchor at col 12
  ],
  anchors: { neck: { x: 12, y: 21 } },
  slots: { eyes: { x: 4, y: 10, w: 16, h: 4 }, mouth: { x: 10, y: 15, w: 4, h: 2 }, mark: { x: 24, y: 0, w: 3, h: 5 } },
}

/** Every face drawing the editor's head takes: his eyes behind the glasses, the mangaka's mouths and marks. */
export const EDITOR_FACE_ART: FaceArt = { eyes: EDITOR_EYES, mouths: MOUTHS, marks: MARK_ART }

/** A head with a face: the eyes and the mouth in its slots, the mark beside the hair (the sheet, the portrait); the rig head in its art by default. */
export function headWith(face: Face, head: HeadPart = HEAD, art: FaceArt = FACE_ART): SpriteMap {
  const rows = stampFace(head, art, face).map((row) => row.split(''))
  if (face.mark !== 'none') {
    const s = head.slots.mark
    art.marks[face.mark].forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] !== '.') rows[s.y + r][s.x + c] = row[c]
    })
  }
  return rows.map((row) => row.join(''))
}
