import { useState } from 'react'
import {
  MAGAZINES, MAGAZINE_MISMATCH_PENALTY, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE, STALENESS_PENALTY,
  audienceById, previewSubmission,
} from '../../sim'
import type { MagazineId } from '../../sim'
import { useStore } from '../../state/store'
import { Icon } from '../Icon'
import { Bar, Modal, Pips, RatingText } from '../components'
import { money } from '../format'
import { comboLabel, oddsWord, rivalWord } from '../labels'

export function SubmitModal() {
  const game = useStore((s) => s.game)!
  const closeModal = useStore((s) => s.closeModal)
  const submit = useStore((s) => s.submitProject)
  const [choice, setChoice] = useState<MagazineId | null>(null)
  const p = game.project!
  const preview = choice ? previewSubmission(game, choice) : null
  const base = previewSubmission(game, MAGAZINES[0].id)!

  return (
    <Modal
      title="Pitch to a magazine"
      sub="Where you publish changes who reads it, and what it pays."
      onClose={closeModal}
      footer={
        <>
          <button className="btn ghost" onClick={closeModal}>Not yet</button>
          <div className="row">
            {preview && (
              <span className="small muted">Pays {money(preview.minMoney)} to {money(preview.maxMoney)} depending on rank</span>
            )}
            <button className="btn primary" disabled={!choice} onClick={() => choice && submit(choice)}>
              Submit manuscript
            </button>
          </div>
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
          <div className="metric">
            <div className="head"><span>Art</span><b className="num">{base.art}</b></div>
            <Bar value={base.art} tone="blue" label="Art" />
          </div>
          <div className="metric">
            <div className="head"><span>Story</span><b className="num">{base.story}</b></div>
            <Bar value={base.story} tone="purple" label="Story" />
          </div>
          <div className="metric">
            <div className="head"><span>Pacing</span><b className="num">{base.pacing}</b></div>
            <Bar value={base.pacing} tone="gold" label="Pacing" />
          </div>
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
          {MAGAZINES.map((m) => {
            const mismatch = m.audience !== p.audience
            const est = previewSubmission(game, m.id)!
            return (
              <button key={m.id} className="mag" aria-pressed={choice === m.id} onClick={() => setChoice(m.id)}>
                <span className="name">{m.name}</span>
                <span className="chip">{audienceById(m.audience).name}</span>
                <span className="meta">
                  <span>{money(m.pageRate)} a page</span>
                  <span>{m.circulation}k readers</span>
                  <span>{m.entrants} {rivalWord(m.rivalMean).toLowerCase()} rivals</span>
                </span>
                <span className="meta" style={{ gridColumn: '1 / -1' }}>
                  <span>Likely rank #{est.expectedRank.low} to #{est.expectedRank.high} of {m.entrants + 1}.</span>
                  <span>Serial offer: {oddsWord(est.offerChance)}.</span>
                </span>
                <span className="tiny faint">{m.blurb}</span>
                {mismatch
                  ? <span className="warn row"><Icon name="alert" size={14} /> Readers are {audienceById(m.audience).name}, your manga is for {audienceById(p.audience).name}: −{MAGAZINE_MISMATCH_PENALTY} audience fit</span>
                  : <span className="ok row"><Icon name="check" size={14} /> Readers match</span>}
              </button>
            )
          })}
          <p className="tiny faint">
            A top-{SERIAL_OFFER_MIN_RANK} finish, or a score of {SERIAL_OFFER_MIN_SCORE} or more, earns a serial offer. Estimates assume untested pairings rate Good.
          </p>
        </div>
      </div>
    </Modal>
  )
}
