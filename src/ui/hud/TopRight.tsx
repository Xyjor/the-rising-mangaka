// Top-right HUD corner: money, fans, stamina and level, each a badge over the studio.
import { LOW_STAMINA_THRESHOLD, weeklyCosts, xpToNext } from '../../sim'
import { useStore } from '../../state/store'
import { useShallow } from 'zustand/react/shallow'
import { Bar } from '../components'
import { compact, money } from '../format'
import { useRolledNumber } from '../hooks/useRolledNumber'

function MoneyBadge() {
  const { cash, costs } = useStore(useShallow((s) => ({ cash: s.game!.player.money, costs: weeklyCosts(s.game!) })))
  const rolled = useRolledNumber(cash)
  return (
    <div className={`badge-hud stat${cash < 0 ? ' neg' : ''}`}>
      <span className="lbl">Money</span>
      <b className="num">{money(rolled)}</b>
      <span className="faint tiny">−{money(costs)} a week</span>
    </div>
  )
}

function FansBadge() {
  const fans = useStore((s) => s.game!.player.fans)
  const rolledFans = useRolledNumber(fans)
  return (
    <div className="badge-hud stat">
      <span className="lbl">Fans</span>
      <b className="num">{compact(rolledFans)}</b>
    </div>
  )
}

function StaminaBadge() {
  const { stamina, max } = useStore(useShallow((s) => ({ stamina: s.game!.player.stamina, max: s.game!.player.maxStamina })))
  return (
    <div className="badge-hud stat" title={`Stamina ${Math.round(stamina)} of ${max}`}>
      <div className="head"><span className="lbl">Stamina</span><span className="num">{Math.round(stamina)}/{max}</span></div>
      <Bar value={stamina} max={max} tone={stamina < LOW_STAMINA_THRESHOLD ? 'accent' : 'green'} label="Stamina" />
    </div>
  )
}

function LevelBadge() {
  const openModal = useStore((s) => s.openModal)
  const { level, xp, points } = useStore(useShallow((s) => ({
    level: s.game!.player.level, xp: s.game!.player.xp, points: s.game!.player.skillPoints,
  })))
  const next = xpToNext(level)
  const xpText = `${xp}/${next}`
  return (
    <button className="badge-hud stat as-button" onClick={() => openModal('stats')} title="Open stats (S)">
      <div className="head">
        <span className="lbl">Level {level}<span className="not-phone">{points ? `, ${points} points to spend` : ''}</span></span>
        <span className="num">
          <span className="not-phone">{xpText}</span>
          <span className="only-phone">{points > 0 ? `${points} pts` : xpText}</span>
        </span>
      </div>
      <Bar value={xp} max={next} tone="purple" label="Experience" />
    </button>
  )
}

export function TopRight() {
  return (
    <div className="hud-corner top-right">
      <MoneyBadge />
      <FansBadge />
      <StaminaBadge />
      <LevelBadge />
    </div>
  )
}
