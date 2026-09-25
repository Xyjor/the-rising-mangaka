import { CHAPTER_PAGES, PAY_FULL_RATE_SCORE, SERIAL_WARNINGS_TO_CANCEL, VOLUME_EVERY_CHAPTERS, magazineById } from '../../sim'
import { useStore } from '../../state/store'
import { Modal, Reward } from '../components'
import { money } from '../format'
import { comboLabel, rivalWord } from '../labels'

export function OfferModal() {
  const offer = useStore((s) => s.game!.pendingOffer!)
  const busy = useStore((s) => !!s.game!.project || !!s.game!.serial)
  // The poll result that earned this offer lands in history in the same tick as the offer.
  const last = useStore((s) => s.game!.history.at(-1))
  const accept = useStore((s) => s.acceptOffer)
  const decline = useStore((s) => s.declineOffer)
  const mag = magazineById(offer.magazineId)

  return (
    <Modal
      title="Serialisation offer"
      sub={`${mag.editor}, editor at ${mag.name}`}
      narrow
      describedBy="offer-summary"
      footer={
        <>
          <button className="btn ghost" onClick={decline}>Not this one</button>
          <button className="btn primary" onClick={accept} disabled={busy} autoFocus>Accept and start chapter 1</button>
        </>
      }
    >
      <div className="col" style={{ gap: 16 }}>
        <p id="offer-summary" className="sr-only">
          {mag.name} offers to serialise {offer.title} at {money(mag.pageRate)} per page, {mag.circulation}k readers, {mag.entrants} rival series.
        </p>
        <div className="offer-hero">
          <span className="small muted">{mag.name} wants to run</span>
          <span className="t">{offer.title}</span>
          <span className="small muted">{comboLabel(offer.genre, offer.theme, offer.audience)}</span>
        </div>
        <div className="speech">
          Readers loved it. Give me a chapter every {CHAPTER_PAGES} pages, keep the polls healthy, and we release a volume every {VOLUME_EVERY_CHAPTERS} chapters. Slip to the bottom {SERIAL_WARNINGS_TO_CANCEL} times in a row and I have to cancel. Deal?
        </div>
        <div className="terms">
          <Reward value={money(mag.pageRate)} label={`a page at a score of ${PAY_FULL_RATE_SCORE}`} />
          <Reward value={`${mag.circulation}k`} label="readers" />
          <Reward value={mag.entrants} label="rival series" />
          <Reward value={rivalWord(mag.rivalMean)} label="rival polls" />
        </div>
        {last && (
          <p className="small">
            Your one-shot scored {last.score}; series here usually score around {mag.rivalMean}.
            {last.score < mag.rivalMean && ' Expect a fight to stay out of the bottom three.'}
          </p>
        )}
        <p className="tiny muted">
          Chapters go to the poll automatically when finished, and the next one starts right away. You can wrap the series up whenever you like.
          {busy && ' Finish or wrap up your current work first.'}
        </p>
      </div>
    </Modal>
  )
}
