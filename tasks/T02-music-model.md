# T02 — Canonical music model and import pipeline

**Depends on:** T01, and S-2's verdict or documented default (MusicXML path)
**Handoff sections:** README §Interactions (upload validation), §4 dropped-notes notice
**PRD:** F2

---

## Goal

Turn any accepted file into one canonical `PieceDocument`. Built before the
player UI so every later component consumes real data, never a fixture.

## Deliverables

`src/music/` containing:

- **Types.** `NoteEvent { id, midi, start, end, velocity, hand: 'left'|'right'|'unknown' }`
  with `start`/`end` in **musical seconds at 1×**. `PieceDocument { id, title,
  composer, source, duration, notes, hasHandData, notices }`. `ImportNotice
  { kind, message }` — persistent, typed, rendered by the player.
- **MIDI import** via `@tonejs/midi`: apply the tempo map, exclude channel 10,
  merge all note-bearing tracks, drop pitches outside 21–108.
- **MusicXML/MXL import**: expand to performance order (repeats, voltas,
  D.C./D.S., Fine, ties), then normalize into the same `NoteEvent[]`.
  Follow S-2's recommendation for the parse path.
- **Validation** with one specific message per failure: unsupported extension ·
  >10 MB · >30 min · unparseable · zero notes.
- **Web Worker** hosting the parse so the UI never blocks.
- Notes sorted by `start` ascending, with stable ids.

## Behaviour rules

**Hand assignment** — the rule depends on the source and must not silently
degrade (this is the single most likely correctness bug in the task):

| Source | Rule |
|---|---|
| MusicXML with staves | staff 1 → right, staff 2 → left |
| MIDI, exactly two note-bearing tracks | lower median pitch → left, higher → right |
| Anything else | all `unknown` |

When every note is `unknown`: the player uses one colour (`color.handRight`),
collapses the hand legend, and the report omits the per-hand card.

**Tempo (D-010).** Honour the tempo map and base/section tempo marks. Ignore
only continuous expressive deviation: rit., accel., fermata, rubato,
articulation, dynamics, pedal. Do **not** strip base tempo — a piece marked
♩=72 must not play at 120.

**Ornaments.** Render principal written notes only; do not realize trills,
mordents or turns. Grace notes render literally as short notes. Attach the
documented notice.

**Structural fallback.** If repeats/voltas/D.C./D.S./Fine cannot be resolved,
import linearly and attach a **persistent, prominent** warning — the learner
must know the playback may not match the full piece.

**Dropped notes.** Any note outside 21–108 is dropped and produces the §4
notice: *"N notes fell outside the 88-key range and were dropped — this file may
not be a piano arrangement."*

## Acceptance criteria

1. A known MIDI file yields the expected note count, duration, and first/last
   onsets to within 1 ms.
2. Tempo changes mid-piece land notes at the right musical seconds (fixture with
   an explicit tempo change; assert onsets, not just count).
3. Channel 10 percussion is excluded; a file that is *only* channel 10 fails
   validation as "no notes" rather than importing empty.
4. Out-of-range notes are dropped **and** the notice carries the correct count.
5. Two-track MIDI assigns hands by median pitch; single-track MIDI yields
   `hasHandData === false` and all-`unknown`.
6. MusicXML staff 1/2 maps to right/left, verified note-by-note against a
   cross-hand fixture (the S-2 file).
7. Repeats expand: a fixture with a repeated 4-bar section produces 8 bars of
   notes in performance order.
8. Each of the five validation failures returns its own message and never throws.
9. Notes are `start`-sorted; ids are stable across two imports of the same bytes.
10. Parsing runs in a Worker: the import API is async and the parse module has no
    DOM imports. (Main-thread blocking is measured for real in the browser, not
    in jsdom — record the number during the T03 e2e run.)
11. `src/testing/denseFixture.ts` (from S-1) produces a deterministic
    `PieceDocument` at a requested duration and density — the fixture T04, T05
    and the MVP gate depend on.

## Verify

```bash
npm test -- src/music
npm run check
```

## Done

- [ ] All eleven criteria have a passing assertion
- [ ] Fixtures committed under `src/music/__fixtures__/` (small, licence-clean)
- [ ] No player or UI code touched in this task
- [ ] Hand-assignment rules implemented per source format, with a test proving
      the MIDI heuristic is **not** applied to MusicXML input

## Traps

- `start`/`end` are musical seconds at 1×. Speed never enters this layer.
- A piece can legitimately have zero `hasHandData`; that is not an error state.
- Do not "fix" a file by guessing. Every transformation that loses information
  emits an `ImportNotice`.
