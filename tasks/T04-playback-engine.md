# T04 — Playback engine

**Depends on:** T02
**Handoff sections:** README §Interactions (playback loop), §State Management
**PRD:** F3 (audio), F4 (transport semantics)

---

## Goal

One authority for musical position and audio. No React inside it.

## Deliverables

`src/playback/PlaybackEngine.ts` — a plain class, framework-free, unit-testable
against a fake clock. React subscribes to `PlaybackSnapshot`; it never owns time.

```ts
type PlaybackSnapshot = {
  position: number;        // musical seconds at 1x
  duration: number;
  playing: boolean;
  speed: 1 | 0.5 | 0.25;
  loop: { a: number | null; b: number | null };
  muted: boolean;
};
```

API: `load(piece)` · `play()` · `pause()` · `seek(t)` · `setSpeed(s)` ·
`setLoop(a, b)` · `setMuted(m)` · `subscribe(fn)` · `getSnapshot()` ·
`dispose()`.

## Behaviour

- **One musical-time position at 1×**, mapped onto the Tone.js audio clock by the
  current speed. Every public value is musical seconds; speed is an internal
  mapping detail.
- **Schedule-ahead queue**, not the whole piece. Schedule roughly 2 seconds
  ahead, top up on a timer. A 30-minute piece must never be scheduled up front.
- **On seek or speed change:** cancel future events, preserve the selected
  position, re-anchor the clock, rebuild the queue. Position must not drift.
- **Loop:** when `a` and `b` are both set, `position >= b` snaps to `a`, never
  overshooting past `b`.
- **End:** playback stops at `duration`. Calling `play()` at the end restarts
  from `a` if a loop is set, otherwise from 0 (`position >= duration - 0.01`).
- **AudioContext starts only from a user gesture.** Construct lazily on the first
  `play()`; never on module load.
- **Sampler (D-008):** Salamander Grand Piano subset, self-hosted, ≤ 8 MB,
  CC-BY 3.0 attribution rendered in the UI. It **lazy-loads on first play**
  behind a lightweight Tone.js synth so playback is never blocked on a download.
  Swap to samples transparently when they resolve — no audible restart.
- **Mute** silences audio without affecting position or scheduling.

## Acceptance criteria

1. With a fake clock, `position` advances at exactly `speed × wall time`, for
   each of 1×, 0.5×, 0.25×.
2. Changing speed mid-playback preserves position exactly (assert equality before
   and after) and takes effect on the next scheduled note.
3. `seek(t)` lands within **±100 ms** of `t` — asserted at 20 random positions
   across a 10-minute fixture, at every speed. *(PRD F4 acceptance criterion.)*
4. Loop wrap: with `a=7.8, b=15.5`, position never exceeds `b` and always
   resumes at `a`; verified across 50 wraps with no cumulative drift.
5. `play()` at the end restarts at 0, or at `a` when a loop is set.
6. Scheduled-note count stays bounded (< 200 live events) throughout a 30-minute
   fixture — proves the queue is windowed.
7. No AudioContext is constructed until the first `play()`.
8. Audio-to-visual drift stays under **50 ms**: compare the engine's reported
   position against `Tone.now()`-derived audio position over 60 s of playback at
   each speed. *(PRD §9 acceptance criterion.)*
9. `dispose()` releases the context, timers and subscriptions; repeated
   load/dispose cycles leave no growing listener or scheduled-event count
   (assert the counts, not heap size — heap is not observable in the test env).
10. **Pitch is unchanged at every speed.** PRD F4 states this as a requirement,
    not an implementation note. Assert that no `playbackRate`, `detune` or
    `PitchShift` is applied to sampler playback, and that a note's synthesized
    frequency is identical at 1×, 0.5× and 0.25×. Slowing down must reschedule
    notes further apart in time, never resample them.

## Verify

```bash
npm test -- src/playback
npm run check
```

## Done

- [ ] Ten criteria asserted; 3, 8 and 10 explicitly (all three are PRD numbers
      that v1 of the plan stated but never tested)
- [ ] Zero React imports in `src/playback/`
- [ ] Sampler budget measured and recorded against the ≤ 8 MB cap
- [ ] Attribution string exported for the Home footer (D-012)

## Traps

- Do not expose wall-clock seconds anywhere in the public API. Everything the
  rest of the app sees is musical time at 1×; that is what keeps lookahead and
  highlight lead speed-independent.
- The prototype's `Math.min(0.05, dt)` clamp is a rAF artefact — it has no
  equivalent here and must not be ported.
- Tone.js Transport `bpm`-based rate changes and `seconds` are easy to conflate.
  Pick one representation and assert against it.
