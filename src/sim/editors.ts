// Editors and the Notebook reveals they share with trips: `revealCell` (a random unknown pairing, one draw from the
// main seed), `bumpEditor` (the relationship and the persona's tip cadence, `Magazine.tipEvery`) and
// `revealUndrawnGenre` (the Manga Museum's deterministic pick, no RNG). Shared by engine.ts and events.ts, so neither
// imports the other. No imports from engine.ts.
import { genreThemeKey, genreThemeRating, themeAudienceKey, themeAudienceRating } from './compat'
import { addLog } from './core'
import { AUDIENCES, GENRES, RATING_LABEL, THEMES, audienceById, genreById, magazineById, themeById } from './data'
import { draw } from './rng'
import type { AudienceId, GameState, GenreId, MagazineId, ThemeId } from './types'

/**
 * Reveal one unknown pairing. With `fromEvent` false (trips, results) it is picked at random with one draw from the
 * main seed; with `fromEvent` true (a tip earned by answering a random event) it is the first unknown one in table
 * order and no RNG is drawn, so events never move the main `seed` stream.
 */
export function revealCell(
  state: GameState, kind: 'gt' | 'ta', audience?: AudienceId, fromEvent = false,
): { state: GameState; text: string | null } {
  let s = state
  let pick = 0
  if (!fromEvent) {
    const { values, seed } = draw(state.seed, 1)
    s = { ...state, seed }
    pick = values[0]
  }
  if (kind === 'gt') {
    const unknown: [GenreId, ThemeId][] = []
    for (const g of GENRES) for (const t of THEMES) {
      if (s.notebook.genreTheme[genreThemeKey(g.id, t.id)] === undefined) unknown.push([g.id, t.id])
    }
    if (!unknown.length) return { state: s, text: null }
    const [g, t] = unknown[Math.floor(pick * unknown.length)]
    return revealGenreTheme(s, g, t)
  }
  const auds = audience ? [audienceById(audience)] : AUDIENCES
  const unknown: [ThemeId, AudienceId][] = []
  for (const t of THEMES) for (const a of auds) {
    if (s.notebook.themeAudience[themeAudienceKey(t.id, a.id)] === undefined) unknown.push([t.id, a.id])
  }
  if (!unknown.length) return { state: s, text: null }
  const [t, a] = unknown[Math.floor(pick * unknown.length)]
  const r = themeAudienceRating(s.worldSeed, t, a)
  s = { ...s, notebook: { ...s.notebook, themeAudience: { ...s.notebook.themeAudience, [themeAudienceKey(t, a)]: r } } }
  return { state: s, text: `${themeById(t).name} for ${audienceById(a).name} is ${RATING_LABEL[r]}` }
}

function revealGenreTheme(s: GameState, g: GenreId, t: ThemeId): { state: GameState; text: string } {
  const r = genreThemeRating(s.worldSeed, g, t)
  const next = { ...s, notebook: { ...s.notebook, genreTheme: { ...s.notebook.genreTheme, [genreThemeKey(g, t)]: r } } }
  return { state: next, text: `${genreById(g).name} × ${themeById(t).name} is ${RATING_LABEL[r]}` }
}

/** Every genre the player has drawn: one-shots and serials. */
function drawnGenres(s: GameState): Set<GenreId> {
  const serials = s.serial ? [...s.serials, s.serial] : s.serials
  return new Set<GenreId>([...s.history.map((h) => h.genre), ...serials.map((x) => x.genre), ...(s.project ? [s.project.genre] : [])])
}

/**
 * The Manga Museum's reveal, with no RNG: the first genre (GENRES order) never drawn that still has an unknown theme
 * pairing, with its first unknown theme (THEMES order). When every such genre is known, the first unknown pairing of
 * any genre; null text when the whole genre x theme grid is known.
 */
export function revealUndrawnGenre(s: GameState): { state: GameState; text: string | null } {
  const drawn = drawnGenres(s)
  const unknownTheme = (g: GenreId) => THEMES.find((t) => s.notebook.genreTheme[genreThemeKey(g, t.id)] === undefined)
  for (const pass of [true, false]) {
    for (const g of GENRES) {
      if (pass && drawn.has(g.id)) continue
      const t = unknownTheme(g.id)
      if (t) return revealGenreTheme(s, g.id, t.id)
    }
  }
  return { state: s, text: null }
}

/**
 * Raise an editor's relationship by `amount`. Every `tipEvery` points (the persona's cadence: Sato 2, Kuroda 4, the
 * others 3) the editor reveals a theme x audience pairing for the magazine's readers (one draw from the main seed, or
 * none for a bump from a random event: see `revealCell`).
 */
export function bumpEditor(state: GameState, magazineId: MagazineId, amount: number, fromEvent = false): GameState {
  const mag = magazineById(magazineId)
  const rel = state.editors[magazineId]
  const relationship = rel.relationship + amount
  let s: GameState = { ...state, editors: { ...state.editors, [magazineId]: { ...rel, relationship } } }
  const owed = Math.floor(relationship / mag.tipEvery)
  if (owed > rel.tips) {
    const revealed = revealCell(s, 'ta', mag.audience, fromEvent)
    s = revealed.state
    s = { ...s, editors: { ...s.editors, [magazineId]: { relationship, tips: owed } } }
    if (revealed.text) {
      s = addLog(s, 'info', `${mag.editor} at ${mag.name} passes on a tip: ${revealed.text}. Noted in your Notebook.`, true)
    }
  }
  return s
}
