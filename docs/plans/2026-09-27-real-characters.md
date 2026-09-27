# The Rising Mangaka 0.2.1: Real Characters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute with the subagent-driven-development skill, one implementer per task, a task review after each, a whole-branch review at the end. Steps use checkbox (`- [ ]`) syntax. Every task is test-first (test-driven-development skill): write the failing test, watch it fail, implement, watch it pass. Before any "done" claim, run the gate (verification-before-completion skill). Art tasks add a browser zoom screenshot to the review package.

**Goal:** Replace the 12×15 flat character sprites with 24×32 shaded, outlined pixel-art people (and a 12×8 cat) with real animation sets, drawn by hand as string maps in code, so the mangaka, assistants and editor read as people instead of aliens, without touching the sim or the actor logic.

**Architecture:** The actor system from 0.2.0 stays as is (`src/ui/scene/actors.ts` plans and steps a table of actors by state; `render.ts` paints from the table). Only the sprite maps, the palette, the sprite painter and the spots change: `drawSprite` becomes run-length (one `fillRect` per horizontal run of a colour), spots are re-derived so feet stay where they are, and the tests move from exact 1×1-pixel asserts to a `covers(log, colour, x, y)` helper. A `SpriteAvatar` component reuses the head rows for the Staff panel so avatars match the scene.

**Tech stack:** unchanged (React 19, TypeScript 6, Vite 8, Vitest 5, happy-dom, the recording fake canvas).

**Spec:** this document plus DESIGN.md "The studio in the scene" and CLAUDE.md. Branch `upgrade/0.2.1` from `upgrade/0.2.0` (the owner has not merged 0.2.0 yet; stacking keeps one review path). The plan is committed to `docs/plans/2026-09-27-real-characters.md` before Task 1.

---

## Context

After the 0.2.0 overhaul the studio is alive but the people in it are seven-colour 12×15 sprites: a face is two dots, there is no outline and no shading, and the owner rightly says they look like aliens. The reference the owner showed (a 32×48 sheet with idle, walk, run, jump and fall sets, glasses, an open hoodie over a striped shirt, dark outline, two-tone shading) is the target look. The owner has no spritesheet to supply, so the art is written as string maps in code (option 1 of the two offered on 2026-09-27).

## Decisions (made by Claude at the owner's request, 2026-09-27)

1. **Size 24×32** for people (head about 14 px wide in rows 0–13, torso rows 14–25, legs 26–31, feet on row 31), **12×8** for the cat. This is 3–4× the pixels of today and sits at a Kairosoft-like proportion against the room (a person is half the bookshelf's height). Furniture stays; only the chair backs, the assistants' desk and the bed's blanket are touched up.
2. **Feet stay put.** Every spot is re-derived from the old one so the character's feet land on the same floor pixel: `top − 17`, `left − 6`. The bed gets a dedicated 30×14 lying sprite instead of a head on the pillow.
3. **Run-length painting.** A 24×32 shaded sprite painted pixel by pixel would triple the frame's `fillRect` count; merging horizontal runs keeps the budget sane and the recording fake canvas unchanged.
4. **Palette convention:** uppercase base, lowercase shade of the same material, `L` outline; light from the top-left. Assistants keep their six looks through hair and shirt swaps with hand-picked shades.
5. **Animation sets:** idle 2 frames (breath), walk 4 (contact, pass, contact, pass), sit 2 (pen stroke), panic 2 (hands on head, shown in bursts while working on a late chapter), lie 1; the editor gets idle 2 and walk 4; assistants reuse the mangaka's frames plus a doze frame; the cat gets sleep, sit and a 2-frame walk. No jump or fall (nothing in the game triggers them).
6. **Style anchor.** The plan ships the complete idle frame and the cat frame as the style to copy; the implementer draws the other frames from the per-frame rules and the review checks them against zoomed browser screenshots, not only the tests.
7. **Assistants 20 px apart** (shoulders may overlap 4 px, drawn left to right) so three fit between the kitchenette and the mangaka's chair; their desk widens with them and is drawn before the page they work on (fixing a 0.2.0 bug where the desk painted over the page).
8. **Out of scope:** the sim, the actor state machine, the furniture beyond the three touch-ups, a spritesheet loader.

---

## Global Constraints

- Every task ends green: `npx tsc -b`, `npm test`, `npm run build`, `npx oxlint --deny-warnings`, `npm run contrast`. The final task also runs `npm run check` and `npm run balance -- 1 20` (identical to main).
- Nothing under `src/sim` changes. `actors.ts` changes only its spot constants (and `ASSISTANT_SEAT_X/Y`); `planActors`/`stepActors`/`settleActors` logic is untouched.
- `render(ctx, snap, t, frame)` stays a pure function of its arguments; nothing allocated per frame; sprite maps, palettes and prop maps are module constants; the fake canvas still supports only `fillStyle`/`fillRect`, so no `drawImage`, `translate`, `save` or offscreen canvases.
- Every frame of a set has the same width and height, a closed outline, no unknown palette key (never paints `#f0f`), and feet on row 31 (except the lying and doze sprites), enforced by a `frameRules` test over every exported set.
- Coordinates stay inside the phone crop x 24–295 and the canvas 320×180; the seated box becomes [132,155]×[67,98], the standing box [170,193]×[81,112], the editor's box [198,221]×[85,116]; furniture stays off them (studioArt.test's boxes are updated with the same numbers).
- Tests: hand-derived literals from the anchor maps; `covers(log, style, x, y)` replaces exact 1×1 asserts; baselines re-measured once, hard-coded, 1.5× budgets; no mirrored assertions.
- Reduced motion: frame 0 of every set, walking snaps (already handled by `stepActors`).
- UI rules: tokens in DOM components (the avatar SVG uses the sprite palette, which is exempt as sprite art); no emoji; sentence case.

---

## Reconciled facts (from the design pass; these override the decision numbers above where they differ)

1. `MANGAKA_BED = (216,106)`: a 30-wide lying sprite from 198 would end at 227, short of the pillow (x 232–245). At 216 the head (sprite cols 16–29) lies on the pillow and the body (cols 0–15) under a 34×8 blanket drawn after it at (196,114), so only head and shoulders show.
2. The seated sprite's rows 26–31 land at y 93–98, above the desk front (y 102–115), so the SIT frames draw those rows as the lap (thighs toward the desk); the chair seat is behind the lap.
3. Back/front pass rule becomes `front = a.y >= 75` (seat 67 back; stand 81, door 85, bed 106 front).
4. `CAT_BED = (196,118)` (foot of the bed, on the blanket's lower edge): (194,104) would sit inside the editor's new box. The cat is drawn after the mangaka's front pass (so after the blanket) and before the editor.
5. Run-length merging changes fill counts with no art change, so Task A re-measures the baselines; "unchanged" means the painted pixels, which the `covers` migration asserts.
6. The pen tablet (150–159 × 96–97) is inside the new seated box but under no lap pixel (lap cols 3–16 → x 135–148); studioArt.test gets a tablet exception box like the drafting table's.
7. Sprites move out of `render.ts` into a new `src/ui/scene/sprites.ts` (palette, maps, `frameRules`, `drawSprite`) so `SpriteAvatar` can import the head without the painter.

## Palette (`sprites.ts` `PAL`; uppercase base, lowercase shade; light from the top-left)

| key | hex | key | hex |
|---|---|---|---|
| `L` outline | `#1c1a26` | `T`/`t` trousers | `#2c2c3a` / `#1f1f2a` |
| `H`/`h` hair | `#2b2140` / `#1d1630` | `O`/`o` shoes | `#c0392b` / `#8e2a20` |
| `S`/`s` skin | `#f4cfa5` / `#dba57d` | `G`/`g` suit | `#5b6270` / `#454a55` |
| `E` eye | `#1b1b1b` | `N` tie | `#c0392b` |
| `W` eye white, teeth, shirt stripe | `#f6f6f6` | `P` glasses | `#3b3b45` |
| `M` mouth | `#c0392b` | `F`/`f` briefcase | `#6d4c33` / `#4e3622` |
| `R`/`r` shirt | `#3b6fd6` / `#2a52a6` | `C`/`c` cat | `#e39a4a` / `#c67d33` |
| `J`/`j` hoodie | `#6f7a8c` / `#525c6b` | `B` blush | `#e8a0a0` |

`looks.ts` adds `LOOK_HAIRS_SHADE = ['#1d1630','#3e2712','#0e0e0e','#551f1f','#27272f','#634a2b']` and `LOOK_SHIRTS_SHADE = ['#2a52a6','#983636','#2d7d50','#5a35c4','#b05a24','#1f6674']`. `ASSISTANT_PALS[i] = { ...PAL, H: LOOK_HAIRS[i], h: LOOK_HAIRS_SHADE[i], R: LOOK_SHIRTS[i], r: LOOK_SHIRTS_SHADE[i] }` (look 0 equals the mangaka's colours).

## Style anchor: `MANGAKA_IDLE[0]` (24×32, facing left; every row exactly 24 characters, which `frameRules` enforces)

```
........LLLLLLLL........   0
......LLHHHHHHHhL.......   1
.....LHHHHHHHHHhhL......   2
....LHHHHHHHHHHHhhL.....   3
....LHHHHHHHHHHHhhL.....   4
....LHHSSHHSSHHShhL.....   5  fringe
....LHSSSSSSSSSSShL.....   6
....LSSSSSSSSSSSSsL.....   7
....LSSEWSSSSEWSSsL.....   8  eyes (pupil left: facing left)
....LSSEESSSSEESSsL.....   9
....LBSSSSSSSSSSBsL.....  10  blush
.....LSSSSMMSSSSsL......  11  mouth
......LSSSSSSSSsL.......  12
.......LLsssssLL........  13  chin shadow / neck
.....LLJJJsssJJJjLL.....  14  shoulders
....LJJJJJRWRJJJJjjL....  15  open hoodie over a striped shirt
...LJJJJJJRWRJJJJJjjL...  16
...LJJJJJJWRWJJJJJjjL...  17
...LJJJJJJRWRJJJJJjjL...  18
...LJJLJJJWRWJJJLjjjL...  19  arms
...LJJLJJJRWRJJJLjjjL...  20
...LSSLJJJWRWJJJLSsjL...  21  hands (row 21 is the prop row)
....LLLJJJRWRJJJjLLL....  22
......LJJJJJJJJJJjjL....  23
......LjjjjjjjjjjjjL....  24  hem
......LTTTTTTTTTTttL....  25
......LTTTTLLTTTTttL....  26
......LTTTTL.LTTTttL....  27
......LTTTTL.LTTTttL....  28
......LttttL.LtttttL....  29
.....LOOOOOL.LOOOOoL....  30  shoes
.....LLLLLLL.LLLLLLL....  31  soles
```
About 440 pixels, about 210 runs.

`CAT_SLEEP` (12×8, curled, facing left, eyes closed):
```
............
.LL....LL...
LCcL..LCcL..
LCCCLLLCCCcL
LCcCCCCCCCcL
LCCCCCCCCCcL
.LCCCCCCCccL
..LLLLLLLLL.
```

**Frame rules** (`frameRules(map, w, h): string[]`, `[]` when it passes, enforced by test over every exported frame): every row exactly `w` wide; every key in `PAL` (never `#f0f`); the bottom-most non-`.` row is the last row; the outline is closed: on every row with content the first and last non-`.` character is `L`.

## Spots (feet stay put: top −17, left −6, except where reconciled)

| Spot | Old | New |
|---|---|---|
| `MANGAKA_SEAT` | (138,84) | (132,67) |
| `MANGAKA_STAND` | (176,98) | (170,81) |
| `MANGAKA_BED` | (233,102) | (216,106) |
| `DOOR_SPOT` | (260,102) | (254,85) |
| `EDITOR_SPOT` | (204,102) | (198,85) |
| `CAT_BED` | (194,104) | (196,118) |
| `CAT_KITCHEN` | (44,150) | (44,150) |
| `ASSISTANT_SEAT_X` / `_Y` | [74,89,104] / 106 | [66,86,106] / 89 |

`EDITOR_WALK_MS` stays 1400 (56 px). Boxes: seated [132,155]×[67,98], standing [170,193]×[81,112], editor [198,221]×[85,116]. Assistant 3 spans x 106–129 < 132; heads (y 89–102) sit over the bookshelf (drawn earlier).

---

## Execution setup (before Task A)

- [ ] `git switch upgrade/0.2.0 && git pull --ff-only`; clean tree; `npm test` green (1012 tests).
- [ ] `git switch -c upgrade/0.2.1`; copy this plan to `docs/plans/2026-09-27-real-characters.md`; commit "Add real-characters plan".
- [ ] Record `npm run balance -- 1 20` to a git-ignored scratch file for the byte-identical check at the end.
- [ ] Push the branch at the end of each task so CI runs.

---

### Task A: Run-length `drawSprite`, `covers` helpers, test migration (no art change)

**Files:** `src/ui/scene/render.ts`, `src/test/fakeCanvas.ts`, `src/ui/scene/__tests__/render.test.ts`, `studioArt.test.ts`, `src/ui/__tests__/StudioScene.test.tsx`.

```ts
// fakeCanvas.ts
/** Index of the LAST fill of `style` covering pixel (x, y), or -1. */
export function covers(log: readonly FillCall[], style: string, x: number, y: number): number
/** Index of the last fill of any style covering (x, y), or -1. */
export function coversAny(log: readonly FillCall[], x: number, y: number): number
// covering: c.x <= x < c.x + c.w && c.y <= y < c.y + c.h; scan from the end.
```
```ts
// render.ts (signature unchanged)
function drawSprite(ctx, map, x, y, rows = map.length, pal = PAL, flip = false, fromRow = 0)
// per row: scan c from 0; skip '.'; run = same key while line[c + len] === ch; fillStyle once;
// fillRect(flip ? x0 + n - c - len : x0 + c, y0 + r, len, 1). `glyph` untouched.
```
- **Tests first** (helpers): on the hand log `[{'#a',0,0,3,1},{'#b',1,0,1,1},{'#a',5,5,1,1}]`: `covers(log,'#a',2,0)` = 0, `covers(log,'#b',1,0)` = 1, `covers(log,'#a',1,0)` = 0, `covers(log,'#a',3,0)` = −1, `coversAny(log,1,0)` = 1, `coversAny(log,4,0)` = −1.
- **Run-length test** ("merges horizontal runs"): reference frame 0, the seated hero's row 0 `'...KKKKKK...'` is one fill `{ '#2b2140', 141, 84, 6, 1 }` and no separate 1×1 `#2b2140` at (142,84); the mirrored editor (facing 1 at (204,102)) row 10 `'..GGGGGGG.FF'` gives `{ '#6d4c33', 204, 112, 2, 1 }` and `{ '#5b6270', 207, 112, 7, 1 }`.
- **Migration** (every pixel assert becomes `covers(...) >= 0` / `=== -1`; order tests compare indexes):

  | Old | New |
  |---|---|
  | hero hair 1×1 at (141,84), chair before / desk after | `hair = covers(log,'#2b2140',141,84)`; `covers(log,'#4a4a55',134,90) < hair`; `covers(log,'#8b5a2b',116,98) > hair` |
  | standing hair (179,98) after the desk top | `covers(log,'#2b2140',179,98) > covers(log,'#8b5a2b',116,98)` |
  | walk shoes (151,111) / (159,111) / (160,111) | `covers(...) >= 0` at the same coordinates |
  | editor suit (206,112) / (213,112) / not (206,112) | `>= 0` / `>= 0` / `=== -1` |
  | sleeping hair (236,102), Z {242,94} | `covers('#2b2140',236,102) >= 0`, `covers('#2f5ecf',242,94) >= 0` |
  | editor hair (207,102); envelope, `!`, trophy rects | hair → `covers`; the rawRect literals stay `toContainEqual` |
  | assistant page and ink lines | unchanged (rawRects) |
  | assistant hair (76,107) / (77,106), Z (86,98) | `covers` ≥ 0 / === −1 |
  | clock rim (157,52) | `covers` ≥ 0 (hands stay rawRect literals) |
  | cat (195,104), (196,106) no `#1b1b1b`, (45,150), (46,152), (120,109) | `covers` ≥ 0 / === −1 |
  | studioArt.test tall-chair order `findIndex` at (141,84) | `covers(log,'#2b2140',141,84)` |
  | StudioScene.test `HAIR` at (207,102) | `covers(fake.log,'#2b2140',207,102) >= 0` / `=== -1` |
- **Baselines, hand-derived:** runs per sprite: HERO 12 rows 24 (was 90), HERO 11 rows 23 (was 84), CLOCK 21 (was 45), CAT 14 (was 15). Reference 444 − 66 − 61 − 24 − 1 = **292**; full 637 − 66 − 183 − 24 − 1 = **363**. Measure, hard-code, update the docblocks (budgets 438 and 544.5).
- **Acceptance:** scene tests green; `render` allocates nothing per frame; `covers` finds every pixel the old 1×1 tests named.

### Task B: Palette, shades, frame rules, the MANGAKA set, spots, chair and bed touch-ups, anchors, `late`

**Files:** create `src/ui/scene/sprites.ts`, `src/ui/scene/__tests__/sprites.test.ts`; modify `looks.ts`, `src/ui/__tests__/looks.test.ts`, `render.ts`, `actors.ts`, `actors.test.ts`, `studioArt.ts` (chairs), `studioArt.test.ts`, `render.test.ts`, `StudioScene.tsx`, `StudioScene.test.tsx`, `fakeCanvas.ts`.

```ts
// sprites.ts (pure, module constants)
export type SpriteMap = readonly string[]
export const PAL: Record<string, string>                       // the table above
export const ASSISTANT_PALS: Record<string, string>[]           // six, built once
export const MANGAKA_IDLE: readonly [SpriteMap, SpriteMap]
export const MANGAKA_WALK: readonly [SpriteMap, SpriteMap, SpriteMap, SpriteMap]
export const MANGAKA_SIT: readonly [SpriteMap, SpriteMap]
export const MANGAKA_PANIC: readonly [SpriteMap, SpriteMap]
export const MANGAKA_LIE: SpriteMap                             // 30×14
export const HUMAN_FRAMES: readonly SpriteMap[]                 // every 24×32 frame (grows in Task C)
export function frameRules(map: SpriteMap, w = 24, h = 32): string[]
export function drawSprite(ctx, map, x, y, rows?, pal?, flip?, fromRow?)   // moved from render.ts
// actors.ts: the spots table; render.ts: Snapshot gains `late: boolean`
```
- **Frames relative to the anchor:** `IDLE[1]`: rows 0–24 one row lower (the hem lands on row 25; legs 26–31 unchanged). `WALK[0]` (contact): left leg (cols 6–11, rows 26–31) shifted 3 left (cols 3–8), right leg (cols 13–19) 2 right, left arm (cols 3–6, rows 19–21) 1 forward, right arm 1 back; `WALK[1]` (pass): legs together under the torso (cols 8–15), rows 0–25 one row lower, row 26 dropped so feet stay on 31; `WALK[2]`: contact with the legs swapped; `WALK[3]` = `WALK[1]` with the arms swapped. Frame `floor(anim/100) % 4`. `SIT[0]`: head rows 0–13 as the anchor; rows 26–29 the lap: `T` cols 3–16 with `L` ends, rows 30–31 `L` under it; the leading arm along rows 19–22 out to col 0 with the hand `SS` at cols 0–1 row 21 and the pen `L` 1×3 at col 0 rows 20–22; `SIT[1]`: pen at rows 21–23 and the hand one row lower (the stroke). `PANIC[0]`: arms up, hands `SS` at rows 3–4 cols 3–4 and 19–20 beside the head, forearms `J` rows 5–14 at cols 3 and 20, mouth row 11 `LMML` cols 9–12 with `WW` row 10 cols 10–11; `PANIC[1]`: hands one row higher. `LIE` (30×14): head = anchor rows 0–13 cols 4–19 placed at cols 14–29, eyes rows 8–9 as `ss` lines, body cols 0–13 rows 4–11 as the hoodie's shoulders (`J`/`j`, `L` outline).
- **render.ts painters:** `front = a.y >= 75`. Seated: `working && s.late && frame % 240 < 40 ? PANIC[floor(frame/8)%2] : SIT[working ? floor(frame/8)%2 : 0]`; low-stamina `!` at `(x+11, y−8)`. Standing: `IDLE[floor(frame/16)%2]`; ready manuscript rects at `(x−8, y+16, 8, 10)` etc. (leading hand row 21); `!`/`?` at `(x+11, y−8)`. Walking: `WALK[...]` flipped when facing 1. Sleeping: `LIE` at (x, y), then blanket `rawRect(196,114,34,8,'#c94b4b')` + fold `rawRect(196,114,34,2,'#a83c3c')`, Zz at `(x+18+3i, y−6−4i)`. The old blanket rect and `HEAD_SLEEP` go.
- **Furniture:** stock chair back `rect(ctx,72,42,16,12,'#4a4a55')` (canvas 136–151 × 78–89) just before the stock seat; `tallChair` back → `rect(72,38,16,16,METAL_DARK)` + mesh `rect(73,39,14,14,MESH)` (canvas 74–89); `EQUIPMENT_REGION.chair` → `[132,156,74,108]`.
- **StudioScene:** `late = useStore((s) => (s.game ? chapterDeadline(s.game)?.status === 'late' : false))` (check the real return shape in `src/sim` before writing the selector); bubble anchor `(a.x+12, a.y−2)`; pop anchor `(m.x+12, m.y−4)`; `fakeCanvas.sceneSnapshot` default `late: false`.
- **Tests first.** looks.test: `relLum(hex)` (sRGB linearised, 0.2126/0.7152/0.0722) and `lum(SHADE[i]) < lum(BASE[i])` for the six hairs and six shirts; equal lengths. sprites.test: `frameRules(f)` is `[]` for every `HUMAN_FRAMES` entry, `MANGAKA_LIE` with (30,14) and the cat frames with (12,8); a hand-broken map (row 5 shortened to 23 chars, a `#` key, an empty last row) returns three violations. actors.test literals: the spots table; `EDITOR_WALK_MS` 1400. render.test (seat (132,67); anchor row 2 col 8 = `H`): `hair = covers(log,'#2b2140',140,69) >= 0`; `covers(log,'#4a4a55',140,80) < hair` (the new chair back); `covers(log,'#8b5a2b',116,98) > hair`; skin `covers('#f4cfa5',140,74)` (row 7 col 8). Standing (`phase:'idle'`, (170,81)): hair (178,83); shoe row 30 col 6 → `covers('#c0392b',176,111)`. Walking at (150,81) anim 0 facing −1: contact shoe cols 3–8 → `covers('#c0392b',153,111) >= 0`; anim 100 (pass, cols 8–15) → `=== -1`; anim 0 facing 1: col 3 mirrors to 20 → (170,111). Rest: hair `covers('#2b2140',236,108)` (LIE row 2 col 20); blanket `covers('#c94b4b',200,116) > hair`; Z `covers('#2f5ecf',235,100)`. Panic: `{ late: true }` frame 0 → `covers('#f4cfa5',135,71) >= 0` (row 4 col 3 hand); frame 40 → `=== -1`; `{ late: false }` frame 0 → `=== -1`. studioArt.test: `SEATED [132,155,67,98]`, `STANDING [170,193,81,112]`, `EDITOR_SPOT_BOX [198,221,85,116]`, drafting-table exception `[132,155,67,97]`, tablet exception `[132,149,67,98]`, Zz `x >= 234`, the tall-chair order test via `covers('#2b2140',140,69)`. StudioScene.test: `late` through a serial game (a `serial` project with `nextDueDay` in the past, built the way `src/sim/__tests__` builds one) rendered `running` under reduced motion → `covers(fake.log,'#f4cfa5',135,71) >= 0`.
- **Baselines:** reference ≈ 292 − 24 + 210 ≈ **480**; full ≈ 363 − 24 + 210 ≈ **550** (assistants still old here). Measure and hard-code.
- **Acceptance:** all green; nothing allocated per frame; the frame-rules test covers every exported frame.

### Task C: Assistants (spacing, desk, stools, doze, page fix), the editor set, props, the cat

**Files:** `sprites.ts` (+`ASSISTANT_DOZE`, `EDITOR_IDLE[2]`, `EDITOR_WALK[4]`, `PROP_ENVELOPE` 6×4, `PROP_LETTER` 5×6, `PROP_CONTRACT` 5×7, `PROP_TROPHY` 5×6, `CAT_SLEEP`, `CAT_SIT`, `CAT_WALK[2]`, `PROP_PAL = { W:'#fdfcf7', l:'#b8b2a5', R:'#3b6fd6', M:'#e5484d', Y:'#f5b700', F:'#8b5a2b' }`), `render.ts`, `sprites.test.ts`, `render.test.ts`, `studioArt.test.ts`, `StudioScene.test.tsx`.
- **Editor frames:** the anchor with `G/g` for `J/j`, a `W` collar on row 14 cols 10–12, tie `N` at col 11 rows 15–18 (in place of the stripe), glasses row 8: `P` at cols 6, 9, 12, 15 and the bridge cols 10–11; shorter hair (rows 0–4, `h` shade); the briefcase `F/f` 6×7 in the trailing (right) hand: cols 18–23, rows 21–27, outline `L`. `EDITOR_WALK` follows the walk rules; the briefcase moves with the trailing arm. `ASSISTANT_DOZE`: head rows 0–13 shifted down 6 and right 2, eyes closed (`ss`), arms folded across rows 19–21 cols 4–19 `J`.
- **Assistants in render:** stools `rawRect(seat+7, 118, 10, 4, '#4a4a55')` ×n, then each assistant (`SIT` frames with `ASSISTANT_PALS[look]`, `DOZE` when sleeping, Z at `(x+18, y−6)`), **then** the desk `rawRect(62,120,8+20n,3,'#8b5a2b')`, `rawRect(62,123,8+20n,9,'#70461f')`, **then** each working assistant's page `rawRect(x+3,120,6,4,PAPER)` + `round(progress*3)` lines `(x+4,121+k,4,1,'#b8b2a5')` (the desk-over-page bug fixed). Feet on row 31 (y 120) sit under the desk.
- **Props** drawn with `drawSprite(..., PROP_PAL)` in the leading hand: envelope at `(x−2, y+19)`, letter and contract at `(x−2, y+17)`, trophy at `(x−2, y+17)`; `!` at `(x+11, y−8 − floor(frame/16)%2)`. Cat: `CAT_SLEEP` sleeping, `CAT_SIT` sitting, `CAT_WALK[floor(anim/125)%2]` walking, drawn after the mangaka's front pass and before the editor.
- **Tests first** (seat 0 at (66,89), look 0): hair `covers('#2b2140',74,91)`; page `covers('#fdfcf7',70,121)`, lines at y 121–122 (`x === 70 && w === 4`), progress 1 → three, 0 → none, paused → no page; the desk top `covers('#8b5a2b',66,120)` < page index; three assistants → desk `{ '#8b5a2b', 62, 120, 68, 3 }`, one → width 28; stool `{ '#4a4a55', 73, 118, 10, 4 }` before the hair. Rest: hair at (74,91) `=== -1`, doze hair `covers('#2b2140',76,97) >= 0`, Z `covers('#2f5ecf',85,83)`. Editor at (198,85) facing −1: suit `covers('#5b6270',202,105)` (row 20 col 4), hair (206,87), glasses `covers('#3b3b45',204,93)` (row 8 col 6), briefcase `covers('#6d4c33',218,109)` (row 24 col 20); facing 1: suit at (219,105) present, (202,105) absent. Props: envelope `covers('#fdfcf7',198,105)`, trophy `covers('#f5b700',198,103)`, `!` `covers('#e5484d',209,77)` at frame 100 and (209,76) at frame 16; none while walking. Cat: `covers('#e39a4a',197,121)` (SLEEP row 3 col 1 at (196,118)), no `#1b1b1b` inside [196,207]×[118,125]; rest → `CAT_SIT` eye `covers('#1b1b1b',47,153)` (define SIT's eye at row 3 col 3); walk anim 125 → a defined WALK[1] paw pixel; clear-of-boxes test with the 12×8 extent against the four new boxes. StudioScene.test `HAIR` → `covers(fake.log,'#2b2140',206,87)`.
- **Baselines:** reference ≈ 480 − 23 + 210 + 1 ≈ **670**; full (three assistants, editor with a contract) ≈ 550 − 69 + 630 + 3 + 210 + prop ≈ **1330**, budget ≈ 2000; the full scene must stay under about 1500 fills.
- **Acceptance:** all green; every new frame passes `frameRules`; the page is visible over the desk.

### Task D: `SpriteAvatar`

**Files:** create `src/ui/scene/spriteSvg.ts`, `src/ui/scene/SpriteAvatar.tsx`, `src/ui/scene/__tests__/spriteSvg.test.ts`; modify `src/ui/panels/StaffModal.tsx`.
```ts
export interface SvgRect { x: number; y: number; w: number; h: number; fill: string }
/** Run-length rects of `map` inside rows [r0, r1] and cols [c0, c1] (inclusive), origin at (c0, r0). */
export function spriteRects(map: SpriteMap, pal: Record<string, string>, win: { rows: [number, number]; cols: [number, number] }): SvgRect[]
export function SpriteAvatar({ look }: { look: number }): JSX.Element
// <svg className="avatar" viewBox="0 0 16 16" width={48} height={48} aria-hidden shapeRendering="crispEdges">
//   <rect width=16 height=16 fill="var(--paper-2)"/> then AVATAR_RECTS[look % 6] (spriteRects of MANGAKA_IDLE[0], rows [0,15], cols [4,19], ASSISTANT_PALS[look]) built once at module load
```
- **Tests first:** `spriteRects(['.AAB','BB..'], { A:'#111', B:'#222' }, { rows:[0,1], cols:[0,3] })` → `[{1,0,2,1,'#111'},{3,0,1,1,'#222'},{0,1,2,1,'#222'}]`; window `{ rows:[1,1], cols:[1,3] }` → `[{0,0,1,1,'#222'}]`; the anchor head row 0 (`LLLLLLLL` cols 8–15) → one rect `{4,0,8,1,'#1c1a26'}`; every rect inside 16×16. StaffModal's `Avatar` becomes `<SpriteAvatar look={a.look} />`; `StaffModal.test.tsx` unchanged and green.

### Task E: Docs, baselines, browser check, close-out

- DESIGN.md "The studio in the scene": the sprite paragraph (24×32 frames, the palette convention with the shade rule, the frame sets and timings, the 12×8 cat, the 30×14 lying sprite, `late` → panic for 40 of every 240 frames), the spots table, the assistants' desk (x 62, width 8+20n, page in front), the cat's bed spot, the new baselines and budgets; fix the two stale sentences the exploration found (the doorway's coordinates; what the full baseline scene contains). CLAUDE.md scene sentence: `sprites.ts` (24×32 string maps, run-length `drawSprite`, the palette convention, `frameRules`), `Snapshot.late`, `covers` in `fakeCanvas.ts`.
- Gate: `npm run check`; `git diff main --stat -- src/sim` empty; balance rows identical.
- Browser check (`preview_start` name `dev`, 1280×800, zoom screenshots): the seat while drawing; the stand between projects; the bed on a rest day; the assistants with one hire; the editor with a manuscript ready; the cat in the kitchen. Confirm closed outlines, feet on the floor line, the page visible on the assistants' desk, no magenta; both themes. Fix anything off as a commit on the branch, re-run the gate, push.
- Leave a note for the owner: 0.2.1 stacks on 0.2.0; merge both, then `npm version minor`.
