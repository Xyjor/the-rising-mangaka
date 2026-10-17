# The cast rig: 32x48 characters and real animation (design)

Date: 2026-10-09. Owner-approved in conversation (four questions and two design checkpoints). Supersedes the 24x32
frame contract of DESIGN.md "The sprites" for every character, release by release.

## Goal

Make the studio's people and cat read as characters that live in the room: bigger (1.5x), more detailed, and animated
with smoother cycles, transitions between poses, idle life and reactions to what happens in the game. Keep the
chibi look and the game's pixel style; keep the pillars (never interrupt, show the why).

## Decisions (the owner's)

| Question | Decision |
|---|---|
| What may grow | The characters' size (not the scene's resolution) |
| Size | People 32x48 (1.5x of 24x32), the cat 18x12 (1.5x of 12x8); the scene stays 320x180 |
| Proportions | Chibi, two heads tall: a head of about 22 rows on a body of about 26 |
| Animations | All four: smoother cycles, transitions, idle life, reactions |
| Cast | Everyone: the mangaka, the assistants (the mangaka's frames in their own palettes), the editor, the cat |
| Method | A part rig with hand-drawn parts, plus hand-drawn key frames for poses the parts cannot make |
| Releases | 0.11.0 the engine with the mangaka and assistants; 0.12.0 the editor; 0.14.0 the cat |

## 1. The rig and the art

**Parts.** A character is a stack of layers drawn back to front: back arm, back leg, front leg, torso, head, front
arm, held prop (pen, mug, briefcase). Each part is a string map in today's format (one key per pixel; uppercase base,
lowercase shade, `L` outline, `.` clear; the palette swaps outfits and assistant looks) with named anchor points
(neck, left and right shoulder, left and right hip, hand). A pose is a record: for each layer, which drawing and the
offset that puts its anchor on the torso's matching anchor. The assembler (`assemblePose`) composes a pose into one
32x48 frame (later layers paint over earlier ones; `.` is see-through) and closes the outline where two parts meet.

**The head.** A new hand-drawn chibi head (about 22x24) replaces `ANCHOR_HEAD`: hair, face, ears, and three slots:
the eyes (a small set of eye drawings: open, blink, closed, ring, squint, happy), the mouth (closed, open, smile,
frown, O) and the mark (above the head's top-right, as today's `MARKS`). Moods become a choice of eyes, mouth and mark
rather than today's 14x4 `FACES` overlay; the editor's head is the same construction with glasses drawn over the eye
slot. The staff portrait (`SpriteAvatar`) crops the new head.

**Key frames.** Poses the parts cannot make well are hand-drawn whole frames in the same format: lying in bed (48x32,
since a person lying down is wider than tall; the 0.10 bed pose was 30x14), panic (hands on head), the cheer (arms
up), tearing up a page, the slump (32x48 each). They use the same palette and pass the same
rules, and a pose may name a key frame instead of parts.

**Rules every frame keeps (tested).** Width and height exact; every key in the palette; a closed outline on every
painted row; feet on the last row (people) or the frame's floor row (the cat); the head's face slots hold only face
keys; every frame of one animation shares one body (its torso drawing and anchor positions) so a loop never switches
bodies mid-cycle. Part rules: each part's anchors exist and are inside it; parts meet at their anchors in every pose.

**Gate.** `npm run sprites` grows: per animation, a strip of its frames at 8x beside the 0.10 frames it replaces, in
each outfit and assistant look, plus the head's every eye, mouth and mark combination. Each art task is gated on the
sheet and on the running scene (zoomed, both themes, phone width).

## 2. Drawing and animating

**Drawing.** `spriteCache` paints each assembled frame once per palette into an offscreen canvas (an
`OffscreenCanvas`, or a `<canvas>` where that is missing; a recording fake in tests), keyed by frame id and palette id,
built lazily on first use and kept for the session. `render` draws a person or the cat with one `drawImage` from the
cache (mirrored for facing right). The per-frame fill count of people therefore no longer measures their detail: the
fill baselines are re-measured once for the new drawing path, and character frames are pinned by their maps, not by
fills. `RUN_CAPS` is retired with the old frames; a frame's size is bounded by its rules instead.

**Animating.** A pure `animation` module replaces the frame-counter maths in `mood.ts` and render's per-state
switches. An animation is a list of steps (a pose or key frame, and a duration in ms), and loops or plays once. Each
character has an animation state: the base loop for its actor state (idle, walk, seated drawing, seated idle, sleep,
the cat's sit and sleep), the transition playing between two actor states, and a queue of one-shot moments that play
over the base and then return to it. The player is a pure function of the state and elapsed time (`advance`), driven
by `StudioScene`'s clock, and unit-tested with literal timings.

- **Smoother cycles.** The walk is 8 frames with a head bob and arm swing (the arm forward opposite the leg forward);
  the idle breath has a blink every few seconds; seated drawing moves the pen across the page and back; sleep breathes.
- **Transitions.** Sit down and stand up (desk), lie down and get up (bed), the editor's turn at the door; `actors.ts`
  reports a state change and the player plays the transition before the new base loop. A transition never delays the
  sim: it is presentation only, and a skipped frame (the window hidden) jumps to the end.
- **Idle life.** A seeded schedule (no `Math.random`; seeded by the day and the character) picks idle moments at
  intervals: at the desk, a stretch, rubbing eyes when tired, a sip of coffee, flipping a page; standing, looking
  around, a sip; the cat's yawn, groom and pad-about.
- **Reactions.** One-shot moments queued from game events the scene already sees or gains in its snapshot: a good poll
  (the cheer), a bad poll (the slump), a level-up (the cheer), a late chapter (panic, as today), a missed deadline
  (tearing up a page), the editor's verdict at a pitch (a nod for an offer, a sigh for a rejection). `Snapshot` gains
  one field, `reaction`, a one-shot cue with an id the scene consumes once.
- **Reduced motion.** Every character holds the first frame of its base loop; no transition, idle or reaction plays.
- **Moods.** The mood priority order (`moodOf`) stays; a mood picks the head's eyes, mouth and mark while the body
  animates.

## 3. The scene

The spots move for 1.5x figures (each re-measured against the furniture and checked by eye): the desk seat, where the
mangaka stands, the bed, the editor's spot and the door, the cat's cushion and the kitchen spot. The three assistants'
desks at x 66, 86 and 106 (20 px apart) cannot hold 32-wide figures; they become a row 34 px apart, or two in front
and one behind if the row does not fit the room. The furniture and the rooms stay where they are. Every tier is
checked by eye in both themes and at 375x667.

## 4. Testing and checks

- The pure modules (`assemblePose`, the animation player, the idle schedule, the reaction queue) are unit-tested with
  literal values (TDD).
- Frame and part rules are tested over every pose and key frame.
- The render tests keep their exact fill baselines for everything that is still code-drawn, re-measured once when the
  people move to `drawImage`; the drawImage calls for characters are asserted by count and placement.
- The scene's spot changes are asserted (actors.test) and checked in the preview.
- `npm run check` green; the balance bots untouched (the sim does not change).

## 5. Releases

1. **0.11.0, the engine with the mangaka and assistants.** The rig, the cache, the player, the head, the spots; the
   mangaka's full set (idle, walk, seated drawing, seated idle, sleep, sit/stand and bed transitions, idle moments,
   reactions, panic, the bed pose) and the assistants (seated drawing, doze, idle moments, the cheer). The editor and
   the cat keep their 0.10 frames, drawn through the cache at their old sizes until their releases.
2. **0.12.0, the editor.** His head with glasses, suit, briefcase; walk, arrival, the turn at the door, the verdicts.
3. **0.14.0, the cat.** 18x12: walk, sit, sleep, yawn, groom, pad-about, the stretch.

Each release: a plan in `docs/plans/`, subagent-driven tasks with TDD and a review per task, a final whole-branch
review; merging, pushing and the version bump wait for the owner's word.

## Out of scope

The scene's resolution, the rooms and furniture art, the sim, the save format, sound.
