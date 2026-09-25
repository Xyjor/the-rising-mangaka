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
story focus suits Monthly Petal and Ultra Seinen. For a fresh player drawing a kids one-shot, art focus scores about
3.7 more than story focus at Kids Comic Go!, and story focus about 2.8 more at Monthly Petal. The desk's focus hint,
the pitch screen, the wizard's audience step, the results breakdown ("weight N%") and the stats screen all show the
weights, so the modifier is never hidden.

Rank = 1 + number of rivals scoring higher, each drawn as `magazine.rivalMean + Gaussian noise (sd RIVAL_SCORE_SD)`
(see CLAUDE.md balance touchpoints for the current rival score range and spread). Rewards scale with score and rank.
The editor writes a one-line comment on the component that cost the most points at that magazine
(`biggestLoss`: the largest weight × (100 − component), ties in the order art, story, pacing, fit, freshness).

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
  copies = (fans + circulation x 20) x popularity.
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
- The balance bots hire help when the chapter on the desk is late, a desk is free, and the bank holds two weeks of
  the candidate's salary on top of two weeks of current costs; they pick the most pages per day per yen of salary.
- Freshness erodes 2 points per chapter after chapter 8, so every series has a natural arc. The player can wrap a
  series up at any time and converts popularity into loyal fans.
- Wrapping up with popularity 50 or higher after at least one volume has shipped sells a final volume at 1.5x copies;
  wrapping before any chapter has polled earns nothing.

### Staff
- Up to 3 assistants. Three candidates rotate every 4 weeks. No hiring fee, weekly salary.
- Each adds pages per day and blends their own Art/Story into page quality. Traits: Fast, Careful, Inspiring, Steady.
- Assistants tire like the player and rest when the player rests or works a part-time job.

### Part-time job
- A third daily activity: earns money, costs a little stamina, draws nothing. The money lifeline.
  Same stamina rules as drawing: pay is halved when low, nothing at zero, and hitting zero forces rest.

### Trips and training
- Library / Reader survey reveal Notebook cells. Classes add +2 to a stat. Hot spring restores and raises max stamina.
- The player is away for the trip's length; nothing is drawn.

### Editors
- Each magazine has an editor. Every result raises the relationship; every 3 points the editor shares a tip that
  reveals a theme x audience pairing for that magazine's readers.

### Auto-pause rules
The clock stops whenever the game needs a decision: a manuscript becomes ready, poll results arrive, a
serialisation offer lands, a serial is cancelled (the desk empties), or a trip ends. Menus always pause.

## Roadmap
0. Money sinks. Shipped: hiring needs two weeks of that salary in the bank; a week that ends below zero makes
   assistants quit and charges an overdraft fee (5% of the debt, at least ¥50), and a week that ends with less
   than one week of costs warns first. Still to do: studio tiers that gate assistant slots with rent, equipment
   purchases with stated effects, a volume curve that flattens with fans (sqrt), a smaller HUD on phones shipped
   separately.
1. Awards (year end), anime adaptation offers, merchandise, conventions.
2. Rival mangaka with visible careers and head-to-head polls.
3. Random events with choices (fan letters, illness, editor requests).
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

1. Trip, part-time job, or the work-or-rest branch (pages, stamina, assistants).
2. Weekly costs (living cost and salaries, with the overdraft rules).
3. Candidate refresh.
4. One-shot poll result and serialisation offer.
5. `resolveChapters` (chapter polls, volumes, warnings, cancellation, archiving).
6. `checkDeadline` (a serial chapter not in by its due day misses the issue; warnings and cancellation).
7. `awardMilestones`.
8. Return.

Future hooks (events, year review, anime) go between `checkDeadline` and `awardMilestones` so milestones see
their effects the same day.
