// The art pipeline's IO layer: reads a manifest entry's raw source, runs it through the pure pixel operations in
// src/ui/art/pixelOps.ts, and writes an indexed PNG under src/assets/art/<id>.png. Run with:
//   npm run art -- title/hero
//   npm run art -- --all
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'
import { ART_PALETTE } from '../src/ui/art/palette'
import {
  addOutline,
  alphaBoundingBox,
  despeckle,
  downsampleArea,
  downsampleNearest,
  findBlobs,
  floodTransparentFromEdges,
  padToAspect,
  reduceColors,
  snapToPalette,
  type RgbaImage,
} from '../src/ui/art/pixelOps'

const ROOT = join(__dirname, '..')
const MANIFEST_PATH = join(ROOT, 'art', 'manifest.json')
const OUTLINE_HEX = '#1c1a26'
const FLOOD_TOLERANCE = 24
const DEFAULT_COLORS = 16

interface SheetSpec {
  src: string
  /** An equal grid over the sheet; omit all three to take the whole sheet (then `crop` picks the object). */
  cols?: number
  rows?: number
  cell?: [number, number]
}

interface ManifestEntry {
  id: string
  model: string
  resolution: string
  seed: number
  steps: number
  shift: number
  prompt: string
  preamble: 'scene' | 'cutout' | 'none'
  native: [number, number]
  sample: 'area' | 'nearest'
  cutout: boolean
  outline: boolean
  colors?: number
  crop?: [number, number, number, number]
  sheet?: SheetSpec
}

function loadManifest(): ManifestEntry[] {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestEntry[]
}

async function loadRgba(path: string): Promise<RgbaImage> {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) }
}

/** Slices one region out of a larger RGBA image (used for both `crop` and a sheet cell). */
function sliceRegion(img: RgbaImage, x: number, y: number, w: number, h: number): RgbaImage {
  const out = new Uint8ClampedArray(w * h * 4)
  for (let row = 0; row < h; row++) {
    const srcOffset = ((y + row) * img.width + x) * 4
    const dstOffset = row * w * 4
    out.set(img.data.subarray(srcOffset, srcOffset + w * 4), dstOffset)
  }
  return { width: w, height: h, data: out }
}

async function processEntry(entry: ManifestEntry): Promise<{ outPath: string; colours: number; bytes: number }> {
  let raw: RgbaImage
  if (entry.sheet) {
    const sheetPath = join(ROOT, 'art', 'raw', `${entry.sheet.src}.webp`)
    const sheetImg = await loadRgba(sheetPath)
    const { cols = 1, rows = 1, cell = [0, 0] } = entry.sheet
    const cellW = Math.floor(sheetImg.width / cols)
    const cellH = Math.floor(sheetImg.height / rows)
    raw = sliceRegion(sheetImg, cell[0] * cellW, cell[1] * cellH, cellW, cellH)
  } else {
    const rawPath = join(ROOT, 'art', 'raw', `${entry.id}.webp`)
    raw = await loadRgba(rawPath)
  }

  let working = raw
  if (entry.crop) {
    const [cx, cy, cw, ch] = entry.crop
    working = sliceRegion(working, cx, cy, cw, ch)
  }

  if (entry.cutout) {
    working = floodTransparentFromEdges(working, FLOOD_TOLERANCE)
    const bbox = alphaBoundingBox(working)
    if (bbox) {
      const [targetW, targetH] = entry.native
      const padded = padToAspect(bbox, targetW, targetH, working.width, working.height)
      working = sliceRegion(working, padded.x, padded.y, padded.width, padded.height)
    }
  }

  const [nativeW, nativeH] = entry.native
  working =
    entry.sample === 'nearest'
      ? downsampleNearest(working, nativeW, nativeH)
      : downsampleArea(working, nativeW, nativeH)
  working = snapToPalette(working, ART_PALETTE)
  // The outline colour counts toward the cap, so leave it a slot.
  working = reduceColors(working, (entry.colors ?? DEFAULT_COLORS) - (entry.outline ? 1 : 0))
  working = despeckle(working)
  if (entry.outline) {
    working = addOutline(working, OUTLINE_HEX)
  }

  const outPath = join(ROOT, 'src', 'assets', 'art', `${entry.id}.png`)
  mkdirSync(dirname(outPath), { recursive: true })

  // One more slot than the colour cap for the transparent entry, so the encoder never re-quantises opaque colours.
  const paletteCount = Math.min(256, (entry.colors ?? DEFAULT_COLORS) + (entry.cutout ? 1 : 0))
  const buffer = await sharp(Buffer.from(working.data.buffer, working.data.byteOffset, working.data.length), {
    raw: { width: working.width, height: working.height, channels: 4 },
  })
    .png({ palette: true, colours: paletteCount, dither: 0, compressionLevel: 9, effort: 10 })
    .toBuffer()

  const fs = await import('node:fs/promises')
  await fs.writeFile(outPath, buffer)

  // Re-read and verify every pixel colour is in ART_PALETTE.
  const { data: verifyData } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const paletteSet = new Set(ART_PALETTE)
  const usedColours = new Set<string>()
  for (let i = 0; i < verifyData.length; i += 4) {
    if (verifyData[i + 3] === 0) continue
    const hex = `#${[verifyData[i], verifyData[i + 1], verifyData[i + 2]]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')}`
    usedColours.add(hex)
    if (!paletteSet.has(hex)) {
      throw new Error(`${entry.id}: pixel colour ${hex} is not in ART_PALETTE`)
    }
  }

  return { outPath, colours: usedColours.size, bytes: buffer.length }
}

/** `--measure <sheet> [mergeGap] [minArea]`: prints each object's bounding box on a raw sheet, for committing as crops. */
async function measure(sheet: string, mergeGap: number, minArea: number) {
  const img = await loadRgba(join(ROOT, 'art', 'raw', `${sheet}.webp`))
  const boxes = findBlobs(img, { tolerance: FLOOD_TOLERANCE, mergeGap, minArea })
  console.log(`${sheet} (${img.width}x${img.height}): ${boxes.length} objects`)
  for (const b of boxes) console.log(JSON.stringify([b.x, b.y, b.width, b.height]))
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--measure') {
    await measure(args[1], Number(args[2] ?? 12), Number(args[3] ?? 400))
    return
  }
  const manifest = loadManifest()
  const ids = args.includes('--all') ? manifest.map((e) => e.id) : args.filter((a) => !a.startsWith('--'))

  if (ids.length === 0) {
    console.error('Usage: npm run art -- <id> [<id> ...] | npm run art -- --all')
    console.error(`Known ids: ${manifest.map((e) => e.id).join(', ')}`)
    process.exit(1)
  }

  for (const id of ids) {
    const entry = manifest.find((e) => e.id === id)
    if (!entry) {
      console.error(`Unknown art id: ${id}`)
      process.exit(1)
    }
    const { outPath, colours, bytes } = await processEntry(entry)
    console.log(`${id}: ${outPath} (${bytes} bytes, ${colours} colours)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
