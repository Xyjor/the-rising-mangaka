// The sprite core: the palette, the frame type, the anchor head and the frame and face rules. A leaf module (no
// imports), so the art pipeline (scripts/pixelate.ts --sprite) can check a frame without loading sprites.ts, its
// generated frames or the scene. sprites.ts re-exports everything here.

export type SpriteMap = readonly string[]

export const PAL: Record<string, string> = {
  L: '#1c1a26',
  H: '#2b2140', h: '#1d1630',
  S: '#f4cfa5', s: '#dba57d',
  E: '#1b1b1b', W: '#f6f6f6', M: '#c0392b', B: '#e8a0a0',
  R: '#3b6fd6', r: '#2a52a6',
  J: '#6f7a8c', j: '#525c6b',
  T: '#2c2c3a', t: '#1f1f2a',
  O: '#c0392b', o: '#8e2a20',
  // P, the editor's glasses frame: a mid steel (0.10.1), so the eye inside each lens and the frame on the skin both show
  G: '#3a3d4c', g: '#2c3656', N: '#c0392b', P: '#6b6b78',
  F: '#6d4c33', f: '#4e3622',
  C: '#e39a4a', c: '#c67d33', Q: '#f0ead6',
  // the collar (K) and tie (Y, its shade y) on the idle and seated frames: in the hoodie (and on the assistants) they
  // keep the colours of the cells they replaced (the hoodie J, the shirt's W and R stripes), so nothing changes there
  K: '#6f7a8c', Y: '#f6f6f6', y: '#3b6fd6',
  // the mood marks' sweat drop (A) and sparkle (X), drawn in the rig head's mark slot (0.11.0); w, the paper's lines,
  // W's shade
  A: '#8fd3ff', X: '#f5b700', w: '#b8b2a5',
}

/**
 * The hand-drawn anchor head (rows 0-15 of the original standing frame): the 0.10 frames' head (the editor's is built
 * on it), and the `--sprite` pipeline grafts it onto a generated frame whose own head fails `faceRules` (manifest
 * `graft: "anchor-head"`), so up to 0.11.0 the 0.10 FACES overlay and its mark landed where they were drawn for. The
 * staff portrait draws the rig's head since 0.11.0 (`rig/head.ts`).
 */
export const ANCHOR_HEAD: SpriteMap = [
  '......LLLLLLLLLL........', // 0
  '....LLHHHHHHHHHhLL......', // 1
  '...LHHHHHHHHHHHHhhL.....', // 2
  '..LHHHHHHHHHHHHHHhhL....', // 3
  '..LHHHHHHHHHHHHHHhhL....', // 4
  '..LHHHHHHHHHHHHHHhhL....', // 5
  '..LHHHSHHHHSHHHHHhhL....', // 6
  '..LHSSSSSSSSSSSSSShL....', // 7
  '..LHSSSSSSSSSSSSSSsL....', // 8
  '..LHSSEESSSSSSEESSsL....', // 9
  '..LHSSEWSSSSSSEWSSsL....', // 10
  '..LHSSEESSSSSSEESSsL....', // 11
  '..LSBBSSSSMMSSSSBBsL....', // 12
  '...LSSSSSSSSSSSSSSsL....', // 13
  '....LSSSSSSSSSSSSsL.....', // 14
  '.....LLsssssssssLL......', // 15
]

/**
 * What is wrong with a frame, [] when nothing: every row `w` wide, `h` rows, every key in `pal` (PAL by default), the last row not empty,
 * and a closed outline (on every row with content, the first and last non-'.' character is 'L').
 */
export function frameRules(map: SpriteMap, w = 24, h = 32, pal: Record<string, string> = PAL): string[] {
  const out: string[] = []
  if (map.length !== h) out.push(`${map.length} rows, not ${h}`)
  map.forEach((row, r) => {
    if (row.length !== w) out.push(`row ${r} is ${row.length} wide, not ${w}`)
    for (const ch of row) if (ch !== '.' && !(ch in pal)) out.push(`row ${r} has key ${ch}`)
    const first = row.search(/[^.]/)
    if (first < 0) return
    let last = row.length - 1
    while (row[last] === '.') last--
    if (row[first] !== 'L' || row[last] !== 'L') out.push(`row ${r} is open`)
  })
  if (map.length && !/[^.]/.test(map[map.length - 1])) out.push('the last row is empty')
  return out
}

/**
 * The keys a face may show inside the rig head's eye and mouth slots (and `faceRules`' 0.10 face window): skin and its
 * shade, the eyes and their white, mouth, blush, outline.
 */
export const FACE_KEYS = 'SsEWMBL'

/** The keys a mark may use (the rig head's mark slot): the outline, the white highlight, the sweat drop, the sparkle. */
export const MARK_KEYS = 'LWAX'

/**
 * What stopped a 0.10 head-steady frame taking the mood overlay (gone since 0.11.0, the rig bakes its faces), [] when
 * nothing: rows 9-12, cols 4-17 (where the 0.10 `FACES` landed) hold only face keys; rows 0-2, cols 20-22 (the 0.10
 * mark slot) are clear; and the head (rows 0-15) stays inside cols 2-19, the 0.10 staff portrait's crop. The
 * `--sprite` pipeline still reports it and grafts the anchor head onto a generated frame that fails it.
 */
export function faceRules(map: SpriteMap): string[] {
  const out: string[] = []
  for (let r = 0; r <= 15 && r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      const ch = map[r][c]
      if (ch === '.') continue
      if (r >= 9 && r <= 12 && c >= 4 && c <= 17 && !FACE_KEYS.includes(ch)) out.push(`row ${r} col ${c} is ${ch}, not a face key`)
      if (r <= 2 && c >= 20 && c <= 22) out.push(`row ${r} col ${c} is in the mark slot`)
      else if (c < 2 || c > 19) out.push(`row ${r} col ${c} is outside the avatar crop`)
    }
  }
  return out
}
