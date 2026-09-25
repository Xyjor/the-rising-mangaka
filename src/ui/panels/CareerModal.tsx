import { MILESTONES, awardById, describeDate, doneIds, rivalRecord } from '../../sim'
import { useStore } from '../../state/store'
import { Icon } from '../Icon'
import { Modal } from '../components'
import { rivalCareerLine, yearCareerLine } from '../labels'
import '../../styles/career.css'

/** The career so far: the rival, the awards won and every past year, then the milestone ladder. */
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
      <section className="card flat career-section" aria-labelledby="career-awards">
        <div className="lbl" id="career-awards">Awards</div>
        {game.awards.length > 0 ? (
          <ul className="year-list plain small">
            {game.awards.map((a) => (
              <li key={`${a.id}-${a.year}`} className="year-award">
                <Icon name="trophy" size={16} />{awardById(a.id).name}, year {a.year}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small">No awards yet. Awards are handed out when year {describeDate(game.day).year} ends.</p>
        )}
      </section>
      {game.yearReviews.length > 0 && (
        <section className="card flat career-section" aria-labelledby="career-years">
          <div className="lbl" id="career-years">Past years</div>
          <ul className="year-list plain small">
            {game.yearReviews.map((r) => <li key={r.year}>{yearCareerLine(r)}</li>)}
          </ul>
        </section>
      )}
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
