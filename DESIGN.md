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
   modal. Player controls speed at all times (the studio log is a window opened from the Log
   button, which counts the lines not yet seen).
4. **One screen: the studio.** The HUD floats over it, the desk is a status card over it, and
   every management screen is a pixel-framed window opened from the rail. No nested menus more
   than one level deep.
5. **Hybrid look.** The pixel-art studio fills the window for warmth and flavour; the controls
   over it and the panels are pixel-framed windows (a Silkscreen display face, hard shadows, a
   bevel) that keep modern body type, plain words and transparent numbers.

## Core loop (vertical slice)

```
Plan manga  →  Draw pages (days pass)  →  Submit to a magazine  →  Reader poll results
   ↑   (genre × theme × audience)           (stamina, focus)         (rank, money, fans, XP)
   └────────────────────────── level up, notebook grows ──────────────────────────────┘
```

### Time
- 1 tick = 1 day. 7 days = 1 week, 4 weeks = 1 month, 12 months = 1 year (336 days, `DAYS_PER_YEAR`). Every year
  ends with awards and a year review (see Year end and awards).
- Speeds: paused / 1x / 2x / 3x. Opening any modal pauses. Closing restores previous speed.
- The presentation clock (`src/state/clock.ts`) runs a week-long light cycle independent of the sim day: no hour
  clock, just day/night over the 7-day week.

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
per magazine) come from a hash of the world seed, so making the rival consumes no RNG. A new career's rival has craft
`RIVAL_START_CRAFT` 57. At every year end (`closeYear`, see Year end and awards) `growRival` adds
`RIVAL_YEARLY_GROWTH` 4, capped at `RIVAL_MAX_CRAFT` 76, so after n years the rival is `makeRival(worldSeed, n)`:
craft `min(76, 57 + 4n)`. The rival runs in the magazine with the highest rivalMean at most craft − 6
(`RIVAL_FIELD_MARGIN`), else Kids Comic Go!, so they climb one magazine a year (57 Kids, 61 Petal, 65 Bolt, 69 and up
Ultra); when growth moves them, they take that magazine's series
(the same hash), a log line says so, and the year review tells it. In that magazine's polls (`pollField`) the rival
takes entrant 0's draw slots, so a poll still draws `2 + entrants × 2` values and the other magazines' polls are
unchanged. The polls and the pitch forecast share one check for whether the rival runs in a magazine (`rivalIn`).
The rival's rank is 1 + other entrants above it + 1 if the player scored higher; results store `{ name, score, rank }`
(score rounded, 0 to 100). The pitch screen marks the rival's magazine ("Rival: name", "Beat first name: N%"), the
results screen says where the rival placed and whether the player finished ahead or behind, the series table has a
Rival column, and the Career screen shows the series, the usual score range (craft ± 8) and the head-to-head record
(`rivalRecord`: a win is a better rank). Saves
from before the rival get the one their world would have by the save's day (`upgradeSave`, `makeRival` with the
whole years played).
The editor writes a one-line comment on the component that cost the most points at that magazine
(`biggestLoss`: the largest weight × (100 − component), ties in the order art, story, pacing, fit, freshness).
The rival has a temper (`temper`: gracious, cocky or stoic), from `hashString('temper:' + worldSeed) % 3`, so it
consumes no RNG; `makeRival` stores it and `upgradeSave` gives an older save's rival its world's temper. It is text
only: the results rival line ends with the rival's quote for ahead, behind or tied, and the year review's rival line
with a quote for a year led, trailed or even (`RIVAL_RESULT_QUOTES`, `RIVAL_YEAR_QUOTES` in `ui/labels.ts`).

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
  `clock.ts` is the separate, never-persisted presentation clock (the light cycle, the studio log's read marker).
- `src/ui/` — React components. `scene/` is the pixel-art canvas studio (`render.ts` paints a frame from a snapshot,
  `season.ts` the window's season, `studioArt.ts` the player's studio, `paint.ts` the shared pixel helpers,
  `StudioScene.tsx` runs the frame loop). `hud/` is the corner overlays and rail; `hooks/` are the presentation-clock
  and rolled-number hooks. `panels/` are the management screens.
- `src/audio/` — Web Audio sound, synthesised, no files (see Sound).
- `src/platform/` — where the game runs (browser or desktop) and the only place that imports the desktop APIs;
  `src-tauri/` is the Windows desktop shell itself (see The desktop app and save files).
- `src/styles/` — design tokens (CSS variables), light/dark, base styles.

### Seasons
The studio window follows the calendar (`describeDate`'s month, floor((day mod 336) / 28) + 1): months 1-3 spring,
4-6 summer, 7-9 autumn and 10-12 winter, so every year opens in spring (`seasonOf`). The season is decoration only; it
changes no rule.
- **Spring**: a cherry branch in blossom and 12 petals blowing down and across the pane; the branch spills past the
  frame onto the wall with four blossom clusters (`drawSeasonWall`, canvas x 171-181, y 42-48, after the window bars,
  clear of the calendar and the corkboard), so the tree reads as bigger than the window.
- **Summer**: a green canopy and a wind chime whose strip swings; at night 5 fireflies glow over the dark.
- **Autumn**: a rust canopy and 12 leaves swaying as they fall.
- **Winter**: a bare branch capped with snow, 16 snowflakes and snow on the sill.

Everything but the sill's snow stays inside the pane (room x 118-161, y 12-43; canvas x 182-225, y 48-79), behind the
window bars; the fireflies, drawn over the night, keep off the bars (canvas rows 54-61 and 65-72, never columns
203-204). The sun and the clouds are clipped to the pane too, so a cloud slides out behind the frame. The particles and
the clouds move with the scene's frame, so they hold still under reduced motion (the cloud whole at the pane's left
edge).

### The studio in the scene
The scene is a 320x180 canvas (`src/ui/scene/render.ts`), painted at 24 fps (`StudioScene.tsx`'s `STEP_MS` 41; the
animation frame counter advances +2.5 a step while the clock runs, +1.25 while paused, so idle scenes still breathe).
Lighting comes from the presentation clock's `t` (`useClock`), night when `t > 0.72 || t < 0.06`; the scene keeps
animating behind modals (their backdrop is translucent) and only sleeps when the document tab itself is hidden.

Two coordinate spaces meet in `paint.ts`: room space is the original 192x108 layout (every furniture, window and
studio-art literal), offset by `OX 64, OY 36` into canvas space by `rect`; `rawRect` paints straight in canvas space
for the wall, the floor, the kitchenette, the entrance and the door, none of which existed in the old room. The wall
band runs canvas y 0-113 and the floor y 114-179, painted per tier by `roomArt.ts`'s `TIER_ROOM` (see "The room"
below); once the tier's generated wall is loaded it replaces the code-drawn wall band (`TIER_WALL`), and the floor stays code-drawn (`TIER_FLOOR`; see "Art", "Scene images"). The kitchenette sits on the left wall at canvas x 2-61, y 56-113. The front door is a fixed frame on the right
wall, canvas x 258-274, y 56-113: a plain two-panel door in the apartment, a lit indigo-noren doorway in the flat and
the loft, spilling warm light at night. Beside it, the entrance holds a doormat and a coat rack (the mangaka's coat
hangs there only while they are out). The whole scene is drawn for a phone's `object-fit: cover` crop of canvas x
24-296; the studio-art regions below stay inside it and off the actors' spots.
- **Tiers.** The studio flat opens a lit doorway in the right wall with an indigo noren (the front door's frame,
  canvas x 258-274, y 56-113), which spills warm light at night. The loft keeps the doorway and adds a potted plant on the sill (x 150-155)
  and a tall one on the floor in front of the bed (x 172-184, y 80-105).
- **Equipment.** Coffee machine on the sill's left (x 118-126). Arm lamp in place of the small desk lamp (x 92-105), its
  bulb and glow lit at night or while the mangaka works. Reference shelf, a slim three-shelf unit between the bookshelf
  and the poster (x 43-50, y 20-57). Tall mesh chair in place of the plain one, behind the seated mangaka (x 68-91).
  Drafting table in place of the desk, wider (x 44-111), with a lightbox on its left end. Pen tablet under the pen
  (x 86-95, y 60-61), and the ink pot moves right to make room.
- **Volumes**: one spine per volume shipped on top of the bookshelf, in sets of six, at most 24 (x 10-36, y 13-17).
- **Anime poster**: while an anime's boost runs, its key visual replaces the poster (x 52-73, y 14-41).
- **Trophies**: one gold trophy per award on the sill, the most recent 4 (x 130-144, y 38-44).

**The room** (`roomArt.ts`, canvas space, upgrade 0.3.0). Each tier has its own walls and floor, so moving up shows
on screen: the apartment is a six-mat room (sand plaster, a wooden ceiling molding and nageshi beam, pillars at x
62-65 and 252-255, two rows of tatami with dark-green cloth edges at y 114, 146 and 178); the flat has striped
wallpaper (since 0.10.1 sixteen 10 px teal stripes on a pale ground) over a walnut wainscot (rail at y 84), honey planks and a red rug in front of the desk (x 104-195, y 122-137); the loft
has pale plaster, an exposed brick accent between the window and the door (x 230-253), polished concrete and an
indigo rug. The flat and the loft are framed in dark wood like the apartment's pillars (upgrade 0.5.0): a 2 px beam
under the ceiling (y 3-4) and two posts (x 62-65 and 252-255), clear of the door, the pane and the story props. Every room has a light switch by the door (x 244-247, y 84-89) and an outlet (x 66-69, y 104-107). Under
the furniture and the standing or walking characters, a 2 px contact shadow (`paint.ts` `shadow`). A front row stands
on the floor (`TIER_FRONT`, y 140-179, x 60-260, drawn after every actor so the cat passes behind it): the
apartment's zabuton and manga boxes, the flat's fern and a stack of books, the loft's floor lamp and sofa corner, and
the bin in every tier.

**The story props** picture state the panels already explain (the "show the why" pillar: no rule lives in them).
`story.ts` `storyLook` reads the game into five primitives on the snapshot:

| Prop | Where (canvas) | What drives it |
|---|---|---|
| Corkboard | x 140-154, y 46-63 | one storyboard card per sixth of the pages drawn, two rows of three (`corkCards`, while a manuscript is on the desk); the last poll's note in the corner: a gold star for the top three, a red mark for the bottom third (`rankTone`) |
| Calendar | x 164-177, y 50-63 | the chapter's due day circled (`daysLeft`, a cell per day, up to 8), the grid reddened in the last three days, the binding blinking red while late |
| Coffee cups | x 136-150, y 120-123 | one on the floor under the desk below 60, 40 and 20 stamina |
| Serial cover | the poster's place, x 116-137, y 50-77 | while a serial runs (`serialOn`), tinted by its genre (`posterHue`); the anime's key visual still comes first |
| Fan letters | x 259-273, y 108-113 | one on the doormat per fan level (100, 1,000, 10,000 fans) |
| Bin | x 233-243, y 151-167 | a crumpled page per quarter of the manuscript drawn, while drawing |

**The light** (`drawAmbient`, after the night overlay and the studio's lights): by day a shaft from the window lies on
the floor in four steps and slides with the sun, a broad warm wedge (each step 8 px wider than the last, 44 to 68,
and fainter, alpha 0.14 to 0.08); at night while working, the desk lamp's pool on the desk (three
steps); the pen tablet's glow while working; and a soft vignette on the four edges, always.

**Hiding the desk.** On desktop the dock (the status card and the desk tray) sits over the lower middle of the scene,
where the desk's front and the front row are. The eye button left of Settings (and the D key) tucks the dock away to
look at the studio and brings it back; the flag (`deskHidden`) is not saved, and the auto-pause for any decision shows
the desk again. On phones the scene is a band above the desk, so there is nothing to hide and the button is not shown.

Draw order: the tier's room first; the coffee machine and the trophies after the sill and its snow; the volumes and the reference shelf after
the bookshelf; the tier after the bed (the doorway stops where the bed begins, y 66, so the two never overlap) and
before the sleeping mangaka's Zz; the chair before the mangaka at the desk, the drafting table, the lamp and the tablet
after; the corkboard and the calendar after the clock; the fan letters after the entrance; the cups after the desk;
the front row after the editor; the lamp's glow and the doorway's spill over the night overlay, then the light. Everything stays off the mangaka at the
desk and at the standing spot.

**The cast** (`actors.ts`) is a table of actors (the mangaka, three assistant slots, the editor, the cat), each with a
position, a target, a facing, a current and a goal pose, and which axis it walks first (`legs`, `'xy'` or the cat's
`'yx'`, kitchen trips going vertical first). `planActors` reads the game each frame and sets targets and goals from
seven fixed spots (the mangaka's seat, standing spot and bed; the door; the editor's spot; the cat's bed and its
kitchen spot); `stepActors` walks everyone toward them at `WALK_PX_PER_S` 40, one axis then the other; `settleActors`
puts everyone in place at once, used on mount and on a loaded save so nobody walks in from off-screen. The assistants
never walk: they are placed straight into their seat, seated or asleep, and while working each draws its own page
(3 fills) with a couple of ink lines.

**The editor's visit** (`visitor.ts`, `useArrival`) picks the one reason they are at the desk, in priority order:
a pending chapter result, a pending offer, the project ready to submit, an anime offer, a random event, then an
unread year review; each reason has its own carried prop (envelope, letter, contract or trophy) and greeting line.
The walk from the door to the editor's spot is `EDITOR_WALK_MS` 1400, derived from the door-to-spot distance at 40
px/s; `StudioScene` plays the `knock` cue the moment the editor's state becomes `'standing'` after actually walking
there (never on a settle, and never in a read-only tab or while the window is hidden), and `useArrival` gates a
pending result's or offer's own card mount on that same delay (at once under reduced motion, or when it was already
pending on mount).

The wall clock's hands lap the visual week (8 times an hour hand, twice a minute hand) from the presentation clock;
the plant sways every 30 frames; the cat has two spots (asleep in its bed at the foot of the mangaka's, or sitting in the kitchen while
everyone rests).

**Bubbles and pops** are DOM overlays, not canvas drawing, placed with `sceneAnchor.ts`'s `sceneToCss` (the same
cover-fit scale and centred overflow as the canvas). A `Bubble` (`Bubble.tsx`, styled by `scene.css`, using design
tokens) shows the mangaka's latest daily log line for `BUBBLE_MS` 4000, or the editor's greeting while they are
visiting. `Pops.tsx` floats money, fans and xp numbers up from the mangaka (or the desk when they are out of sight)
for `POP_MS` 1200 each, capped at `POP_MAX` 6 on screen, guarded against a save load, a seed change or a multi-day
jump so a pop never fires from anything but one step of play.

**The sprites** (`sprites.ts`) are string maps, one character per pixel, drawn by `drawSprite`, which merges each
horizontal run of one key into one fillRect and mirrors a frame to face right. People are 24x32 frames facing left, in
chibi proportions (upgrade 0.4.0): the head is rows 0-15 (18 px wide, cols 2-19), the body rows 16-31 (2 heads tall).
`PAL` keys are an uppercase base and its lowercase shade (light from the top left, so the shade sits on the right and
underneath), `L` the outline; `ASSISTANT_PALS[look]` swaps the hair and shirt. Every 24x32 frame passes `frameRules`
(every row full width, every key in the palette, feet on the last row, a closed outline); `MANGAKA_PANIC` is the one
redrawn in upgrade 0.5.0 with both hands clamped on top of the head (the arms raised, the elbows out at cols 0-3 and
20-23, the hands meeting the hair at rows 1-3, frame 1 a row lower), replacing the earlier ruling's fists beside the
head at rows 5-8: with the raised arms the hands read as hands, not ears. The cat has a cream chest patch (`Q`,
`#f0ead6`) in every frame where its chest shows (not the curled `CAT_SLEEP`), and sleeps on a round mustard cushion
at `CAT_BED` (4 fills, drawn just before it).

- **Expressions** are an overlay, not baked into most frames: `FACES[mood]` (14 wide x 4 tall, `mood.ts`'s `Mood`,
  excluding `neutral`) is drawn at `(x+4, y+9+headDy)`, only on head-steady poses (the standing mangaka's breathing
  idle, the seated mangaka outside panic, the seated assistants). Walking, panic, bed and doze keep their own
  baked-in expression. `neutral` draws no overlay at all (the anchor's own face shows).
- **Moods and marks** (`mood.ts` `moodOf`, priority order): `surprised` (the editor is standing in the studio and the
  mangaka is home) beats `happy` (`cheer`, set for `CHEER_MS` 2400 ms by `cheersFor` after a fans pop or a level-up
  pop, never a plain xp gain) beats `tired` (stamina below `LOW_STAMINA_THRESHOLD`) beats `sleepy` (working late at
  night: the seated mangaka is drawing, the clock is running, and it is night) beats `neutral`. Panic (the seated
  mangaka late on a chapter) is not a mood; it beats every one of them and stays the existing `MANGAKA_PANIC` frames.
  Each mood also has a mark at the head's top-right edge, `(x+20, y-2)` (cols 20-22, rows -2 to 2: right of the hair,
  clear of its outline; `markX` mirrors it to cols 1-3 for a frame facing right) in `MARK_PAL`: a sweat drop (tired), a sparkle (happy),
  `!` (surprised), `z` (sleepy). Only one mark ever occupies that slot: the standing mangaka's ready-manuscript `!`
  beats the mood mark, which beats the idle `?`.
- **Idle cycles** are pure functions of the frame counter in `mood.ts`. The standing mangaka's 360-frame cycle
  (`idleFrame`) is 0-239 breathing (today's `frame/16 % 2`), 240-299 a stretch (`MANGAKA_STRETCH`, 2 frames,
  `frame/15 % 2`), 300-359 a sip from a mug (`MANGAKA_SIP`, 2 frames); it applies only outside the `ready` phase (the
  manuscript is in hand then). The cat's 480-frame sitting cycle (`catFrame`) is 0-359 `CAT_SIT`, 360-419 a groom
  (`CAT_GROOM`, 2 frames, `frame/15 % 2`; the ledger's ruling keeps the head in place and raises a paw over the ear
  gap instead of the spec's "head lowered one row", which hid the change), 420-479 a stretch (`CAT_STRETCH`). Frame 0
  (reduced motion) is always the plain idle for both.
- **Outfits by level** (`outfitOf`, `OUTFIT_PALS`), the mangaka only, swap `J`/`j` in the palette: levels 1-4 a hoodie
  (`#6f7a8c`/`#525c6b`, the original palette), 5-9 a cardigan (`#c9a24a`/`#a8832f`), 10+ a blazer
  (`#2e3a78`/`#222b5c`). The idle and seated frames carry a collar (`K`, either side of the neck) and a tie (`Y`, shade
  `y`, down the shirt): the cardigan and the blazer show them white and red; in the hoodie (`PAL`) and on every
  assistant (`ASSISTANT_PALS`, `y` their own shirt colour) they keep the colours of the cells they replaced, so those
  look unchanged. Purely cosmetic, so no UI hint is needed.
- **Face rules and generated frames** (0.11.0, task C1). `faceRules(frame)`, next to `frameRules`, lists what stops a
  head-steady frame taking the mood overlay: rows 9-12, cols 4-17 (where `FACES` lands) may hold only face keys (`S s
  E W M B L`), rows 0-2, cols 20-22 (the mark slot) must be clear, and the head (rows 0-15) must stay inside cols 2-19,
  the `SpriteAvatar` crop. `ANCHOR_HEAD` is the hand-drawn anchor head (rows 0-15 of `MANGAKA_IDLE[0]`, asserted
  equal); the staff portrait draws it, and the `--sprite` pipeline (see "### Art") grafts it onto a generated frame
  whose own head fails `faceRules` (the graft rule: rows 0-15 replaced, recorded per frame in the manifest as
  `graft: "anchor-head"`). `breathOf` is the idle's breath (rows 0-23 a row lower, `breathOf(MANGAKA_IDLE[0])` being
  exactly `MANGAKA_IDLE[1]`). **None of the C1 frames is drawn**: the readability gate (`sprites-C1.png`, every
  frame next to its hand-drawn one, 8x, three outfits, every mood) found the idle (a narrow column, no arms or
  shoes), the two seated frames (the stool baked in, no pen arm, two unrelated cells that jitter when they alternate),
  panic (mush) and the bed (a front view peeking over a blue mound, nothing like the pillow pose) read worse at 24x32,
  so every pose keeps its hand-drawn frame (the plan's fallback). Only the four side-on walk frames read, and they lost
  to the hand-drawn walk at the final review (in motion they slide, with no pass frame and no bob, and face side-on
  against the front-facing set). All nine C1 candidates are retired (see "Retired candidates" below). Stretch, sip
  and the doze had no cell on the sheet. Every hand-drawn frame
  that takes the overlay (the breathing idle, the seated frames) passes `faceRules`, and so does the sip; the stretch
  does not (its flung arms leave the avatar crop), which is harmless: render draws only the mood mark on the stretch
  and the sip (`faceSteady` false), never the face. `spriteCore.ts` holds `PAL`, `SpriteMap`, `ANCHOR_HEAD`,
  `frameRules` and `faceRules` as a leaf module with no imports (sprites.ts re-exports them), so the pipeline checks a
  frame without loading the generated frames or the scene.
- **Generated frames in the scene** (0.11.0, task C2). Four retry sheets (Higgsfield `z_image`, 2026-10-01: a front
  mangaka sheet, a side mangaka sheet, the editor and the cat, all in `art/raw/sprites/`) went through the same gate
  (`sprites-C2.png`: each candidate next to the hand-drawn frame it would replace, 8x at the actor's own spot on the
  apartment shell, the three outfits or three assistant looks, the real render in the scene at 4x, and every mood's
  face and mark on the head-steady frames; `walk-C2.gif` and `walk-C2-strip.png` show the cycles in motion). **The
  one generated frame drawn is the assistants' doze** (`ASSISTANT_DOZE`, `sprite/assistant-doze`): the front sheet's
  dozing cell fitted to a 20x23 box on the frame's last rows, the head down on folded arms, eyes shut, eight cells
  touched (three stray specks, the right eye's shut line). It reads as asleep more clearly than the hand-drawn head
  on a block (113 fills before, 100 then; 91 since the 0.9.0 remap). Every other pose stays hand-drawn. The standing idle
  (`sprite/mangaka-front-idle`: the front sheet's body stretched to a 16x16 box on rows 16-31 under the grafted
  `ANCHOR_HEAD`, three neck cells touched, 167 and 166 fills against 195 and 192) was a near tie, and the controller
  ruled it off: drawn, it would switch bodies mid-cycle against the hand-drawn stretch and sip, breaking one look per
  pose set. The walk lost because the side sheet's four steps all keep the legs apart, with no pass frame and no bob,
  so in motion it slides, and the side facing contradicts the front-facing set. The seated pair is a front-facing
  floor pose whose red shoes sit beside the desk in sit 0 and vanish in sit 1, blinking every 8 frames, with no arm
  to the page. The stretch is a side-view one-arm reach. The sip has a clear mug, but like the stretch it turns the
  front idle to profile mid-cycle. On the editor, the glasses and hair snap into a mask on the idle, and the walk's
  three-quarter steps carry red specks and no shoes. The cat, at 12x8, is a 5-7 column blob in every cell, with no
  eye or ears. Every loser, the idle included, is retired.
- **Retired candidates** (0.11.0 final review). Every C1 probe-sheet frame and every C2 candidate except the doze
  carries `"retired": true` in `art/manifest.json`: its recipe (sheet, crop, keys, fit, remap, cells) and its raw
  sheet in `art/raw/sprites/` stay committed, its `src/ui/scene/generated/*.ts` module does not. `npm run art -- --all`
  skips a retired entry; to restore one, run `npm run art -- sprite/<name>` (it notes the entry is retired and writes
  the module anyway), then drop the flag and import the module. art.test checks a retired entry only for its raw
  sheet and a crop inside it (read from the IHDR), requires a module for every other sprite entry, and fails on any
  `generated/*.ts` without a non-retired entry, so `generated/` holds exactly `assistant-doze.ts`.
- **The cast redraw** (0.9.0, Release B). Every string-map frame but `ANCHOR_HEAD` is hand-redrawn by Claude in the
  same format, with the four Higgsfield sheets in `art/raw/sprites/` used as reference for proportions, colours and
  poses only. The mangaka's body is a `J` torso with `j` sleeves and hood shadow (so `OUTFIT_PALS` gives darker gold
  and navy sleeves), the `R` shirt as a V under the `K` collar, the `Y` column (a drawstring in the hoodie, a tie in
  the other outfits), `S/s` hands on 3-wide arms, `F/f` brown trousers and `O/o` shoes; `T/t` are no longer on the
  mangaka. The frames share pieces (`IDLE_BODY`, `WALK_PASS`, `SIT_LAP`, `EDITOR_BODY`, `EDITOR_PASS`), and each hand
  is one skin row closed by `L`, so `breathOf` still drops row 24 cleanly. The editor's suit `G/g` is recoloured to
  `#3a3d4c`/`#2c3656`, with two-lens `P` glasses (a one-cell bridge at col 10; since 0.10.1 the frame is a mid steel
  `#6b6b78`, at least 0.25 OKLab lightness from the eye `E` and the skin `S`, where `#3b3b45` read as a dark block), a
  `W` collar, an `N` tie, `E` shoes and the `F/f` briefcase in the right hand, which is two wide; its breath frame
  is hand-drawn so the case keeps its seven rows. Since 0.10.2 each walk's contact frames swing the arm opposite the
  stepping leg (their arm rows 20-23 swapped), the standing leg keeps the idle's shading on both, the editor's take
  `EDITOR_BODY`'s shoulders and the mangaka's legs through `recolour` (`F/f` to `G/g`, `O/o` to `E`) with the case
  drawn over them, and the stretch's raised fists are outlined (an `L` over each on row 11). The cat is a tabby (`c`
  stripes, the `Q` chest, an `E` eye, 1-px ears) with a tail on its walk. The doze stays the generated frame, its
  folded arms remapped `J` to `j` (sleeves) in the manifest, 100 runs to 91. The gate is `scripts/spriteSheet.ts`
  (`npm run sprites -- <out.png> [--walk]`): an 8x contact sheet (the cat at 16x) of each frame beside its HEAD frame,
  plus the cardigan, blazer and assistant looks and the four moods' faces and marks (new only), and the walk strips
  (`--walk` writes only those); a palette missing on either side, or a frame missing at HEAD, is an empty cell and a
  note on stdout. The run-count caps are `RUN_CAPS` in sprites.test.ts, 1.3x each frame's pre-redraw count, which
  keeps every fill baseline inside its 1.5x budget by construction. The ruling: **`ANCHOR_HEAD` is untouched**. The
  sheets' 2:1 head cannot fit the `FACES`, mark-slot and avatar-crop contract, and the hand-drawn head is the part
  that already read, so the staff portraits do not change.

The frame sets: idle 2 frames (`frame/16 % 2`), walk 4 (`anim/100 % 4`), sit 2 (`frame/8 % 2` while working, frame 0
otherwise), panic 2 (for 40 of every 240 frames while working on a late chapter, `Snapshot.late`), a 30x14 lying
sprite for the bed (under a blanket, only head and shoulders show), the assistants' doze, the editor's idle and walk,
the standing idle cycle's stretch and sip, and the 12x8 cat (sleep, sit, its groom and stretch, walk `anim/125 % 2`).
Props (envelope, letter, contract, trophy) are small maps of their own. `SpriteAvatar` draws the anchor frame's chibi
head (rows 0-15, cols 2-19, 18x16; the SVG viewBox matches) as SVG rects (`spriteSvg.ts`) for the staff portraits.

| Spot | Canvas (top left of the frame) |
|---|---|
| `MANGAKA_SEAT` | (132, 67) |
| `MANGAKA_STAND` | (170, 81) |
| `MANGAKA_BED` | (216, 106) |
| `DOOR_SPOT` | (254, 85) |
| `EDITOR_SPOT` | (198, 85) |
| `CAT_BED` | (196, 118), at the foot of the bed on the blanket's lower edge |
| `CAT_KITCHEN` | (44, 150) |
| `ASSISTANT_SEAT_X` / `_Y` | [66, 86, 106] / 89 |

Actors whose frame top is at canvas y 75 or below (standing, walking, at the door, in bed) are drawn in the front pass, after the desk; the seated mangaka (y 67) is drawn before it. The assistants sit on stools behind their own desk
(canvas x 62, width 8 + 20n for n assistants shown, at most 3, y 120-131), drawn after them so only head and shoulders
show; each seated assistant's page is drawn after the desk, on its top, with one ink line per third of progress.

The scene's fillRect budget is measured, not guessed: the one-assistant reference frame is a baseline of 673 calls
(`render.test.ts`), and the bare full scene (`BARE_FULL`: three assistants, looks 0-2 at stamina 80, in winter,
otherwise the reference scene, at night, t 0.9, frame 100) a baseline of 1079 (`studioArt.test.ts`; the full scene
with every piece of equipment, the loft, the editor, a contract and every story prop stays well inside that
ceiling); every render must stay under 1.5x its own baseline (1009.5 and 1618.5), so a new sprite or a new studio piece fails its test the moment it pushes the frame
past budget. Upgrade 0.4.0's chibi cast (Task 6) moved both baselines up from 649 and 1025: the redrawn `MANGAKA_SIT`
frames (used by both the mangaka and every seated assistant) cost 5 (frame 0) or 8 (frame 1) more fillRect runs each
than the old sit frames, purely from the wider chibi head and torso; nothing else in the redesign (the face overlay,
the marks, the idle cycles, the outfit palettes) adds a single fillRect to either reference scene, since both render
at a neutral mood with no overlay drawn. The final whole-branch review's fix made the sleepy mood reachable (working
late at night, not the old dead `resting && night` check): `BARE_FULL`'s mangaka is exactly that (seated, working,
t 0.9), so its baseline moved again, from 1048 to 1065 (+17: the sleepy face overlay and its mark, `studioArt.test.ts`
does the fillRect-by-fillRect count); the one-assistant reference frame stays daytime (t 0.3) and is unaffected.
Upgrade 0.5.0's scene redraw (Task 6) moved them from 659 and 1065 to 673 (+14) and 1079 (+14), item by item: the
wider daylight shaft +0/+0 (still four steps; off at night), the flat's and loft's wood beams +0/+0 (both scenes
are the apartment), the cherry past the pane +6/+0 (the reference scene is spring, `BARE_FULL` winter), the
corkboard's 2x3 grid -2/-2 (3 cards at half the pages in place of 4), the cat's cushion +4/+4 (its chest patch is not
in the curled sleep frame), the panic pose +0/+0 (nobody is late), the marks' new slot +0/+0 (same runs), and the
collar and tie +6/+12 (3 more runs per seated frame, two and four seated figures).
With every generated scene image ready (0.9.0 R2, `fakeSceneArt`), the same two scenes have their own baselines,
since the images leave fewer fills and 673's budget would hide growth: 546 (`render.test.ts`: 673 less what the
apartment's room and six props replace, the shell 61, the kitchenette 17, the window frame 1, the bookshelf 34, the
stock poster 4, the bed 5 and the plain door 5) and 953 (`studioArt.test.ts`: 1079 less the same 127, plus the room
image's night dim), each with a 1.5x budget (819 and 1429.5) that every tier, season and the full scene stay under.
The 0.10.0 props (P1) moved them to 521 and 928 (-25 each): the stock chair 4, the stock desk 7 and the apartment's
front row (the zabuton 4, the boxes 6, the bin 4) are sprites in both scenes (each contact shadow is still one fill,
moved across its sprite; the bin's crumpled pages stay code-drawn); budgets 781.5 and 1392.
The 0.11.0 generated frames (task C2) move none of the four: both reference scenes draw the mangaka and an assistant
seated at frame 100, never the doze (the one generated frame drawn), so 673/1079 and 521/928 stay as they are
(re-measured: the exact-count tests still pass). Where it does show, the doze costs 13 fewer fills than the hand-drawn
one (22 fewer since the 0.9.0 remap: 91 runs). The rest scene (`sceneSnapshot({ activity: 'rest' })`, the mangaka in bed, the cat sitting in the kitchen, the
assistant dozing under its Z) has its own pin, 509 at t 0.3 frame 100 (derived by hand from the 673 in render.test's
`REST_BASELINE_FILLS`), with a 1.5x budget (763.5) every season by day and night stays under. The doze's Z sits at
the frame's y - 2, just above the head on the arms (row 10), not y - 6 where an upright head's mark goes.
The 0.9.0 cast redraw (Release B) moved all five pins, each re-measured by hand in its test's docblock: task B3's
seated frame (`MANGAKA_SIT[0]` 184 to 194 runs, `[1]` 187 to 195) added 20 to the reference scene and its art twin
and 38 to `BARE_FULL` and its art twin, and took the rest scene from 509 to 500 (the doze's remap, 100 to 91 runs,
against the redrawn seat it replaces); task B5's tabby (`CAT_SLEEP` 31 to 39, `CAT_SIT` 34 to 40) added 8 to each of
the four and 6 to the rest scene. The pins were then 701 and 1125 (budgets 1051.5 and 1687.5), 549 and 974 with the art
ready (823.5 and 1461), and the rest scene 506 (759); the 0.10.0 walls (Release C) took the two art pins to 584 and
1009 (876 and 1513.5), the apartment's code floor (see "The walls").

### Art
The live scene is code-drawn `fillRect` (`render.ts`, `roomArt.ts`, `studioArt.ts`, `sprites.ts`), and since 0.9.0 it
may also draw generated images with `drawImage`: each tier's room wall (since 0.10.0 the wall alone, 320x114, the floor
always code-drawn; no furniture) and the structural props, as sprites at the footprints of the code-drawn pieces they replace (see "Scene images" below), and
since 0.10.0 the desk, the chairs, the equipment and each tier's front row the same way.
Every image has a code-drawn fallback, painted while it is missing or still loading, so a frame is never blank; the
characters stay string-map sprites. Elsewhere, generated raster art (upgrade 0.5.0) is static illustrations, shipped
as indexed PNGs, that never move or redraw per frame: they give fixed spots (the title screen, the panels) real
illustration, and double as reference art the hand-painted sprites get redrawn toward.

**Making an asset.** Each asset is generated once with a Hugging Face image Space running Z-Image-Turbo at a fixed
seed, and recorded as one entry in `art/manifest.json`: id, model, resolution, seed, steps, shift and the exact
prompt, plus how the pipeline should treat it (`native` size, `sample` mode, whether it needs a `cutout` or an
`outline`, an optional `colors` cap, and an optional `crop` or sheet `cell` for a multi-pose sheet; since 0.10.0 an
optional `flip`, which mirrors the crop before anything else, a cutout's flood `tolerance`, 24 when absent, and
`holes`, seed points in the crop for background walled off inside the object, cleared by the same flood). The raw generated
file is committed under `art/raw/<id>.webp` (or the sheet's own name) rather than treated as disposable, because the
Space's model or sampler can change and a generation is not reproducible from the manifest alone.

`npm run art -- <id> | --all` runs `scripts/pixelate.ts`, which is IO and orchestration only; the pixel math lives in
`src/ui/art/pixelOps.ts` (plain RGBA buffers, no `sharp` import, so it is unit-tested directly). For each entry it:
crops the manifest's `crop` rect or slices one cell out of a sprite sheet; mirrors it for a `flip` entry
(`flipHorizontal`); for a `cutout` entry, flood-fills
transparent from the edges (`floodTransparentFromEdges`, matching the corner colour within a tolerance, the entry's
`tolerance` or 24), finds the
alpha bounding box, and pads it out to the target aspect ratio before cropping to it (`padToAspect`) so the subject
isn't stretched; downsamples to the manifest's `native` size, either area-averaged (`sample: "area"`, alpha-weighted,
transparent when under half a block is opaque) or nearest-neighbour (`sample: "nearest"`, for an already-blocky sheet
crop), or, for a room shell with a `seam`, remaps it (`remapSeam`, below), or, for a room entry with `floor: "code"`, keeps
the raw rows above `seam.src` only (`wallOnly`), area-sampled to `native: [320, 114]`, since the scene draws the
tier's floor in code, then, where the entry sets `flatten: { radius }`, flattens the wall to its modal colour
(`flattenToMode`, "The walls" below); snaps every opaque pixel to the nearest
`ART_PALETTE` colour in OKLab space (`snapToPalette`); reduces to the entry's colour cap, keeping the most-used colours
and re-snapping the rest (`reduceColors`); despeckles single-pixel
colour flecks against a unanimous 4-neighbour field (`despeckle`); optionally adds a 1px outline on transparent
pixels 4-adjacent to an opaque one (`addOutline`); and writes an indexed PNG to `src/assets/art/<id>.png`, verifying
afterward that every pixel it wrote is a literal `ART_PALETTE` colour.

**The `--sprite` mode** (0.11.0). A manifest entry with `kind: "sprite"` is a character pose cell, not an
illustration: `npm run art -- sprite/<name>` turns it into a string-map frame in `PAL` keys and writes
`src/ui/scene/generated/<name>.ts` (a header says it is generated by `npm run art` and never edited by hand, then
`export const <name>: string[]`). The entry names its `sheet`, the pose's `crop` (from `--measure`), the `frame`
(`[24, 32]` for a person, `[30, 14]` lying down, `[12, 8]` the cat), `keys` (the PAL keys the snap may use, in priority order), `sample`,
the exported `name`, and optionally `anchors` (task C2: the sheet colour each key stands for, so the snap compares
the sheet's light grey hoodie against `J` and its navy hair against `H` while only listed keys come out;
`anchoredPalette` refuses an anchor for an unlisted key or a colour that is not `#rrggbb`), `fit` (a `[w, h]` box the
cutout is fitted to instead of the whole frame, then placed on the frame's last rows, centred, by `placeInFrame`: a
body cropped below the sheet's head fitted to rows 16-31 under the graft, or a pose drawn smaller), `stretch` (resample
to the `fit` box exactly, for a sheet body narrower than the anchor's), `flip` (mirror the crop first, for a sheet that
drew the pose facing right), `remap` (key swaps on a row range after the snap: the probe sheet draws the
trousers in exactly the hair's colour, so `H/h` below the head become `T/t`), `graft: "anchor-head"`, `cells`
(`[row, col, key]` touches set after the outline and the graft, such as a one-pixel eye the downsample loses, kept in
the manifest so regeneration reproduces them), `faceless` (walking, panic, lying: no faceRules report) and
`tolerance`. The pure steps live in `pixelOps.ts`: the cutout (`floodTransparentFromEdges`, `alphaBoundingBox`) is
padded to the frame's aspect bottom-aligned and centred (`padBottomCentred`, the feet on the last row), downsampled
(area or nearest; nearest keeps the probe crisper), snapped to the listed keys only (`snapToKeys`, OKLab, the first
listed key winning a duplicate hex such as `K`/`J`), remapped (`remapRows`), despeckled (`despeckleGrid`: a lone cell
takes its agreeing neighbours' key), outlined (`outlineToL`: every filled cell on the silhouette's edge becomes `L`),
closed (`closeOutline`: each row's first and last filled cell `L`), grafted (`graftRows`) and touched (`setCells`).
The pipeline throws on a frame that breaks `frameRules` and prints a `faceRules` report for a head-steady one;
`runCount` counts the fills a frame costs. The module's header discloses each step the recipe applied beyond the plain
snap: `fit`, `flip`, `graft`, and `cells: N touched in the manifest (art/manifest.json)` when the entry touches cells.
art.test checks each live sprite entry apart from the PNG entries (raw sheet committed with the crop inside it, frame
size, keys, `sample` area or nearest, `fit` within the frame, each `cells` key among `keys` and inside the frame,
`remap` from/to of equal length, and the generated module exports its name, records its graft and discloses its
cells); a `retired` entry only for its sheet and crop (see "Retired candidates" under "The sprites").

**The palette rule.** `ART_PALETTE` (`src/ui/art/palette.ts`) is a fixed, deduplicated list of lowercase hex colours,
and every one of them must already appear literally somewhere in `src/ui/scene/*.ts` or `src/styles/tokens.css`
(checked by `src/ui/__tests__/art.test.ts`) — a generated illustration can only use colours the hand-painted scene or
the design tokens already use, so it reads as part of the same world rather than importing its own palette.
Since 0.9.0 it is two lists: `ART_PALETTE_BASE`, frozen at its pre-0.9.0 73 colours (art.test checks its length and
a SHA-256 of the list), which every earlier asset was snapped to, and `ART_PALETTE_SCENE`, the base followed by the
scene's room colours. A manifest entry opts into the second with `"palette": "scene"` (the room walls and prop
sprites); without it `scripts/pixelate.ts` snaps to the base, so `npm run art` regenerates every earlier illustration
byte for byte instead of re-snapping it to a larger palette. `ART_PALETTE` is the union (the scene list), and
art.test checks each PNG's colours against its own entry's palette.

**Budgets** (also `art.test.ts`, run against the committed PNGs, not regenerated): every manifest id needs both a raw
source and a generated PNG, with no orphan PNGs left under `src/assets/art`; every PNG's IHDR size must match its
manifest `native` size, its colour type must be indexed (PNG colour type 3), and each PNG's PLTE entries must be in
its own manifest entry's palette (base or scene); and every PNG must fit its size cap (16 KB for `title/hero`, 12 KB for a `room/*` shell, 4 KB for any
other entry, 160 KB total across every generated asset; the room cap and the total were raised from 100 KB in 0.9.0).

**Mounting in the UI.** `src/ui/art/registry.ts` globs every generated PNG in eagerly (`import.meta.glob`, `eager:
true`) so each one becomes a real bundled asset URL, never inlined as base64, and exposes a typed `art(id, w, h)`
lookup that throws at module load — not render time — if an id has no generated PNG yet. A later task can add its
own typed records here (for example a `Record<GenreId, ArtRef>`) built on the same helper. `PixelArt.tsx` renders an
`ArtRef` as an `<img>` at an integer `scale`, undecorated (`loading="lazy"`, `decoding="async"`, not draggable) and
crisp in every browser; its `alt` defaults to `''` (decorative) except where the image carries real meaning, such as
the title hero.

**Scene images (0.9.0).** `render(ctx, s, t, frame, art = NO_ART)` takes a `SceneArt` (`src/ui/scene/sceneArt.ts`):
`room`, one image or null per tier, and `prop`, one per prop (`ScenePropId`: `window`, the window's frame;
`door`, the apartment's plain front door; `doorway`, the flat's and the loft's lit doorway; `kitchenette`;
`bookshelf`; `bed`; `poster`, the stock poster, shown while no serial or anime takes its place; and since 0.10.0 the
furniture, below). `ready(img)` is true
only for a loaded image (an `<img>` `complete` with a natural width; anything else with a width). A ready room image
(the tier's wall, 320x114 since 0.10.0) is drawn first at 0,0,320,114 in place of `TIER_WALL` (`roomArt.ts`), then,
at night, one `ROOM_NIGHT_DIM` fill (`rgba(20,24,60,0.25)`) over the same wall rows, since one image serves day and
night, then the tier's code-drawn floor (`TIER_FLOOR`); with no ready image `drawRoomShell` paints the whole
`TIER_ROOM`; the sky, the
season layer and every later piece paint over it as before, and the night overlay and lights stay on top.
`drawProp(ctx, art, id, x, y, w, h, fallback)` draws a ready prop image at its footprint, else runs the code-drawn
piece, at that piece's own place in the draw order; the pane's sky, the bars, the sill, the volumes and the
reference shelf, the serial's cover and the anime poster stay code-drawn over or instead of them. The footprints are
constants beside the pieces they replace, canvas space, collected in `render.ts`'s `PROP_FOOTPRINT`; a fallback keeps
painting inside its footprint.

**The placement rule (0.9.0 R2).** A prop sprite keeps its generated aspect ratio: its native size is the largest that
fits the footprint's height, its width following from the aspect of its manifest crop (`sceneArt.ts` `fitSprite`),
and it is placed bottom-aligned on the footprint's bottom row and centred across it, a half pixel of slack rounding
left (`placeSprite`). It may be wider than the old footprint only where that wall is free; where a full-height sprite
would hide something drawn before it, `PROP_MAX_W` caps its width and the height follows. The one conflict is the
bed and the doors: at full height the door would be 38 px and the doorway 46 px wide, over the bed's end (the doors are
drawn after the bed), so the bed stays inside its old 58 px (58x23) and both doors are capped at 33 px, the widest
that stays centred on the door frame and clear of the bed (x 192-249) and the coat rack (x 283). The sizes are
`PROP_SPRITE` (the manifest `native`, checked against `fitSprite` of each crop by art.test) and the boxes
`render.ts`'s `PROP_BOX`, which `drawProp` draws the image into:

| Prop | Footprint (fallback) | Sprite | Box (image) x, y, w, h |
|---|---|---|---|
| `window` | 180, 46, 48, 36 (`WINDOW_FOOTPRINT`) | 48x36 | 180, 46, 48, 36 |
| `door` | 258, 56, 17, 58 (`DOOR_FOOTPRINT`) | 33x50 (capped) | 250, 64, 33, 50 |
| `doorway` | 258, 56, 17, 58 (`DOORWAY_FOOTPRINT`) | 33x41 (capped) | 250, 73, 33, 41 |
| `kitchenette` | 2, 56, 60, 58 (`KITCHENETTE_FOOTPRINT`) | 58x58 | 3, 56, 58, 58 |
| `bookshelf` | 72, 54, 34, 58 (`BOOKSHELF_FOOTPRINT`) | 50x58 | 64, 54, 50, 58 |
| `bed` | 192, 102, 58, 26 (`BED_FOOTPRINT`) | 58x23 (capped) | 192, 105, 58, 23 |
| `poster` | 116, 50, 22, 28 (`POSTER_FOOTPRINT`) | 22x28 | 116, 50, 22, 28 |

The bookshelf's wider box reaches under the reference shelf (x 95-114 as a sprite, 107-114 drawn), which is drawn
after it and stays in front.

**The furniture (0.10.0 P1).** Fourteen more props follow the same rule, each at its own call site in today's draw
order: the stock `desk` and `chair`; the equipment, each only when owned and in the stock piece's place (studioArt.ts
`EQUIPMENT_SPRITE`: the `coffee-machine` on the sill, the `arm-lamp`, the `reference-shelf` in front of the
bookshelf, the `tall-chair` in the chair's place, the `drafting-table` in the desk's; the pen tablet stays
code-drawn); and each tier's front row (roomArt.ts `TIER_FRONT`, after the actors, so the cat passes behind it: the
apartment's `zabuton` and `boxes`, the flat's `fern` and `books`, the loft's `floor-lamp` and `sofa`, every tier's
`bin`). The chairs draw before the seated mangaka (he sits in front of the backrest), the desk after him and before
the pages, the lamp after the desk. The small pieces stay code-drawn (the ink pot, the pen and the mug, the pen
tablet, the trophies, the pages, the bin's crumpled pages, the stock desk lamp), and so does the assistants' desk: it
is a bench whose width grows with the staff (28 to 68 px, 12 high), which one fixed-aspect sprite cannot fill. A working assistant's page and its ink lines go on after the active desk sprite whenever its box overlaps the sprite's box and the image is ready (the drafting table's left leg covers seat 3's page); otherwise they stay before it.

The desks are the one exception to the rule. At the footprint's height (20 px) a desk sprite, drawn with its top in
perspective, would be 35 px wide (the drafting table 45) under a 58 px desk top, and the pages (from x 121), the ink
pot and the lamp's clamp (to x 169) would hang off it. So a desk (`DESK_PROPS`) spans its footprint's width
(`fitDesk`) and hangs from its top row (`hangSprite`): the tabletop's back edge stays at y 98, where the pages, the
ink pot and the pen sit (the drafting table's footprint starts at its lightbox, y 95, three sprite rows above its top),
and the legs reach down to y 130 on the floor. The sofa (41 px at full height) is capped at 37 (`PROP_MAX_W`), clear
of the bin (x 232), which follows it in the loft's front row.

Small props get a minimum readable size (fix round 1, a controller ruling): drawn in perspective at their flat
footprint's height, the zabuton (14x7), the book stack (10x9) and the coffee machine (6x8) were specks, so
`PROP_MIN_H` raises each to about twice that height, its width from its aspect, still bottom-aligned and centred on
its floor or sill line, where the space is free: the zabuton 24x12 (its old width), the book stack 20x18 (clear of the
bin), the coffee machine 11x14 on the sill (right edge x 191, clear of the trophies from x 194; top y 67, below the
pane's cross bar at 63-64 and left of its middle bar at 203). The reference shelf, a squat bookcase (31x38 at its
slot's full height), goes the other way: capped at 20 wide (`PROP_MAX_W`, so 24 tall) and flush with its slot's right
edge (`PROP_ALIGN` 'right', `placeSprite`'s `align`), it stands in front of the bookshelf's right side (x 95-114,
y 70-93), clear of the poster (x 116, drawn after it) and above the desk top (y 98).

| Prop | Footprint (fallback) | Sprite | Box (image) x, y, w, h |
|---|---|---|---|
| `desk` | 116, 98, 58, 20 (`DESK_FOOTPRINT`) | 58x33 (width-fit) | 116, 98, 58, 33 |
| `drafting-table` | 108, 95, 68, 23 (`DRAFTING_TABLE_FOOTPRINT`) | 68x35 (width-fit) | 108, 95, 68, 35 |
| `chair` | 134, 78, 20, 30 (`STOCK_CHAIR_FOOTPRINT`) | 19x30 | 134, 78, 19, 30 |
| `tall-chair` | 132, 74, 24, 34 (`TALL_CHAIR_FOOTPRINT`) | 24x34 | 132, 74, 24, 34 |
| `arm-lamp` | 156, 78, 14, 20 (`ARM_LAMP_FOOTPRINT`) | 14x20 (mirrored) | 156, 78, 14, 20 |
| `reference-shelf` | 107, 56, 8, 38 (`REFERENCE_SHELF_FOOTPRINT`) | 20x24 (capped, flush right) | 95, 70, 20, 24 |
| `coffee-machine` | 182, 73, 9, 8 (`COFFEE_MACHINE_FOOTPRINT`) | 11x14 (minimum height) | 181, 67, 11, 14 |
| `zabuton` | 87, 161, 24, 7 (`FRONT_FOOTPRINT`) | 24x12 (minimum height) | 87, 156, 24, 12 |
| `boxes` | 148, 148, 22, 22 | 22x22 | 148, 148, 22, 22 |
| `fern` | 71, 144, 16, 27 | 30x27 | 64, 144, 30, 27 |
| `books` | 152, 158, 18, 9 | 20x18 (minimum height) | 151, 149, 20, 18 |
| `floor-lamp` | 64, 142, 12, 34 | 18x34 | 61, 142, 18, 34 |
| `sofa` | 196, 150, 36, 26 | 37x23 (capped) | 195, 153, 37, 23 |
| `bin` | 233, 154, 11, 12 | 13x12 | 232, 154, 13, 12 |

Once a sprite is ready, the pieces keyed to it follow (same fill counts): the desk's contact shadow lies under its
sprite's feet (116, 131, 58; the drafting table's 108, 130, 68) instead of the drawn desk's (116, 118, 58); each
front-row piece's shadow spans its sprite's columns under its bottom row; the stamina cups (`drawCups`, told by
render whether the standing desk's sprite is ready) move from y 120-123, which is the sprite's modesty panel, down to
y 126-129 (`CUPS_UNDER_DESK_Y`), on the open floor between its legs (the stock desk's knee hole is clear from y 124, the
drafting table's from y 118); and the owned arm lamp's lit bulb sits in the
sprite's shade opening (157, 83, 5x1, against the drawn lamp's 158, 83, 4x1), its glow below unchanged, since the
mirrored sprite's shade lands where the drawn one is. The sprites are 16-colour outlined cutouts from three
Higgsfield sheets (2026-10-01, prompts verbatim in the manifest): `props/desk-set.png` (job dd602d7c: the desk, the
drafting table, the tall chair, the arm lamp and the reference shelf; its wooden chair is merged with a second lamp
and unused), `props/floor-set.png` (job 497767e8: the zabuton, the boxes, the fern, the three-book stack, the floor
lamp, the left sofa and the bin; its coffee machine sits on a sofa and is unused) and `props/chair-coffee.png` (job
81612505: the wooden chair and the coffee machine). Crops are each object's `--measure` box plus a 2 px margin. The
arm lamp is mirrored (`flip`) so its shade leans left over the page, as the drawn one does; the wooden chair's flood
`tolerance` is 40, since the sheet drew a soft grey floor shadow between its legs that 24 leaves behind, and its
backrest's opening, walled off from the edges, is cleared by a `holes` seed (193, 254 in the crop), so the wall shows
through it whenever the mangaka is off the chair. Every non-desk box goes through `spriteBox` (its `PROP_SPRITE`
size, placed as `PROP_ALIGN` says).
Once the door's or the doorway's image is ready, two code-drawn pieces follow it (`drawEntrance`, `drawStudioLights`,
told by render whether it is ready; same fill counts): the doormat spans the sprite (x 250-282, its dark inner strip
2 px in), and the doorway's night halo and spill light the noren sprite's opening (halo 255,87,23,27 taking in the
noren's hem, spill 256,92,21,22) instead of the old frame (258,66,17,48 and 260,71,13,43, kept for the fallback).
`studioArt.ts` holds `DOOR_BOX`/`DOORWAY_BOX`, which `PROP_BOX` reuses.
The window sprite is a frame only: the pane's sky, the bars and the sill paint over its middle. The door sprite is the
apartment's, the noren doorway the flat's and the loft's; the poster sprite is an empty frame in the stock poster's
place. The prop sprites are 16-colour outlined cutouts (the bookshelf 24, so its book spines keep their colours) cropped from one Higgsfield sheet (`props/structural.png`, job
ea96bb2b; the window-over-bed object split into the window's top half and the bed's bottom half).

**The room shells (0.9.0 R2)** are three Higgsfield generations (`rooms/<tier>.png`), 320x180, `cutout: false`,
32 colours, the scene palette, area-sampled (the cleaner of the two: nearest sampling at a 6x reduction keeps the
generations' fine noise as speckle, where area averaging leaves flat, cel-like areas and straight edges). Their
wall/floor seams landed at 76-87% of the height, not the scene's 63%, and a crop that fixes that discards most of the
image, so the pipeline remaps them: a manifest `seam: { src, dst: 114 }` (src, the first floor row of the raw image
after its crop, measured from row brightness) resamples the wall rows into canvas rows 0-113 and the floor rows into
114-179, each side on its own, piecewise-linear vertically and area-averaged (`pixelOps.ts` `remapSeam`), so no row
mixes wall and floor and the seam lands exactly on row 114. The apartment (the 0.9.0 crops and seams; see "The walls") is cropped to x 196-1813 (its angled side
walls trimmed to the two pillars; seam 882), the flat to x 230-2047 (its dark left corner; seam 1008), the loft uncropped
(seam 1002, the floor below the steel baseboard). The generations are softly lit (a light pool, dark corners), and a
plain OKLab snap turns those mid-tones grey (the flat's dusty teal fell to the palette's greys, the apartment's
plaster ringed in blue-grey), so a manifest `lightness` weight (0-1, absent is 1, the plain distance) scales the
lightness term of the snap and the colour cap's re-snap (`nearestPaletteIndex`): below 1 a pixel keeps its hue and
chroma at the cost of its lightness, and the lighting flattens to a few steps. Apartment 0.1, flat 0.03, loft 0.25 (superseded by "The walls" below: no room entry remaps a floor since 0.10.0,
and the flat's lightness is 0.15);
every earlier entry has none, so it regenerates byte for byte. At night the `ROOM_NIGHT_DIM` fill and the night
overlay leave the flat a slate teal and the loft a warm grey-pink, both still reading as their rooms (superseded for
the flat: since 0.10.1 its wall is code-drawn in its own night colours, with no `ROOM_NIGHT_DIM`; see "The flat's wall
in code" below).

**The walls (0.10.0, Release C).** Ruling: generated walls only, code-drawn floors. The R2 shells' perspective floors
sat badly under the flat front row, so a room image is now the wall alone, canvas rows 0-113 (`ROOM_ART`, 320x114),
and the floor is `roomArt.ts`'s `TIER_FLOOR`, which always paints: the rug and the tatami edges return. Each room
entry sets `floor: "code"`, `native: [320, 114]` and `seam.dst` 114 (`scripts/pixelate.ts` refuses a
`floor: "code"` entry without a seam or whose native height is not `seam.dst`), and `wallOnly` keeps the raw rows
above `seam.src`, area-sampled. The three walls were regenerated on the Hugging Face Space
(`hf-space:mcp-tools/Z-Image-Turbo`, `2048x1152 ( 16:9 )`, 8 steps, shift 3, no preamble, prompts verbatim in the
manifest): each asks for a straight-on back wall meeting the floor at 80 percent of the height ("the floor may be cut
off") under "perfectly flat even lighting, no vignette, no gradient, no light pool, no shadows, uniform wall colour"
(the flat's ends "uniform colours"), and the flat's wallpaper is "bold two-tone vertical stripes, a saturated teal
stripe alternating with a pale grey-teal stripe". All three come from the Space (the first generations and one loft
reroll; the apartment's two rerolls failed the flat-wall bar and a Higgsfield try failed, so the apartment keeps its
first generation and `flatten` is its fix). Each `seam.src` is the first floor row of the raw after its y crop,
read from row means over x 400-1647 (raw rows 1034, 1106 and 1016); each crop trims the angled side walls and corner
faces (and, on the loft, puts the brick column at the scene's x 230-253, where the code wall draws it):

| Room | Seed | `crop` [x, y, w, h] | `seam.src` | `lightness` | `flatten.radius` |
|---|---|---|---|---|---|
| apartment | 423969 | [130, 107, 1843, 1045] | 927 | 0.1 | 0.25 |
| flat (removed in 0.10.1, see below) | 243842 | [53, 0, 1995, 1152] | 1106 | 0.15 | none |
| loft | 142516 | [15, 109, 1670, 1043] | 907 | 0.25 | 0.2 |

The prompts asked for flat light and the apartment's still came back a vignette (a light pool the snap banded into two
creams), so a manifest `flatten: { radius }` (`pixelOps.ts` `flattenToMode`, run after `wallOnly` and before the
palette snap) turns every fully opaque pixel within that OKLab radius of the image's modal colour (`modalColour`, the
most frequent exact RGB among the fully opaque pixels) into that colour, while the wood, far from the mode, keeps its shading. It is allowed only on a `floor: "code"`
entry, radius in (0, 1] (`art.test.ts`), and it needs the plaster to be the wall's most frequent exact colour: on the
flat it would merge the two stripe tones, so the flat sets none. `npm run art` prints the mode and its share for
each flattened wall (`room/apartment: flatten mode #..., N% of the wall`), so a regeneration where the wood or a stripe
wins the count shows at the console. The apartment's 0.25 is the smallest radius that
clears the vignette's corners with the beam and pillars whole (the baseboard's lit row joins the plaster); the loft's
0.2 removes the shadow band under its beam, the bricks, beam and baseboard unchanged. A 0.10.2 retry kept the
apartment's recipe: no crop and radius keep both the plaster one colour and the baseboard's lit row (output row 111,
the raw's rows 1010-1017, about a third of them plaster). Before the flatten that row lies 0.124 to 0.24 OKLab from
the mode (`#dac69d`, median 0.16), inside the plaster's own spread: only the grey top corners lie beyond 0.2 (none
between x 60 and 259), but 3766 plaster pixels lie beyond 0.124, the band under the beam (rows 10-25 across the
middle) and both sides down to the baseboard. So a crop that drops the corners allows 0.2, which still turns the lit
row's middle to plaster, and a radius that keeps the row whole (under 0.124) leaves the band, which no crop can drop
without the beam. Measured: at 0.2 the lit row keeps 95 of 320 pixels (at the ends) and the art.test box holds 3
colours (grey and wood wedges in the corners); cropping x to 230-1872 (no edge posts) gets the box to 2 but leaves the
lit row 244 of 320 plaster; at 0.12 the lit row is whole and the box holds 6 colours. The plaster's colours, counted
in plaster-only boxes: before (the R2 walls cut to 320x114) the apartment 3 (`#c9b48a`, `#b88d62`, `#9c7550`), the
flat 3 (`#6f9a90`, `#8fb5ac`, `#66666f`), the loft 8; after, the apartment 1 (`#e6d3a8`), the loft 1 (`#f5f1c9`),
the flat its two stripe tones `#6f9a90` and `#cbc7bf` (each teal stripe with a 1 px `#8fb5ac` edge). The walls are
779, 1218 and 954 bytes (15, 26 and 20 colours). The flat's stripe teal `#6f9a90` is in `SCENE_ADDITIONS` (and is the
code wall's day stripe), and `#9dc2b9` left it: no committed PNG held it.

**The flat's wall in code (0.10.1).** Ruling (2026-10-09): the flat has no generated wall; the apartment and the loft
keep theirs. The 0.10.0 flat had one stripe twice as wide as the rest and its honey wainscot snapped to the code
floor's own `#c8894e` and `#a86d3a`, and in five generations on the Space Z-Image gave even stripes only under a light pool
(the snap then spreads the pale stripe over 9 to 13 greys at any `lightness`) or flat light only with uneven stripes.
So the `room/flat` manifest entry, its PNG and its raw are gone (git keeps them), `ROOM_ART` lists the apartment and
the loft only (a `Partial` record: a tier may have no wall image; since 0.10.2 a full record again, every tier, the
flat `null`, so a new tier fails `tsc` until its wall is decided), `sceneImages` leaves `room.flat` null, and `render`
paints `drawRoomShell` for the flat, wall and floor, with their own night colours and no `ROOM_NIGHT_DIM`.
`roomArt.ts` `flatWall` is redrawn as the generation was asked for: sixteen 10 px teal stripes (`#6f9a90`, night
`#425c60` since 0.10.2, was `#465f5a`) every 20 px on a pale ground (`#cbc7bf`, night `#77757e`, the loft's night
sheen), even from x 0 to 319, over a walnut wainscot that shares no colour with the floor (panels `#8a5f3a`, night
`#5a4432`; the rail `#5a3d28`, night `#3d2d23`; the grooves, frame and baseboard `#6e4a2c`, night `#4a3626`), the
panels' OKLab lightness at most 0.85 of the planks' by day and by night (`roomArt.test.ts`). Each night colour is
dimmer and a little bluer than its day one: a lower OKLab lightness and a blue share (b over r + g + b) at least 0.01
higher, which a plain dim (every channel scaled alike, the share moved by rounding only) fails; the old night stripe
was one (+0.001), `#425c60` is +0.026 (the ground +0.026, the woods +0.036 to +0.041), and the night stripe stays at
least 0.1 OKLab from the night ground (0.117; by day 0.19) (`roomArt.test.ts`, 0.10.2). Still 38 fills, the flat's
room 83 (cap 84); no baseline moved (the reference scenes are the apartment). The palette: `#8fb5ac`, the old pale
teal ground, left `SCENE_ADDITIONS` (only the flat's PNG held it; regenerating `prop/books` changes one pixel,
`#a9a59c` to `#bdb8ae`, committed in 0.10.2 with the bookshelf's five; the kitchenette's 423 wait, see "2026-10-09,
the remaining minors" under "Rulings"); `#b98a5c` and `#a0764c`, the old honey panels and grooves, stay (prop PNGs
hold them), drawn now as the corkboard's cork (was `#b88a55`, OKLab 0.009 away) and the drafting table's body (was
`#a0703c`, 0.02 away). `art.test.ts` decodes the two image walls (8-bit indexed only, `node:zlib` and the five PNG
filters, no sharp) and holds each plaster at most 2 colours in boxes read off the PNGs: the apartment x 8-311, rows
14-107; the loft x 4-224 and 258-315 (either side of the brick column), rows 16-102 (1 colour each today). Both walls
use filter 0 only, so since 0.10.2 the decoder also meets all five on a synthetic 6x5 image built in the test (one
scanline per filter, its filtered bytes worked by hand, the Paeth row taking each neighbour and the left/upper-left
and above/upper-left ties), and refuses bytes without the PNG signature.

With a tier's wall image ready, `render` draws it at (0, 0, 320, 114) (`WALL_H`), at night the `ROOM_NIGHT_DIM` fill
over the same rows, then `TIER_FLOOR`; `TIER_WALL` paints only while the image is missing or loading (`drawRoomShell`,
`TIER_ROOM` being the wall then the floor: the apartment 61 fills, 26 + 35, the flat 83, 38 + 45, the loft 70). Images
paint no fills, so the code floor is new to the art baselines: `render.test.ts` ART_BASELINE_FILLS 549 to 584 and
`studioArt.test.ts` FULL_ART_BASELINE 974 to 1009 (budgets 876 and 1513.5), +35 each, the apartment's floor by hand
(the tatami 1, its weave lines 21, the heri 3, the seams 5 + 5); 701, 1125 and 506 are unchanged.

`sceneImages.ts` builds one `HTMLImageElement` per ref in the registry's `ROOM_ART` and `SCENE_PROP_ART` records
(`SCENE_PROP_ART` a ref per prop; `ROOM_ART` a ref or `null` per tier, a `Partial` record in 0.10.1 and a full one
again since 0.10.2; a null ref, or an image still loading, keeps its piece code-drawn), once, behind a module-level
memo; `StudioScene` passes the result to `render`, and each image's load clears the loop's last-painted snapshot so
the next step repaints it.
`render.ts` never imports the registry. In tests, `fakeCanvas.ts` records each `drawImage` in `images` (with `at`, the
fill log's length at the call, for order checks) and `fakeImage(id, w, h)` makes an image `ready` accepts; the fill
`log` stays fillRect-only, so the 701/1125 baselines measure what is still code-drawn (with `NO_ART` they are
unchanged), and `fakeSceneArt()` readies every image at once for the art baselines (584/1009 since the 0.10.0 walls). `ART_PALETTE_SCENE` (for `"palette": "scene"` entries) holds the room shells' day colours (the plasters, the tatami, the planks, the concrete, the
woods, the brick, the rugs and the flat's teal stripe), so a generated wall snaps to the drawn room's colours.

**The title hero** (`TitleScreen.tsx`) renders `TITLE_ART` (manifest id `title/hero`, native 320x180) directly rather
than through `PixelArt`, with a real `alt` describing the scene, filling the `.title-screen.has-hero` background.
`app.css`'s `.title-screen.has-hero::before` lays a scrim over it so the card text stays legible: a left-to-right
gradient from `--title-scrim` to `--title-scrim-clear` on wide layouts (the card sits over the scrim, the art shows
through past it), and a flat `--title-scrim` fill below the breakpoint where the card stacks below the art instead.
`.has-hero` only applies when the hero image is present, so a title screen without one keeps its plain background.

**Sheets (batch 1, 0.8.0).** Sets of like things are generated together, one generation per group, so a set shares
one style: `art/raw/sheets/<group>.webp` holds seven sheets (people, genres, themes-a, themes-b, magazines, equipment,
awards) on a flat light grey background. Each entry names its sheet (`sheet: { src: "sheets/<group>" }`, no grid) and
an explicit `crop: [x, y, w, h]` in sheet pixels, and repeats its sheet's model, seed, resolution and prompt. The crops
were measured once with `npm run art -- --measure sheets/<group> [mergeGap] [minArea]`, which prints the bounding boxes
of `pixelOps.ts`'s `findBlobs` (non-background 4-connected blobs, background being the corner colour within the flood
tolerance, blobs within `mergeGap` px merged so a detached sparkle stays with its object, specks under `minArea`
dropped); the committed numbers are then hand-checked (the people sheet's busts touch at the shoulders, so their crops
are 300 px squares from the head boxes; the awards sheet is measured inside its white divider lines), so regeneration
never depends on the heuristic. Icons and portraits are 32x32 cutouts with an outline, magazine covers 36x48
rectangles (a 3:4 window centred on each cover), 16 colours each; an outline takes one of those 16 slots and a cutout's
PNG gets one more palette entry for transparency (never drawn, so `art.test.ts` ignores fully transparent entries).

| Records (`registry.ts`) | Ids | Mounted in |
|---|---|---|
| `GENRE_ART` | `genre/<GenreId>` | the new-manga wizard's genre cards, 2x |
| `THEME_ART` | `theme/<ThemeId>` | the wizard's theme cards, 2x |
| `MAGAZINE_ART` | `magazine/<MagazineId>` | Submit's cover strip 2x, the Offer hero 2x, the Series header 1x |
| `EDITOR_ART` (by magazine) | `editor/<MagazineId>` | beside the editor's words in Offer and Results, 2x |
| `RIVAL_ART` | `rival/rival` | Results' rival line 1x, the year review and Career, 2x |
| `EQUIPMENT_ART_ICON` | `equipment/<EquipmentId>` | Studio's equipment rows, 2x (1x at 640 px and below) |
| `AWARD_ART` | `award/<AwardId>` | the year review 2x, its desk card and Career 1x |
| `BADGE_ART`, `BADGE_LOCKED` | `badge/<BadgeId>`, `badge/locked` | the badge gallery's tiles 1x (every not-yet-earned badge, secret or not, shows the keyhole) |
| `MERCH_ART`, `MERCH_LICENCE_ART` | `merch/<MerchItemId>`, `merch/licence` | the Goods section's rows and its header, 1x |
| `PLACE_ART` (64x40) | `place/<PlaceId>` | Trips' postcards and the status card's trip card (the signing included), 1x |
| `EVENT_ART` (96x54) | `event/<EventId>` | the event desk card's header, 2x (1x at 640 px and below) |
| `ANIME_ART` | `anime/<AnimeStudioId>` | the anime offer card's studio columns, 1x (32x32: the round emblems read better square than at 48x32) |
| `TIER_ART_THUMB` (96x54) | `tier/<StudioTierId>` | Studio's tier rows, 1x |
| `ROOM_ART` (320x114) | `room/apartment`, `room/loft` | the live scene's tier's wall, drawn by `render` over canvas rows 0-113 (0.9.0; a wall only since 0.10.0; the flat has none since 0.10.1, its wall code-drawn, and is `null` in the record since 0.10.2; see "The walls") |
| `SCENE_PROP_ART` (`PROP_SPRITE`) | `prop/<ScenePropId>` | the live scene's props, at `PROP_BOX` (the structural ones 0.9.0, the furniture and front row 0.10.0) |

**Sheets (batch 2, 0.8.0), a second host.** The remaining 51 assets came from twelve sheets generated on
Higgsfield with its `z_image` model (the same Z-Image family), `art/raw/sheets/<group>.png` (prompts verbatim in the manifest), because the Hugging Face
Space's quota ran out. Higgsfield exposes no seed, so these entries carry `source: "higgsfield:z_image"`, `seed: null`
and the Higgsfield `job` id instead (batch 1 and the hero carry `source: "hf-space:mcp-tools/Z-Image-Turbo"` and their
seed); the job id is the only handle back to the generation, which is one more reason the raw sheet is committed. A
sheet `src` with an extension is read as given, otherwise `.webp`. The model did not always follow the grid, so cells
were picked by eye and measured with `--measure`. Icons, merch, badges and the anime emblems are 32x32 cutouts; places
(64x40), events and studio tiers (96x54) are scene crops (`cutout: false`) taken inside each panel's drawn dark border
(so it does not double with `.art-frame`) inside each scene's own drawn content, so no sheet grey survives at the
edges; scenes the model drew on grey (letter, cold, raise, reprint, interview, the signing) are cropped tight around
the subject instead, and the rival challenge's window is set off-centre to keep both facing figures' faces. Slice of life's teacup completes
`GENRE_ART`. Cutouts sit in `.art-frame` (a `--paper-2` tile with a border) so they keep
their contrast in dark mode; covers carry their own border.

Generated art is excluded from Vite's asset inlining (`vite.config.ts`'s `assetsInlineLimit`, false for any path
under `/assets/art/`), so `PixelArt.tsx`'s `<img src>` is always a real, cacheable URL rather than a base64 data URI;
on desktop it loads under the CSP's `img-src 'self'` (`src-tauri/tauri.conf.json`), which only a same-origin bundled
URL satisfies.

## Systems beyond the slice (implemented)

### Serialisation
- A one-shot that ranks top 3 or scores 65+ earns a serialisation offer from that magazine (one serial at a time).
- Chapters are 16 pages. A finished chapter goes to the weekly poll automatically and the next chapter starts at once.
  Chapter results never block play: they arrive as toasts and in the Series panel.
- **Popularity** (0-100) is a moving average of poll placement, minus 10 for each missed issue. Three warnings in a
  row (a weak chapter, roughly the bottom quarter with rank > ceil(0.7 x entrants), or a missed issue) cancel the
  series and cost 10% of fans; the log says "after 3 warnings in a row" whichever mix it was. Every 4 chapters a **volume** ships;
  copies = round((circulation x 20 + 40 x sqrt(fans)) x popularity / 100), times an anime deal's multiplier while its
  boost lasts (see Anime adaptations), at ¥2 a copy (`VOLUME_PRICE`). Fans count through their square root, so a big
  following keeps selling more without running away with the economy: at Kids Comic Go! (circulation 120) and
  popularity 80, 2,500 fans sell (2,400 + 2,000) x 0.8 = 3,520 copies and 10,000 fans (2,400 + 4,000) x 0.8 = 5,120.
  `volumeCopies` in engine.ts is the one place the curve lives.
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
- The balance bots hire help when the chapter on the desk is late, a desk is free in their studio, and the bank holds
  two weeks of the candidate's salary on top of two weeks of current costs; they pick the most pages per day per yen of
  salary. With the apartment's one desk taken, the sensible bot moves to the studio flat first, but only when the bank
  still covers that hire after the move-in (two weeks of the flat's costs, rent included).
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
  tier's move-in; the panel asks to confirm a move ("Yes, move in for ¥55,000" or "Stay here"), and the next tier's line
  says "You cannot move back down." Equipment is a single click. The tier's rent is part of the weekly costs (living + rent + salaries), and the weekly log line names
  it when it is not zero ("Weekly costs: -¥550 (living ¥400, rent ¥150)."). `hireAssistant` refuses once every desk is
  taken, on top of the rule that the bank must hold two weeks of that salary.

| Tier | Desks | Rent/week | Move-in (base) | Move-in at scale 11 |
|---|---|---|---|---|
| Apartment | 1 | ¥0 | ¥0 | ¥0 |
| Studio flat | 2 | ¥150 | ¥5,000 | ¥55,000 |
| Studio loft | 3 | ¥350 | ¥15,000 (from the flat) | ¥165,000 (from the flat) |

- **Equipment** is bought once and kept. A piece cannot be bought twice, without the money, or (the pen tablet) below
  the studio flat. Effects sum over everything owned; page multipliers multiply (drafting table and tablet: x1.265).
  Art and story bonuses go on the player's own samples of every working day (clamped to 100), never the assistants'.
  The page multiplier is part of `basePagesPerDay`, so the desk's pace, the ETA and the chapter deadline all include it.

| Equipment | Base price | Price at scale 11 | Effect |
|---|---|---|---|
| Coffee machine | ¥2,000 | ¥22,000 | Resting restores 3 more stamina a day (the rest branch, not trips) |
| Daylight lamp | ¥2,500 | ¥27,500 | Art +3 on your pages |
| Reference shelf | ¥3,000 | ¥33,000 | Story +3 on your pages |
| Ergonomic chair | ¥4,000 | ¥44,000 | Drawing costs 1 less stamina a day (min 2); adds to an Inspiring assistant's 1 |
| Drafting table | ¥7,000 | ¥77,000 | 10% more pages a day |
| Pen tablet | ¥12,000, needs the flat | ¥132,000 | 15% more pages a day, art +2 |

- **Prices** go through `equipmentPrice(id)` and `moveInCost(tier)`: the base price times `EQUIPMENT_PRICE_SCALE`,
  rounded to the nearest ¥100. The panel and the tests read the helpers, never the base prices. The scale is
  S1 / 9000 rounded to 0.25 and held within 0.75-16 (`priceScale` in balance.ts), where S1 is the sensible balance
  bot's median money at day 336 with its shopping switched off (seeds 1-20; `npm run balance` prints it). S1 is
  ¥100,099, so S1 / 9000 = 11.12 and the scale is 11; balance.test checks the constant is the scale S1 gives, so
  a change that moves the economy says when the prices need re-deriving. The Full studio milestone (three assistants)
  needs the loft: ¥220,000 in move-ins at this scale (¥55,000 for the flat, ¥165,000 for the loft), then ¥350 a week
  in rent and three salaries.
- **Saves** from before studios start in a studio with a desk for every assistant they have (3: loft, 2: flat,
  otherwise the apartment) and no equipment.
- `studioLook(s)` is what the studio scene draws (see The studio in the scene): the tier, its desks, the owned list
  itself (the same array, so it can be compared by reference), the volumes shipped across every serial, at most 24, and
  `animePoster`, true from an anime's premiere until its volume boost ends (the same window as the volume multiplier).

### Part-time job
- A third daily activity: earns money, costs a little stamina, draws nothing. The money lifeline.
  Same stamina rules as drawing: pay is halved when low, nothing at zero, and hitting zero forces rest.

### Trips and training
- Library / Reader survey reveal Notebook cells. Classes add +2 to a stat. Hot spring restores and raises max stamina.
- The player is away for the trip's length; nothing is drawn.
- The Manga Museum (3 days, ¥700) reveals one genre x theme pairing for a genre you have never drawn (one-shots,
  serials and the desk's project), with no RNG: the first such genre in `GENRES` order that still has an unknown
  theme, with its first unknown theme in `THEMES` order; once every undrawn genre is known, the first unknown pairing
  of any genre (`revealUndrawnGenre` in `editors.ts`).
- Every trip's max-stamina gain is capped at 150 (`MAX_STAMINA_CAP`; the Trips panel says so for each trip that
  raises it). The Hot Spring (3 days, ¥400) restores stamina and adds 3 max stamina, never above 150. The Mountain
  Retreat (5 days, ¥1,500) restores stamina and adds 5 max stamina, never above 150. A max stamina already at or
  above 150 stays where it is.
- Three trips are reached only by answering a random event, and the Trips panel does not list them: the Comic
  Convention (2 days, ¥500, fans on return), the Manga Masterclass (3 days, ¥400, +3 to the lowest stat) and the
  Book Signing (1 day, free, + round(average copies a volume x 0.2) x ¥2 on return, for the serial a reprint would be
  for).
- The balance bots never take a listed trip; they go on event trips only by answering an event 'a'.

### Editors
- Each magazine has an editor. Every result raises the relationship; every `tipEvery` points the editor shares a tip
  that reveals a theme x audience pairing for that magazine's readers (`bumpEditor` in `editors.ts`; a random pick,
  one draw from the main seed; a tip earned by answering a random event takes the first unknown pairing instead and
  draws nothing, so events never move the main seed).
- Each editor has a visible persona (`persona`, `personaLine` in `MAGAZINES`), printed on the Submit and Offer
  magazine cards and under the Results editor comment:
  - Mori (Kids Comic Go!), cheerleader: no mechanical change, a tip every 3 points.
  - Tanaka (Weekly Bolt), deadline hawk: a tip every 3 points, and a log line (no toast) on the day a Weekly Bolt
    chapter's deadline turns from on track to tight or late for the same chapter (`deadlineHawk` in `tick()`).
  - Sato (Monthly Petal), mentor: a tip every 2 points.
  - Kuroda (Ultra Seinen), critic: a tip every 4 points, and his one-shot results comment ends "That cost you N
    points.", N = round(weight x (100 - component) / 100) for the component that cost the most (`pointsLost`).

### Random events
One decision at a time, shown as a card on the desk and never as a popup (pillar 3). The card names both answers with
every effect they have, and says how many days are left to answer. `src/sim/events.ts`.
- **The roll.** On days where day % 7 is 3, from `nextEventDay` on (day 28 in a new career), with no event waiting and
  no trip under way, two values are drawn from `eventSeed`: the first under 0.35 lands an event, the second picks it
  from the eligible pool, in the table's order. `eventSeed` is its own stream (`hashString('events:' + worldSeed)`),
  so an event landing or not never moves the main `seed`. A landed event expires 7 days later and the next roll waits
  14 days. It toasts and pauses the clock once, the day it lands.
- **Ignoring one.** The day after it expires, the event lapses: a log line, nothing else. An event whose subject is
  gone (a raise asked by an assistant who has since left) has no card to show, so it lapses the same way on the day
  `eventTick` finds it gone, and never holds up the next roll unseen.
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
| Interview | fans ≥ 2,000 and a magazine (the running serial's, else the latest one-shot's) | On camera: stamina −6, fans + clamp(round(fans × 0.01), 30, 800) | Written reply: that magazine's editor relationship +1 |
| Signing | a serial, running or archived, with a volume | Sign: 1-day trip, free; on return + round(average copies a volume × 0.2) × VOLUME_PRICE | Skip it |
| Editor dinner | an editor at relationship ≥ 3 (the highest; ties in magazine order) | Go: −¥300, that editor +1 | Decline |
| Cover | the running serial has ≥ 4 results | Draw the cover: stamina −15, popularity +3 (at most 100) | Decline |
| Assistant sick | an assistant (picked by a hash of the roll's day and event seed) | Paid rest: − round(salary / 2), their stamina full | Keep them working: their max stamina −5, never below 40 |
| Rival challenge | the running serial is in the rival's magazine, no challenge on | Accept: the next chapter result settles it (`settleChallenge`): above the rival, fans + min(1,500, round(fans × 0.03)); below, popularity −3; a tie or a poll without the rival, nothing | Decline |

Stamina changes clamp to 0..max stamina. Each assistant asks for a raise once, whatever the answer. A reprint is for
the running serial when it has shipped a volume, else the latest archived one that has. No event changes story, art or
pacing. The six events from Interview down were appended to `EVENT_IDS` (0.7.0), so the first six keep their pool
order. `GameState.rivalChallenge` (`{ serialId, fromResult }` or null) holds an accepted challenge; a series that ends
before its next result calls it off. Each card states its numbers before the choice; `EVENT_ART` (a Partial record)
holds card art once generated, and the card falls back to its icon.

### Anime adaptations
A hit serial is offered one adaptation, shown as a card on the desk and never as a popup (pillar 3). The card lists
both studios' terms, with "Sign with Studio Kumo", "Sign with Hoshi Animation" and "Not now", and says how many days
are left to answer. `src/sim/anime.ts`; no RNG.
- **The offer.** Checked every day (`animeTick`): a running serial with popularity 70 or more and 37,000 or more
  copies sold across its volumes, never offered one before (`animeOfferedFor`), with no offer waiting and no earlier
  deal short of its tail's end (`day <= tailEndsDay`: signed and waiting to air, on air, or in its volume boost). One
  adaptation at a time. It toasts, pauses the clock once, and stands for 14 days
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
  lines. Log lines and the Series panel speak of volume sales only while the series runs (an ended series ships no
  more volumes): for a running series the premiere toast adds "Volumes sell 1.3x from today." and the finale toast
  "Volumes sell 1.3x for 12 more weeks."; for an ended one both leave it out and the end of the boost is not logged.
- **Volumes.** `animeVolumeMult(s, serialId)` is the deal's multiplier from the premiere
  (`airsDay <= day <= tailEndsDay`), else 1; the scene's anime poster (`studioLook`'s `animePoster`) uses the same
  window. A deal signed but not yet on air boosts nothing. Regular volumes sell round(copies x multiplier) and the
  wrap-up volume round(copies x 1.5 x multiplier); the volume log says "(1.3x with the anime)". The Series panel shows
  the deal: "Signed with Studio Kumo, airs in 6 weeks; volumes sell 1.3x from the premiere.", then "On air, week 3 of
  12: +400 fans and ¥500 a week; volumes sell 1.3x.", then the boost left after the finale (for an ended series,
  without the volume clauses). The card's terms say "Volumes sell 1.3x from the premiere until 12 weeks after the
  finale."

| Studio | Fee | Airs after | Runs | Per week | Volume mult | Popularity at premiere |
|---|---|---|---|---|---|---|
| Studio Kumo | ¥2,000, paid at signing | 6 weeks | 12 weeks | +400 fans, +¥500 | 1.3x, from the premiere until 12 weeks after the finale | +5 |
| Hoshi Animation | ¥0 | 16 weeks | 24 weeks | +900 fans, +¥1,000 | 1.6x, from the premiere until 24 weeks after the finale | +12 |

Signed on day 100, Kumo airs on day 142, ends on day 226 and boosts volumes from day 142 to day 310 (12 payouts:
+4,800 fans and +¥6,000, plus the ¥2,000 fee); Hoshi airs on day 212, ends on day 380 and boosts volumes from day 212
to day 548 (24 payouts: +21,600 fans and +¥24,000). The sensible balance bot signs every offer the day it lands:
Hoshi Animation while the serial has fewer than 12 results, Studio Kumo after that. The careless bot and the stress
case let it lapse.

### Merchandise

A year-two money stream (`merch.ts`, no RNG, money only: never fans, popularity or copies).

- **The licence.** On the first day with `day > 336` on which any serial (running or archived) has shipped a volume,
  a goods maker's licence arrives: a toast ("A goods maker wants to license your series."), no pause, nothing to
  answer. Year one never sees merch, so S1 and `EQUIPMENT_PRICE_SCALE` cannot move.
- **Items** (`MERCH_ITEMS`, plain yen, not scaled by `EQUIPMENT_PRICE_SCALE`): keychains ¥6,300 for 4 weeks (share
  0.02, ¥20 a unit), posters ¥14,000 for 6 (0.015, ¥40), plushies ¥25,000 for 8 (0.01, ¥80), the art book ¥24,000
  for 6 (0.02, ¥50; needs 4 volumes on the serial), figures ¥64,000 for 8 (0.008, ¥250; needs a signed anime deal).
- **Ordering** (`orderMerch`, from the Series panel's Goods section): the cost is paid at once (a money toast). Refused,
  with the reason shown under the row (`merchRefusal`), without the licence, for a serial with no volume out, with an
  item gate unmet, with the same item already selling for that serial, with 2 runs selling (`MERCH_MAX_RUNS`), or
  without the money.
- **Weekly pay** (`merchTick`, at the end of each week from the order day): round(average copies per volume x share x
  demand / 100) units x margin x `animeVolumeMult`, where demand is the serial's popularity while it runs and half its
  final popularity once it has ended. A daily-chatter log line each week; on the last week the run sells out with a
  toast ("Keychains sold out: +¥8,560 over 4 weeks.") and stays in `merch.runs` as history; `merch.earned` is the
  Career panel's "Goods sold" total.
- **Forecast** (`merchForecast`): a week at today's demand times the run's weeks, and the net after the cost, shown
  as "About ¥X back over N weeks if popularity holds (net +¥Y)". Tuned on a year-one-median serial (6,700 copies a
  volume, the sensible bot's median over seeds 1-20): at popularity 80 every item returns 1.34x-1.38x its cost; at 50
  every item is a net loss (`merch.test.ts` shows the table).
- **Bots.** The sensible bot, once licensed, orders the cheapest item it may order for its running serial when the bank
  holds its cost plus four weeks of costs, and skips it when `merchForecast(...).net` is zero or less (the shops path
  only, so S1's no-buying run is untouched). The careless bot
  and the stress case never order.

### Year end and awards
Every `DAYS_PER_YEAR` (336) days the year closes: `closeYear` (`src/sim/year.ts`) runs when `day % 336 === 0` and
`day > 0`, after `checkDeadline` and before `animeTick`. No RNG.
- **This year.** `yearStart` is the baseline `{day, money, fans, level, copies, volumes}` (copies and volumes are
  totals across the running serial and every past one). The year's poll results are those with a day in
  (`yearStart.day`, closing day]: the polls run before `closeYear` in the same tick, so a result landing on the
  closing day counts for the year that closes (year one counts days 1 to 336, year two days 337 to 672). A serial
  counts as started this year from `yearStart.day` on: commands run between ticks, so one accepted on a closing day
  starts the new year. For the Rookie Prize, a serialisation offer still waiting at the year-one close (earned by a
  year-one one-shot, perhaps on the closing day itself) counts as a serial started; accepting it later pays nothing
  more. A new career takes its baseline on day 0.
- **Awards.** `buildYearReview` judges each award in the table's order. A near miss is listed only when the award was
  not won. The Readers' Choice takes the serial with the best average rank among those with 8 or more results this
  year; a near miss shows that average rounded up to one decimal, so a miss never reads as the 3.0 that wins.

| Award | Rule | Near miss | Prize |
|---|---|---|---|
| Rookie Prize (year 1 only) | a serial started, or a #1 one-shot | best one-shot #3 or better | ¥3,000, 500 fans, 100 XP |
| Readers' Choice | a serial with ≥ 8 results this year, average rank ≤ 3.0 | average ≤ 4.5 | ¥5,000, 2,000 fans, 150 XP |
| Critics' Prize | best score this year ≥ 75 (one-shots and chapters) | ≥ 68 | ¥4,000, 1,000 fans, 150 XP |
| Golden Pen | copies sold this year ≥ 37,000 | ≥ 22,000 | ¥8,000, 3,000 fans, 200 XP |

On screen each award's rule is worded from its bar (`awardRule` in ui/labels.ts: "a poll score of 75 or more",
"37,000 copies sold in the year"), so the copy follows the data.

- **The close.** The year is judged once. Its prizes are paid (money, fans, and XP through `grantXp`; a log line
  each), and that same judgment is filed as the review (`yearReviews`, `reviewUnread` = its year) with the prizes
  counted in its money, fans and level; then the rival grows and the new `yearStart` is taken, so next year's deltas
  start clean. When the player missed year one's Rookie Prize,
  the rival won it (`rivalAward`). The review holds the year's one-shots, best one-shot, chapters, volumes, copies,
  best score, money and fans gained, the level before and after, the awards, the near misses, and the rival's year
  (this year's head to head, craft and magazine before and after). A fresh career left alone for year one pays 48
  weeks of living costs (days 7 to 336): −¥19,200, no awards, and the rival takes the Rookie Prize and moves up to
  Monthly Petal at craft 61.
- **On screen.** One toast: "Year 1 is over. You won the Rookie Prize. Your year in review is on the desk." (or "No
  awards this year"). The year end never pauses the clock. The review waits on the desk as a card ("Year 1 in review:
  2 awards, 1 near miss.", "Read the year review") until the review modal is opened, which marks it read. The modal
  shows the year in numbers, the awards with their prizes and what wins them (or, with none, what to aim for next
  year), the near misses ("Golden Pen: 24,800 copies of 37,000."), and the rival's year. Career lists every award won
  and a line for each past year. `studioLook`'s `trophies` is the awards list itself (one trophy per entry, the
  same reference every call), for the scene.
- **Saves** from before the year end start their year on its first day (`floor(day / 336) × 336`) with the current
  money, fans, level, copies and volumes, so the first review's deltas count from loading; no reviews, no awards.

### Sound
Web Audio, synthesised: no audio files, no framework dependency (`src/audio/`). `cues.ts` holds every cue's recipe
(every voice on the C major pentatonic scale, every cue over within a second, the drumroll within 2.4 s); `engine.ts`
builds the mixer and the one `AudioContext` and plays them. A cue plays for most changes a player would notice:
submitting a manuscript, a chapter result (plain, weak, or top of the poll), a level-up or milestone, a warning or
cancellation, hiring, a trip's start or end, a random event or anime offer landing, an award, and the result
reveal's own beats (see The results reveal). `triggers.ts` decides the cues purely from two game states, never the
log's wording, at most two per change, so a busy tick is not noisy; a cancellation plays alone, since the warnings
that land with it would only repeat the bad news.

`Modal` (`src/ui/components.tsx`) plays its own three: `open` and `close` on mount and on the native `<dialog>`'s
close, and `tab` when its title-bar tab strip changes tab — all through `getSound()`, and all skipped in a
read-only tab. The scene plays two more: `knock` when the editor's walk lands them at their spot, and `pop`
(pitched per kind) when money, fans or xp rise from the mangaka (see The studio in the scene). Every open modal
holds the music bus at `MODAL_DUCK` (60%) for as long as it is open, through `instance.ts`'s `holdDuck`: a small
stack of duck levels, one per hold, the deepest wins, and the bus returns to full only once the last hold releases.
The results reveal takes its own, deeper hold at 30% for as long as it is mounted, stacked under the modal's own
60% hold, so the Results modal ducks to 30% while the reveal runs and only back to full when the modal closes (both
holds release together).

A light music loop (`music.ts`) plays under play: two parts (lead and bass), scheduled a look-ahead's worth of
notes at a time from the audio clock's own time, fading in over 2 s when it starts and out over 0.4 s when it
stops. The context is created lazily and only from a real user gesture — a browser refuses to start audio before
one. Until the first gesture the loop is only wished for and every cue is silently skipped; `bridge.ts` listens for
that gesture (a mouse's pointerdown, touch or pen's pointerup, or any keydown, matching the platform's own
user-activation rules) and unlocks the context, then stops listening once it is running.

Settings has Sound and Music rows: a mute button, one volume slider (its gain the slider's square, so equal steps
sound like equal loudness steps), and a Music on/off toggle independent of mute. Other systems can duck the music
bus to a fraction of its level and back (the results reveal ducks to 30% for as long as its modal is open). Hiding
or minimising the window suspends the `AudioContext`: nothing plays while it is frozen, and a fade already under
way finishes at once rather than waiting for a clock that will never move again; showing the window resumes it,
silently (a 'pause' cue would only sound on return, so none plays for the hide or the show). A read-only tab
(mirroring another tab's save) and the update that loads a save make no sound at all, matching the store's
`windowHidden` and `saveLoads` guards.

### The results reveal
The Results modal is wide and two columns (`.results-grid`, stacking to one column below 700px): the hero (rank
stamp, headline, rival line) on the left, the score breakdown and reward tiles on the right. The stamp itself is a
square badge, not a circle. The modal does not mount at all until the editor has walked in with the result
(`EDITOR_WALK_MS` after it lands, 0 under reduced motion; see `useArrival` under The studio in the scene), so the
reveal never starts while the editor is still mid-walk.

A poll result never simply appears: `ResultsModal.tsx` plays it out in beats, timed by a pure plan (`reveal.ts`'s
`revealPlan`) that a real-time clock (`useReveal.ts`) drives frame by frame. In order: a drumroll leads into five
bars growing to their component scores (art, story, pacing, audience fit, freshness), each pitched by its own
value; the overall score counts up; the rank stamp lands; its jingle plays (`TIER_JINGLE`: a fanfare for first
place, a rising jingle for the podium, a level jingle mid-table, a falling one for a weak result); then the reward
tiles (payment, fans, XP) slide in one by one. Everything after the stamp — the exact rank and score, the rival's
placement, the payout breakdown, the serial-offer line — stays in the layout but hidden until the stamp lands, so
nothing spoils the countdown early.

A pointer-down anywhere in the modal's body, or any key, skips straight to the end; reduced motion collapses the
whole plan to instant (every beat at time 0). A gap of more than 250 ms between two animation frames
(`MAX_FRAME_GAP`), including between mount and the first frame, means the window was hidden while the reveal ran:
it skips too, rather than firing every missed beat in a burst once the tab is visible again. A skip, reduced
motion, and a frame gap all still play the stamp and its jingle, just with nothing before them. The music ducks to
30% for as long as the modal is open and returns to full when it closes; a drumroll still rolling is stopped the
moment the stamp lands or the modal closes, whichever comes first.

### The desktop app and save files
The same build also runs as a Windows desktop app (Tauri 2, `src-tauri/`): one window around the unchanged web
build, with a native shell wired only on desktop (`src/platform/desktop.ts`). A second launch brings the running
window forward instead of opening another (the single-instance plugin); the window remembers its size, position,
and whether it was maximised between runs, and on a first launch with nothing saved, a window that would not fit
its monitor shrinks to at most 90% of the work area on each axis and opens centred in the work area with its title
bar on screen (`src-tauri/src/fit.rs`). F11 toggles full screen. Minimising the window pauses the clock and
suspends the sound, the same as hiding a browser tab; closing writes the save at once, leaving full screen first so
the size remembered is the windowed one. In every production build (`npm run tauri build`, its `--debug` variant
included), the browser engine's own shortcuts (reload, print, going back) are cancelled everywhere, text fields
included, and its right-click menu everywhere except text fields; only `npm run tauri dev` keeps both, for
development.

**Where a career lives.** There are three careers, one per slot, each in `localStorage` under its own key,
`rising-mangaka-save-1`, `-2` and `-3` (the game, the tutorial step and the run speed, the same payload and
`SAVE_VERSION` as before). The index `rising-mangaka-slots` holds only `{ active: 1 | 2 | 3 | null }`, the open
career; the device's preferences (the theme and the sound: muted, volume, music) live apart in
`rising-mangaka-prefs`, shared by every career. The title screen lists the three slots: a filled one shows the pen
name, the date, money, fans and the running serial (`slotSummary`, read from the slot's JSON, never stored twice) and
offers Continue, Export save file, Load a save file into this slot (asking first before it replaces a career) and
Delete this career (behind a confirmation); an empty one takes a pen name and starts a career there. Settings' "Back
to the title screen" writes the career and leaves it in its slot. A write still waiting on the save's debounce keeps
the key it was queued for, so it lands in its own slot even when the player switches slots straight after.

**The single save of 0.5.0.** Before the store loads, `slots.ts` `migrateLegacy` copies the old key
`rising-mangaka-save` into slot 1 when the slots were never set up (no index) and slot 1 is empty: it writes slot 1,
reads it back and compares byte for byte, copies the old theme and sound to the prefs key if that key is absent, and
only then sets `active: 1`. Any failed write or check puts every key back as it was and this run reads (and saves to)
the old key exactly as 0.5.0 did, slot 1 standing for it; the copy is tried again at the next start. A filled slot 1
is never overwritten, and nothing ever deletes the old key. Only the tab that owns the save (or the desktop app)
migrates; another tab only looks. The index records the copy's fingerprint (`migratedFrom`): if a fallback run kept
playing the old key after another start copied it, and slot 1 is still exactly that copy, the next start refreshes slot
1 from the old key (verified). With no index, a filled slot 1 is an unverified copy and is not trusted: the old key is
read. If a fallback run's crash screen starts over, it writes `{ active: null }`, which also stops the old save being
copied at later starts (the old key stays on disk). A new game with all three slots full is refused with a toast, and a
save that cannot be written toasts too. In the desktop
app that same storage lives inside the app's own WebView2 profile, under the identifier
`com.xyjor.risingmangaka` in `%LOCALAPPDATA%`; the remembered window state is a small file under the same
identifier in `%APPDATA%`. Only one tab or window plays at a time: a tab lock (`tabLock.ts`, browser only — the
desktop app has a single window and disables it) lets one tab own the save and run the clock while any other
mirrors it read-only and stays silent, with a heartbeat so a tab that closed or crashed without saying so goes
stale and another can take over. The lock covers the whole app: a read-only tab follows the owner's open slot (the
index) and that slot's career, and every slot action is off in it.

**Save files.** A career can be written out as a `.json` file (`saveFile.ts`) and read back on any computer:
Settings' Save file section (the open career) and each slot on the title screen offer Export save file and Load a
save file; a file loaded into a slot that is not open is checked the same way and written to that slot's key. The file names itself after the pen name and the in-game date (year only after the first), carries a format
marker and the save version, and a load is strict: text that is not valid JSON, does not carry that marker, comes
from an older or newer save version, runs over 5,000,000 characters, or holds a game the sim cannot even advance by
a day is refused, each refusal saying what to do next rather than only that it failed. If the game ever crashes, a
recovery screen offers to export whatever is in the open slot before starting over (which empties that slot, never
the old single save) — or, in a tab that has lost the save
to another, only a reload, since starting over is not that tab's to do.

### Auto-pause rules
The clock stops whenever the game needs a decision: a manuscript becomes ready, poll results arrive, a
serialisation offer lands, a serial is cancelled (the desk empties), a trip ends, a random event lands, or an anime
offer lands. Menus always pause. The year end is not a decision: it toasts and leaves a desk card, and the clock keeps
running.

### Tutorial
A new career is walked through its first one-shot by the editor, one step at a time (`src/state/tutorial.ts`, `STEPS`;
the guide overlay is `src/ui/TutorialGuide.tsx`, below). Each step points at one control (its anchor) and is finished by one
trigger: the player doing the thing, or the guide's Next button (`next`). The store's `tutorialStep` is the index of
the current step, saved per career, -1 once it is done or skipped; a new game starts at 0.

| # | Step | Anchor | Finished by | Phase |
| - | ---- | ------ | ----------- | ----- |
| 0 | plan | the Plan a new manga button | opening the wizard | idle |
| 1 | wizard | the wizard's steps | starting the project | idle |
| 2 | today | the Activity control | Next | drawing |
| 3 | stamina | the stamina badge | Next | drawing |
| 4 | clock | the speed controls | running the clock | drawing |
| 5 | pitch | the Pitch button | opening the pitch window | ready |
| 6 | forecast | the magazine forecasts | submitting | ready |
| 7 | why | the results breakdown | dismissing the result | submitted |
| 8 | notebook | the rail's Notebook | Next | any |
| 9 | stats | the rail's Stats | Next | any |
| 10 | rail | the rail | Next | any |
| 11 | goal | the next goal on the desk | Next (ends the tutorial) | any |

Closing the wizard at step 1 steps back to 0, and closing the pitch window at step 6 steps back to 5 (`stepAfter`).
Every step holds: entering one stops the clock and shows the desk, as `tick`'s auto-pause does (`pauseForDecision`),
overriding the resume of the command that finished the step before (starting a project leaves the clock stopped on
step 2). A step entered before its anchor can exist never pauses: running the clock opens step 5 (the manuscript's
own auto-pause stops the clock when it is ready) and submitting opens step 7 (the submission's resume stands, and the
result's own auto-pause stops the clock when it lands). Nothing locks the speed controls. In a tab that does not own
the save the tutorial never moves. With the tutorial done every command behaves as before.

The tutorial reads the game's phase through `phaseOf`: a poll result waiting to be read counts as submitted (the
sim's `getPhase` already says idle). The tutorial follows the game: when a tick changes that phase mid-tutorial, the
step resumes against the new game with no pause of its own (a manuscript finished at step 2, 3 or 4 lands on step 5,
paused by the tick's decision pause; the result landing at step 7 keeps 7).

A saved step resumes against its game (`resumeTutorialStep`, on a reload, a slot opened and a save file loaded): step
0 only on a fresh career (day 0, no history, nothing on the desk, no serial), so an old save's leftover 0 ends the
tutorial; another step stays when its phase is the game's or any, except that the wizard and the pitch window are not
saved, so step 1 resumes at 0 and step 6 at 5; step 5 on a game still drawing (the clock has run, the manuscript is
not ready: a reload, a slot switch or a save file loaded in those ~17 days) resumes at 4, the clock step; otherwise it
moves to the first later step written for the game's own phase (an `any` step never counts), else ends. The goal step
(11) ends the tutorial whenever no milestone is left, since the desk then has no next goal to point at
(`settleStep`, on resume, on entering it, and on a tick). A missing or broken value reads as -1. Settings' Help
section replays the tutorial (`replayTutorial`) with the window closed, and offers "Skip the tutorial" beside Replay
while a step is open (both hidden in a read-only tab). A replay never pauses on a step whose control cannot exist yet
(`replayStepFor`, `canPoint`): it starts at the first step for the game's phase, except that a game waiting for its
poll starts at the Notebook step (8), since the breakdown needs the result; it stops the clock only when the step's
control can show, so on a trip (the status card shows the trip, not the Plan, Activity or Pitch control) it lands on
the phase's first step with the clock as it was, and the step waits for the trip's end, which pauses anyway. It is
refused with a result or an offer waiting. A tutorial replayed on a played career's empty desk starts at step 0,
which only a fresh career keeps on resume, so it ends if the game is reloaded before the wizard opens. The 0.7.0 getting-started coach note above the status card is gone; the tutorial replaces it.

**The guide** (`TutorialGuide.tsx`, `tutorial.css`, mounted after the toasts while a step is open, a game is loaded
and the tab owns the save). Each step's control carries `data-tutorial="<anchor>"` (the Plan button, both of them, the
wizard's steps, the Activity control, the stamina badge, the speed controls, the Pitch button, the magazine list, the
score breakdown, the rail's Notebook and Stats, the rail, the next goal); the guide finds it, and re-finds it once a
frame at most after a store update, a resize, a scroll, a node added or removed, a dialog or the desk changing, or an
animation ending. Over the studio a fixed layer (`--z-guide`) cuts a hole at the control: a 3px gold ring with hard
corners whose spread shadow is the dim (`--scrim`). The layer takes no clicks, so the studio, the hotkeys and the rail
stay usable; nothing is locked. When the control is inside an open dialog (steps 1, 6, 7) the guide is portalled into
that dialog after its body (so the window's autofocus never lands on it) and draws only the ring, since the backdrop
already dims. The editor's bubble (pixel frame, "Editor", the step's line) sits above the control, below it when there
is no room, beside it when neither fits (beside first on the desktop's vertical rail, so it never covers the next
buttons; `tutorialPlace.ts`), kept 12px inside the viewport or the dialog, with a tail toward the control; it carries "Skip the
tutorial" always and "Next" (or "Done" on the last step) on the steps Next finishes, each described by the line
(`aria-describedby`). Enter in the bubble is Next; an info step hands focus to Next on entry, and again when its
control shows after a window closed if focus fell to the page; an action step leaves focus alone; there is no global
Escape. Screen readers hear every step, action steps too, through a visually hidden live region in the guide's layer
(so inside the dialog when the step is, the page behind being inert) that mounts empty and receives the line one effect
later; the bubble itself is not live, since a region mounted with its text is not announced.

*The waiting rule:* a step whose control is not on screen shows nothing and waits: the control is not rendered
(the pitch step before the manuscript is ready), it sits in the tucked-away desk, or it is on the page behind another
window the player opened. The guide never pops anything up to make its control appear.

*Phones* (640 px and below): on entering a step the control scrolls into view, the bubble docks as a bottom sheet
(12px from the sides and the bottom; in a dialog, just above its footer, which holds the step's own button), and the
toasts, bottom-docked on phones, move up by the sheet's height (`.app[data-guide]`, `--tutorial-sheet`).

*The editor's visit:* `tutorial` is the lowest `VisitorReason` (`sceneReasonOf`): while a step is open and nothing else
brings the editor, they walk in at step 0 (a new career's scene mounts with them outside the door, `editorWalksIn`;
a replay walks them in too) and knock on arrival, empty-handed, stand there through the tutorial (a reload on a later
step finds them already standing), and walk out when it ends or is skipped. Any real reason (results, offer, a ready manuscript, a card) takes
the visit as before, and the results and offer still mount off the real reasons only. The scene's greeting bubble
hides while the guide is on screen (the presentation clock's `guideVisible`): the guide's bubble speaks for the
editor. A step that waits for its control leaves a real visitor's greeting alone, and an editor already standing
there for the tutorial who gets a real reason (a letter, a ready manuscript) says its greeting without walking again.

## Roadmap
0. Money sinks. Shipped: hiring needs two weeks of that salary in the bank; a week that ends below zero makes
   assistants quit and charges an overdraft fee (5% of the debt, at least ¥50), and a week that ends with less
   than one week of costs warns first; studio tiers gate assistant desks with rent, equipment has stated effects and
   prices scaled to what a career earns (see Studio and equipment); volume sales flatten with fans (the square-root
   curve, see Serialisation); the smaller HUD on phones shipped separately.
1. Awards and success. Shipped: year-end awards with a year review (see Year end and awards), anime adaptation offers
   (see Anime adaptations), conventions (an event-only trip, see Random events) and merchandise from year two (see
   Merchandise).
2. Rival mangaka. Shipped: one named rival per world with a visible career (a magazine and series, craft growing at
   every year end) and head-to-head results in every poll they share (see Named rival).
3. Random events with choices. Shipped: six events as desk cards (see Random events).
4. Sound, mobile polish and a desktop app. Shipped in 0.1.0: synthesised sound effects and a music loop (see Sound),
   the animated poll-result reveal (see The results reveal), the responsive phone layout, and a Windows desktop app
   with save export and import (see The desktop app and save files). Save slots and achievements beyond the existing
   milestones ladder are not built.

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

### Badges
A gallery of 15 fun, often hidden achievements beside the milestone ladder (`src/sim/badges.ts`). Badges grant no
XP and no money, consume no RNG and change no rule, so balance cannot move. Each rule reads the state before the tick
(`prev`) and after it (`s`); `awardBadges(prev, s)` is the last step of `tick()` and logs `Badge: <title>.` as a toast
(the milestone cue plays). A badge earned through a command lands on the next tick. `upgradeSave` grants quietly (no
log, no toast, the save's current day) every badge the loaded state already earns; the two one-day happenings
(all-nighter, ramen-budget) cannot be seen after the fact and are only earned in play. Hidden badges show "???" and a
category hint in the gallery until earned.

| Id | Title | Hidden | Rule |
|----|-------|--------|------|
| all-nighter | Pull an all-nighter | yes | prev activity work, not recovering; now recovering (a collapse at the desk) |
| cancelled | Cancelled | yes | a serial with status cancelled |
| stop-presses | Stop the presses | yes | a serial with missedIssues > 0 |
| ramen-budget | Ramen budget | yes | a new day that ends a week (day % 7 == 0) with money < 0 |
| first-place | Top of the poll | no | any poll placement rank 1 |
| golden-pen | The Golden Pen | no | the Golden Pen in `awards` |
| grand-slam | Grand slam | yes | all four awards in `awards` |
| rival-10 | Old rivals | no | `rivalRecord(s).wins >= 10` |
| perfect-pair | Perfect pairing | no | a Notebook genre-theme rating of 4 |
| anime-signed | On the screen | no | one anime deal |
| anime-declined | Not for sale | yes | a series in `animeOfferedFor` with no deal and no offer waiting (declined, lapsed or withdrawn) |
| the-loft | Moving up | no | studio tier loft |
| fully-equipped | Fully equipped | no | every piece of equipment owned |
| century | Century | no | chapters sent across all serials >= 100 |
| millionaire | Millionaire | no | money >= 1,000,000 |

The cross-save profile (`src/state/profile.ts`, localStorage `rising-mangaka-profile`,
`{ badges: { id, day, slot, penName }[] }`) keeps the first time each badge was ever earned in any career on the
device. The store merges it after a tick or command that grew `game.badges`, only in the tab that owns the save; a
failure is swallowed, and an unreadable key reads as empty and is replaced. The Badges panel (rail button, G) shows
this career's badges with their date, badges from an earlier career dimmed, and the rest.

## Tick order
The final hook order inside `tick()`:

1. Day + 1.
2. Trip, part-time job, or the work-or-rest branch (pages, stamina, assistants; equipment effects apply here).
3. Weekly costs (living cost, studio rent and salaries, with the overdraft rules).
4. Candidate refresh.
5. One-shot poll result and serialisation offer.
6. `resolveChapters` (chapter polls, volumes, warnings, cancellation, archiving).
7. `checkDeadline` (a serial chapter not in by its due day misses the issue; warnings and cancellation).
7a. `settleChallenge` (an accepted rival challenge settles on its serial's next result, or is called off).
7b. `deadlineHawk` (Tanaka's log line the day a Weekly Bolt deadline turns tight).
8. `closeYear` (on day % 336 == 0, day > 0: awards and prizes, the year review, the rival's growth, the new year's
   baseline).
9. `animeTick` (a waiting anime offer whose series stopped running is withdrawn, one past its last day lapses; each
   deal's premiere, weekly pay, finale and end of boost; a new offer to a running hit).
10. `merchTick` (the goods maker's licence; each run's weekly pay and its sell-out).
11. `eventTick` (an unanswered event past its last day, or one whose subject is gone, lapses; the weekly random-event
    roll).
12. `awardMilestones`.
13. `awardBadges(prev, s)` (no XP, no money, no RNG).
14. Return.

`closeYear` runs before `animeTick`, `eventTick` and `awardMilestones`, so they see the prizes and the grown rival
the same day; a milestone that lands on the closing day counts toward the new year.

## Balance bots and bands

`src/sim/bot.ts` holds three deterministic player policies that drive the real sim: `botStep` makes one day's
decisions through the same commands the store calls, then ticks. The game never plays itself, so `index.ts` does not
export them.
- **Sensible** plays the way the interface teaches. For each magazine it plans the best known pairing for that
  magazine's readers, drawn with the focus the magazine suits and the studio's equipment (its art and story bonuses,
  inside the clamp, as on a drawn page), and keeps the magazine with the best forecast odds (ties: higher expected pay,
  then the softer field). It spends every point as it arrives (every third on pacing, the rest on art or story,
  whichever its target magazine weighs higher), takes shifts while money is under two weeks of costs, hires when a
  chapter will miss its issue (moving to the flat when the apartment's desk is taken, see Serialisation), and wraps a
  serial up at 16 results with popularity 50 or more. It answers a random event 'a' when that answer can be given and
  leaves two weeks of costs in the bank (costs after answering, so a raise counts the new salary), else 'b'; signs an
  anime offer the day it lands (Hoshi Animation under 12 results, else Studio Kumo); buys the cheapest equipment its
  studio may have once the bank holds the price plus four weeks of costs, one piece a day; from year two orders the
  cheapest goods run for its running serial on the same terms (see Merchandise); and reads the year review.
- **Careless** ignores the Notebook, the odds and the stats screen: every choice is a hash of the world seed and the
  project id, the focus is balanced, and it never spends points. It answers every event 'b' (the answer that costs no
  money), lets anime offers lapse, never buys or moves, and reads the year review.
- **Stress case** draws six fixed one-shots rotating Weekly Bolt, Kids Comic Go!, Monthly Petal and Ultra Seinen
  without spending points, then is forced into a Weekly Bolt serial with balanced focus; it declines organic offers
  and never wraps up. It leaves events and anime offers to lapse, never buys or moves, and reads the year review.

`npm run balance -- [from=1] [to=20] [--detail seed]` prints a line per seed per bot, then one line per balance-band row
(`--detail` adds every one-shot and chapter of that seed). The runs, the row measurements and the targets (`BANDS`)
live in `src/sim/balance.ts`; the script prints them and `src/sim/__tests__/balance.test.ts` asserts them (the bots run
once per test file), so the readout and the test cannot disagree. Each seed is played three ways: year one (336 days)
for weeks in debt, calibration and the Package 2 rows but anime; up to the 6th one-shot (at most three years) for the
first score, the first offer, the first-six mean and the money at the 6th; until the first serial ends or reaches 8
results (at most three years). The stress case plays 480 days. Two more runs per seed: the sensible bot until its first
anime offer (at most 672 days) for the anime row, and year one with its shopping switched off for S1, the money that
sets `EQUIPMENT_PRICE_SCALE` (balance.test checks the constant matches it).

### Balance bands (seeds 1 to 20)

| Package | Measure | Target |
|---|---|---|
| 1 | Sensible bot, first one-shot score | 40–55 on ≥ 13/20; median 44–52 |
| 1 | Sensible minus careless, mean score of first 6 one-shots | ≥ 8 |
| 1 | Sensible bot, organic offer within first 6 one-shots | ≥ 16/20; median first offer at one-shot ≤ 3 |
| 1 | Careless bot, organic offer within 6 | ≤ 6/20 |
| 1 | Sensible bot's first serial reaches 8 results | ≥ 14/20 |
| 1 | Stress case (forced Weekly Bolt, no points, balanced) | cancelled on ≥ 15/20, never before its 5th result |
| 1 | Careless bot money at its 6th result | < ¥3,000 on ≥ 15/20 |
| 1 | Forecast calibration (Σ offer chances vs offers seen, year one) | within ±30% |
| 1 | Sensible bot weeks in debt, year one | 0 on ≥ 18/20 |
| 2 | Events per year (sensible, mean events that land in year one) | 8–13 |
| 2 | Rival met in year one (sensible) | ≥ 16/20; bot wins 35–75% of meetings (all seeds pooled) |
| 2 | Award or near miss in year one (sensible) | ≥ 16/20; Golden Pen in year one ≤ 5/20 |
| 2 | Equipment owned at day 336 (sensible, buying) | 2–3 items on ≥ 12/20 |
| 2 | Anime offer within two years (sensible) | 6–16 of 20 |

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

Package 2 re-asserts every Package 1 row and adds its own; balance.test asserts all of them, the anime row included
(the file runs in about 2 seconds). The square-root volume curve and the listed knobs left the sensible bot's first
Kids Comic Go! serial a runaway hit: #1 or #2 on most chapters, 5 volumes and 30,000 to 45,000 copies in year one, S1
¥127,356. So Package 2 moved four constants instead (tuned in 0.1.0, "Package A"): the anime offer needs 37,000
copies (was 15,000), the Golden Pen 37,000 with a near miss from 22,000 (was 20,000 and 12,000), the rival starts at
craft 57 with a field margin of 6 (was 50 and 2), and the price scale follows S1 / 9000 within 0.75-16 (was clamped at
4). On seeds 1–20 every row then passes: events 11.1 a year (8 to 15 per seed), the rival met on 20/20 and beaten in
71% of year-one meetings, an award or near miss on 20/20 and the Golden Pen on 2/20, 2 or 3 pieces of equipment at day
336 on 18/20, and anime offers within two years on 12/20 (days 507 to 574). The cause stays a candidate for a later,
root-level retune (the pace of year one: XP, chapter fans or chapter pay).

## Rulings

**2026-09-26, UI overhaul.** The 0.2.0 upgrade replaced the static desk-and-modals shell with a live pixel-art
studio scene and restyled every panel. These decisions came out of that pass:

- The scene canvas is 320x180, with two coordinate spaces meeting in `paint.ts`: room space, the original 192x108
  layout, offset by `OX 64, OY 36` into canvas space.
- The presentation clock (`src/state/clock.ts`) runs a week-long light cycle (`t`, `weekT`), not an hour clock: night
  is `t > 0.72 || t < 0.06`, and the wall clock's hands lap the week rather than a day.
- The cast is a table of actors (`actors.ts`): position, target, facing, current and goal pose, and which axis each
  walks first, stepped by `stepActors` and settled at once on mount or a loaded save.
- The editor visits for a reason (`visitor.ts`), walks in from the door, and the results and offer modals do not
  mount until `EDITOR_WALK_MS` (1400 ms, the door-to-spot distance at 40 px/s) after the result or offer lands (0
  under reduced motion), so neither modal beats the editor to the desk.
- Money, fans and xp rises are pops (`Pops.tsx`) and the mangaka's daily log line and the editor's greeting are
  speech bubbles (`Bubble.tsx`); both are DOM elements anchored to scene coordinates (`sceneAnchor.ts`'s
  `sceneToCss`), not drawn on the canvas.
- Silkscreen replaces Bangers for display type (`--font-display`, `--font-num`), used only at 8, 16, 24 and 32 px
  (the sizes it was drawn for); body copy and buttons stay Nunito.
- The scene keeps animating behind an open modal (the `::backdrop` is a plain translucent fill, no
  `backdrop-filter`/blur) and only sleeps when the document tab itself is hidden.
- Every modal carries the same pixel-frame kit: a 3px hard border, an inset bevel (light top-left, dark
  bottom-right) and a hard drop shadow, no soft box-shadow blur.
- The modal duck (60%, `MODAL_DUCK`) and the results reveal's own duck (30%) stack through `holdDuck`'s hold list
  rather than one overwriting the other, so a reveal inside its modal reads as strictly quieter than a modal alone.
- `'tab'` (the title-bar tab-switch cue) is a bandpass noise click at 1200 Hz, not a pitched tone: every *tone*
  voice in `cues.ts` sits on the C major pentatonic scale (C D E G A) by the cue tests, but 1200 Hz is a noise
  voice's filter frequency, not a note, so it is exempt by construction rather than by exception.
- Balance bands are unchanged: no sim formula or constant moved in this pass, so `balance.test.ts` and
  `npm run balance` still read the seeds 1-20 numbers already recorded above.

**2026-09-28, the illustrated upgrade.** The 0.5.0 upgrade adds a hybrid art pipeline (generated static illustrations
alongside the untouched code-drawn scene and sprites) and a handful of visual polish decisions:

- Art is hybrid, not a replacement: the live scene and sprites stay code-drawn `fillRect`, and generated raster art
  (Z-Image-Turbo, via `scripts/pixelate.ts`, see "Art" above) ships only as static illustrations, doubling as
  reference for hand-painted redraws rather than being composited into the canvas at runtime. (Reversed for the
  scene's room shells and structural props by 2026-09-30, scene art.)
- Stepped pixel corners (`base.css`, `--step`) are cut with `clip-path`, and the same clip-path also carries the
  box's own hard drop shadow around the step via `--pf-x`/`--pf-y`, which must always match that element's own
  box-shadow offset so the shadow keeps the stepped silhouette instead of being clipped away with the corner.
- The status card's dark theme is its own fixed token set (`--hud-dark`, `--hud-dark-ink`, `--hud-dark-muted`,
  `--hud-dark-warn`), independent of the page's light/dark theme, each gated at 4.5:1 contrast against `--hud-dark`
  by `scripts/contrast.ts`.
- Positive money reads in `--gold-text`; the accent colour is reserved for negative money, so a red amount always
  means money going out.
- The scene redraw (Task 6) moved the fillRect baselines from 659/1065 to 673/1079 (`render.test.ts`,
  `studioArt.test.ts`; see "The studio in the scene" above for the item-by-item accounting), and `roomArt.test.ts`
  caps every tier's room-and-front-row fill count at 84.
- Task C content pass (0.7.0): six events appended to the pool, the Manga Museum, the Mountain Retreat and the
  event-only Book Signing, editor personas and the rival temper. Editor relationships already existed, so the
  interview's written reply and the dinner raise the real relationship (no stand-in stat). A tip earned from an event
  reveals the first unknown pairing and draws no RNG, keeping events off the main seed. No max-stamina cap existed, so
  the retreat introduces its own (150), shown on the Trips panel; the hot spring stays uncapped. The signing pays 0.2
  of the average copies a volume, its intended worth; it is not an S1 knob.
- Content moved S1; scale re-derived to 11.0. With Task C's events S1 is ¥100,099 (S1 / 9000 = 11.12), so
  `EQUIPMENT_PRICE_SCALE` went from 11.25 to 11 and every price and move-in with it (coffee ¥22,000, lamp ¥27,500,
  shelf ¥33,000, chair ¥44,000, drafting table ¥77,000, tablet ¥132,000; flat ¥55,000, loft ¥165,000), re-derived by
  hand in studio.test. No band threshold changed; every row passes.
- A sick assistant kept working loses 5 max stamina, never below 40 (the card says so), and which assistant falls ill
  is a hash of the roll's day and event seed, drawing no extra RNG.
- The sensible bot skips a goods run whose `merchForecast` net is zero or less (carried from Task M).

**2026-09-30, scene art.** Release 0.9.0 (plan: `docs/plans/2026-09-30-scene-art.md`) lets generated art into the live
scene. Task R1 laid the plumbing, with no art yet:

- The scene may draw generated images with `drawImage`: each tier's room shell and the structural props' sprites.
  Every image has a code-drawn fallback, used while it is missing or still loading (a frame is never blank), and the
  characters stay string-map sprites. This replaces the 2026-09-28 rule that nothing generated is composited into the
  canvas.
- `render` takes the images as a `SceneArt` (`sceneArt.ts`, last argument, default `NO_ART`, today's scene exactly);
  `sceneImages.ts` builds them once from the registry's `ROOM_ART` and `SCENE_PROP_ART` and `StudioScene` repaints on
  each load. `render.ts` never imports the registry.
- Night keeps the scene's own overlay; a room image gets one extra `rgba(20,24,60,0.25)` fill right after it (the
  code-drawn shells have night colours, one image serves both), and no night-variant images are made.
- Each prop's image lands at the footprint of the piece it replaces, measured from the code (see "Scene images"), in
  that piece's place in the draw order; no actor spot moves. The prop ids use the code's terms: `door` (the
  apartment's plain door) and `poster` (the stock poster) where the plan said `door-apartment` and `poster-frame`.
  To give the door its own draw site, `studioArt.ts`'s `TIER_DOOR` now holds each tier's door and `TIER_ART` only
  what follows it (the loft's plants).
- The fill budgets measure what is still code-drawn: `fakeCanvas.ts` logs `drawImage` apart (`images`), and the
  673/1079 baselines are unchanged with `NO_ART`.
- The room shells' day colours from `roomArt.ts` and `studioArt.ts` join the palette as `ART_PALETTE_SCENE`, used
  only by manifest entries marked `"palette": "scene"`; `ART_PALETTE_BASE` stays frozen so the earlier
  illustrations regenerate byte for byte (checked by hand on title/hero, genre/action, event/letter, badge/locked and
  place/library: identical on the base, all five different on the scene palette). A `room/*` PNG may be up to 12 KB
  and the art total cap rises from 100 KB to 160 KB.

Task R2 put the art in (three room shells, seven prop sprites):

- Room shells align their wall/floor seam by a piecewise vertical remap in the pipeline (manifest `seam`, source row
  to canvas row 114), not by tight crops, which would discard most of each image; the wall and floor textures stretch
  a little vertically.
- A per-entry `lightness` weight on the palette snap keeps a shaded wall's hue (a plain snap greyed the flat's teal);
  absent means 1, so every earlier illustration regenerates unchanged.
- Prop sprites keep their generated aspect, sized to the footprint's height, bottom-aligned and centred
  (`PROP_SPRITE`, `PROP_BOX`); a prop may be wider than its old footprint where the wall is free. The bed stays inside
  its old 58 px so the door and the doorway can be 33 px wide without covering it (at full height they would be 38
  and 46 px); the fallbacks keep their old footprints.
- New fill baselines with every image ready: 546 (`render.test.ts`) and 953 (`studioArt.test.ts`), each with its own
  1.5x budget, beside the unchanged 673/1079.

**2026-10-01, props.** Release 0.10.0 Task P1 turns the desk, the chairs, the equipment and each tier's front row into
generated sprites (see "The furniture" under "Scene images"):

- A desk sprite spans its footprint's width and hangs from its top row (`fitDesk`, `hangSprite`), so the tabletop
  stays at y 98 under the pages, the ink pot and the pen; at the footprint's height it would be 35 px wide under a
  58 px desk top. Its legs reach y 130 (the drafting table's 129), over the floor, and with three assistants its
  pedestal covers the right end of their bench (x 116-129), as the drawn desk already covers the third assistant.
- The sofa sprite is capped at 37x23, clear of the bin.
- Fix round 1 (controller ruling): small props get a minimum readable size, about twice their old height, where the
  space is free (`PROP_MIN_H`: the zabuton 24x12, the book stack 20x18, the coffee machine 11x14 on the sill); the
  reference shelf is 20x24, flush with its slot's right edge (`PROP_ALIGN`) in front of the bookshelf's right side,
  clear of the poster and above the desk top. The fill counts do not change.
- Three pipeline knobs, each used once: `flip` (the arm lamp), a cutout's flood `tolerance` (the wooden chair, 40)
  and `holes` (the chair's backrest opening).
- Review fix: with a desk sprite ready the stamina cups stand at y 126-129, between its legs, instead of over its
  modesty panel (same fills).
- The assistants' bench stays code-drawn (its width follows the staff); the pen tablet and the other small desk
  pieces too.
- Art baselines 546/953 move to 521/928 (budgets 781.5 and 1392); 673/1079 are unchanged.
- Final review (controller ruling): with the drafting table's image ready its left leg (x 111-122, y ~120-123) hid seat 3's page and ink lines, so a seated assistant's page is drawn after the active desk sprite when its box overlaps the sprite's box and the sprite is ready (`PAGE_UNDER_DESK`, precomputed per seat); with no image the order is unchanged. Same fill counts, baselines unchanged.

**2026-10-02, the tutorial.** Release 0.8.0 Task A1 adds the guided first career's state (see "Tutorial"):

- A tutorial step is a decision: entering one pauses the clock the way `tick` does (`pauseForDecision`: speed 0, the
  desk shown) and never locks the speed controls. A step entered before its anchor can exist never pauses: `clock-run`
  (step 5) and `submitted` (step 7) keep the clock running until the game's own decision pause.
- Review fixes (controller rulings): `phaseOf` reads a waiting result as submitted; a tick that changes that phase
  resumes the step against the new game (no extra pause); the tutorial never moves in a read-only tab
  (`withTutorial`, `advanceTutorial`, `skipTutorial`); on resume step 1 maps to 0 and step 6 to 5, since the window
  is not saved.
- Steps wait silently while their control is off screen.
- `tutorialStep` is the step index per career, -1 done; `SAVE_VERSION` stays 2, and a saved step resumes through
  `resumeTutorialStep`, whose later-step search only takes a step of the game's own phase (an `any` step never ends a
  phase early: step 5 on an idle game ends the tutorial).
- Final review (controller rulings): step 5 on a game still drawing resumes at 4 (it used to end the tutorial); a
  replay lands on the Notebook step while a poll is pending and never pauses on a step whose control cannot show (on a
  trip: the phase's first step, clock untouched; `replayStepFor`, `canPoint`); the goal step ends the tutorial when no
  milestone is left (`settleStep`); Settings' Help offers "Skip the tutorial" while a step is open; the guide speaks
  through a live node mounted empty (Next and Skip described by the line), takes focus back on an info step when its
  control returns and focus is on the page, and `place()` reads every size before it writes a style.

**2026-10-02, the cast redraw.** Release 0.9.0's Release B hand-redraws the cast (see "The cast redraw" under "The
sprites"). The 0.9.0 to 0.11.0 labels elsewhere in this file are the scene-art plan's numbering, which shipped inside
0.7.0; the 2026-10-02 plan's releases restart after the 0.7.0 tag at 0.8.0 (the tutorial), 0.9.0 (the cast) and
0.10.0 (the rooms). Its rulings:

- `ANCHOR_HEAD` stays byte for byte, and so does every frame contract: the frame sizes and counts (21 human 24x32
  frames, the 30x14 lie, 7 cat frames at 12x8), the `faceRules` set (both idle, both sit and both sip frames),
  `HEAD_DY`, and `breathOf(MANGAKA_IDLE[0])` being exactly `MANGAKA_IDLE[1]`.
- Each frame's run count is capped at 1.3x its pre-redraw count (`RUN_CAPS`), and a cap is never raised.
- Each set is gated on the contact sheet (`npm run sprites`) and the running scene before its commit.
- The exact fill baselines are re-measured by hand, never budgeted up: 673 to 701, 1079 to 1125, the art scenes 521
  to 549 and 928 to 974, the rest scene 509 to 506.

**2026-10-02, the rooms.** Release 0.10.0's Release C polishes the rooms (see "The walls" under "Art"). Its rulings:

- Walls are generated, floors are drawn in code: a room image is the tier's wall, 320x114 over canvas rows 0-113,
  and `TIER_FLOOR` always paints after it (the rug and the tatami edges return); `TIER_WALL` paints only while the
  image is missing or loading.
- The pipeline's `floor: "code"` branch: `wallOnly` keeps the raw rows above `seam.src`, `native` [320, 114] and
  `seam.dst` 114; a wall whose generation is not flat lit may set `flatten: { radius }` (`flattenToMode`), a wall
  only, and only where the plaster is the wall's most frequent exact colour.
- The palette swap: `#6f9a90`, the flat's stripe teal, joins `SCENE_ADDITIONS`; `#9dc2b9` leaves it (no committed
  PNG held it). `ART_PALETTE_BASE` is untouched.
- The wall prompts carry the lighting clause ("perfectly flat even lighting, no vignette, no gradient, no light pool,
  no shadows") and let the floor be cut off.
- The exact fill baselines are re-measured by hand, never budgeted up: the art scenes 549 to 584 and 974 to 1009, the
  apartment's code floor; 701, 1125 and 506 unchanged.

**2026-10-09, the flat's wall.** Release 0.10.1 (see "The flat's wall in code" under "Art"): the flat's generated
wall is dropped and its wall drawn in code (even 10 px stripes, a walnut wainscot apart from the honey floor), since no
generation gave both even stripes and flat light; the apartment and the loft keep their images, and `art.test.ts`
holds their plaster to at most 2 colours.

**2026-10-09, the remaining minors.** Release 0.10.2 (plan: `docs/plans/2026-10-09-remaining-minors.md`) fixes the
minor findings the 0.9.0, 0.10.0 and 0.10.1 reviews left. Its rulings:

- The walks (see "The cast redraw" under "The sprites"): each contact frame swings the arm opposite the stepping leg,
  the standing leg keeps its shading on both contact frames, the editor's walk legs are the mangaka's through
  `recolour` with his briefcase drawn over them, and the stretch's raised fists are outlined; no fill baseline moved.
- The flat's night stripe is `#425c60` (was `#465f5a`, a plain dim), and every night colour of the flat's wall is
  tested dimmer and at least 0.01 bluer in blue share than its day one (see "The flat's wall in code").
- The apartment's wall keeps its recipe (crop, seam, `flatten` 0.25): no crop and radius keep both its plaster flat
  and its baseboard's lit row (see "The walls").
- `art.test.ts`'s decoder meets the five PNG filters on a synthetic image and refuses a wrong signature.
- `prop/books` (1 pixel) and `prop/bookshelf` (5) are regenerated against the 0.10.1 palette; `prop/kitchenette` is
  not, since its regeneration changes 423 of 3364 pixels (the dark green `#262f25` edges turn `#1f2129`, the pale
  `#cbc7bf` wall behind it `#b9b6ad`, the warm `#dba57d` highlights grey), a visible change left to the owner, so
  `npm run art -- --all` still rewrites that one PNG. With the pre-0.10.0 palette all three regenerate byte for byte:
  the drift is the palette's (`#8fb5ac` and `#9dc2b9` out, `#6f9a90` in), not the pipeline's.
- `ROOM_ART` is a full record again (the flat `null`); the corkboard's `CORK` comment names every sprite holding
  `#b98a5c` (the kitchenette, bed, boxes and reference shelf); `npm run sprites` draws an empty cell and prints a note
  when the working tree lacks an outfit or assistant palette, as it already did for HEAD.
