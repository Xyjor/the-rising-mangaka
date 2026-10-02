import { nextMilestone } from '../sim'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import '../styles/career.css'

/** The next milestone on the ladder, pinned to the top of the desk. Hidden while away on a trip. */
export function NextGoal() {
  const m = useStore((s) => (s.game ? nextMilestone(s.game) : null))
  const trip = useStore((s) => !!s.game?.trip)
  const openModal = useStore((s) => s.openModal)
  if (!m || trip) return null
  return (
    <div className="card flat next-goal" role="note" data-tutorial="next-goal">
      <Icon name="star" />
      <div className="grow">
        <span className="lbl">Next goal</span>
        <div className="small"><b>{m.title}.</b> {m.hint}</div>
      </div>
      <button className="btn ghost sm" onClick={() => openModal('career')}>Career</button>
    </div>
  )
}
