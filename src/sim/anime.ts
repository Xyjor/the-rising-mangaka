// Anime adaptations: a hit serial is offered one adaptation by two studios, waiting on the desk as a card (never a
// popup). A signed deal pays fans and money at the end of every week on air, lifts popularity once at the premiere
// if the series still runs, and multiplies the serial's volume copies from the premiere until `tailWeeks` after the
// finale (`animeVolumeMult`, read by the engine's volume sales). Runs in tick() after closeYear, before eventTick
// (DESIGN.md "Tick order"). No RNG. No imports from engine.ts: engine imports this file.
//
// The offer is for a running series: wrapping it up withdraws a waiting offer at once (endSerial calls
// `withdrawAnimeOffer`), and a cancellation withdraws it in the same tick. Whatever happens to an offer, its serial
// stays in `animeOfferedFor`, so studios ask once per series. Log lines only speak of volume sales while the series
// runs: an ended one ships no more volumes.
import { addLog, num, yen } from './core'
import { ANIME_OFFER_DAYS, ANIME_OFFER_MIN_COPIES, ANIME_OFFER_MIN_POPULARITY, animeStudioById } from './data'
import type { AnimeDeal, AnimeStudioId, GameState, Serial } from './types'

const WEEK = 7

function serialById(s: GameState, id: number): Serial | undefined {
  return (s.serial ? [s.serial, ...s.serials] : s.serials).find((x) => x.id === id)
}

/** The serial `id` when it is the one running now. */
function runningSerial(s: GameState, id: number): Serial | undefined {
  return s.serial && s.serial.id === id && s.serial.status === 'running' ? s.serial : undefined
}

function titleOf(s: GameState, id: number): string {
  return serialById(s, id)?.title ?? 'your series'
}

/** The deal signed for `serialId`, if there is one (studios ask once per series, so there is at most one). */
export function animeDealFor(s: GameState, serialId: number): AnimeDeal | undefined {
  return s.anime.find((d) => d.serialId === serialId)
}

/** Is the deal's volume boost on `day`? From the premiere to the end of its tail, both days included. */
function boostOn(d: AnimeDeal, day: number): boolean {
  return d.airsDay <= day && day <= d.tailEndsDay
}

/** How many times the copies `serialId`'s volumes sell today: the deal's multiplier while its boost is on, else 1. */
export function animeVolumeMult(s: GameState, serialId: number): number {
  const d = s.anime.find((x) => x.serialId === serialId && boostOn(x, s.day))
  return d ? animeStudioById(d.studio).volumeMult : 1
}

/** True while an anime's volume boost is on, from its premiere to its tail's end: the studio hangs its poster. */
export function animeOnShow(s: GameState): boolean {
  return s.anime.some((d) => boostOn(d, s.day))
}

/** Sign the waiting offer with `studio`. Refused with no offer waiting or once its series has stopped running. */
export function signAnime(s: GameState, studio: AnimeStudioId): GameState {
  const o = s.animeOffer
  const ser = o && runningSerial(s, o.serialId)
  if (!o || !ser) return s
  const st = animeStudioById(studio)
  const airsDay = s.day + st.airsAfterWeeks * WEEK
  const endsDay = airsDay + st.runsWeeks * WEEK
  const deal: AnimeDeal = {
    studio, serialId: o.serialId, signedDay: s.day, airsDay, endsDay, tailEndsDay: endsDay + st.tailWeeks * WEEK,
  }
  const next: GameState = {
    ...s, anime: [...s.anime, deal], animeOffer: null, player: { ...s.player, money: s.player.money + st.fee },
  }
  const fee = st.fee ? `: +${yen(st.fee)}` : ''
  return addLog(next, 'series', `You signed with ${st.name}${fee}. The "${ser.title}" anime airs in ${st.airsAfterWeeks} weeks.`, true)
}

/** Pass on the waiting offer. Its series stays in `animeOfferedFor`: no second offer. */
export function declineAnime(s: GameState): GameState {
  const o = s.animeOffer
  if (!o) return s
  const text = `You passed on the anime offer for "${titleOf(s, o.serialId)}". Studios ask once per series.`
  return addLog({ ...s, animeOffer: null }, 'series', text, false)
}

/** Withdraw a waiting offer whose series is no longer running (wrapped up or cancelled). */
export function withdrawAnimeOffer(s: GameState): GameState {
  const o = s.animeOffer
  if (!o || runningSerial(s, o.serialId)) return s
  const text = `The anime offer for "${titleOf(s, o.serialId)}" was withdrawn: the series is over.`
  return addLog({ ...s, animeOffer: null }, 'series', text, false)
}

/** One deal's day: the premiere, a week's pay, the finale, or the day after its volume boost ends. */
function dealDay(state: GameState, d: AnimeDeal): GameState {
  const st = animeStudioById(d.studio)
  const title = titleOf(state, d.serialId)
  const weekly = `+${num(st.weeklyFans)} fans and ${yen(st.weeklyMoney)} a week for ${st.runsWeeks} weeks`
  let s = state
  if (s.day === d.airsDay) {
    const ser = runningSerial(s, d.serialId)
    let lift = '. The series is over, so popularity stays put'
    let boost = ''
    if (ser) {
      const popularity = Math.min(100, ser.popularity + st.premierePopularity)
      lift = popularity > ser.popularity ? `: popularity +${popularity - ser.popularity}` : ': popularity is already 100'
      boost = ` Volumes sell ${st.volumeMult}x from today.`
      s = { ...s, serial: { ...ser, popularity } }
    }
    s = addLog(s, 'series', `The "${title}" anime premieres today${lift}. It brings ${weekly}.${boost}`, true)
  }
  const onAir = s.day - d.airsDay
  if (onAir > 0 && s.day <= d.endsDay && onAir % WEEK === 0) {
    s = { ...s, player: { ...s.player, fans: s.player.fans + st.weeklyFans, money: s.player.money + st.weeklyMoney } }
    const text = `The "${title}" anime, week ${onAir / WEEK} of ${st.runsWeeks}: +${num(st.weeklyFans)} fans, +${yen(st.weeklyMoney)}.`
    s = addLog(s, 'money', text, false)
  }
  if (s.day === d.endsDay) {
    const total = `+${num(st.weeklyFans * st.runsWeeks)} fans and +${yen(st.weeklyMoney * st.runsWeeks)} in all`
    const boost = runningSerial(s, d.serialId) ? ` Volumes sell ${st.volumeMult}x for ${st.tailWeeks} more weeks.` : ''
    s = addLog(s, 'series', `The "${title}" anime ended after ${st.runsWeeks} weeks: ${total}.${boost}`, true)
  }
  if (s.day === d.tailEndsDay + 1 && runningSerial(s, d.serialId)) {
    s = addLog(s, 'series', `Volumes of "${title}" sell at the normal rate again: the anime boost is over.`, false)
  }
  return s
}

/** May the running serial be offered an adaptation today? */
function offerDue(s: GameState): Serial | undefined {
  const ser = s.serial
  if (!ser || ser.status !== 'running' || s.animeOffer || s.animeOfferedFor.includes(ser.id)) return undefined
  if (ser.popularity < ANIME_OFFER_MIN_POPULARITY || ser.totalCopies < ANIME_OFFER_MIN_COPIES) return undefined
  // one adaptation at a time: none until every earlier deal's volume boost has ended, counting a deal not yet on air
  return s.anime.some((d) => s.day <= d.tailEndsDay) ? undefined : ser
}

/**
 * Once a day, after checkDeadline: withdraw an offer whose series stopped running, lapse one past its last day (a log
 * line), run every deal's day, then offer an adaptation to a running hit (popularity 70+, 15,000+ copies sold) that
 * has never been offered one, with no offer waiting and no earlier deal short of its tail's end (signed, on air, or
 * in its volume boost). Consumes no RNG.
 */
export function animeTick(state: GameState): GameState {
  let s = withdrawAnimeOffer(state)
  const o = s.animeOffer
  if (o && s.day > o.expiresDay) {
    s = addLog({ ...s, animeOffer: null }, 'series', `The anime offer for "${titleOf(s, o.serialId)}" lapsed. Studios ask once per series.`, false)
  }
  for (const d of s.anime) s = dealDay(s, d)
  const ser = offerDue(s)
  if (!ser) return s
  s = {
    ...s,
    animeOffer: { serialId: ser.id, expiresDay: s.day + ANIME_OFFER_DAYS },
    animeOfferedFor: [...s.animeOfferedFor, ser.id],
  }
  return addLog(s, 'series', `Two anime studios want to adapt "${ser.title}". Answer on your desk within ${ANIME_OFFER_DAYS} days.`, true)
}
