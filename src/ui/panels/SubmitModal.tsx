import { useMemo, useState } from 'react'
import {
  MAGAZINES, MAGAZINE_MISMATCH_PENALTY, RIVAL_SCORE_SD, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE,
  STALENESS_PENALTY, audienceById, previewSubmission,
} from '../../sim'
import type { MagazineId } from '../../sim'
import { useStore } from '../../state/store'
import { Icon } from '../Icon'
import { Metric, Modal, Pips, RatingText } from '../components'
import { money } from '../format'
import { MAG_TONE } from '../looks'
import { beatLabel, comboLabel, firstName, likelyLine, offerLabel, rivalWord } from '../labels'

export function SubmitModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const submit = useStore((s) => s.submitProject)
  const [choice, setChoice] = useState<MagazineId | null>(null)
  const p = game.project!
  // One forecast per magazine per game state; the manuscript facts (art, story, notebook) are the same in each.
  const previews = useMemo(() => MAGAZINES.map((m) => previewSubmission(game, m.id)!), [game])
  const base = previews[0]
  const serialTitle = game.serial?.title ?? ''

  return (
    <Modal
      title="Pitch to a magazine"
      sub="Where you publish changes who reads it, and what it pays."
      onClose={closeModal}
      footer={
        <>
          <button className="btn ghost" onClick={closeModal}>Not yet</button>
          <button className="btn primary" disabled={!choice} onClick={() => choice && submit(choice)}>
            Submit manuscript
          </button>
        </>
      }
    >
      <div className="submit-grid">
        <section className="card flat col" style={{ gap: 12 }} aria-label="Your manuscript">
          <div>
            <div className="display" style={{ fontSize: 24 }}>{p.title}</div>
            <div className="tiny muted">
              {comboLabel(p.genre, p.theme, p.audience)}. {p.pagesTarget} pages.
            </div>
          </div>
          <Metric label="Art" bar={base.art} tone="blue" />
          <Metric label="Story" bar={base.story} tone="purple" />
          <Metric label="Pacing" bar={base.pacing} tone="gold" />
          <div className="divider" />
          <div className="know">
            <div className="k"><span className="l">Freshness</span><span className="row"><Pips rating={base.freshness} /><RatingText rating={base.freshness} /></span></div>
            <div className="k"><span className="l">Audience fit</span><span className="row"><Pips rating={base.audienceFit} /><RatingText rating={base.audienceFit} /></span></div>
            {base.staleness > 0 && (
              <p className="tiny" style={{ color: 'var(--accent)', fontWeight: 800 }}>
                Repeated pairing: −{base.staleness * STALENESS_PENALTY} freshness.
              </p>
            )}
          </div>
        </section>

        <div className="mag-list" role="group" aria-label="Magazines">
          {MAGAZINES.map((m, i) => {
            const mismatch = m.audience !== p.audience
            const est = previews[i]
            return (
              <button key={m.id} className="mag" aria-pressed={choice === m.id} onClick={() => setChoice(m.id)}>
                <span className="mag-cover" data-tone={MAG_TONE[m.id]}>
                  <span className="name">{m.name}</span>
                  <span className="mag-chips">
                    <span className="chip">{audienceById(m.audience).name}</span>
                    {est.beatRival !== null && <span className="chip accent">Rival: {game.rival.name}</span>}
                  </span>
                </span>
                <span className="meta">
                  <span>{money(m.pageRate)} a page</span>
                  <span>{m.circulation}k readers</span>
                  <span>{m.entrants} {rivalWord(m.rivalMean).toLowerCase()} rivals</span>
                </span>
                <span className="meta" style={{ gridColumn: '1 / -1' }}>
                  <span>{likelyLine(est, m.entrants + 1)}</span>
                  <span>Serial offer: {offerLabel(est, serialTitle)}.</span>
                  <span>Pays about {money(est.expectedPay)} ({money(est.payRange.low)} to {money(est.payRange.high)}).</span>
                  {est.beatRival !== null && <span>Beat {firstName(game.rival.name)}: {beatLabel(est.beatRival)}.</span>}
                  <span>Rivals usually score {m.rivalMean - RIVAL_SCORE_SD} to {m.rivalMean + RIVAL_SCORE_SD}.</span>
                </span>
                <span className="taste">
                  <span>{m.tasteLine}</span> <b>Art {m.taste.art}%, story {m.taste.story}%</b>
                </span>
                <span className="tiny faint">{m.blurb}</span>
                <span className="tiny">Editor: {m.editor}, {m.persona}. {m.personaLine}</span>
                {mismatch
                  ? <span className="warn row"><Icon name="alert" size={14} /> Readers are {audienceById(m.audience).name}, your manga is for {audienceById(p.audience).name}: −{MAGAZINE_MISMATCH_PENALTY} audience fit</span>
                  : <span className="ok row"><Icon name="check" size={14} /> Readers match</span>}
              </button>
            )
          })}
          <p className="tiny faint">
            A top-{SERIAL_OFFER_MIN_RANK} finish, or a score of {SERIAL_OFFER_MIN_SCORE} or more, earns a serial offer.
          </p>
          {base.unknownPairings > 0 && (
            <p className="tiny faint">
              Untested pairings could rate anywhere from Bad to Perfect, so the range is wide until your Notebook knows them.
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
