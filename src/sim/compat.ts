import { hashString } from './rng'
import type { AudienceId, GenreId, Rating, ThemeId } from './types'

// Hand-authored "obvious" pairings. Everything else is hashed from the world seed
// so each playthrough has its own secrets to discover.

const GENRE_THEME_OVERRIDES: Record<string, Rating> = {
  'mystery|detective': 4,
  'horror|vampires': 4,
  'scifi|space': 4,
  'fantasy|magic': 4,
  'action|ninja': 3,
  'action|samurai': 3,
  'action|pirates': 3,
  'romance|school': 3,
  'scifi|robots': 3,
  'slice|cooking': 3,
  'drama|music': 3,
  'comedy|school': 2,
  'sports|school': 2,
  'romance|idols': 3,
  'horror|cooking': 0,
  'romance|robots': 1,
  'sports|vampires': 0,
  'slice|space': 1,
}

const THEME_AUDIENCE_OVERRIDES: Record<string, Rating> = {
  'idols|teens': 3,
  'school|teens': 3,
  'pirates|kids': 3,
  'robots|kids': 3,
  'magic|kids': 3,
  'detective|adults': 3,
  'samurai|adults': 2,
  'cooking|adults': 2,
  'vampires|kids': 0,
  'idols|adults': 1,
  'space|teens': 2,
  'music|young-adults': 3,
}

/** Map a unit float to a rating using the design distribution. */
function ratingFromUnit(u: number): Rating {
  if (u < 0.15) return 0
  if (u < 0.4) return 1
  if (u < 0.7) return 2
  if (u < 0.9) return 3
  return 4
}

export function genreThemeKey(genre: GenreId, theme: ThemeId): string {
  return `${genre}|${theme}`
}

export function themeAudienceKey(theme: ThemeId, audience: AudienceId): string {
  return `${theme}|${audience}`
}

export function genreThemeRating(worldSeed: number, genre: GenreId, theme: ThemeId): Rating {
  const key = genreThemeKey(genre, theme)
  const override = GENRE_THEME_OVERRIDES[key]
  if (override !== undefined) return override
  const h = hashString(`gt:${worldSeed}:${key}`)
  return ratingFromUnit(h / 4294967296)
}

export function themeAudienceRating(worldSeed: number, theme: ThemeId, audience: AudienceId): Rating {
  const key = themeAudienceKey(theme, audience)
  const override = THEME_AUDIENCE_OVERRIDES[key]
  if (override !== undefined) return override
  const h = hashString(`ta:${worldSeed}:${key}`)
  return ratingFromUnit(h / 4294967296)
}
