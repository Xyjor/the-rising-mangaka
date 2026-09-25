// Pure simulation types. No React, no DOM.
import type { MilestoneId } from './milestones'

export type GenreId =
  | 'action' | 'romance' | 'comedy' | 'horror' | 'sports'
  | 'fantasy' | 'mystery' | 'scifi' | 'slice' | 'drama'

export type ThemeId =
  | 'school' | 'pirates' | 'ninja' | 'cooking' | 'music' | 'robots'
  | 'vampires' | 'detective' | 'space' | 'idols' | 'samurai' | 'magic'

export type AudienceId = 'kids' | 'teens' | 'young-adults' | 'adults'

export type MagazineId = 'weekly-bolt' | 'monthly-petal' | 'ultra-seinen' | 'kids-comic'

/** 0 = Bad, 1 = Meh, 2 = Good, 3 = Great, 4 = Perfect */
export type Rating = 0 | 1 | 2 | 3 | 4

export type Activity = 'work' | 'rest' | 'job'
export type Focus = 'balanced' | 'art' | 'story'
export type StatId = 'story' | 'art' | 'pacing'

export interface Genre { id: GenreId; name: string; blurb: string }
export interface Theme { id: ThemeId; name: string; blurb: string }
export interface Audience { id: AudienceId; name: string; blurb: string }

export interface Magazine {
  id: MagazineId
  name: string
  audience: AudienceId
  /** money per page */
  pageRate: number
  /** in thousands of readers */
  circulation: number
  /** typical rival score (0-100) */
  rivalMean: number
  /** number of competing works in a poll */
  entrants: number
  /** a serial here owes a chapter every this many days; one not ready by then misses the issue */
  chapterDays: number
  /** how this magazine's readers weigh each poll component, integer percentages summing to 100 */
  taste: ScoreWeights
  /** one sentence on what the readers want, shown wherever the player picks a magazine or an audience */
  tasteLine: string
  blurb: string
  editor: string
}

export interface PlayerStats { story: number; art: number; pacing: number }

export interface Player {
  name: string
  level: number
  xp: number
  skillPoints: number
  stats: PlayerStats
  stamina: number
  maxStamina: number
  money: number
  fans: number
}

export type ProjectStatus = 'drawing' | 'ready' | 'submitted'
export type ProjectKind = 'oneshot' | 'serial'

export interface Project {
  id: number
  kind: ProjectKind
  /** chapter number for serial projects, 0 for one-shots */
  chapter: number
  title: string
  genre: GenreId
  theme: ThemeId
  audience: AudienceId
  pagesTarget: number
  pagesDone: number
  /** page-weighted quality accumulators */
  artSum: number
  storySum: number
  startedDay: number
  status: ProjectStatus
  magazineId: MagazineId | null
  submittedDay: number | null
  resultsDay: number | null
}

export interface ScoreBreakdown {
  art: number
  story: number
  pacing: number
  audienceFit: number
  freshness: number
}

/** Poll weights per component, integer percentages that sum to 100. */
export type ScoreWeights = Readonly<Record<keyof ScoreBreakdown, number>>

export interface Rewards { money: number; fans: number; xp: number }

/** The named rival mangaka: always one entrant in the polls of the magazine they run in. */
export interface Rival {
  name: string
  /** mean poll score; the rival scores craft + Gaussian noise (sd RIVAL_SCORE_SD) like any entrant */
  craft: number
  magazineId: MagazineId
  seriesTitle: string
}

/** Where the rival placed in one poll: the score rounded and clamped to 0..100, the rank among every entrant. */
export interface RivalPlacing { name: string; score: number; rank: number }

export interface PollResult {
  projectId: number
  title: string
  genre: GenreId
  theme: ThemeId
  audience: AudienceId
  magazineId: MagazineId
  day: number
  score: number
  rank: number
  entrants: number
  /** each component on a 0-100 scale, before weighting */
  breakdown: ScoreBreakdown
  penalties: { magazineMismatch: number; staleness: number }
  rewards: Rewards
  genreThemeRating: Rating
  themeAudienceRating: Rating
  editorComment: string
  pages: number
  /** where the named rival placed; absent when the rival was not in this magazine (or the result predates rivals) */
  rival?: RivalPlacing
}

// ---------- serialisation ----------

export interface ChapterResult {
  chapter: number
  day: number
  score: number
  rank: number
  entrants: number
  breakdown: ScoreBreakdown
  rewards: Rewards
  /** where the named rival placed; absent when the rival was not in this magazine (or the result predates rivals) */
  rival?: RivalPlacing
}

export interface PendingChapter {
  chapter: number
  pages: number
  artQ: number
  storyQ: number
  submittedDay: number
  resultsDay: number
}

export type SerialStatus = 'running' | 'ended' | 'cancelled'

export interface Serial {
  id: number
  title: string
  genre: GenreId
  theme: ThemeId
  audience: AudienceId
  magazineId: MagazineId
  startedDay: number
  endedDay: number | null
  /** chapters sent to the magazine so far */
  chaptersSent: number
  results: ChapterResult[]
  pending: PendingChapter[]
  /** 0-100, moving average of recent chapter performance */
  popularity: number
  /** consecutive weak chapters or missed issues (after the grace period); 3 means cancellation */
  warnings: number
  /** the day the chapter on the desk is due; each chapter sent moves it on by the magazine's chapterDays */
  nextDueDay: number
  /** issues that went out without a chapter from this serial */
  missedIssues: number
  volumes: number
  totalCopies: number
  totalMoney: number
  status: SerialStatus
}

export interface SerialOffer {
  magazineId: MagazineId
  title: string
  genre: GenreId
  theme: ThemeId
  audience: AudienceId
}

// ---------- staff ----------

export type AssistantTrait = 'fast' | 'careful' | 'inspiring' | 'steady'

export interface Assistant {
  id: number
  name: string
  art: number
  story: number
  /** money per week */
  salary: number
  stamina: number
  maxStamina: number
  trait: AssistantTrait
  /** sprite palette variant */
  look: number
  /** true once this assistant has asked for a raise, whatever the answer: each assistant asks once */
  raised?: boolean
}

// ---------- trips ----------

export type PlaceId =
  | 'library' | 'survey' | 'art-class' | 'writing-workshop' | 'editing-seminar' | 'hot-spring'
  | 'convention' | 'masterclass'

export interface Place {
  id: PlaceId
  name: string
  days: number
  cost: number
  blurb: string
  effect: string
  /** reached only by answering a random event, never listed in the Trips panel */
  eventOnly?: boolean
}

export interface Trip { placeId: PlaceId; startedDay: number; endsDay: number }

// ---------- studio ----------

export type StudioTierId = 'apartment' | 'flat' | 'loft'

export interface StudioTier {
  id: StudioTierId
  name: string
  /** desks for assistants: hiring stops when every desk is taken */
  desks: number
  /** added to the weekly costs */
  rent: number
  /** base price of moving in from the tier below (see `moveInCost`) */
  moveIn: number
}

export type EquipmentId = 'coffee' | 'lamp' | 'shelf' | 'chair' | 'drafting-table' | 'tablet'

/** What one piece of equipment adds; `equipmentEffects` sums them over everything the studio owns. */
export interface EquipmentBonus {
  /** added to the player's art sample on every working day */
  art?: number
  /** added to the player's story sample on every working day */
  story?: number
  /** multiplies the player's pages a day (several multiply together) */
  pagesMult?: number
  /** added to the stamina a working day costs (negative is cheaper) */
  workCost?: number
  /** added to the stamina a rest day restores */
  restBonus?: number
}

export interface Equipment {
  id: EquipmentId
  name: string
  /** base price (see `equipmentPrice`) */
  price: number
  /** what it does, in the words the Studio panel shows */
  effect: string
  bonus: EquipmentBonus
  /** sold only from this studio tier up */
  needsTier?: StudioTierId
}

export interface Studio {
  tier: StudioTierId
  /** equipment bought, in the order it was bought */
  owned: EquipmentId[]
}

export interface EditorRel { relationship: number; tips: number }

// ---------- anime adaptations ----------

export type AnimeStudioId = 'kumo' | 'hoshi'

/** An animation studio's terms for adapting a hit serial (see anime.ts). */
export interface AnimeStudio {
  id: AnimeStudioId
  name: string
  /** paid to the mangaka at signing */
  fee: number
  /** weeks from signing to the premiere */
  airsAfterWeeks: number
  /** weeks on air; each one pays `weeklyFans` and `weeklyMoney` when it ends */
  runsWeeks: number
  weeklyFans: number
  weeklyMoney: number
  /** the adapted serial's volumes sell this many times the copies, from the premiere to `tailWeeks` after the finale */
  volumeMult: number
  tailWeeks: number
  /** added to the serial's popularity at the premiere if it is still running, capped at 100 */
  premierePopularity: number
}

/** A signed adaptation. Every day is fixed at signing: premiere, finale, and the last day of the volume boost. */
export interface AnimeDeal {
  studio: AnimeStudioId
  serialId: number
  signedDay: number
  airsDay: number
  endsDay: number
  tailEndsDay: number
}

/** The adaptation offer waiting on the desk: answerable up to and including `expiresDay`. */
export interface AnimeOffer { serialId: number; expiresDay: number }

// ---------- misc ----------

export interface Notebook {
  genreTheme: Partial<Record<string, Rating>>
  themeAudience: Partial<Record<string, Rating>>
}

export type LogKind = 'info' | 'success' | 'warn' | 'money' | 'levelup' | 'series' | 'staff' | 'trip' | 'event'

// ---------- random events ----------

export type EventId = 'letter' | 'cold' | 'convention' | 'raise' | 'reprint' | 'workshop'

/** A random event waiting on the desk for an answer (see events.ts). */
export interface GameEvent {
  id: EventId
  /** the day it arrived */
  day: number
  /** the last day it can be answered; the day after, it lapses and nothing happens */
  expiresDay: number
  /** the assistant asking for a raise */
  assistantId?: number
  /** the serial whose volumes get a reprint */
  serialId?: number
}

export interface LogEntry {
  id: number
  day: number
  kind: LogKind
  text: string
  /** should the UI surface this as a toast? */
  toast: boolean
}

export interface GameState {
  version: 2
  /** rolling RNG seed */
  seed: number
  /** fixed per game; drives hidden compatibility */
  worldSeed: number
  day: number
  player: Player
  project: Project | null
  activity: Activity
  /** true while forced to rest after collapsing; work resumes automatically once recovered */
  recovering: boolean
  /** true once the low-stamina warning has fired; cleared when stamina recovers to 60% of max */
  lowStaminaWarned: boolean
  focus: Focus
  history: PollResult[]
  serial: Serial | null
  serials: Serial[]
  pendingOffer: SerialOffer | null
  assistants: Assistant[]
  candidates: Assistant[]
  candidatesRefreshDay: number
  trip: Trip | null
  editors: Record<MagazineId, EditorRel>
  notebook: Notebook
  log: LogEntry[]
  pendingResult: PollResult | null
  nextProjectId: number
  nextLogId: number
  nextAssistantId: number
  /** ids of milestones already awarded, in the order they landed */
  milestonesDone: MilestoneId[]
  /** the named rival mangaka and the magazine they run in */
  rival: Rival
  /** the random event waiting on the desk, or null */
  event: GameEvent | null
  /** rolling RNG seed for random events only, so they never move the main `seed` stream */
  eventSeed: number
  /** no event is rolled before this day */
  nextEventDay: number
  /** where the mangaka works and the equipment bought for it */
  studio: Studio
  /** anime adaptations signed, oldest first */
  anime: AnimeDeal[]
  /** the adaptation offer waiting on the desk, or null */
  animeOffer: AnimeOffer | null
  /** ids of the serials an adaptation was ever offered for: studios ask once per series */
  animeOfferedFor: number[]
}

export type Phase = 'idle' | 'drawing' | 'ready' | 'submitted'

export interface ProjectDraft {
  title: string
  genre: GenreId
  theme: ThemeId
  audience: AudienceId
}
