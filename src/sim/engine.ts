import { genreThemeKey, genreThemeRating, themeAudienceKey, themeAudienceRating } from './compat'
import {
  ASSISTANT_NAMES, AUDIENCES, CANDIDATE_REFRESH_DAYS, CHAPTER_PAGES, EDITOR_TIP_EVERY, GENRES,
  JOB_PAY_PER_DAY, JOB_STAMINA_COST, LOW_STAMINA_THRESHOLD, MAGAZINES, MAX_ASSISTANTS, ONE_SHOT_PAGES,
  RATING_LABEL, RESULTS_DELAY_DAYS, REST_STAMINA_GAIN, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE,
  SERIAL_WARNINGS_TO_CANCEL, THEMES, VOLUME_EVERY_CHAPTERS, VOLUME_PRICE, WEEKLY_LIVING_COST,
  WORK_STAMINA_COST, audienceById, magazineById, placeById, themeById, genreById,
} from './data'
import { clamp, draw, range } from './rng'
import {
  evaluateChapter, evaluateProject, projectArtQuality, projectStoryQuality, rankScore, stalenessCount,
} from './scoring'
import type {
  Activity, Assistant, AssistantTrait, AudienceId, EditorRel, Focus, GameState, GenreId, LogKind,
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

export interface SubmissionPreview {
  magazineId: MagazineId
  mismatch: boolean
  art: number
  story: number
  pacing: number
  audienceFit: Rating | null
  freshness: Rating | null
  staleness: number
  minMoney: number
  maxMoney: number
}

export function previewSubmission(state: GameState, magazineId: MagazineId): SubmissionPreview | null {
  const p = state.project
  if (!p) return null
  const mag = magazineById(magazineId)
  const combo = previewCombo(state, p.genre, p.theme, p.audience)
  return {
    magazineId,
    mismatch: mag.audience !== p.audience,
    art: Math.round(projectArtQuality(p)),
    story: Math.round(projectStoryQuality(p)),
    pacing: state.player.stats.pacing,
    audienceFit: combo.themeAudience,
    freshness: combo.genreTheme,
    staleness: combo.staleness,
    minMoney: Math.round(mag.pageRate * p.pagesDone * 0.7),
    maxMoney: Math.round(mag.pageRate * p.pagesDone * 2),
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
    s = addLog(s, 'levelup', `Level ${level}. You gained 3 skill points and more stamina.`, true)
  }
  return { ...s, player: { ...s.player, level, xp, skillPoints, maxStamina } }
}

function generateCandidates(state: GameState): GameState {
  const { values, seed } = draw(state.seed, 15)
  const lvl = state.player.level
  const candidates: Assistant[] = []
  for (let i = 0; i < 3; i++) {
    const v = values.slice(i * 5, i * 5 + 5)
    const art = 18 + Math.floor(v[1] * 18) + lvl * 3
    const story = 18 + Math.floor(v[2] * 18) + lvl * 3
    candidates.push({
      id: state.nextAssistantId + i,
      name: ASSISTANT_NAMES[(Math.floor(v[0] * ASSISTANT_NAMES.length) + i * 7) % ASSISTANT_NAMES.length],
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
  return { ...state, player: { ...state.player, stamina: clamp(state.player.stamina + gain, 0, state.player.maxStamina) } }
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
      s = addLog(s, 'info', `${mag.editor} (${mag.name}) shares a tip: ${revealed.text}. Added to your Notebook.`, true)
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
  // Choosing anything by hand ends the forced recovery.
  return { ...state, activity, recovering: false }
}

export function setFocus(state: GameState, focus: Focus): GameState {
  return { ...state, focus }
}

export function startProject(state: GameState, draft: ProjectDraft): GameState {
  if (state.project || state.trip) return state
  const title = draft.title.trim() || 'Untitled'
  const project = makeProject(state, 'oneshot', 0, { ...draft, title }, null)
  const next: GameState = { ...state, project, nextProjectId: state.nextProjectId + 1, activity: 'work' }
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
    volumes: 0,
    totalCopies: 0,
    totalMoney: 0,
    status: 'running',
  }
  const project = makeProject({ ...state, nextProjectId: state.nextProjectId + 1 }, 'serial', 1, o, o.magazineId)
  const s: GameState = {
    ...state, serial, project, pendingOffer: null, nextProjectId: state.nextProjectId + 2, activity: 'work',
  }
  return addLog(s, 'series', `"${o.title}" is now serialised in ${magazineById(o.magazineId).name}. Chapter 1 is due.`, true)
}

export function declineOffer(state: GameState): GameState {
  if (!state.pendingOffer) return state
  const s: GameState = { ...state, pendingOffer: null }
  return addLog(s, 'info', `You passed on serialising "${state.pendingOffer.title}".`, false)
}

export function endSerial(state: GameState): GameState {
  const ser = state.serial
  if (!ser || ser.status !== 'running') return state
  const bonusFans = Math.round(ser.popularity * 20)
  let s: GameState = {
    ...state,
    serial: { ...ser, status: 'ended', endedDay: state.day },
    project: state.project?.kind === 'serial' ? null : state.project,
    activity: 'rest',
    player: { ...state.player, fans: state.player.fans + bonusFans },
  }
  s = addLog(s, 'series', `You wrapped up "${ser.title}" after ${ser.chaptersSent} chapters. Loyal readers: +${bonusFans} fans.`, true)
  return archiveSerialIfDone(s)
}

export function hireAssistant(state: GameState, candidateId: number): GameState {
  const c = state.candidates.find((a) => a.id === candidateId)
  if (!c || state.assistants.length >= MAX_ASSISTANTS) return state
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
      s = { ...s, player: { ...s.player, maxStamina: s.player.maxStamina + 3, stamina: s.player.maxStamina + 3 } }
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
      s = addLog(s, 'success', `Manuscript for "${done.title}" is complete. Pick a magazine.`, true)
    } else {
      s = sendChapter({ ...s, project: done })
    }
  } else if (stamina === 0) {
    // Collapse: forced rest until recovered, then back to the desk automatically.
    s = { ...s, activity: 'rest', recovering: true }
    s = addLog(s, 'warn', 'You collapsed from exhaustion. Resting until you recover, then back to the desk.', true)
  } else if (stamina < LOW_STAMINA_THRESHOLD && state.player.stamina >= LOW_STAMINA_THRESHOLD) {
    s = addLog(s, 'warn', 'Stamina is low. Progress is halved.', true)
  }
  return s
}

/** A finished chapter goes straight to the magazine and the next one starts. */
function sendChapter(state: GameState): GameState {
  const p = state.project!
  const ser = state.serial!
  const pc: PendingChapter = {
    chapter: p.chapter,
    pages: p.pagesTarget,
    artQ: projectArtQuality(p),
    storyQ: projectStoryQuality(p),
    submittedDay: state.day,
    resultsDay: state.day + RESULTS_DELAY_DAYS,
  }
  const serial: Serial = { ...ser, pending: [...ser.pending, pc], chaptersSent: ser.chaptersSent + 1 }
  const next = makeProject(state, 'serial', p.chapter + 1, p, p.magazineId)
  const s: GameState = { ...state, serial, project: next, nextProjectId: state.nextProjectId + 1 }
  return addLog(s, 'series', `Chapter ${p.chapter} of "${p.title}" sent to ${magazineById(ser.magazineId).name}.`, false)
}

function archiveSerialIfDone(state: GameState): GameState {
  const ser = state.serial
  if (!ser || ser.status === 'running' || ser.pending.length) return state
  return { ...state, serial: null, serials: [...state.serials, ser] }
}

function resolveChapters(state: GameState): GameState {
  let s = state
  while (s.serial && s.serial.pending.length && s.serial.pending[0].resultsDay <= s.day) {
    const ser = s.serial
    const pc = ser.pending[0]
    const mag = magazineById(ser.magazineId)
    const { result, seed } = evaluateChapter(s, ser, pc)
    const popularity = Math.round(ser.popularity * 0.65 + rankScore(result.rank, result.entrants) * 0.35)
    const weak = result.rank > Math.ceil(result.entrants * 0.7)
    const warnings = weak ? ser.warnings + 1 : 0
    let serial: Serial = {
      ...ser,
      pending: ser.pending.slice(1),
      results: [...ser.results, result],
      popularity,
      warnings,
      totalMoney: ser.totalMoney + result.rewards.money,
    }
    s = {
      ...s,
      seed,
      serial,
      player: { ...s.player, money: s.player.money + result.rewards.money, fans: s.player.fans + result.rewards.fans },
    }
    s = addLog(s, 'series', `"${ser.title}" ch.${result.chapter} ranked #${result.rank} of ${result.entrants} (score ${result.score}).`, true)
    s = grantXp(s, result.rewards.xp)
    s = bumpEditor(s, ser.magazineId, result.rank <= 3 ? 2 : 1)

    if (serial.results.length % VOLUME_EVERY_CHAPTERS === 0) {
      const copies = Math.round((s.player.fans + mag.circulation * 20) * (popularity / 100))
      const money = copies * VOLUME_PRICE
      serial = { ...serial, volumes: serial.volumes + 1, totalCopies: serial.totalCopies + copies, totalMoney: serial.totalMoney + money }
      s = { ...s, serial, player: { ...s.player, money: s.player.money + money } }
      s = addLog(s, 'money', `Volume ${serial.volumes} of "${ser.title}" sold ${copies.toLocaleString()} copies: +¥${money.toLocaleString()}.`, true)
    }

    if (serial.status === 'running' && warnings >= SERIAL_WARNINGS_TO_CANCEL) {
      const lost = Math.round(s.player.fans * 0.1)
      serial = { ...serial, status: 'cancelled', endedDay: s.day }
      s = {
        ...s,
        serial,
        project: s.project?.kind === 'serial' ? null : s.project,
        activity: 'rest',
        player: { ...s.player, fans: s.player.fans - lost },
      }
      s = addLog(s, 'warn', `${mag.name} cancelled "${ser.title}" after three weak chapters. Fans -${lost}.`, true)
    }
    s = archiveSerialIfDone(s)
  }
  return s
}

export function tick(state: GameState): GameState {
  let s: GameState = { ...state, day: state.day + 1 }

  if (s.trip) {
    const endsDay = s.trip.endsDay
    s = restPlayer(s, 8)
    s = restAssistants(s)
    if (s.day >= endsDay) s = finishTrip(s)
  } else if (s.activity === 'job') {
    s = {
      ...s,
      player: {
        ...s.player,
        money: s.player.money + JOB_PAY_PER_DAY,
        stamina: clamp(s.player.stamina - JOB_STAMINA_COST, 0, s.player.maxStamina),
      },
    }
    s = restAssistants(s)
  } else {
    const p = s.project
    // An exhausted mangaka sleeps through the day, whatever the plan was.
    const working = !!p && p.status === 'drawing' && s.activity === 'work' && s.player.stamina > 0
    if (working) s = workDay(s)
    else {
      s = restPlayer(s, REST_STAMINA_GAIN)
      s = restAssistants(s)
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
