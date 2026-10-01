// The `--sprite` mode's pure helpers (pixelOps.ts): a generated pose cell becomes a string-map frame in PAL keys.
import { describe, expect, it } from 'vitest'
import {
  anchoredPalette, closeOutline, despeckleGrid, graftRows, makeImage, placeInFrame, outlineToL, padBottomCentred, remapRows, runCount, setCells, snapToKeys,
  spriteModule, type RgbaImage,
} from '../pixelOps'

function solid(w: number, h: number, rgb: [number, number, number]): RgbaImage {
  const img = makeImage(w, h)
  for (let i = 0; i < w * h; i++) img.data.set([...rgb, 255], i * 4)
  return img
}

function alphaRows(img: RgbaImage): string[] {
  const rows: string[] = []
  for (let y = 0; y < img.height; y++) {
    let s = ''
    for (let x = 0; x < img.width; x++) s += img.data[(y * img.width + x) * 4 + 3] ? '#' : '.'
    rows.push(s)
  }
  return rows
}

describe('padBottomCentred', () => {
  it('widens a tall subject to the frame aspect, centred horizontally', () => {
    // 2x8 into a 1:2 frame: 4 wide, the subject in cols 1-2
    const out = padBottomCentred(solid(2, 8, [10, 10, 10]), 1, 2)
    expect([out.width, out.height]).toEqual([4, 8])
    expect(alphaRows(out).every((r) => r === '.##.')).toBe(true)
  })

  it('heightens a wide subject with all the padding on top, so the feet stay on the last row', () => {
    // 6x2 into a 3:4 frame: 8 tall, the subject on the last two rows
    const out = padBottomCentred(solid(6, 2, [10, 10, 10]), 3, 4)
    expect([out.width, out.height]).toEqual([6, 8])
    expect(alphaRows(out)).toEqual([...Array(6).fill('......'), '######', '######'])
  })

  it('leaves a subject already at the aspect untouched in size', () => {
    const out = padBottomCentred(solid(3, 4, [1, 2, 3]), 3, 4)
    expect([out.width, out.height]).toEqual([3, 4])
    expect(Array.from(out.data.slice(0, 4))).toEqual([1, 2, 3, 255])
  })
})

describe('snapToKeys', () => {
  const pal = { L: '#1c1a26', J: '#6f7a8c', K: '#6f7a8c', S: '#f4cfa5' }

  it('maps each opaque pixel to the nearest colour of the listed keys only, transparent to "."', () => {
    const img = makeImage(3, 1)
    img.data.set([250, 210, 170, 255, 20, 20, 30, 255, 0, 0, 0, 0])
    expect(snapToKeys(img, 'LS', pal)).toEqual(['SL.'])
    // with S not listed, the skin pixel can only take a listed key
    expect(snapToKeys(img, 'LJ', pal)[0][0]).toBe('J')
  })

  it('gives a duplicate hex to the first listed key', () => {
    const img = solid(1, 1, [0x6f, 0x7a, 0x8c])
    expect(snapToKeys(img, 'JK', pal)).toEqual(['J'])
    expect(snapToKeys(img, 'KJ', pal)).toEqual(['K'])
  })

  it('refuses a key that is not in the palette', () => {
    expect(() => snapToKeys(solid(1, 1, [0, 0, 0]), 'LZ', pal)).toThrow(/Z/)
  })
})

describe('remapRows', () => {
  it('swaps keys only inside the row range (the trousers share the hair colour)', () => {
    expect(remapRows(['HhS', 'HhS', 'HhS'], [1, 2], 'Hh', 'Tt')).toEqual(['HhS', 'TtS', 'TtS'])
  })
})

describe('outlineToL', () => {
  it('turns every filled cell on the silhouette edge (next to clear or the frame edge) into L', () => {
    expect(outlineToL(['.....', '.JJJ.', '.JJJ.', '.JJJ.'])).toEqual(['.....', '.LLL.', '.LJL.', '.LLL.'])
  })

  it('keeps L cells already inside', () => {
    expect(outlineToL(['JJJ', 'JLJ', 'JJJ'])).toEqual(['LLL', 'LLL', 'LLL'])
  })
})

describe('closeOutline', () => {
  it('makes the first and last filled cell of each row L, leaving empty rows', () => {
    expect(closeOutline(['..JJS..', '.......', 'S'])).toEqual(['..LJL..', '.......', 'L'])
  })
})

describe('despeckleGrid', () => {
  it('gives a lone cell the key of its four agreeing neighbours, never touching L or the edge', () => {
    expect(despeckleGrid(['JJJ', 'JSJ', 'JJJ'])).toEqual(['JJJ', 'JJJ', 'JJJ'])
    expect(despeckleGrid(['JJJ', 'JLJ', 'JJJ'])).toEqual(['JJJ', 'JLJ', 'JJJ'])
    expect(despeckleGrid(['JSJ', 'JJJ'])).toEqual(['JSJ', 'JJJ'])
  })

  it('also clears a lone cell in a horizontal run (left and right agree, above and below differ)', () => {
    expect(despeckleGrid(['HHH', 'JSJ', 'TTT'])).toEqual(['HHH', 'JJJ', 'TTT'])
  })
})

describe('graftRows', () => {
  it('replaces the first rows with the head, keeping the rest', () => {
    expect(graftRows(['aaa', 'bbb', 'ccc'], ['xxx', 'yyy'])).toEqual(['xxx', 'yyy', 'ccc'])
  })

  it('refuses a head of a different width', () => {
    expect(() => graftRows(['aaa'], ['xx'])).toThrow()
  })
})

describe('setCells', () => {
  it("sets the manifest's touched cells [row, col, key] (an eye the downsample lost), leaving the rest", () => {
    expect(setCells(['SSS', 'SSS'], [[1, 0, 'E'], [0, 2, 'L']])).toEqual(['SSL', 'ESS'])
  })

  it('refuses a cell outside the frame or a key longer than one character', () => {
    expect(() => setCells(['SSS'], [[1, 0, 'E']])).toThrow()
    expect(() => setCells(['SSS'], [[0, 3, 'E']])).toThrow()
    expect(() => setCells(['SSS'], [[0, 0, 'EE']])).toThrow()
  })
})

describe('runCount', () => {
  it('counts the fills drawSprite issues: one per horizontal run of a non-clear key', () => {
    expect(runCount(['..LLJJL..', 'LJL'])).toBe(6)
  })
})

describe('spriteModule', () => {
  it('emits a generated, never hand-edited TS module exporting the frame as string[]', () => {
    const src = spriteModule('sprite/mangaka-idle', 'MANGAKA_IDLE_0', ['L.', 'LL'], ['grafted: anchor-head'])
    expect(src).toBe(
      '// Generated by `npm run art -- sprite/mangaka-idle` (scripts/pixelate.ts --sprite mode) from art/manifest.json.\n'
      + '// Never edit by hand: change the manifest entry or the raw sheet and regenerate.\n'
      + '// grafted: anchor-head\n'
      + 'export const MANGAKA_IDLE_0: string[] = [\n'
      + "  'L.', // 0\n"
      + "  'LL', // 1\n"
      + ']\n',
    )
  })
})

describe('anchoredPalette (0.11.0 C2: a sheet colour per key)', () => {
  const pal = { L: '#1c1a26', J: '#6f7a8c', W: '#f6f6f6' }

  it('compares each anchored key against the sheet colour it stands for, the rest against PAL', () => {
    const out = anchoredPalette(pal, 'LJW', { J: '#d8dce0' })
    expect(out).toEqual({ L: '#1c1a26', J: '#d8dce0', W: '#f6f6f6' })
    // a light grey hoodie snaps to J once J is anchored to it (without the anchor it is nearer W)
    const grey = solid(1, 1, [212, 214, 218])
    expect(snapToKeys(grey, 'LJW', pal)).toEqual(['W'])
    expect(snapToKeys(grey, 'LJW', out)).toEqual(['J'])
  })

  it('leaves PAL itself untouched', () => {
    anchoredPalette(pal, 'LJ', { J: '#000000' })
    expect(pal.J).toBe('#6f7a8c')
  })

  it('refuses an anchor for a key the entry does not list, or a colour that is not #rrggbb', () => {
    expect(() => anchoredPalette(pal, 'LJ', { W: '#ffffff' })).toThrow(/W/)
    expect(() => anchoredPalette(pal, 'LJ', { J: 'grey' })).toThrow(/J/)
  })
})

describe('placeInFrame (0.11.0 C2: a body fitted to a box under the anchor head)', () => {
  it('puts a smaller grid on the last rows of the frame, centred, the extra column on the right', () => {
    expect(placeInFrame(['LL', 'LL'], 5, 3)).toEqual(['.....', '.LL..', '.LL..'])
  })

  it('returns a grid already at the frame size unchanged', () => {
    expect(placeInFrame(['LJ', 'JL'], 2, 2)).toEqual(['LJ', 'JL'])
  })

  it('refuses a grid larger than the frame', () => {
    expect(() => placeInFrame(['LLL'], 2, 1)).toThrow()
    expect(() => placeInFrame(['L', 'L'], 1, 1)).toThrow()
  })
})
