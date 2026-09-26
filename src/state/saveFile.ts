// The save file: a career written out to carry between computers or keep as a backup, and read back strictly. The
// browser's own save (store.ts) and this file share the version and the trimmed log.
import { describeDate, getPhase, tick } from '../sim'
import type { GameState } from '../sim'
import { upgradeSave } from '../sim/migrate'

/** The shape of the saved game, in the browser and in a file. A save of another version is not loaded. */
export const SAVE_VERSION = 2
/** The log is trimmed to what the EventLog shows; the live state keeps the full log. */
export const SAVED_LOG_ENTRIES = 80
/** Marks a file as a Rising Mangaka save. */
export const SAVE_FILE_FORMAT = 'rising-mangaka-save'
/** A longer file is refused before it is parsed: a real save is far smaller. */
export const MAX_SAVE_FILE_CHARS = 5_000_000

/** What a save file carries. The theme and sound are this computer's, not the career's, so they stay behind. */
export interface SaveFile {
  game: GameState
  /** -1 when the player dismissed tips. */
  tutorialStep: number
  resumeSpeed: 1 | 2 | 3
}

/** Why a file was not loaded; the UI words each one. */
export type SaveFileError = 'not-json' | 'not-a-save' | 'too-old' | 'too-new' | 'damaged'

export type ParsedSave = { ok: true; save: SaveFile } | { ok: false; error: SaveFileError }

/** The game with its log cut to the entries a save keeps. */
export function trimLog(game: GameState): GameState {
  return { ...game, log: game.log.slice(-SAVED_LOG_ENTRIES) }
}

/** The file's text: the format, the version and the export time come first, so a person opening it sees what it is. */
function fileText(game: unknown, tutorialStep: unknown, resumeSpeed: unknown, now: Date): string {
  return JSON.stringify({
    format: SAVE_FILE_FORMAT, version: SAVE_VERSION, exportedAt: now.toISOString(), game, tutorialStep, resumeSpeed,
  })
}

/** Writes a save file. `now` stamps `exportedAt`. */
export function serializeSave(save: SaveFile, now: Date = new Date()): string {
  return fileText(trimLog(save.game), save.tutorialStep, save.resumeSpeed, now)
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Refuses a newer or older version by name; anything else that is not the current version is damage. */
function versionError(version: unknown): SaveFileError | null {
  if (version === SAVE_VERSION) return null
  if (typeof version !== 'number' || Number.isNaN(version)) return 'damaged'
  return version < SAVE_VERSION ? 'too-old' : 'too-new'
}

/** The fields every game has had since version 2, checked before the sim is let near it. */
function looksLikeGame(g: Record<string, unknown>): boolean {
  return (
    typeof g.seed === 'number' &&
    typeof g.worldSeed === 'number' &&
    typeof g.day === 'number' && Number.isFinite(g.day) && g.day >= 0 &&
    isObject(g.player) && typeof g.player.name === 'string' &&
    Array.isArray(g.log) &&
    Array.isArray(g.history)
  )
}

/**
 * Reads a save file strictly: the text must be a Rising Mangaka save of this version whose game the sim can upgrade and
 * run a day of. Fields a save predates are filled as a stored save's are (`upgradeSave`); a missing or broken tips step
 * reads as tips dismissed, and a speed other than 1, 2 or 3 as 1.
 */
export function parseSave(text: string): ParsedSave {
  const fail = (error: SaveFileError): ParsedSave => ({ ok: false, error })
  if (text.length > MAX_SAVE_FILE_CHARS) return fail('not-a-save')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail('not-json')
  }
  if (!isObject(data) || data.format !== SAVE_FILE_FORMAT || typeof data.version !== 'number') return fail('not-a-save')
  if (data.version < SAVE_VERSION) return fail('too-old')
  if (data.version > SAVE_VERSION) return fail('too-new')
  const raw = data.game
  if (!isObject(raw)) return fail('damaged')
  const gameVersion = versionError(raw.version)
  if (gameVersion) return fail(gameVersion)
  if (!looksLikeGame(raw)) return fail('damaged')
  let game: GameState
  try {
    game = upgradeSave(raw as unknown as GameState)
    // A probe: a game the sim cannot advance by a day would crash the studio the moment the clock ran.
    tick(game)
    getPhase(game)
  } catch {
    return fail('damaged')
  }
  const step = data.tutorialStep
  const speed = data.resumeSpeed
  return {
    ok: true,
    save: {
      game,
      tutorialStep: typeof step === 'number' && Number.isInteger(step) ? step : -1,
      resumeSpeed: speed === 1 || speed === 2 || speed === 3 ? speed : 1,
    },
  }
}

/** A pen name as it can sit in a file name: accents dropped, lowercase, a hyphen per gap, nothing but a-z and 0-9. */
function slug(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'save'
}

/** 'rising-mangaka-rin-hoshino-year-2-month-1.json': the pen name and the in-game date, the year only after the first. */
export function saveFileName(name: string, day: number): string {
  const { year, month } = describeDate(day)
  return `rising-mangaka-${slug(name)}-${year > 1 ? `year-${year}-` : ''}month-${month}.json`
}

/**
 * The save kept in storage (the persisted store's JSON, `raw`) as a save file, for the recovery screen: the store may be
 * what broke, so this reads storage and writes out whatever game is there, unchecked. Null when there is no game.
 */
export function storedSaveFile(raw: string | null, now: Date = new Date()): { fileName: string; text: string } | null {
  let state: unknown
  try {
    state = raw === null ? null : (JSON.parse(raw) as { state?: unknown }).state
  } catch {
    return null
  }
  if (!isObject(state) || !isObject(state.game)) return null
  const game = state.game
  const player = game.player
  const name = isObject(player) && typeof player.name === 'string' ? player.name : ''
  const day = typeof game.day === 'number' && Number.isFinite(game.day) && game.day >= 0 ? game.day : 0
  return { fileName: saveFileName(name, day), text: fileText(game, state.tutorialStep, state.resumeSpeed, now) }
}
