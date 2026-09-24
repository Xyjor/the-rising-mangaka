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
- Each has an audience lean, a page rate, circulation, and a rival strength.
- Submitting to a magazine whose audience differs from the manga's audience costs Audience fit.
  The submit panel shows this before the player commits.

### Reader poll scoring (0–100)
| Component    | Weight | Source                                   |
|--------------|--------|------------------------------------------|
| Art          | 25     | accumulated art quality                  |
| Story        | 25     | accumulated story quality                |
| Pacing       | 15     | Pacing stat + noise                      |
| Audience fit | 15     | theme×audience rating, magazine mismatch |
| Freshness    | 20     | genre×theme rating, staleness penalty    |

Rank = 1 + number of rivals scoring higher. Rewards scale with score and rank.
The editor writes a one-line comment pointing at the weakest component.

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
- **Popularity** (0-100) is a moving average of poll placement. Three consecutive weak chapters (roughly the bottom
  quarter, rank > ceil(0.7 x entrants)) cancel the series and cost 10% of fans. Every 4 chapters a **volume** ships;
  copies = (fans + circulation x 20) x popularity.
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
The clock stops whenever the game needs a decision: a manuscript becomes ready, poll results arrive, or a
serialisation offer lands. Menus always pause.

## Roadmap
0. Money sinks. A hit series earns tens of thousands per volume; add studio upgrades (better desk, tools,
   a bigger room for more assistants) so money keeps mattering. Consider a smaller HUD on phones.
1. Awards (year end), anime adaptation offers, merchandise, conventions.
2. Rival mangaka with visible careers and head-to-head polls.
3. Random events with choices (fan letters, illness, editor requests).
4. Save slots, achievements, sound, mobile polish.
