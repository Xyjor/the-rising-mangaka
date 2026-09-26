// The game-driven desk cards, beside (or above) the status card.
import { AnimeOfferCard } from '../AnimeOfferCard'
import { EventCard } from '../EventCard'
import { NextGoal } from '../NextGoal'
import { YearReviewCard } from '../YearReviewCard'

export function DeskTray() {
  return (
    <aside className="desk-tray" aria-label="Desk">
      <NextGoal />
      <EventCard />
      <AnimeOfferCard />
      <YearReviewCard />
    </aside>
  )
}
