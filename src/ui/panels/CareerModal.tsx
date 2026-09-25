import { MILESTONES, doneIds, rivalRecord } from '../../sim'
import { useStore } from '../../state/store'
import { Icon } from '../Icon'
import { Modal } from '../components'
import { rivalCareerLine } from '../labels'
import '../../styles/career.css'

/** The milestone ladder: what has been reached, what is next, and what each goal pays. */
export function CareerModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const done = doneIds(game)
  const nextId = MILESTONES.find((m) => !done.includes(m.id))?.id ?? null

  return (
    <Modal title="Career" sub={`${done.length} of ${MILESTONES.length} goals reached`} onClose={closeModal} narrow>
      <section className="card flat career-rival" aria-labelledby="career-rival">
        <div className="lbl" id="career-rival">Rival</div>
        <p className="small">{rivalCareerLine(game.rival, rivalRecord(game))}</p>
      </section>
      <ol className="career-list" aria-label="Milestones">
        {MILESTONES.map((m, i) => {
          const isDone = done.includes(m.id)
          const isNext = m.id === nextId
          return (
            <li key={m.id} className={`career-row ${isDone ? 'done muted' : ''} ${isNext ? 'next' : ''}`}>
              <span className="idx" aria-label={isDone ? 'Reached' : `Goal ${i + 1}`}>
                {isDone ? <Icon name="check" size={16} /> : i + 1}
              </span>
              <div className="grow">
                <div><b>{m.title}</b></div>
                <div className="small">{m.hint}</div>
              </div>
              <div className="chips">
                {isNext && <span className="chip gold">Next</span>}
                <span className="chip">+{m.xp} XP</span>
              </div>
            </li>
          )
        })}
      </ol>
    </Modal>
  )
}
