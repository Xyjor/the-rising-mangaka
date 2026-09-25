// State helpers shared by the engine and the tick hooks that live beside it (events.ts, studio.ts), so neither has to
// import the other, and the locale-free number formatting their log lines use. Everything here is a pure function.
import { placeById } from './data'
import type { GameState, LogKind, PlaceId } from './types'

/** Whole numbers with thousands commas, without locale formatting (the sim stays locale-free). */
export function num(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Yen for log lines and answers: "¥2,500", "-¥15,000". */
export function yen(n: number): string {
  return n < 0 ? `-¥${num(-n)}` : `¥${num(n)}`
}

export function xpToNext(level: number): number {
  return 100 + (level - 1) * 60
}

export function addLog(state: GameState, kind: LogKind, text: string, toast: boolean): GameState {
  const entry = { id: state.nextLogId, day: state.day, kind, text, toast }
  const log = state.log.length >= 300 ? [...state.log.slice(-299), entry] : [...state.log, entry]
  return { ...state, log, nextLogId: state.nextLogId + 1 }
}

export function grantXp(state: GameState, amount: number): GameState {
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
