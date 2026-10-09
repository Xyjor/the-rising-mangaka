// The sprite contact sheet: every cast frame at 8x (the cat at 16x) on a flat grey ground, each working-tree frame
// beside the same frame at a base ref (`--base <ref>`, default main, where the 0.10 frames stay until the 0.11.0
// merge), so a redraw is judged against what it replaces (Release B's readability gate), and the rig head (0.11.0)
// with every eyes x mouth x mark (row I).
// Run with: npm run sprites -- <out.png> [--walk] [--base <ref>]   (--walk writes only the walk strips, row H)
// The PNG has no text; stdout names each row's cells in order. The pure pixel work is scripts/lib/spriteSheet.ts.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { blank, blitFace, cellOrEmpty, layoutRow, markPalette, paintOver, rasterize, type Rgba } from './lib/spriteSheet'
import { EYES, MOUTHS, headWith } from '../src/ui/scene/rig/head'
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
  FACES: Record<string, Frame>
  MARKS: Record<string, Frame>
  MARK_PAL: Pal
  HEAD_DY: Record<string, readonly number[]>
}

const SCALE = 8
const CAT_SCALE = 16
const GROUND = '#d9d9d9'
const GUTTER = 2 * SCALE // around the sheet, inside a new/base pair, between mood cells and strip frames
const PAIR_GAP = 6 * SCALE // between pairs and between rows, wider than inside a pair
const MOODS = ['happy', 'tired', 'surprised', 'sleepy'] as const
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

/** The out path, `--walk` and `--base <ref>` (default main) from the command line. */
function parseArgs(args: readonly string[]): { out?: string; walkOnly: boolean; ref: string } {
  let out: string | undefined
  let ref = 'main'
  let walkOnly = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--walk') walkOnly = true
    else if (args[i] === '--base') {
      const next = args[++i]
      if (!next || next.startsWith('--')) throw new Error('--base needs a ref, such as main or HEAD')
      ref = next
    } else if (!args[i].startsWith('--') && out === undefined) out = args[i]
  }
  return { out, walkOnly, ref }
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

/** Images side by side, `gap` apart, bottom-aligned (so the bed pose and the cat sit on the row's floor). */
function hcat(imgs: readonly Rgba[], gap: number): Rgba {
  const row = layoutRow(imgs.map((i) => ({ w: i.width, h: i.height })), gap)
  const out = blank(row.width, row.height)
  imgs.forEach((img, i) => paintOver(out, img, row.cells[i].x, row.height - img.height))
  return out
}

/** Images stacked top to bottom, `gap` apart, left-aligned. */
function vcat(imgs: readonly Rgba[], gap: number): Rgba {
  const width = imgs.reduce((w, i) => Math.max(w, i.width), 0)
  const height = imgs.reduce((h, i) => h + i.height, 0) + gap * Math.max(0, imgs.length - 1)
  const out = blank(width, height)
  let y = 0
  for (const img of imgs) {
    paintOver(out, img, 0, y)
    y += img.height + gap
  }
  return out
}

const ROW_A: Ref[] = [
  ...refs('MANGAKA_IDLE', 2), ...refs('MANGAKA_STRETCH', 2), ...refs('MANGAKA_SIP', 2), ...refs('MANGAKA_WALK', 4),
  ...refs('MANGAKA_SIT', 2), ...refs('MANGAKA_PANIC', 2), { name: 'MANGAKA_LIE' }, { name: 'ASSISTANT_DOZE' },
]
const ROW_F: Ref[] = [...refs('EDITOR_IDLE', 2), ...refs('EDITOR_WALK', 4)]
const ROW_G: Ref[] = [
  { name: 'CAT_SLEEP' }, { name: 'CAT_SIT' }, ...refs('CAT_WALK', 2), ...refs('CAT_GROOM', 2), { name: 'CAT_STRETCH' },
]

async function main() {
  const { out, walkOnly, ref: baseRef } = parseArgs(process.argv.slice(2))
  if (!out) throw new Error('usage: npm run sprites -- <out.png> [--walk] [--base <ref>]')

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
  /** A working-tree frame in a working-tree palette, or an empty cell the frame's size (and a note) without one. */
  const drawNow = (r: Ref, pal: Pal | undefined, palName: string, scale: number): Rgba =>
    cellOrEmpty(mustNow(r), pal, scale, notes, `note: the working tree has no ${palName}, its cells are empty`)
  /**
   * One pair: the working tree's frame left, the base's right; `withBase` false leaves the base's slot empty (rows B,
   * C). `palName` names the palette in the note when the working tree lacks it.
   */
  const pair = (r: Ref, pal: (m: Sprites) => Pal | undefined, scale: number, withBase = true, palName = 'PAL'): Rgba => {
    const left = drawNow(r, pal(now), palName, scale)
    const right = withBase ? drawBase(r, pal, scale) : blank(left.width, left.height)
    return hcat([left, right], GUTTER)
  }

  const rows: Rgba[] = []
  const legend: string[] = []

  if (!walkOnly) {
    rows.push(hcat(ROW_A.map((r) => pair(r, (m) => m.PAL, SCALE)), PAIR_GAP))
    legend.push(`A (the mangaka, each pair new then base): ${names(ROW_A)}`)
    for (const [row, outfit] of [['B', 'cardigan'], ['C', 'blazer']] as const) {
      const outfitPal = (m: Sprites) => m.OUTFIT_PALS?.[outfit]
      rows.push(hcat(ROW_A.map((r) => pair(r, outfitPal, SCALE, false, `OUTFIT_PALS.${outfit}`)), PAIR_GAP))
      legend.push(`${row} (row A in OUTFIT_PALS.${outfit}, new only, under each pair's new cell): ${names(ROW_A)}`)
    }

    const rowD: Rgba[] = []
    const rowDNames: string[] = []
    for (const look of [1, 2, 3]) {
      for (const ref of [{ name: 'MANGAKA_SIT', index: 0 }, { name: 'ASSISTANT_DOZE' }]) {
        rowD.push(drawNow(ref, now.ASSISTANT_PALS?.[look], `ASSISTANT_PALS[${look}]`, SCALE))
        rowDNames.push(`${label(ref)} in ASSISTANT_PALS[${look}]`)
      }
    }
    rows.push(hcat(rowD, PAIR_GAP))
    legend.push(`D (assistant looks, new only): ${rowDNames.join(', ')}`)

    // the face at (x+4, y+9+headDy) and the mark at (x+20, y-2), where render.ts's drawMood puts them
    const moodPal = markPalette(now.PAL, now.MARK_PAL)
    const steady: [Ref, number][] = [
      [{ name: 'MANGAKA_IDLE', index: 0 }, now.HEAD_DY.idle[0]], [{ name: 'MANGAKA_IDLE', index: 1 }, now.HEAD_DY.idle[1]],
      [{ name: 'MANGAKA_SIT', index: 0 }, now.HEAD_DY.sit[0]], [{ name: 'MANGAKA_SIP', index: 0 }, now.HEAD_DY.sip[0]],
    ]
    rows.push(hcat(steady.map(([ref, dy]) => hcat(MOODS.map((mood) =>
      rasterize(blitFace(mustNow(ref), now.FACES[mood], now.MARKS[mood], dy), moodPal, SCALE)), GUTTER)), PAIR_GAP))
    legend.push(`E (the moods, each frame ${MOODS.join(', ')}, new only, 2 rows of headroom): `
      + steady.map(([r, dy]) => `${label(r)} (headDy ${dy})`).join(', '))

    rows.push(hcat(ROW_F.map((r) => pair(r, (m) => m.PAL, SCALE)), PAIR_GAP))
    legend.push(`F (the editor, each pair new then base): ${names(ROW_F)}`)
    rows.push(hcat(ROW_G.map((r) => pair(r, (m) => m.PAL, CAT_SCALE)), PAIR_GAP))
    legend.push(`G (the cat at ${CAT_SCALE}x, each pair new then base): ${names(ROW_G)}`)
  }

  /** A walk cycle three times over in one strip, the working tree's above the base's. */
  const strips = (cycle: Ref[], scale: number): Rgba => {
    const loop = [...cycle, ...cycle, ...cycle]
    return vcat([
      hcat(loop.map((r) => rasterize(mustNow(r), now.PAL, scale)), GUTTER),
      hcat(loop.map((r) => drawBase(r, (m) => m.PAL, scale)), GUTTER),
    ], GUTTER)
  }
  rows.push(vcat([
    strips(refs('MANGAKA_WALK', 4), SCALE), strips(refs('EDITOR_WALK', 4), SCALE), strips(refs('CAT_WALK', 2), CAT_SCALE),
  ], PAIR_GAP))
  legend.push(`H (the walk strips, each cycle three times, the new strip above the base's): MANGAKA_WALK[0..3], then `
    + `EDITOR_WALK[0..3], then CAT_WALK[0..1] at ${CAT_SCALE}x`)

  if (!walkOnly) {
    // the rig head with every face, its mark in the slot beside the hair: mark cells a gutter apart, mouths wider
    const eyeIds = Object.keys(EYES) as EyesId[]
    const mouthIds = Object.keys(MOUTHS) as MouthId[]
    rows.push(vcat(eyeIds.map((eyes) => hcat(mouthIds.map((mouth) => hcat(ROW_I_MARKS.map((mark) =>
      rasterize(headWith({ eyes, mouth, mark }), now.PAL, SCALE)), GUTTER)), PAIR_GAP)), GUTTER))
    legend.push(`I (the rig head: one row per eyes in EYES order, each mouth x mark (${ROW_I_MARKS.join(', ')}) across): `
      + `rows ${eyeIds.join(', ')}; across ${mouthIds.join(', ')}, each with every mark`)
  }

  const body = vcat(rows, PAIR_GAP)
  const sheet = blank(body.width + 2 * GUTTER, body.height + 2 * GUTTER, GROUND)
  paintOver(sheet, body, GUTTER, GUTTER)
  const outPath = resolve(process.cwd(), out)
  mkdirSync(dirname(outPath), { recursive: true })
  await sharp(Buffer.from(sheet.data.buffer, sheet.data.byteOffset, sheet.data.length), {
    raw: { width: sheet.width, height: sheet.height, channels: 4 },
  }).png({ compressionLevel: 9 }).toFile(outPath)

  for (const n of notes) console.log(n)
  for (const line of legend) console.log(`row ${line}`)
  console.log(`wrote ${outPath} (${sheet.width}x${sheet.height}, base ${baseRef}${base ? '' : ', no base cells'})`)
}

await main()
