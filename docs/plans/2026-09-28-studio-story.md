# The Rising Mangaka 0.3.0: The Studio Tells the Story — Implementation Record

> Executed test-first (test-driven-development skill): each piece had a failing test before its code. The design
> direction came from the frontend-design skill (a deliberate palette per tier, one memorable element: the daylight
> shaft on the floor). The gate (`npm run check`) was run before calling it done, then checked by eye in the browser.

**Goal:** Make the 320×180 studio read as a warm, deep room that shows each studio tier and pictures the game's state,
without touching the sim or the character sprites.

**Branch:** `upgrade/0.3.0` from `main` (0.2.0). The owner reviews, merges and versions.

## Context

After 0.2.1 the people are real, but the room around them was flat. Every object stood on one line against the wall.
The floor was an empty brick-like grid over 40% of the canvas, the walls were plain stripes, there were no shadows,
and the palette was muted grey-brown. On desktop the dock covered the lower middle of the scene, and the scene barely
reflected the game: only `progress`, `stamina` and `late` reached it.

## Decisions (owner, 2026-09-28)

1. **Scope: the room and the story props.** The character sprites stay. Chibi characters are a separate, later upgrade.
2. **Floors by tier: tatami, then wood, then the loft.** The starter apartment is the classic six-mat mangaka room.

## Decisions (Claude)

3. **A new painter file, `roomArt.ts`.** It holds the room, the front row, the story props and the light, all in
   canvas space. `studioArt.ts` keeps the equipment. The inputs for the story props come from a pure `story.ts`
   (`storyLook`), so the sim is untouched and the Snapshot gains five primitives.
4. **Furniture colours are unchanged.** The tests pin them (the replacement tests list exact fills). The warmth comes
   from the new walls and floors, the rugs, the shadows and the light instead of a palette pass on every piece.
5. **Light only through rgba `fillRect`.** The fake canvas has no gradients, so the daylight shaft, the lamp's pool and
   the vignette are stepped bands, drawn after the night overlay in a separate `drawAmbient`. This keeps
   `drawStudioLights`' region test intact.
6. **Hiding the desk, not a new dock layout.** The status card covers the scene's lower middle at every desktop width.
   An eye button left of Settings (and the D key) tucks the dock away (`hidden`, so the cards stay mounted). The flag
   is not saved, and the auto-pause for a decision brings the desk back. Phones don't show the button (their scene is
   a band above the desk).

## What shipped

- **Task 1: the rooms (`TIER_ROOM`).**
  - Apartment (61 fills): tatami with dark-green cloth edges, wooden pillars and a nageshi beam.
  - Flat (80 fills): teal wallpaper, wainscot, honey planks and a red rug.
  - Loft (67 fills): brick accent, polished concrete and an indigo rug.
  - Every room gets a light switch and an outlet.
- **Task 2: contact shadows** (`paint.ts` `shadow`). Under the fridge, the counter, the bookshelf, the desk, the bed,
  the staff desk, the standing or walking mangaka and the editor.
- **Task 3: the front row** (`TIER_FRONT`), drawn after the actors:
  - apartment: a zabuton and manga boxes;
  - flat: a fern and a stack of books;
  - loft: a floor lamp and a sofa corner;
  - every tier: the bin.
- **Task 4: the story props:**
  - the corkboard (storyboard cards, the last poll's note);
  - the calendar (the due day circled, the last three days in red, blinking when late);
  - coffee cups (low stamina);
  - the serial's cover in the poster's place;
  - fan letters on the doormat;
  - the bin's crumpled pages.
- **Task 5: the light** (`drawAmbient`): the daylight shaft sliding with the sun, the lamp's pool at night while
  working, the tablet's glow and the vignette.
- **Task 6: hiding the desk.** `deskHidden`, `toggleDesk`, `DeskButton` with the new `eye` icon, and the D hotkey.
- **Task 7: docs and baselines.**
  - The reference frame is 596 → 649 fills (budget 973.5).
  - The bare full scene is 973 → 1025 (budget 1537.5).
  - The busiest scene with every story prop is 1371.
  - DESIGN.md "The studio in the scene" and CLAUDE.md are updated.

## Tests

- `src/ui/scene/__tests__/roomArt.test.ts`: the rooms, the front row, each story prop, the light and the shadows.
- `src/ui/scene/__tests__/story.test.ts`: `storyLook`.
- `src/ui/__tests__/deskToggle.test.tsx`: the button, the D key, and the auto-pause bringing the desk back.
- `render.test.ts`: the pinned wall-stripe and plank fills are replaced by "each tier's wall and floor across the whole
  canvas, first", and both baselines are re-measured.

## Verification

- `npm run check` passes: version sync, oxlint with warnings denied, `tsc -b`, 1056 tests, the build and contrast.
- Browser pane:
  - each tier by day, and the apartment at night with the story props, rendered from the real `render`;
  - the live game at 1280×720 with the desk shown and hidden;
  - a 375×812 phone (the front row visible in the band, no eye button).

## Later (not in this upgrade)

- Chibi characters (about 2.5 heads), an expression layer and more idles: every frame redrawn.
- Seasonal furniture (a kotatsu in winter, a fan in summer).
