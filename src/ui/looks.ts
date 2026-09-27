import type { GenreId, MagazineId } from '../sim'
/**
 * Shared assistant look palette: the studio canvas and the Staff modal's avatars index these by
 * `Assistant.look` (the engine draws 0..5), so the same person wears the same shirt everywhere.
 * Raw hex is deliberate here: these are sprite colours, not UI tokens, and must match the canvas.
 */
export const LOOK_SHIRTS = ['#3b6fd6', '#c94b4b', '#3fa66c', '#7c4dff', '#e07b39', '#2b8a9e'] as const
export const LOOK_HAIRS = ['#2b2140', '#5a3a1e', '#1b1b1b', '#7a2e2e', '#3b3b45', '#8c6a3f'] as const

if (import.meta.env.DEV && LOOK_SHIRTS.length !== LOOK_HAIRS.length) {
  console.warn('looks.ts: shirt and hair palettes differ in length')
}

/** A token colour family a cover, spine or magazine strip wears (`data-tone`, styled in app.css). */
export const TONES = ['accent', 'blue', 'gold', 'green', 'purple'] as const
export type Tone = (typeof TONES)[number]

/** The spine colour of a published work, by genre (History's cover column). */
export const GENRE_TONE: Record<GenreId, Tone> = {
  action: 'accent', romance: 'purple', comedy: 'gold', horror: 'blue', sports: 'green',
  fantasy: 'purple', mystery: 'blue', scifi: 'blue', slice: 'green', drama: 'accent',
}

/** The cover colour of each magazine (Submit's magazine strips). */
export const MAG_TONE: Record<MagazineId, Tone> = {
  'weekly-bolt': 'accent', 'monthly-petal': 'purple', 'ultra-seinen': 'blue', 'kids-comic': 'gold',
}
