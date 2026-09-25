// Balance bots: deterministic player policies that drive the sim for tuning (scripts/balance.ts) and balance tests.
// Not re-exported from index.ts: the game never plays itself. A bot has no randomness of its own. Every choice
// is either a rule or a hash of the world seed and the next project id, and planning previews run on throwaway
// copies of the state, so a bot never advances the state's RNG seed except through tick().
import { genreThemeKey, themeAudienceKey } from './compat'
import {
  AUDIENCES, GENRES, LOW_STAMINA_THRESHOLD, MAGAZINES, ONE_SHOT_PAGES, RATING_SCORE, STALENESS_PENALTY, THEMES,
  magazineById,
} from './data'
import {
  acceptOffer, createGame, declineOffer, dismissResult, endSerial, focusMultipliers, hireAssistant,
  previewSubmission, setActivity, setFocus, spendSkillPoint, startProject, submitProject, tick, weeklyCosts,
} from './engine'
import type { SubmissionPreview } from './engine'
import { clamp, hashString } from './rng'
import { stalenessCount } from './scoring'
import type {
  AudienceId, Focus, GameState, GenreId, MagazineId, Project, ProjectDraft, SerialOffer, SerialStatus, StatId,
  ThemeId,
} from './types'

export interface BotPolicy {
  name: string
  /** What to draw next and the magazine it is meant for. Called when the desk is empty. */
  planDraft(s: GameState): { draft: ProjectDraft; target: MagazineId }
  /** Drawing focus for work aimed at magazine `m`. */
  focusFor(s: GameState, m: MagazineId): Focus
  /** Where to pitch the finished one-shot on the desk. */
  pickMagazine(s: GameState): MagazineId
  /** Spend skill points as they arrive (every third on pacing, the rest on the favoured stat). */
  spendPoints: boolean
  /**
   * Stress case only: once `afterOneShots` one-shots have polled, hire the first candidate and force this offer.
   * A policy with a forced serial declines organic offers and never wraps its serial up.
   */
  forcedSerial?: { afterOneShots: number; offer: SerialOffer }
}

export interface BotOneShot {
  day: number
  score: number
  rank: number
  entrants: number
  magazineId: MagazineId
  /** money right after the poll paid out */
  money: number
  /** the poll ended in an organic serialisation offer */
  offer: boolean
  /** the submission preview's offer chance at the moment of pitching, for forecast calibration */
  offerChance: number
}

export interface BotSerial {
  magazineId: MagazineId
  startedDay: number
  /** chapter results polled */
  results: number
  status: SerialStatus
}

export interface BotRun {
  oneShots: BotOneShot[]
  /** 1-based index of the first one-shot that earned an organic offer, or null */
  firstOfferAt: number | null
  /** every serial, oldest first */
  serials: BotSerial[]
  /** weeks whose costs left the player below zero */
  weeksInDebt: number
  /** money at the end of each day; index 0 is the starting money */
  moneyAtDay: number[]
  final: GameState
}

export interface BotRunOptions {
  days: number
  maxOneShots?: number
  /** Called after every day with the state the bot's decisions produced (before the tick) and the state after it. */
  observe?: (decided: GameState, next: GameState) => void
}

/** A pairing the bot has not tested yet is worth the mean rating: 0.15 x 20 + 0.25 x 40 + 0.3 x 60 + 0.2 x 80 + 0.1 x 100. */
const UNKNOWN_PAIRING_VALUE = 57
/** A serial is wrapped up once it has this many results... */
const WRAP_MIN_RESULTS = 16
/** ...and at least this popularity, so the final volume ships. */
const WRAP_MIN_POPULARITY = 50
/** Shifts are taken while money is under this many weeks of costs... */
const JOB_BELOW_WEEKS_OF_COSTS = 2
/** ...and only with this much stamina in hand. */
const JOB_MIN_STAMINA = 40

// ---------- shared rules ----------

/** The stat SENSIBLE puts two of every three points into. Kept separate so a taste-based choice can replace it. */
function favouredStat(_s: GameState): StatId {
  return 'art'
}

/** SENSIBLE's drawing focus. Kept separate so a taste-based choice can replace it. */
function sensibleFocus(_s: GameState, _m: MagazineId): Focus {
  return 'balanced'
}

/** Every third point (when the remaining count is a multiple of 3) goes to pacing, the rest to the favoured stat. */
function spendAllPoints(state: GameState): GameState {
  let s = state
  while (s.player.skillPoints > 0) {
    const wanted: StatId = s.player.skillPoints % 3 === 0 ? 'pacing' : favouredStat(s)
    const stat = ([wanted, 'art', 'story', 'pacing'] as StatId[]).find((k) => s.player.stats[k] < 100)
    if (!stat) break
    s = spendSkillPoint(s, stat)
  }
  return s
}

function pairingValue(s: GameState, genre: GenreId, theme: ThemeId, audience: AudienceId): number {
  const fresh = s.notebook.genreTheme[genreThemeKey(genre, theme)]
  const fit = s.notebook.themeAudience[themeAudienceKey(theme, audience)]
  return (fresh !== undefined ? RATING_SCORE[fresh] : UNKNOWN_PAIRING_VALUE)
    + (fit !== undefined ? RATING_SCORE[fit] : UNKNOWN_PAIRING_VALUE)
    - STALENESS_PENALTY * stalenessCount(s, genre, theme)
}

/** The best known genre x theme for an audience; ties go to the smallest hash, so the order of the lists never decides. */
function bestDraft(s: GameState, audience: AudienceId): ProjectDraft {
  let best = { genre: GENRES[0].id, theme: THEMES[0].id, value: -Infinity, tie: Infinity }
  for (const g of GENRES) {
    for (const t of THEMES) {
      const value = pairingValue(s, g.id, t.id, audience)
      const tie = hashString(`${s.worldSeed}:${s.nextProjectId}:${g.id}|${t.id}`)
      if (value > best.value || (value === best.value && tie < best.tie)) best = { genre: g.id, theme: t.id, value, tie }
    }
  }
  return { title: `Work ${s.nextProjectId}`, genre: best.genre, theme: best.theme, audience }
}

/** Preview a finished one-shot of `draft` drawn at the player's current stats, without touching the real state. */
function hypotheticalPreview(s: GameState, draft: ProjectDraft, m: MagazineId, focus: Focus): SubmissionPreview {
  const mult = focusMultipliers(focus)
  const art = clamp(s.player.stats.art * mult.art, 0, 100)
  const story = clamp(s.player.stats.story * mult.story, 0, 100)
  const project: Project = {
    id: s.nextProjectId, kind: 'oneshot', chapter: 0, ...draft,
    pagesTarget: ONE_SHOT_PAGES, pagesDone: ONE_SHOT_PAGES, artSum: art * ONE_SHOT_PAGES, storySum: story * ONE_SHOT_PAGES,
    startedDay: s.day, status: 'ready', magazineId: null, submittedDay: null, resultsDay: null,
  }
  return previewSubmission({ ...s, project }, m)!
}

/** Best odds of an offer; ties go to the higher expected pay (the middle of the pay range), then the softer field. */
function betterOdds(a: SubmissionPreview, b: SubmissionPreview): boolean {
  if (a.offerChance !== b.offerChance) return a.offerChance > b.offerChance
  const payA = a.minMoney + a.maxMoney
  const payB = b.minMoney + b.maxMoney
  if (payA !== payB) return payA > payB
  return magazineById(a.magazineId).rivalMean < magazineById(b.magazineId).rivalMean
}

// ---------- policies ----------

/** Plays the way the interface teaches: best odds, best known pairing, points spent, serials wrapped on a high. */
export const SENSIBLE: BotPolicy = {
  name: 'sensible',
  planDraft(s) {
    let best: { draft: ProjectDraft; preview: SubmissionPreview } | null = null
    for (const m of MAGAZINES) {
      const draft = bestDraft(s, m.audience)
      const preview = hypotheticalPreview(s, draft, m.id, sensibleFocus(s, m.id))
      if (!best || betterOdds(preview, best.preview)) best = { draft, preview }
    }
    return { draft: best!.draft, target: best!.preview.magazineId }
  },
  focusFor: sensibleFocus,
  pickMagazine(s) {
    let best: SubmissionPreview | null = null
    for (const m of MAGAZINES) {
      const preview = previewSubmission(s, m.id)
      if (preview && (!best || betterOdds(preview, best))) best = preview
    }
    return best ? best.magazineId : MAGAZINES[0].id
  },
  spendPoints: true,
}

function carelessPick<T>(s: GameState, projectId: number, slot: string, list: readonly T[]): T {
  return list[hashString(`${s.worldSeed}:${projectId}:careless:${slot}`) % list.length]
}

/** Ignores the notebook, the odds and the stats screen: every choice is a hash. */
export const CARELESS: BotPolicy = {
  name: 'careless',
  planDraft(s) {
    const id = s.nextProjectId
    return {
      draft: {
        title: `Work ${id}`,
        genre: carelessPick(s, id, 'genre', GENRES).id,
        theme: carelessPick(s, id, 'theme', THEMES).id,
        audience: carelessPick(s, id, 'audience', AUDIENCES).id,
      },
      target: carelessPick(s, id, 'magazine', MAGAZINES).id,
    }
  },
  focusFor: () => 'balanced',
  // The project's id is the nextProjectId it was planned under, so the pitch goes where the plan said.
  pickMagazine: (s) => carelessPick(s, s.project?.id ?? s.nextProjectId, 'magazine', MAGAZINES).id,
  spendPoints: false,
}

const STRESS_COMBOS = [
  { genre: 'action', theme: 'samurai', audience: 'teens' },
  { genre: 'mystery', theme: 'detective', audience: 'adults' },
  { genre: 'horror', theme: 'cooking', audience: 'kids' },
  { genre: 'romance', theme: 'school', audience: 'teens' },
  { genre: 'action', theme: 'samurai', audience: 'teens' },
  { genre: 'scifi', theme: 'space', audience: 'young-adults' },
] as const
const STRESS_MAGAZINES: readonly MagazineId[] = ['weekly-bolt', 'kids-comic', 'monthly-petal', 'ultra-seinen']

/** The old balance script: six fixed one-shots rotating magazines, no points, then a forced Weekly Bolt serial. */
export const STRESS_BOLT: BotPolicy = {
  name: 'stress case',
  planDraft(s) {
    const i = s.history.length
    return { draft: { title: `W${i}`, ...STRESS_COMBOS[i % STRESS_COMBOS.length] }, target: STRESS_MAGAZINES[i % 4] }
  },
  focusFor: () => 'balanced',
  pickMagazine: (s) => STRESS_MAGAZINES[s.history.length % 4],
  spendPoints: false,
  forcedSerial: {
    afterOneShots: 6,
    offer: { magazineId: 'weekly-bolt', title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'teens' },
  },
}

// ---------- stepping ----------

function chooseActivity(s: GameState): GameState {
  // While recovering the engine rests on its own and returns to the desk at 60% stamina; setActivity would cut that short.
  if (s.recovering || s.trip) return s
  if (s.project?.status === 'drawing') return setActivity(s, s.player.stamina < LOW_STAMINA_THRESHOLD ? 'rest' : 'work')
  const short = s.player.money < JOB_BELOW_WEEKS_OF_COSTS * weeklyCosts(s)
  return setActivity(s, short && s.player.stamina >= JOB_MIN_STAMINA ? 'job' : 'rest')
}

/** One day's decisions, before the tick. */
function decide(state: GameState, p: BotPolicy): GameState {
  let s = state
  if (s.pendingResult) s = dismissResult(s)
  if (s.pendingOffer) {
    const offer = s.pendingOffer
    const accepted = p.forcedSerial ? s : acceptOffer(s)
    s = accepted === s ? declineOffer(s) : setFocus(accepted, p.focusFor(accepted, offer.magazineId))
  }
  if (p.spendPoints) s = spendAllPoints(s)
  const forced = p.forcedSerial
  if (forced && !s.serial && !s.serials.length && !s.project && s.history.length >= forced.afterOneShots) {
    if (s.candidates.length) s = hireAssistant(s, s.candidates[0].id)
    s = setFocus(acceptOffer({ ...s, pendingOffer: forced.offer }), p.focusFor(s, forced.offer.magazineId))
  }
  const ser = s.serial
  if (!forced && ser?.status === 'running' && ser.results.length >= WRAP_MIN_RESULTS && ser.popularity >= WRAP_MIN_POPULARITY) {
    s = endSerial(s)
  }
  if (!s.project && !s.trip) {
    const { draft, target } = p.planDraft(s)
    s = setFocus(startProject(s, draft), p.focusFor(s, target))
  }
  if (s.project?.status === 'ready') s = submitProject(s, p.pickMagazine(s))
  return chooseActivity(s)
}

/** One bot day: dismiss, accept, spend, plan, pitch, pick the activity, then tick. */
export function botStep(s: GameState, p: BotPolicy): GameState {
  return tick(decide(s, p))
}

/** Play a career from day 0 until `days` have passed or `maxOneShots` one-shots have polled, whichever is first. */
export function runBot(seed: number, p: BotPolicy, opts: BotRunOptions): BotRun {
  let s = createGame('Rin', seed)
  const maxOneShots = opts.maxOneShots ?? Infinity
  const oneShots: BotOneShot[] = []
  const moneyAtDay = [s.player.money]
  let weeksInDebt = 0
  let offerChance = 0
  // Every step ticks exactly one day, so the step counter bounds the loop even if a rule stops the clock.
  for (let step = 0; step < opts.days && s.day < opts.days && oneShots.length < maxOneShots; step++) {
    const decided = decide(s, p)
    const pitched = decided.project
    if (s.project?.status === 'ready' && pitched?.status === 'submitted' && pitched.magazineId) {
      offerChance = previewSubmission(decided, pitched.magazineId)!.offerChance
    }
    const next = tick(decided)
    if (next.history.length > decided.history.length) {
      const r = next.history[next.history.length - 1]
      oneShots.push({
        day: r.day, score: r.score, rank: r.rank, entrants: r.entrants, magazineId: r.magazineId,
        money: next.player.money, offer: !!next.pendingOffer, offerChance,
      })
    }
    if (next.day % 7 === 0 && next.player.money < 0) weeksInDebt++
    moneyAtDay.push(next.player.money)
    opts.observe?.(decided, next)
    s = next
  }
  const all = s.serial ? [...s.serials, s.serial] : s.serials
  const first = oneShots.findIndex((o) => o.offer)
  return {
    oneShots,
    firstOfferAt: first < 0 ? null : first + 1,
    serials: all.map((x) => ({ magazineId: x.magazineId, startedDay: x.startedDay, results: x.results.length, status: x.status })),
    weeksInDebt,
    moneyAtDay,
    final: s,
  }
}
