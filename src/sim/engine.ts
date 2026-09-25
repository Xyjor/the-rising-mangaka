import { genreThemeKey, genreThemeRating, themeAudienceKey, themeAudienceRating } from './compat'
import {
  ASSISTANT_NAMES, AUDIENCES, CANDIDATE_REFRESH_DAYS, CHAPTER_PAGES, DEADLINE_REST_FACTOR, EDITOR_TIP_EVERY, GENRES,
  HIRE_RUNWAY_WEEKS, JOB_PAY_PER_DAY, JOB_STAMINA_COST, LOW_STAMINA_THRESHOLD, MAGAZINES, MAX_ASSISTANTS,
  ONE_SHOT_PAGES, OVERDRAFT_FEE_MIN, OVERDRAFT_FEE_RATE,
  RATING_LABEL, RESULTS_DELAY_DAYS, REST_STAMINA_GAIN, SERIAL_CLIMAX_MIN_POPULARITY, SERIAL_CLIMAX_VOLUME_MULT,
  SERIAL_GRACE_CHAPTERS, SERIAL_MISSED_ISSUE_POPULARITY, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE,
  SERIAL_WARNINGS_TO_CANCEL, THEMES,
  VOLUME_EVERY_CHAPTERS,
  VOLUME_PRICE, WEEKLY_LIVING_COST, WORK_STAMINA_COST, audienceById, magazineById, placeById, themeById, genreById,
} from './data'
import { clamp, draw, range } from './rng'
import {
  evaluateChapter, evaluateProject, projectArtQuality, projectStoryQuality, rankScore, stalenessCount, weakRankLine,
} from './scoring'
import { forecastPoll } from './forecast'
import type { Forecast } from './forecast'
import type {
  Activity, Assistant, AssistantTrait, AudienceId, EditorRel, Focus, GameState, GenreId, LogKind, Magazine,
  MagazineId, PendingChapter, Phase, PlaceId, Project, ProjectDraft, Rating, Serial, StatId, ThemeId,
} from './types'
import { pendingMilestones } from './milestones'

const TRAIT_LIST: AssistantTrait[] = ['fast', 'careful', 'inspiring', 'steady']

// ---------- creation ----------

export function createGame(name: string, seed: number): GameState {
  const editors = {} as Record<MagazineId, EditorRel>
  for (const m of MAGAZINES) editors[m.id] = { relationship: 0, tips: 0 }
  let state: GameState = {
    version: 2,
    seed: seed | 0,
    worldSeed: (seed * 7919) | 0,
    day: 0,
    player: {
      name,
      level: 1,
      xp: 0,
      skillPoints: 0,
      stats: { story: 34, art: 38, pacing: 30 },
      stamina: 100,
      maxStamina: 100,
      money: 3000,
      fans: 0,
    },
    project: null,
    activity: 'rest',
    recovering: false,
    lowStaminaWarned: false,
    focus: 'balanced',
    history: [],
    serial: null,
    serials: [],
    pendingOffer: null,
    assistants: [],
    candidates: [],
    candidatesRefreshDay: 0,
    trip: null,
    editors,
    notebook: { genreTheme: {}, themeAudience: {} },
    log: [],
    pendingResult: null,
    nextProjectId: 1,
    nextLogId: 1,
    nextAssistantId: 1,
    milestonesDone: [],
  }
  state = generateCandidates(state)
  return addLog(state, 'info', `Welcome, ${name}. Your studio is ready. Plan your first manga.`, false)
}

// ---------- queries ----------

export function getPhase(state: GameState): Phase {
  if (!state.project) return 'idle'
  return state.project.status
}

export function xpToNext(level: number): number {
  return 100 + (level - 1) * 60
}

export interface DateParts { year: number; month: number; week: number; day: number }

export function describeDate(day: number): DateParts {
  return {
    year: Math.floor(day / 336) + 1,
    month: (Math.floor(day / 28) % 12) + 1,
    week: (Math.floor(day / 7) % 4) + 1,
    day: (day % 7) + 1,
  }
}

/** Prose date for logs and tables: 'Month 4', 'Month 4, week 4, day 4', 'Year 2, month 1'. The year is only named after the first one. */
export function shortDate(day: number, opts: { week?: boolean } = {}): string {
  const d = describeDate(day)
  const parts = [`month ${d.month}`]
  if (d.year > 1) parts.unshift(`year ${d.year}`)
  if (opts.week) parts.push(`week ${d.week}`, `day ${d.day}`)
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function staminaFactor(state: GameState): number {
  const s = state.player.stamina
  if (s <= 0) return 0
  if (s < LOW_STAMINA_THRESHOLD) return 0.5
  return 1
}

/** Expected pages per working day at full stamina for the player alone (no noise). */
export function basePagesPerDay(state: GameState): number {
  const { art, story } = state.player.stats
  return 0.5 + ((art + story) / 2) * 0.02
}

/** Expected pages per day from one assistant at full stamina. */
export function assistantPagesPerDay(a: Assistant): number {
  return (0.15 + ((a.art + a.story) / 2) * 0.008) * (a.trait === 'fast' ? 1.3 : 1)
}

/** Expected pages per day for the whole studio. */
export function studioPagesPerDay(state: GameState): number {
  return basePagesPerDay(state) + state.assistants.reduce((sum, a) => sum + assistantPagesPerDay(a), 0)
}

/** Expected pages the studio will draw on the next working day, mirroring workDay/tick (no noise). */
export function expectedPagesToday(state: GameState): number {
  if (state.player.stamina <= 0) return 0
  const player = basePagesPerDay(state) * staminaFactor(state)
  const staff = state.assistants.reduce((sum, a) => {
    if (a.trait === 'steady') return sum + assistantPagesPerDay(a)
    const eff = a.stamina <= 0 ? 0 : a.stamina < LOW_STAMINA_THRESHOLD ? 0.5 : 1
    return sum + assistantPagesPerDay(a) * eff
  }, 0)
  return player + staff
}

export type DeadlineStatus = 'on-track' | 'tight' | 'late'

/** Where the chapter on the desk stands against its due day. */
export interface ChapterDeadline {
  dueDay: number
  /** calendar days until the due day */
  daysLeft: number
  /** working days the studio needs for the pages left, at full stamina */
  workDaysLeft: number
  /** see `deadlineStatus` */
  status: DeadlineStatus
}

/** Working days the studio needs for `pages` at full stamina with its current staff (rest days not included). */
export function chapterWorkDays(state: GameState, pages: number): number {
  return Math.ceil(pages / studioPagesPerDay(state))
}

/**
 * `workDays` of drawing against `daysLeft` calendar days: late when they cannot fit, tight when they fit only
 * without the rest days (`DEADLINE_REST_FACTOR` on top), on track otherwise.
 */
export function deadlineStatus(workDays: number, daysLeft: number): DeadlineStatus {
  if (workDays > daysLeft) return 'late'
  return workDays * DEADLINE_REST_FACTOR > daysLeft ? 'tight' : 'on-track'
}

/** The running serial's chapter deadline, or null when no serial chapter is being drawn. Consumes no RNG. */
export function chapterDeadline(state: GameState): ChapterDeadline | null {
  const ser = state.serial
  const p = state.project
  if (!ser || ser.status !== 'running' || !p || p.kind !== 'serial' || p.status !== 'drawing') return null
  const dueDay = ser.nextDueDay
  const daysLeft = dueDay - state.day
  const workDaysLeft = chapterWorkDays(state, p.pagesTarget - p.pagesDone)
  return { dueDay, daysLeft, workDaysLeft, status: deadlineStatus(workDaysLeft, daysLeft) }
}

export function weeklyCosts(state: GameState): number {
  return WEEKLY_LIVING_COST + state.assistants.reduce((sum, a) => sum + a.salary, 0)
}

export function focusMultipliers(focus: Focus): { art: number; story: number } {
  switch (focus) {
    case 'art': return { art: 1.25, story: 0.8 }
    case 'story': return { art: 0.8, story: 1.25 }
    default: return { art: 1, story: 1 }
  }
}

export interface ComboPreview {
  genreTheme: Rating | null
  themeAudience: Rating | null
  staleness: number
}

/** What the player already knows about a combo. Null means undiscovered. */
export function previewCombo(
  state: GameState, genre: GenreId, theme: ThemeId, audience: AudienceId,
): ComboPreview {
  return {
    genreTheme: state.notebook.genreTheme[genreThemeKey(genre, theme)] ?? null,
    themeAudience: state.notebook.themeAudience[themeAudienceKey(theme, audience)] ?? null,
    staleness: stalenessCount(state, genre, theme),
  }
}

/** What the pitch screen shows for one magazine: what the player knows about the manuscript, and the forecast. */
export interface SubmissionPreview extends Forecast {
  magazineId: MagazineId
  mismatch: boolean
  art: number
  story: number
  pacing: number
  audienceFit: Rating | null
  freshness: Rating | null
  staleness: number
  /** how many of the manuscript's two pairings the Notebook has not rated; the forecast spreads those over every rating */
  unknownPairings: 0 | 1 | 2
}

export function previewSubmission(state: GameState, magazineId: MagazineId): SubmissionPreview | null {
  const p = state.project
  if (!p) return null
  const mag = magazineById(magazineId)
  const combo = previewCombo(state, p.genre, p.theme, p.audience)
  const unknown = [combo.genreTheme, combo.themeAudience].filter((r) => r === null).length as 0 | 1 | 2
  return {
    ...forecastPoll(state, p, magazineId),
    magazineId,
    mismatch: mag.audience !== p.audience,
    art: Math.round(projectArtQuality(p)),
    story: Math.round(projectStoryQuality(p)),
    pacing: state.player.stats.pacing,
    audienceFit: combo.themeAudience,
    freshness: combo.genreTheme,
    staleness: combo.staleness,
    unknownPairings: unknown,
  }
}

// ---------- internals ----------

function addLog(state: GameState, kind: LogKind, text: string, toast: boolean): GameState {
  const entry = { id: state.nextLogId, day: state.day, kind, text, toast }
  const log = state.log.length >= 300 ? [...state.log.slice(-299), entry] : [...state.log, entry]
  return { ...state, log, nextLogId: state.nextLogId + 1 }
}

function grantXp(state: GameState, amount: number): GameState {
  let { level, xp, skillPoints, maxStamina } = state.player
  xp += amount
  let s = state
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level)
    level += 1
    skillPoints += 3
    maxStamina += 5
    s = addLog(s, 'levelup', `Level ${level}. +3 skill points, +5 max stamina. Spend the points in Stats (S).`, true)
  }
  return { ...s, player: { ...s.player, level, xp, skillPoints, maxStamina } }
}

function generateCandidates(state: GameState): GameState {
  const { values, seed } = draw(state.seed, 15)
  const lvl = state.player.level
  const candidates: Assistant[] = []
  // Names are drawn without replacement, and never one already on the payroll.
  const pool = ASSISTANT_NAMES.filter((n) => !state.assistants.some((a) => a.name === n))
  for (let i = 0; i < 3; i++) {
    const v = values.slice(i * 5, i * 5 + 5)
    const art = 18 + Math.floor(v[1] * 18) + lvl * 3
    const story = 18 + Math.floor(v[2] * 18) + lvl * 3
    candidates.push({
      id: state.nextAssistantId + i,
      name: pool.length ? pool.splice(Math.floor(v[0] * pool.length), 1)[0] : ASSISTANT_NAMES[i],
      art,
      story,
      salary: 120 + Math.round((art + story) * 4),
      stamina: 80,
      maxStamina: 80,
      trait: TRAIT_LIST[Math.floor(v[3] * TRAIT_LIST.length)],
      look: Math.floor(v[4] * 6),
    })
  }
  return {
    ...state,
    seed,
    candidates,
    candidatesRefreshDay: state.day + CANDIDATE_REFRESH_DAYS,
    nextAssistantId: state.nextAssistantId + 3,
  }
}

function restAssistants(state: GameState, gain = 12): GameState {
  if (!state.assistants.length) return state
  return {
    ...state,
    assistants: state.assistants.map((a) => ({ ...a, stamina: clamp(a.stamina + gain, 0, a.maxStamina) })),
  }
}

function restPlayer(state: GameState, gain: number): GameState {
  const stamina = clamp(state.player.stamina + gain, 0, state.player.maxStamina)
  // Recovered means 60% of max: the same line the forced rest after a collapse uses.
  return {
    ...state,
    player: { ...state.player, stamina },
    lowStaminaWarned: stamina >= state.player.maxStamina * 0.6 ? false : state.lowStaminaWarned,
  }
}

/** Forced rest until recovered; work resumes on its own once stamina is back to 60% of max. */
function collapse(state: GameState, text: string): GameState {
  return addLog({ ...state, activity: 'rest', recovering: true, lowStaminaWarned: false }, 'warn', text, true)
}

/** Reveal one unknown notebook cell. Returns the text of what was learned, or null. */
function revealCell(state: GameState, kind: 'gt' | 'ta', audience?: AudienceId): { state: GameState; text: string | null } {
  const { values, seed } = draw(state.seed, 1)
  let s = { ...state, seed }
  if (kind === 'gt') {
    const unknown: [GenreId, ThemeId][] = []
    for (const g of GENRES) for (const t of THEMES) {
      if (s.notebook.genreTheme[genreThemeKey(g.id, t.id)] === undefined) unknown.push([g.id, t.id])
    }
    if (!unknown.length) return { state: s, text: null }
    const [g, t] = unknown[Math.floor(values[0] * unknown.length)]
    const r = genreThemeRating(s.worldSeed, g, t)
    s = { ...s, notebook: { ...s.notebook, genreTheme: { ...s.notebook.genreTheme, [genreThemeKey(g, t)]: r } } }
    return { state: s, text: `${genreById(g).name} × ${themeById(t).name} is ${RATING_LABEL[r]}` }
  }
  const auds = audience ? [audienceById(audience)] : AUDIENCES
  const unknown: [ThemeId, AudienceId][] = []
  for (const t of THEMES) for (const a of auds) {
    if (s.notebook.themeAudience[themeAudienceKey(t.id, a.id)] === undefined) unknown.push([t.id, a.id])
  }
  if (!unknown.length) return { state: s, text: null }
  const [t, a] = unknown[Math.floor(values[0] * unknown.length)]
  const r = themeAudienceRating(s.worldSeed, t, a)
  s = { ...s, notebook: { ...s.notebook, themeAudience: { ...s.notebook.themeAudience, [themeAudienceKey(t, a)]: r } } }
  return { state: s, text: `${themeById(t).name} for ${audienceById(a).name} is ${RATING_LABEL[r]}` }
}

function bumpEditor(state: GameState, magazineId: MagazineId, amount: number): GameState {
  const mag = magazineById(magazineId)
  const rel = state.editors[magazineId]
  const relationship = rel.relationship + amount
  let s: GameState = { ...state, editors: { ...state.editors, [magazineId]: { ...rel, relationship } } }
  const owed = Math.floor(relationship / EDITOR_TIP_EVERY)
  if (owed > rel.tips) {
    const revealed = revealCell(s, 'ta', mag.audience)
    s = revealed.state
    s = { ...s, editors: { ...s.editors, [magazineId]: { relationship, tips: owed } } }
    if (revealed.text) {
      s = addLog(s, 'info', `${mag.editor} at ${mag.name} passes on a tip: ${revealed.text}. Noted in your Notebook.`, true)
    }
  }
  return s
}

function makeProject(state: GameState, kind: Project['kind'], chapter: number, draft: ProjectDraft, magazineId: MagazineId | null): Project {
  return {
    id: state.nextProjectId,
    kind,
    chapter,
    title: draft.title,
    genre: draft.genre,
    theme: draft.theme,
    audience: draft.audience,
    pagesTarget: kind === 'serial' ? CHAPTER_PAGES : ONE_SHOT_PAGES,
    pagesDone: 0,
    artSum: 0,
    storySum: 0,
    startedDay: state.day,
    status: 'drawing',
    magazineId,
    submittedDay: null,
    resultsDay: null,
  }
}

// ---------- commands ----------

export function setActivity(state: GameState, activity: Activity): GameState {
  if (state.trip) return state
  // Nobody draws at zero stamina: rest until recovered, then work resumes on its own.
  if (activity === 'work' && state.player.stamina <= 0) return { ...state, activity: 'rest', recovering: true }
  // Choosing anything else by hand ends the forced recovery.
  return { ...state, activity, recovering: false }
}

export function setFocus(state: GameState, focus: Focus): GameState {
  return { ...state, focus }
}

export function startProject(state: GameState, draft: ProjectDraft): GameState {
  if (state.project || state.trip) return state
  const title = draft.title.trim() || 'Untitled'
  const project = makeProject(state, 'oneshot', 0, { ...draft, title }, null)
  const next: GameState = {
    ...state, project, nextProjectId: state.nextProjectId + 1, activity: state.recovering ? 'rest' : 'work',
  }
  return addLog(next, 'info', `Started "${title}". Time to draw.`, false)
}

export function submitProject(state: GameState, magazineId: MagazineId): GameState {
  const p = state.project
  if (!p || p.status !== 'ready') return state
  const mag = magazineById(magazineId)
  const project: Project = {
    ...p, status: 'submitted', magazineId, submittedDay: state.day, resultsDay: state.day + RESULTS_DELAY_DAYS,
  }
  const next: GameState = { ...state, project, activity: 'rest' }
  return addLog(next, 'info', `Submitted "${p.title}" to ${mag.name}. Poll results in ${RESULTS_DELAY_DAYS} days.`, true)
}

export function dismissResult(state: GameState): GameState {
  return { ...state, pendingResult: null }
}

export function spendSkillPoint(state: GameState, stat: StatId): GameState {
  const pl = state.player
  if (pl.skillPoints <= 0 || pl.stats[stat] >= 100) return state
  return {
    ...state,
    player: { ...pl, skillPoints: pl.skillPoints - 1, stats: { ...pl.stats, [stat]: Math.min(100, pl.stats[stat] + 2) } },
  }
}

export function acceptOffer(state: GameState): GameState {
  const o = state.pendingOffer
  if (!o || state.project || state.serial) return state
  const mag = magazineById(o.magazineId)
  const serial: Serial = {
    id: state.nextProjectId,
    title: o.title,
    genre: o.genre,
    theme: o.theme,
    audience: o.audience,
    magazineId: o.magazineId,
    startedDay: state.day,
    endedDay: null,
    chaptersSent: 0,
    results: [],
    pending: [],
    popularity: 50,
    warnings: 0,
    nextDueDay: state.day + mag.chapterDays,
    missedIssues: 0,
    volumes: 0,
    totalCopies: 0,
    totalMoney: 0,
    status: 'running',
  }
  const project = makeProject({ ...state, nextProjectId: state.nextProjectId + 1 }, 'serial', 1, o, o.magazineId)
  const s: GameState = {
    ...state, serial, project, pendingOffer: null, nextProjectId: state.nextProjectId + 2,
    // Drawing starts once the player is back from a trip or recovered; the offer itself is never blocked.
    activity: state.recovering || state.trip ? 'rest' : 'work',
  }
  return addLog(s, 'series', `"${o.title}" is now serialised in ${mag.name}. Chapter 1 is due.`, true)
}

export function declineOffer(state: GameState): GameState {
  if (!state.pendingOffer) return state
  const s: GameState = { ...state, pendingOffer: null }
  return addLog(s, 'info', `You passed on serialising "${state.pendingOffer.title}".`, false)
}

export function endSerial(state: GameState): GameState {
  const ser = state.serial
  if (!ser || ser.status !== 'running') return state
  const mag = magazineById(ser.magazineId)
  // Loyal readers scale with how much of a first volume has polled, so accept-and-wrap earns nothing.
  const earned = Math.min(1, ser.results.length / VOLUME_EVERY_CHAPTERS)
  const bonusFans = Math.round(ser.popularity * 20 * earned)
  // A climax volume needs a shipped volume behind it and real popularity (starting popularity is 50).
  const climax = ser.results.length >= VOLUME_EVERY_CHAPTERS && ser.popularity >= SERIAL_CLIMAX_MIN_POPULARITY
  const copies = climax ? Math.round(volumeCopies(state, mag, ser.popularity) * SERIAL_CLIMAX_VOLUME_MULT) : 0
  const money = copies * VOLUME_PRICE
  let s: GameState = {
    ...state,
    serial: {
      ...ser,
      status: 'ended',
      endedDay: state.day,
      volumes: ser.volumes + (climax ? 1 : 0),
      totalCopies: ser.totalCopies + copies,
      totalMoney: ser.totalMoney + money,
    },
    project: state.project?.kind === 'serial' ? null : state.project,
    activity: 'rest',
    player: { ...state.player, fans: state.player.fans + bonusFans, money: state.player.money + money },
  }
  const text = climax
    ? `You wrapped up "${ser.title}" after ${ser.chaptersSent} chapters on a high. The final volume sold ${copies} copies: +¥${money}. Loyal readers: +${bonusFans} fans.`
    : bonusFans > 0
      ? `You wrapped up "${ser.title}" after ${ser.chaptersSent} chapters. Loyal readers: +${bonusFans} fans.`
      : `You dropped "${ser.title}" before it found readers.`
  s = addLog(s, 'series', text, true)
  return archiveSerialIfDone(s)
}

export function hireAssistant(state: GameState, candidateId: number): GameState {
  const c = state.candidates.find((a) => a.id === candidateId)
  if (!c || state.assistants.length >= MAX_ASSISTANTS) return state
  // Two weeks of that hire's salary in the bank: allows one early hire, blocks the day-one triple hire.
  if (state.player.money < c.salary * HIRE_RUNWAY_WEEKS) return state
  const s: GameState = {
    ...state,
    assistants: [...state.assistants, c],
    candidates: state.candidates.filter((a) => a.id !== candidateId),
  }
  return addLog(s, 'staff', `${c.name} joined the studio as an assistant (¥${c.salary}/week).`, true)
}

export function fireAssistant(state: GameState, id: number): GameState {
  const a = state.assistants.find((x) => x.id === id)
  if (!a) return state
  const s: GameState = { ...state, assistants: state.assistants.filter((x) => x.id !== id) }
  return addLog(s, 'staff', `${a.name} left the studio.`, false)
}

export function startTrip(state: GameState, placeId: PlaceId): GameState {
  if (state.trip) return state
  const place = placeById(placeId)
  if (state.player.money < place.cost) return state
  const s: GameState = {
    ...state,
    trip: { placeId, startedDay: state.day, endsDay: state.day + place.days },
    activity: 'rest',
    player: { ...state.player, money: state.player.money - place.cost },
  }
  return addLog(s, 'trip', `Off to the ${place.name} for ${place.days} days.`, false)
}

// ---------- time ----------

function finishTrip(state: GameState): GameState {
  const trip = state.trip!
  const place = placeById(trip.placeId)
  let s: GameState = { ...state, trip: null }
  // A project started or accepted while away picks up as soon as the player is home.
  if (s.project?.status === 'drawing' && !s.recovering) s = { ...s, activity: 'work' }
  let text = ''
  switch (place.id) {
    case 'library': {
      const r = revealCell(s, 'gt'); s = r.state
      text = r.text ? `You learned that ${r.text}.` : 'Nothing new in the stacks. You know it all.'
      break
    }
    case 'survey': {
      const r = revealCell(s, 'ta'); s = r.state
      text = r.text ? `Readers told you that ${r.text}.` : 'The readers had nothing new to say.'
      break
    }
    case 'art-class':
      s = { ...s, player: { ...s.player, stats: { ...s.player.stats, art: Math.min(100, s.player.stats.art + 2) } } }
      text = 'Art +2.'
      break
    case 'writing-workshop':
      s = { ...s, player: { ...s.player, stats: { ...s.player.stats, story: Math.min(100, s.player.stats.story + 2) } } }
      text = 'Story +2.'
      break
    case 'editing-seminar':
      s = { ...s, player: { ...s.player, stats: { ...s.player.stats, pacing: Math.min(100, s.player.stats.pacing + 2) } } }
      text = 'Pacing +2.'
      break
    case 'hot-spring':
      s = {
        ...s,
        player: { ...s.player, maxStamina: s.player.maxStamina + 3, stamina: s.player.maxStamina + 3 },
        lowStaminaWarned: false,
      }
      text = 'Fully rested. Max stamina +3.'
      break
  }
  return addLog(s, 'trip', `Back from the ${place.name}. ${text}`, true)
}

function workDay(state: GameState): GameState {
  const p = state.project!
  const { values, seed } = draw(state.seed, 3 + state.assistants.length * 3)
  let s: GameState = { ...state, seed }
  const factor = staminaFactor(s)
  const mult = focusMultipliers(s.focus)

  let pages = basePagesPerDay(s) * factor * range(values[0], 0.85, 1.15)
  const artSample = clamp(s.player.stats.art * mult.art + range(values[1], -8, 8), 0, 100)
  const storySample = clamp(s.player.stats.story * mult.story + range(values[2], -8, 8), 0, 100)
  let artAcc = artSample * pages
  let storyAcc = storySample * pages

  const assistants = s.assistants.map((a, i) => {
    const tireless = a.trait === 'steady'
    if (!tireless && a.stamina <= 0) return { ...a, stamina: clamp(a.stamina + 12, 0, a.maxStamina) }
    const eff = !tireless && a.stamina < LOW_STAMINA_THRESHOLD ? 0.5 : 1
    const v = values.slice(3 + i * 3, 6 + i * 3)
    const ap = assistantPagesPerDay(a) * eff * range(v[0], 0.85, 1.15)
    const careful = a.trait === 'careful' ? 8 : 0
    const aArt = clamp(a.art * mult.art + careful + range(v[1], -8, 8), 0, 100)
    const aStory = clamp(a.story * mult.story + careful + range(v[2], -8, 8), 0, 100)
    pages += ap
    artAcc += aArt * ap
    storyAcc += aStory * ap
    return tireless ? a : { ...a, stamina: clamp(a.stamina - 4, 0, a.maxStamina) }
  })

  const remaining = p.pagesTarget - p.pagesDone
  const gained = Math.min(pages, remaining)
  const scale = pages > 0 ? gained / pages : 0
  const project: Project = {
    ...p,
    pagesDone: p.pagesDone + gained,
    artSum: p.artSum + artAcc * scale,
    storySum: p.storySum + storyAcc * scale,
  }
  const inspiring = s.assistants.some((a) => a.trait === 'inspiring') ? 1 : 0
  const stamina = clamp(s.player.stamina - (WORK_STAMINA_COST - inspiring), 0, s.player.maxStamina)
  s = { ...s, project, assistants, player: { ...s.player, stamina } }

  if (project.pagesDone >= project.pagesTarget - 1e-6) {
    const done = { ...project, pagesDone: project.pagesTarget }
    if (done.kind === 'oneshot') {
      s = { ...s, project: { ...done, status: 'ready' }, activity: 'rest' }
      s = addLog(s, 'success', `Manuscript for "${done.title}" is complete. Press M to pitch it to a magazine.`, true)
    } else {
      s = sendChapter({ ...s, project: done })
    }
  }
  // Stamina is checked whether or not the day finished a manuscript: a chapter done at zero still means a collapse.
  if (stamina === 0) {
    s = s.project?.status === 'drawing'
      ? collapse(s, 'You collapsed from exhaustion. Resting until you recover, then back to the desk.')
      : { ...s, recovering: true, lowStaminaWarned: false }
  } else if (stamina < LOW_STAMINA_THRESHOLD && !s.lowStaminaWarned) {
    s = addLog({ ...s, lowStaminaWarned: true }, 'warn', 'Stamina is low: pages come at half speed. Rest (R) to recover.', true)
  }
  return s
}

/**
 * A finished chapter goes straight to the magazine and the next one starts. The next chapter is due one
 * `chapterDays` after this one's due day, not after today: finishing early banks the time.
 */
function sendChapter(state: GameState): GameState {
  const p = state.project!
  const ser = state.serial!
  const mag = magazineById(ser.magazineId)
  const pc: PendingChapter = {
    chapter: p.chapter,
    pages: p.pagesTarget,
    artQ: projectArtQuality(p),
    storyQ: projectStoryQuality(p),
    submittedDay: state.day,
    resultsDay: state.day + RESULTS_DELAY_DAYS,
  }
  const serial: Serial = {
    ...ser, pending: [...ser.pending, pc], chaptersSent: ser.chaptersSent + 1, nextDueDay: ser.nextDueDay + mag.chapterDays,
  }
  const next = makeProject(state, 'serial', p.chapter + 1, p, p.magazineId)
  const s: GameState = { ...state, serial, project: next, nextProjectId: state.nextProjectId + 1 }
  return addLog(s, 'series', `Chapter ${p.chapter} of "${p.title}" sent to ${mag.name}.`, false)
}

function archiveSerialIfDone(state: GameState): GameState {
  const ser = state.serial
  if (!ser || ser.status === 'running' || ser.pending.length) return state
  return { ...state, serial: null, serials: [...state.serials, ser] }
}

/** Copies a volume sells: (fans + circulation x 20) x popularity. */
export function volumeCopies(state: GameState, mag: Magazine, popularity: number): number {
  return Math.round((state.player.fans + mag.circulation * 20) * (popularity / 100))
}

function resolveChapters(state: GameState): GameState {
  let s = state
  while (s.serial && s.serial.pending.length && s.serial.pending[0].resultsDay <= s.day) {
    const ser = s.serial
    const pc = ser.pending[0]
    const mag = magazineById(ser.magazineId)
    const { result, seed } = evaluateChapter(s, ser, pc)
    const popularity = Math.round(ser.popularity * 0.65 + rankScore(result.rank, result.entrants) * 0.35)
    const weak = result.rank > weakRankLine(result.entrants)
    let serial: Serial = {
      ...ser,
      pending: ser.pending.slice(1),
      results: [...ser.results, result],
      popularity,
      warnings: ser.warnings,
      totalMoney: ser.totalMoney + result.rewards.money,
    }
    // A new series gets SERIAL_GRACE_CHAPTERS results before a weak one can add a warning.
    const warnings = !weak ? 0 : serial.results.length > SERIAL_GRACE_CHAPTERS ? ser.warnings + 1 : 0
    serial = { ...serial, warnings }
    s = {
      ...s,
      seed,
      serial,
      player: { ...s.player, money: s.player.money + result.rewards.money, fans: s.player.fans + result.rewards.fans },
    }
    s = addLog(s, 'series', `"${ser.title}" chapter ${result.chapter} placed #${result.rank} of ${result.entrants}, score ${result.score}. +¥${result.rewards.money}.`, true)
    s = grantXp(s, result.rewards.xp)
    s = bumpEditor(s, ser.magazineId, result.rank <= 3 ? 2 : 1)

    if (serial.results.length % VOLUME_EVERY_CHAPTERS === 0) {
      const copies = volumeCopies(s, mag, popularity)
      const money = copies * VOLUME_PRICE
      serial = { ...serial, volumes: serial.volumes + 1, totalCopies: serial.totalCopies + copies, totalMoney: serial.totalMoney + money }
      s = { ...s, serial, player: { ...s.player, money: s.player.money + money } }
      s = addLog(s, 'money', `Volume ${serial.volumes} of "${ser.title}" sold ${copies} copies: +¥${money}.`, true)
    }

    if (serial.status === 'running' && warnings >= SERIAL_WARNINGS_TO_CANCEL) s = cancelSerial(s)
    s = archiveSerialIfDone(s)
  }
  return s
}

/**
 * The magazine drops the running serial at its third warning in a row: 10% of fans leave, the chapter on the desk is
 * scrapped and the studio rests. Weak chapters and missed issues share the warning count, so the log names warnings.
 */
function cancelSerial(state: GameState): GameState {
  const ser = state.serial!
  const lost = Math.round(state.player.fans * 0.1)
  const s: GameState = {
    ...state,
    serial: { ...ser, status: 'cancelled', endedDay: state.day },
    project: state.project?.kind === 'serial' ? null : state.project,
    activity: 'rest',
    player: { ...state.player, fans: state.player.fans - lost },
  }
  return addLog(s, 'warn', `${magazineById(ser.magazineId).name} cancelled "${ser.title}" after ${SERIAL_WARNINGS_TO_CANCEL} warnings in a row. Fans -${lost}. A one-shot that places top ${SERIAL_OFFER_MIN_RANK} or scores ${SERIAL_OFFER_MIN_SCORE}+ earns a new offer.`, true)
}

/**
 * Runs after `resolveChapters`: a running serial whose chapter is not in by its due day misses the issue.
 * Popularity drops, the same chapter is due one `chapterDays` later, and once the grace period has passed (4 results
 * in) the miss is a warning; three warnings cancel. Consumes no RNG.
 */
function checkDeadline(state: GameState): GameState {
  const ser = state.serial
  const p = state.project
  if (!ser || ser.status !== 'running' || p?.kind !== 'serial' || p.status !== 'drawing') return state
  if (state.day < ser.nextDueDay) return state
  const mag = magazineById(ser.magazineId)
  const counts = ser.results.length >= SERIAL_GRACE_CHAPTERS
  const warnings = counts ? ser.warnings + 1 : ser.warnings
  const serial: Serial = {
    ...ser,
    popularity: Math.max(0, ser.popularity - SERIAL_MISSED_ISSUE_POPULARITY),
    missedIssues: ser.missedIssues + 1,
    nextDueDay: ser.nextDueDay + mag.chapterDays,
    warnings,
  }
  const after = counts
    ? ` Warning ${warnings} of ${SERIAL_WARNINGS_TO_CANCEL}.`
    : ` New series get ${SERIAL_GRACE_CHAPTERS} chapters of grace.`
  let s = addLog(
    { ...state, serial }, 'warn',
    `"${ser.title}" missed its issue: chapter ${p.chapter} was not ready. Popularity -${SERIAL_MISSED_ISSUE_POPULARITY}.${after}`,
    true,
  )
  if (warnings >= SERIAL_WARNINGS_TO_CANCEL) s = archiveSerialIfDone(cancelSerial(s))
  return s
}

export function tick(state: GameState): GameState {
  let s: GameState = { ...state, day: state.day + 1 }

  if (s.trip) {
    const endsDay = s.trip.endsDay
    s = restPlayer(s, 8)
    s = restAssistants(s)
    if (s.day >= endsDay) s = finishTrip(s)
  } else if (s.activity === 'job' && s.player.stamina > 0) {
    // Same stamina rules as drawing: half pay when low, and hitting zero forces rest.
    const stamina = clamp(s.player.stamina - JOB_STAMINA_COST, 0, s.player.maxStamina)
    s = {
      ...s,
      player: { ...s.player, money: s.player.money + Math.round(JOB_PAY_PER_DAY * staminaFactor(s)), stamina },
    }
    s = restAssistants(s)
    if (stamina === 0) s = collapse(s, 'You collapsed after the shift. Resting until you recover.')
  } else {
    const p = s.project
    // An exhausted mangaka sleeps through the day, whatever the plan was.
    const working = !!p && p.status === 'drawing' && s.activity === 'work' && s.player.stamina > 0
    if (working) s = workDay(s)
    else {
      s = restPlayer(s, REST_STAMINA_GAIN)
      s = restAssistants(s)
      // A shift chosen at zero stamina is slept through and pays nothing.
      if (s.activity === 'job') s = addLog({ ...s, activity: 'rest' }, 'warn', 'Too exhausted for a shift. You slept instead.', false)
      if (s.recovering && s.player.stamina >= s.player.maxStamina * 0.6) {
        const backToWork = !!s.project && s.project.status === 'drawing'
        s = { ...s, recovering: false, activity: backToWork ? 'work' : 'rest' }
        if (backToWork) s = addLog(s, 'info', 'Recovered. Back to the desk.', false)
      }
    }
  }

  if (s.day % 7 === 0) {
    const cost = weeklyCosts(s)
    s = { ...s, player: { ...s.player, money: s.player.money - cost } }
    s = addLog(s, 'money', s.assistants.length
      ? `Weekly costs: -¥${cost} (living ¥${WEEKLY_LIVING_COST}, salaries ¥${cost - WEEKLY_LIVING_COST}).`
      : `Weekly living costs: -¥${cost}.`, false)
    if (s.player.money < 0) {
      // Unpaid assistants quit before the fee is computed, so the tight-week check below uses the new roster.
      if (s.assistants.length) {
        s = { ...s, assistants: [] }
        s = addLog(s, 'warn', 'Your assistants quit: you could not pay them this week.', true)
      }
      const fee = Math.max(OVERDRAFT_FEE_MIN, Math.round(-s.player.money * OVERDRAFT_FEE_RATE))
      s = { ...s, player: { ...s.player, money: s.player.money - fee } }
      s = addLog(s, 'money', `Overdraft fee: -¥${fee}. You are ¥${-s.player.money} in debt. Part-time work pays ¥${JOB_PAY_PER_DAY} a day.`, true)
    } else if (s.player.money < weeklyCosts(s)) {
      s = addLog(s, 'warn', `Money is tight: ¥${s.player.money} left and next week costs ¥${weeklyCosts(s)}. Part-time work pays ¥${JOB_PAY_PER_DAY} a day.`, true)
    }
  }

  if (s.day >= s.candidatesRefreshDay) s = generateCandidates(s)

  // one-shot poll results
  const sp = s.project
  if (sp && sp.status === 'submitted' && sp.magazineId && sp.resultsDay !== null && s.day >= sp.resultsDay) {
    const { result, seed } = evaluateProject(s, sp, sp.magazineId)
    s = {
      ...s,
      seed,
      project: null,
      pendingResult: result,
      history: [...s.history, result],
      notebook: {
        genreTheme: { ...s.notebook.genreTheme, [genreThemeKey(sp.genre, sp.theme)]: result.genreThemeRating },
        themeAudience: {
          ...s.notebook.themeAudience,
          [themeAudienceKey(sp.theme, sp.audience)]: result.themeAudienceRating,
        },
      },
      player: {
        ...s.player,
        money: s.player.money + result.rewards.money,
        fans: s.player.fans + result.rewards.fans,
      },
    }
    s = addLog(s, 'success', `"${result.title}" ranked #${result.rank} of ${result.entrants} in ${magazineById(sp.magazineId).name}.`, false)
    s = grantXp(s, result.rewards.xp)
    s = bumpEditor(s, sp.magazineId, result.rank <= 3 ? 2 : 1)
    const strong = result.rank <= SERIAL_OFFER_MIN_RANK || result.score >= SERIAL_OFFER_MIN_SCORE
    if (strong && !s.serial) {
      s = {
        ...s,
        pendingOffer: { magazineId: sp.magazineId, title: sp.title, genre: sp.genre, theme: sp.theme, audience: sp.audience },
      }
      s = addLog(s, 'series', `${magazineById(sp.magazineId).name} wants to serialise "${sp.title}".`, false)
    }
  }

  s = resolveChapters(s)
  s = checkDeadline(s)
  s = awardMilestones(s)
  return s
}

export function tickMany(state: GameState, days: number): GameState {
  let s = state
  for (let i = 0; i < days; i++) s = tick(s)
  return s
}

/** Last step of tick: award every milestone whose rule just became true. Consumes no RNG. */
function awardMilestones(state: GameState): GameState {
  let s = state
  for (const m of pendingMilestones(s)) {
    s = { ...s, milestonesDone: [...(s.milestonesDone ?? []), m.id] }
    s = addLog(s, 'success', `Milestone: ${m.title}. +${m.xp} XP.`, true)
    s = grantXp(s, m.xp)
  }
  return s
}
