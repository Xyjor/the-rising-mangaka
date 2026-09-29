import { useEffect } from 'react'
import { AWARDS, awardById } from '../../sim'
import { useStore } from '../../state/store'
import { Modal, Reward } from '../components'
import { compact } from '../format'
import { awardRule, nearMissText, prizeText, rivalYearLine, yearGain, yearLevels, yearSummary } from '../labels'
import '../../styles/career.css'
import { PixelArt } from '../art/PixelArt'
import { AWARD_ART, RIVAL_ART } from '../art/registry'

/**
 * The latest year review: the year in numbers, the awards won with their prizes and what won them, the near misses,
 * and the rival's year. Opening it marks the review read, so its desk card goes.
 */
export function YearModal() {
  const r = useStore((s) => s.game?.yearReviews.at(-1) ?? null)
  const temper = useStore((s) => s.game?.rival.temper)
  const closeModal = useStore((s) => s.closeModal)
  const markReviewRead = useStore((s) => s.markReviewRead)
  useEffect(() => { markReviewRead() }, [markReviewRead])
  if (!r) return null
  const best = r.bestOneShot
  const summary = yearSummary(r)
  const sub = summary.charAt(0).toUpperCase() + summary.slice(1)

  return (
    <Modal title={`Year ${r.year} in review`} sub={sub} onClose={closeModal} narrow>
      <section className="rewards" aria-label="The year in numbers">
        <Reward value={yearGain(r.moneyDelta, 'money')} label="Money" />
        <Reward value={yearGain(r.fansDelta, 'count')} label="Fans" />
        <Reward value={yearLevels(r)} label="Level" />
        <Reward value={r.oneShots} label="One-shots" />
        <Reward value={r.chapters} label="Chapters" />
        <Reward value={r.volumes} label="Volumes" />
        <Reward value={compact(r.copies)} label="Copies sold" />
        <Reward value={r.bestScore ?? '—'} label="Best score" />
      </section>
      {best && (
        <p className="small year-best">
          Best one-shot: "{best.title}", #{best.rank} of {best.entrants} with a score of {best.score}.
        </p>
      )}

      <section className="year-section" aria-labelledby="year-awards">
        <div className="lbl" id="year-awards">Awards</div>
        {r.awards.length > 0 ? (
          <ul className="year-list plain small">
            {r.awards.map((id) => {
              const a = awardById(id)
              return (
                <li key={id} className="year-award">
                  <span className="art-frame"><PixelArt art={AWARD_ART[id]} scale={2} /></span>
                  <span><b>{a.name}</b>: {prizeText(a)}. <span className="muted">Won for {awardRule(a)}.</span></span>
                </li>
              )
            })}
          </ul>
        ) : (
          <>
            <p className="small">No awards this year. Next year, aim for one of these:</p>
            <ul className="year-list small">
              {AWARDS.filter((a) => a.id !== 'rookie').map((a) => (
                <li key={a.id}><b>{a.name}</b>: {awardRule(a)}.</li>
              ))}
            </ul>
          </>
        )}
      </section>

      {r.nearMisses.length > 0 && (
        <section className="year-section" aria-labelledby="year-near">
          <div className="lbl" id="year-near">Near misses</div>
          <ul className="year-list small">
            {r.nearMisses.map((n) => <li key={n.id}>{nearMissText(n)}</li>)}
          </ul>
        </section>
      )}

      <section className="year-section" aria-labelledby="year-rival">
        <div className="lbl" id="year-rival">Rival</div>
        <p className="small art-line">
          <span className="art-frame"><PixelArt art={RIVAL_ART} scale={2} /></span>
          <span>{rivalYearLine(r, temper)}</span>
        </p>
      </section>
    </Modal>
  )
}
