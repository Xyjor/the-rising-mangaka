import { describeDate, weeklyCosts, xpToNext } from '../sim'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import { Bar, compact, money } from './components'

export function Hud() {
  const game = useStore((s) => s.game)!
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)
  const openModal = useStore((s) => s.openModal)
  const d = describeDate(game.day)
  const p = game.player
  const blocked = !!game.pendingResult || !!game.pendingOffer
  const costs = weeklyCosts(game)

  return (
    <header className="hud">
      <div className="logo" aria-label="The Rising Mangaka">Rising Mangaka</div>

      <div className="date" aria-live="polite">
        <b className="num">Year {d.year}, month {d.month}</b>
        <span>Week {d.week}, day {d.day}</span>
      </div>

      <div className="hud-stat" title={`Weekly costs: ${money(costs)}`}>
        <span className="label">Money</span>
        <span className={`value ${p.money < 0 ? 'neg' : ''}`}>{money(p.money)}</span>
      </div>
      <div className="hud-stat">
        <span className="label">Fans</span>
        <span className="value">{compact(p.fans)}</span>
      </div>

      <div className="hud-bar" title={`Stamina ${Math.round(p.stamina)} of ${p.maxStamina}`}>
        <div className="label"><span>Stamina</span><span className="num">{Math.round(p.stamina)}/{p.maxStamina}</span></div>
        <Bar value={p.stamina} max={p.maxStamina} tone={p.stamina < 20 ? 'accent' : 'green'} label="Stamina" />
      </div>

      <button className="hud-bar as-button" onClick={() => openModal('stats')} title="Open stats (S)">
        <div className="label">
          <span>Level {p.level}{p.skillPoints > 0 ? `, ${p.skillPoints} points to spend` : ''}</span>
          <span className="num">{p.xp}/{xpToNext(p.level)}</span>
        </div>
        <Bar value={p.xp} max={xpToNext(p.level)} tone="purple" label="Experience" />
      </button>

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
