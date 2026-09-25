// Short words the pitch, offer and series screens share. Pure functions of sim data, no React.
import { SERIAL_WARNINGS_TO_CANCEL, audienceById, genreById, themeById } from '../sim'
import type { AudienceId, GenreId, ThemeId } from '../sim'
import { plural } from './format'

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

/** The serial-status warning line: safe, a countdown, or the last-chance message. */
export function warningText(warnings: number): string {
  if (warnings === 0) return 'Safe'
  if (warnings === SERIAL_WARNINGS_TO_CANCEL - 1) return 'One more weak chapter cancels it'
  const left = SERIAL_WARNINGS_TO_CANCEL - warnings
  return `${plural(warnings, 'warning')}. ${plural(left, 'more weak chapter')} in a row cancel it`
}
