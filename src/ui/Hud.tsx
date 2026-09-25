import { LOW_STAMINA_THRESHOLD, describeDate, weeklyCosts, xpToNext } from '../sim'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import { Bar } from './components'
import { compact, money } from './format'

export function Hud() {
  const game = useStore((s) => s.game)!
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)
  const openModal = useStore((s) => s.openModal)
  const d = describeDate(game.day)
  const p = game.player
  const blocked = !!game.pendingResult || !!game.pendingOffer
  const costs = weeklyCosts(game)
  const points = p.skillPoints
  const xp = `${p.xp}/${xpToNext(p.level)}`

  return (
    <header className="hud">
      <div className="logo"><span className="sr-only">The </span>Rising Mangaka</div>

      <div className="date">
        <b className="num">Year {d.year}, month {d.month}</b>
        <span>Week {d.week}, day {d.day}</span>
      </div>

      <div className="hud-stats">
        <div className="hud-stat">
          <span className="label">Money <span className="faint not-phone">−{money(costs)} a week</span></span>
          <span className={`value ${p.money < 0 ? 'neg' : ''}`}>{money(p.money)}</span>
        </div>
        <div className="hud-stat">
          <span className="label">Fans</span>
          <span className="value">{compact(p.fans)}</span>
        </div>

        <div className="hud-bar" title={`Stamina ${Math.round(p.stamina)} of ${p.maxStamina}`}>
          <div className="label"><span>Stamina</span><span className="num">{Math.round(p.stamina)}/{p.maxStamina}</span></div>
          <Bar value={p.stamina} max={p.maxStamina} tone={p.stamina < LOW_STAMINA_THRESHOLD ? 'accent' : 'green'} label="Stamina" />
        </div>

        <button className="hud-bar as-button" onClick={() => openModal('stats')} title="Open stats (S)">
          <div className="label">
            <span>Level {p.level}<span className="not-phone">{points ? `, ${points} points to spend` : ''}</span></span>
            <span className="num">
              <span className="not-phone">{xp}</span>
              <span className="only-phone">{points > 0 ? `${points} pts` : xp}</span>
            </span>
          </div>
          <Bar value={p.xp} max={xpToNext(p.level)} tone="purple" label="Experience" />
        </button>
      </div>

      <div className="spacer" />

      <div className="seg sm speed" role="group" aria-label="Game speed">
        <button aria-pressed={speed === 0} onClick={() => setSpeed(0)} disabled={blocked} title="Pause (Space)" aria-label="Pause"><Icon name="pause" size={16} /></button>
        <button aria-pressed={speed === 1} onClick={() => setSpeed(1)} disabled={blocked} title="Normal speed (1)" aria-label="Normal speed"><Icon name="play" size={16} /></button>
        <button aria-pressed={speed === 2} onClick={() => setSpeed(2)} disabled={blocked} title="Double speed (2)" aria-label="Double speed"><Icon name="fast" size={16} /></button>
        <button aria-pressed={speed === 3} onClick={() => setSpeed(3)} disabled={blocked} title="Triple speed (3)" aria-label="Triple speed"><Icon name="faster" size={16} /></button>
      </div>

      <button className="btn ghost icon" onClick={() => openModal('settings')} aria-label="Settings" title="Settings">
        <Icon name="gear" />
      </button>
    </header>
  )
}
