import type {
  AssistantTrait, Audience, AudienceId, Genre, GenreId, Magazine, MagazineId, Place, PlaceId, ScoreWeights, Theme,
  ThemeId,
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
    pageRate: 110, circulation: 180, rivalMean: 58, entrants: 12, chapterDays: 14,
    taste: { art: 35, story: 15, pacing: 20, audienceFit: 10, freshness: 20 },
    tasteLine: 'Readers love big art and fast pacing.',
    blurb: 'The big weekly. Twelve rivals in every poll and the biggest readership in town.', editor: 'Tanaka',
  },
  {
    id: 'monthly-petal', name: 'Monthly Petal', audience: 'young-adults',
    pageRate: 130, circulation: 90, rivalMean: 52, entrants: 8, chapterDays: 28,
    taste: { art: 15, story: 35, pacing: 10, audienceFit: 20, freshness: 20 },
    tasteLine: 'Readers want a story, and a manga made for them.',
    blurb: 'A quieter book for young adults. Fewer rivals, a little more per page.', editor: 'Sato',
  },
  {
    id: 'ultra-seinen', name: 'Ultra Seinen', audience: 'adults',
    pageRate: 150, circulation: 70, rivalMean: 62, entrants: 8, chapterDays: 21,
    taste: { art: 15, story: 35, pacing: 20, audienceFit: 10, freshness: 20 },
    tasteLine: 'Readers prize story and pacing.',
    blurb: 'Prestige anthology for grown-ups. Best page rate going, and the toughest rivals.', editor: 'Kuroda',
  },
  {
    id: 'kids-comic', name: 'Kids Comic Go!', audience: 'kids',
    pageRate: 90, circulation: 120, rivalMean: 47, entrants: 10, chapterDays: 21,
    taste: { art: 35, story: 15, pacing: 10, audienceFit: 20, freshness: 20 },
    tasteLine: 'Readers love bright art, and a manga made for them.',
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
  // Reached only by answering a random event (events.ts); the Trips panel leaves them out.
  {
    id: 'convention', name: 'Comic Convention', days: 2, cost: 500, blurb: 'A table in the artist alley and a queue of readers.',
    effect: 'Fans +150 plus 4% of your fans, at most +5,000', eventOnly: true,
  },
  {
    id: 'masterclass', name: 'Manga Masterclass', days: 3, cost: 400, blurb: 'A veteran mangaka works on your weakest skill.',
    effect: '+3 to your lowest stat', eventOnly: true,
  },
]

export const TRAITS: Record<AssistantTrait, { name: string; blurb: string }> = {
  fast: { name: 'Fast', blurb: 'Draws 30% more pages a day' },
  careful: { name: 'Careful', blurb: 'Their pages score 8 higher in art and story' },
  inspiring: { name: 'Inspiring', blurb: 'Working costs you 4 stamina a day instead of 5' },
  steady: { name: 'Steady', blurb: 'Never tires, never slows down' },
}

/** The named rival mangaka: one per world, picked by a hash of the world seed. */
export const RIVAL_NAMES = [
  'Touya Kagami', 'Iori Hayama', 'Mikoto Sakuraba', 'Chihiro Ishida', 'Asahi Morikawa', 'Natsume Kujo',
] as const

/** What the rival draws in each magazine: three titles each, one picked by a hash of the world seed. */
export const RIVAL_SERIES: Record<MagazineId, readonly [string, string, string]> = {
  'weekly-bolt': ['Thunder Relay', 'Crimson Fang Academy', 'Skybreaker Nine'],
  'monthly-petal': ['Paper Moon Letters', 'The Last Train to Aoba', 'Glasshouse Summer'],
  'ultra-seinen': ['Ash and Ledger', 'The Quiet Prosecutor', 'Night Shift at Kurogane'],
  'kids-comic': ['Robo Pals Go!', 'Captain Mochi', 'Dino Detective Pip'],
}

/** The rival's craft (their mean poll score) in a new career... */
export const RIVAL_START_CRAFT = 50
/** ...what each year adds... */
export const RIVAL_YEARLY_GROWTH = 4
/** ...and where it stops. */
export const RIVAL_MAX_CRAFT = 76

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

/**
 * How likely each rating (Bad, Meh, Good, Great, Perfect) is for a pairing nobody has tested. Matches the thresholds
 * hidden ratings are drawn with (compat.ts `ratingFromUnit`: 0.15, 0.40, 0.70, 0.90); the pitch forecast spreads
 * an untested pairing over these.
 */
export const RATING_PRIOR: readonly number[] = [0.15, 0.25, 0.3, 0.2, 0.1]

/** Default poll weights (integer percentages); each magazine's `taste` overrides them in its own polls. */
export const SCORE_WEIGHTS: ScoreWeights = {
  art: 25, story: 25, pacing: 15, audienceFit: 15, freshness: 20,
}

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
/** weeks of a candidate's salary you must have in the bank before hiring them */
export const HIRE_RUNWAY_WEEKS = 2
/** a week that ends below zero charges this share of the debt as a fee */
export const OVERDRAFT_FEE_RATE = 0.05
export const OVERDRAFT_FEE_MIN = 50
export const CANDIDATE_REFRESH_DAYS = 28
export const VOLUME_EVERY_CHAPTERS = 4
export const VOLUME_PRICE = 2
/** Wrapping a serial at this popularity or higher (after at least one volume) ships a final volume. */
export const SERIAL_CLIMAX_MIN_POPULARITY = 50
/** The final volume sells this many times the copies of a regular volume. */
export const SERIAL_CLIMAX_VOLUME_MULT = 1.5
export const SERIAL_WARNINGS_TO_CANCEL = 3
/** A new series' first this-many results never add a warning, even when weak or late. */
export const SERIAL_GRACE_CHAPTERS = 4
/** Popularity a serial loses each time an issue goes out without its chapter. */
export const SERIAL_MISSED_ISSUE_POPULARITY = 10
/** A chapter deadline is tight when its working days times this (room for rest days) no longer fit the days left. */
export const DEADLINE_REST_FACTOR = 1.25
export const SERIAL_OFFER_MIN_RANK = 3
export const SERIAL_OFFER_MIN_SCORE = 65
export const EDITOR_TIP_EVERY = 3
/** Spread of rival poll scores around a magazine's rivalMean. */
export const RIVAL_SCORE_SD = 8
/** Spread of the pacing component's random noise around the player's pacing stat. */
export const PACING_NOISE_SD = 4
export type RankTier = 'first' | 'podium' | 'mid' | 'weak'
export const PODIUM_RANK = 3
/** A chapter ranking below ceil(entrants x this) counts as weak. */
export const WEAK_RANK_FRACTION = 0.7
export const RANK_MULTIPLIER: Record<RankTier, number> = { first: 2, podium: 1.4, mid: 1, weak: 0.7 }
/** Same tiers as `RANK_MULTIPLIER`, as integer percentages, for `pollPay`'s integer arithmetic. */
export const RANK_MULTIPLIER_PCT: Record<RankTier, number> = { first: 200, podium: 140, mid: 100, weak: 70 }
/** The poll score that earns the full per-page rate in `pollPay`; below it pay scales down, above it up. */
export const PAY_FULL_RATE_SCORE = 80

/** Random events (events.ts): a new career rolls its first event no earlier than this day... */
export const EVENT_FIRST_DAY = 28
/** ...rolls happen only on days where day % 7 is this... */
export const EVENT_ROLL_WEEKDAY = 3
/** ...each roll lands an event with this chance... */
export const EVENT_CHANCE = 0.35
/** ...the player has this many days after it lands to answer it... */
export const EVENT_ANSWER_DAYS = 7
/** ...and the next roll waits until this many days after it landed. */
export const EVENT_GAP_DAYS = 14

export function genreById(id: GenreId): Genre { return GENRES.find((g) => g.id === id)! }
export function themeById(id: ThemeId): Theme { return THEMES.find((t) => t.id === id)! }
export function audienceById(id: AudienceId): Audience { return AUDIENCES.find((a) => a.id === id)! }
export function magazineById(id: MagazineId): Magazine { return MAGAZINES.find((m) => m.id === id)! }
export function placeById(id: PlaceId): Place { return PLACES.find((p) => p.id === id)! }
