# The Rising Mangaka 0.4.0: The Chibi Cast — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute with **subagent-driven-development**:
> - one implementer subagent per task, then a task review (spec + quality);
> - a ledger in `.superpowers/sdd/2026-09-28-chibi-cast/progress.md`;
> - a final whole-branch review on the most capable model, then **finishing-a-development-branch**.
>
> Every task is test-first (**test-driven-development**): write the failing test, watch it fail, implement, watch it
> pass. Before any "done" claim, run the gate (**verification-before-completion**). Art tasks add zoomed browser
> screenshots to the review package, reviewed with the **frontend-design** eye (one memorable thing, no clutter).
> Steps use checkbox (`- [ ]`) syntax.

**Goal:** Redraw the cast at chibi proportions (about 2 heads tall, big faces), give the mangaka and the assistants
faces that react to the game, add idle moves for the mangaka and the cat, and dress the mangaka by career level. The
sim is not touched.

**Architecture:**
- **Box and spots stay.** Every person stays a 24×32 string map with feet on row 31, so the spots
  (`actors.ts`), the shadows, the bubbles and the front/back pass are unchanged.
- **Expressions are an overlay, not new frames.** A `FACES` map, 14×4 at the face rows, is drawn over any
  head-steady frame. A pure `moodOf` in a new `mood.ts` picks the mood from the snapshot.
- **Idle variants are extra frame sets,** chosen by a frame-cycle helper.
- **Outfits are a palette swap** of the hoodie keys `J/j`, chosen by level.

**Tech stack:** unchanged (React 19, TS 6, Vite 8, Vitest 5, happy-dom, the recording fake canvas in
`src/test/fakeCanvas.ts`).

**Spec:**
- this plan;
- DESIGN.md "The studio in the scene" and "The sprites";
- CLAUDE.md;
- the style precedent `docs/plans/2026-09-27-real-characters.md`.

Branch `upgrade/0.4.0` from `upgrade/0.3.0` (0.3.0 is not merged yet; stacking keeps one review path, as 0.2.1 did).

## Context

The 0.3.0 room is warm and full, but the people in it are still realistic 24×32 figures, about 3.5 heads tall, with
eyes two pixels wide. At scene scale they read as small grey figures. Kairosoft's charm is chibi people with big heads
whose faces show what is happening. The owner chose all four parts for 0.4.0:
- the chibi redraw;
- expressions;
- more idle moves;
- outfits by level.

Execution is subagent-driven.

## Decisions (Claude, from the owner's brief, 2026-09-28)

1. **Proportions: head rows 0-15, body rows 16-31 (2 heads).**
   - The head is 18 px wide (cols 2-19).
   - The eyes are 2×3 with a white highlight.
   - There is a blush row and a 2 px mouth.
   - The anchor frame below is binding. Every other frame is drawn from it by the per-frame rules.
2. **Same box, same spots, same feet.** Row 31 stays the floor contact.
   - The standing shadow at `(x+4, y+30, 16)` still sits under the feet (the feet are cols 6-16).
   - The bubble anchor `(x+12, y-2)` and the glyph row `y-8` are unchanged.
3. **Expressions are an overlay: `FACES[mood]`, 14 wide × 4 tall, drawn at `(x+4, y+9+headDy)`.**
   - When the sprite is flipped, it is drawn at `(x+6, …)` and itself flipped.
   - It is drawn only on head-steady poses: standing idle, seated sitting (not panic), and the assistants seated.
   - Walking, panic, bed and doze keep the faces baked into their frames.
4. **The moods and their priority (`moodOf`):**
   1. `surprised`: the editor is standing in the studio and the mangaka is home.
   2. `happy`: `cheer`, which is set for 2400 ms when a fans or level pop fires.
   3. `tired`: stamina below `LOW_STAMINA_THRESHOLD`.
   4. `sleepy`: the activity is rest, at night.
   5. `neutral`.

   Panic stays the existing `MANGAKA_PANIC` frames (late while working), which beats every mood. Each mood also has a
   mark above the head at `(x+11, y-8)`:
   - a sweat drop (tired), replacing today's low-stamina `!`;
   - a sparkle (happy);
   - `!` (surprised);
   - `z` (sleepy).
5. **Assistants** use the same overlay:
   - `tired` when their own stamina is below `LOW_STAMINA_THRESHOLD`;
   - `happy` while `cheer` is on;
   - `neutral` otherwise.

   Dozing is unchanged.
6. **Idle cycles** are a pure `idleFrame(frame)` in `mood.ts`. The standing mangaka's 360-frame cycle is:
   - 0-239: breathing (today's `frame/16 % 2`);
   - 240-299: `MANGAKA_STRETCH` (2 frames, `frame/15 % 2`);
   - 300-359: `MANGAKA_SIP` (2 frames, a mug at the mouth).

   It applies only when the phase is not `ready` (then the manuscript is in hand). The cat's 480-frame sitting cycle is:
   - 0-359: `CAT_SIT`;
   - 360-419: `CAT_GROOM` (2 frames, `frame/15 % 2`);
   - 420-479: `CAT_STRETCH`.

   Frame 0 (reduced motion) is always the plain idle.
7. **Outfits by level (`outfitOf(level)`), mangaka only.** The outfit swaps `J/j` in the palette:

   | Level | Outfit | Base `J` | Shade `j` |
   |---|---|---|---|
   | 1-4 | hoodie | `#6f7a8c` | `#525c6b` |
   | 5-9 | cardigan | `#c9a24a` | `#a8832f` |
   | 10+ | blazer | `#2e3a78` | `#222b5c` |

   It is purely visual, so no UI hint is required. DESIGN.md records the thresholds. Ruling: if level 10 is rarely
   reached in a first year, the owner can move the thresholds; the cost is one constant.
8. **The avatar crop moves to the chibi head:** rows 0-15, cols 2-19 (18×16), and the SVG viewBox becomes 18×16.
9. **Out of scope:** the sim, `actors.ts` spots and walking, the room, new props, seasonal furniture.

## Global Constraints

- Every person frame is exactly 24×32. `frameRules(map)` returns `[]`: each row starts and ends with `L`, every key
  is in the palette, and the last row is not empty. `MANGAKA_LIE` is 30×14, the cat frames are 12×8, and the
  `FACES` maps are 14×4, checked for width, height and palette keys only. Face rows are opaque skin, not outlined,
  so `frameRules`' closed-row rule does not apply.
- The feet are on row 31 for every standing, walking and sitting frame. The spots in `actors.ts` do not change.
- `src/sim` has no diff (`git diff --stat upgrade/0.3.0 -- src/sim` is empty).
- Nothing is allocated per frame. Faces, idle sets and outfit palettes are module-level tables. `OUTFIT_PALS` is built
  once, and the snapshot carries `level` and `cheer` as primitives.
- Tests use `covers()` with literals derived by hand from the maps in this plan, never computed from the code under
  test.
- The fill baselines (`render.test.ts` 649, `studioArt.test.ts` 1025) are re-measured once in Task 6, with a hand
  breakdown in the docblocks. Every scene stays under 1.5× its baseline.
- There are no emoji in the interface, and copy is in sentence case. Colours in sprites are raw hex (sprite palette),
  never in components.
- Gate before any task is marked done: `npx tsc -b`, `npm test`, `npm run build`. At the end: `npm run check`.

## The style anchor: `MANGAKA_IDLE[0]` (binding)

Exact rows (24 chars each; cols counted from 0):
```
......LLLLLLLLLL........   0  crown
....LLHHHHHHHHHhLL......   1
...LHHHHHHHHHHHHhhL.....   2
..LHHHHHHHHHHHHHHhhL....   3
..LHHHHHHHHHHHHHHhhL....   4
..LHHHHHHHHHHHHHHhhL....   5
..LHHHSHHHHSHHHHHhhL....   6  bangs
..LHSSSSSSSSSSSSSShL....   7  brow line
..LHSSSSSSSSSSSSSSsL....   8
..LHSSEESSSSSSEESSsL....   9  eyes (cols 6-7, 14-15): the FACES rows start here
..LHSSEWSSSSSSEWSSsL....  10  highlights (cols 7, 15)
..LHSSEESSSSSSEESSsL....  11
..LSBBSSSSMMSSSSBBsL....  12  blush (4-5, 16-17), mouth (10-11)
...LSSSSSSSSSSSSSSsL....  13
....LSSSSSSSSSSSSsL.....  14
.....LLsssssssssLL......  15  chin, neck shade
......LJJJsssJJjL.......  16  collar
.....LJJJJRWRJJjjL......  17  shirt stripe down the front (R/W)
....LJJJJJRWRJJJjjL.....  18
....LJJJJJWRWJJJjjL.....  19
....LJJLJJRWRJJLjjL.....  20  arms (L at cols 7, 15)
....LJJLJJWRWJJLjjL.....  21
....LSSLJJRWRJJLSsL.....  22  hands: the prop row (was 21)
.....LLLJJJJJJJLLL......  23
.......LjjjjjjjjL.......  24  hem
.......LTTTTTTTtL.......  25
.......LTTTLTTTtL.......  26  legs (gap at col 11)
.......LTTTLTTTtL.......  27
.......LTTTLTTttL.......  28
.......LtttLttttL.......  29
......LOOOLLOOOoL.......  30  shoes
......LLLLLLLLLLL.......  31  soles (cols 6-16)
```
Hand-derived pins (the frame at canvas `(x, y)`):
- hair `H` `#2b2140` at `(x+8, y+2)`;
- eye `E` `#1b1b1b` at `(x+6, y+9)`;
- highlight `W` at `(x+7, y+10)`;
- mouth `M` `#c0392b` at `(x+10, y+12)`;
- skin `S` `#f4cfa5` at `(x+8, y+13)`;
- hoodie `J` `#6f7a8c` at `(x+6, y+18)`;
- shoe `O` `#c0392b` at `(x+7, y+30)`;
- sole `L` across `x+6..x+16` at `y+31`.

## Per-frame rules (deltas from the anchor)

- **IDLE[1] (breath):** rows 0-23 move down one row, rows 24-31 unchanged; row 0 becomes all `.`. `headDy = 1`.
- **STRETCH[0]:** the anchor with the arms flung out and up. Rows 20-22 lose the `L` arm lines (cols 7 and 15 become
  `J`, and row 22's hands become `JJ`). The arms run diagonally from the shoulders (row 17) to hands beside the head:
  - rows 15-16: `LJL` at cols 0-2 and 21-23;
  - rows 13-14: `LSL` at cols 0-2 and 21-23 (the hands);
  - row 12: `L` at cols 1 and 22.

  The eyes close in the stretch (rows 9-11, cols 6-7 and 14-15 become `S`, and row 10 there becomes `ss`).
- **STRETCH[1]:** STRETCH[0] with rows 0-23 moved down one row (`headDy = 1`, row 0 all `.`).
- **SIP[0]:** the anchor with the leading hand raised to the mouth. Row 12 cols 8-11 become `LWWL` (the mug rim),
  row 13 cols 8-11 `LWWL`, row 14 cols 8-11 `LSSL` (the hand). Row 22's left hand becomes `JJ` (cols 5-6) with the
  arm line kept.
- **SIP[1]:** SIP[0] with the eyes closed: rows 9-11, cols 6-7 and 14-15 become `S`, and row 10 cols 6-7 and 14-15
  become `ss`.
- **WALK[0..3]:** the anchor's head (rows 0-15), with the legs as in 0.2.1:
  - contact: the left leg cols 8-10 shifted 2 left, the right leg cols 12-15 shifted 2 right, the arms ±1 row;
  - pass: the legs together at cols 9-14, and rows 0-24 down one row;
  - frames 2 and 3 mirror the legs and arms of frames 0 and 1.

  Rows 30-31 are the shoes; each foot is a closed `L…L` run.
- **SIT[0..1]:** rows 0-23 as the anchor. Rows 24-29 are the lap drawn to the left (`LTTTTTTTTTTtL` at cols 1-13),
  rows 30-31 the shins and shoes at cols 1-6. The pen hand is at row 22 cols 0-1 `SS`, and the pen is col 0 rows
  20-22 `L`. SIT[1] moves the pen hand down one row. `headDy = 0` for both.
- **PANIC[0..1]:** the anchor, with the hands at rows 2-3 cols 2-3 and 18-19 (`SS`), the mouth row 12 cols 9-12
  `LMML`, and the eyes rows 9-11 as `WEW` ring shapes (cols 5-7 and 13-15). PANIC[1] is the hands one row lower.
- **LIE (30×14):**
  - the chibi head (anchor rows 0-15 compressed to 12 rows: drop rows 4 and 13) turned sideways at cols 14-29, rows
    1-12;
  - the eyes are closed (`ss` lines at rows 9-10);
  - the blanket region stays cols 0-13 (the painter's blanket rect `196,114,34,8` is unchanged).
- **ASSISTANT_DOZE:** the SIT[0] head moved down 6 rows and right 2 columns (resting on the desk), with the eyes
  closed.
- **EDITOR_IDLE[0..1], EDITOR_WALK[0..3]:** the anchor with:
  - the suit `G/g` in place of `J/j`;
  - a `W` collar at row 16 cols 9-12;
  - an `N` tie at col 11 rows 17-21;
  - glasses `P` across row 10 cols 5-16 (the eyes show through as `E` on row 9 and row 11);
  - a briefcase 6×7 at cols 18-23 rows 22-28 (`F/f`, `L` outline).

  The walk uses the WALK leg rules.
- **CAT_GROOM[0..1] (12×8):** CAT_SIT with the head lowered one row and a paw (`C`) raised at cols 2-3 row 4. Frame
  1 has the paw at row 3.
- **CAT_STRETCH (12×8):** the body stretched long and low: rows 4-7, cols 0-11, the head at cols 0-3 row 4, the tail
  up at col 11 rows 1-3.
- **FACES (14×4, overlay rows 9-12, cols 4-17 of the frame).** `.` is transparent. Each map fully repaints its
  cells. The closed-outline rule is exempt; the widths and keys are checked.

  | Mood | Row 9 | Row 10 | Row 11 | Row 12 |
  |---|---|---|---|---|
  | happy | `SSSSSSSSSSSSSS` | `SLESSSSSSSLESS` | `SSSSSSSSSSSSSS` | `BBSSSSMMSSSSBB` |
  | tired | `SSSSSSSSSSSSSS` | `SEESSSSSSSEESS` | `SSSSSSSSSSSSSS` | `SSSSSLLLLSSSSS` |
  | surprised | `SSEESSSSSSEESS` | `SEWESSSSSEWESS` | `SSEESSSSSSEESS` | `SSSSSSLLSSSSSS` |
  | sleepy | `SSSSSSSSSSSSSS` | `SLLSSSSSSSLLSS` | `SSSSSSSSSSSSSS` | `BBSSSSSMSSSSBB` |

  `neutral` has no overlay; the anchor's own face shows.
  - happy: ^^ eyes (an `L` arc over the `E`), a smile, blush;
  - tired: half-closed eyes, a flat mouth;
  - surprised: wide eyes, an open mouth;
  - sleepy: closed eyes, a small mouth.

## Execution setup (controller, before Task 1)

- [ ] Create the branch: `git checkout upgrade/0.3.0 && git checkout -b upgrade/0.4.0`.
- [ ] Copy this plan to `docs/plans/2026-09-28-chibi-cast.md` and commit it:
  `git add docs/plans/2026-09-28-chibi-cast.md && git commit -m "Plan 0.4.0: the chibi cast"`.
- [ ] Write the three subagent-driven-development helper scripts (`sdd-workspace`, `task-brief`,
  `review-package`) to `.superpowers/sdd-scripts/`, `chmod +x` them, and check that `.superpowers/` is git-ignored
  (the workspace script writes its own `.gitignore`).
- [ ] Run `.superpowers/sdd-scripts/sdd-workspace docs/plans/2026-09-28-chibi-cast.md` and create the ledger whose
  first line is `# SDD ledger — plan: docs/plans/2026-09-28-chibi-cast.md`.
- [ ] Run the preflight conflict scan (the table of shared files and interfaces per task pair) into the ledger.

Known shared files:
- `sprites.ts` (Tasks 1, 2, 3, 4);
- `render.ts` (Tasks 1, 3, 4, 5);
- `render.test.ts` (Tasks 1, 3, 4, 6);
- `fakeCanvas.ts` `sceneSnapshot` (Tasks 3, 5).

Model tiers:
- Tasks 1 and 2 (hand-drawn art from rules): the most capable model;
- Tasks 3-5: the standard model;
- Task 6: the standard model;
- task reviewers: the standard model;
- the final review: the most capable model.

---

### Task 1: The chibi mangaka

**Files:**
- Modify: `src/ui/scene/sprites.ts`: `MANGAKA_IDLE`, `MANGAKA_WALK`, `MANGAKA_SIT`, `MANGAKA_PANIC`, `MANGAKA_LIE`,
  and a new `HEAD_DY` table.
- Modify: `src/ui/scene/render.ts`: the manuscript in hand moves from `y+16` to `y+17` (the prop row is 22 now).
- Test: `src/ui/scene/__tests__/sprites.test.ts`, `src/ui/scene/__tests__/render.test.ts`,
  `src/ui/scene/__tests__/roomArt.test.ts` (the foot shadow pin).

**Interfaces:**
- Produces: the anchor as above. `HEAD_DY: { idle: readonly [0, 1]; sit: readonly [0, 0] }`, exported from
  `sprites.ts` for Task 3.

- [ ] **Step 1: Re-pin the tests to the chibi anchor (they must fail on the old art).**
  - In `sprites.test.ts`, replace the old cell pins with:
    - `MANGAKA_IDLE[0][2][8] === 'H'`, `[9][6] === 'E'`, `[10][7] === 'W'`, `[12][10] === 'M'`, `[31][6] === 'L'`,
      `[30][7] === 'O'`;
    - `MANGAKA_IDLE[1][0]` is all `.`, and `MANGAKA_IDLE[1][10][6] === 'E'`;
    - `MANGAKA_SIT[0][22][0] === 'S'`;
    - `MANGAKA_PANIC[0][2][2] === 'S'`;
    - `MANGAKA_LIE` is 30×14, and every row of `MANGAKA_LIE` passes `frameRules(…, 30, 14)`.
  - In `render.test.ts`, seated at `(132,67)`:
    - hair at `(140,69)`, skin `#f4cfa5` at `(140,80)`, eye `#1b1b1b` at `(138,76)`;
    - the chair `#4a4a55` at `(140,80)`'s old assertion becomes: the chair fill covering `(140,90)` precedes the hair
      fill at `(140,69)`.
  - Standing at `(170,81)`: hair `(178,83)`, shoe `#c0392b` at `(177,111)`.
  - Walking: re-derive the shoe pixel from WALK[0]'s row 30 by hand and pin it (and its mirror when facing 1:
    `x' = x + 23 - col`).
  - Panic: skin at `(134,69)` on late frame 0 (`PANIC[0]` row 2 col 2).
  - Bed at `(216,106)`: hair at the LIE head's first `H` cell, derived by hand from the new LIE map; the blanket
    `(200,116)` is still drawn after it.
- [ ] **Step 2: Run** `npx vitest run src/ui/scene/__tests__/sprites.test.ts src/ui/scene/__tests__/render.test.ts`.
  Expected: FAIL on the new pins (the old art).
- [ ] **Step 3: Draw the frames.**
  - IDLE[0] is the anchor verbatim. Draw the others by the per-frame rules above.
  - Keep `MANGAKA_*` names and frame counts, so `HUMAN_FRAMES` is unchanged in shape.
  - Move the manuscript `rawRect(x-8, y+17, 8, 10)` and its lines to `y+19` and `y+21`.
- [ ] **Step 4: Run the same command.** Expected: PASS. Then `npm test`: only the fill-count baselines may fail. If
  so, note the new counts in the report. Do not change the baselines here; Task 6 re-measures them. Mark the two
  baseline tests `it.skip` with the comment `// re-measured in Task 6`.
- [ ] **Step 5: Screenshot and commit.** Render the mangaka in the browser pane at 1280×720, then zoom (seated,
  standing, walking, panic, bed) with the gallery trick:
  `javascript_tool` imports `/src/ui/scene/render.ts?v=<now>` and `/src/test/fakeCanvas.ts`, then renders to 320×180
  canvases shown pixelated. Save the screenshots to the report. Commit: `Task 1: the chibi mangaka`.

### Task 2: The chibi editor, the assistants' doze and the avatar

**Files:**
- Modify: `src/ui/scene/sprites.ts`: `EDITOR_IDLE`, `EDITOR_WALK`, `ASSISTANT_DOZE`.
- Modify: `src/ui/scene/SpriteAvatar.tsx`: crop rows 0-15, cols 2-19, viewBox `0 0 18 16`.
- Modify: `src/ui/scene/render.ts`: the visitor props move to the new hand row (envelope `(x-2, y+20)`, the others
  `(x-2, y+18)`).
- Test: `sprites.test.ts`, `render.test.ts`, `spriteSvg.test.ts`.

**Interfaces:**
- Consumes: the Task 1 anchor.
- Produces: the editor at the same spots; the avatar is 18×16.

- [ ] **Step 1: Write the failing pins.**
  - Editor frame 0: `[2][8] === 'H'`, `[10][5] === 'P'`, `[17][11] === 'N'`, `[18][5] === 'G'`, `[24][20] === 'F'`.
  - In the render at `EDITOR_SPOT (198,85)`: hair at `(206,87)`, glasses `#3b3b45` at `(203,95)`, suit `#5b6270`
    at `(203,103)`; mirrored when facing 1: the suit at `(198+23-5, 103) = (216,103)`.
  - Envelope at `(196,105)`.
  - `ASSISTANT_DOZE[8][10] === 'H'`, with row 2 all `.` for cols 0-9.
  - In `spriteSvg.test.ts`: the crop of IDLE[0] rows 0-15, cols 2-19 gives row 0 as one rect
    `(4,0,10,1,'#1c1a26')` (anchor row 0 cols 6-15 minus col offset 2), and every rect fits in 18×16.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Draw and implement.** Draw the editor and the doze by the per-frame rules, update the avatar crop and
  the prop offsets.
- [ ] **Step 4: Run them.** Expected: PASS. Then run `npm test` (the baselines are still skipped).
- [ ] **Step 5: Screenshot and commit.** Zoom screenshots of the editor with each prop and of three assistants
  (seated and dozing), plus the Staff modal avatar. Commit: `Task 2: the chibi editor, doze and avatar`.

### Task 3: Moods and faces

**Files:**
- Create: `src/ui/scene/mood.ts`.
- Modify: `src/ui/scene/sprites.ts`: `FACES`, `MARKS`.
- Modify: `src/ui/scene/render.ts`: `Snapshot.cheer: boolean`, the face overlay, the mood marks.
- Modify: `src/ui/scene/StudioScene.tsx`: set `cheer` for 2400 ms on a fans or level pop.
- Modify: `src/test/fakeCanvas.ts`: `cheer: false`.
- Test: create `src/ui/scene/__tests__/mood.test.ts`; modify `render.test.ts`.

**Interfaces:**
- Consumes: `HEAD_DY` (Task 1); `LOW_STAMINA_THRESHOLD` from `src/sim`; `popsFor` / `PopKind` from `Pops.tsx`.
- Produces:
  ```ts
  export type Mood = 'neutral' | 'happy' | 'tired' | 'surprised' | 'sleepy'
  export interface MoodInput { home: boolean; editorHere: boolean; cheer: boolean; stamina: number; resting: boolean; night: boolean }
  export function moodOf(m: MoodInput): Mood
  export const CHEER_MS = 2400
  export function cheersFor(kinds: readonly PopKind[]): boolean   // true when a 'fans' or 'level' pop is among them
  ```
  `FACES: Record<Exclude<Mood, 'neutral'>, SpriteMap>` (14×4). `MARKS: Record<Exclude<Mood, 'neutral'>, SpriteMap>`
  (3×5, drawn at `(x+11, y-8)` in `PAL`):
  - sweat: `['.W.', 'WRW', 'WRW', '.W.', '...']` with `R` swapped for `#8fd3ff` in a `MARK_PAL`;
  - sparkle: `['.Y.', 'YWY', '.Y.', '...', '...']`;
  - `!`: the existing glyph;
  - `z`: the existing glyph.

  Colours are in a `MARK_PAL` of `{ W: '#f6f6f6', R: '#8fd3ff', Y: '#f5b700', L: '#1c1a26' }`.

- [ ] **Step 1: Write the failing mood tests (hand-derived table).**
  ```ts
  const base = { home: true, editorHere: false, cheer: false, stamina: 80, resting: false, night: false }
  expect(moodOf(base)).toBe('neutral')
  expect(moodOf({ ...base, editorHere: true, cheer: true, stamina: 5 })).toBe('surprised')
  expect(moodOf({ ...base, cheer: true, stamina: 5 })).toBe('happy')
  expect(moodOf({ ...base, stamina: LOW_STAMINA_THRESHOLD - 1 })).toBe('tired')
  expect(moodOf({ ...base, stamina: LOW_STAMINA_THRESHOLD })).toBe('neutral')
  expect(moodOf({ ...base, resting: true, night: true })).toBe('sleepy')
  expect(moodOf({ ...base, resting: true, night: false })).toBe('neutral')
  expect(moodOf({ ...base, home: false, editorHere: true })).toBe('neutral')
  expect(cheersFor(['money'])).toBe(false)
  expect(cheersFor(['money', 'fans'])).toBe(true)
  expect(cheersFor(['level'])).toBe(true)
  ```
  Also: every `FACES` map is 14 wide and 4 tall, and every key is in `PAL`.
- [ ] **Step 2: Write the failing render tests.** The seated mangaka is at `(132,67)`, and the overlay is at
  `(136, 76)`.
  - `cheer: true`: `covers(log, '#1c1a26', 137, 77)` (happy row 10 col 1 `L`) is later than the base eye fill at
    `(138,76)`, and a sparkle `#f5b700` is at `(144,59)`.
  - `stamina: 10`: a sweat `#8fd3ff` is at `(144,60)`, and there is no `!` `#e5484d` at `(144,59)`.
  - Neutral: nothing is painted at `(137,77)` after the base sprite's fill there.
  - Walking (anim 0) with `cheer: true`: no `FACES` fill (the overlay is skipped on walk frames).
  - An assistant at `(66,89)` with stamina 10: sweat `#8fd3ff` at `(78,82)` (the mark at `(x+11, y-8)`, row 1
    col 1).
- [ ] **Step 3: Run** `npx vitest run src/ui/scene/__tests__/mood.test.ts src/ui/scene/__tests__/render.test.ts`.
  Expected: FAIL.
- [ ] **Step 4: Implement.**
  - `mood.ts` holds the priority order from Decision 4.
  - In `render.ts`, after drawing a head-steady frame, draw
    `drawSprite(ctx, FACES[mood], flip ? x+6 : x+4, y+9+headDy, 4, PAL, flip)` when `mood !== 'neutral'`, then the
    mark.
  - Remove the low-stamina `!` (the sweat replaces it).
  - Seated working mangaka: `headDy = HEAD_DY.sit[...]`.
  - In `StudioScene.tsx`: when `popsFor(prev, next)` yields kinds where `cheersFor(kinds)`, set a `cheer` state to
    true and clear it after `CHEER_MS`, using a ref-held timer, cleared on unmount. Include `cheer` in the snapshot
    effect's inputs.
  - In `fakeCanvas.ts`, add `cheer: false` to `sceneSnapshot`.
- [ ] **Step 5: Run the tests, then commit.** Run `npx vitest run src/ui/scene` and then `npm test`: PASS. Commit:
  `Task 3: moods and faces`.

### Task 4: Idle moves

**Files:**
- Modify: `src/ui/scene/sprites.ts`: `MANGAKA_STRETCH`, `MANGAKA_SIP`, `CAT_GROOM`, `CAT_STRETCH` (added to
  `HUMAN_FRAMES` or the cat test list).
- Modify: `src/ui/scene/mood.ts`: `idleFrame`, `catFrame`.
- Modify: `src/ui/scene/render.ts`: use them.
- Test: `mood.test.ts`, `sprites.test.ts`, `render.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export type IdlePose = { set: 'breathe' | 'stretch' | 'sip'; index: 0 | 1 }
  export function idleFrame(frame: number): IdlePose   // Decision 6's 360-frame cycle
  export type CatPose = { set: 'sit' | 'groom' | 'stretch'; index: 0 | 1 }
  export function catFrame(frame: number): CatPose     // Decision 6's 480-frame cycle
  ```

- [ ] **Step 1: Write the failing tests.**
  - `idleFrame`:
    - `0` → `{breathe,0}`; `16` → `{breathe,1}`; `239` → `{breathe,0}` (floor(239/16) = 14, which is even);
    - `240` → `{stretch,0}`; `255` → `{stretch,1}`; `300` → `{sip,0}`; `315` → `{sip,1}`; `360` → `{breathe,0}`.
  - `catFrame`: `0` → `{sit,0}`; `360` → `{groom,0}`; `375` → `{groom,1}`; `420` → `{stretch,0}`; `480` → `{sit,0}`.
  - Every new frame passes `frameRules` (24×32; 12×8 for the cat).
  - Render at frame 300, standing (phase `drawing`, activity `rest`, so the mangaka stands): the mug `W` `#f6f6f6`
    covers `(170+9, 81+12)` = `(179,93)` (SIP row 12, col 9).
  - At frame 300 with phase `ready`: no mug; the manuscript is in hand.
  - At frame 0: the plain idle.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Draw the frames by the per-frame rules, and use `idleFrame`/`catFrame` in `render.ts`
  where `IDLE[frame/16 % 2]` and `CAT_SIT` were.
- [ ] **Step 4: Run the tests.** Expected: PASS. Then run `npm test`.
- [ ] **Step 5: Screenshot and commit.** Zoom screenshots of stretch, sip, cat groom and cat stretch. Commit:
  `Task 4: idle moves`.

### Task 5: Outfits by level

**Files:**
- Modify: `src/ui/scene/sprites.ts`: `OUTFITS`, `OUTFIT_PALS`, `outfitOf`.
- Modify: `src/ui/scene/render.ts`: `Snapshot.level`; the mangaka drawn with `OUTFIT_PALS[outfitOf(s.level)]`.
- Modify: `src/ui/scene/StudioScene.tsx`: a `level` selector (`s.game?.player.level ?? 1`).
- Modify: `src/test/fakeCanvas.ts`: `level: 1`.
- Test: `sprites.test.ts`, `render.test.ts`.

**Interfaces:**
- Produces:
  ```ts
  export type Outfit = 'hoodie' | 'cardigan' | 'blazer'
  export function outfitOf(level: number): Outfit      // 1-4 hoodie, 5-9 cardigan, 10+ blazer
  export const OUTFIT_PALS: Record<Outfit, Record<string, string>>   // PAL with J/j swapped (Decision 7)
  ```

- [ ] **Step 1: Write the failing tests.**
  - `outfitOf`: `1` and `4` → hoodie; `5` and `9` → cardigan; `10` and `30` → blazer.
  - `OUTFIT_PALS.hoodie` equals `PAL`. `OUTFIT_PALS.cardigan.J === '#c9a24a'` and `.j === '#a8832f'`.
    `OUTFIT_PALS.blazer.J === '#2e3a78'` and `.j === '#222b5c'`.
  - Render standing at `(170,81)`:
    - level 1: `#6f7a8c` at `(176,99)` (the anchor's row 18 col 6);
    - level 5: `#c9a24a` there;
    - level 10: `#2e3a78` there;
    - assistants are unaffected (level 10 with an assistant: its row 18 col 6 is still the look's `J`).
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** Build the palette tables once at module level. Pass the outfit palette to every mangaka
  `drawSprite` call (idle, walk, sit, panic, stretch, sip). LIE is unaffected (under the blanket).
- [ ] **Step 4: Run the tests.** Expected: PASS. Then run `npm test`.
- [ ] **Step 5: Screenshot and commit.** Zoom screenshots of the three outfits. Commit: `Task 5: outfits by level`.

### Task 6: Baselines, docs, and the whole look

**Files:**
- Modify: `render.test.ts` and `studioArt.test.ts`: un-skip the baselines, re-measure them, and write the docblock
  breakdown.
- Modify: `DESIGN.md` "The sprites" (proportions, faces, moods and marks, idle cycles, outfits, the avatar crop).
- Modify: `CLAUDE.md` scene paragraph (`mood.ts`, `FACES`, outfits, the new baselines).

- [ ] **Step 1: Measure.** Measure the reference scene (t 0.3) and `BARE_FULL` (t 0.9) with a throwaway test that
  throws the counts (`log.length`). Delete it after.
- [ ] **Step 2: Set the new baselines.** Put the new `BASELINE_FILLS` and `FULL_BASELINE` in the tests, with a hand
  breakdown of the delta (sprite runs per frame and overlay fills). Check the budgets are `×1.5`. Check the
  everything-plus-story scene stays under the new full budget. If it does not, stop and report (the art needs fewer
  runs); never raise the budget multiplier.
- [ ] **Step 3: Update the docs.** Update DESIGN.md and CLAUDE.md.
- [ ] **Step 4: Run the gate.** Run `npm run check` (exit 0) and `git diff --stat upgrade/0.3.0 -- src/sim` (empty).
- [ ] **Step 5: Check the whole look in the browser.** The live game at 1280×720 with the desk hidden:
  - each tier;
  - the mangaka seated working, tired, happy after a level-up, surprised by the editor;
  - the idle stretch;
  - 375×812 phone.

  Commit: `Task 6: baselines and docs for the chibi cast`.

### After Task 6 (controller)

- Final whole-branch review on the most capable model, with the ledger's deferred minors and parked items. One fix
  wave and one scoped re-review.
- Delete the SDD workspace.
- Use **finishing-a-development-branch**: push `upgrade/0.4.0`. The owner merges and runs `npm version minor`.
- List every `Ruling:` from the ledger in the final message.

## Verification (end to end)

1. `npm run check` exits 0: version sync, oxlint with warnings denied, `tsc -b`, all tests, the build, contrast.
2. `git diff --stat upgrade/0.3.0 -- src/sim` is empty.
3. `npm run balance -- 1 3` runs (the sim is untouched, so the rows match 0.3.0).
4. Browser pane, `dev` server:
   - the gallery render of every pose and mood;
   - the live game at 1280×720 with the desk hidden (D);
   - 375×812 phone.

   Zoomed screenshots go in the final message.
