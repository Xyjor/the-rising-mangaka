# The Rising Mangaka

A manga-career management game inspired by Kairosoft's *The Manga Works*, rebuilt with a modern, transparent,
low-friction interface. Plan a manga, draw it page by page, pitch it to a magazine, read the poll results, and
climb from one-shots to a serialised hit with a studio of assistants. Runs in the browser or as a Windows desktop
app; a career saves itself as you play either way.

## Design pillars

1. **Show the why.** Every poll result explains its score component by component.
2. **Discovery, not grinding.** Hidden genre, theme, and audience pairings are recorded in a Notebook as you learn them.
3. **Never interrupt.** Events go to a log and toasts. The clock pauses only when you need to decide something.
4. **One screen, one job.** A persistent HUD, one studio view, one contextual desk panel.
5. **Hybrid look.** A pixel-art studio scene with clean, modern management panels.

See [DESIGN.md](DESIGN.md) for the systems, formulas, and roadmap, and [CLAUDE.md](CLAUDE.md) for the code
conventions.

## Play in the browser

```bash
npm ci
npm run dev
```

Then open http://localhost:5173. Your career saves itself to the browser as you play (see "Where saves live"
below).

## The desktop app

The same game also ships as a Windows desktop app, built with Tauri 2: one window around the same build, no
separate server.

```bash
npm run tauri dev     # a desktop window against the dev server; stop any running `npm run dev` first
npm run tauri build   # a Windows installer, in src-tauri/target/release/bundle/nsis/
```

The installer is unsigned, so Windows SmartScreen may warn about an unrecognised app on first run: choose
**More info**, then **Run anyway**. Installing over an older version keeps your save.

The desktop build remembers its window's size, position, and whether it was maximised between runs, brings its one
running window forward instead of opening a second, and pauses the clock (and the sound) while minimised. F11
toggles full screen.

## Where saves live

- **In the browser:** your career lives in `localStorage` under the key `rising-mangaka-save`, in the browser
  profile you played in. Clearing that browser's site data for the game erases it.
- **In the desktop app:** the same browser storage lives inside the app's own WebView2 profile, under the app's
  identifier (`com.xyjor.risingmangaka`) in `%LOCALAPPDATA%`. The window's remembered size and position are stored
  separately, under the same identifier in `%APPDATA%`.

Either way, only one tab or window plays at a time: a second browser tab mirrors the game read-only until you take
over, and the desktop app only ever opens one window.

## Save files

Settings has a **Save file** section (and the title screen offers **Load a save file** before a career starts):

- **Export save file** writes your current career to a `.json` file, named after your pen name and the in-game
  date (for example `rising-mangaka-rin-hoshino-year-2-month-1.json`). Keep it as a backup or move it to another
  computer.
- **Load a save file** reads an exported file back in, replacing the game in progress (with a confirmation first if
  one is running). A file from an older or newer version of the game, or one that is not a Rising Mangaka save, is
  refused with a message that says what to do next.
- If the game ever crashes, a recovery screen offers to export your current save before you start over.

## Releasing

Pushing a tag named `v*` (for example `v0.1.1`) runs `.github/workflows/release.yml`: it checks the tag names
`package.json`'s version, runs the tests, builds the Windows installer, and drafts a GitHub release with the
installer attached (drafts are not public until published by hand). The workflow can also be run without a tag
(`workflow_dispatch`) to just build and upload the installer as a run artifact.

`npm version <patch|minor|major>` bumps `package.json`'s version and, through the `version` script, keeps
`src-tauri/Cargo.toml` (and its lockfile) in step, so the desktop build always reports the same version as the web
one; commit and tag that bump, then push both (`git push --follow-tags`) to trigger the release. `npm run
version:check` (what CI runs) fails if the two files disagree, and, given a tag name, also fails unless the tag
names that version.

## CI

`.github/workflows/ci.yml` runs on every push and pull request: a version check, lint (warnings fail the build),
type check, the test suite, the production build, the contrast gate, and a balance smoke run. `desktop.yml` runs
whenever `src-tauri/` or `package.json` changes: Rust format and clippy checks and the Rust unit tests. Both need
GitHub Actions billing enabled on the account to run at all; the repository is private, so nothing here is hosted
for players.

## Stack

Vite, React 19, TypeScript, Zustand for the browser and desktop UI; Tauri 2 for the Windows desktop shell; Web
Audio, synthesised, for sound (no audio files). The simulation is a pure, seeded TypeScript library under `src/sim`
with Vitest tests; the UI never touches game rules directly.

```bash
npm test                              # simulation, state, and UI tests
npx tsc -b                            # type check
npm run build                         # production build
npm run balance -- 1 20               # balance bots over seeds 1-20 (add --detail 42 for one seed's full readout)
```
