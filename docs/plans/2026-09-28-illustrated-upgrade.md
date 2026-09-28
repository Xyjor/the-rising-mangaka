# The Rising Mangaka: the illustrated upgrade (0.5.0 → 0.7.0)

## Context
The Hugging Face MCP (`hf-mcp-server`) can now generate images. Z-Image-Turbo works. Qwen-Image-Fast currently
fails with a ZeroGPU RuntimeError. FLUX.1-Krea-dev is the fallback. The owner wants to use it to upgrade the game
and chose:
- **Hybrid art.** The live 320x180 scene and its string-map sprites stay code-drawn (fillRect only; the
  `render.test.ts` 659 and `studioArt.test.ts` 1065 budgets stay intact). Generated images ship only as static
  illustrations, and also serve as references for hand redraws of the scene.
- **Scope.** Visual overhaul, merchandise, save slots and achievements, and more content.

Probes during planning:
- Title key art, badge set and portrait sheet were usable.
- The event scene was usable but invented garbled sign text.
- Lessons: generate groups (portraits, badges) as **one sheet, then slice**, to keep the style consistent. Always say
  "no text, no letters, no signs". There is no negative prompt, so all of that goes in the positive prompt.

Three releases, one branch each, stacked like 0.3.0/0.4.0. The owner merges each and runs `npm version minor`:
- **0.5.0 visuals.** Builds the art pipeline that every later art id needs.
- **0.6.0 save slots and badges.** No balance impact. The only release that touches stored saves, so it ships alone.
- **0.7.0 merch and content.** Both move money and popularity, so they share one balance pass and one ruling.

Every task ends with `npx tsc -b`, `npm test`, `npm run build`, `npm run lint` and `npm run contrast`, then
`npm run check` at the end of each release. UI changes are checked in the preview (`preview_start {name:"dev"}`) at
desktop and 375x667, in light and dark.

---

## 0.5.0 "The illustrated studio" (branch `upgrade/0.5.0`)

### 1. Asset pipeline
- **`art/raw/<id>.webp`** holds the downloaded generations, committed outside `src` (about 5 MB, never shipped).
  The Space and model can change, so a seed alone won't reproduce an image.
  - Each generation is made with `random_seed:false` and a recorded seed.
  - It is downloaded from the returned URL with `curl` into `art/raw`.
- **`art/manifest.json`** has one entry per asset:
  `{ id, model, resolution, seed, steps, shift, prompt, preamble: "scene"|"cutout", native:[w,h], sample: "area"|"nearest", cutout, outline, crop?, sheet?: {src, cell} }`.
- **`src/ui/art/palette.ts` `ART_PALETTE`** is about 48 colours taken from `PAL` (`sprites.ts`), `looks.ts`, the
  `roomArt.ts` colours (export them) and the token fills. It is one list shared by the script and the tests, so
  the art uses the scene's colours.
- **`scripts/pixelate.ts`** runs as `npm run art -- <id>|--all` through vite-node, like `contrast.ts`. It uses
  `sharp` as a new devDependency (decodes webp, prebuilt win32, writes indexed PNG). Steps:
  1. Crop or slice the sheet cell.
  2. For a cutout, flood-fill the plain background to alpha, trim and pad.
  3. Area-average down to the native grid.
  4. Snap each pixel to `ART_PALETTE` in OKLab, no dithering, at most 16 colours per asset.
  5. Add an optional 1 px `#1c1a26` outline.
  6. Write `src/assets/art/<id>.png` as an indexed PNG.
  7. Verify the output uses only palette colours.
- **`vite.config.ts`**: set `build.assetsInlineLimit` so art is never inlined. It becomes hashed files, which
  the Tauri CSP `img-src 'self'` already allows.
- **`src/ui/art/registry.ts`** loads the files with `import.meta.glob` and exposes typed records keyed by content
  ids (`GENRE_ART: Record<GenreId, ArtRef>`, and the same for `THEME_`, `MAGAZINE_`, `EDITOR_`, `PLACE_`, `EVENT_`,
  `ANIME_`, `AWARD_`, `EQUIPMENT_`, `TIER_`, `RIVAL_` and `TITLE_ART`). A missing key fails `tsc`, the same way
  `TIER_ART` does.
- **`src/ui/art/PixelArt.tsx`** renders `<img>` at integer scale with `image-rendering: pixelated`, lazy
  loading, and `alt=""`, since each image sits next to its text name. The title hero is the exception and gets
  real alt text.
  - `base.css` gets `.pixel-art` and `.art-frame` (a token background, so dark-mode cutouts keep contrast).
- **`src/ui/__tests__/art.test.ts`** (node environment) checks:
  - manifest ids are unique;
  - raw and png files exist and there are no orphans;
  - the PNG header size equals `native` and the registry size;
  - every PNG is indexed and every palette entry is in `ART_PALETTE`;
  - every registry id is in the manifest;
  - size caps: 16 KB for the hero, 4 KB for each other asset, 100 KB in total;
  - every `ART_PALETTE` colour comes from `PAL`, `looks`, `roomArt` or the tokens, so the palette cannot drift.

### 2. Assets (61) and where they mount
| Asset | Native size | Mounts in |
|---|---|---|
| `title/hero` | 320x180 | `TitleScreen`, full bleed behind the card, with a new `--title-scrim` token |
| `magazine/*` ×4 | 36x48 | `SubmitModal` `.mag-cover` (2x), `OfferModal` hero, `SeriesModal` header |
| `editor/*` ×4, one sheet | 32x32 cutout | `OfferModal` hero, `ResultsModal` editor comment |
| `rival/portrait` | 32x32 cutout | Career rival section, Results rival line, `YearModal` |
| `place/*` ×8 | 64x40 | `TripsModal` `.postcard[data-place]` (the stub already exists at `app.css:281`) |
| `event/*` ×6 | 96x54 | `EventCard` header |
| `anime/*` ×2 | 48x32 | `AnimeOfferCard` studio columns |
| `award/*` ×4, one sheet | 32x32 cutout | `YearModal`, `YearReviewCard`, Career |
| `equipment/*` ×6, `tier/*` ×3 | 32x32 cutout / 96x54 | `StudioModal` rows |
| `genre/*` ×10, `theme/*` ×12, sheets | 32x32 | `NewMangaWizard` `.choice` cards |

**Prompt preambles.**
- *scene*: "16-bit pixel art, SNES-era illustration, limited palette of warm cream paper, navy ink outlines, manga
  red, honey wood, teal, soft golden light, hard edges, no anti-aliasing, no text, no letters, no signs, no logos,
  no UI."
- *cutout*: the scene preamble plus "single subject centred, whole subject visible, plain flat pale grey
  background, no cast shadow".
- Portraits face three-quarter left, matching the sprites.
- Event prompts ask for blank banners.

### 3. HUD and modal polish (CSS, tokens only)
- **Stepped corners.** A `.px-corners` utility with a `clip-path` of 3 px steps, extended so the hard offset
  shadow still shows. It goes on `.badge-hud`, `.card`, `.modal`, `.btn` and `.choice`.
  - The clip cuts outlines, so `:focus-visible` becomes an inset ring.
- **Dark status card.** New `--hud-dark` / `--hud-dark-ink` tokens in both themes, with the pairs added to
  `scripts/contrast.ts`.
- **Money colour.** Positive money turns `--gold-text`. Accent stays reserved for negative money (the existing
  `.neg` signal), so I did not borrow the mockup's red money.
- **Rail badges.** Square pixel badges. The raw `#fff` in `hud.css` becomes `var(--accent-ink)`.

### 4. Scene redraw from the references (fillRect, re-measured by hand)
- A wider daylight shaft (+0).
- Wood-beam framing on the flat and loft back walls (about +4 in `BARE_FULL`).
- The spring cherry branch spills past the pane (about +3).
- The corkboard becomes a 2x3 grid, so a card per sixth of the pages. Update `story.test` and the DESIGN table.
- The cat gets a cream chest patch and a round cushion at `CAT_BED`.
- `MANGAKA_PANIC` becomes hands on head (+0; neither baseline renders it).
- Mood marks move to the head's top-right (+0).
- Outfits keep the collar and tie through new `K`/`Y` palette keys (about +3 per seated figure; the assistants map
  them in `ASSISTANT_PALS`).
- Expect 659 → about 680 and 1065 → about 1095, well inside 1.5x. Record every delta in the test docblocks and
  DESIGN.md. Every frame still passes `frameRules`.

### 5. Task order
1. Pipeline and `PixelArt`, seeded with the title hero.
2. Title hero.
3. People and places: magazines, editors, rival, places, events.
4. Choices and things: genres, themes, equipment, tiers, awards, anime.
5. HUD polish.
6. Scene redraw, one commit per item, each re-measuring baselines.
7. Docs.

Each mount gets a happy-dom assertion in its existing panel test (`src/ui/__tests__`, fixtures from
`src/test/fixtures.ts`). Docs:
- DESIGN.md: a new "Art" section and a hybrid-art ruling.
- CLAUDE.md: the `art/`, `src/assets/art`, `src/ui/art` and `scripts/pixelate.ts` lines, and fix the stale
  "studioArt.test.ts 1048" to 1065.

---

## 0.6.0 "Careers and badges" (branch `upgrade/0.6.0`, no sim balance impact)

### Save slots (3)
- **Storage.** Each career lives in `rising-mangaka-save-1..3`, holding `{game, resumeSpeed, tutorialStep}`. The
  index `rising-mangaka-slots` holds only `{active}`. Theme and sound move to `rising-mangaka-prefs`.
- **Summaries.** Slot cards read their summary from each slot's own JSON through `slotSummary(raw)` in
  `saveFile.ts`, so there is no second copy to go stale.
- **Migration** (`src/state/slots.ts` `migrateLegacy()`, before hydration). If the old `rising-mangaka-save`
  exists and slot 1 is empty:
  1. copy it into slot 1;
  2. read it back and check it;
  3. only then set `active: 1`.

  **The old key is never deleted**, which also keeps a downgrade working. Tests cover: the old key only; old key
  plus a full slot 1 (no overwrite); a write failure (the old key is still used).
- **Store** (`store.ts`).
  - `switchSlot(n)` calls `flushSave()` first, then changes the key through `persist.setOptions({name})` and
    `rehydrate()`.
  - `backToTitle` flushes the save and keeps the career.
  - `deleteSlot(n)` sits behind a confirm row.
- **Tab lock.** Still one lock for the app. A read-only tab mirrors the owner's active slot, and the slot picker is
  disabled when read-only. Desktop is unchanged.
- **Title screen.** Three slot cards:
  - a filled slot offers Continue, Export save file, Load a save file into this slot (with an overwrite confirm) and
    Delete this career;
  - an empty slot offers Start a new career here.
- **Error boundary.** `ErrorBoundary` exports and clears the active slot.

### Badges (about 15, separate from the 18 milestones)
- **Sim.** `src/sim/badges.ts` defines `BADGES` entries `{id, title, hint, hidden, done(prev, s)}`. `awardBadges`
  is the last step of `tick()`, after `awardMilestones`. It uses no RNG and grants **no XP**, so it is
  balance-neutral.
- **State.** `GameState.badges: {id, day}[]`. `upgradeSave` grants the badges an old save already qualifies for,
  quietly, with no burst of toasts.
- **Profile.** A cross-save profile `rising-mangaka-profile` (`src/state/profile.ts`) collects every badge ever
  earned. Only the tab that owns the save writes it.
- **List:**
  - all-nighter (collapsed while drawing), cancelled, golden-pen, grand-slam (all four awards), first-place,
    rival-10;
  - stop-presses (a missed issue), ramen-budget (a week ending in debt), perfect-pair, anime-signed,
    anime-declined;
  - the-loft, fully-equipped, century (100 chapters), millionaire.
- **UI.** A Badges rail button opens a `narrow` `BadgesModal` grid. Hidden badges show "???" with a hint. Each
  badge is marked this career or an earlier one.
- **Toast and cue.** A success toast "Badge: …", with the milestone cue via `triggers.ts`.
- **Art.** `badge/*` plus `badge/locked`, generated as two sheets through the 0.5.0 pipeline.
- **Docs.** DESIGN.md: "Save slots" under the desktop and save files section, and a new "Badges" section.

---

## 0.7.0 "Goods and gossip" (branch `upgrade/0.7.0`, one balance pass)

### Merchandise
- **Gate.** A licence arrives the first day after year one, once a volume has shipped. It toasts, no pause. Year
  one is untouched, so S1 and `EQUIPMENT_PRICE_SCALE` don't move.
- **Items.** `MERCH_ITEMS` in `data.ts`: keychain, poster, plush, artbook (needs 4 volumes), figure (needs an anime
  deal). Each has a plain yen `cost` (not scaled), `weeks`, `share` and `margin`.
- **Sim** (`src/sim/merch.ts`, no RNG, does not import engine.ts).
  - `orderMerch` is a pure command, with at most 2 runs.
  - `merchForecast` is shown before buying (the "show the why" pillar).
  - `merchTick` goes after `animeTick`. It pays weekly as log lines and toasts when a run sells out.
  - Merch changes money only, never fans or popularity, so there is no feedback into `volumeCopies`.
- **Tuning target.** A 1.2–1.5x return at popularity 80, and a forecast loss below about 55. A `merch.test.ts`
  case pins this.
- **Bot.** The sensible bot orders the cheapest item once it holds the cost plus four weeks of costs. Watch the
  anime row with `npm run balance`.
- **UI.** A Goods section in `SeriesModal`, with a lock text naming the unlock rule, item art, a forecast and
  "Order a run for ¥X". Career shows total merch money.

### Content
- **Six new events,** appended to `EVENT_IDS`: interview, signing (an event-only 1-day trip), editor-dinner, cover,
  assistant-sick, rival-challenge (`GameState.rivalChallenge`, settled by `settleChallenge` after
  `checkDeadline`). None changes player stats.
- **New places.**
  - Listed on the Trips panel: `manga-museum` (reveals a pairing for a genre you have never drawn) and
    `mountain-retreat` (full stamina, max stamina +5).
  - Event-only: `signing`.
- **Editor personas**, visible on the Submit and Offer cards:
  - Mori is a cheerleader, unchanged.
  - Tanaka is a deadline hawk: a log hint when a deadline turns tight.
  - Sato is a mentor: a Notebook tip every 2 points.
  - Kuroda is a critic: tips every 4 points, and his comments quote the points lost.
- **Rival temper.** Gracious, cocky or stoic, hashed from the world seed. It changes text only.
- **Art.** New `event/*`, `place/*` and `merch/*` assets, plus the `sold-out` badge.

### Balance
Rows near their limits:
- the first-score row (13/20, median 44) is protected by design;
- rival win share: 71% against a 75% cap;
- events per year;
- Golden Pen;
- equipment;
- anime.

Run `npm run balance -- 1 20` and `--detail <seed>` on any seed that moves. Tune content effect sizes, not the
thresholds; thresholds need owner sign-off. Record a ruling, and re-derive the `events.test.ts` seed literals by
hand (a bigger pool changes each roll).

Tick order after 0.7.0:
… `checkDeadline` → **`settleChallenge`** → `closeYear` → `animeTick` → **`merchTick`** → `eventTick` →
`awardMilestones` → **`awardBadges`**. `SAVE_VERSION` stays 2; every new field can be defaulted.

---

## Verification (each release)
- `npx tsc -b`, `npm test` (including `art.test`, `balance.test`, the new sim and state tests), `npm run build`,
  and `npm run check`.
- `npm run balance -- 1 20` before and after (0.7.0 must stay in every band).
- Preview:
  - title screen, wizard, Submit, Trips, Studio, Events and Badges at desktop and 375x667, light and dark;
  - the scene in all four seasons, day and night;
  - screenshots shared as proof.
- 0.6.0: a manual migration check. Seed the old `rising-mangaka-save` in localStorage, reload, and confirm slot 1
  is identical and the old key is still there. Then do the same in the Tauri debug build
  (`npx tauri build --debug --no-bundle`).
