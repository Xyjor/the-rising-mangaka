// The sprite contact sheet at 8x (the cat at 16x) on a flat grey ground, judged against what each drawing replaces
// (`--base <ref>`, default main, where the 0.10 frames stay until the merge): per rig animation (0.11.0) a strip of its
// steps' frames beside the 0.10 frames it replaces at the base, the same strip in the cardigan and the blazer under it
// (and, for the assistants' animations, in each of the six assistant looks); an editor animation (0.12.0, `editor-*`)
// draws its strip in EDITOR_PAL only, beside the base's 0.10 editor frames; then a mood row (the rig's standing,
// seated and walking poses in the five moods); the cat beside the base (row G; row F, the 0.10 editor, went at 0.12.0
// task 4); the walk strips (row H: the rig's walk and the rig editor's, each above the base's 0.10 cycle, then the
// cat); the rig head with every eyes x mouth x mark (row I); and the editor's head with every eyes (row J).
// Run with: npm run sprites -- <out.png> [--walk] [--base <ref>] [--only <prefix>]   (--walk writes only the walk
// strips, row H; --only draws only the animations whose id starts with the prefix, `editor-` the editor's)
// The PNG has no text; stdout names each row's cells in order. The pure pixel work is scripts/lib/spriteSheet.ts.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { blank, cellOrEmpty, hcat, paintOver, rasterize, shelve, vcat, type Rgba } from './lib/spriteSheet'
import { ANIMS, ANIM_IDS } from '../src/ui/scene/rig/anims'
import type { AnimId } from '../src/ui/scene/rig/anims'
import { MOODS, rigFrame } from '../src/ui/scene/rig/frames'
import { EDITOR_EYES, EDITOR_FACE_ART, EDITOR_HEAD, EYES, MOUTHS, headWith } from '../src/ui/scene/rig/head'
import { POSES } from '../src/ui/scene/rig/poses'
import type { PoseId } from '../src/ui/scene/rig/poses'
import type { EyesId, MarkId, MouthId } from '../src/ui/scene/rig/types'

type Frame = readonly string[]
type Pal = Record<string, string>
/**
 * The slice of src/ui/scene/sprites.ts the sheet reads (loaded by path, so tsc never follows it into the DOM types).
 * The outfit and assistant palettes may be missing (a rename, a look not drawn yet): their working-tree cells are then
 * empty, with a note, as a base cell without its frame or palette is.
 */
type Sprites = Record<string, unknown> & {
  PAL: Pal
  OUTFIT_PALS?: Partial<Record<'hoodie' | 'cardigan' | 'blazer', Pal>>
  ASSISTANT_PALS?: readonly (Pal | undefined)[]
  EDITOR_PAL?: Pal
}

const SCALE = 8
const CAT_SCALE = 16
const GROUND = '#d9d9d9'
const GUTTER = 2 * SCALE // around the sheet, inside a new/base pair, between mood cells and strip frames
const PAIR_GAP = 6 * SCALE // between pairs and between rows, wider than inside a pair
/** The 0.10 people's frame, the size of a base cell the base ref lacks. */
const OLD_W = 24
const OLD_H = 32
/** The six assistant looks the assistants' strips are drawn in. */
const LOOKS = [0, 1, 2, 3, 4, 5] as const
/** The animations the assistants play too: their strips are also drawn in every assistant look. */
const ASSISTANT_ANIMS: ReadonlySet<AnimId> = new Set<AnimId>([
  'seat-draw', 'seat-idle', 'seat-stretch', 'seat-sip', 'seat-flip', 'seat-rub', 'seat-cheer', 'doze',
])
/** The mood row's poses, each drawn in the five moods once its art task has landed it in POSES. */
const MOOD_POSES = ['stand.idle', 'seat.rest', 'walk.contact-l'] as const
/** Row I's marks, across each mouth: none first, then the four moods' marks. */
const ROW_I_MARKS: readonly MarkId[] = ['none', 'sweat', 'sparkle', 'bang', 'zee']

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const posix = (p: string) => p.replaceAll('\\', '/')

/**
 * The base ref's sprite modules, written under node_modules/.cache (cleared first, so no other ref's file is left
 * behind) with the looks import pointed at the working tree. A file the ref lacks is skipped with a note; if sprites.ts
 * then cannot load, every base cell is empty.
 */
async function loadBase(ref: string): Promise<Sprites | null> {
  const dir = resolve(root, 'node_modules/.cache/rising-mangaka-sprites/base')
  const looks = posix(resolve(root, 'src/ui/looks.ts'))
  rmSync(dir, { recursive: true, force: true })
  // the base's sprites.ts still imports its generated doze (on main until the 0.11.0 merge; the working tree retired it
  // at task 19, and its own rows read only the rig, the editor and the cat)
  for (const file of ['sprites.ts', 'spriteCore.ts', 'generated/assistant-doze.ts']) {
    let src: string
    try {
      src = execFileSync('git', ['show', `${ref}:src/ui/scene/${file}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch {
      console.log(`note: ${ref} has no src/ui/scene/${file}, skipped`)
      continue
    }
    mkdirSync(dirname(resolve(dir, file)), { recursive: true })
    writeFileSync(resolve(dir, file), src.replaceAll("from '../looks'", `from '${looks}'`))
  }
  try {
    return (await import(/* @vite-ignore */ posix(resolve(dir, 'sprites.ts')))) as Sprites
  } catch (err) {
    console.log(`note: ${ref}'s sprites could not be loaded, every base cell is empty (${(err as Error).message.split('\n')[0]})`)
    return null
  }
}

/** The out path, `--walk`, `--base <ref>` (default main) and `--only <prefix>` from the command line. */
function parseArgs(args: readonly string[]): { out?: string; walkOnly: boolean; ref: string; only: string } {
  let out: string | undefined
  let ref = 'main'
  let only = ''
  let walkOnly = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--walk') walkOnly = true
    else if (args[i] === '--base' || args[i] === '--only') {
      const flag = args[i]
      const next = args[++i]
      if (!next || next.startsWith('--')) {
        throw new Error(flag === '--base' ? '--base needs a ref, such as main or HEAD' : '--only needs an animation id prefix, such as stand or seat-')
      }
      if (flag === '--base') ref = next
      else only = next
    } else if (!args[i].startsWith('--') && out === undefined) out = args[i]
  }
  return { out, walkOnly, ref, only }
}

type Ref = { name: string; index?: number }
const refs = (name: string, n: number): Ref[] => Array.from({ length: n }, (_, index) => ({ name, index }))
const label = (r: Ref) => (r.index === undefined ? r.name : `${r.name}[${r.index}]`)
const names = (rs: readonly Ref[]) => rs.map(label).join(', ')

/** A frame by export name and index, or undefined when the module lacks it (a future rename). */
function frameOf(mod: Sprites | null, ref: Ref): Frame | undefined {
  const v = mod?.[ref.name]
  const f = ref.index === undefined ? v : Array.isArray(v) ? v[ref.index] : undefined
  return Array.isArray(f) && typeof f[0] === 'string' ? (f as Frame) : undefined
}

/**
 * The 0.10 frames each rig animation replaces, read from the base ref (none: a new animation, nothing beside it). The
 * working tree has none of them since its rig took over (the editor's `EDITOR_IDLE`/`EDITOR_WALK` at 0.12.0 task 11);
 * they stay on the base ref until the merge.
 */
const REPLACES: Partial<Record<AnimId, Ref[]>> = {
  stand: refs('MANGAKA_IDLE', 2), 'stand-ready': [{ name: 'MANGAKA_IDLE', index: 0 }], walk: refs('MANGAKA_WALK', 4),
  'seat-draw': refs('MANGAKA_SIT', 2), 'seat-idle': [{ name: 'MANGAKA_SIT', index: 0 }],
  'seat-draw-late': refs('MANGAKA_PANIC', 2), 'seat-panic': refs('MANGAKA_PANIC', 2), sleep: [{ name: 'MANGAKA_LIE' }],
  'stand-sip': refs('MANGAKA_SIP', 2), 'seat-sip': refs('MANGAKA_SIP', 2), 'seat-stretch': refs('MANGAKA_STRETCH', 2),
  doze: [{ name: 'ASSISTANT_DOZE' }],
  'editor-stand': refs('EDITOR_IDLE', 2), 'editor-walk': refs('EDITOR_WALK', 4),
}

const ROW_G: Ref[] = [
  { name: 'CAT_SLEEP' }, { name: 'CAT_SIT' }, ...refs('CAT_WALK', 2), ...refs('CAT_GROOM', 2), { name: 'CAT_STRETCH' },
]

async function main() {
  const { out, walkOnly, ref: baseRef, only } = parseArgs(process.argv.slice(2))
  if (!out) throw new Error('usage: npm run sprites -- <out.png> [--walk] [--base <ref>] [--only <prefix>]')

  const now = (await import(/* @vite-ignore */ posix(resolve(root, 'src/ui/scene/sprites.ts')))) as Sprites
  const base = await loadBase(baseRef)

  const notes = new Set<string>()
  const mustNow = (r: Ref): Frame => {
    const f = frameOf(now, r)
    if (!f) throw new Error(`the working tree has no ${label(r)}`)
    return f
  }
  /** The base's frame in its own palette, or an empty cell the working tree frame's size (and a note) when it is missing. */
  const drawBase = (r: Ref, pal: (m: Sprites) => Pal | undefined, scale: number): Rgba => {
    const f = frameOf(base, r)
    const p = base ? pal(base) : undefined
    if (f && p) return rasterize(f, p, scale)
    if (base) notes.add(`note: the base (${baseRef}) has no ${label(r)} (or its palette), its cell is empty`)
    const like = mustNow(r)
    return blank(like[0].length * scale, like.length * scale)
  }
  /** A 0.10 frame the rig replaces, at the base in its PAL, or an empty 24x32 cell (and a note) when the base lacks it. */
  const oldCell = (r: Ref): Rgba => {
    const f = frameOf(base, r)
    if (f && base) return rasterize(f, base.PAL, SCALE)
    if (base) notes.add(`note: the base (${baseRef}) has no ${label(r)}, its cell is empty`)
    return blank(OLD_W * SCALE, OLD_H * SCALE)
  }
  /** A working-tree frame in a working-tree palette, or an empty cell the frame's size (and a note) without one. */
  const drawNow = (r: Ref, pal: Pal | undefined, palName: string, scale: number): Rgba =>
    cellOrEmpty(mustNow(r), pal, scale, notes, `note: the working tree has no ${palName}, its cells are empty`)
  /** One pair: the working tree's frame left, the base's right. */
  const pair = (r: Ref, pal: (m: Sprites) => Pal | undefined, scale: number): Rgba =>
    hcat([drawNow(r, pal(now), 'PAL', scale), drawBase(r, pal, scale)], GUTTER)
  /** A rig animation's steps in order, each frame neutral (ready in `stand-ready`), in one palette, a gutter apart. */
  const rigStrip = (id: AnimId, pal: Pal | undefined, palName: string, times = 1): Rgba => {
    const steps = Array.from({ length: times }, () => ANIMS[id].steps).flat()
    return hcat(steps.map((st) => cellOrEmpty(rigFrame(st.pose, 'neutral', id === 'stand-ready').map, pal, SCALE, notes,
      `note: the working tree has no ${palName}, its cells are empty`)), GUTTER)
  }
  /** A cycle three times over in one list: a walk strip's length. */
  const thrice = <T>(cycle: readonly T[]): T[] => Array.from({ length: 3 }, () => cycle).flat()
  /** A 0.10 walk cycle at the base, three times over in one strip (under the rig's walk strip). */
  const oldStrip = (cycle: readonly Ref[]): Rgba => hcat(thrice(cycle).map(oldCell), GUTTER)

  const blocks: Rgba[] = []
  const rows: Rgba[] = []
  const legend: string[] = []

  if (!walkOnly) {
    const ids = ANIM_IDS.filter((a) => a.startsWith(only))
    if (!ids.length) throw new Error(`no animation id starts with ${only}`)
    legend.push(`the animations, a block each, left to right on shelves: the strip in PAL (EDITOR_PAL for the editor's; `
      + `each step neutral, ready in stand-ready) beside the base's frames it replaces, then the strip in each palette `
      + `named, a row each`)
    for (const id of ids) {
      const a = ANIMS[id]
      const old = REPLACES[id]
      // the editor (0.12.0) wears his own palette, no outfits or looks under it
      const editor = id.startsWith('editor-')
      const strip = editor ? rigStrip(id, now.EDITOR_PAL, 'EDITOR_PAL') : rigStrip(id, now.PAL, 'PAL')
      const lines = [old ? hcat([strip, hcat(old.map(oldCell), GUTTER)], PAIR_GAP) : strip]
      const under = editor ? [] : (['cardigan', 'blazer'] as const)
      for (const outfit of under) lines.push(rigStrip(id, now.OUTFIT_PALS?.[outfit], `OUTFIT_PALS.${outfit}`))
      const looks = ASSISTANT_ANIMS.has(id) ? LOOKS : []
      for (const look of looks) lines.push(rigStrip(id, now.ASSISTANT_PALS?.[look], `ASSISTANT_PALS[${look}]`))
      blocks.push(vcat(lines, GUTTER))
      legend.push(`${blocks.length}. ${id} (${a.posture}, ${a.loop ? 'loop' : 'once'}): ${a.steps.map((st) => `${st.pose} ${st.ms}`).join(', ')}`
        + `${editor ? ' in EDITOR_PAL' : ''}`
        + `${old ? `; beside it the base's ${names(old)}` : '; nothing at the base'}`
        + `${under.length ? `; under it in ${under.map((o) => `OUTFIT_PALS.${o}`).join(', ')}` : ''}`
        + `${looks.length ? `, then ASSISTANT_PALS[${looks.join(', ')}]` : ''}`)
    }

    // each pose of the mood row its art task has drawn, in the five moods, the mark in its slot beside the hair
    const moodPoses = MOOD_POSES.filter((p): p is typeof p & PoseId => p in POSES)
    rows.push(hcat(moodPoses.map((p) => hcat(MOODS.map((mood) =>
      rasterize(rigFrame(p, mood, false).map, now.PAL, SCALE)), GUTTER)), PAIR_GAP))
    legend.push(`row moods (each pose in ${MOODS.join(', ')}): ${moodPoses.join(', ')}`)

    rows.push(hcat(ROW_G.map((r) => pair(r, (m) => m.PAL, CAT_SCALE)), PAIR_GAP))
    legend.push(`row G (the cat at ${CAT_SCALE}x, each pair new then base): ${names(ROW_G)}`)
  }

  /** The cat's walk cycle three times over in one strip, the working tree's above the base's. */
  const strips = (cycle: Ref[], scale: number): Rgba => {
    const loop = thrice(cycle)
    return vcat([
      hcat(loop.map((r) => rasterize(mustNow(r), now.PAL, scale)), GUTTER),
      hcat(loop.map((r) => drawBase(r, (m) => m.PAL, scale)), GUTTER),
    ], GUTTER)
  }
  rows.push(vcat([
    vcat([rigStrip('walk', now.PAL, 'PAL', 3), oldStrip(refs('MANGAKA_WALK', 4))], GUTTER),
    vcat([rigStrip('editor-walk', now.EDITOR_PAL, 'EDITOR_PAL', 3), oldStrip(refs('EDITOR_WALK', 4))], GUTTER),
    strips(refs('CAT_WALK', 2), CAT_SCALE),
  ], PAIR_GAP))
  legend.push(`row H (the walk strips, each cycle three times, the new strip above the base's): the rig's walk `
    + `(${ANIMS.walk.steps.map((st) => st.pose).join(', ')}) above the base's MANGAKA_WALK[0..3], then the rig's `
    + `editor-walk in EDITOR_PAL (${ANIMS['editor-walk'].steps.map((st) => st.pose).join(', ')}) above the base's `
    + `EDITOR_WALK[0..3], then CAT_WALK[0..1] at ${CAT_SCALE}x`)

  if (!walkOnly) {
    // the rig head with every face, its mark in the slot beside the hair: mark cells a gutter apart, mouths wider
    const eyeIds = Object.keys(EYES) as EyesId[]
    const mouthIds = Object.keys(MOUTHS) as MouthId[]
    rows.push(vcat(eyeIds.map((eyes) => hcat(mouthIds.map((mouth) => hcat(ROW_I_MARKS.map((mark) =>
      rasterize(headWith({ eyes, mouth, mark }), now.PAL, SCALE)), GUTTER)), PAIR_GAP)), GUTTER))
    legend.push(`row I (the rig head: one row per eyes in EYES order, each mouth x mark (${ROW_I_MARKS.join(', ')}) across): `
      + `rows ${eyeIds.join(', ')}; across ${mouthIds.join(', ')}, each with every mark`)
    // the editor's head (0.12.0) behind his glasses, every eyes he takes, the mouth closed
    const editorEyes = Object.keys(EDITOR_EYES) as EyesId[]
    rows.push(hcat(editorEyes.map((eyes) =>
      rasterize(headWith({ eyes, mouth: 'closed', mark: 'none' }, EDITOR_HEAD, EDITOR_FACE_ART), now.PAL, SCALE)), GUTTER))
    legend.push(`row J (the editor's head, 0.12.0: each eyes in EDITOR_EYES order, the mouth closed): ${editorEyes.join(', ')}`)
  }

  // the blocks on shelves no wider than the widest row or block, so the sheet's area stays near its content's
  const wrap = Math.max(...rows.map((r) => r.width), ...blocks.map((b) => b.width))
  const body = vcat(blocks.length ? [shelve(blocks, wrap, PAIR_GAP), ...rows] : rows, PAIR_GAP)
  const sheet = blank(body.width + 2 * GUTTER, body.height + 2 * GUTTER, GROUND)
  paintOver(sheet, body, GUTTER, GUTTER)
  const outPath = resolve(process.cwd(), out)
  mkdirSync(dirname(outPath), { recursive: true })
  await sharp(Buffer.from(sheet.data.buffer, sheet.data.byteOffset, sheet.data.length), {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  }).png({ compressionLevel: 9 }).toFile(outPath)

  for (const n of notes) console.log(n)
  for (const line of legend) console.log(line)
  console.log(`wrote ${outPath} (${sheet.width}x${sheet.height}, base ${baseRef}${base ? '' : ', no base cells'})`)
}

await main()
