import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { getSound } from '../../audio/instance'
import {
  RATING_LABEL, SERIAL_OFFER_MIN_RANK, SERIAL_OFFER_MIN_SCORE, audienceById, genreById,
  magazineById, rankTier, themeById,
} from '../../sim'
import type { PollResult, RankTier, ScoreBreakdown } from '../../sim'
import { useStore } from '../../state/store'
import { Bar, Modal, Pips, Reward } from '../components'
import { compact, money } from '../format'
import { payWhy, rivalLine } from '../labels'
import { prefersReducedMotion } from '../motion'
import { TIER_JINGLE, barPitch, countUp, revealCues, revealPlan } from './reveal'
import { useRevealClock } from './useReveal'

const ITEMS: { key: keyof ScoreBreakdown; label: string; tone: string }[] = [
  { key: 'art', label: 'Art', tone: 'blue' },
  { key: 'story', label: 'Story', tone: 'purple' },
  { key: 'pacing', label: 'Pacing', tone: 'gold' },
  { key: 'audienceFit', label: 'Audience fit', tone: 'green' },
  { key: 'freshness', label: 'Freshness', tone: 'accent' },
]

/** The reward tiles, in the order they land. */
const TILES: { label: string; value: (r: PollResult) => number; text: (n: number) => string }[] = [
  { label: 'Payment', value: (r) => r.rewards.money, text: (n) => `+${money(n)}` },
  { label: 'Fans', value: (r) => r.rewards.fans, text: (n) => `+${compact(n)}` },
  { label: 'XP', value: (r) => r.rewards.xp, text: (n) => `+${n}` },
]

const HEADLINE: Record<RankTier, string> = {
  first: 'Number one!', podium: 'On the podium!', mid: 'Mid-table.', weak: 'Back of the pack.',
}

/** Hides a line until the stamp while keeping its space, so nothing jumps when it appears. */
const HIDDEN: CSSProperties = { visibility: 'hidden' }

/**
 * The poll result, revealed in beats (reveal.ts has the timeline): the bars count up in turn, then the score, then the
 * rank stamp lands with its jingle, then the reward tiles slide in. A pointer-down in the body or any key skips to the
 * end; with reduced motion the end is the first frame. "Back to the studio" dismisses at any point.
 */
export function ResultsModal() {
  const r = useStore((s) => s.game!.pendingResult!)
  const pendingOffer = useStore((s) => s.game!.pendingOffer)
  const serial = useStore((s) => s.game!.serial)
  const dismiss = useStore((s) => s.dismissResult)
  const finishTutorial = useStore((s) => s.finishTutorial)
  const readOnly = useStore((s) => s.readOnly)

  const [reduced] = useState(prefersReducedMotion)
  const plan = useMemo(() => revealPlan({ bars: ITEMS.length, rewards: TILES.length, reduced }), [reduced])
  const { elapsed, skip, skipped } = useRevealClock(plan.end)
  const stamped = elapsed >= plan.stampAt
  // Every tile takes the same time to land, so the last one's landing is the end of the plan.
  const tileDur = plan.end - (plan.rewardStart.at(-1) ?? plan.end)

  const mag = magazineById(r.magazineId)
  const medal = r.rank === 1 ? 'gold' : r.rank === 2 ? 'silver' : r.rank === 3 ? 'bronze' : undefined
  const tier = rankTier(r.rank, r.entrants)
  const headline = HEADLINE[tier]
  const rival = rivalLine(r)
  const spoiler = stamped ? undefined : HIDDEN

  // The music ducks under the reveal. The drumroll, if still rolling, stops with the modal.
  const drumroll = useRef<(() => void) | null>(null)
  useEffect(() => {
    const sound = getSound()
    sound.duck(0.3)
    return () => {
      drumroll.current?.()
      drumroll.current = null
      sound.duck(1)
    }
  }, [])

  // Each step of the clock plays the beats it crossed. A ref (not state) remembers the last step heard, so StrictMode's
  // doubled mount effect cannot play the opening beats (with reduced motion, the stamp and jingle) twice. A read-only
  // tab mirrors another tab's game and stays silent, as the sound bridge does.
  const heard = useRef(-1)
  useEffect(() => {
    const from = heard.current
    if (elapsed <= from) return
    heard.current = elapsed
    if (readOnly) return
    const sound = getSound()
    for (const cue of revealCues(plan, from, elapsed, skipped)) {
      if (cue.kind === 'drumroll') drumroll.current = sound.play('drumroll')
      else if (cue.kind === 'bar') sound.play('bar', { pitch: barPitch(r.breakdown[ITEMS[cue.index].key]) })
      else if (cue.kind === 'stamp') {
        // A skip jumps to the end, so the stamp either fires in that step or already has: this stops a skipped drumroll too.
        drumroll.current?.()
        drumroll.current = null
        sound.play('stamp')
      } else if (cue.kind === 'jingle') sound.play(TIER_JINGLE[tier])
      else sound.play('coins')
    }
  }, [elapsed, skipped, plan, r, tier, readOnly])

  // A pointer-down anywhere in the body, or any key, skips to the end. Focus starts on "Back to the studio", so while the
  // reveal runs, Enter or Space is cancelled: the first press only skips and the next one dismisses (a click still
  // dismisses at once). The ref keeps the listener reading the current state without re-subscribing.
  const root = useRef<HTMLDivElement>(null)
  const running = useRef(elapsed < plan.end)
  useEffect(() => {
    running.current = elapsed < plan.end
  }, [elapsed, plan.end])
  useEffect(() => {
    const body = root.current?.closest('.modal-body')
    const onKey = (e: KeyboardEvent) => {
      if (running.current && (e.key === 'Enter' || e.key === ' ')) e.preventDefault()
      skip()
    }
    body?.addEventListener('pointerdown', skip)
    document.addEventListener('keydown', onKey)
    return () => {
      body?.removeEventListener('pointerdown', skip)
      document.removeEventListener('keydown', onKey)
    }
  }, [skip])

  const close = () => { finishTutorial(); dismiss() }

  return (
    <Modal
      title="Reader poll results"
      sub={`${r.title}, in ${mag.name}`}
      describedBy="result-summary"
      footer={
        <>
          <span className="small muted">
            Recorded in your Notebook: {genreById(r.genre).name} × {themeById(r.theme).name} = {RATING_LABEL[r.genreThemeRating]},{' '}
            {themeById(r.theme).name} × {audienceById(r.audience).name} = {RATING_LABEL[r.themeAudienceRating]}
          </span>
          <button className="btn primary" onClick={close} autoFocus>Back to the studio</button>
        </>
      }
    >
      <div className="col" style={{ gap: 16 }} ref={root}>
        <p id="result-summary" className="sr-only">
          {headline} {r.title} ranked number {r.rank} of {r.entrants} in {mag.name}, score {r.score} out of 100.
          {' '}Paid {money(r.rewards.money)}, {compact(r.rewards.fans)} new fans, {r.rewards.xp} XP.
        </p>
        <div className="result-hero" data-stamped={String(stamped)}>
          <div className="rank-badge" data-tier={stamped ? medal : undefined} aria-hidden="true">
            {stamped ? <span><small>#</small>{r.rank}</span> : <span>?</span>}
          </div>
          <div className="col" style={{ gap: 4 }}>
            <div className="hero-head reveal-swap">
              <h3 className="display" style={{ fontSize: 30, ...(stamped ? HIDDEN : null) }} aria-hidden={stamped || undefined}>
                Counting the votes
              </h3>
              <h3 className="display" style={{ fontSize: 30, ...(stamped ? null : HIDDEN) }} aria-hidden={!stamped || undefined}>
                {headline}
              </h3>
            </div>
            <div className="hero-line reveal-swap muted">
              <div aria-hidden="true" style={stamped ? HIDDEN : undefined}>
                Readers scored it <b className="num">{countUp(r.score, elapsed, plan.scoreStart, plan.scoreDur)}</b> out of 100.
              </div>
              <div style={spoiler} aria-hidden={!stamped || undefined}>
                Ranked <b>#{r.rank}</b> of {r.entrants} works, with an overall score of <b className="num">{r.score}</b> out of 100.
              </div>
            </div>
            <div className="tag-row" style={{ marginTop: 4 }}>
              <span className="chip">{genreById(r.genre).name}</span>
              <span className="chip">{themeById(r.theme).name}</span>
              <span className="chip">{audienceById(r.audience).name}</span>
            </div>
          </div>
        </div>
        {rival && <p className="small" style={spoiler}>{rival}</p>}

        <div className="speech">
          {r.editorComment}
          <div className="tiny muted" style={{ marginTop: 6 }}>{mag.editor}, editor at {mag.name}</div>
        </div>

        <section aria-label="Score breakdown" className="breakdown">
          <div className="lbl">Why this score</div>
          {ITEMS.map((it, i) => {
            const value = countUp(r.breakdown[it.key], elapsed, plan.barStart[i], plan.barDur)
            return (
              <div className="item" key={it.key}>
                <span className="l">{it.label}<small>weight {mag.taste[it.key]}%</small></span>
                <Bar value={value} ariaValue={r.breakdown[it.key]} tone={it.tone} thick label={it.label} />
                <span className="v num" aria-hidden="true">{value}</span>
              </div>
            )
          })}
          {(r.penalties.magazineMismatch > 0 || r.penalties.staleness > 0) && (
            <div className="tiny col" style={{ color: 'var(--accent)', fontWeight: 800, gap: 4 }}>
              {r.penalties.magazineMismatch > 0 && (
                <p>
                  Audience fit −{r.penalties.magazineMismatch}: {mag.name} is read by {audienceById(mag.audience).name}, this manga is for {audienceById(r.audience).name}.
                </p>
              )}
              {r.penalties.staleness > 0 && (
                <p>
                  Freshness −{r.penalties.staleness}: repeated pairing, you used {genreById(r.genre).name} and {themeById(r.theme).name} recently.
                </p>
              )}
            </div>
          )}
          <div className="row wrap small muted" style={{ gap: 16 }}>
            <span className="row">Freshness pairing <Pips rating={r.genreThemeRating} /> {RATING_LABEL[r.genreThemeRating]}</span>
            <span className="row">Audience pairing <Pips rating={r.themeAudienceRating} /> {RATING_LABEL[r.themeAudienceRating]}</span>
          </div>
        </section>

        <section className="rewards" aria-label="Rewards">
          {TILES.map((t, i) => (
            <Reward
              key={t.label}
              label={t.label}
              landed={elapsed >= plan.rewardStart[i]}
              value={<span aria-hidden="true">{t.text(countUp(t.value(r), elapsed, plan.rewardStart[i], tileDur))}</span>}
            />
          ))}
        </section>
        <p className="tiny muted" style={spoiler}>{payWhy(r)}</p>

        {pendingOffer ? (
          <p className="small ok-text" style={spoiler}>{mag.name} wants to serialise this. The offer is next.</p>
        ) : serial ? (
          <p className="tiny muted" style={spoiler}>No new offer while "{serial.title}" is running.</p>
        ) : (
          <p className="tiny muted" style={spoiler}>
            Rank {r.rank} of {r.entrants}, score {r.score}: no serial offer this time. A top-{SERIAL_OFFER_MIN_RANK} finish, or a score of {SERIAL_OFFER_MIN_SCORE} or more, earns one.
          </p>
        )}
      </div>
    </Modal>
  )
}
