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

export interface Rewards { money: number; fans: number; xp: number }

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
  /** consecutive weak chapters; 3 means cancellation */
  warnings: number
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
}

// ---------- trips ----------

export type PlaceId = 'library' | 'survey' | 'art-class' | 'writing-workshop' | 'editing-seminar' | 'hot-spring'

export interface Place {
  id: PlaceId
  name: string
  days: number
  cost: number
  blurb: string
  effect: string
}

export interface Trip { placeId: PlaceId; startedDay: number; endsDay: number }

export interface EditorRel { relationship: number; tips: number }

// ---------- misc ----------

export interface Notebook {
  genreTheme: Partial<Record<string, Rating>>
  themeAudience: Partial<Record<string, Rating>>
}

export type LogKind = 'info' | 'success' | 'warn' | 'money' | 'levelup' | 'series' | 'staff' | 'trip'

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
}

export type Phase = 'idle' | 'drawing' | 'ready' | 'submitted'

export interface ProjectDraft {
  title: string
  genre: GenreId
  theme: ThemeId
  audience: AudienceId
}
