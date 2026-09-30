import { chapterDeadline, eventChoices, placeById } from '../sim'
import type { EventChoice } from '../sim'
import { useStore } from '../state/store'
import { EVENT_ART } from './art/registry'
import { PixelArt } from './art/PixelArt'
import { plural } from './format'
import '../styles/cards.css'

/**
 * The random event waiting for an answer, as a desk card (never a popup). Returns null when nothing is waiting. It
 * stays on the desk during a trip, like the event itself: answers that start another trip say why they are disabled.
 */
export function EventCard() {
  const game = useStore((s) => s.game)
  const resolveEvent = useStore((s) => s.resolveEvent)
  const prompt = game ? eventChoices(game) : null
  if (!game?.event || !prompt) return null
  const daysLeft = game.event.expiresDay - game.day
  const deadline = chapterDeadline(game)
  const titleId = `event-${prompt.id}-title`

  const answer = (key: 'a' | 'b', c: EventChoice) => {
    const away = c.trip && placeById(c.trip).days
    return (
      <div className="event-choice" key={key}>
        <button className="btn sm block" disabled={!!c.blocked} onClick={() => resolveEvent(key)}>{c.label}</button>
        {away && (
          <p className="tiny muted">
            {plural(away, 'day')} away from the desk{deadline ? `; chapter due in ${plural(deadline.daysLeft, 'day')}` : ''}.
          </p>
        )}
        {c.blocked && <p className="tiny warn-text">{c.blocked}</p>}
      </div>
    )
  }

  return (
    <section className="card flat desk-card event-card" aria-labelledby={titleId}>
      <span className="art-frame event-art" aria-hidden="true"><PixelArt art={EVENT_ART[prompt.id]} scale={2} /></span>
      <b id={titleId}>{prompt.title}</b>
      <p className="small">{prompt.body}</p>
      <div className="event-choices">
        {answer('a', prompt.a)}
        {answer('b', prompt.b)}
      </div>
      <p className="tiny muted">
        {daysLeft > 0 ? `Answer within ${plural(daysLeft, 'day')}.` : 'Answer today.'} If you ignore it, nothing happens.
      </p>
    </section>
  )
}
