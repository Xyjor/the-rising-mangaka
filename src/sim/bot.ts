// Balance bots: deterministic player policies that drive the sim for tuning (scripts/balance.ts) and balance tests.
// Not re-exported from index.ts: the game never plays itself. A bot has no randomness of its own. Every choice
// is either a rule or a hash of the world seed and the next project id, and planning previews run on throwaway
// copies of the state, so a bot never advances the state's RNG seed except through tick().
import { signAnime } from './anime'
import { genreThemeKey, themeAudienceKey } from './compat'
import {
  AUDIENCES, EQUIPMENT, GENRES, LOW_STAMINA_THRESHOLD, MAGAZINES, MERCH_ITEMS, ONE_SHOT_PAGES, RATING_SCORE, STALENESS_PENALTY,
  THEMES, equipmentPrice, magazineById,
} from './data'
import {
  acceptOffer, assistantPagesPerDay, chapterDeadline, createGame, declineOffer, dismissResult, endSerial,
  focusMultipliers, hireAssistant, previewSubmission, setActivity, setFocus, spendSkillPoint, startProject,
  submitProject, tick, weeklyCosts,
} from './engine'
import type { SubmissionPreview } from './engine'
import { resolveEvent } from './events'
import { merchForecast, merchRefusal, orderMerch } from './merch'
import { clamp, hashString } from './rng'
import { stalenessCount, suitedFocus } from './scoring'
import { buyEquipment, equipmentEffects, moveStudio, studioAtLeast, studioSlots } from './studio'
import type {
  Assistant, AudienceId, EquipmentId, Focus, GameState, GenreId, MagazineId, Project, ProjectDraft, SerialOffer,
  MerchItem, SerialStatus, StatId, ThemeId,
} from './types'
import { markReviewRead } from './year'

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
   * How it answers a random event on the desk: 'afford' answers 'a' when that answer can be given and leaves two
   * weeks of costs in the bank (costs as they stand after answering, so a raise counts the new salary), else 'b';
   * 'b' always answers 'b'; null leaves the card to lapse.
   */
  events: 'afford' | 'b' | null
  /** Sign an anime offer as it lands: Hoshi Animation while the serial has under 12 results, else Studio Kumo. */
  signsAnime: boolean
  /**
   * Spend on the studio: the cheapest equipment it may buy once the bank holds its price and four weeks of costs, and
   * a move to the flat when a late chapter needs a second desk (see `hireIfLate`).
   */
  shops: boolean
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
  /** random events that landed on the desk */
  events: number
  /** money at the end of each day; index 0 is the starting money (day 0 unless the run had a start state) */
  moneyAtDay: number[]
  final: GameState
}

export interface BotRunOptions {
  /** stop once the game reaches this day */
  days: number
  /** stop once this many one-shots have polled */
  maxOneShots?: number
  /** stop after the first day on which this holds */
  until?: (s: GameState) => boolean
  /** play on from this state instead of a new game (the seed argument is then unused) */
  start?: GameState
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
/** A late chapter hires help only with this many weeks of the new salary in the bank... */
const HIRE_SALARY_WEEKS = 2
/** ...on top of this many weeks of the studio's current costs. */
const HIRE_COST_WEEKS = 2
/** An event's 'a' answer is given only if it leaves this many weeks of costs in the bank. */
const EVENT_COST_WEEKS = 2
/** Equipment is bought only with this many weeks of costs left over after paying for it. */
const BUY_COST_WEEKS = 4
/** An anime offer for a serial with fewer results than this goes to Hoshi Animation (slow, big), else Studio Kumo. */
const HOSHI_BELOW_RESULTS = 12

// ---------- shared rules ----------

/**
 * The magazine SENSIBLE is working towards: the one on its desk's project (a serial chapter always has one, a
 * one-shot once pitched), else the one its next plan would aim at.
 */
function targetMagazine(s: GameState): MagazineId {
  return s.project?.magazineId ?? planOneShot(s).target
}

/** The stat SENSIBLE puts two of every three points into: story if its target magazine weighs story higher, else art. */
function favouredStat(s: GameState): StatId {
  return suitedFocus(magazineById(targetMagazine(s)).taste) === 'story' ? 'story' : 'art'
}

/** SENSIBLE's drawing focus: art or story, whichever the magazine weighs higher; balanced when they are equal. */
function sensibleFocus(_s: GameState, m: MagazineId): Focus {
  return suitedFocus(magazineById(m).taste)
}

/** Every third point (when the remaining count is a multiple of 3) goes to pacing, the rest to the favoured stat. */
function spendAllPoints(state: GameState): GameState {
  if (state.player.skillPoints <= 0) return state
  const favoured = favouredStat(state)
  let s = state
  while (s.player.skillPoints > 0) {
    const wanted: StatId = s.player.skillPoints % 3 === 0 ? 'pacing' : favoured
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

/**
 * Preview a finished one-shot of `draft` drawn at the player's current stats and the studio's equipment, without
 * touching the real state. The page samples are workDay's without the noise: equipment adds inside the clamp.
 */
export function hypotheticalPreview(s: GameState, draft: ProjectDraft, m: MagazineId, focus: Focus): SubmissionPreview {
  const mult = focusMultipliers(focus)
  const fx = equipmentEffects(s)
  const art = clamp(s.player.stats.art * mult.art + fx.art, 0, 100)
  const story = clamp(s.player.stats.story * mult.story + fx.story, 0, 100)
  const project: Project = {
    id: s.nextProjectId, kind: 'oneshot', chapter: 0, ...draft,
    pagesTarget: ONE_SHOT_PAGES, pagesDone: ONE_SHOT_PAGES, artSum: art * ONE_SHOT_PAGES, storySum: story * ONE_SHOT_PAGES,
    startedDay: s.day, status: 'ready', magazineId: null, submittedDay: null, resultsDay: null,
  }
  return previewSubmission({ ...s, project }, m)!
}

/**
 * SENSIBLE's next one-shot: for each magazine, the best known pairing for its readers drawn with the focus it
 * suits; keep the magazine with the best odds.
 */
function planOneShot(s: GameState): { draft: ProjectDraft; target: MagazineId } {
  let best: { draft: ProjectDraft; preview: SubmissionPreview } | null = null
  for (const m of MAGAZINES) {
    const draft = bestDraft(s, m.audience)
    const preview = hypotheticalPreview(s, draft, m.id, sensibleFocus(s, m.id))
    if (!best || betterOdds(preview, best.preview)) best = { draft, preview }
  }
  return { draft: best!.draft, target: best!.preview.magazineId }
}

/** Best forecast odds of an offer; ties go to the higher expected pay, then the softer field. */
function betterOdds(a: SubmissionPreview, b: SubmissionPreview): boolean {
  if (a.offerChance !== b.offerChance) return a.offerChance > b.offerChance
  if (a.expectedPay !== b.expectedPay) return a.expectedPay > b.expectedPay
  return magazineById(a.magazineId).rivalMean < magazineById(b.magazineId).rivalMean
}

// ---------- policies ----------

/** Plays the way the interface teaches: best odds, best known pairing, points spent, serials wrapped on a high. */
export const SENSIBLE: BotPolicy = {
  name: 'sensible',
  planDraft: planOneShot,
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
  events: 'afford',
  signsAnime: true,
  shops: true,
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
  // clicks the answer that costs no money without reading the card; never signs an anime or shops
  events: 'b',
  signsAnime: false,
  shops: false,
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
  events: null,
  signsAnime: false,
  shops: false,
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

/**
 * The candidate who draws the most pages per yen of salary among those the bank covers (two weeks of their salary on
 * top of two weeks of the studio's current costs); ties go to the earlier candidate. Undefined when none is covered.
 */
function bestAffordableHire(s: GameState): Assistant | undefined {
  const reserve = HIRE_COST_WEEKS * weeklyCosts(s)
  const affordable = s.candidates.filter((c) => s.player.money >= HIRE_SALARY_WEEKS * c.salary + reserve)
  if (!affordable.length) return undefined
  const value = (c: Assistant) => assistantPagesPerDay(c) / c.salary
  return affordable.reduce((b, c) => (value(c) > value(b) ? c : b))
}

/**
 * When the chapter on the desk will miss its issue at the studio's pace, hire `bestAffordableHire` into a free desk
 * (`studioSlots`). With every desk taken, a policy that shops and still lives in the apartment first moves to the flat
 * for a second desk, but only when the bank covers the hire after the move-in (two weeks of the flat's costs, rent
 * included, on top of two weeks of the salary); otherwise it stays put.
 */
function hireIfLate(state: GameState, p: BotPolicy): GameState {
  if (chapterDeadline(state)?.status !== 'late') return state
  let s = state
  if (s.assistants.length >= studioSlots(s)) {
    if (!p.shops || s.studio.tier !== 'apartment') return state
    s = moveStudio(s, 'flat')
    if (s === state || s.assistants.length >= studioSlots(s) || !bestAffordableHire(s)) return state
  }
  const best = bestAffordableHire(s)
  return best ? hireAssistant(s, best.id) : state
}

/** The cheapest equipment the studio may buy and does not own yet (ties: the Studio panel's order), if any. */
function nextPurchase(s: GameState): EquipmentId | undefined {
  let best: EquipmentId | undefined
  for (const e of EQUIPMENT) {
    if (s.studio.owned.includes(e.id) || (e.needsTier && !studioAtLeast(s, e.needsTier))) continue
    if (best === undefined || equipmentPrice(e.id) < equipmentPrice(best)) best = e.id
  }
  return best
}

/** A policy that shops buys `nextPurchase` once the bank holds its price and four weeks of costs: one piece a day. */
function shop(s: GameState, p: BotPolicy): GameState {
  const id = p.shops ? nextPurchase(s) : undefined
  if (id === undefined || s.player.money < equipmentPrice(id) + BUY_COST_WEEKS * weeklyCosts(s)) return s
  return buyEquipment(s, id)
}

/**
 * A policy that shops, once licensed, orders the cheapest goods run it may order for its running serial when the bank
 * holds its cost and four weeks of costs, unless `merchForecast` says it would lose money: one run a day.
 */
function orderGoods(s: GameState, p: BotPolicy): GameState {
  const ser = s.serial
  if (!p.shops || s.merch.licensedDay === null || !ser || ser.status !== 'running') return s
  let best: MerchItem | undefined
  for (const m of MERCH_ITEMS) {
    if (merchRefusal(s, m.id, ser.id) !== null) continue
    if (!best || m.cost < best.cost) best = m
  }
  if (!best || s.player.money < best.cost + BUY_COST_WEEKS * weeklyCosts(s)) return s
  // A run the forecast says loses money (net at or below zero at today's demand) is skipped.
  if (merchForecast(s, best.id, ser.id).net <= 0) return s
  return orderMerch(s, best.id, ser.id)
}

/** Answer the event on the desk the policy's way (`BotPolicy.events`). */
function answerEvent(s: GameState, p: BotPolicy): GameState {
  if (!s.event || !p.events) return s
  if (p.events === 'afford') {
    // resolveEvent returns the same state when the answer cannot be given (blocked, or what it was about is gone)
    const a = resolveEvent(s, 'a')
    if (a !== s && a.player.money >= EVENT_COST_WEEKS * weeklyCosts(a)) return a
  }
  return resolveEvent(s, 'b')
}

/** Sign the anime offer on the desk: Hoshi Animation for a young serial, Studio Kumo for one past 11 results. */
function signIfOffered(s: GameState, p: BotPolicy): GameState {
  if (!s.animeOffer || !p.signsAnime) return s
  return signAnime(s, (s.serial?.results.length ?? 0) < HOSHI_BELOW_RESULTS ? 'hoshi' : 'kumo')
}

/** The engine's log line for a week whose costs left the player below zero. */
const OVERDRAFT_LOG_PREFIX = 'Overdraft fee'

/**
 * Did this day's weekly costs leave the player in debt? Read from the overdraft entry the tick logged, not from
 * end-of-day money: a poll that pays out later in the same tick can lift the balance back above zero.
 */
function overdrawnToday(decided: GameState, next: GameState): boolean {
  return next.log.some((e) => e.id >= decided.nextLogId && e.kind === 'money' && e.text.startsWith(OVERDRAFT_LOG_PREFIX))
}

/**
 * One day's decisions, before the tick, in this order: dismiss the result; accept (or decline) the offer; read the
 * year review; answer the event; sign the anime offer; spend points; force the stress serial; wrap a serial; plan a
 * one-shot and set its focus; pitch a finished one; hire help (moving to the flat if need be) for a chapter that will
 * miss its issue; buy equipment; order goods; pick the activity.
 */
function decide(state: GameState, p: BotPolicy): GameState {
  let s = state
  if (s.pendingResult) s = dismissResult(s)
  if (s.pendingOffer) {
    const offer = s.pendingOffer
    const accepted = p.forcedSerial ? s : acceptOffer(s)
    s = accepted === s ? declineOffer(s) : setFocus(accepted, p.focusFor(accepted, offer.magazineId))
  }
  s = markReviewRead(s)
  s = answerEvent(s, p)
  s = signIfOffered(s, p)
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
  s = hireIfLate(s, p)
  s = shop(s, p)
  s = orderGoods(s, p)
  return chooseActivity(s)
}

/**
 * One bot day: dismiss the result, accept (or decline) the offer, read the year review, answer the event, sign the
 * anime offer, spend points, force the stress serial, wrap a serial, plan a one-shot and set its focus, pitch a
 * finished one, hire (or move and hire) for a late chapter, buy equipment, order goods, pick the activity, then tick.
 */
export function botStep(s: GameState, p: BotPolicy): GameState {
  return tick(decide(s, p))
}

/** Play a career until day `days`, `maxOneShots` one-shots or `until`, whichever comes first. */
export function runBot(seed: number, p: BotPolicy, opts: BotRunOptions): BotRun {
  let s = opts.start ?? createGame('Rin', seed)
  const maxOneShots = opts.maxOneShots ?? Infinity
  const oneShots: BotOneShot[] = []
  const moneyAtDay = [s.player.money]
  let weeksInDebt = 0
  let events = 0
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
    if (overdrawnToday(decided, next)) weeksInDebt++
    // an event's day is the day it landed
    if (next.event?.day === next.day) events++
    moneyAtDay.push(next.player.money)
    opts.observe?.(decided, next)
    s = next
    if (opts.until?.(s)) break
  }
  const all = s.serial ? [...s.serials, s.serial] : s.serials
  const first = oneShots.findIndex((o) => o.offer)
  return {
    oneShots,
    firstOfferAt: first < 0 ? null : first + 1,
    serials: all.map((x) => ({ magazineId: x.magazineId, startedDay: x.startedDay, results: x.results.length, status: x.status })),
    weeksInDebt,
    events,
    moneyAtDay,
    final: s,
  }
}

// ---------- metrics ----------

/** One-shots that count as a player's opening run: the balance bands judge the first six. */
export const OPENING_ONE_SHOTS = 6

/**
 * Mean score of a run's first six one-shots. A run that published fewer (a serial or the day limit came first)
 * averages the ones it did publish; null when it published none.
 */
export function firstSixMean(run: BotRun): number | null {
  const opening = run.oneShots.slice(0, OPENING_ONE_SHOTS)
  return opening.length ? opening.reduce((sum, o) => sum + o.score, 0) / opening.length : null
}
