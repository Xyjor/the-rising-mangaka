// The status card's copy, kept apart from statusParts.tsx so that file exports components only (fast refresh).
import type { DeadlineStatus } from '../../sim'

/** What the desk says after "About n working days left:" for each deadline status. */
export const DEADLINE_TEXT: Record<DeadlineStatus, string> = {
  'on-track': 'on track',
  tight: 'tight, rest days could make you miss it',
  late: 'at this pace you will miss the issue',
}
