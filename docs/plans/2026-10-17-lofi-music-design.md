# 0.13.0: cosy lo-fi seasonal music (design)

The binding spec for `docs/plans/2026-10-17-lofi-music-0.13.0.md`. Owner decisions and context are in that plan.


### Musical rules

- **Keys contain the C major pentatonic.** Only the C, F and G collections qualify: C major, A minor, F major, D
  minor, G major, E minor. Every chord and melody note is diatonic to its track's key, so the cues (all C pentatonic,
  `cues.ts`) never clash. G-collection tracks use no chord rooted on B or F# (G major's iii and vii, E minor's
  v and ii): those roots would sit a semitone from a cue's C or G.
- **Chords are roman numerals in the track's mode**, stacked in scale thirds, so they are diatonic by construction.
  - Major mode: I ii iii IV V vi vii. Minor (aeolian): i ii III iv v VI VII.
  - The suffix `maj7`/`maj9` is required exactly where the diatonic 7th is major, and `7`/`9` everywhere else. `ø7`
    marks a half-diminished chord, and `ø7` alone is accepted only where diatonic.
  - `6` is an added sixth with no 7th. `sus` (as in `V9sus`) needs a perfect fourth. `11` is allowed on minor chords
    only.
  - The parser rejects a flat 9th, a natural 11th over a major third, the wrong numeral case, and a wrong `maj`.
- **Timing.** The grid is 16th notes, 16 per bar in 4/4. `swing` runs 0.5-0.68 (0.5 is straight). Odd 16ths are
  delayed by (2·swing − 1) × one 16th. Humanise, strum and swing only ever *delay* a note, by at most `MAX_LATE` ≈ 130
  ms. Every note starts before its track ends.
- **Variation is deterministic.** Every choice comes from `u = mix(seed ^ hashString(id), pass, bar*1024 + lane*64 +
  step) / 2^32`, where `bar` counts across the whole form and `pass` is the player's segment counter. Harmony and
  voicings never depend on `pass`.
  - **Drums.**
    - Ghost snares: chance `feel.ghost`, at velocity 0.25, on an odd step with no snare hit next to it.
    - Hat velocities: 1 on the beat, 0.7 on off-beat 8ths, 0.45 on 16ths. Any hat off the downbeat is dropped 8% of
      the time.
    - Fills: on each phrase's 4th bar, chance `feel.fill`, one of three (skip, roll, open hat) over steps 12-15.
    - Before a new section: a drop (steps 12-15 silent) or a fill, half and half.
    - Kick anticipation on step 15: 10%.
    - The track's last bar has no drums after step 0.
  - **Keys.**
    - A comp may name an alternate (`push|push2`), used in 25% of bars.
    - Where diatonically available, the 9th is added 30% of the time.
    - Answer runs: when the lead rests in a bar, chance `feel.answer` of a 3-note chord-tone run on steps 12-14.
  - **Bass.**
    - `A` is the scale step toward the next chord's root.
    - Before a chord change, an approach note on step 15, 35% of the time.
    - An octave pop on step 14, 10% of the time.
    - Each note sits in the octave nearest the previous one.
  - **Lead.** With chance `feel.vary`, each motif occurrence gets one change: move an inner note a scale step, end on
    the root or 3rd, merge a short note into its neighbour, or (rarely) go up an octave. Then long notes (4 or more
    16ths) that are avoid notes snap to the nearest chord tone, notes fold back into range, and the motif's length
    stays the same.
  - **Velocity** is scaled by a hashed 0.88-1.
- **Voicing** is worked out once per track (it never depends on pass).
  - Keys range: MIDI 50-74.
  - Chords with 4 or more tones are voiced rootless, keeping the 3rd and the 7th (or the 6th). Triads keep their root.
  - The lowest interval is at least 3 semitones.
  - Each voicing moves as little as possible from the last, ties go lower, and the first sits nearest MIDI 62.
  - Bass range: MIDI 36-55.
  - A chord held across a chord change re-strikes at the change. A note lasts until the next strike of its part,
    less a gap.

### Track data format (the example becomes the real spring track `slow-ink`)

```ts
'slow-ink': {
  title: 'Slow Ink', key: 'F major', bpm: 74, lead: 'soft', leadTonic: 65,   // degree 1 = F4
  feel: { swing: 0.6, humanise: 0.008, fill: 0.6, ghost: 0.15, vary: 0.4, answer: 0.3 },
  mix: { keys: 1, bass: 1, lead: 0.8, drums: 0.85 }, tone: 2600, space: 0.22,
  drums: {
    main: { k: 'X......x..x.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
    half: { k: 'X.........x.....', s: '........x.......', h: 'x...x...x...x...' },
    tick: { h: 'x...x...x...x...' },
  },
  comp: { pad: 'X---------------', push: 'X------.x------.', lift: 'X-----x---.x----' },
  bass: { hold: 'R---------------', walk: 'R-----5-R---..A-', two: 'R------.R-----A-' },
  motifs: {
    m1: "_:2 5:2 6:2 1':4 6:2 5:4 | 3:8 _:8",
    m2: "_:2 3:2 5:2 6:4 5:2 3:2 2:2 | 3:6 _:10",
    m3: "6:2 1':2 2':4 1':2 6:2 5:4 | 3:4 5:2 3:2 1:8",
  },
  sections: {
    intro: { chords: 'IVmaj9 | Imaj9', comp: 'pad', drums: 'tick .' },
    A:  { chords: 'IVmaj9 | iii7 vi7 | ii9 | V9sus | IVmaj9 | iii7 vi7 | ii9 V9 | Imaj9',
          comp: 'push', bass: 'walk', drums: 'main' },
    A2: { like: 'A', lead: 'm1 - . . m2 - m3 -' },
    B:  { chords: 'vi9 | iii7 | IVmaj9 | V9sus', comp: 'lift', bass: 'two', drums: 'half', lead: '. . m3 -' },
    outro: { chords: 'IVmaj9 | Imaj9', comp: 'pad', bass: 'hold', drums: 'tick .' },
  },
  form: 'intro A A2 B A2 outro',   // 2+8+8+4+8+2 = 32 bars, about 104 s
}
```

**Grammar**

- **Grids** are 16 characters per bar, or 32 for two bars.
  - Drum lanes: `k` kick, `s` snare, `h` hat, `sh` shaker. `X` is an accent, `x` normal, `g` a ghost, `.` silence.
  - Comp: `X`/`x` strike, `-` hold, `.` release.
  - Bass: `R` root, `3` third, `5` fifth, `O` octave, `A` approach, `-` hold, `.` rest.
- **Motifs** are a scale degree, `'` for an octave up and `,` for an octave down, then `:` and a length in 16ths. `_`
  is a rest, and `|` must fall on a bar line.
- **Section fields** are lists of pattern names cycled bar by bar. `.` is silence, `-` continues a two-bar pattern,
  and `like` inherits from another section.
- **Chords:** `|` separates bars, and a bar holds 1, 2 or 4 chords, split evenly.
- **Track options:**
  - `lead` is one of `bell`, `soft` or `glock`.
  - `tone` is the lowpass cutoff in Hz (default 2600).
  - `space` is the reverb send (default 0.22).

### The nine tracks (working titles, internal only and never shown in the UI)

| Pool | id | Key | BPM | Lead | Character |
|---|---|---|---|---|---|
| Title | `blank-page` | C major | 72 | bell | Keys and bell only. Light drums from its B section. |
| Spring | `slow-ink` | F major | 74 | soft | The example above. |
| Spring | `sakura-margins` | F major | 80 | bell | Bright, light hats. |
| Summer | `screentone` | G major | 84 | bell | Crisp hats plus shaker. No chords rooted on B or F#. |
| Summer | `cold-ramune` | E minor | 80 | soft | Summer evening, shaker. No chords rooted on B or F#. |
| Autumn | `rain-on-the-sill` | D minor | 72 | soft | Warm, `tone` 2200. |
| Autumn | `tea-break` | A minor | 76 | soft | Warm, `tone` 2300. |
| Winter | `first-snow` | C major | 68 | glock | Sparse drums (`tick`/`half`), `space` 0.35. |
| Winter | `kotatsu` | A minor | 70 | glock | Sparse, `space` 0.32. |

Each track is 24-40 bars, 60-150 s, and has at least 2 distinct sections. The title track has no drums in its first
two sections.

### Sound palette (`instruments.ts`; the shipped values, after the Task 12 loudness gate)

Every peak below is the starting value x 0.84 (-1.5 dB), the Task 12 ruling that brought the studio tracks inside
the gate (`PEAK`; the starting values were keys 0.035, bass 0.08, the leads and the snare 0.05, kick 0.12, hat 0.025,
shaker 0.015).

- **keys:** FM electric piano. A sine carrier and a sine modulator at 1:1, the modulator through a mod gain into
  `carrier.frequency`. The index runs from I0·f (I0 = 1.2 + 1.3·vel, at most 3) on an exponential ramp to 0.25·f over
  0.6 s. Envelope: attack 6 ms, exponential decay to 0.35 over 1.4 s, then a 0.25 s release tail. Chords strum low to
  high, 12 ms apart. Peak 0.0294 per note.
- **bell:** FM at 3.5:1, index 1.5 falling to 0.1 over 0.4 s. Attack 4 ms, decay 0.8 s, release 0.4 s. Peak 0.042.
- **glock:** the bell at 5:1 and an octave up, decay 1.2 s. Its starting FM deviation (index x modulator Hz) is capped
  at 5800 Hz, so high notes (from about G4) do not alias. Peak 0.042.
- **soft:** a triangle. Attack 40 ms, sustain 0.7, release 0.15 s. Peak 0.042.
- **bass:** a sine plus a triangle at 0.3, through the bass bus lowpass at 700 Hz. Attack 12 ms, release 80 ms. Peak
  0.0672 (its real amplitude 1.3 x that, `AMPLITUDE`).
- **kick:** a sine sweeping 110 to 45 Hz over 0.12 s, then an exponential tail to silence over 0.32 s. Peak 0.1008.
- **snare:** noise alone from `synth.ts`'s shared `noiseBuffer` (exported) at a hashed offset, 0.14 s, into the snare
  bus bandpass (1800 Hz, Q 0.8). The 190 Hz triangle body was dropped in Task 12 (about -17 dB through that
  bandpass, so near inaudible); the snare counts 2 nodes. Peak 0.042.
- **hat:** noise for 35 ms (an open hat lasts 0.18 s) into the hat bus bandpass (6500 Hz, Q 0.9). Peak 0.021.
- **shaker:** noise for 50 ms with a soft 8 ms attack into a bandpass at 5200 Hz. Peak 0.0126.
- **Per-note nodes** are only sources plus an envelope (and a mod gain for FM). The fixed filters live on the
  persistent buses. Each voice returns `{ end, stop(t) }`. One `onended`, on the source that stops last, disconnects
  every node the voice made.
- **Crackle** (session): two click layers of unequal length, 7.3 s and 11.9 s (about 6 sparse hashed clicks per
  second), plus a 2 s hiss loop. All are mono at 22050 Hz, with seams that start and end at zero. Clicks peak at
  0.012, hiss at 0.004.
- **Reverb:** one `ConvolverNode`. Its impulse is stereo, 1.8 s, at `ctx.sampleRate` (a mismatched rate throws), with
  15 ms of pre-delay, decaying to −60 dB and darker in the tail, using different noise per channel. Set `normalize`
  before `buffer`. It is built at the first `start()`.
- **Tape wobble:** one modulated `DelayNode` on the tonal sum, created with `createDelay(0.05)` around a 5 ms centre.
  A 0.45 Hz LFO at 1.5 ms depth (about ±8 cents) plus a 6 Hz flutter at 1/30 of that depth drive it. There are no
  per-note LFO connections.

### Mixer routing

```
Loop.fades[inst] ─► bus[inst] (calm levels; bass LP 700, snare BP 1800, hat BP 6500, shaker BP 5200)
keys/bass/lead buses ─► tonal sum ─► wobble delay ─► tone lowpass (cutoff by scene/track) ─► graph.music
tonal sum ─► reverb send (space) ─► convolver ─► tone lowpass
kick/snare/hat/shaker buses ─► graph.music              (dry, bypassing wobble and tone so the hats stay audible)
session crackle ─► crackle gate ─► graph.music
graph.music ─► MUSIC_LOWPASS_HZ ceiling (1800 → 6000) ─► master
```

There are three lifetimes:
- **Chain:** buses, filters, delay, convolver, tone and gate. No sources. Built at the first `start()` and kept.
- **Session:** the LFOs and the crackle sources. Created at `start()`, reopened if a start comes during a stop's fade,
  and stopped and disconnected on the tick that releases the timer.
- **Loop:** one per start or crossfade, with 7 fade gains, one per instrument.

Unlock alone creates no sources. `engine.test` "starts nothing on unlock" stays as written.

### Levels (`levels.ts`, pure)

`levelsFor(scene, track)` returns `{ tone, space, parts }`:
- **tone:** title 2000, studio uses `track.tone` (default 2600), calm 1300.
- **space:** `track.space` (default 0.22).
- **parts:** the track's `mix`, with calm setting drums to 0 and the lead to ×0.6 (about −4 dB), keys and bass
  unchanged. This keeps the music present under the modal duck (60%, and 30% in the reveal).

Glides use `setTargetAtTime` with τ 0.8 s into calm and 0.4 s out. A track's tone and space glide in at the start of
its segment.

### Player (`player.ts`)

```ts
interface MusicScene { mood: 'title' | 'studio'; season: Season; calm: boolean }
interface MusicPlayer { start(): void; stop(): void; setScene(s: MusicScene): void; pin(id: TrackId | null): void; dispose(): void }
interface PlayerOptions { seed: number; scene?: MusicScene; catalog?: Catalog; voice?: VoiceFn }
function createMusicPlayer(ctx: BaseAudioContext, dest: AudioNode, timers: Timers, o: PlayerOptions): MusicPlayer
```

Segments are `{ kind: 'track' | 'break', track?, pass, origin, end }`, chained on the audio clock. `advance(loop)`
splits a look-ahead window at segment boundaries, at most 8 iterations per tick. Only the playing Loop chains to a
next segment; fading Loops never do. After a stall, a new segment starts at `max(prev.end, from)`. Constants: `FADE_IN`
2, `FADE_OUT` 0.4, `XFADE` 1.5, `LOOK_AHEAD` 0.2, a 50 ms tick, `MAX_FADING` 2 (an extra fading Loop is cut to a 50 ms
fade), `CALM_SETTLE` 3 s, `PIN_BREAK` 2 s, `YOUNG` 0.5 s.

| Change | While playing (a track or a break) | While stopped |
|---|---|---|
| `start` | No-op. | A track now, 2 s fade-in, the crackle gate opens. |
| `stop` | Every live Loop reaches 0 by now + 0.4 (crossfade-outs are shortened). Voices, session and timer are released on the first tick after. | No-op. |
| mood (title or studio) | Crossfade now (1.5 s) to a pick from the new pool, cutting a break short. If the playing Loop is under `YOUNG`, it is replaced with a 50 ms fade instead. Ignored while pinned. | Stored. |
| season | Read at the next pick (break to track). | Stored. |
| calm | Bus levels and tone glide now. Drums stop being scheduled after `CALM_SETTLE` and resume on the next tick after calm ends. | Stored; the chain is built at those levels. |
| `pin(id)` | Crossfade now. After that every track is `id`, with 2 s breaks. | Stored. |
| `pin(null)` | The next pick comes from the pool. | Stored. |
| suspended context | Fading Loops finish on the next tick. The playing Loop holds while the clock is frozen. | — |

`pick()` returns `pinned ?? pickTrack(poolFor(scene), recent, seed, ++counter)`, keeping the last 2 picks in
`recent`.

### Playlist (`playlist.ts`, pure)

- `pickTrack(pool, recent, seed, n)`: a pick from the pool that excludes the last 2 recent picks when the pool has 4
  or more, the last 1 when it has 2-3, and nothing when it has 1. In practice a season's pair alternates.
- `breakSeconds(seed, n)`: a hashed value in [8, 20].
- The pool itself lives in `tracks.ts`: `CATALOG.poolFor(scene)` returns `[TITLE_TRACK]` for title, else
  `SEASON_TRACKS[scene.season]`.

### Integration

- **engine.ts:**
  - `setMusicScene(scene)` and `pinMusicTrack(id)`. Both are recorded before unlock and handed to the player when it
    is created.
  - `SoundEngineOptions` gains `seed?` (default `Date.now()`: an impure shell is fine here) and `createMusic?` (for
    tests).
  - The default scene is `{ mood: 'title', season: 'spring', calm: false }`.
- **bridge.ts:**
  - `SoundState` gains `modal: string`.
  - `musicWanted` drops `!!s.game`, so music plays on the title screen. It still respects mute, the toggle and
    read-only.
  - `musicScene(s)` returns the title scene with no game, else `{ mood: 'studio', season: seasonOf(game.day), calm:
    !clockRuns(s) }`.
  - Order inside one update: stop, then scene (only when it differs, compared field by field), then start. On connect:
    `setPrefs`, then `setMusicScene`, then `startMusic` if wanted.
- **`src/state/clockRuns.ts` (new, pure, no store import):**
  `clockRuns({ game, speed, modal, readOnly })` = a game is open, speed above 0, modal `'none'`, no pending result or
  offer, and not read-only. Both `App.tsx` `useGameClock` and the bridge use it.
- **Season moves into the sim:** `Season` goes to `src/sim/types.ts`, and `seasonOf` goes to `src/sim/engine.ts`
  beside `describeDate`. `src/ui/scene/season.ts` re-exports both, so render, StudioScene and season.test stay
  untouched.
- **Hash moves into the sim:** `mix` moves from `src/ui/scene/idleSchedule.ts` to `src/sim/rng.ts`, beside
  `hashString`. idleSchedule imports it and re-exports it, so its tests stay green.
- **DEV preview:** in `main.tsx`'s `import.meta.env.DEV` block, `?music=<id>` calls `engine.pinMusicTrack(id)`
  (invalid ids are ignored). `window.__sound.pinMusicTrack` already works from the console.
- **Unchanged:** the cues, the ducking (`holdDuck`), the Settings rows, the hidden-window suspend, and the read-only
  and save-load silence.

### Budgets and loudness

- **Nodes:** at most 140 created per bar. The summed peaks of overlapping voices are at most 0.45 before the buses,
  decay-aware (the Task 12 ruling): each sounding voice counts its real amplitude (`AMPLITUDE`) x velocity x its
  envelope's level at the sweep instant (`levelAt`), the kick for its 0.12 s body only. Both are tested on every real
  bar.
- **Loudness gate** (in the browser, `measure.ts`, OfflineAudioContext):
  - Measurement is K-weighted: a highpass at 38 Hz plus a high shelf of +4 dB at 1500 Hz.
  - The studio tracks' K-weighted RMS, in the studio mood and not calm, must be within ±3 dB of the old loop's,
    which is measured in Task 1 *before* `music.ts` is deleted.
  - The music's peak at volume 1 must stay under 0.25 (−12 dBFS, the master compressor's threshold).
  - **Baseline (Task 1, the 0.12.0 loop, 46 s, `measurePlayer`):** `kRmsDb` −33.48, `rmsDb` −31.13, `peakDb` −21.74.
    The plain pass runs through the master compressor, whose automatic make-up gain lifts it above the pre-compressor
    K pass; compare like with like (`kRmsDb` to `kRmsDb`).

---
