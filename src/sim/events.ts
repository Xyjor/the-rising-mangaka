// Random events: one decision at a time, waiting on the desk as a card (never a popup). Rolled once a week from their
// own seed (`eventSeed`), so an event landing or not never moves the main `seed` stream. An event nobody answers
// lapses after EVENT_ANSWER_DAYS and nothing happens. Runs in tick() after checkDeadline, before awardMilestones
// (DESIGN.md "Tick order"). No imports from engine.ts: engine imports this file.
//
// A pending event survives a trip: the card stays on the desk and every answer except a new trip can be given from
// the road. While away no new event is rolled, and an unanswered one still lapses on time.
import { addLog, startTrip } from './core'
import {
  EVENT_ANSWER_DAYS, EVENT_CHANCE, EVENT_GAP_DAYS, EVENT_ROLL_WEEKDAY, VOLUME_PRICE, placeById,
} from './data'
import { clamp, draw } from './rng'
import type { Assistant, EventId, GameEvent, GameState, PlaceId, PlayerStats, Serial, StatId } from './types'

/** Every event, in the order the pool lists them (the second draw indexes into the eligible ones). */
export const EVENT_IDS: readonly EventId[] = ['letter', 'cold', 'convention', 'raise', 'reprint', 'workshop']

/** What seeing a doctor about a cold costs. */
const DOCTOR_FEE = 300

/** Stat names for log lines and answers. */
export const STAT_NAME: Record<StatId, string> = { art: 'Art', story: 'Story', pacing: 'Pacing' }

/** Fans a written-back letter brings: 2% of fans, at least 50, at most 1,500. */
export function letterFans(fans: number): number {
  return clamp(Math.round(fans * 0.02), 50, 1500)
}

/** Fans the convention brings on return: 150 plus 4% of fans, at most 5,000. */
export function conventionFans(fans: number): number {
  return Math.min(5000, 150 + Math.round(fans * 0.04))
}

/** The weekly salary after a raise: 20% more, rounded to the nearest ¥10. */
export function raisedSalary(salary: number): number {
  return Math.round((salary * 1.2) / 10) * 10
}

/** The stat the masterclass works on: the lowest, ties going to art, then story, then pacing. */
export function lowestStat(stats: PlayerStats): StatId {
  const order: StatId[] = ['art', 'story', 'pacing']
  return order.reduce((low, k) => (stats[k] < stats[low] ? k : low))
}

/** Money a reprint pays: `share` of the serial's average copies a volume, at the volume price. */
function reprintMoney(ser: Serial, share: number): number {
  return Math.round((ser.totalCopies / ser.volumes) * share) * VOLUME_PRICE
}

/** Whole numbers with thousands commas, without locale formatting (the sim stays locale-free). */
function num(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function yen(n: number): string {
  return n < 0 ? `-¥${num(-n)}` : `¥${num(n)}`
}

/** The first assistant who has not asked for a raise yet. */
function raiseCandidate(s: GameState): Assistant | undefined {
  return s.assistants.find((a) => !a.raised)
}

/** The serial a reprint is for: the current one if it has shipped a volume, else the latest archived one that has. */
function reprintCandidate(s: GameState): Serial | undefined {
  const serials = s.serial ? [s.serial, ...[...s.serials].reverse()] : [...s.serials].reverse()
  return serials.find((x) => x.volumes >= 1)
}

function serialById(s: GameState, id: number | undefined): Serial | undefined {
  return (s.serial ? [s.serial, ...s.serials] : s.serials).find((x) => x.id === id)
}

/** The events that could land today, in EVENT_IDS order. A cold is always possible, so the pool is never empty. */
export function eligibleEvents(s: GameState): EventId[] {
  const p = s.player
  const ok: Record<EventId, boolean> = {
    letter: p.fans >= 300,
    cold: true,
    convention: p.fans >= 1000 && p.money >= placeById('convention').cost,
    raise: !!raiseCandidate(s),
    reprint: !!reprintCandidate(s),
    workshop: p.level >= 3 && p.money >= placeById('masterclass').cost,
  }
  return EVENT_IDS.filter((id) => ok[id])
}

// ---------- the card ----------

export interface EventChoice {
  /** what the button says: the answer and every effect it has, e.g. "Write back: fans +200, stamina -5" */
  label: string
  /** the trip this answer starts, or null */
  trip: PlaceId | null
  /** why this answer cannot be given right now, or null when it can */
  blocked: string | null
}

/** The waiting event as the desk card shows it. */
export interface EventPrompt {
  id: EventId
  title: string
  body: string
  a: EventChoice
  b: EventChoice
}

/** Blocks an answer that costs more than the player has, or starts a trip while already away. */
function choice(s: GameState, label: string, cost = 0, trip: PlaceId | null = null): EventChoice {
  const blocked = trip && s.trip
    ? 'You are away. Answer when you are back.'
    : s.player.money < cost ? `Need ${yen(cost - s.player.money)} more.` : null
  return { label, trip, blocked }
}

/**
 * The waiting event's title, body and two answers, with the effects worked out for the current state. Null when no
 * event is waiting, or when what it was about is gone (an assistant who left, a serial no longer on record).
 */
export function eventChoices(s: GameState): EventPrompt | null {
  const ev = s.event
  if (!ev) return null
  const p = s.player
  switch (ev.id) {
    case 'letter':
      return {
        id: ev.id,
        title: 'A fan letter arrived',
        body: 'A reader says your manga got them through a hard week. Write back and they will tell their friends.',
        a: choice(s, `Write back: fans +${num(letterFans(p.fans))}, stamina -5`),
        b: choice(s, 'Keep it: stamina +8'),
      }
    case 'cold':
      return {
        id: ev.id,
        title: 'You caught a cold',
        body: 'Your head is heavy and the lines will not come out straight.',
        a: choice(s, `See a doctor: ${yen(-DOCTOR_FEE)}, stamina +25`, DOCTOR_FEE),
        b: choice(s, 'Tea and an early night: stamina +8'),
      }
    case 'convention': {
      const place = placeById('convention')
      return {
        id: ev.id,
        title: 'A convention table is free',
        body: 'A comic convention has one table left in the artist alley, and readers queue by the hundreds.',
        a: choice(s, `Book a table: ${yen(-place.cost)}, fans +${num(conventionFans(p.fans))}`, place.cost, place.id),
        b: choice(s, 'Skip it'),
      }
    }
    case 'raise': {
      const a = s.assistants.find((x) => x.id === ev.assistantId)
      if (!a) return null
      const salary = raisedSalary(a.salary)
      return {
        id: ev.id,
        title: `${a.name} asks for a raise`,
        body: `${a.name} has been with the studio a while and asks for ${yen(salary)} a week instead of ${yen(a.salary)}.`,
        a: choice(s, `Give the raise: ${yen(salary)} a week, ${a.name}'s art and story +3`),
        b: choice(s, `Not this year: ${a.name}'s max stamina -10`),
      }
    }
    case 'reprint': {
      const ser = serialById(s, ev.serialId)
      if (!ser || ser.volumes < 1) return null
      const avg = Math.round(ser.totalCopies / ser.volumes)
      return {
        id: ev.id,
        title: 'The publisher wants a reprint',
        body: `The volumes of "${ser.title}" sold ${num(avg)} copies each on average. A new colour page would sell more.`,
        a: choice(s, `Approve: +${yen(reprintMoney(ser, 0.25))}`),
        b: choice(s, `Colour page: stamina -12, +${yen(reprintMoney(ser, 0.4))}`),
      }
    }
    case 'workshop': {
      const place = placeById('masterclass')
      const stat = lowestStat(p.stats)
      return {
        id: ev.id,
        title: 'You are invited to a masterclass',
        body: 'A veteran mangaka is teaching for three days, and works on whatever you are weakest at.',
        a: choice(s, `Attend: ${yen(-place.cost)}, ${STAT_NAME[stat].toLowerCase()} +3 (your lowest stat)`, place.cost, place.id),
        b: choice(s, 'Decline'),
      }
    }
  }
}

// ---------- answering ----------

function addStamina(s: GameState, delta: number): GameState {
  return { ...s, player: { ...s.player, stamina: clamp(s.player.stamina + delta, 0, s.player.maxStamina) } }
}

function updateAssistant(s: GameState, id: number, fn: (a: Assistant) => Assistant): GameState {
  return { ...s, assistants: s.assistants.map((a) => (a.id === id ? fn(a) : a)) }
}

/**
 * Answer the waiting event with 'a' or 'b'. Does nothing when no event is waiting, when what it was about is gone,
 * or when the answer is blocked (not enough money, or a trip while already away), so money never goes below zero.
 */
export function resolveEvent(state: GameState, key: 'a' | 'b'): GameState {
  const ev = state.event
  const prompt = eventChoices(state)
  if (!ev || !prompt || prompt[key].blocked) return state
  const s: GameState = { ...state, event: null }
  const a = key === 'a'
  const fans = s.player.fans
  switch (ev.id) {
    case 'letter': {
      if (!a) return addLog(addStamina(s, 8), 'event', 'You kept the letter by the desk. Stamina +8.', true)
      const gain = letterFans(fans)
      const next = addStamina({ ...s, player: { ...s.player, fans: fans + gain } }, -5)
      return addLog(next, 'event', `You wrote back. Fans +${num(gain)}, stamina -5.`, true)
    }
    case 'cold': {
      if (!a) return addLog(addStamina(s, 8), 'event', 'Tea and an early night. Stamina +8.', true)
      const next = addStamina({ ...s, player: { ...s.player, money: s.player.money - DOCTOR_FEE } }, 25)
      return addLog(next, 'event', `The doctor sorted you out. ${yen(-DOCTOR_FEE)}, stamina +25.`, true)
    }
    case 'convention':
      return a ? startTrip(s, 'convention') : addLog(s, 'event', 'You skipped the convention.', false)
    case 'raise': {
      const who = s.assistants.find((x) => x.id === ev.assistantId)!
      if (a) {
        const salary = raisedSalary(who.salary)
        const next = updateAssistant(s, who.id, (x) => ({
          ...x, salary, art: Math.min(100, x.art + 3), story: Math.min(100, x.story + 3), raised: true,
        }))
        return addLog(next, 'event', `${who.name} now earns ${yen(salary)} a week. Art and story +3.`, true)
      }
      const next = updateAssistant(s, who.id, (x) => {
        const maxStamina = x.maxStamina - 10
        return { ...x, maxStamina, stamina: clamp(x.stamina, 0, maxStamina), raised: true }
      })
      return addLog(next, 'event', `${who.name} took the news quietly. Max stamina -10.`, true)
    }
    case 'reprint': {
      const ser = serialById(s, ev.serialId)!
      const money = reprintMoney(ser, a ? 0.25 : 0.4)
      const paid: GameState = { ...s, player: { ...s.player, money: s.player.money + money } }
      return a
        ? addLog(paid, 'event', `The reprint of "${ser.title}" earned +${yen(money)}.`, true)
        : addLog(addStamina(paid, -12), 'event', `Your colour page sold the reprint of "${ser.title}": +${yen(money)}, stamina -12.`, true)
    }
    case 'workshop':
      return a ? startTrip(s, 'masterclass') : addLog(s, 'event', 'You declined the masterclass.', false)
  }
}

// ---------- the daily hook ----------

/** The log line for an event nobody answered. */
function lapseText(s: GameState, ev: GameEvent): string {
  switch (ev.id) {
    case 'letter': return 'The fan letter went unanswered. Nothing changed.'
    case 'cold': return 'The cold passed on its own. Nothing changed.'
    case 'convention': return 'The convention went ahead without you. Nothing changed.'
    case 'raise': {
      const who = s.assistants.find((x) => x.id === ev.assistantId)
      return `${who ? who.name : 'Your assistant'} stopped asking about the raise. Nothing changed.`
    }
    case 'reprint': return 'The reprint offer lapsed. Nothing changed.'
    case 'workshop': return 'The masterclass filled up without you. Nothing changed.'
  }
}

/**
 * Once a day, after checkDeadline: an event past its last day lapses (a log line, nothing else). Then, on days where
 * day % 7 is EVENT_ROLL_WEEKDAY, from `nextEventDay` on, with no event waiting and no trip under way, two values are
 * drawn from `eventSeed`: the first under EVENT_CHANCE lands an event, the second picks it from the eligible pool.
 */
export function eventTick(state: GameState): GameState {
  let s = state
  const pending = s.event
  if (pending && s.day > pending.expiresDay) s = addLog({ ...s, event: null }, 'event', lapseText(s, pending), false)
  if (s.day % 7 !== EVENT_ROLL_WEEKDAY || s.day < s.nextEventDay || s.event || s.trip) return s
  const { values, seed } = draw(s.eventSeed, 2)
  s = { ...s, eventSeed: seed }
  const pool = eligibleEvents(s)
  if (values[0] >= EVENT_CHANCE || !pool.length) return s
  const id = pool[Math.floor(values[1] * pool.length)]
  const event: GameEvent = { id, day: s.day, expiresDay: s.day + EVENT_ANSWER_DAYS }
  if (id === 'raise') event.assistantId = raiseCandidate(s)!.id
  if (id === 'reprint') event.serialId = reprintCandidate(s)!.id
  s = { ...s, event, nextEventDay: s.day + EVENT_GAP_DAYS }
  return addLog(s, 'event', `${eventChoices(s)!.title}. Answer on your desk within ${EVENT_ANSWER_DAYS} days.`, true)
}
