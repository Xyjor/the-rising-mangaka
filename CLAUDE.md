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
npm run check           # Lint (deny warnings) + typecheck + tests + build + contrast gate; mirrors CI
npm run contrast        # WCAG AA 4.5:1 contrast gate over src/styles/tokens.css
npm run balance -- [from=1] [to=20] [--detail seed]   # Balance bots (src/sim/bot.ts): a line per seed per bot, then the balance-band rows
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
    `events.ts` random events (the weekly roll on its own `eventSeed`, the answers). `studio.ts` studio tiers (desks,
    rent) and equipment (effects, buying, moving, `studioLook`). `anime.ts` anime adaptation offers and deals
    (`animeTick`, signing, `animeVolumeMult`). `rival.ts` the named rival (`makeRival`, `growRival`, the head to
    head). `year.ts` the year end (`closeYear`: awards, prizes, the year review, the rival's growth). Hook files never
    import engine.ts.
  - Add a unit test in `src/sim/__tests__/engine.test.ts` for every new rule.
- `src/state/store.ts` — Zustand store. Wraps the sim, owns the real-time clock speed, modal state, toasts,
  and persists `game` to localStorage (`persist` version = `SAVE_VERSION`; new `GameState` fields default through
  `src/sim/migrate.ts` `upgradeSave`; bump `SAVE_VERSION` only for shape changes that cannot be defaulted).
  Sim commands go through the `apply()` helper so toasts and auto-resume stay consistent.
- `src/audio/` — Web Audio sound, framework-free, no files. `engine.ts` synthesises the cues and owns the AudioContext,
  `music.ts` is the music loop (its score and look-ahead scheduler; the engine starts it on unlock when asked for
  before, and each start plays through its own fade gain), `triggers.ts` maps a state change to cues, `instance.ts`
  holds the one shared engine (`getSound`/`installSound`), and `bridge.ts` `connectSound` (wired in `main.tsx`) makes
  it follow the store: prefs, music, cues (never in a read-only tab or for a loaded save, via the store's `saveLoads`),
  and the gestures that unlock it, until the context runs.
- `src/ui/` — React 19 components. `App.tsx` (shell, clock, hotkeys), `Hud.tsx`, `panels/*` (modals and the desk
  panel), `scene/` (pixel-art canvas, 192×108 logical pixels: `render.ts` holds the palettes, string-map sprites
  and `render`, one frame painted from a `Snapshot` with nothing allocated per frame; `season.ts` has `seasonOf(day)`
  and the window's season layer; `StudioScene.tsx` is the component and its frame loop), `components.tsx` (Bar, Pips,
  Modal, RankChart, money/compact formatters), `Icon.tsx` (inline SVG icon set). Tests live in `src/ui/__tests__` and
  `src/ui/scene/__tests__`; see the UI-test docblock rule under Commands above.
- `src/test/` — shared test-only helpers: `dom.ts` (happy-dom setup, imported for side effects), `fixtures.ts`
  (game-state builders such as `withPendingResult`, shared across UI test files), `fakeSound.ts` (a recording
  sound engine for `connectSound` or `installSound`) and `fakeCanvas.ts` (a recording 2D context that logs each
  fillRect with its fillStyle, and `sceneSnapshot`, the scene's reference state, for `render` tests).
- `src/styles/tokens.css` (design tokens, light + dark), `base.css` (primitives), `app.css` (layout and panels),
  `cards.css` (desk cards; on phones they follow the project card).

## Conventions

- TypeScript has `erasableSyntaxOnly` on: no `enum`, no parameter properties. Use string-literal unions and `as const`.
- Sim code never imports from `ui/` or `state/`. UI never mutates game state directly; call store actions.
- Log entries: `addLog(state, kind, text, toast)`. `toast: true` only for things the player must notice; chapter results
  and money events are toasts, daily chatter is not. Identical toasts are de-duplicated by the store.
- The clock auto-pauses whenever the game needs a decision (manuscript ready, poll result, serialisation offer,
  a serial is cancelled, a trip ends, a random event or an anime offer lands). Keep it that way for any new blocking
  decision. The year end is not a decision: it toasts and leaves its review on the desk, and the clock keeps running.
- Game-driven moments (random events, anime offers, the year review) are desk cards, never popups: a component that
  returns null when empty, imports its own stylesheet (`src/styles/cards.css`), uses `card flat desk-card`, toasts on
  arrival and pauses once (the year review only toasts).

## UI rules (from the design pass)

- Icons are inline SVG via `<Icon name=... />`. No emoji in the interface.
- Labels are sentence case (`.lbl` class), never tracked all-caps. No middle-dot `·` separators in copy; use commas
  or sentences.
- Buttons say what they do ("Submit manuscript", "Wrap up the series"). Errors and empty states say what to do next.
- Touch targets are at least 44px on coarse pointers (`base.css` handles `.btn`, `.seg button`, `.steps button`,
  `.toast button` and `.hud-bar.as-button`).
- Colours come from tokens (`var(--accent)` etc.), never raw hex in components. Both themes must work.
- Charts: one axis, thin marks, direct label on the last point, hover tooltip, a table view alongside.
- Every result explains itself (the "show the why" pillar). Never add a hidden modifier without a UI hint.
- On phones (<= 640 px) the desk renders above the studio scene and the HUD is a two-row strip; the Today control
  must be visible without scrolling in the drawing phase at 375x667 with the getting-started box dismissed.

## Balance touchpoints

Starting stats 34/40/30 (story/art/pacing), rivals score 47 to 62, spread 8, the named rival starts at craft 57 in
Kids Comic Go! (+4 at every year end, in `closeYear`, max 76; they run where the rival mean is at most craft - 6, one
magazine up a year), a year is 336 days (`DAYS_PER_YEAR`), weekly living
cost 400 plus studio rent (flat 150, loft 350), one-shot 20 pages (~17 days solo), chapter 16 pages. A volume sells
round((circulation x 20 + 40 x sqrt(fans)) x popularity / 100) copies at ¥2 (`volumeCopies`, the one place the curve
lives). Anime offers need 37,000 copies sold; the Golden Pen 37,000 in a year (near miss from 22,000). Equipment prices
and move-in costs go through `equipmentPrice` and `moveInCost`: base x `EQUIPMENT_PRICE_SCALE` (11.25: S1 / 9000 =
11.31 rounded to 0.25, held within 0.75-16 by `priceScale`, where S1 is the sensible bot's median money at day 336
buying nothing, ¥101,816.5). balance.test fails when the scale no longer matches S1: re-derive it and the price
literals together.

`src/sim/__tests__/balance.test.ts` asserts the balance bands (DESIGN.md "Balance bots and bands") over seeds 1–20
as part of `npm test`: every Package 1 row, including a fresh player's first one-shot score (40–55 on 13 of 20 seeds,
median 44–52), and every Package 2 row (events, the rival, awards, equipment, anime within two years). The targets
(`BANDS`), the bot runs and the row measurements live in `src/sim/balance.ts`, shared with `npm run balance`, which
prints the same numbers per seed plus S1. If you change formulas or constants, run both. balance.test thresholds change only with
owner sign-off: when a row fails, tune the knobs DESIGN.md lists, in order (the first-score row is tuned through the
starting stats), record the change as a ruling, and re-derive by hand every test literal the change moves.
