// Top-left HUD corner: the date and time of day, the game speed, and a serial's deadline.
import { chapterDeadline, describeDate } from '../../sim'
import { isNight, useClock } from '../../state/clock'
import { useStore } from '../../state/store'
import { useShallow } from 'zustand/react/shallow'
import { Icon } from '../Icon'
import { plural } from '../format'
import { DEADLINE_TEXT } from './statusText'

export function DateBadge() {
  const day = useStore((s) => s.game!.day)
  const night = useClock((c) => isNight(c.t))
  const d = describeDate(day)
  return (
    <div className="badge-hud date">
      <b className="num">Year {d.year}, month {d.month}, week {d.week}</b>
      <span className="weekday">Day {d.day} of 7</span>
      <span className="sky" role="img" aria-label={night ? 'Night' : 'Day'}><Icon name={night ? 'moon' : 'sun'} size={16} /></span>
    </div>
  )
}

export function SpeedControl() {
  const speed = useStore((s) => s.speed)
  const setSpeed = useStore((s) => s.setSpeed)
  const blocked = useStore((s) => !!s.game!.pendingResult || !!s.game!.pendingOffer)
  return (
    <div className="seg sm speed" role="group" aria-label="Game speed" data-tutorial="speed">
      <button aria-pressed={speed === 0} onClick={() => setSpeed(0)} disabled={blocked} title="Pause (Space)" aria-label="Pause"><Icon name="pause" size={16} /></button>
      <button aria-pressed={speed === 1} onClick={() => setSpeed(1)} disabled={blocked} title="Normal speed (1)" aria-label="Normal speed"><Icon name="play" size={16} /></button>
      <button aria-pressed={speed === 2} onClick={() => setSpeed(2)} disabled={blocked} title="Double speed (2)" aria-label="Double speed"><Icon name="fast" size={16} /></button>
      <button aria-pressed={speed === 3} onClick={() => setSpeed(3)} disabled={blocked} title="Triple speed (3)" aria-label="Triple speed"><Icon name="faster" size={16} /></button>
    </div>
  )
}

export function DeadlineChip() {
  const deadline = useStore(useShallow((s) => chapterDeadline(s.game!)))
  if (!deadline) return null
  const { status, daysLeft } = deadline
  return (
    <span
      className="badge-hud deadline"
      data-tone={status === 'on-track' ? 'ok' : 'warn'}
      aria-label={`Deadline in ${plural(daysLeft, 'day')}, ${DEADLINE_TEXT[status]}`}
    >
      <Icon name="alert" size={14} /> Deadline <b className="num">{daysLeft} d</b>
    </span>
  )
}

export function TopLeft() {
  return (
    <div className="hud-corner top-left">
      <DateBadge />
      <SpeedControl />
      <DeadlineChip />
    </div>
  )
}
