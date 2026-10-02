// The sprite contact sheet: every cast frame at 8x (the cat at 16x) on a flat grey ground, each working-tree frame
// beside the same frame at HEAD, so a redraw is judged against what it replaces (Release B's readability gate).
// Run with: npm run sprites -- <out.png> [--walk]   (--walk writes only the walk strips, row H)
// The PNG has no text; stdout names each row's cells in order. The pure pixel work is scripts/lib/spriteSheet.ts.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { blank, blitFace, layoutRow, markPalette, paintOver, rasterize, type Rgba } from './lib/spriteSheet'

type Frame = readonly string[]
type Pal = Record<string, string>
/** The slice of src/ui/scene/sprites.ts the sheet reads (loaded by path, so tsc never follows it into the DOM types). */
type Sprites = Record<string, unknown> & {
  PAL: Pal
  OUTFIT_PALS?: Partial<Record<'hoodie' | 'cardigan' | 'blazer', Pal>>
  ASSISTANT_PALS: Pal[]
  FACES: Record<string, Frame>
  MARKS: Record<string, Frame>
  MARK_PAL: Pal
  HEAD_DY: Record<string, readonly number[]>
}

const SCALE = 8
const CAT_SCALE = 16
const GROUND = '#d9d9d9'
const GUTTER = 2 * SCALE // around the sheet, inside a new/HEAD pair, between mood cells and strip frames
const PAIR_GAP = 6 * SCALE // between pairs and between rows, wider than inside a pair
const MOODS = ['happy', 'tired', 'surprised', 'sleepy'] as const

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const posix = (p: string) => p.replaceAll('\\', '/')

/** HEAD's sprite modules, written under node_modules/.cache with the looks import pointed at the working tree. */
async function loadHead(): Promise<Sprites | null> {
  const dir = resolve(root, 'node_modules/.cache/rising-mangaka-sprites/head')
  const looks = posix(resolve(root, 'src/ui/looks.ts'))
  try {
    for (const file of ['sprites.ts', 'spriteCore.ts', 'generated/assistant-doze.ts']) {
      const src = execFileSync('git', ['show', `HEAD:src/ui/scene/${file}`], { cwd: root, encoding: 'utf8' })
      mkdirSync(dirname(resolve(dir, file)), { recursive: true })
      writeFileSync(resolve(dir, file), src.replaceAll("from '../looks'", `from '${looks}'`))
    }
    return (await import(/* @vite-ignore */ posix(resolve(dir, 'sprites.ts')))) as Sprites
  } catch (err) {
    console.log(`note: HEAD's sprites could not be loaded, every HEAD cell is empty (${(err as Error).message.split('\n')[0]})`)
    return null
  }
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
  const args = process.argv.slice(2)
  const out = args.find((a) => !a.startsWith('--'))
  if (!out) throw new Error('usage: npm run sprites -- <out.png> [--walk]')
  const walkOnly = args.includes('--walk')

  const now = (await import(/* @vite-ignore */ posix(resolve(root, 'src/ui/scene/sprites.ts')))) as Sprites
  const head = await loadHead()

  const notes = new Set<string>()
  const mustNow = (ref: Ref): Frame => {
    const f = frameOf(now, ref)
    if (!f) throw new Error(`the working tree has no ${label(ref)}`)
    return f
  }
  /** HEAD's frame in HEAD's own palette, or an empty cell the working tree frame's size (and a note) when it is missing. */
  const drawHead = (ref: Ref, pal: (m: Sprites) => Pal | undefined, scale: number): Rgba => {
    const f = frameOf(head, ref)
    const p = head ? pal(head) : undefined
    if (f && p) return rasterize(f, p, scale)
    if (head) notes.add(`note: HEAD has no ${label(ref)} (or its palette), its cell is empty`)
    const like = mustNow(ref)
    return blank(like[0].length * scale, like.length * scale)
  }
  /** One pair: the working tree's frame left, HEAD's right; `withHead` false leaves HEAD's slot empty (rows B, C). */
  const pair = (ref: Ref, pal: (m: Sprites) => Pal | undefined, scale: number, withHead = true): Rgba => {
    const left = rasterize(mustNow(ref), pal(now) ?? now.PAL, scale)
    const right = withHead ? drawHead(ref, pal, scale) : blank(left.width, left.height)
    return hcat([left, right], GUTTER)
  }

  const rows: Rgba[] = []
  const legend: string[] = []

  if (!walkOnly) {
    rows.push(hcat(ROW_A.map((r) => pair(r, (m) => m.PAL, SCALE)), PAIR_GAP))
    legend.push(`A (the mangaka, each pair new then HEAD): ${names(ROW_A)}`)
    for (const [row, outfit] of [['B', 'cardigan'], ['C', 'blazer']] as const) {
      rows.push(hcat(ROW_A.map((r) => pair(r, (m) => m.OUTFIT_PALS?.[outfit], SCALE, false)), PAIR_GAP))
      legend.push(`${row} (row A in OUTFIT_PALS.${outfit}, new only, under each pair's new cell): ${names(ROW_A)}`)
    }

    const rowD: Rgba[] = []
    const rowDNames: string[] = []
    for (const look of [1, 2, 3]) {
      for (const ref of [{ name: 'MANGAKA_SIT', index: 0 }, { name: 'ASSISTANT_DOZE' }]) {
        rowD.push(rasterize(mustNow(ref), now.ASSISTANT_PALS[look], SCALE))
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
    legend.push(`F (the editor, each pair new then HEAD): ${names(ROW_F)}`)
    rows.push(hcat(ROW_G.map((r) => pair(r, (m) => m.PAL, CAT_SCALE)), PAIR_GAP))
    legend.push(`G (the cat at ${CAT_SCALE}x, each pair new then HEAD): ${names(ROW_G)}`)
  }

  /** A walk cycle three times over in one strip, the working tree's above HEAD's. */
  const strips = (cycle: Ref[], scale: number): Rgba => {
    const loop = [...cycle, ...cycle, ...cycle]
    return vcat([
      hcat(loop.map((r) => rasterize(mustNow(r), now.PAL, scale)), GUTTER),
      hcat(loop.map((r) => drawHead(r, (m) => m.PAL, scale)), GUTTER),
    ], GUTTER)
  }
  rows.push(vcat([
    strips(refs('MANGAKA_WALK', 4), SCALE), strips(refs('EDITOR_WALK', 4), SCALE), strips(refs('CAT_WALK', 2), CAT_SCALE),
  ], PAIR_GAP))
  legend.push(`H (the walk strips, each cycle three times, the new strip above HEAD's): MANGAKA_WALK[0..3], then `
    + `EDITOR_WALK[0..3], then CAT_WALK[0..1] at ${CAT_SCALE}x`)

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
  console.log(`wrote ${outPath} (${sheet.width}x${sheet.height}${head ? '' : ', no HEAD cells'})`)
}

await main()
