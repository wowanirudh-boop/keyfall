# T04a — Fix note velocity double-normalisation (audio ~42 dB too quiet)

**Depends on:** T02, T04. Small and urgent — playback is effectively inaudible.
**PRD:** F3 (synthesized piano audio)

---

## The bug

Every piece plays roughly **125× quieter than intended**, on every device.

`@tonejs/midi` returns `Note.velocity` **already normalised to 0–1**; the 0–127
form is `Note.rawVelocity`. `src/music/parse.ts:138` correctly passes the
normalised value through into `NoteEvent.velocity`. Then
`src/playback/PlaybackEngine.ts:306` divides it by 127 a second time:

```ts
velocity: Math.min(1, Math.max(0, note.velocity / 127)),
```

A note at MIDI velocity 80 arrives as `0.63` and is scheduled at `0.00496` —
about **-42 dB**. Turning the device volume to maximum cannot recover it.

**Root cause:** `src/music/types.ts:8` declares `velocity: number` with no unit.
T02's spec did the same. Two layers each assumed a different scale, and nothing
in the type system, the tests, the guardrails or the linter can see a unit
mismatch. T04's audio test asserts frequency and note spacing — **no test
anywhere asserts amplitude**, which is why a 125× error shipped through a green
gate.

## The fix

1. **Document the unit at the type.** `NoteEvent.velocity` is **normalised 0–1**.
   Say so in the type, not just a commit message — this is the ambiguity that
   caused the bug.
2. Remove the `/127` in `PlaybackEngine`. Clamp to `[0, 1]` and pass through.
3. Confirm the MusicXML path agrees. Verovio-derived notes go through the same
   normalisation, and D-010 specifies uniform velocity for MusicXML — check what
   value they actually get and that it is on the 0–1 scale.
4. Sanity-check loudness by ear after the fix. If it is still quieter than
   comfortable, a modest fixed makeup gain on the output node is acceptable —
   but **measure first**, and do not stack makeup gain on top of an unfixed
   scaling bug.

## Acceptance criteria

1. A MIDI fixture note with `rawVelocity` 80 schedules with velocity ≈ 0.63
   (±0.01), not ≈ 0.005. Assert against the runtime's recorded schedule history,
   the same mechanism T04's pitch test uses.
2. Velocity extremes map correctly: `rawVelocity` 1 → ≈ 0.008, 127 → 1.0, and
   the result is always within `[0, 1]`.
3. **A regression guard on audible gain:** assert that the mean scheduled
   velocity across a real catalogue piece sits in a plausible musical range
   (0.3–1.0). This is the test class that did not exist — a unit error of this
   size must fail loudly rather than merely sound wrong.
4. MusicXML-imported notes schedule on the same 0–1 scale as MIDI-imported ones,
   asserted by comparing both paths on equivalent fixtures.
5. `NoteEvent.velocity` carries its unit in the type definition.
6. Mute still silences completely, and unmuting restores the same level.

## Verify

```bash
npm run check
npm run build && npm run preview -- --host   # then listen on the iPad
```

## Done

- [ ] Six criteria asserted, 1 and 3 explicitly
- [ ] Verified by ear at 1×, 0.5× and 0.25× on a real piece
- [ ] Unit documented at the type, so the ambiguity cannot recur

## Traps

- Do not "fix" this by raising the output gain and leaving the `/127` in place.
  That would compress every piece into the top of the dynamic range and destroy
  the distinction between soft and loud notes.
- `rawVelocity` and `velocity` are both real properties on `@tonejs/midi` notes.
  Whichever you read, the canonical `NoteEvent` unit is 0–1.
