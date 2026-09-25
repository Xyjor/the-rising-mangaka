# The Rising Mangaka — Design Document

A manga-career management game inspired by Kairosoft's *The Manga Works*, rebuilt with a
modern, transparent, low-friction interface.

## Pillars

1. **Show the why.** Every result explains itself. A reader-poll rank comes with a breakdown
   of what drove it. Nothing important is hidden behind a number the player has to reverse-engineer.
2. **Discovery, not grinding.** Hidden genre/theme/audience compatibility exists, but the game
   records everything the player learns in a Notebook and surfaces it at decision time.
3. **Never interrupt.** Events go to a log and to non-blocking toasts. The only modal moments
   are ones the player chose (starting a manga, reading poll results). The clock pauses in every
   modal. Player controls speed at all times.
4. **One screen, one job.** A persistent HUD, one studio view, one contextual "desk" panel.
   No nested menus more than one level deep.
5. **Hybrid look.** Pixel-art studio scene for warmth and flavour; clean, modern UI panels for
   every management screen.

## Core loop (vertical slice)

```
Plan manga  →  Draw pages (days pass)  →  Submit to a magazine  →  Reader poll results
   ↑   (genre × theme × audience)           (stamina, focus)         (rank, money, fans, XP)
   └────────────────────────── level up, notebook grows ──────────────────────────────┘
```

### Time
- 1 tick = 1 day. 7 days = 1 week, 4 weeks = 1 month, 12 months = 1 year.
- Speeds: paused / 1x / 2x / 3x. Opening any modal pauses. Closing restores previous speed.

### Player
- Stats (1–100): **Story**, **Art**, **Pacing**. Max stamina grows with level.
- **Stamina** drains while working, restores while resting. Low stamina halves progress.
- **Level / XP**: each level grants 3 skill points, spent freely in the Stats panel.
- **Money**, **Fans**.

### Manga project
- Genre × Theme × Audience + Title. Page target (one-shot: 20 pages in the slice).
- While drawing: each day adds pages and accumulates Art and Story quality from the matching stats,
  modulated by **focus** (balanced / art / story) and stamina.
- When pages are complete the project is *ready* and can be submitted to a magazine.

### Compatibility (hidden, discoverable)
- Genre×Theme → **Freshness** rating (Bad / Meh / Good / Great / Perfect).
- Theme×Audience → **Audience fit** rating.
- Recorded in the Notebook after the first poll result using that pair.
- Reusing the same genre×theme in the last 3 works applies a staleness penalty (shown in the wizard).

### Magazines
- Each has an audience lean, a page rate, circulation, a rival strength, and a chapter rhythm for serials
  (`chapterDays`: Weekly Bolt 14, Monthly Petal 28, Ultra Seinen 21, Kids Comic Go! 21).
- Submitting to a magazine whose audience differs from the manga's audience costs Audience fit.
  The submit panel shows this before the player commits.

### Reader poll scoring (0–100)
Each component is scored 0–100:

| Component    | Source                                   |
|--------------|------------------------------------------|
| Art          | accumulated art quality                  |
| Story        | accumulated story quality                |
| Pacing       | Pacing stat + noise (Gaussian, sd `PACING_NOISE_SD`) |
| Audience fit | theme×audience rating, magazine mismatch |
| Freshness    | genre×theme rating, staleness penalty    |

Every magazine weighs them to its own taste (integer percentages summing to 100; `Magazine.taste` in `data.ts`),
and `score = clamp(round(Σ component × weight / 100), 0, 100)`:

| Magazine        | Art | Story | Pacing | Fit | Freshness | Taste line (shown on the pitch screen and in the wizard) |
|-----------------|-----|-------|--------|-----|-----------|-----------------------------------------------------------|
| Default         | 25  | 25    | 15     | 15  | 20        | (`SCORE_WEIGHTS`, the fallback for `weightedScore`)       |
| Weekly Bolt     | 35  | 15    | 20     | 10  | 20        | Readers love big art and fast pacing.                     |
| Monthly Petal   | 15  | 35    | 10     | 20  | 20        | Readers want a story, and a manga made for them.          |
| Ultra Seinen    | 15  | 35    | 20     | 10  | 20        | Readers prize story and pacing.                           |
| Kids Comic Go!  | 35  | 15    | 10     | 20  | 20        | Readers love bright art, and a manga made for them.       |

This is what makes **focus** a decision: art focus (art ×1.25, story ×0.8) suits Weekly Bolt and Kids Comic Go!,
story focus suits Monthly Petal and Ultra Seinen. For a fresh player (art 40, story 34) drawing a kids one-shot, the
model expects art focus to score about 4.0 more than story focus at Kids Comic Go! (40 × 0.45 × 35% − 34 × 0.45 × 15%)
and story focus about 2.7 more at Monthly Petal; measured over seeds 1–20 the gaps are 4.05 and 2.65. The desk's focus
hint, the pitch screen, the wizard's audience step, the results breakdown ("weight N%") and the stats screen all show
the weights, so the modifier is never hidden.

Rank = 1 + number of rivals scoring higher, each drawn as `magazine.rivalMean + Gaussian noise (sd RIVAL_SCORE_SD)`
(see CLAUDE.md balance touchpoints for the current rival score range and spread). Rewards scale with score and rank.
The named rival (below) is entrant 0 of the magazine it runs in, drawn around its craft instead of the rivalMean.

### Named rival
Every world has one named rival mangaka (`rival.ts`): the name (`RIVAL_NAMES`) and series title (`RIVAL_SERIES`, three
per magazine) come from a hash of the world seed, so making the rival consumes no RNG. Craft is
`min(RIVAL_MAX_CRAFT 76, RIVAL_START_CRAFT 50 + RIVAL_YEARLY_GROWTH 4 × whole years)`, and the rival runs in the
magazine with the highest rivalMean at most craft − 2, else Kids Comic Go! (50 Kids, 54 and 58 Petal, 62 Bolt,
66 Ultra). In that magazine's polls (`pollField`) the rival takes entrant 0's draw slots, so a poll still draws
`2 + entrants × 2` values and the other magazines' polls are unchanged. The rival's rank is 1 + other entrants above
it + 1 if the player scored higher; results store `{ name, score, rank }` (score rounded, 0 to 100). The pitch screen
marks the rival's magazine ("Rival: name", "Beat first name: N%"), the results screen says where the rival placed and
whether the player finished ahead or behind, the series table has a Rival column, and the Career screen shows the
series, the usual score range (craft ± 8) and the head-to-head record (`rivalRecord`: a win is a better rank). Saves
from before the rival get the one their world would have by the save's day (`upgradeSave`).
The editor writes a one-line comment on the component that cost the most points at that magazine
(`biggestLoss`: the largest weight × (100 − component), ties in the order art, story, pacing, fit, freshness).

### Pay
Every poll, one-shot or chapter, pays `round(pageRate × pages × score × tier% / (PAY_FULL_RATE_SCORE × 100))`
(`pollPay`: integer factors and a single division, so x.5 cases round exactly). `PAY_FULL_RATE_SCORE` is 80: a score
of 80 earns the full page rate, lower scores scale it down and higher ones up. The rank tier (`rankTier`,
`RANK_MULTIPLIER_PCT`) sets `tier%`: first place 200, the podium (rank 3 or better) 140, mid-table (rank at most
ceil(entrants / 2), entrants counting the player's work) 100, weak 70. A one-shot is paid on its 20 pages, a chapter
on its 16. Example: a Kids Comic Go! one-shot scoring 52 in second place pays 90 × 20 × 52 × 140 / 8000 = ¥1,638.
The results screen explains every payout in those terms (`payWhy`: pages at the page rate, scaled by the score, times
the tier).

### Pitch forecast
For each magazine the pitch screen quotes "Likely score A to B. Likely rank #C to #D of N.", the serial-offer odds and
"Pays about ¥X (¥L to ¥H)". `forecastPoll` (`forecast.ts`) computes them exactly and without RNG from what the player
can know:
- A pairing the Notebook has rated counts at that rating. An untested pairing is spread over `RATING_PRIOR` (Bad 0.15,
  Meh 0.25, Good 0.3, Great 0.2, Perfect 0.1, the thresholds hidden ratings are drawn with); its hidden rating is
  never read. The hand-authored "obvious" pairings in `compat.ts` count as untested too until the Notebook has them.
- Pacing noise is integrated with a 25-node quadrature (z from −3 to 3 in steps of 0.25, Gaussian weights).
- Every rating scenario and node goes through the poll's own `computeBreakdown` and `weightedScore`, so the rounding
  is the real one.
- For each score the rivals are a Poisson-binomial: rival i finishes above with 1 − Φ((score − mean_i) / RIVAL_SCORE_SD),
  mean_i the rivalMean, or the named rival's craft for entrant 0 in its magazine (`rivalMeans`, shared with the polls).
  There the pitch also quotes the chance to beat the rival: Σ P(score) × Φ((score − craft) / RIVAL_SCORE_SD).
- The offer chance is P(rank 3 or better, or score 65 or more): "certain" when every outcome clears 65, "none while
  <serial> runs" while a serial runs. The likely ranges are the 10th and 90th percentiles; the pay is the mean over every
  score and rank, its range every outcome more likely than 1e-9.

Forecast calibration is a balance band: over year one the offer chances quoted at each pitch, summed, must come within
30% of the offers that arrived.

## Architecture

- `src/sim/` — pure TypeScript simulation. No React, no DOM. Deterministic given a seed.
  Fully unit-tested with Vitest. Every state change is a pure function `(state, input) => state`.
- `src/state/` — Zustand store: wraps the sim, owns the real-time clock and UI state, persists to localStorage.
- `src/ui/` — React components. `scene/` is the pixel-art canvas studio. `panels/` are the management screens.
- `src/styles/` — design tokens (CSS variables), light/dark, base styles.

## Systems beyond the slice (implemented)

### Serialisation
- A one-shot that ranks top 3 or scores 65+ earns a serialisation offer from that magazine (one serial at a time).
- Chapters are 16 pages. A finished chapter goes to the weekly poll automatically and the next chapter starts at once.
  Chapter results never block play: they arrive as toasts and in the Series panel.
- **Popularity** (0-100) is a moving average of poll placement, minus 10 for each missed issue. Three warnings in a
  row (a weak chapter, roughly the bottom quarter with rank > ceil(0.7 x entrants), or a missed issue) cancel the
  series and cost 10% of fans; the log says "after 3 warnings in a row" whichever mix it was. Every 4 chapters a **volume** ships;
  copies = (fans + circulation x 20) x popularity, times an anime deal's multiplier while its boost lasts (see Anime
  adaptations).
- **Grace period**: every new series' first `SERIAL_GRACE_CHAPTERS` (4) results never add a warning, even when weak;
  popularity still moves normally during grace. The earliest a weak chapter can warn is a series' 5th result, so the
  earliest cancellation by weak chapters alone is its 7th result. Applies to every new series, not only a mangaka's
  first.
- **Chapter deadlines**: accepting an offer makes chapter 1 due `chapterDays` later. Each chapter sent makes the next
  one due `chapterDays` after the previous due day (not after the day it was sent), so finishing early banks time.
  If the due day arrives while the chapter is still being drawn, the issue is **missed** (`checkDeadline`): popularity
  -10 (`SERIAL_MISSED_ISSUE_POPULARITY`, never below 0), `missedIssues` +1, the same chapter is due one `chapterDays`
  later, and a toast says so. A miss adds a warning only once the series has 4 results (the grace period); during
  grace it costs popularity alone. Weak chapters and misses share the warning count (a chapter that is not weak
  resets it), and the third warning cancels the series through one path (`cancelSerial`: fans -10%, the desk
  empties). With 4 results in and nothing sent, three misses cancel. A trip does not stop the presses: an issue due
  while the mangaka is away, or on the day they come home, is missed.
- The desk shows the chapter's due day and the studio's pace: `chapterDeadline` counts working days left with
  `chapterWorkDays` (ceil(pages left / studio pages per day at full stamina)) and rates them with `deadlineStatus`:
  late when they exceed the days left, tight when they exceed them once `DEADLINE_REST_FACTOR` (1.25) is applied for
  rest days, on track otherwise. The offer screen uses the same two helpers for a whole chapter against the rhythm:
  it shows the rhythm ("Every 21 days"), the working days a chapter takes at the player's pace, "Rest days could make
  you miss issues." when tight and "You will miss issues at this pace: hire help first." when late. The Series panel
  lists the rhythm and the missed issues.
- The balance bots hire help when the chapter on the desk is late, a desk is free in their studio (they never move or
  buy equipment, so the apartment's one desk is theirs), and the bank holds two weeks of the candidate's salary on top
  of two weeks of current costs; they pick the most pages per day per yen of salary.
- Freshness erodes 2 points per chapter after chapter 8, so every series has a natural arc. The player can wrap a
  series up at any time and converts popularity into loyal fans.
- Wrapping up with popularity 50 or higher after at least one volume has shipped sells a final volume at 1.5x copies;
  wrapping before any chapter has polled earns nothing.

### Staff
- One assistant per desk: 1 in the apartment, 2 in the studio flat, 3 in the loft (see Studio and equipment). Three
  candidates rotate every 4 weeks. No hiring fee, weekly salary. With every desk taken, the Staff panel's hire buttons
  say "Move to a bigger studio for another desk" and open the Studio panel (in the loft: "Full, let someone go
  first").
- Each adds pages per day and blends their own Art/Story into page quality. Traits: Fast, Careful, Inspiring, Steady.
- Assistants tire like the player and rest when the player rests or works a part-time job.

### Studio and equipment
A money sink whose every effect is stated where it is sold (the Studio panel, from the desk's Studio button) and listed
again under the reward tiles in Stats. `src/sim/studio.ts`; no RNG.
- **Tiers.** A new career starts in the apartment. Moving goes one tier up at a time, never down, and costs the next
  tier's move-in; the panel asks to confirm a move ("Yes, move in for ¥5,000" or "Stay here"), and the next tier's line
  says "You cannot move back down." Equipment is a single click. The tier's rent is part of the weekly costs (living + rent + salaries), and the weekly log line names
  it when it is not zero ("Weekly costs: -¥550 (living ¥400, rent ¥150)."). `hireAssistant` refuses once every desk is
  taken, on top of the rule that the bank must hold two weeks of that salary.

| Tier | Desks | Rent/week | Move-in |
|---|---|---|---|
| Apartment | 1 | ¥0 | ¥0 |
| Studio flat | 2 | ¥150 | ¥5,000 |
| Studio loft | 3 | ¥350 | ¥15,000 (from the flat) |

- **Equipment** is bought once and kept. A piece cannot be bought twice, without the money, or (the pen tablet) below
  the studio flat. Effects sum over everything owned; page multipliers multiply (drafting table and tablet: x1.265).
  Art and story bonuses go on the player's own samples of every working day (clamped to 100), never the assistants'.
  The page multiplier is part of `basePagesPerDay`, so the desk's pace, the ETA and the chapter deadline all include it.

| Equipment | Price | Effect |
|---|---|---|
| Coffee machine | ¥2,000 | Resting restores 3 more stamina a day (the rest branch, not trips) |
| Daylight lamp | ¥2,500 | Art +3 on your pages |
| Reference shelf | ¥3,000 | Story +3 on your pages |
| Ergonomic chair | ¥4,000 | Drawing costs 1 less stamina a day (min 2); adds to an Inspiring assistant's 1 |
| Drafting table | ¥7,000 | 10% more pages a day |
| Pen tablet | ¥12,000, needs the flat | 15% more pages a day, art +2 |

- **Prices** go through `equipmentPrice(id)` and `moveInCost(tier)`: the base price times `EQUIPMENT_PRICE_SCALE`
  (1 today), rounded to the nearest ¥100. The panel and the tests read the helpers, never the base prices.
- **Saves** from before studios start in a studio with a desk for every assistant they have (3: loft, 2: flat,
  otherwise the apartment) and no equipment.
- `studioLook(s)` is what the studio scene will draw: the tier, its desks, the owned list itself (the same array, so
  it can be compared by reference), the volumes shipped across every serial, at most 24, and `animePoster`, true from
  an anime's premiere until its volume boost ends.

### Part-time job
- A third daily activity: earns money, costs a little stamina, draws nothing. The money lifeline.
  Same stamina rules as drawing: pay is halved when low, nothing at zero, and hitting zero forces rest.

### Trips and training
- Library / Reader survey reveal Notebook cells. Classes add +2 to a stat. Hot spring restores and raises max stamina.
- The player is away for the trip's length; nothing is drawn.
- Two trips are reached only by answering a random event, and the Trips panel does not list them: the Comic
  Convention (2 days, ¥500, fans on return) and the Manga Masterclass (3 days, ¥400, +3 to the lowest stat).

### Editors
- Each magazine has an editor. Every result raises the relationship; every 3 points the editor shares a tip that
  reveals a theme x audience pairing for that magazine's readers.

### Random events
One decision at a time, shown as a card on the desk and never as a popup (pillar 3). The card names both answers with
every effect they have, and says how many days are left to answer. `src/sim/events.ts`.
- **The roll.** On days where day % 7 is 3, from `nextEventDay` on (day 28 in a new career), with no event waiting and
  no trip under way, two values are drawn from `eventSeed`: the first under 0.35 lands an event, the second picks it
  from the eligible pool, in the table's order. `eventSeed` is its own stream (`hashString('events:' + worldSeed)`),
  so an event landing or not never moves the main `seed`. A landed event expires 7 days later and the next roll waits
  14 days. It toasts and pauses the clock once, the day it lands.
- **Ignoring one.** The day after it expires, the event lapses: a log line, nothing else.
- **Money and trips.** An answer that costs more than the player has is disabled and says what it needs, so an event
  never takes money below zero. A waiting event survives a trip: the card stays on the desk and every answer except a
  new trip can be given while away.

| Event | Eligible | A | B |
|---|---|---|---|
| Fan letter | fans ≥ 300 | Write back: stamina −5, fans + clamp(round(fans × 0.02), 50, 1,500) | Keep it: stamina +8 |
| Cold | always | See a doctor: −¥300, stamina +25 | Tea and an early night: stamina +8 |
| Convention | fans ≥ 1,000, money ≥ ¥500 | Book a table: 2-day trip, ¥500; on return fans + min(5,000, 150 + round(fans × 0.04)) | Skip it |
| Raise | the first assistant who has not asked yet | Give the raise: salary becomes round(salary × 1.2 / 10) × 10, their art and story +3 | Not this year: their max stamina −10 |
| Reprint | a serial, running or archived, with a volume | Approve: + round(average copies a volume × 0.25) × VOLUME_PRICE | Colour page: stamina −12, + round(average copies a volume × 0.4) × VOLUME_PRICE |
| Workshop | level ≥ 3, money ≥ ¥400 | Attend: 3-day trip, ¥400; on return +3 to the lowest stat (ties: art, story, pacing) | Decline |

Stamina changes clamp to 0..max stamina. Each assistant asks for a raise once, whatever the answer. A reprint is for
the running serial when it has shipped a volume, else the latest archived one that has.

### Anime adaptations
A hit serial is offered one adaptation, shown as a card on the desk and never as a popup (pillar 3). The card lists
both studios' terms, with "Sign with Studio Kumo", "Sign with Hoshi Animation" and "Not now", and says how many days
are left to answer. `src/sim/anime.ts`; no RNG.
- **The offer.** Checked every day (`animeTick`): a running serial with popularity 70 or more and 15,000 or more
  copies sold across its volumes, never offered one before (`animeOfferedFor`), with no offer waiting and no earlier
  deal whose volume boost is still on (`day <= tailEndsDay`). It toasts, pauses the clock once, and stands for 14 days
  (answerable up to and including `expiresDay` = the day it landed + 14); the day after, it lapses with a log line.
  The serial stays in `animeOfferedFor` whether the offer is signed, passed on or lapses: studios ask once per series.
- **Wrapping up or cancellation.** The offer is for a running series: wrapping the series up withdraws a waiting
  offer at once (`endSerial`), and a cancellation withdraws it in the same tick (`animeTick` runs after
  `resolveChapters` and `checkDeadline`), each with a log line.
- **A deal.** Signing fixes every day: `airsDay` = signing + weeks to air, `endsDay` = `airsDay` + weeks on air,
  `tailEndsDay` = `endsDay` + the boost weeks. Week k on air pays on `airsDay` + 7k (when `(day - airsDay) % 7 === 0`
  and `airsDay < day <= endsDay`), so the premiere day pays nothing and the finale day pays the last week. At the
  premiere the serial's popularity rises by the studio's lift (capped at 100) only if it is still running; the anime
  airs and pays either way. Signing, the premiere and the finale toast; weekly pay and the end of the boost are log
  lines.
- **Volumes.** `animeVolumeMult(s, serialId)` is the deal's multiplier from signing while `day <= tailEndsDay`, else 1.
  Regular volumes sell round(copies x multiplier) and the wrap-up volume round(copies x 1.5 x multiplier); the volume
  log says "(1.3x with the anime)". The Series panel shows the deal: "Signed with Studio Kumo, airs in 6 weeks;
  volumes sell 1.3x.", then "On air, week 3 of 12: +400 fans and ¥500 a week; volumes sell 1.3x.", then the boost
  left after the finale.

| Studio | Fee | Airs after | Runs | Per week | Volume mult | Popularity at premiere |
|---|---|---|---|---|---|---|
| Studio Kumo | ¥2,000, paid at signing | 6 weeks | 12 weeks | +400 fans, +¥500 | 1.3x, until 12 weeks after the finale | +5 |
| Hoshi Animation | ¥0 | 16 weeks | 24 weeks | +900 fans, +¥1,000 | 1.6x, until 24 weeks after the finale | +12 |

Signed on day 100, Kumo airs on day 142, ends on day 226 and boosts volumes to day 310 (12 payouts: +4,800 fans and
+¥6,000, plus the ¥2,000 fee); Hoshi airs on day 212, ends on day 380 and boosts to day 548 (24 payouts: +21,600 fans
and +¥24,000). The balance bots never sign, so every offer lapses for them.

### Auto-pause rules
The clock stops whenever the game needs a decision: a manuscript becomes ready, poll results arrive, a
serialisation offer lands, a serial is cancelled (the desk empties), a trip ends, a random event lands, or an anime
offer lands. Menus always pause.

## Roadmap
0. Money sinks. Shipped: hiring needs two weeks of that salary in the bank; a week that ends below zero makes
   assistants quit and charges an overdraft fee (5% of the debt, at least ¥50), and a week that ends with less
   than one week of costs warns first; studio tiers gate assistant desks with rent, and equipment has stated effects
   (see Studio and equipment). Still to do: a volume curve that flattens with fans (sqrt), a smaller HUD on phones
   shipped separately.
1. Awards (year end), merchandise, conventions. Shipped: anime adaptation offers (see Anime adaptations).
2. Rival mangaka with visible careers and head-to-head polls.
3. Random events with choices. Shipped: six events as desk cards (see Random events).
4. Save slots, achievements, sound, mobile polish.

### Milestones
A visible ladder of 18 career goals. The next unreached goal sits at the top of the desk ("Next goal") and the
Career panel lists the whole ladder. Milestones are checked at the end of every tick, consume no RNG, and each
pays XP once (total 1,840 XP, about two extra levels over a career). A hire or a wrap-up made through a command is
awarded on the next tick, at most one day later.

| Id | Title | XP | Rule |
|----|-------|----|------|
| first-manuscript | First manuscript | 40 | a one-shot reached ready (or was submitted, polled, or is in history) |
| first-poll | First poll | 40 | one poll result in history |
| top-half | Top half | 60 | any poll placement with rank <= ceil(entrants / 2) |
| podium | On the podium | 80 | any poll placement with rank <= SERIAL_OFFER_MIN_RANK |
| fans-1k | A thousand fans | 80 | fans >= 1,000 |
| first-hire | First hire | 60 | one assistant employed |
| first-serial | Serialised | 100 | a serial running or archived |
| first-volume | First volume | 100 | volumes across all serials >= 1 |
| level-5 | Level 5 | 100 | level >= 5 |
| fans-5k | Five thousand fans | 100 | fans >= 5,000 |
| chapters-10 | Ten chapters | 100 | chapters sent across all serials >= 10 |
| money-50k | Fifty thousand | 100 | money >= 50,000 |
| three-assistants | Full studio | 80 | three assistants employed |
| fans-20k | Twenty thousand fans | 150 | fans >= 20,000 |
| big-league | Big league | 150 | a serial (running or archived) in Weekly Bolt or Ultra Seinen |
| chapters-50 | Fifty chapters | 150 | chapters sent across all serials >= 50 |
| graceful-exit | Graceful exit | 150 | an archived serial with status ended and popularity >= 50 |
| fans-100k | A hundred thousand fans | 200 | fans >= 100,000 |

## Tick order
The final hook order inside `tick()`:

1. Day + 1.
2. Trip, part-time job, or the work-or-rest branch (pages, stamina, assistants; equipment effects apply here).
3. Weekly costs (living cost, studio rent and salaries, with the overdraft rules).
4. Candidate refresh.
5. One-shot poll result and serialisation offer.
6. `resolveChapters` (chapter polls, volumes, warnings, cancellation, archiving).
7. `checkDeadline` (a serial chapter not in by its due day misses the issue; warnings and cancellation).
8. `animeTick` (a waiting anime offer whose series stopped running is withdrawn, one past its last day lapses; each
   deal's premiere, weekly pay, finale and end of boost; a new offer to a running hit).
9. `eventTick` (an unanswered event past its last day lapses; the weekly random-event roll).
10. `awardMilestones`.
11. Return.

The future year review `closeYear` goes between `checkDeadline` and `animeTick`, so the anime, events and milestones
see its effects the same day.

## Balance bots and bands

`src/sim/bot.ts` holds three deterministic player policies that drive the real sim: `botStep` makes one day's
decisions through the same commands the store calls, then ticks. The game never plays itself, so `index.ts` does not
export them.
- **Sensible** plays the way the interface teaches. For each magazine it plans the best known pairing for that
  magazine's readers, drawn with the focus the magazine suits, and keeps the magazine with the best forecast odds (ties:
  higher expected pay, then the softer field). It spends every point as it arrives (every third on pacing, the rest on
  art or story, whichever its target magazine weighs higher), takes shifts while money is under two weeks of costs,
  hires when a chapter will miss its issue, and wraps a serial up at 16 results with popularity 50 or more.
- **Careless** ignores the Notebook, the odds and the stats screen: every choice is a hash of the world seed and the
  project id, the focus is balanced, and it never spends points.
- **Stress case** draws six fixed one-shots rotating Weekly Bolt, Kids Comic Go!, Monthly Petal and Ultra Seinen
  without spending points, then is forced into a Weekly Bolt serial with balanced focus; it declines organic offers
  and never wraps up.

`npm run balance -- [from=1] [to=20] [--detail seed]` prints a line per seed per bot, then one line per balance-band row
(`--detail` adds every one-shot and chapter of that seed). The runs and the row measurements live in
`src/sim/balance.ts`; the script prints them and `src/sim/__tests__/balance.test.ts` asserts them (the bots run once
per test file), so the readout and the test cannot disagree. Each seed is played three ways: year one (336 days) for
weeks in debt and calibration; up to the 6th one-shot (at most three years) for the first score, the first offer, the
first-six mean and the money at the 6th; until the first serial ends or reaches 8 results (at most three years). The
stress case plays 480 days.

### Balance bands (Package 1, seeds 1 to 20)

| Measure | Target |
|---|---|
| Sensible bot, first one-shot score | 40–55 on ≥ 13/20; median 44–52 |
| Sensible minus careless, mean score of first 6 one-shots | ≥ 8 |
| Sensible bot, organic offer within first 6 one-shots | ≥ 16/20; median first offer at one-shot ≤ 3 |
| Careless bot, organic offer within 6 | ≤ 6/20 |
| Sensible bot's first serial reaches 8 results | ≥ 14/20 |
| Stress case (forced Weekly Bolt, no points, balanced) | cancelled on ≥ 15/20, never before its 5th result |
| Careless bot money at its 6th result | < ¥3,000 on ≥ 15/20 |
| Forecast calibration (Σ offer chances vs offers seen, year one) | within ±30% |
| Sensible bot weeks in debt, year one | 0 on ≥ 18/20 |

balance.test thresholds change only with owner sign-off. When a rule change pushes a row out of its band, tune a
knob, not the threshold, in this order: the Kids Comic Go! rival mean (45–49), `SERIAL_GRACE_CHAPTERS` (4–6), Kids
Comic Go! `chapterDays` (21–24), `MAGAZINE_MISMATCH_PENALTY` (25–35), and record the change as a ruling. A knob change
moves hand-derived test literals (scores, ranks, due days, probabilities); re-derive each by hand in the same change.

Those four knobs move ranks, offers and serials but not a fresh player's first one-shot score: on seeds 1–20 every
sensible first pitch is a kids manuscript at Kids Comic Go! (so the mismatch penalty never applies, and moving the Kids
rival mean across 45–49 leaves the pitch there), and grace and chapter rhythm only touch serials. That score comes from
the starting stats, the page noise and the hidden ratings, so the first-score row is tuned through the starting stats.
Package 1 raised the starting art from 38 to 40 (story 34 and pacing 30 unchanged): the median first score on seeds
1–20 went from 43 to 44 and over seeds 1–100 from 47 to 48, the middle of the band.

Package 2 adds rows for events, the rival, awards and equipment, and re-asserts every Package 1 row.
