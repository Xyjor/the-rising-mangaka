import { CHAPTER_PAGES, VOLUME_EVERY_CHAPTERS, audienceById, genreById, magazineById, themeById } from '../../sim'
import { useStore } from '../../state/store'
import { Modal, money } from '../components'

export function OfferModal() {
  const offer = useStore((s) => s.game!.pendingOffer!)
  const busy = useStore((s) => !!s.game!.project || !!s.game!.serial)
  const accept = useStore((s) => s.acceptOffer)
  const decline = useStore((s) => s.declineOffer)
  const mag = magazineById(offer.magazineId)

  return (
    <Modal
      title="Serialisation offer"
      sub={`${mag.editor}, editor at ${mag.name}`}
      narrow
      footer={
        <>
          <button className="btn ghost" onClick={decline}>Not this one</button>
          <button className="btn primary" onClick={accept} disabled={busy} autoFocus>Accept and start chapter 1</button>
        </>
      }
    >
      <div className="col" style={{ gap: 16 }}>
        <div className="offer-hero">
          <span className="small muted">{mag.name} wants to run</span>
          <span className="t">{offer.title}</span>
          <span className="small muted">
            {genreById(offer.genre).name}, {themeById(offer.theme).name}, for {audienceById(offer.audience).name}
          </span>
        </div>
        <div className="speech">
          Readers loved it. Give me a chapter every {CHAPTER_PAGES} pages, keep the polls healthy, and we release a volume every {VOLUME_EVERY_CHAPTERS} chapters. Slip to the bottom three times in a row and I have to cancel. Deal?
        </div>
        <div className="terms">
          <div className="reward"><div className="n">{money(mag.pageRate)}</div><div className="l">per page</div></div>
          <div className="reward"><div className="n">{mag.circulation}k</div><div className="l">readers</div></div>
          <div className="reward"><div className="n">{mag.entrants}</div><div className="l">rival series</div></div>
        </div>
        <p className="tiny muted">
          Chapters go to the poll automatically when finished, and the next one starts right away. You can wrap the series up whenever you like.
          {busy && ' Finish or wrap up your current work first.'}
        </p>
      </div>
    </Modal>
  )
}
