# The cast rig, release 2 (0.12.0): the editor (design)

Date: 2026-10-11. Owner-approved in conversation (four questions, three design sections, approach 1). Builds on
`docs/plans/2026-10-09-cast-rig-design.md` (the cast rig; 0.11.0 shipped the engine, the mangaka and the assistants)
and replaces its one-line release 2 with this design.

## Goal

Redraw the editor as a 32x48 chibi on the 0.11.0 rig, so the visitor matches the mangaka beside them: a suit, glasses
and a briefcase, a walk, an arrival and a departure that turn at the door, a few idle moments while waiting, and a
verdict on the work they bring (a nod or a sigh). Keep the pillars: the editor never blocks the game (presentation
only), and every reaction comes from something the player can see in the game.

## Decisions (the owner's)

| Question | Decision |
|---|---|
| Approach | Reuse the rig: the editor's own parts in the same tables, key frames where parts cannot make the pose, an `editor` track in the cast driver |
| Verdicts | On the poll and the offer: a nod when a serialisation offer arrives or the dismissed poll placed top three, a sigh when it landed in the bottom third (the mangaka's cheer and slump rule, so the two react together) |
| Spot | In front of the bed, about (205, 90): the feet on the floor in front of the bed (y 137), facing the desk |
| Props | The briefcase in the back hand on every visit; once standing, the visit's prop (envelope, letter, contract, trophy) in the front hand |
| Idle life | A few seeded moments while waiting (push up the glasses, check the watch, glance at the pile), every 6-14 s |

## 1. The art and the rig

**The head.** A new hand-drawn 27x22 editor head (`EDITOR_HEAD`), the same construction as the mangaka's `HEAD`: cols
0-23 the head, cols 24-26 the mark slot, the neck anchor at (12, 21), the same eye and mouth slot rectangles so the
face drawings (blink, closed eyes) and moods still stamp in. The editor's own hair (neat, parted) and glasses: the
glasses are part of the head map around the eye slot, and the editor's eye drawings keep a frame line (a glasses
variant of `EYES`, `EDITOR_EYES`, where the slot's eye rows carry the lens rims) so a blink reads behind the lenses.
`headRules` gains a check that every slot lies inside the head map (0.11.0 deferred minor). Reference:
`art/raw/sprites/editor.png`, the 0.10 `EDITOR_HEAD`.

**The body.** A suit torso (`editor-torso`, the mangaka torso's size and anchors: jacket in the editor's suit keys,
shirt, tie down the front), suit sleeves for each arm shape the editor uses (hang, walk swings, the props' hold), and
the legs: the mangaka's leg parts recoloured through the editor's palette (trousers and shoes), as the 0.10 editor's
walk was cut from the mangaka's legs. The editor's colours stay in `PAL` keys (the 0.10 editor keys `G g N P` and
friends); where a key collides with the mangaka's meaning, the editor gets its own palette id in the sprite cache
(`editor`), like the outfits.

**Props.** The briefcase is a part baked into the editor's poses (the back hand). The visit's props (envelope, letter,
contract, trophy) are small hand-drawn cast frames of their own, drawn after the body at the front hand's anchor (one
`drawImage`), so the body frames do not multiply by four props. Render's code-drawn visit props (`drawVisitorProp`)
retire.

**Animations** (all in `ANIMS`, ids prefixed `editor-`):

| Animation | Kind | Steps |
|---|---|---|
| `editor-stand` | base loop | breath and blink, the mangaka's timing |
| `editor-walk` | base loop | 8 steps with a bob and an arm swing, the briefcase swinging in the back hand |
| `editor-arrive` | transition (walking to standing) | the turn from the door to face the desk (amended in the plan: a part pose, `editor.turn`, 160 ms; `editor-leave` its mirror, `editor.turn-back`) |
| `editor-leave` | transition (standing to walking) | the turn back to the door |
| `editor-glasses`, `editor-watch`, `editor-glance` | idle moments | push up the glasses, check the watch, glance at the manuscript pile |
| `editor-nod`, `editor-sigh` | reactions | the verdicts (part poses, amended in the plan (decision 5): `editor.nod`, the head two rows lower, dipping twice; `editor.sigh-a`/`-b`, the torso one then two rows lower over the legs, the eyes closed, the mouth frowning, so the visit's prop stays at the front hand) |

**Rules** (tested, as 0.11.0's): sizes, palette keys, closed outlines where exposed, feet on row 47, the head rules,
one torso per animation, every step at least 41 ms.

**Gate.** Each set on `npm run sprites` beside the 0.10 editor frames (base ref `main` until the merge), then the live
scene.

## 2. The scene and the driver

**Spots.** `EDITOR_SPOT` (205, 90): the feet on the floor in front of the bed (y 137), facing the desk (left). The
editor's door spot is the mangaka's, (250, 69), the feet on the door's floor line (y 116). `EDITOR_WALK_MS` (the delay
before a visit's desk card mounts, `useArrival`) is re-derived from that walk as the sum of the absolute x and y
distances: 45 + 21 = 66 px at 40 px/s, 1650 ms. Depth: the editor stands in front of the bed, so they are drawn after
the bed and the cat; when the cat naps at `CAT_BED` (202, 118) the editor's legs cover its lower half, and on a rest day
they stand in front of the lying mangaka's shoulders (the head at x 224-247 stays mostly clear). Checked by eye at the
gate; if it reads badly, the ruling moves the cat's nap spot in 0.13.0 rather than the editor.

**The driver.** `castPlay` gains an `editor` track (a fifth seat in the idle schedule). Base loops: `editor-stand` while
standing, `editor-walk` while walking, none while hidden or away. Transitions become per character
(`transitionFor(who, from, to)`): the editor's walking to standing plays `editor-arrive`, standing to walking
`editor-leave`; the mangaka's are unchanged. Idle moments come from the editor's pool while standing.

**Verdicts.** `ReactionKind` gains `offer`, fired when the offer comes into view (amended in the plan (decision 6): `offerShown`, `pendingOffer` set with no `pendingResult` in front of it, going from false to true; the sim sets both in one tick) (with `popsFor`'s guards).
The editor plays them only while standing at the spot: `offer` and `good-poll` play `editor-nod`, `bad-poll` plays
`editor-sigh`; a reaction cuts an idle moment short and waits behind a transition, as the mangaka's do. The mangaka
does not react to `offer`. A one-shot poll reacts when dismissed (the 0.11.0 rule), while the editor is still standing
there with the results' envelope. Amended in the plan (decision 14): dismissing the result would send him straight to
the door, so `StudioScene`'s reaction subscription, synchronously on the store change, sets `Actor.holdMs` to
`verdictHoldMs(kind, editor)` (the verdict's length plus `VERDICT_HOLD_SLACK_MS` 50 while he stands, else 0);
`stepActors` keeps a held actor in place until it runs out, then he leaves through `editor-leave`.

**Drawing.** The editor is one `drawImage` of `rigFrame(pose, 'neutral', false)` in the editor's palette (the face
neutral but in the verdicts' poses, which set their own; amended in the plan (decision 5)), mirrored when facing right, then the visit's prop frame at the front hand when
standing with a prop. The bubble and the pops sit over the editor's head through the same `headTop`/`headCentre`
rule. Reduced motion holds the base loop's first step.

**Retired.** `OLD_CAST.editorIdle`/`editorWalk`, `drawVisitorProp` and the code-drawn props, the 0.10 editor maps
(`EDITOR_HEAD`, `EDITOR_BODY`, `EDITOR_IDLE`, `EDITOR_WALK`), and the legacy frames they were cut from (`LEGACY_IDLE`,
`LEGACY_WALK`); `ANCHOR_HEAD` and `faceRules` stay only while `scripts/pixelate.ts`'s `--sprite` graft needs them (the
plan decides). `RUN_CAPS` keeps the cat's rows only. The cat stays on `OLD_CAST` until 0.13.0.

## 3. Testing and delivery

- TDD per task: the editor's transitions, idle pool and reactions in `castPlay.test`; the `offer` reaction in
  `reactions.test`; the spot geometry in `actors.test`; the head, part, key-frame and closure rules over every new
  drawing (the 0.11.0 table-wide tests pick them up); the prop frame's placement in `render.test`.
- Fill pins: the code-drawn visit props retire, so every pin whose scene has the editor visiting drops by its named
  terms, re-measured by rendering with the arithmetic in each docblock; budgets stay 1.5x.
- Gates: each art set on `npm run sprites`; then the live scene with the preview pane visible: the arrival and the
  turn, the waiting moments, a nod on an offer, a sigh on a bad poll, the departure; both themes, 1280x720 and 375x667.
- The same process as 0.11.0: a plan in `docs/plans/`, subagent-driven tasks with TDD and a review each, a final
  whole-branch review on the most capable model; merging, pushing and the version bump wait for the owner's word.

## Out of scope

The cat (0.13.0), the sim, the save format, sound, the rooms and furniture.
