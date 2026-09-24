import type {
  AssistantTrait, Audience, AudienceId, Genre, GenreId, Magazine, MagazineId, Place, PlaceId, Theme, ThemeId,
} from './types'

export const GENRES: Genre[] = [
  { id: 'action', name: 'Action', blurb: 'Fights, chases, and big set pieces.' },
  { id: 'romance', name: 'Romance', blurb: 'Hearts, confessions, and slow burns.' },
  { id: 'comedy', name: 'Comedy', blurb: 'Gags, timing, and running jokes.' },
  { id: 'horror', name: 'Horror', blurb: 'Dread, shadows, and things in the dark.' },
  { id: 'sports', name: 'Sports', blurb: 'Training arcs and championship finals.' },
  { id: 'fantasy', name: 'Fantasy', blurb: 'Other worlds, quests, and lore.' },
  { id: 'mystery', name: 'Mystery', blurb: 'Clues, suspects, and reveals.' },
  { id: 'scifi', name: 'Sci-Fi', blurb: 'Tech, futures, and big ideas.' },
  { id: 'slice', name: 'Slice of Life', blurb: 'Small moments that add up.' },
  { id: 'drama', name: 'Drama', blurb: 'Conflict, growth, and consequences.' },
]

export const THEMES: Theme[] = [
  { id: 'school', name: 'School', blurb: 'Classrooms, clubs, and festivals.' },
  { id: 'pirates', name: 'Pirates', blurb: 'Crews, treasure, and open seas.' },
  { id: 'ninja', name: 'Ninja', blurb: 'Shadows, clans, and secret arts.' },
  { id: 'cooking', name: 'Cooking', blurb: 'Kitchens, rivals, and perfect dishes.' },
  { id: 'music', name: 'Music', blurb: 'Bands, stages, and the big gig.' },
  { id: 'robots', name: 'Robots', blurb: 'Mechs, AIs, and steel hearts.' },
  { id: 'vampires', name: 'Vampires', blurb: 'Fangs, night, and old bargains.' },
  { id: 'detective', name: 'Detective', blurb: 'Cases, alibis, and the final deduction.' },
  { id: 'space', name: 'Space', blurb: 'Stars, ships, and the void.' },
  { id: 'idols', name: 'Idols', blurb: 'Debuts, fans, and the spotlight.' },
  { id: 'samurai', name: 'Samurai', blurb: 'Blades, honour, and old Japan.' },
  { id: 'magic', name: 'Magic', blurb: 'Spells, academies, and forbidden tomes.' },
]

export const AUDIENCES: Audience[] = [
  { id: 'kids', name: 'Kids', blurb: 'Bright, simple, and full of energy.' },
  { id: 'teens', name: 'Teens', blurb: 'Friendship, rivalry, and growing up.' },
  { id: 'young-adults', name: 'Young Adults', blurb: 'Ambition, romance, and identity.' },
  { id: 'adults', name: 'Adults', blurb: 'Nuance, weight, and grey areas.' },
]

export const MAGAZINES: Magazine[] = [
  {
    id: 'weekly-bolt', name: 'Weekly Bolt', audience: 'teens',
    pageRate: 110, circulation: 180, rivalMean: 58, entrants: 12,
    blurb: 'The big weekly. Twelve rivals in every poll and the biggest readership in town.', editor: 'Tanaka',
  },
  {
    id: 'monthly-petal', name: 'Monthly Petal', audience: 'young-adults',
    pageRate: 130, circulation: 90, rivalMean: 52, entrants: 8,
    blurb: 'A quieter book for young adults. Fewer rivals, a little more per page.', editor: 'Sato',
  },
  {
    id: 'ultra-seinen', name: 'Ultra Seinen', audience: 'adults',
    pageRate: 150, circulation: 70, rivalMean: 62, entrants: 8,
    blurb: 'Prestige anthology for grown-ups. Best page rate going, and the toughest rivals.', editor: 'Kuroda',
  },
  {
    id: 'kids-comic', name: 'Kids Comic Go!', audience: 'kids',
    pageRate: 90, circulation: 120, rivalMean: 45, entrants: 10,
    blurb: 'Bright, loud, and forgiving. The easiest polls to win, the lowest page rate.', editor: 'Mori',
  },
]

export const PLACES: Place[] = [
  { id: 'library', name: 'City Library', days: 3, cost: 300, blurb: 'Read what the classics did.', effect: 'Reveals one genre × theme pairing' },
  { id: 'survey', name: 'Reader Survey', days: 2, cost: 500, blurb: 'Hand out questionnaires outside a bookshop.', effect: 'Reveals one theme × audience pairing' },
  { id: 'art-class', name: 'Life Drawing Class', days: 4, cost: 600, blurb: 'Anatomy, perspective, inking.', effect: 'Art +2' },
  { id: 'writing-workshop', name: 'Writing Workshop', days: 4, cost: 600, blurb: 'Structure, dialogue, endings.', effect: 'Story +2' },
  { id: 'editing-seminar', name: 'Editing Seminar', days: 4, cost: 600, blurb: 'Panel flow and page turns.', effect: 'Pacing +2' },
  { id: 'hot-spring', name: 'Hot Spring', days: 3, cost: 400, blurb: 'Steam, silence, and no deadlines.', effect: 'Full stamina, max stamina +3' },
]

export const TRAITS: Record<AssistantTrait, { name: string; blurb: string }> = {
  fast: { name: 'Fast', blurb: 'Draws 30% more pages a day' },
  careful: { name: 'Careful', blurb: 'Their pages score 8 higher in art and story' },
  inspiring: { name: 'Inspiring', blurb: 'Working costs you 4 stamina a day instead of 5' },
  steady: { name: 'Steady', blurb: 'Never tires, never slows down' },
}

export const ASSISTANT_NAMES = [
  'Aoi', 'Haruto', 'Yui', 'Sora', 'Ren', 'Mio', 'Kaito', 'Hana', 'Riku', 'Nao', 'Yuki', 'Taiga',
  'Emi', 'Kenji', 'Saki', 'Daichi', 'Momo', 'Shun', 'Rei', 'Tsubasa', 'Kana', 'Jun', 'Ayame', 'Hikaru',
]

export const RATING_LABEL: Record<number, string> = {
  0: 'Bad', 1: 'Meh', 2: 'Good', 3: 'Great', 4: 'Perfect',
}

/** Component scale for a rating (0-100). */
export const RATING_SCORE: Record<number, number> = {
  0: 20, 1: 40, 2: 60, 3: 80, 4: 100,
}

export const SCORE_WEIGHTS = {
  art: 0.25, story: 0.25, pacing: 0.15, audienceFit: 0.15, freshness: 0.2,
} as const

export const ONE_SHOT_PAGES = 20
export const CHAPTER_PAGES = 16
export const RESULTS_DELAY_DAYS = 7
export const WEEKLY_LIVING_COST = 400
export const MAGAZINE_MISMATCH_PENALTY = 25
export const STALENESS_PENALTY = 15
export const WORK_STAMINA_COST = 5
export const REST_STAMINA_GAIN = 14
export const LOW_STAMINA_THRESHOLD = 20
export const JOB_PAY_PER_DAY = 120
export const JOB_STAMINA_COST = 3
export const MAX_ASSISTANTS = 3
export const CANDIDATE_REFRESH_DAYS = 28
export const VOLUME_EVERY_CHAPTERS = 4
export const VOLUME_PRICE = 2
/** Wrapping a serial at this popularity or higher (after at least one volume) ships a final volume. */
export const SERIAL_CLIMAX_MIN_POPULARITY = 50
/** The final volume sells this many times the copies of a regular volume. */
export const SERIAL_CLIMAX_VOLUME_MULT = 1.5
export const SERIAL_WARNINGS_TO_CANCEL = 3
export const SERIAL_OFFER_MIN_RANK = 3
export const SERIAL_OFFER_MIN_SCORE = 65
export const EDITOR_TIP_EVERY = 3
/** Spread of rival poll scores around a magazine's rivalMean. */
export const RIVAL_SCORE_SD = 12
export type RankTier = 'first' | 'podium' | 'mid' | 'weak'
export const PODIUM_RANK = 3
/** A chapter ranking below ceil(entrants x this) counts as weak. */
export const WEAK_RANK_FRACTION = 0.7
export const RANK_MULTIPLIER: Record<RankTier, number> = { first: 2, podium: 1.4, mid: 1, weak: 0.7 }

export function genreById(id: GenreId): Genre { return GENRES.find((g) => g.id === id)! }
export function themeById(id: ThemeId): Theme { return THEMES.find((t) => t.id === id)! }
export function audienceById(id: AudienceId): Audience { return AUDIENCES.find((a) => a.id === id)! }
export function magazineById(id: MagazineId): Magazine { return MAGAZINES.find((m) => m.id === id)! }
export function placeById(id: PlaceId): Place { return PLACES.find((p) => p.id === id)! }
