# The Rising Mangaka: tutorial, cast redraw, room polish (0.8.0 → 0.10.0 after the 0.7.0 tag)

## Context
0.7.0 shipped with generated rooms and props, but a tester found the game unintuitive: unclear buttons, no sense of
what to do next. Today "tutorial" is one coach line per phase (`CoachNote`, `COACH[phase]`) and `tutorialStep` is only
on/off. Separately, the characters still look like 0.4.0 next to the new room (two generation rounds lost to the
hand-drawn frames), and the room shells have three visible flaws: a banded light pool on the apartment and loft walls,
the flat's wallpaper stripes lost to colour snapping, and generated floors in perspective under a flat front row.

Owner decisions: a **guided first career** (the editor walks a new player through their first one-shot inside the
real game, skippable, replayable), a **hand redraw of the cast by Claude** in the existing string-map format using the
generated sheets as reference, and **room polish** with regenerated walls (HF quota and Higgsfield credits are back).

Three releases, one branch each (`upgrade/0.8.0-tutorial`, `upgrade/0.9.0-cast`, `upgrade/0.10.0-rooms`; package.json
is at 0.7.0, the owner bumps). Each release: subagent-driven tasks with test-driven development, a task review, a
final whole-branch review, `npm run check`, and a browser check at 1280x720 and 375x667 in both themes.

---

## Release A: the guided first career (branch `upgrade/0.8.0-tutorial`)

### Steps (`src/state/tutorial.ts`, pure, no React)
`STEPS: { id, anchor, line, completes, holds, phase }[]`; `tutorialStep` is the index, -1 done. A step whose anchor
is not in the DOM **waits silently** (nothing rendered) until it appears.

| # | id | anchor `data-tutorial=` on | Editor's line (sentence case, <= 2 sentences) | Completes |
|---|---|---|---|---|
| 0 | plan | "Plan a new manga" button (`StatusCard.tsx:48`) | Everything starts with a manga. This button plans one: a genre, a theme, and who it is for. | `wizard-opened` |
| 1 | wizard | the wizard's `.steps` nav (`NewMangaWizard.tsx:80`) | Pick a genre, a theme and an audience. The last page shows what you already know about the pairing; the Notebook fills in after each poll. | `project-started` (closing without one steps back to 0) |
| 2 | today | Activity segment (`statusParts.tsx:28`) | Draw fills pages while the clock runs and burns stamina. Rest refills it; Job pays the rent when money is short. | Next |
| 3 | stamina | stamina badge (`TopRight.tsx`) | Stamina is up here. Below 30, pages come at half speed; at zero you collapse into bed, so rest before that. | Next |
| 4 | clock | speed buttons (`TopLeft.tsx:28`) | Nothing happens until time runs. Play or Space starts it, 1 to 3 set the pace, and the game pauses itself whenever something needs you. | `clock-run` (speed > 0) |
| 5 | pitch | "Pitch to a magazine" (`StatusCard.tsx:106`; absent while drawing, so the step waits) | Twenty pages, and the clock stopped for you. Pitch it: each magazine has its own readers, pay and rivals. | `submit-opened` |
| 6 | forecast | `.mag-list` (`SubmitModal.tsx:64`) | Each card is a forecast: likely rank, pay, and whether its readers match your audience. Pick one and submit. | `submitted` (closing steps back to 5) |
| 7 | why | Score breakdown section (`ResultsModal.tsx:195`; waits through the poll days and the editor's walk) | Here is the why: every bar is a part of your score. Weak bars tell you what to train or change next time. | `result-dismissed` |
| 8 | notebook | rail Notebook button | Your Notebook now holds what this poll taught you. Read it before planning the next manga. | Next |
| 9 | stats | rail Stats button | Stats spends the skill points you earn on art, story or pacing. The badge counts points waiting. | Next |
| 10 | rail | the rail nav | Staff hires assistants, Studio upgrades the room, Trips train you away from the desk, Career tracks your goals. Every window pauses the clock. | Next |
| 11 | goal | NextGoal card (`NextGoal.tsx`) | That is the loop. Your next goal waits on the desk, and I will be at the door whenever something needs you. | Done (-1) |

`stepAfter(step, trigger)` is pure; triggers: `wizard-opened`, `wizard-closed`, `project-started`, `clock-run`,
`submit-opened`, `submit-closed`, `submitted`, `result-dismissed`, `next`.

### State (`src/state/store.ts`, `saveFile.ts`)
- Keep the persisted field name `tutorialStep` (slots, `parseSave`, fixtures unchanged); meaning becomes 0..11 / -1.
  `SAVE_VERSION` stays 2.
- Actions: `advanceTutorial(trigger)` (replaces `finishTutorial`), `skipTutorial()`, `replayTutorial()` (from
  Settings; refused while a result or offer is pending; sets the first step matching the current phase, speed 0).
- Hooks: a store helper `withTutorial(patch, trigger)` used by `apply` (startProject → `project-started`,
  submitProject → `submitted`, dismissResult → `result-dismissed`), `openModal`/`closeModal` (wizard and submit),
  `setSpeed`/`togglePause` (`clock-run`). When the new step `holds`, apply the **same decision-pause patch `tick`
  uses** (extract `pauseForDecision` from store.ts:498-501: `speed: 0, deskHidden: false`). No new clock flag; speed
  controls stay live (pillar: never interrupt). `startProject`'s auto-resume is overridden to a hold while the
  tutorial is at step 1→2.
- Migration, pure `resumeTutorialStep(step, game)` in `merge` and `loadSave`/`parseSave`: -1 stays; 0 stays only for a
  fresh career (day 0, no history, no project), else -1; 1..11 keep when `STEPS[n].phase` matches `getPhase(game)`,
  else the next later matching step, else -1.
- `ResultsModal.tsx:125` stops calling `finishTutorial`.

### UI (`src/ui/TutorialGuide.tsx`, `src/styles/tutorial.css`)
- Mounted in `App.tsx` after `<Toasts />`, only when `tutorialStep >= 0 && game && !readOnly`.
- Anchor lookup by `document.querySelector('[data-tutorial="…"]')` in a layout effect, re-measured by a
  `ResizeObserver` on `document.body`, a capture-phase scroll listener and one rAF after each store update.
- **Inside an open `<dialog>`** (steps 1, 6, 7): portal into `anchor.closest('dialog')` (the top layer beats z-index
  and the page is inert), draw only the ring (the backdrop already dims), positions relative to the dialog rect;
  appended after `.modal-body` so `Modal`'s autofocus never picks the guide's buttons.
- **Over the studio**: a fixed layer with `pointer-events: none`, a hole element at the anchor rect using
  `box-shadow: 0 0 0 100vmax var(--scrim)` and a `var(--gold)` ring. The dim does not swallow clicks: hotkeys and the
  rail stay usable; steps complete only on real triggers.
- Bubble: `.tutorial-bubble pixel-bubble` with `data-who="editor"`, a "Editor" label, the line, Skip (`btn ghost sm`,
  "Skip the tutorial") and Next/Done (`btn primary sm`; action steps show Skip only). `role="note"`,
  `aria-live="polite"`. Above the anchor, below when no room, clamped to the viewport. Enter = Next when the bubble has
  focus; no global Esc. 44px targets.
- Phone (<= 640): `anchor.scrollIntoView({ block: 'center' })` on step entry; the bubble docks as a bottom sheet;
  toasts move up while `.app[data-tutorial]` is set.
- Tokens (both themes): `--scrim`, `--z-hud: 5`, `--z-toast: 40`, `--z-guide: 50`; `app.css:27` uses the token.
  Reduced motion already zeroes transitions.
- The editor's presence: add `'tutorial'` as the lowest-priority `VisitorReason` (`visitor.ts`, prop none, greeting
  empty); `StudioScene` resolves it when no other reason applies and `tutorialStep >= 0`, so he walks to
  `EDITOR_SPOT` on step 0 (knock plays) and leaves when the tutorial ends. Lines live in the guide's bubble, not over
  his head. `StudioScene.tsx:274` hides the scene greeting while a step shows.
- Settings: a "Help" section with "Replay the tutorial" (hidden in read-only). Remove `CoachNote`, `COACH` and
  `.coach` CSS (`hud.css:63-75`); the NextGoal card is the residual "what next".

### Tests
- `src/state/__tests__/tutorial.test.ts`: the full happy path through store actions; step-back on `wizard-closed`;
  skip; replay from a mid-career fixture; `resumeTutorialStep` cases (old 0 fresh → 0; old 0 at day 40 → -1; -1 → -1;
  5 with an idle game → -1). `saveFile.test`: step 6 round-trips.
- `src/ui/__tests__/TutorialGuide.test.tsx` (happy-dom): render App at each step with a fixture in the right phase
  (`createGame`, `startProject`, `withReadyOneShot`, `withPendingResult` + `stubReducedMotion(true)`) and assert every
  `STEPS[i].anchor` is found; Skip sets -1; Next advances; the bubble portals into the open dialog on steps 1, 6, 7.
- `Shell.test.tsx`: dock DOM order still holds with the guide mounted after the rail. `StatusCard.test` drops the
  coach assertions; `ResultsModal.test:104` expects step 8 from step 7; `hotkeys.test`: `l`, `b`, Space work under
  the overlay.

### Docs
DESIGN.md: a "Tutorial" section after "Auto-pause rules" with the steps table and the waiting rule; a Rulings entry
(2026-10-02: a tutorial step is a decision: entering one pauses the clock the way `tick` does and never locks the
speed controls; steps wait silently while their control is off screen; `tutorialStep` is the step index per career).
CLAUDE.md: `tutorialStep` meaning, `TutorialGuide` and `data-tutorial` anchors ("a renamed control keeps its anchor"),
the z-index tokens.

---

## Release B: the cast redraw (branch `upgrade/0.9.0-cast`)

Hand-drawn string maps in `src/ui/scene/sprites.ts`, using `art/raw/sprites/*.png` only as reference for
proportions, colours and poses. One pose set per task, one commit per set after its gate.

**Contracts that do not move:** frame sizes and counts (21 human 24x32, lie 30x14, 7 cat 12x8), `frameRules` on
all, `faceRules` on the breathing idle, both sit frames and the sip (stretch and editor stay exempt as today), FACES at
rows 9-12 cols 4-17, mark slot rows 0-2 cols 20-22, `HEAD_DY`, `breathOf(IDLE[0]) === IDLE[1]`.
**Ruling: `ANCHOR_HEAD` is untouched.** The sheet's 2:1 head cannot fit the FACES/mark/avatar-crop contract, and the
hand-drawn head is the part that already reads. Staff portraits do not change. All mangaka sets are body redraws.

Redraw briefs:
- **Mangaka body** (idle/breath, stretch, sip, walk, sit, panic, lie): torso `J`, sleeves and hood shadow `j` (the
  darker sleeves the sheet has), so `OUTFIT_PALS` gives darker gold/navy sleeves for free; trousers `F/f` (PAL brown)
  instead of near-black `T/t`; shoes `O/o`; the chest keeps an `R` V under the collar rows 16-18 (assistants' shirt
  colour still shows) and the `Y` column rows 18-22 reads as a drawstring in the hoodie and a tie in the other
  outfits; hands `S` with one `s` shade; arms 3 wide so sleeve and hand are separate runs.
- **Walk**: keep the timing (contact, pass a row lower, contact legs swapped, pass). Test: frames 1 and 3 start with a
  blank row and rows 26-29 form one run; frames 0 and 2 have a leg gap and differ in which leg leads (no slide).
- **Sit**: rows 0-15 and 25-31 identical across the pair; only the pen hand rows 20-24 moves (no shoe blink; test
  `SIT[0].slice(25)` equals `SIT[1].slice(25)`).
- **Panic**: keep the 0.5.0 hands-on-head layout; raised arms become `j` sleeves with `S` hands.
- **Lie** (30x14): same layout, shoulder band `j` over `J`.
- **Doze**: stays generated; a manifest `remap` `J -> j` on its folded arms (rows 27-30) so it matches the new sleeves;
  regenerate; re-measure its exact run count (expect about 100).
- **Editor**: suit `G/g` recoloured in `PAL` to the sheet's navy `#3a3d4c`/`#2c3656` (both already in the base
  palette, distinct from the level-10 blazer), trousers in `G/g`, shoes `E`, white collar `W`, tie `N`, glasses as two
  4x3 `P` frames with a one-cell bridge and `E` eyes inside (fixing the "dark mask"), briefcase `F/f` 6x7 in the
  trailing hand, a row lower on the pass frames.
- **Cat** (12x8): 2-3 `c` stripe cells on the back and tail in every frame but sleep, `Q` chest, `E` eye, 1-px ears.

**Run-count caps** at 1.3x today per frame, as a `RUN_CAPS` table in `sprites.test.ts` (idle 253/249 from 195/192,
sit 239/243 from 184/187, panic 330/325, lie 93, doze 130, editor idle 263/254, editor walk 265/245/266/245, cat
sleep 40, sit 44, walk 48/45, groom 42/45, stretch 32, and so on). The caps keep every fill baseline inside its 1.5x
budget by construction (worst cases: render 673 → <= 792, studioArt 1079 → <= 1309, rest 509 → <= 570); the
exact-count tests are re-measured and their by-hand terms updated.

**Method**: a new `scripts/spriteSheet.ts` (`npm run sprites -- <out.png> [--walk]`, sharp) renders every frame at 8x
in the three outfits and three assistant looks with each mood's face and mark, the walk as a strip, next to the
current frame (from `git show HEAD:src/ui/scene/sprites.ts`), into the scratchpad. The implementer edits the map,
runs it, reads the PNG, repeats. Gate per set: that sheet, then the dev preview zoomed on the actor's spot.
Order: mangaka (idle body; stretch/sip/walk; sit/panic/lie), editor, cat.

**Tests and docs**: caps, walk contact, sit no-blink, the faceRules set, PAL `G/g` values, the doze remap; render and
studioArt exact counts re-measured; `art.test` doze remap check. DESIGN.md "The sprites" (the redraw, the
`ANCHOR_HEAD` ruling), CLAUDE.md baselines, and the stale `MARKS` comment at `sprites.ts:902` (it is `(x+20, y-2)`).

---

## Release C: room polish (branch `upgrade/0.10.0-rooms`)

**Ruling: generated walls only, code-drawn floors.** Three regenerated wall images.
1. **Banded light pool** (apartment, loft): regenerate with the lighting clause replaced by "perfectly flat even
   lighting, no vignette, no gradient, no light pool, uniform wall colour". Fallback only if that fails: a
   `wall.flatten` pipeline knob snapping wall-row pixels within a chroma radius of the wall's modal colour.
2. **Flat stripes**: regenerate with "bold two-tone vertical stripes, a saturated teal stripe on a pale grey-teal
   ground"; raise the flat's `lightness` from 0.03 to about 0.15 (stripes differing only in lightness collapse at
   0.03); add one mid teal (about `#6f9a90`) to `SCENE_ADDITIONS` in `palette.ts`, used literally in `roomArt.ts`'s
   code-drawn flat wall as the stripe colour so the palette rule holds and the fallback matches (same fill count,
   under `roomArt.test`'s 84 cap).
3. **Perspective floors**: manifest `floor: "code"`: the pipeline keeps rows above `seam.src` only (`wallOnly` in
   `pixelOps.ts`, area-sampled to `native: [320, 114]`); `render.ts` draws a ready room at `0,0,320,114` and the
   night dim over the same rows; `roomArt.ts` splits `TIER_ROOM` into `TIER_WALL`/`TIER_FLOOR` so the tier's flat
   front-on floor always paints (the rug and tatami edges return).

**Prompts** reuse each room's description with the lighting clause replaced and "the floor may be cut off" added;
16:9, 32 colours, scene palette. **Hosts**: the HF Space first (seeded, 9/day covers 3 plus rerolls), Higgsfield
(0.15 credits each) if the quota fails. Budget: 3 images, up to 6 rerolls.

**Manifest and tests**: per room a new seed/job, prompt, `floor: "code"`, `native: [320,114]`, re-measured
`seam.src` and `crop`, `lightness` rechecked. `art.test`: room native 320x114 when `floor` is code, caps unchanged.
ART baselines rise by the code floor's fills (about +35: 521 → ~556, 928 → ~963, re-measured exactly); 673/1079/509
unchanged. Gate per shell: a 4x composite of the shell with the code floor, front row and standing mangaka; then the
preview at both sizes, both themes, each tier, day and night; wall colour count checked numerically (apartment
plaster at most 4 colours).

---

## Verification (each release)
`npx tsc -b`, `npm test` (new tests above, exact baselines, art.test), `npm run build`, `npm run contrast`,
`npm run check`; `npm run balance -- 1 20` unchanged (the sim is untouched in all three). Browser: Release A played
from the title screen through the first poll result with the guide on, at 1280x720 and 375x667, both themes, plus
skip and replay; Release B each pose set in the running scene (zoomed) and the staff portrait; Release C every tier
day and night. Subagent task reviews and a final whole-branch review per release, as before.
