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
below). The kitchenette sits on the left wall at canvas x 2-61, y 56-113. The front door is a fixed frame on the right
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
62-65 and 252-255, two rows of tatami with dark-green cloth edges at y 114, 146 and 178); the flat has teal wallpaper
over a wood wainscot (rail at y 84), honey planks and a red rug in front of the desk (x 104-195, y 122-137); the loft
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

### Art
The live scene and every sprite stay code-drawn `fillRect` (`render.ts`, `roomArt.ts`, `studioArt.ts`, `sprites.ts`):
nothing generated is ever composited into the canvas at runtime. Generated raster art (upgrade 0.5.0) is a separate,
smaller thing: static illustrations, shipped as indexed PNGs, that never move or redraw per frame. They exist to give
a few fixed spots (so far, the title screen) real illustration instead of a code-drawn scene, and they double as
reference art the hand-painted scene and sprites get redrawn toward, not as a replacement for it.

**Making an asset.** Each asset is generated once with a Hugging Face image Space running Z-Image-Turbo at a fixed
seed, and recorded as one entry in `art/manifest.json`: id, model, resolution, seed, steps, shift and the exact
prompt, plus how the pipeline should treat it (`native` size, `sample` mode, whether it needs a `cutout` or an
`outline`, an optional `colors` cap, and an optional `crop` or sheet `cell` for a multi-pose sheet). The raw generated
file is committed under `art/raw/<id>.webp` (or the sheet's own name) rather than treated as disposable, because the
Space's model or sampler can change and a generation is not reproducible from the manifest alone.

`npm run art -- <id> | --all` runs `scripts/pixelate.ts`, which is IO and orchestration only; the pixel math lives in
`src/ui/art/pixelOps.ts` (plain RGBA buffers, no `sharp` import, so it is unit-tested directly). For each entry it:
crops the manifest's `crop` rect or slices one cell out of a sprite sheet; for a `cutout` entry, flood-fills
transparent from the edges (`floodTransparentFromEdges`, matching the corner colour within a tolerance), finds the
alpha bounding box, and pads it out to the target aspect ratio before cropping to it (`padToAspect`) so the subject
isn't stretched; downsamples to the manifest's `native` size, either area-averaged (`sample: "area"`, alpha-weighted,
transparent when under half a block is opaque) or nearest-neighbour (`sample: "nearest"`, for an already-blocky sheet
crop); snaps every opaque pixel to the nearest `ART_PALETTE` colour in OKLab space (`snapToPalette`); reduces to the
entry's colour cap, keeping the most-used colours and re-snapping the rest (`reduceColors`); despeckles single-pixel
colour flecks against a unanimous 4-neighbour field (`despeckle`); optionally adds a 1px outline on transparent
pixels 4-adjacent to an opaque one (`addOutline`); and writes an indexed PNG to `src/assets/art/<id>.png`, verifying
afterward that every pixel it wrote is a literal `ART_PALETTE` colour.

**The palette rule.** `ART_PALETTE` (`src/ui/art/palette.ts`) is a fixed, deduplicated list of lowercase hex colours,
and every one of them must already appear literally somewhere in `src/ui/scene/*.ts` or `src/styles/tokens.css`
(checked by `src/ui/__tests__/art.test.ts`) — a generated illustration can only use colours the hand-painted scene or
the design tokens already use, so it reads as part of the same world rather than importing its own palette.

**Budgets** (also `art.test.ts`, run against the committed PNGs, not regenerated): every manifest id needs both a raw
source and a generated PNG, with no orphan PNGs left under `src/assets/art`; every PNG's IHDR size must match its
manifest `native` size, its colour type must be indexed (PNG colour type 3), and every PLTE entry must be in
`ART_PALETTE`; and every PNG must fit its size cap (16 KB for `title/hero`, 4 KB for any other entry, 100 KB total
across every generated asset).

**Mounting in the UI.** `src/ui/art/registry.ts` globs every generated PNG in eagerly (`import.meta.glob`, `eager:
true`) so each one becomes a real bundled asset URL, never inlined as base64, and exposes a typed `art(id, w, h)`
lookup that throws at module load — not render time — if an id has no generated PNG yet. A later task can add its
own typed records here (for example a `Record<GenreId, ArtRef>`) built on the same helper. `PixelArt.tsx` renders an
`ArtRef` as an `<img>` at an integer `scale`, undecorated (`loading="lazy"`, `decoding="async"`, not draggable) and
crisp in every browser; its `alt` defaults to `''` (decorative) except where the image carries real meaning, such as
the title hero.

**The title hero** (`TitleScreen.tsx`) renders `TITLE_ART` (manifest id `title/hero`, native 320x180) directly rather
than through `PixelArt`, with a real `alt` describing the scene, filling the `.title-screen.has-hero` background.
`app.css`'s `.title-screen.has-hero::before` lays a scrim over it so the card text stays legible: a left-to-right
gradient from `--title-scrim` to `--title-scrim-clear` on wide layouts (the card sits over the scrim, the art shows
through past it), and a flat `--title-scrim` fill below the breakpoint where the card stacks below the art instead.
`.has-hero` only applies when the hero image is present, so a title screen without one keeps its plain background.

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
  tier's move-in; the panel asks to confirm a move ("Yes, move in for ¥56,300" or "Stay here"), and the next tier's line
  says "You cannot move back down." Equipment is a single click. The tier's rent is part of the weekly costs (living + rent + salaries), and the weekly log line names
  it when it is not zero ("Weekly costs: -¥550 (living ¥400, rent ¥150)."). `hireAssistant` refuses once every desk is
  taken, on top of the rule that the bank must hold two weeks of that salary.

| Tier | Desks | Rent/week | Move-in (base) | Move-in at scale 11.25 |
|---|---|---|---|---|
| Apartment | 1 | ¥0 | ¥0 | ¥0 |
| Studio flat | 2 | ¥150 | ¥5,000 | ¥56,300 |
| Studio loft | 3 | ¥350 | ¥15,000 (from the flat) | ¥168,800 (from the flat) |

- **Equipment** is bought once and kept. A piece cannot be bought twice, without the money, or (the pen tablet) below
  the studio flat. Effects sum over everything owned; page multipliers multiply (drafting table and tablet: x1.265).
  Art and story bonuses go on the player's own samples of every working day (clamped to 100), never the assistants'.
  The page multiplier is part of `basePagesPerDay`, so the desk's pace, the ETA and the chapter deadline all include it.

| Equipment | Base price | Price at scale 11.25 | Effect |
|---|---|---|---|
| Coffee machine | ¥2,000 | ¥22,500 | Resting restores 3 more stamina a day (the rest branch, not trips) |
| Daylight lamp | ¥2,500 | ¥28,100 | Art +3 on your pages |
| Reference shelf | ¥3,000 | ¥33,800 | Story +3 on your pages |
| Ergonomic chair | ¥4,000 | ¥45,000 | Drawing costs 1 less stamina a day (min 2); adds to an Inspiring assistant's 1 |
| Drafting table | ¥7,000 | ¥78,800 | 10% more pages a day |
| Pen tablet | ¥12,000, needs the flat | ¥135,000 | 15% more pages a day, art +2 |

- **Prices** go through `equipmentPrice(id)` and `moveInCost(tier)`: the base price times `EQUIPMENT_PRICE_SCALE`,
  rounded to the nearest ¥100. The panel and the tests read the helpers, never the base prices. The scale is
  S1 / 9000 rounded to 0.25 and held within 0.75-16 (`priceScale` in balance.ts), where S1 is the sensible balance
  bot's median money at day 336 with its shopping switched off (seeds 1-20; `npm run balance` prints it). S1 is
  ¥101,816.5, so S1 / 9000 = 11.31 and the scale is 11.25; balance.test checks the constant is the scale S1 gives, so
  a change that moves the economy says when the prices need re-deriving. The Full studio milestone (three assistants)
  needs the loft: ¥225,100 in move-ins at this scale (¥56,300 for the flat, ¥168,800 for the loft), then ¥350 a week
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

Stamina changes clamp to 0..max stamina. Each assistant asks for a raise once, whatever the answer. A reprint is for
the running serial when it has shipped a volume, else the latest archived one that has.

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
`rising-mangaka-save-1`, `-2` and `-3` (the game, the tips step and the run speed, the same payload and
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
is never overwritten, and nothing ever deletes the old key. In the desktop
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

## Roadmap
0. Money sinks. Shipped: hiring needs two weeks of that salary in the bank; a week that ends below zero makes
   assistants quit and charges an overdraft fee (5% of the debt, at least ¥50), and a week that ends with less
   than one week of costs warns first; studio tiers gate assistant desks with rent, equipment has stated effects and
   prices scaled to what a career earns (see Studio and equipment); volume sales flatten with fans (the square-root
   curve, see Serialisation); the smaller HUD on phones shipped separately.
1. Awards and success. Shipped: year-end awards with a year review (see Year end and awards), anime adaptation offers
   (see Anime adaptations) and conventions (an event-only trip, see Random events). Merchandise is not built.
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

## Tick order
The final hook order inside `tick()`:

1. Day + 1.
2. Trip, part-time job, or the work-or-rest branch (pages, stamina, assistants; equipment effects apply here).
3. Weekly costs (living cost, studio rent and salaries, with the overdraft rules).
4. Candidate refresh.
5. One-shot poll result and serialisation offer.
6. `resolveChapters` (chapter polls, volumes, warnings, cancellation, archiving).
7. `checkDeadline` (a serial chapter not in by its due day misses the issue; warnings and cancellation).
8. `closeYear` (on day % 336 == 0, day > 0: awards and prizes, the year review, the rival's growth, the new year's
   baseline).
9. `animeTick` (a waiting anime offer whose series stopped running is withdrawn, one past its last day lapses; each
   deal's premiere, weekly pay, finale and end of boost; a new offer to a running hit).
10. `eventTick` (an unanswered event past its last day, or one whose subject is gone, lapses; the weekly random-event
    roll).
11. `awardMilestones`.
12. Return.

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
  studio may have once the bank holds the price plus four weeks of costs, one piece a day; and reads the year review.
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
  reference for hand-painted redraws rather than being composited into the canvas at runtime.
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
