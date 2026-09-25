# The Rising Mangaka

A manga-career management game inspired by Kairosoft's *The Manga Works*, rebuilt with a modern, transparent,
low-friction interface. Plan a manga, draw it page by page, pitch it to a magazine, read the poll results, and
climb from one-shots to a serialised hit with a studio of assistants.

## Play it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Saves live in your browser.

## Design pillars

1. **Show the why.** Every poll result explains its score component by component.
2. **Discovery, not grinding.** Hidden genre, theme, and audience pairings are recorded in a Notebook as you learn them.
3. **Never interrupt.** Events go to a log and toasts. The clock pauses only when you need to decide something.
4. **One screen, one job.** A persistent HUD, one studio view, one contextual desk panel.
5. **Hybrid look.** A pixel-art studio scene with clean, modern management panels.

See [DESIGN.md](DESIGN.md) for the systems, formulas, and roadmap, and [CLAUDE.md](CLAUDE.md) for the code
conventions.

## Stack

Vite, React 19, TypeScript, Zustand. The simulation is a pure, seeded TypeScript library under `src/sim` with
Vitest tests; the UI never touches game rules directly.

```bash
npm test                              # simulation tests
npx tsc -b                            # type check
npm run build                         # production build
npm run balance -- 1 20               # balance bots over seeds 1-20 (add --detail 42 for one seed's full readout)
```
