# The Rising Mangaka

A manga-career management game inspired by Kairosoft's *The Manga Works*, rebuilt with a modern, transparent,
low-friction interface. Read `DESIGN.md` for the pillars, systems, scoring formulas, and roadmap before changing gameplay.

## Commands

```bash
npm run dev            # Vite dev server on http://localhost:5173 (launch config: .claude/launch.json, name "dev")
npm test               # Vitest, simulation unit tests (src/sim/__tests__)
npx tsc -b             # Type check (must exit 0)
npm run build          # Production build
npm run lint           # oxlint
npx vite-node scripts/balance.ts [seed]   # Balance readout: simulates a career and prints the numbers
```

Every change must pass `npx tsc -b`, `npm test`, and `npm run build` before it is called done. Run them; do not assume.

## Architecture

- `src/sim/` — **pure TypeScript simulation**. No React, no DOM, no Date/Math.random. Deterministic given a seed
  (`src/sim/rng.ts`). Every state change is a pure function `(state, input) => state` that returns a new object.
  - `types.ts` all domain types. `data.ts` content (genres, themes, audiences, magazines, places, constants).
  - `compat.ts` hidden compatibility ratings. `scoring.ts` poll scoring. `engine.ts` commands + `tick()`.
  - Add a unit test in `src/sim/__tests__/engine.test.ts` for every new rule.
- `src/state/store.ts` — Zustand store. Wraps the sim, owns the real-time clock speed, modal state, toasts,
  and persists `game` to localStorage (`persist` version = `SAVE_VERSION`; bump it and migrate when `GameState` changes).
  Sim commands go through the `apply()` helper so toasts and auto-resume stay consistent.
- `src/ui/` — React 19 components. `App.tsx` (shell, clock, hotkeys), `Hud.tsx`, `panels/*` (modals and the desk
  panel), `scene/StudioScene.tsx` (pixel-art canvas, 192×108 logical pixels, sprites as string maps),
  `components.tsx` (Bar, Pips, Modal, RankChart, money/compact formatters), `Icon.tsx` (inline SVG icon set).
- `src/styles/tokens.css` (design tokens, light + dark), `base.css` (primitives), `app.css` (layout and panels).

## Conventions

- TypeScript has `erasableSyntaxOnly` on: no `enum`, no parameter properties. Use string-literal unions and `as const`.
- Sim code never imports from `ui/` or `state/`. UI never mutates game state directly; call store actions.
- Log entries: `addLog(state, kind, text, toast)`. `toast: true` only for things the player must notice; chapter results
  and money events are toasts, daily chatter is not. Identical toasts are de-duplicated by the store.
- The clock auto-pauses whenever the game needs a decision (manuscript ready, poll result, serialisation offer,
  a serial is cancelled, a trip ends). Keep it that way for any new blocking decision.

## UI rules (from the design pass)

- Icons are inline SVG via `<Icon name=... />`. No emoji in the interface.
- Labels are sentence case (`.lbl` class), never tracked all-caps. No middle-dot `·` separators in copy; use commas
  or sentences.
- Buttons say what they do ("Submit manuscript", "Wrap up the series"). Errors and empty states say what to do next.
- Touch targets are at least 44px on coarse pointers (`base.css` handles `.btn` and `.seg button`).
- Colours come from tokens (`var(--accent)` etc.), never raw hex in components. Both themes must work.
- Charts: one axis, thin marks, direct label on the last point, hover tooltip, a table view alongside.
- Every result explains itself (the "show the why" pillar). Never add a hidden modifier without a UI hint.
- On phones (<= 640 px) the desk renders above the studio scene and the HUD is a two-row strip; the Today control
  must be visible without scrolling in the drawing phase at 375x667 with the getting-started box dismissed.

## Balance touchpoints

Starting stats 34/38/30, rivals score 45–62, weekly living cost 400, one-shot 20 pages (~17 days solo),
chapter 16 pages. If you change formulas, re-run the balance script and keep one-shot scores in the 40–55 range
for a fresh player.
