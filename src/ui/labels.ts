// Short words the pitch, offer, series, desk, stats, career and year-review screens share. Pure functions of sim data,
// no React.
import {
  MAGAZINES, PAY_FULL_RATE_SCORE, READERS_CHOICE_MIN_RESULTS, RIVAL_SCORE_SD, SERIAL_GRACE_CHAPTERS,
  SERIAL_OFFER_MIN_SCORE, SERIAL_WARNINGS_TO_CANCEL, animeStudioById, audienceById, awardById, genreById, magazineById,
  num, rankTier, suitedFocus, themeById,
} from '../sim'
import type {
  AnimeDeal, AnimeStudio, Award, AudienceId, Forecast, GenreId, MagazineId, NearMiss, PollResult, RankTier, Rival, RivalPlacing,
  ScoreBreakdown, ThemeId, YearReview,
} from '../sim'
import { money, plural } from './format'

/** How a magazine's rivals feel, from its typical rival score. */
export function rivalWord(mean: number): string {
  return mean >= 60 ? 'Fierce' : mean >= 50 ? 'Tough' : 'Friendly'
}

/** A plain word for a 0..1 chance. */
export function oddsWord(chance: number): string {
  return chance < 0.1 ? 'a long shot' : chance < 0.4 ? 'possible' : 'likely'
}

/**
 * The serial-offer odds on the pitch screen: "likely, 48%", "under 1%", "certain: this clears 65", or
 * "none while "Magic Club" runs" when the running serial `serialTitle` rules an offer out. The forecast returns
 * exactly 1 when every outcome clears 65; any chance short of that never reads 100%.
 */
export function offerLabel(p: Pick<Forecast, 'offerChance' | 'offerBlocked'>, serialTitle = ''): string {
  if (p.offerBlocked === 'serial') return `none while "${serialTitle}" runs`
  if (p.offerChance === 1) return `certain: this clears ${SERIAL_OFFER_MIN_SCORE}`
  if (p.offerChance < 0.01) return 'under 1%'
  return `${oddsWord(p.offerChance)}, ${Math.min(99, Math.round(p.offerChance * 100))}%`
}

/** "52 to 53" (with `prefix` on each end, e.g. "#2 to #5"), or just "52" when both ends meet. */
function span(r: { low: number; high: number }, prefix = ''): string {
  return r.low === r.high ? `${prefix}${r.low}` : `${prefix}${r.low} to ${prefix}${r.high}`
}

/** "Likely score 52 to 53. Likely rank #2 to #5 of 11." A range whose ends meet names the one value. */
export function likelyLine(f: Pick<Forecast, 'scoreRange' | 'expectedRank'>, entrants: number): string {
  return `Likely score ${span(f.scoreRange)}. Likely rank ${span(f.expectedRank, '#')} of ${entrants}.`
}

/** "Action, Samurai, for Teens" */
export function comboLabel(genre: GenreId, theme: ThemeId, audience: AudienceId): string {
  return `${genreById(genre).name}, ${themeById(theme).name}, for ${audienceById(audience).name}`
}

/** The rank-tier clause `payWhy` appends after the score is scaled. */
const PAY_TIER_PHRASE: Record<RankTier, string> = {
  first: 'times 2 for first place',
  podium: 'times 1.4 for the podium',
  mid: 'times 1 for mid-table',
  weak: 'times 0.7 for a weak finish',
}

/**
 * Explains a poll payout: the page rate, how the score scaled it against `PAY_FULL_RATE_SCORE`, and the
 * rank-tier multiplier. e.g. "20 pages at ¥90, scaled by your score (52; 80 earns the full rate), times 1.4
 * for the podium."
 */
export function payWhy(result: PollResult): string {
  const mag = magazineById(result.magazineId)
  const tier = rankTier(result.rank, result.entrants)
  return `${plural(result.pages, 'page')} at ${money(mag.pageRate)}, scaled by your score `
    + `(${result.score}; ${PAY_FULL_RATE_SCORE} earns the full rate), ${PAY_TIER_PHRASE[tier]}.`
}

/** The serial-status warning line: safe, a countdown, or the last-chance message. */
export function warningText(warnings: number): string {
  if (warnings === 0) return 'Safe'
  if (warnings === SERIAL_WARNINGS_TO_CANCEL - 1) return 'One more weak chapter or missed issue cancels it'
  const left = SERIAL_WARNINGS_TO_CANCEL - warnings
  return `${plural(warnings, 'warning')}. ${plural(left, 'more weak chapter')} or missed issues in a row cancel it`
}

/** The desk/series line shown while a new series is still within its grace period (no warnings possible yet). */
export const GRACE_TEXT = `New series: no warnings until chapter ${SERIAL_GRACE_CHAPTERS + 1}.`

/** Whether a serial's results are still within the grace period (no warnings possible yet). */
export function inGrace(resultsLength: number): boolean {
  return resultsLength < SERIAL_GRACE_CHAPTERS
}

/** "35%" when every value is the same, else "15% to 35%". */
function pctSpan(values: number[]): string {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return lo === hi ? `${lo}%` : `${lo}% to ${hi}%`
}

/** "A", "A and B", "A, B and C" */
function andList(names: string[]): string {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** How much a poll component weighs across the magazines: "15% to 35% depending on the magazine". */
export function weightSpan(k: keyof ScoreBreakdown): string {
  const values = MAGAZINES.map((m) => m.taste[k])
  return Math.min(...values) === Math.max(...values)
    ? `${pctSpan(values)} in every magazine`
    : `${pctSpan(values)} depending on the magazine`
}

/**
 * Which drawing focus suits which magazine, from each magazine's taste. While a serial runs only its magazine
 * matters, so the hint names that one.
 */
export function focusHint(serialMagazine: MagazineId | null): string {
  if (serialMagazine) {
    const m = magazineById(serialMagazine)
    const focus = { art: 'Art', story: 'Story', balanced: 'Balanced' }[suitedFocus(m.taste)]
    return `${focus} focus suits ${m.name} (art ${m.taste.art}%, story ${m.taste.story}%), where your serial runs.`
  }
  const suits = (focus: 'art' | 'story', label: string): string => {
    const mags = MAGAZINES.filter((m) => suitedFocus(m.taste) === focus)
    if (!mags.length) return ''
    return `${label} focus suits ${andList(mags.map((m) => m.name))} (${focus} ${pctSpan(mags.map((m) => m.taste[focus]))}).`
  }
  return [suits('art', 'Art'), suits('story', 'Story')].filter(Boolean).join(' ')
}

// ---------- the named rival ----------

/** "Iori" from "Iori Hayama": the pitch screen's short name for the rival. */
export function firstName(name: string): string {
  return name.split(' ')[0]
}

/** The chance to beat the rival as a whole percent: "60%", "under 1%", "over 99%" (never a rounded 0% or 100%). */
export function beatLabel(chance: number): string {
  if (chance < 0.01) return 'under 1%'
  if (chance > 0.99) return 'over 99%'
  return `${Math.round(chance * 100)}%`
}

/**
 * Where the rival placed against the player, by rank: "Iori Hayama placed #4 with 51. You finished ahead." When the
 * rounded scores match, the line says so and the finish is "just" ahead or behind; equal ranks are a tie. Null when
 * the rival was not in the poll.
 */
export function rivalLine(r: { score: number; rank: number; rival?: RivalPlacing }): string | null {
  const rv = r.rival
  if (!rv) return null
  const placed = `${rv.name} placed #${rv.rank} with ${rv.score}`
  if (r.rank === rv.rank) return `${placed}. You tied.`
  const side = r.rank < rv.rank ? 'ahead' : 'behind'
  return rv.score === r.score
    ? `${placed}, the same score as yours. You finished just ${side}.`
    : `${placed}. You finished ${side}.`
}

/** Ends a sentence after `text`, unless it already ends in its own mark (Kids Comic Go!). */
function sentenceEnd(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`
}

/**
 * The career screen's rival summary: 'Iori Hayama draws "Robo Pals Go!" for Kids Comic Go! Usually scores 42 to 58.
 * Head to head: 3 wins, 2 losses.'
 */
export function rivalCareerLine(rival: Rival, record: { wins: number; losses: number }): string {
  const { wins, losses } = record
  return `${rival.name} draws "${rival.seriesTitle}" for ${sentenceEnd(magazineById(rival.magazineId).name)} `
    + `Usually scores ${rival.craft - RIVAL_SCORE_SD} to ${rival.craft + RIVAL_SCORE_SD}. `
    + `Head to head: ${headToHead(wins, losses)}.`
}

/** '3 wins, 1 loss' */
function headToHead(wins: number, losses: number): string {
  return `${plural(wins, 'win')}, ${losses} ${losses === 1 ? 'loss' : 'losses'}`
}

/** "6 weeks" when at least a week is left, else "6 days": the anime countdowns. */
function weeksOrDays(days: number, more = ''): string {
  return days >= 7 ? plural(Math.ceil(days / 7), `${more}week`) : plural(days, `${more}day`)
}

/** An anime studio's terms as the offer card lists them, one sentence each. */
export function animeTerms(st: AnimeStudio): string[] {
  return [
    st.fee ? `Pays you ${money(st.fee)} when you sign.` : 'No signing fee.',
    `Airs in ${plural(st.airsAfterWeeks, 'week')} and runs ${plural(st.runsWeeks, 'week')}: +${num(st.weeklyFans)} fans and ${money(st.weeklyMoney)} a week.`,
    `Volumes sell ${st.volumeMult}x from the premiere until ${plural(st.tailWeeks, 'week')} after the finale.`,
    `Popularity +${st.premierePopularity} at the premiere, if the series is still running.`,
  ]
}

/**
 * Where a signed anime stands on `day`, for the Series panel: counting down to the premiere, the week on air (week 1
 * starts on the premiere day, and each week pays when it ends), then the volume boost left after the finale. The
 * boost runs from the premiere; the line speaks of volume sales only while the series is `running`, since an ended
 * one ships no more volumes.
 */
export function animeStatusLine(deal: AnimeDeal, day: number, running: boolean): string {
  const st = animeStudioById(deal.studio)
  const boost = `volumes sell ${st.volumeMult}x`
  if (day < deal.airsDay) {
    const airs = `Signed with ${st.name}, airs in ${weeksOrDays(deal.airsDay - day)}`
    return running ? `${airs}; ${boost} from the premiere.` : `${airs}.`
  }
  if (day < deal.endsDay) {
    const week = Math.floor((day - deal.airsDay) / 7) + 1
    const onAir = `On air, week ${week} of ${st.runsWeeks}: +${num(st.weeklyFans)} fans and ${money(st.weeklyMoney)} a week`
    return running ? `${onAir}; ${boost}.` : `${onAir}.`
  }
  if (!running) return `The ${st.name} anime has ended.`
  if (day < deal.tailEndsDay) return `The anime has ended; ${boost} for ${weeksOrDays(deal.tailEndsDay - day, 'more ')}.`
  if (day === deal.tailEndsDay) return `The anime has ended; today is the last day ${boost}.`
  return `The ${st.name} anime has ended, and volumes sell at the normal rate again.`
}

// ---------- the year review ----------

/** '2 awards, 1 near miss', 'no awards, no near misses': the year review's count on the desk card and in Career. */
export function yearSummary(r: YearReview): string {
  const awards = r.awards.length ? plural(r.awards.length, 'award') : 'no awards'
  const n = r.nearMisses.length
  return `${awards}, ${n === 0 ? 'no near misses' : n === 1 ? '1 near miss' : `${n} near misses`}`
}

/** A year's gain with its sign: '+¥14,250', '-¥2,000', '+3,400', '0'. */
export function yearGain(n: number, kind: 'money' | 'count'): string {
  const text = kind === 'money' ? money(n) : num(n)
  return n > 0 ? `+${text}` : text
}

/** '1 to 4' when the year brought levels, else the one level: '4'. */
export function yearLevels(r: YearReview): string {
  return r.levelFrom === r.levelTo ? `${r.levelTo}` : `${r.levelFrom} to ${r.levelTo}`
}

/** A past year in one line, for Career: 'Year 1: 2 awards, 1 near miss. Money +¥14,250, fans +3,400, level 1 to 4.' */
export function yearCareerLine(r: YearReview): string {
  return `Year ${r.year}: ${yearSummary(r)}. Money ${yearGain(r.moneyDelta, 'money')}, `
    + `fans ${yearGain(r.fansDelta, 'count')}, level ${yearLevels(r)}.`
}

/** An award's prize: '+¥3,000, +500 fans, +100 XP'. */
export function prizeText(a: Award): string {
  return `+${money(a.prize.money)}, +${num(a.prize.fans)} fans, +${a.prize.xp} XP`
}

/**
 * What wins an award, worded from its bar (`need`) so the copy follows the data: 'a poll score of 75 or more',
 * '37,000 copies sold in the year'. The year review puts it after "Won for" and in its list of awards to aim for.
 */
export function awardRule(a: Award): string {
  switch (a.id) {
    case 'rookie': return `a serial started or a #${a.need} one-shot, in year one only`
    case 'readers':
      return `a serial with ${READERS_CHOICE_MIN_RESULTS} or more chapter results in the year, averaging rank ${a.need.toFixed(1)} or better`
    case 'critics': return `a poll score of ${a.need} or more`
    case 'golden-pen': return `${num(a.need)} copies sold in the year`
  }
}

/** A near miss, what the player had against what the award needs: 'Golden Pen: 24,800 copies of 37,000.' */
export function nearMissText(n: NearMiss): string {
  const name = awardById(n.id).name
  switch (n.id) {
    case 'rookie': return `${name}: best one-shot #${n.have}, a #1 or a serial wins it.`
    case 'readers': return `${name}: average rank ${n.have.toFixed(1)}, ${n.need.toFixed(1)} or better wins it.`
    case 'critics': return `${name}: best score ${n.have} of ${n.need}.`
    case 'golden-pen': return `${name}: ${num(n.have)} copies of ${num(n.need)}.`
  }
}

/**
 * The rival's year: the award they took, this year's head to head, and their craft and magazine for next year with
 * the scores that craft usually brings (craft ± RIVAL_SCORE_SD).
 */
export function rivalYearLine(r: YearReview): string {
  const x = r.rival
  const mag = magazineById(x.toMagazine).name
  const parts: string[] = []
  if (r.rivalAward) parts.push(`${x.name} won the ${awardById(r.rivalAward).name}.`)
  parts.push(x.wins + x.losses
    ? `Head to head this year: ${headToHead(x.wins, x.losses)}.`
    : `You never met ${x.name} in a poll this year.`)
  if (x.craftAfter === x.craftBefore) {
    parts.push(`${x.name} is at the top of their game at craft ${x.craftAfter} and stays in ${mag} `
      + `with "${x.series}".`)
  } else if (x.toMagazine !== x.fromMagazine) {
    parts.push(`${x.name}'s craft grew from ${x.craftBefore} to ${x.craftAfter}, so they move up to ${mag} `
      + `with a new series, "${x.series}".`)
  } else {
    parts.push(`${x.name}'s craft grew from ${x.craftBefore} to ${x.craftAfter}. They stay in ${mag} with "${x.series}".`)
  }
  parts.push(`They usually score ${x.craftAfter - RIVAL_SCORE_SD} to ${x.craftAfter + RIVAL_SCORE_SD} now.`)
  return parts.join(' ')
}
