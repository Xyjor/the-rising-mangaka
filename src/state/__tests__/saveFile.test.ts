import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { addLog, createGame, startProject, tickMany } from '../../sim'
import type { GameState } from '../../sim'
import {
  MAX_SAVE_FILE_CHARS, SAVED_LOG_ENTRIES, SAVE_FILE_FORMAT, SAVE_VERSION, parseSave, saveFileName, serializeSave,
  storedSaveFile, trimLog,
} from '../saveFile'
import type { SaveFileError } from '../saveFile'
import { DRAFT, drawUntilReady, withPendingResult } from '../../test/fixtures'

const NOW = new Date('2026-09-25T12:00:00.000Z')

/** A valid save file of a fresh career, as a plain object a test can break before writing it out. */
function fileObject(): Record<string, unknown> & { game: Record<string, unknown> } {
  return JSON.parse(serializeSave({ game: createGame('Rin', 42), tutorialStep: 0, resumeSpeed: 1 }, NOW))
}

/** `fileObject()` with `edit` applied, as the text of a file. */
function fileWith(edit: (f: ReturnType<typeof fileObject>) => void): string {
  const f = fileObject()
  edit(f)
  return JSON.stringify(f)
}

const errorOf = (text: string): SaveFileError | null => {
  const r = parseSave(text)
  return r.ok ? null : r.error
}

describe('save file constants', () => {
  it('match the persisted save and the file format', () => {
    expect(SAVE_VERSION).toBe(2)
    expect(SAVED_LOG_ENTRIES).toBe(80)
    expect(SAVE_FILE_FORMAT).toBe('rising-mangaka-save')
    expect(MAX_SAVE_FILE_CHARS).toBe(5_000_000)
  })
})

describe('serializeSave', () => {
  it('writes the format, the version and the export time before the game', () => {
    const text = serializeSave({ game: createGame('Rin', 42), tutorialStep: -1, resumeSpeed: 2 }, NOW)
    expect(text.startsWith(
      '{"format":"rising-mangaka-save","version":2,"exportedAt":"2026-09-25T12:00:00.000Z","game":{',
    )).toBe(true)
  })

  it('keeps the last 80 log entries, as the save in the browser does', () => {
    let g = createGame('Rin', 42)
    for (let i = 1; i <= 120; i++) g = addLog(g, 'info', `Entry ${i}`, false)
    const written = JSON.parse(serializeSave({ game: g, tutorialStep: 0, resumeSpeed: 1 }, NOW)) as { game: GameState }
    expect(written.game.log).toHaveLength(80)
    expect(written.game.log[0].text).toBe('Entry 41')
    expect(written.game.log[79].text).toBe('Entry 120')
    // The live game keeps its whole log.
    expect(g.log).toHaveLength(121)
  })
})

describe('trimLog', () => {
  it('keeps the last 80 entries and leaves the rest of the game alone', () => {
    let g = createGame('Rin', 42)
    for (let i = 1; i <= 100; i++) g = addLog(g, 'info', `Entry ${i}`, false)
    const t = trimLog(g)
    expect(t.log).toHaveLength(80)
    expect(t.log[0].text).toBe('Entry 21')
    expect({ ...t, log: [] }).toEqual({ ...g, log: [] })
  })
})

describe('parseSave: round trips', () => {
  it('reads back a fresh career with its tutorial step and speed', () => {
    const text = serializeSave({ game: createGame('Rin', 42), tutorialStep: -1, resumeSpeed: 2 }, NOW)
    expect(parseSave(text)).toEqual({
      ok: true, save: { game: createGame('Rin', 42), tutorialStep: -1, resumeSpeed: 2 },
    })
  })

  it('reads back a career 30 days in, with the log trimmed as it was written', () => {
    const g = tickMany(createGame('Rin', 42), 30)
    const r = parseSave(serializeSave({ game: g, tutorialStep: 9, resumeSpeed: 3 }, NOW))
    expect(r).toEqual({ ok: true, save: { game: trimLog(g), tutorialStep: 9, resumeSpeed: 3 } })
  })

  it('reads back a long log as its last 80 entries', () => {
    let g = createGame('Rin', 42)
    for (let i = 1; i <= 120; i++) g = addLog(g, 'info', `Entry ${i}`, false)
    const r = parseSave(serializeSave({ game: g, tutorialStep: 0, resumeSpeed: 1 }, NOW))
    if (!r.ok) throw new Error(r.error)
    expect(r.save.game.log).toHaveLength(80)
    expect(r.save.game.log[0].text).toBe('Entry 41')
  })

  it('fills the fields an older export lacks with their defaults', () => {
    const text = fileWith((f) => {
      delete f.game.recovering
      delete f.game.trip
      delete (f.game.player as Record<string, unknown>).fans
    })
    const r = parseSave(text)
    if (!r.ok) throw new Error(r.error)
    expect(r.save.game.recovering).toBe(false)
    expect(r.save.game.trip).toBeNull()
    expect(r.save.game.player.fans).toBe(0)
    expect(r.save.game.player.name).toBe('Rin')
  })

  it('reads a missing or broken tutorial step as the tutorial done', () => {
    const missing = parseSave(fileWith((f) => { delete f.tutorialStep }))
    const fraction = parseSave(fileWith((f) => { f.tutorialStep = 1.5 }))
    const text = parseSave(fileWith((f) => { f.tutorialStep = '2' }))
    expect([missing, fraction, text].map((r) => r.ok && r.save.tutorialStep)).toEqual([-1, -1, -1])
    expect(parseSave(fileWith((f) => { f.tutorialStep = 9 }))).toMatchObject({ ok: true, save: { tutorialStep: 9 } })
  })

  it('resumes step 6 (the pitch window, not saved) at step 5, the pitch button', () => {
    const g = drawUntilReady(startProject(createGame('Rin', 42), DRAFT))
    const r = parseSave(serializeSave({ game: g, tutorialStep: 6, resumeSpeed: 1 }, NOW))
    expect(r).toEqual({ ok: true, save: { game: trimLog(g), tutorialStep: 5, resumeSpeed: 1 } })
  })

  it('keeps step 7 for a save written with the poll result waiting', () => {
    const g = withPendingResult()
    const r = parseSave(serializeSave({ game: g, tutorialStep: 7, resumeSpeed: 1 }, NOW))
    expect(r).toEqual({ ok: true, save: { game: trimLog(g), tutorialStep: 7, resumeSpeed: 1 } })
  })

  it('resumes the tutorial step against the saved game', () => {
    // Step 4 (the clock) belongs to a drawing game; a fresh career has no later idle step, so the tutorial ends.
    expect(parseSave(fileWith((f) => { f.tutorialStep = 4 }))).toMatchObject({ ok: true, save: { tutorialStep: -1 } })
    const played = tickMany(createGame('Rin', 42), 40)
    expect(parseSave(serializeSave({ game: played, tutorialStep: 0, resumeSpeed: 1 }, NOW)))
      .toMatchObject({ ok: true, save: { tutorialStep: -1 } })
  })

  it('reads a speed other than 1, 2 or 3 as 1', () => {
    const seven = parseSave(fileWith((f) => { f.resumeSpeed = 7 }))
    const text = parseSave(fileWith((f) => { f.resumeSpeed = '2' }))
    const missing = parseSave(fileWith((f) => { delete f.resumeSpeed }))
    expect([seven, text, missing].map((r) => r.ok && r.save.resumeSpeed)).toEqual([1, 1, 1])
    expect(parseSave(fileWith((f) => { f.resumeSpeed = 3 }))).toMatchObject({ ok: true, save: { resumeSpeed: 3 } })
  })

  it('carries no theme: a file with one loads without it', () => {
    const r = parseSave(fileWith((f) => { f.theme = 'dark' }))
    if (!r.ok) throw new Error(r.error)
    expect(Object.keys(r.save).sort()).toEqual(['game', 'resumeSpeed', 'tutorialStep'])
  })
})

describe('parseSave: refusals', () => {
  it('not-json: text that does not parse', () => {
    expect(errorOf('')).toBe('not-json')
    expect(errorOf('hello')).toBe('not-json')
    expect(errorOf('{"format":"rising-mangaka-save"')).toBe('not-json')
  })

  it('not-a-save: JSON that is not a Rising Mangaka save file', () => {
    expect(errorOf('null')).toBe('not-a-save')
    expect(errorOf('42')).toBe('not-a-save')
    expect(errorOf('"rising-mangaka-save"')).toBe('not-a-save')
    expect(errorOf('[]')).toBe('not-a-save')
    expect(errorOf(fileWith((f) => { f.format = 'other-game-save' }))).toBe('not-a-save')
    expect(errorOf(fileWith((f) => { delete f.format }))).toBe('not-a-save')
    expect(errorOf(fileWith((f) => { f.version = '2' }))).toBe('not-a-save')
    expect(errorOf(fileWith((f) => { delete f.version }))).toBe('not-a-save')
  })

  it('not-a-save: a file longer than 5,000,000 characters, before any parsing', () => {
    // Blank space parses as a JSON error, so only the length check makes this not-a-save.
    expect(errorOf(' '.repeat(5_000_001))).toBe('not-a-save')
  })

  it('too-old and too-new: by the file version, then by the game version', () => {
    expect(errorOf(fileWith((f) => { f.version = 1 }))).toBe('too-old')
    expect(errorOf(fileWith((f) => { f.version = 3 }))).toBe('too-new')
    expect(errorOf(fileWith((f) => { f.game.version = 1 }))).toBe('too-old')
    expect(errorOf(fileWith((f) => { f.game.version = 3 }))).toBe('too-new')
    // The file version is read first.
    expect(errorOf(fileWith((f) => { f.version = 3; f.game.version = 1 }))).toBe('too-new')
  })

  it('damaged: the game is missing or not a game', () => {
    expect(errorOf(fileWith((f) => { f.game = null as never }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { delete (f as Record<string, unknown>).game }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { f.game = 'a career' as never }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { delete f.game.version }))).toBe('damaged')
  })

  it('damaged: the shape check (seeds, day, name, log, history)', () => {
    expect(errorOf(fileWith((f) => { delete f.game.seed }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { f.game.worldSeed = '42' }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { f.game.day = -1 }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { f.game.day = null }))).toBe('damaged')
    // JSON has no Infinity, but 1e999 parses to it.
    expect(errorOf(fileWith((f) => { f.game.day = -12345 }).replace('"day":-12345', '"day":1e999'))).toBe('damaged')
    expect(errorOf(fileWith((f) => { delete f.game.player }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { (f.game.player as Record<string, unknown>).name = 7 }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { f.game.log = {} }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { delete f.game.history }))).toBe('damaged')
  })

  it('damaged: a game the sim cannot upgrade or run a day of', () => {
    // upgradeSave maps the serials; tick walks the anime deals.
    expect(errorOf(fileWith((f) => { f.game.serials = 7 }))).toBe('damaged')
    expect(errorOf(fileWith((f) => { f.game.anime = null }))).toBe('damaged')
  })
})

describe('saveFileName', () => {
  it('names the file after the pen name and the date, year 1 left out', () => {
    expect(saveFileName('Rin Hoshino', 336)).toBe('rising-mangaka-rin-hoshino-year-2-month-1.json')
    expect(saveFileName('', 0)).toBe('rising-mangaka-save-month-1.json')
    expect(saveFileName('Élodie', 0)).toBe('rising-mangaka-elodie-month-1.json')
  })

  it('drops what a file name should not carry, and falls back to "save" when nothing is left', () => {
    expect(saveFileName('  Rin   Hoshino  ', 56)).toBe('rising-mangaka-rin-hoshino-month-3.json')
    expect(saveFileName("O'Brien #1", 0)).toBe('rising-mangaka-obrien-1-month-1.json')
    expect(saveFileName('星野', 0)).toBe('rising-mangaka-save-month-1.json')
  })

  it('drops accents whether the name arrives composed or already decomposed', () => {
    expect(saveFileName('Zoë Núñez', 0)).toBe('rising-mangaka-zoe-nunez-month-1.json')
    expect(saveFileName('E\u0301lodie', 0)).toBe('rising-mangaka-elodie-month-1.json')
  })

  it('keeps its own source free of invisible marks: the accent pattern is written as an escape', () => {
    const source = readFileSync(fileURLToPath(new URL('../saveFile.ts', import.meta.url)), 'utf8')
    expect(source).toContain(String.raw`/\p{M}/gu`)
    expect([...source].filter((c) => /\p{M}/u.test(c))).toEqual([])
  })
})

describe('storedSaveFile (the recovery screen reads the save from storage)', () => {
  const stored = (state: Record<string, unknown>) => JSON.stringify({ version: 2, state })

  it('turns the stored save into a file that loads', () => {
    const game = tickMany(createGame('Rin Hoshino', 42), 30)
    const out = storedSaveFile(
      stored({ game: trimLog(game), theme: 'dark', resumeSpeed: 3, tutorialStep: -1, sound: {} }),
      NOW,
    )
    expect(out?.fileName).toBe('rising-mangaka-rin-hoshino-month-2.json')
    expect(out?.text.startsWith(
      '{"format":"rising-mangaka-save","version":2,"exportedAt":"2026-09-25T12:00:00.000Z","game":{',
    )).toBe(true)
    expect(parseSave(out!.text)).toEqual({ ok: true, save: { game: trimLog(game), tutorialStep: -1, resumeSpeed: 3 } })
  })

  it('is null when there is no stored game to export', () => {
    expect(storedSaveFile(null, NOW)).toBeNull()
    expect(storedSaveFile('not json', NOW)).toBeNull()
    expect(storedSaveFile(stored({ game: null, theme: 'auto' }), NOW)).toBeNull()
    expect(storedSaveFile(JSON.stringify({ version: 2 }), NOW)).toBeNull()
  })

  it('still exports a stored game too broken to name, under a plain name', () => {
    const out = storedSaveFile(stored({ game: { version: 2, player: null, day: 'soon' } }), NOW)
    expect(out?.fileName).toBe('rising-mangaka-save-month-1.json')
    expect(JSON.parse(out!.text).game).toEqual({ version: 2, player: null, day: 'soon' })
  })
})
