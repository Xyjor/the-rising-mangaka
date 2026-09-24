// Balance readout: simulate a career and print the numbers.
// Run with: npx vite-node scripts/balance.ts [seed]
import {
  acceptOffer, createGame, dismissResult, getPhase, hireAssistant, setActivity, startProject, submitProject,
  tick, tickMany,
} from '../src/sim/index'
import type { GameState } from '../src/sim/index'

let s = createGame('Rin', Number(process.argv[2] ?? 42))
const mags = ['weekly-bolt', 'kids-comic', 'monthly-petal', 'ultra-seinen'] as const
const combos = [
  { genre: 'action', theme: 'samurai', audience: 'teens' },
  { genre: 'mystery', theme: 'detective', audience: 'adults' },
  { genre: 'horror', theme: 'cooking', audience: 'kids' },
  { genre: 'romance', theme: 'school', audience: 'teens' },
  { genre: 'action', theme: 'samurai', audience: 'teens' },
  { genre: 'scifi', theme: 'space', audience: 'young-adults' },
] as const

function autoDay(state: GameState): GameState {
  // A simple player policy: rest under 20 stamina, otherwise work.
  const st = state.player.stamina < 20 ? 'rest' : 'work'
  return tick(setActivity(state, st))
}

console.log('--- one-shots, solo ---')
for (let i = 0; i < combos.length; i++) {
  const c = combos[i]
  const start = s.day
  s = startProject(s, { title: 'W' + i, ...c })
  while (getPhase(s) !== 'ready') s = autoDay(s)
  const days = s.day - start
  s = submitProject(s, mags[i % 4])
  s = tickMany(s, 7)
  const r = s.pendingResult!
  const b = r.breakdown
  console.log(
    `work ${i}: ${days}d | ${c.genre}/${c.theme}/${c.audience} @${mags[i % 4]} | score ${r.score} rank ${r.rank}/${r.entrants}` +
    ` | +¥${r.rewards.money} +${r.rewards.fans}f +${r.rewards.xp}xp | art ${b.art} story ${b.story} pace ${b.pacing} fit ${b.audienceFit} fresh ${b.freshness}` +
    ` | ¥${s.player.money} L${s.player.level} sp${s.player.skillPoints} offer:${s.pendingOffer ? 'yes' : 'no'}`,
  )
  s = dismissResult(s)
  s = { ...s, pendingOffer: null }
}

console.log('--- hire an assistant, force a serial ---')
s = hireAssistant(s, s.candidates[0].id)
s = { ...s, pendingOffer: { magazineId: 'weekly-bolt', title: 'Blade Club', genre: 'action', theme: 'samurai', audience: 'teens' } }
s = acceptOffer(s)
const start = s.day
let lastLogged = 0
while (s.serial && s.serial.status === 'running' && s.day - start < 336) {
  s = autoDay(s)
  const ser = s.serial
  if (ser && ser.results.length > lastLogged) {
    lastLogged = ser.results.length
    const r = ser.results[ser.results.length - 1]
    console.log(
      `ch${r.chapter} d${s.day - start}: rank ${r.rank}/${r.entrants} score ${r.score} fresh ${r.breakdown.freshness} | pop ${ser.popularity} warn ${ser.warnings} vols ${ser.volumes}` +
      ` | +¥${r.rewards.money} | ¥${s.player.money} fans ${s.player.fans} L${s.player.level}`,
    )
  }
}
console.log(`serial status: ${s.serial?.status ?? s.serials[0]?.status}, money ¥${s.player.money}, fans ${s.player.fans}, level ${s.player.level}`)
