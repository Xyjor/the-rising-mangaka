import { unreadReview } from '../sim'
import { useStore } from '../state/store'
import { Icon } from './Icon'
import { yearSummary } from './labels'
import '../styles/cards.css'

/**
 * The year just closed, waiting on the desk as a card (never a popup): how many awards and near misses it brought,
 * and a button that opens the full review. Returns null once the review is read.
 */
export function YearReviewCard() {
  const review = useStore((s) => (s.game ? unreadReview(s.game) : null))
  const openModal = useStore((s) => s.openModal)
  if (!review) return null

  return (
    <section className="card flat desk-card year-card" aria-labelledby="year-review-title">
      <div className="row" style={{ gap: 8 }}>
        <Icon name="trophy" />
        <b id="year-review-title">Year {review.year} in review: {yearSummary(review)}.</b>
      </div>
      <button className="btn sm block" onClick={() => openModal('year')}>Read the year review</button>
    </section>
  )
}
