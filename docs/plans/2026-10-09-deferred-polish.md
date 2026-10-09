# The Rising Mangaka: deferred polish after 0.10.0

## Context
The 0.10.0 release (the tutorial, the cast redraw, the room polish) shipped with four small deferred findings from its
reviews: the editor's eyes barely show inside his glasses, the flat's generated wainscot snaps to the same honey as its
code-drawn floor, the flat's wallpaper has one stripe twice as wide as the rest, and the room walls' colour bar (a
flat plaster, two clean stripe tones) was checked once by hand and is not held by a test. Branch `fix/0.10.1-polish`;
the owner bumps the version.

Global constraints: the repo's CLAUDE.md rules (TDD, `npx tsc -b`, `npm test`, `npm run lint`, `npm run build` exit 0;
the palette rule; exact fill baselines; `art.test.ts` imports no sharp); the sim and the save format untouched; one
commit per task, each ending with the session's co-author trailer.

## Task 1: the flat's wall and the walls' colour test

The controller rerolled the flat on the HF Space (`hf-space:mcp-tools/Z-Image-Turbo`, `Z-Image-Turbo`,
`2048x1152 ( 16:9 )`, steps 8, shift 3, seed 795291) and placed the raw at `art/raw/rooms/flat.png` (uncommitted):
regular stripes and a dark walnut wainscot. Its prompt:

> Completely empty 16-bit pixel art video game background, straight-on orthographic view of the back wall of a small studio flat, no perspective, no side walls, no furniture, no window, no door, no rug, no objects, no people. Top: white ceiling with a thin wooden crown moulding. Middle: classic regency striped wallpaper, a strictly regular pattern of identical vertical stripes, each teal stripe and each pale grey-teal stripe exactly the same width, evenly spaced like a printed pattern, the same stripe repeated thirty times across the wall, above a dark walnut-brown wood wainscot panel on the lower third of the wall, with a dark wooden rail on top of the wainscot. The wall meets the floor in a perfectly straight horizontal line at 80 percent of the image height; the floor may be cut off. Bottom: a thin strip of light honey-coloured wooden plank floor. Perfectly flat even lighting, no vignette, no gradient, no light pool, no shadows, uniform colours, limited palette, crisp pixels, no text.

1. Set `room/flat`'s recipe: the seed and prompt above, a `crop` that trims the side-wall corner at the left edge (raw
   x about 0-90) and anything similar at the right, a measured `seam.src` (the first floor row after the crop, the
   way the 0.10.0 C1 entries were measured), `floor: "code"`, `native [320, 114]`, `lightness` (start at 0.15), no
   `flatten` (it would merge the stripes). `npm run art -- room/flat`.
2. Gate: a 4x composite of the new wall over the old (`git show HEAD:src/assets/art/room/flat.png`) with the code
   floor's honey `#c8894e` block under each; the stripes must be even, two clear tones, and the wainscot visibly a
   different, darker wood than `#c8894e`. Report the PNG's colour list with counts.
3. The test, written first (`src/ui/__tests__/art.test.ts`, no sharp: decode the committed 8-bit indexed PNGs with
   `node:zlib` `inflateSync` and the five PNG filter types; extend the file's existing `parsePng` or add a small
   `decodeIndexed` helper beside it, failing loudly on any bit depth other than 8 or interlaced data). For each room,
   a plaster box in output coordinates holds at most N distinct colours: the apartment's plaster (a box well inside
   the plaster, clear of the beam and baseboard) and the loft's (clear of the beam, the brick column and the
   baseboard) at most 2; the flat's wallpaper box holds only the two stripe tones plus at most one edge tone, and its
   wainscot box shares no colour with the flat's code floor (`#c8894e` and its line `#a86d3a`, read from `roomArt.ts`'s
   flat floor). Derive each box by reading the PNGs; say how in a comment. Watch the flat's wainscot check fail
   against the old flat PNG (RED) before regenerating.
4. Docs: DESIGN.md "The walls (0.10.0, Release C)" gets the flat's new recipe (seed, crop, seam, lightness) and one
   sentence on the reroll (the even stripes and the walnut wainscot, 0.10.1) and on the new colour test.

## Task 2: the editor's eyes

`EDITOR_HEAD` (`src/ui/scene/sprites.ts`) draws two 4x3 `P` lens frames with the `E`/`W` eye inside; `P` is
`#3b3b45` (`spriteCore.ts`), almost as dark as `E` `#1b1b1b`, so at scene scale each lens reads as a dark block. `P`
is used by the editor frames only. Change `PAL.P` to a lighter steel that keeps `E` and `W` legible inside it and the
frame legible against skin `S` (start from `#6b6b78`, a colour roomArt.ts already uses); test first in
`sprites.test.ts` (the frame colour differs from `E` by a real margin: an OKLab or simple luminance difference you
state, and differs from `S`); update render.test's editor glasses probe hex. Gate with
`npm run sprites -- <scratch>/sprites-polish.png` (row F, the editor) and read it. No baseline moves (no reference
scene draws the editor).

## Task 3: the flat's wall drawn in code (replaces Task 1's reroll)

Task 1 was blocked: in five HF generations Z-Image gave even stripes only under a light pool, or flat light only with
uneven stripes. The owner ruled (2026-10-09): drop the flat's generated wall and draw it in code; the apartment and the
loft keep their generated walls.

1. Remove the flat's image: delete the `room/flat` entry from `art/manifest.json`, `src/assets/art/room/flat.png` and
   `art/raw/rooms/flat.png` (git keeps them); `ROOM_ART` in `src/ui/art/registry.ts` lists the apartment and the loft
   only (type it so a tier may have no wall image; `sceneImages.ts` then leaves `room.flat` null and `render` paints
   `drawRoomShell` for the flat, wall and floor in code, with their own night colours and no dim). Update every test
   that lists the three rooms (art.test's room test, sceneImages tests, StudioSceneArt tests) to the rule "the
   apartment and the loft have wall images; the flat is code-drawn".
2. Redraw `flatWall` in `src/ui/scene/roomArt.ts` (test first in roomArt.test): bold even stripes, a pale ground
   (`#cbc7bf` by day) with sixteen 10-px teal stripes (`#6f9a90` by day) every 20 px, the same fill count as today's
   sixteen thin stripes; a dark walnut wainscot (body, rail and panel grooves from the palette's dark woods, for
   example `#8a5f3a` body, `#5a3d28` rail, `#6e4a2c` grooves) that shares no colour with the flat's floor (`#c8894e`,
   `#a86d3a`); the frame, ceiling, baseboard and trim as today. Hand-pick the night colours (each a dimmer, bluer
   version of its day colour, the way `apartmentWall`'s night colours are). The flat stays within the 84-fill cap (it
   is 83 today); state the new wall count in its docblock. Tests: the stripes are 10 px wide and 20 px apart across
   the wall; no wainscot colour equals a flat floor colour, day and night; the cap.
3. The palette rule: every `ART_PALETTE` colour must stay literal in `src/ui/scene/*.ts` or `tokens.css`. A colour the
   redraw stops using and no committed PNG holds leaves `SCENE_ADDITIONS` (and art.test's `ROOM_COLOURS` list); one a
   PNG still holds stays literal somewhere it is really drawn. Say what moved.
4. The colour test from Task 1 for the two image walls: decode the apartment's and the loft's PNGs in art.test (no
   sharp: `node:zlib` and the PNG filters, 8-bit indexed only, failing loudly otherwise) and hold each plaster box at
   at most 2 colours, the boxes read off the PNGs and explained in a comment.
5. Baselines: re-measure every exact fill baseline the redraw moves (the reference scenes are the apartment, so
   probably none) and keep `npm run check` green.
6. Docs: DESIGN.md "The walls" gets the ruling (the flat's wall is code-drawn since 0.10.1, why) and the scene-images
   table row for `ROOM_ART` (the apartment and the loft); CLAUDE.md's `sceneArt.ts` line ("generated room walls") says
   the flat has none.
