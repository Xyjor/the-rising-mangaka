// Short words the pitch, offer, series, desk and stats screens share. Pure functions of sim data, no React.
import { MAGAZINES, SERIAL_WARNINGS_TO_CANCEL, audienceById, genreById, magazineById, suitedFocus, themeById } from '../sim'
import type { AudienceId, GenreId, MagazineId, ScoreBreakdown, ThemeId } from '../sim'
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

/** "35%" when every value is the same, else "15% to 35%". */
function pctSpan(values: number[]): string {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return lo === hi ? `${lo}%` : `${lo}% to ${hi}%`
}

/** "A", "A and B", "A, B and C" */
function andList(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** How much a poll component weighs across the magazines: "15% to 35% depending on the magazine". */
export function weightSpan(k: keyof ScoreBreakdown): string {
  const values = MAGAZINES.map((m) => m.taste[k])
  return Math.min(...values) === Math.max(...values)
    ? `${pctSpan(values)} in every magazine`
    : `${pctSpan(values)} depending on the magazine`
}

/**
 * Which drawing focus suits which magazine, from each magazine's taste. While a serial runs only its magazine
 * matters, so the hint names that one.
 */
export function focusHint(serialMagazine: MagazineId | null): string {
  if (serialMagazine) {
    const m = magazineById(serialMagazine)
    const focus = { art: 'Art', story: 'Story', balanced: 'Balanced' }[suitedFocus(m.taste)]
    return `${focus} focus suits ${m.name} (art ${m.taste.art}%, story ${m.taste.story}%), where your serial runs.`
  }
  const suits = (focus: 'art' | 'story', label: string): string => {
    const mags = MAGAZINES.filter((m) => suitedFocus(m.taste) === focus)
    if (!mags.length) return ''
    return `${label} focus suits ${andList(mags.map((m) => m.name))} (${focus} ${pctSpan(mags.map((m) => m.taste[focus]))}).`
  }
  return [suits('art', 'Art'), suits('story', 'Story')].filter(Boolean).join(' ')
}
