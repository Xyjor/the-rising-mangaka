# The Rising Mangaka

A manga-career management game inspired by Kairosoft's *The Manga Works*, rebuilt with a modern, transparent,
low-friction interface. Read `DESIGN.md` for the pillars, systems, scoring formulas, and roadmap before changing gameplay.

## Commands

```bash
npm run dev            # Vite dev server on http://localhost:5173 (launch config: .claude/launch.json, name "dev")
npm test               # Vitest: sim (src/sim/__tests__), state (src/state/__tests__) and UI tests together
npx tsc -b             # Type check (must exit 0)
npm run build          # Production build
npm run lint           # oxlint
npm run check           # Version check (package.json vs src-tauri/Cargo.toml) + lint (deny warnings) + typecheck +
                        # tests + build + contrast gate; CI runs these plus a balance smoke run
npm run contrast        # WCAG AA 4.5:1 contrast gate over src/styles/tokens.css
npm run art -- <id>|--all   # Regenerates a static illustration from art/manifest.json's raw source into
                             # src/assets/art/ (scripts/pixelate.ts); a `kind: "sprite"` entry writes a frame module
                             # into src/ui/scene/generated/ instead; --all skips `"retired": true` entries (naming
                             # one regenerates it); run after adding or editing a manifest entry; `--all` currently
                             # rewrites `prop/kitchenette.png` (held back in 0.10.2, DESIGN.md "2026-10-09, the
                             # remaining minors"); `git checkout` it back unless that change is intended
npm run sprites -- <out.png> [--walk] [--base <ref>] [--only <prefix>]   # Sprite contact sheet (scripts/spriteSheet.ts), 8x (the cat at 16x): per rig animation a strip beside the 0.10 frames it replaces (base ref: `--base`, default main, where the 0.10 frames stay until the merge), in every outfit and assistant look (the editor's `editor-*` blocks in `EDITOR_PAL` only, beside the base's 0.10 editor), `--only <prefix>` (the animations whose id starts with it), the blocks on shelves (`shelve`); then the rig's poses in the five moods, the cat beside the base (row G; no row F since 0.12.0), row H the walk strips (the rig's walk and the rig editor's `editor-walk`, each above the base's 0.10 cycle, then the cat), row I, the rig head with every eyes x mouth x mark, and row J, the editor's head with every eyes; --walk the walk strips only; a palette missing on either side (or a base frame or file) is an empty cell and a note
npm run balance -- [from=1] [to=20] [--detail seed]   # Balance bots (src/sim/bot.ts): a line per seed per bot, then the balance-band rows
npm run tauri dev       # Desktop window; stop any running `npm run dev` first (it starts its own, strict port 5173)
npm run tauri build     # Windows NSIS installer, in src-tauri/target/release/bundle/nsis/
npx tauri build --debug --no-bundle   # Debug desktop exe only (src-tauri/target/debug/rising-mangaka.exe), no installer
cargo test --locked --lib              # In src-tauri: the Rust unit tests (the first-launch window fit)
npm version <patch|minor|major>        # Bumps package.json, syncs src-tauri/Cargo.toml (scripts/sync-version.ts), runs
                                        # `cargo update --workspace` and stages Cargo.toml and Cargo.lock; never run
                                        # this here (it commits and tags)
```

Every change must pass `npx tsc -b`, `npm test`, and `npm run build` before it is called done. Run them; do not assume.
CI (`.github/workflows/ci.yml`) runs `npm run check`'s steps plus a balance smoke run; lint warnings fail CI (`oxlint --deny-warnings`).

UI tests (`src/ui/__tests__`) run against `happy-dom` (not the sim/state tests' default node environment): start the file
with `// @vitest-environment happy-dom` and import `src/test/dom.ts` for its side effects (registers
`afterEach(cleanup)` and defensive DOM fallbacks; globals are off, so nothing does this automatically). Build fixture
game states from `src/test/fixtures.ts` rather than re-deriving sim call sequences per test file.

## Architecture

- `src/sim/` — **pure TypeScript simulation**. No React, no DOM, no Date/Math.random. Deterministic given a seed
  (`src/sim/rng.ts`). Every state change is a pure function `(state, input) => state` that returns a new object.
  - `types.ts` all domain types. `data.ts` content (genres, themes, audiences, magazines, places, constants).
  - `compat.ts` hidden compatibility ratings. `scoring.ts` poll scoring. `engine.ts` commands + `tick()`.
  - `core.ts` state helpers shared by the engine and its tick hooks (`addLog`, `grantXp`, `xpToNext`, `startTrip`,
    and `num`/`yen`, locale-free thousands commas for log lines).
    `events.ts` random events (the weekly roll on its own `eventSeed`, the answers). `editors.ts` the editor
    relationship and tips (`bumpEditor`, each magazine's `tipEvery`) and the Notebook reveals trips share. `studio.ts` studio tiers (desks,
    rent) and equipment (effects, buying, moving, `studioLook`). `anime.ts` anime adaptation offers and deals
    (`animeTick`, signing, `animeVolumeMult`). `rival.ts` the named rival (`makeRival`, `growRival`, the head to
    head). `merch.ts` merchandise from year two (the licence, `orderMerch`/`merchRefusal`, `merchForecast`,
    `merchTick`). `year.ts` the year end (`closeYear`: awards, prizes, the year review, the rival's growth). `badges.ts` the
    badge gallery's rules (`awardBadges(prev, s)`, the last step of `tick()`: no XP, no money, no RNG). Hook files never
    import engine.ts.
  - Add a unit test in `src/sim/__tests__/engine.test.ts` for every new rule.
- `src/state/store.ts` — Zustand store. Wraps the sim, owns the real-time clock speed, modal state, toasts,
  and persists `game` to localStorage (`persist` version = `SAVE_VERSION`; new `GameState` fields default through
  `src/sim/migrate.ts` `upgradeSave`; bump `SAVE_VERSION` only for shape changes that cannot be defaulted).
  `profile.ts` is the cross-save badge profile (`rising-mangaka-profile`: the first time each badge was earned in any
  career), written after a tick or command that grew `game.badges`, by the tab that owns the save only.
  `clock.ts` is a separate, never-persisted presentation-time store: `t` (the week-long light cycle position),
  `isNight`, `logSeenId` (the studio log's read marker) and `guideVisible` (the tutorial guide is on screen).
  `saveFile.ts` owns `SAVE_VERSION`, the saved log length and the save file (`serializeSave`; `parseSave`, strict,
  every refusal a `SaveFileError`; `saveFileName`; `storedSaveFile` for the recovery screen); the store's `loadSave`
  installs a parsed file (refused in a tab that does not own the save), bumps `saveLoads` and writes at once.
  `slots.ts` holds the three save slots: `rising-mangaka-save-1/-2/-3` (the career: game, tutorial step, run speed), the
  index `rising-mangaka-slots` (`{ active }` only) and `rising-mangaka-prefs` (theme, sound, shared by every slot);
  `migrateLegacy` runs once before the store hydrates and copies the 0.5.0 key `rising-mangaka-save` into an empty
  slot 1 (verified byte for byte, rolled back on any failure, which falls back to the old key for that run; never
  deletes or writes the old key otherwise). The store's save storage resolves the open slot's key (`careerKey`,
  `activeSaveKey`) when a change is accepted and keeps it with the debounced write, so `flushSave` always lands a
  write in its own slot; it never writes a null game (only `deleteSlot` empties a slot). Slot actions: `openSlot`
  (flush, switch, rehydrate), `startInSlot`, `backToTitle` (Settings' "Back to the title screen"), `deleteSlot`
  (never the legacy key or the open slot), `loadSaveIntoSlot`; all refused in a read-only tab, which follows the
  owner's index and slot through its `storage` listener. `slotSummary` (`saveFile.ts`) reads a slot card's summary.
  Sim commands go through the `apply()` helper so toasts and auto-resume stay consistent. `tutorial.ts` is the guided
  first career, pure: `STEPS` (twelve steps, each an anchor, the editor's line, the trigger that finishes it, its
  phase), `phaseOf` (a waiting result reads as submitted), `stepAfter`, `resumeTutorialStep` (run by the persist
  `merge`, `parseSave`, `loadSave`, and `tick` when the phase changes), `settleStep` (the goal step ends with no milestone
  left), `canPoint` (whether the game lets a step's control show) and `replayStepFor`; the persisted `tutorialStep` is the step index per career, -1 done (a new game starts at 0). The
  store moves it through `withTutorial(patch, trigger)`: `apply`'s optional trigger (startProject, submitProject,
  dismissResult), `openModal`/`closeModal` on the wizard and the pitch window, `setSpeed`/`togglePause` running the
  clock, and `advanceTutorial(trigger)` (the guide's Next), never in a read-only tab; entering a step pauses through
  `pauseForDecision`, the patch `tick`'s auto-pause uses, except steps 5 and 7, entered before their anchor exists. `skipTutorial` ends it (the guide's Skip, and Settings' Help while a step is open), `replayTutorial` (Settings' Help) restarts it at
  `replayStepFor`, pausing only when `canPoint`. The 0.7.0 getting-started coach note (`CoachNote`, `COACH`) is gone. `setWindowHidden` (from
  the page's `visibilitychange` and the desktop shell's minimise) stops the clock and suspends the sound; the
  non-persisted `windowHidden` flag keeps that pause silent. `flushSave` writes the debounced save at once. The tab
  lock (`tabLock.ts`) runs in a browser only; the desktop app calls `disableTabLock()` (one window, single instance).
- `src/audio/` — Web Audio sound, framework-free, no files. `engine.ts` synthesises the cues and owns the AudioContext,
  `music.ts` is the music loop (its score and look-ahead scheduler; the engine starts it on unlock when asked for
  before, and each start plays through its own fade gain), `triggers.ts` maps a state change to cues, `instance.ts`
  holds the one shared engine (`getSound`/`installSound`), and `bridge.ts` `connectSound` (wired in `main.tsx`) makes
  it follow the store: prefs, music, cues (never in a read-only tab, never for a loaded save, via the store's
  `saveLoads`, and never while the window is hidden, via `windowHidden`), and the gestures that unlock it, until the
  context runs. `Modal` plays `open`/`close`/`tab` itself via `getSound()` (never in a read-only tab); the scene
  plays `knock` (the editor arriving) and `pop` (money/fans/xp rising). `instance.ts`'s `holdDuck` is the only way
  UI code ducks the music: a stack of duck-level holds, the deepest wins, released in full once the last one drops
  (Modal holds 60% for as long as it is open; the results reveal stacks its own 30% under that).
- `src/ui/` — React 19 components. `App.tsx` (shell, clock, hotkeys), `hud/` (the corner overlays and rail:
  `TopLeft`, `TopRight`, `Rail`, `StatusCard`, `statusParts`, `DeskTray`), `hooks/` (`useClockLoop`, `useRolledNumber`,
  `useArrival`, the editor's walk-in delay before a pending card mounts, `EDITOR_WALK_MS` 1650), `panels/*` (modals, including `LogModal`, `BadgesModal`
  (the badge gallery, rail button Badges and G; earned tiles use `BADGE_ART`, the rest `BADGE_LOCKED`), the
  desk panel), `scene/` (pixel-art canvas, 320×180: two coordinate spaces meet in `paint.ts` (room space, the old
  192×108 layout, offset by `OX 64, OY 36` into canvas space by `rect`; `rawRect` for the wall, floor, kitchenette,
  entrance and door, drawn straight in canvas space) and its `PANE_X/Y/W/H`/`BAR_X` and `paneRect` clipped to the
  window pane; `render.ts` holds the palettes, string-map sprites and `render`, one frame painted from a `Snapshot`
  with nothing allocated per frame (`Snapshot.late` turns the seated mangaka to the late loop, which opens on the panic;
  `Snapshot.reaction` is the one-shot `ReactionCue` the cast driver takes once per character, render never reads it);
  since 0.11.0 the mangaka (task 17) and the assistants (task 19) draw from the rig only: a pose (`Actor.pose`, or with
  none its base loop's first step) is one `drawImage` of `rigFrame(pose, mood, ready)`, the mood's face and mark baked
  in (no overlay), at `poseOrigin` (the actor, or `MANGAKA_SEAT` or `MANGAKA_BED_FRAME`); the assistants' row
  (`drawAssistants`: the figures, their desk, their pages) goes after the desk group and before the mangaka's front
  pass, in front of the main desk by depth; the editor (since 0.12.0) from the rig only (`drawRigEditor`: his neutral
  frame in the `editor` palette, the visit's prop at `frontHand`, the `!` in the mark slot); `workingOf(s)` (drawing at the desk with the clock running, shared with the
  driver) and `assistantDesk(shown)` (the row's desk, a constant per count); `sceneArt.ts`
  `SceneArt` (render's fifth argument, before the sprite cache, default `NO_ART`): generated room walls (320x114, drawn over rows 0-113, the apartment's and the loft's; the flat has none since 0.10.1, its wall always code-drawn, `TIER_WALL`; the tier's floor is always code-drawn, `roomArt.ts` `TIER_FLOOR`) and prop sprites (structural, furniture, front row) drawn with
  `drawImage` (`ready`, `drawProp`; a sprite keeps its aspect at `PROP_SPRITE`, placed by `spriteBox` (`placeSprite` under `PROP_ALIGN`, sized by `PROP_SPRITE`/`PROP_MIN_H`/`PROP_MAX_W`; a desk by `hangSprite`) at render.ts's
  `PROP_BOX`, the fallback inside `PROP_FOOTPRINT`), each falling back to its code-drawn piece
  (`drawRoomShell`, the window frame, `TIER_DOOR`, ...) while missing or loading; `sceneImages.ts` builds them once from
  the registry's `ROOM_ART`/`SCENE_PROP_ART` (render.ts never imports the registry; `ROOM_ART` lists every tier, the
  flat `null`, so a new tier fails `tsc` until its wall is decided) and `StudioScene` repaints on a
  load; `sprites.ts` the
  palette (uppercase base, lowercase shade, `L` outline), the string-map frames left, the 12x8 cat's (until 0.13.0),
  `EDITOR_PAL` (the rig editor's palette), the run-length `drawSprite`, `frameRules` (closed outline, feet on the last
  row, every key in the palette; re-exported with `PAL` and `SpriteMap`), `RUN_CAPS` (sprites.test.ts: the cat's
  frames, each run count capped at 1.3x its pre-redraw count, never raised); `faceRules` (the 0.10 face window rows 9-12
  cols 4-17 holds only face keys, the mark slot clear, the head inside the 0.10 avatar crop) and `ANCHOR_HEAD` (the 0.10
  frames' hand-drawn head) live in the import-free leaf `spriteCore.ts` with `frameRules`, `PAL`, `FACE_KEYS` and
  `MARK_KEYS`, so `npm run art` never loads sprites.ts; they stay for its `--sprite` graft only (the 0.10 editor's maps,
  `LEGACY_IDLE`/`LEGACY_WALK` and the code-drawn visit props went at 0.12.0 task 11),
  the generated frames (`src/ui/scene/generated/*.ts`, written by `npm run art` and never hand-edited; empty since
  0.11.0 task 19): the 0.10 cast was hand-redrawn in 0.9.0 (Release B, gated on `npm run sprites`), every pose but
  `ANCHOR_HEAD`; every generated candidate (C1's nine
  probe-sheet frames, C2's idle, walk, seated, stretch, sip, editor and cat, and the assistants' doze, drawn from C2
  until task 19 replaced it with the rig's hand-drawn doze) is retired: its manifest recipe (`"retired": true`) and raw
  sheet kept, no module (art.test: no `generated/*.ts` without a non-retired entry, and none at all now), restored by
  `npm run art -- sprite/<name>`, see DESIGN.md "The sprites"), and `outfitOf`/`OUTFIT_PALS`
  (the mangaka's outfit by level: hoodie, cardigan, blazer); `mood.ts` `moodOf` (the mood priority order),
  `cheersFor` (a fans or level-up pop starts a `CHEER_MS` cheer) and `catFrame` (the sitting cat's idle cycle; the
  mangaka's 0.10 `idleFrame` went with its 0.10 frames in 0.11.0, its idle moments are the cast driver's); `spriteSvg.ts` `spriteRects` and
  `SpriteAvatar.tsx`, the staff portrait drawn from the rig head (`rig/head.ts` `headWith(NEUTRAL_FACE)`, 24x22,
  `AVATAR_CROP`); `rig/` (0.11.0) the cast rig:
  `types.ts` (parts with anchors, part poses and key poses, faces, `CastFrame`, `Mood`), `assemble.ts`
  (`assemblePose`: parts layered back to front by their join anchors (`JOIN`), the outline closed where they meet,
  the face stamped into the head; `partRules`, `poseRules`, `headRules`: every slot inside the map, the face slots hold only face keys, the bare head is neutral, the mark slot is clear, every face drawing fills its slot) and `head.ts` (the hand-drawn 27x22 chibi head
  `HEAD`: cols 0-23 the head, cols 24-26 the mark slot; its eye slot rows 10-13 cols 4-19, mouth slot rows 15-16 cols
  10-13, the neck anchor (12, 21); `EYES` (open, blink, closed, ring, squint, happy), `MOUTHS` (closed, open, smile,
  frown, o), `MARK_ART` (sweat, sparkle, bang, zee in `PAL.A`/`PAL.X`), `FACE_ART`, `NEUTRAL_FACE`, `FACE_BY_MOOD`,
  `headWith(face, head?, art?)`; the editor's head (0.12.0) `EDITOR_HEAD` on the same slots, hair parted at col 10 and square glasses, `EDITOR_EYES` (the six eyes inside the lens rims, `L` at head cols 4, 10, 13 and 19, the bridge on row 11; open and squint drawn for the lens, the others copied from `EYES`), `EDITOR_FACE_ART`), `parts.ts` (`PARTS`: every torso, arm, leg and prop (the pen, the manuscript, the mug, the page) by name with its anchors, each outlined but where it
  joins another; the 32x48 frame standing has the head at (4, 0), the torso at (7, 21), the feet on row 47; the
  editor's suit (0.12.0) `editor-torso`, the near sleeves `arm-l-suit-hang`, `-swing-fwd`, `-swing-back`, `-raise`,
  `-glasses` and `-watch`, and the far sleeves `arm-r-suit-case`, `-case-fwd` and `-case-back`, the briefcase baked
  under the far fist),
  `keyFrames.ts` (the poses the parts cannot make, hand-drawn whole with their face baked in: the bed's 48x32
  `BED_LIE_0`, `BED_LIE_1` and `BED_SIT`, drawn at the bed; the reactions' 32x48 panic, cheer, slump and torn page; the assistants' 32x48 doze, `DOZE_0`/`DOZE_1`), `poses.ts`
  (`PoseId`, `POSES`: each a part pose or a key frame and where it is drawn, `at` the actor, the seat or the bed; the
  editor's `editor.*` poses from `editorStand(over)`, all at the actor),
  `anims.ts` (`AnimId`, `ANIM_IDS`, `ANIMS`: the 33 animations' fixed postures and looping, each step a pose and its
  ms; the cast's 24 drawn, and the editor's nine `editor-*` (0.12.0): his stand, walk, turns, waiting moments and
  verdicts, the nod and the sigh, part poses so the visit's prop stays in his hand) and `frames.ts` (`rigFrame(pose, mood, ready)`: the frame assembled with the
  mood's face, `faceOf`, in the head's own face art, `faceArtOf`, memoized per pose, mood and ready, its id `pose~eyes.mouth.mark`, `frameId`; `frontHand(pose)`, the front arm's hand cell, memoized, where the visit's prop is drawn (0.12.0)) and `props.ts`
  (0.12.0, `VISIT_PROPS`: the envelope, letter, contract and trophy as small cast frames `prop.<id>` in PAL keys with a
  `hand` anchor, drawn in the editor's palette after his body at `frontHand`); `spriteCache.ts` (0.11.0) the per-session sprite cache: each
  cast frame painted once per palette (`PaletteId`: `pal`, the outfits, `editor`, `look0`-`look5`) and facing into an
  OffscreenCanvas (a `<canvas>` without one or when it gives no 2D context, a stand-in in node), keyed by frame id;
  `drawCast` is one `drawImage`, `drawCastTop` one 9-argument `drawImage` of a cached frame's top rows (render draws the
  seated rig mangaka's rows 0-39 again with it, after the page stack); `getCastCache`/`installCastCache` (tests install a recording one). Memory: at most
  485 rig frames (plus 4 prop frames and the cat's 7) x 10 palettes x 2 facings x 6,144 B (a 32x48 RGBA surface), about
  60 MB in theory; about 340 reachable (the editor is drawn neutral only); a realistic long career builds about 900-1,000
  surfaces, about 6 MB. `oldCast.ts` (0.11.0) the 0.10 maps as cast frames (`OLD_CAST`), drawn
  through the cache until each character's rig release (the mangaka's left at task 17, the assistants' at task 19,
  the editor's at 0.12.0 task 11: the cat's remain, until 0.13.0); `render`'s last argument is the cache (`getCastCache()` by default), each
  character one `drawImage`, no mood overlay (the rig frames bake the face). `animation.ts` (0.11.0)
  the pure animation player: `Anim` (steps of a pose and ms, a loop or a one-shot, a `Posture`), `PlayerState` (the base
  loop and its start, the one-shot over it, a queue of at most `QUEUE_MAX` 2), `switchBase` (a transition first; a moment
  survives a base change within its posture), `enqueue`, `interrupt` (a one-shot that replaces the one playing),
  `advance`, `poseAt`, `settle` (everything played out: the window shown again, a settle). `idleSchedule.ts` (0.11.0)
  `nextIdle(day, who, n)`: the n-th idle moment's wait (6-14 s) and pick for a character, hashed (`mix`) from the day,
  the character and the count; no RNG state. `reactions.ts` (0.11.0) `reactionFor(prev, next)`: the cast's reaction to a
  store change (a missed issue, a bad or good poll by the corkboard's `rankToneOf` (`story.ts`), the offer coming into view, a level-up, the chapter
  turning late), with `popsFor`'s guards; a one-shot result reacts when dismissed, never as it arrives. `castPlay.ts` (0.11.0) the cast driver: per actor a `Track` (the mangaka, the
  assistants and, since 0.12.0, the editor at the fifth seat, `EDITOR_SEAT` 4; each the player, the state last seen, the last cue taken, the idle schedule); `stepCast` picks the base loop
  (`baseAnimFor`, each seat's phase kept through every change), plays the transition between two states
  (`transitionFor(who, from, to)`; the editor's turns, `editor-arrive`/`editor-leave`), the seeded idle moments
  (`idlePool`, `nextIdle`: a new game day restarts the count, never the wait; his waiting moments, `EDITOR_POOL`) and
  the snapshot's reaction cue (`reactionAnim`: it cuts an idle moment short, waits behind a transition; his verdicts, a
  nod on `offer` or `good-poll`, a sigh on `bad-poll`, standing only), and writes `Actor.pose`; `previewFits` (a dev
  preview on its own character only); `verdictHoldMs(kind, editor)` (0.12.0, decision 14: his verdict's length plus
  `VERDICT_HOLD_SLACK_MS` 50 while he stands, else 0); `settleCast`, `resumeCast`; `headTop`/`headCentre` for the bubbles and pops. `season.ts` has `seasonOf(day)` and the window's season layer; `roomArt.ts` each tier's walls and floor (`TIER_ROOM` is `TIER_WALL` then `TIER_FLOOR`:
tatami, planks, concrete), the front row of floor props (`TIER_FRONT`, drawn after the actors), the story props (corkboard,
calendar, cups, the serial's cover, fan letters, bin) and `drawAmbient` (daylight shaft, lamp pool, vignette), all in
canvas space; `story.ts` `storyLook`, the story props' five snapshot inputs read from the game; `studioArt.ts` the
  player's studio (`TIER_ART` and `EQUIPMENT_ART` records keyed by id, so a new tier or piece fails `tsc` until it is
  drawn, plus the kitchenette, the entrance, the volumes, anime poster, trophies and lights); `actors.ts` the cast as a
  table of actors (position, target, facing, pose, which axis it walks first) driven by `planActors`/`stepActors`/
  `settleActors` at `WALK_PX_PER_S`, and `EDITOR_WALK_MS`; since 0.11.0 `Actor.pose` (the rig pose `castPlay.ts` sets,
  '' when unposed), the mangaka's 0.11 spots under the 0.10 names (`MANGAKA_SEAT` (124, 58), `MANGAKA_STAND` (170, 81),
  `MANGAKA_BED` (220, 90) with the bed frames at `MANGAKA_BED_FRAME` (201, 90), `CAT_BED` (202, 118)), the assistants'
  0.11 row (`ASSISTANT_SEAT_X` [21, 55, 89], `ASSISTANT_SEAT_Y` 80) and the editor's 0.12 spot (`EDITOR_SPOT` (205,
  90); in y first, legs `'yx'`, out x first), everyone through `DOOR_SPOT` (250, 69), all planned by
  `planActors(table, snap)`; since 0.12.0
  `Actor.holdMs` (a held actor stays put in its state while `stepActors` counts it down; a settle and reduced motion
  clear it); `visitor.ts` the editor's reason for visiting, its prop and
  its greeting (`sceneReasonOf` adds `tutorial`, the lowest reason: the editor stands at the spot while a tutorial step
  is open, empty-handed and silent, walking in on a new career's step 0 through `actors.ts` `editorWalksIn`, and the
  scene's greeting bubble hides while the guide is on screen, `clock.ts` `guideVisible`, not while a step waits); `sceneAnchor.ts` `sceneToCss` mapping scene pixels to the canvas's cover-fit CSS box; `Bubble.tsx`
  and `Pops.tsx` the DOM speech bubbles and floating money/fans/xp numbers, styled by `scene.css`;
  `StudioScene.tsx` is the component and its 24 fps frame loop (reading `studioLook` through `useShallow`, lighting
  from the presentation clock, playing the `knock` and `pop` cues; since 0.11.0 it steps the cast driver every loop
  step on a scene clock of its own, `sceneMs`, the sum of the loop's steps, so it never jumps across a hidden stretch
  (`settleCast` on mount and a loaded save, `resumeCast` when the stopped loop restarts), turns `reactionFor` into a
  `ReactionCue` on the snapshot (never while the window is hidden), holding the editor at the spot for his verdict
  first (`verdictHoldMs` into `Actor.holdMs`, before the plan effect sends him to the door), and in a dev build
  `?rig=<anim>` plays that animation over every base of its posture on its own character only (`previewFits`); a
  production build never reads it,
  `import.meta.env.DEV`); every render is checked against a hand-measured
  fillRect baseline (`render.test.ts` 273, `studioArt.test.ts` 289; with every scene image ready, 156 and 173; the
  rest scene with the doze, `render.test.ts` 302; re-measured by the 0.9.0 cast redraw, the art baselines rose by
  the apartment's code floor in 0.10.0, and all five fell in 0.11.0 once every character became one `drawImage` from the
  sprite cache and left the fill log, the full scene's again once the mangaka's mood face moved into its rig frame, and
  all five once more when the assistants' 0.10 stools went (task 19); the budget loops that sweep many scenes have
  their own worst-case pins: the flat in spring at night with the art ready 217, the full scene with the editor
  visiting 414, 237 with the art ready, since 0.12.0 task 11 drew his contract as one `drawImage`) and
  must stay under 1.5x
  it),
  `components.tsx` (Bar, Pips, Modal, RankChart), `format.ts` (money/compact/plural formatters), `Icon.tsx`
  (inline SVG icon set), `SaveFileSection.tsx` and `useSaveFile.ts` (export and load, in Settings and on the
  title screen), `TutorialGuide.tsx` (the tutorial's overlay, mounted after `<Toasts />`: it finds the current
  step's control by its `data-tutorial` anchor, the `TutorialAnchor` names in `state/tutorial.ts`, and draws a
  click-through spotlight plus the editor's bubble, portalled into the dialog when the anchor is inside one; a missing
  anchor shows nothing and the step waits; the bubble's placement is the pure `tutorialPlace.ts`; styles in
  `tutorial.css`; a renamed or moved control keeps its anchor:
  `TutorialGuide.test` fails otherwise), and
  `ErrorBoundary.tsx` (wraps `App` in `main.tsx`; a render crash shows a recovery screen that exports the stored save
  and starts over, or in a tab that does not own the save, reloads). Tests live in `src/ui/__tests__` and
  `src/ui/scene/__tests__`; see the UI-test docblock rule under Commands above.
- `src/ui/art/` — the generated-art layer: `palette.ts` (`ART_PALETTE_BASE`, frozen, the default snap so old assets regenerate byte for byte; `ART_PALETTE_SCENE` for manifest `"palette": "scene"` entries; `ART_PALETTE` their union, every colour also literal in `src/ui/scene/*.ts`
  or `src/styles/tokens.css`), `pixelOps.ts` (the pure pixel math `scripts/pixelate.ts` runs, including the `--sprite` mode's steps for a manifest `kind: "sprite"` entry, a pose cell turned into a string-map frame module; a room entry with
  manifest `floor: "code"` keeps the wall rows above its `seam.src` only via `wallOnly` (native 320x114), and
  `remapSeam`, which lands a whole room's wall/floor line on canvas row 114, is the path no committed room uses now; `flatten: { radius }` (`flattenToMode`, a `floor: "code"` wall only, radius in
  (0, 1]) turns every pixel within that OKLab radius of the wall's modal colour into it, so the plaster must be the
  wall's most frequent exact colour (the striped flat sets none); and `lightness` keeps a shaded wall's hue in the snap), `registry.ts` (typed
  `ArtRef` lookups over the PNGs in `src/assets/art/`, eagerly globbed by Vite) and `PixelArt.tsx` (the `<img>`
  wrapper every component uses to mount one). `art/manifest.json` and `art/raw/` at the repo root hold each asset's
  generation recipe and committed raw source (two hosts: a Hugging Face Space with seeds, Higgsfield `z_image` with job ids); see DESIGN.md's "Art" section.
- `src/assets/art/` — generated indexed PNGs, one per `art/manifest.json` entry, written by `npm run art` and never
  edited by hand; never base64-inlined (`vite.config.ts`'s `assetsInlineLimit`).
- `src/platform/` — where the game runs, and the only place that imports `@tauri-apps/*`. `env.ts` `isDesktop()`
  (reads `globalThis.isTauri`, no Tauri import), `keys.ts` (`isBrowserShortcut`, `isEditableTarget`), `desktop.ts`
  `installDesktopShell` (save on close, F11 full screen, minimise pauses; in a production build, which every
  `tauri build` is, `--debug` too, the browser engine's shortcuts are cancelled everywhere, text fields included, and
  its context menu everywhere except text fields; only `npm run tauri dev` keeps both), loaded by `main.tsx` with a
  dynamic import on desktop only, so the browser's main chunk carries no Tauri code. `saveTransfer.ts` `exportSave` /
  `importSave` move a save file (a browser download and file picker), handing over to `saveTransfer.desktop.ts` (the
  dialog and fs plugins) by dynamic import on desktop. Tests in `src/platform/__tests__`.
- `src/test/` — shared test-only helpers: `dom.ts` (happy-dom setup, imported for side effects), `fixtures.ts`
  (game-state builders such as `withPendingResult`, shared across UI test files), `fakeSound.ts` (a recording
  sound engine for `connectSound` or `installSound`) and `fakeCanvas.ts` (a recording 2D context that logs each
  fillRect with its fillStyle, and each drawImage apart in `images` with `fakeImage` to feed it, `covers`/`coversAny`, how many fills paint a pixel, `fakeSurface`, a surface for a test's sprite cache (`installCastCache(createSpriteCache(fakeSurface))` in a happy-dom scene test, whose canvas paints nothing), so `images` names each cast frame drawn, and `sceneSnapshot`, the scene's reference state, for `render` tests).
- `src/styles/tokens.css` (design tokens, light + dark), `base.css` (primitives), `app.css` (layout and panels),
  `cards.css` (desk cards; on phones they follow the project card), `stage.css` (the full-bleed stage layout),
  `hud.css` (the corner overlays, rail and status card).
- `src-tauri/` — Tauri 2 desktop shell around the unchanged `dist` build (`tauri.conf.json`: window, CSP, NSIS bundle,
  version from `package.json`; `capabilities/default.json`: window `main`, `core:default` plus
  `core:window:allow-set-fullscreen`, `core:window:allow-destroy`, `dialog:allow-open`, `dialog:allow-save`,
  `fs:allow-read-text-file` and `fs:allow-write-text-file`, no `fs:scope`: the dialogs add each picked file to the fs
  scope for the session; crates pinned to `"2"`). `src/lib.rs` registers the single-instance plugin first (a second
  launch focuses the window), window-state (size, position, maximised), dialog and fs, and `fit.rs` (on a first
  launch, with no saved window, a window too big for its monitor shrinks to at most 90% of the work area on each axis,
  and the window is centred in the work area with its title bar on screen).
  Never change `identifier` `com.xyjor.risingmangaka` or set `useHttpsScheme`: either one loses every save.

## Conventions

- TypeScript has `erasableSyntaxOnly` on: no `enum`, no parameter properties. Use string-literal unions and `as const`.
- Sim code never imports from `ui/` or `state/`. UI never mutates game state directly; call store actions.
- Log entries: `addLog(state, kind, text, toast)`. `toast: true` only for things the player must notice; chapter results
  and money events are toasts, daily chatter is not. Identical toasts are de-duplicated by the store.
- The clock auto-pauses whenever the game needs a decision (manuscript ready, poll result, serialisation offer,
  a serial is cancelled, a trip ends, a random event or an anime offer lands), and on entering a tutorial step, except
  one whose control cannot show yet (`withTutorial`, `replayTutorial`). Keep it that way for any new blocking
  decision. The year end is not a decision: it toasts and leaves its review on the desk, and the clock keeps running.
  Hiding or minimising the window stops the clock too (silently) and suspends the sound; showing it resumes the sound
  only, and the player restarts the clock.
- Game-driven moments (random events, anime offers, the year review) are desk cards, never popups: a component that
  returns null when empty, imports its own stylesheet (`src/styles/cards.css`), uses `card flat desk-card`, toasts on
  arrival and pauses once (the year review only toasts), and is placed by `DeskTray`.
- Menus always pause (the studio log included).
- The eye button (and D) hides the desk dock to show the studio; not saved, and any auto-pause for a decision shows it
  again (`deskHidden` in the store's `tick`).

## UI rules (from the design pass)

- Icons are inline SVG via `<Icon name=... />`. No emoji in the interface.
- Static illustrations come from `src/ui/art/registry.ts` through `PixelArt`; never import a PNG directly in a
  component.
- Labels are sentence case (`.lbl` class), never tracked all-caps. No middle-dot `·` separators in copy; use commas
  or sentences.
- Buttons say what they do ("Submit manuscript", "Wrap up the series"). Errors and empty states say what to do next.
- Touch targets are at least 44px on coarse pointers (`base.css` handles `.btn`, `.seg button`, `.steps button`,
  `.toast button`, `.rail .btn` and `.badge-hud.as-button`).
- Colours come from tokens (`var(--accent)` etc.), never raw hex in components. Both themes must work.
- Stacking uses the z tokens (`tokens.css`): `--z-toast` 40, `--z-guide` 50 (the tutorial guide);
  open dialogs sit in the browser's top layer above all of them. `--scrim` is the guide's dim.
- Charts: one axis, thin marks, direct label on the last point, hover tooltip, a table view alongside.
- Every result explains itself (the "show the why" pillar). Never add a hidden modifier without a UI hint.
- On phones (<= 640 px) the studio scene collapses to a fixed 38vh band above the desk tray (`stage.css`); DOM order,
  not CSS `order`, drives the stacking, asserted by `src/ui/__tests__/Shell.test.tsx`, and checked by eye at 375x667.
  Below 700px (`app.css`), the Results and the wizard's title-step modal columns also stack to one column; the
  Series and Studio modals need 900px to go two-column and stack below that instead — check the real breakpoint in
  `app.css` before assuming 700px applies to a given modal. The scene's status chip (`.scene-overlay`, `stage.css`)
  is hidden at 900px and below, since it collides with the date badge and repeats the status card's phase.
- Display type is Silkscreen (`--font-display` titles, `--font-num` numbers) at 8/16/24/32 px; it draws every letter
  as a capital, so keep DOM text sentence case and never add `text-transform` or `letter-spacing`. Body copy and
  button labels stay Nunito 15 px. HUD badges are opaque (`--panel`).
- `Modal` sizing: `wide` on Results and Series, `narrow` on Offer, Stats, Career, Badges, Year, Settings, Trips and the Log,
  `tabs` on Notebook and Series (a title-bar tab strip), and `quiet` only on the Results modal, which skips the
  modal's own open/close cue and duck entirely since `ResultsModal` holds its own duck and plays its own beats.

## Balance touchpoints

Starting stats 34/40/30 (story/art/pacing), rivals score 47 to 62, spread 8, the named rival starts at craft 57 in
Kids Comic Go! (+4 at every year end, in `closeYear`, max 76; they run where the rival mean is at most craft - 6, one
magazine up a year), a year is 336 days (`DAYS_PER_YEAR`), weekly living
cost 400 plus studio rent (flat 150, loft 350), one-shot 20 pages (~17 days solo), chapter 16 pages. A volume sells
round((circulation x 20 + 40 x sqrt(fans)) x popularity / 100) copies at ¥2 (`volumeCopies`, the one place the curve
lives). Anime offers need 37,000 copies sold; the Golden Pen 37,000 in a year (near miss from 22,000). Equipment prices
and move-in costs go through `equipmentPrice` and `moveInCost`: base x `EQUIPMENT_PRICE_SCALE` (11: S1 / 9000 =
11.12 rounded to 0.25, held within 0.75-16 by `priceScale`, where S1 is the sensible bot's median money at day 336
buying nothing, ¥100,099). balance.test fails when the scale no longer matches S1: re-derive it and the price
literals together.

`src/sim/__tests__/balance.test.ts` asserts the balance bands (DESIGN.md "Balance bots and bands") over seeds 1–20
as part of `npm test`: every Package 1 row, including a fresh player's first one-shot score (40–55 on 13 of 20 seeds,
median 44–52), and every Package 2 row (events, the rival, awards, equipment, anime within two years). The targets
(`BANDS`), the bot runs and the row measurements live in `src/sim/balance.ts`, shared with `npm run balance`, which
prints the same numbers per seed plus S1. If you change formulas or constants, run both. balance.test thresholds change only with
owner sign-off: when a row fails, tune the knobs DESIGN.md lists, in order (the first-score row is tuned through the
starting stats), record the change as a ruling, and re-derive by hand every test literal the change moves.
