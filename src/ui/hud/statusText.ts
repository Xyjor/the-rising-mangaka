// The status card's copy, kept apart from statusParts.tsx so that file exports components only (fast refresh).
import { RESULTS_DELAY_DAYS, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE } from '../../sim'
import type { DeadlineStatus } from '../../sim'

export const COACH: Record<string, string> = {
  idle: 'Every career starts with one page. Plan your first manga: pick a genre, a theme, and who it is for.',
  drawing: 'Time is ticking. Working drains stamina, resting refills it. Use the speed controls up top, and press Space to pause.',
  ready: `The manuscript is done. Pitch it to a magazine. Matching the magazine's readers matters, and the pitch screen shows exactly what you know. A top-${SERIAL_OFFER_MIN_RANK} finish, or a score of ${SERIAL_OFFER_MIN_SCORE} or more, brings a serialisation offer.`,
  submitted: `Readers are voting. Results land in ${RESULTS_DELAY_DAYS} days. Rest up, take a job, or look at your Notebook and Stats.`,
}

/** What the desk says after "About n working days left:" for each deadline status. */
export const DEADLINE_TEXT: Record<DeadlineStatus, string> = {
  'on-track': 'on track',
  tight: 'tight, rest days could make you miss it',
  late: 'at this pace you will miss the issue',
}
