import { ANIME_OFFER_MIN_COPIES, ANIME_OFFER_MIN_POPULARITY, ANIME_STUDIOS, num } from '../sim'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import { plural } from './format'
import { animeTerms } from './labels'
import '../styles/cards.css'

/**
 * The anime adaptation offer for the running hit, as a desk card (never a popup): both studios' terms, a button to
 * sign with each, and "Not now". Returns null when no offer is waiting.
 */
export function AnimeOfferCard() {
  const game = useStore((s) => s.game)
  const signAnime = useStore((s) => s.signAnime)
  const declineAnime = useStore((s) => s.declineAnime)
  const offer = game?.animeOffer
  const ser = offer && game.serial?.id === offer.serialId ? game.serial : null
  if (!game || !offer || !ser) return null
  const daysLeft = offer.expiresDay - game.day

  return (
    <section className="card flat desk-card anime-card" aria-labelledby="anime-offer-title">
      <div className="row" style={{ gap: 8 }}>
        <Icon name="tv" />
        <b id="anime-offer-title">Two studios want to animate "{ser.title}"</b>
      </div>
      <p className="small">
        "{ser.title}" is a hit: popularity {ANIME_OFFER_MIN_POPULARITY} or more and {num(ANIME_OFFER_MIN_COPIES)} copies
        sold. Sign with one studio, or let the offer pass.
      </p>
      <div className="event-choices">
        {ANIME_STUDIOS.map((st) => (
          <div className="anime-studio event-choice" role="group" aria-labelledby={`anime-${st.id}`} key={st.id}>
            <b id={`anime-${st.id}`} className="small">{st.name}</b>
            <ul className="anime-terms small">
              {animeTerms(st).map((t) => <li key={t}>{t}</li>)}
            </ul>
            <button className="btn sm block" onClick={() => signAnime(st.id)}>Sign with {st.name}</button>
          </div>
        ))}
        <button className="btn ghost sm block" onClick={declineAnime}>Not now</button>
      </div>
      <p className="tiny muted">
        {daysLeft > 0 ? `Answer within ${plural(daysLeft, 'day')}.` : 'Answer today.'} Studios ask once per series.
      </p>
    </section>
  )
}
