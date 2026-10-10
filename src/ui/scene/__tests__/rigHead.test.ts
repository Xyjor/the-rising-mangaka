// The rig's head (0.11.0): pure data and its rules, node environment.
import { describe, expect, it } from 'vitest'
import { headRules, stampFace } from '../rig/assemble'
import { EDITOR_EYES, EDITOR_FACE_ART, EDITOR_HEAD, EYES, FACE_ART, FACE_BY_MOOD, HEAD, NEUTRAL_FACE, headWith } from '../rig/head'
import { PARTS } from '../rig/parts'
import { FACE_KEYS, MARK_KEYS, PAL, frameRules } from '../spriteCore'
import type { EyesId, MouthId } from '../rig/types'

const EYE_IDS: EyesId[] = ['open', 'blink', 'closed', 'ring', 'squint', 'happy']
const MOUTH_IDS: MouthId[] = ['closed', 'open', 'smile', 'frown', 'o']

describe('the rig head', () => {
  it('reports a slot that lies outside the head map, and nothing else for it', () => {
    const wide = { ...HEAD, slots: { ...HEAD.slots, mark: { x: 25, y: 0, w: 3, h: 5 } } }
    expect(headRules(wide, FACE_ART)).toEqual(['mark slot 25,0 3x5 lies outside the 27x22 head'])
    const low = { ...HEAD, slots: { ...HEAD.slots, mouth: { x: 10, y: 21, w: 4, h: 2 } } }
    expect(headRules(low, FACE_ART)).toEqual(['mouth slot 10,21 4x2 lies outside the 27x22 head'])
  })

  it('is 27 wide and 22 tall, its outline closed, its slots where the face and the mark go', () => {
    expect(HEAD.map).toHaveLength(22)
    expect(HEAD.map.every((row) => row.length === 27)).toBe(true)
    expect(frameRules(HEAD.map, 27, 22)).toEqual([])
    expect(HEAD.slots).toEqual({ eyes: { x: 4, y: 10, w: 16, h: 4 }, mouth: { x: 10, y: 15, w: 4, h: 2 }, mark: { x: 24, y: 0, w: 3, h: 5 } })
    expect(HEAD.anchors).toEqual({ neck: { x: 12, y: 21 } })
    expect(HEAD.map[21][12]).not.toBe('.')
  })

  it('closes its outline all round: no painted cell but L has a clear cell beside, above or below it', () => {
    const clear = (x: number, y: number) => y < 0 || y >= HEAD.map.length || x < 0 || x >= HEAD.map[y].length || HEAD.map[y][x] === '.'
    const open: string[] = []
    HEAD.map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '.' || row[x] === 'L') continue
        if (clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1)) open.push(`${row[x]} at ${x},${y}`)
      }
    })
    expect(open).toEqual([])
  })

  it('keeps the head in cols 0-23 and the mark slot\'s columns 24-26 clear on every row', () => {
    for (const row of HEAD.map) expect(row.slice(24)).toBe('...')
  })

  it('passes the head rules: face keys in the face slots, the neutral face there already, every drawing its slot\'s size', () => {
    expect(headRules(HEAD, FACE_ART)).toEqual([])
    expect(stampFace(HEAD, FACE_ART, NEUTRAL_FACE)).toEqual(HEAD.map)
    expect(NEUTRAL_FACE).toEqual({ eyes: 'open', mouth: 'closed', mark: 'none' })
  })

  it('draws every eyes and every mouth distinct, so each face reads apart', () => {
    expect(new Set(EYE_IDS.map((id) => FACE_ART.eyes[id].join('/'))).size).toBe(6)
    expect(new Set(MOUTH_IDS.map((id) => FACE_ART.mouths[id].join('/'))).size).toBe(5)
  })

  it('gives every mood its face', () => {
    expect(FACE_BY_MOOD).toEqual({
      neutral: { eyes: 'open', mouth: 'closed', mark: 'none' },
      happy: { eyes: 'happy', mouth: 'smile', mark: 'sparkle' },
      tired: { eyes: 'squint', mouth: 'frown', mark: 'sweat' },
      surprised: { eyes: 'ring', mouth: 'o', mark: 'bang' },
      sleepy: { eyes: 'closed', mouth: 'closed', mark: 'zee' },
    })
  })

  it('stamps a whole face, the mark in its slot beside the hair', () => {
    const tired = headWith(FACE_BY_MOOD.tired)
    expect(tired.slice(0, 5).map((row) => row.slice(24))).toEqual(FACE_ART.marks.sweat)
    expect(headWith(NEUTRAL_FACE)).toEqual(HEAD.map)
  })

  it('reports a face key out of place, a wrong-sized drawing and a mark slot that is not clear', () => {
    const bad = { ...HEAD, map: HEAD.map.map((row, r) => (r === 11 ? row.slice(0, 5) + 'H' + row.slice(6) : r === 2 ? row.slice(0, 25) + 'L' + row.slice(26) : row)) }
    expect(headRules(bad, FACE_ART)).toEqual(['eye slot row 11 col 5 is H, not a face key', 'mark slot row 2 col 25 is L, not clear', 'the eye slot does not hold the open eyes'])
    expect(headRules(HEAD, { ...FACE_ART, mouths: { ...FACE_ART.mouths, o: ['LL'] } })).toEqual(['mouth o is 2x1, not 4x2'])
    expect(headRules(HEAD, { ...FACE_ART, marks: { ...FACE_ART.marks, zee: ['LLL', 'S.L', '.L.', 'L..', 'LLL'] } })).toEqual(['mark zee has key S'])
  })

  it('reports a mouth slot that is not the closed mouth, and a clear cell in an eyes drawing', () => {
    const smiling = { ...HEAD, map: HEAD.map.map((row, r) => (r === 16 ? row.slice(0, 10) + 'SSSS' + row.slice(14) : row)) }
    expect(headRules(smiling, FACE_ART)).toEqual(['the mouth slot does not hold the closed mouth'])
    const holed = ['.'.repeat(16), ...FACE_ART.eyes.blink.slice(1)]
    expect(headRules(HEAD, { ...FACE_ART, eyes: { ...FACE_ART.eyes, blink: holed } })).toEqual(['eyes blink has key .'])
  })

  it('adds the mark keys to PAL in the 0.10 marks\' colours, and W\'s shade for paper', () => {
    expect([PAL.A, PAL.X, PAL.w]).toEqual(['#8fd3ff', '#f5b700', '#b8b2a5'])
    expect([FACE_KEYS, MARK_KEYS]).toEqual(['SsEWMBL', 'LWAX'])
  })
})

describe('the editor\'s head (0.12.0, task 3)', () => {
  const RIMS = [0, 6, 9, 15]

  it('is a 27x22 head with HEAD\'s slots and neck, its outline closed, the mark slot clear, in PARTS as editor-head', () => {
    expect(EDITOR_HEAD.map).toHaveLength(22)
    expect(EDITOR_HEAD.map.every((row) => row.length === 27)).toBe(true)
    expect(frameRules(EDITOR_HEAD.map, 27, 22)).toEqual([])
    expect(EDITOR_HEAD.slots).toEqual(HEAD.slots)
    expect(EDITOR_HEAD.anchors).toEqual({ neck: { x: 12, y: 21 } })
    for (const row of EDITOR_HEAD.map) expect(row.slice(24)).toBe('...')
    expect(PARTS['editor-head']).toBe(EDITOR_HEAD)
    expect(EDITOR_HEAD.map).not.toEqual(HEAD.map)
  })

  it('passes the head rules with its own eyes: the slot holds the editor\'s open eyes, the closed mouth', () => {
    expect(headRules(EDITOR_HEAD, EDITOR_FACE_ART)).toEqual([])
    expect(EDITOR_FACE_ART).toEqual({ eyes: EDITOR_EYES, mouths: FACE_ART.mouths, marks: FACE_ART.marks })
    expect(stampFace(EDITOR_HEAD, EDITOR_FACE_ART, NEUTRAL_FACE)).toEqual(EDITOR_HEAD.map)
  })

  it('wears square glasses: the top and bottom edges on rows 9 and 14 either side of the bridge, the rims in every eyes drawing', () => {
    for (const r of [9, 14]) {
      expect(EDITOR_HEAD.map[r].slice(4, 11), `row ${r}`).toBe('LLLLLLL')
      expect(EDITOR_HEAD.map[r].slice(13, 20), `row ${r}`).toBe('LLLLLLL')
      expect(EDITOR_HEAD.map[r].slice(11, 13), `row ${r} between the lenses`).toBe('SS')
    }
    for (const id of EYE_IDS) {
      const eyes = EDITOR_EYES[id]
      eyes.forEach((row, r) => {
        expect(row).toHaveLength(16)
        for (const c of RIMS) expect(row[c], `${id} row ${r} col ${c}`).toBe('L')
        expect(row.slice(7, 9), `${id} row ${r} bridge`).toBe(r === 1 ? 'LL' : 'SS')
        // inside each lens the mangaka's drawing of the same id
        expect(row.slice(1, 6), `${id} row ${r} left lens`).toBe(EYES[id][r].slice(1, 6))
        expect(row.slice(10, 15), `${id} row ${r} right lens`).toBe(EYES[id][r].slice(10, 15))
      })
    }
    expect(EDITOR_EYES.open).toEqual(['LSSEESLSSLSEESSL', 'LSWEESLLLLSWEESL', 'LSEEESLSSLSEEESL', 'LSEEESLSSLSEEESL'])
    expect(new Set(EYE_IDS.map((id) => EDITOR_EYES[id].join('/'))).size).toBe(6)
  })

  it('parts the hair and keeps the forehead clear of it: hair on rows 1-8 only, a parting of shade down the crown', () => {
    for (let r = 9; r < 22; r++) expect(EDITOR_HEAD.map[r].slice(4, 20), `row ${r}`).not.toMatch(/[Hh]/)
    for (let r = 2; r <= 7; r++) expect(EDITOR_HEAD.map[r][10], `row ${r} parting`).toBe('h')
    expect(EDITOR_HEAD.map.slice(1, 9).join('')).toContain('H')
  })

  it('stamps a face into the editor\'s head through headWith', () => {
    expect(headWith(NEUTRAL_FACE, EDITOR_HEAD, EDITOR_FACE_ART)).toEqual(EDITOR_HEAD.map)
    const blink = headWith({ eyes: 'blink', mouth: 'closed', mark: 'none' }, EDITOR_HEAD, EDITOR_FACE_ART)
    expect(blink.slice(10, 14).map((row) => row.slice(4, 20))).toEqual(EDITOR_EYES.blink)
    expect(headWith(NEUTRAL_FACE)).toEqual(HEAD.map)
  })
})
