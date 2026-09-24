// Short words the pitch, offer and series screens share. Pure functions of sim data, no React.
import { audienceById, genreById, themeById } from '../sim'
import type { AudienceId, GenreId, ThemeId } from '../sim'

/** How a magazine's rivals feel, from its typical rival score. */
export function rivalWord(mean: number): string {
  return mean >= 60 ? 'Fierce' : mean >= 50 ? 'Tough' : 'Friendly'
}

/** A plain word for a 0..1 chance. */
export function oddsWord(chance: number): string {
  return chance < 0.1 ? 'a long shot' : chance < 0.4 ? 'possible' : 'likely'
}

/** "Action, Samurai, for Teens" */
export function comboLabel(genre: GenreId, theme: ThemeId, audience: AudienceId): string {
  return `${genreById(genre).name}, ${themeById(theme).name}, for ${audienceById(audience).name}`
}
