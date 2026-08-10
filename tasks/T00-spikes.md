# T00 — De-risking spikes

**Depends on:** T01 (the spikes need a bundler and test runner).
**Runs:** second, before any feature code. Numbered T00 because it gates
decisions consumed by T02, T05 and T08.
**Output:** `docs/spike-results.md` — findings only. Spike code lives under
`spikes/` and is never merged into `src/`, with one exception noted in S-1.

Three unknowns can invalidate large amounts of downstream work. Each is
time-boxed to half a day. If a spike blows its box, report and stop rather than
continuing to dig.

**`npm run check` does not apply to this task** — spike code is throwaway and is
not held to the production guardrails.

## When a spike cannot run

S-3 needs the Roland RP302 physically connected, and S-2 needs real MusicXML
files. If either is unavailable to you:

1. Write the spike harness anyway, committed under `spikes/`, so a human can run
   it in one command. Say exactly what command.
2. Record the spike as **BLOCKED — awaiting hardware/files** in
   `docs/spike-results.md`, and say which decision is unverified.
3. **Proceed to T02 using the documented default**, not a guess: S-2's default is
   Verovio with a note-by-note staff-mapping test that must pass before the
   MusicXML path is considered done; S-3's default is the D-005 conversion
   implemented as specified, with the hardware gate in T08 as the real check.
4. Never silently skip a spike or mark it passed without numbers.

---

## S-1 — Waterfall performance at scale (validates D-002)

**Question:** does the windowed waterfall hold 60 fps where the prototype's
full-piece layer cannot?

Build a throwaway page that renders the note layer from `docs/algorithms.md` §3
against a synthetic 30-minute piece of ~16,000 notes (mixed chords, sustained
notes, dense passages).

**Exception to the throwaway rule:** the fixture *generator* is kept. Commit it
as `src/testing/denseFixture.ts` — a deterministic, seeded function returning a
`PieceDocument` of a requested duration and density. T04 (AC6), T05 (AC7, AC8)
and the MVP gate all depend on this fixture existing; nothing else creates one.

Measure both strategies at 1440×900:
- **A (prototype):** every note laid out in the layer.
- **B (windowed):** only notes intersecting `[t-2, t+lookahead+2]`.

Record for each: frames per second while playing, time to first paint, JS heap
size, and whether the layer composites (DevTools → Rendering → Layer borders).

**Pass:** B sustains ≥ 58 fps with stable memory, and seeking to a random
position repaints within 100 ms. Report A's numbers as the justification.

**If B also fails:** the fallback is a `<canvas>` waterfall. Say so — do not
start building it inside this spike.

## S-2 — MusicXML → hand data survival (resolves O-1, O-2)

**Question:** does the MusicXML→MIDI conversion preserve staff separation, so
staff 1 → right hand and staff 2 → left hand survives?

Take three real two-staff piano MusicXML files, at least one with an explicit
cross-hand passage (a left-hand note written above middle C, or `<staff>`
switching mid-voice).

For the candidate converter (Verovio first):
1. Convert to timed events.
2. Check whether each staff lands in a distinguishable track or channel.
3. Compare the resulting hand assignment against the source's `<staff>` elements
   note by note. Report the mismatch rate.
4. Record the shipped bundle size of the converter (gzipped).

**Pass:** hand assignment matches the source `<staff>` for ≥ 99% of notes, and
the bundle cost is justifiable against the ≤ 8 MB total asset budget (D-008).

**If it fails:** MusicXML needs its own parse path that reads `<staff>` directly
and never falls through to the MIDI two-track median-pitch heuristic. That is the
recommendation to write up — the silent fallback is the thing we must not ship.

Also record: are repeats, voltas, D.C./D.S. and Fine expanded into performance
order? Which constructs are not? That list becomes the structural-fallback
warning in T02.

## S-3 — Web MIDI clock offset on real hardware (validates D-005, PRD R6)

**Question:** what is the actual offset and jitter between Web MIDI timestamps
and the audio clock on the Roland RP302?

Requires the RP302 connected over USB. In **both Chrome and Edge**:

1. Open a `MIDIAccess`, subscribe to the input, log `event.timeStamp` for note-on.
2. Sample `audioContext.getOutputTimestamp()` and `audioContext.outputLatency`
   alongside.
3. Compute the offset per `docs/algorithms.md` §11.
4. Play a metronomic pattern by hand for ~60 seconds. Report the mean offset,
   the standard deviation, and any drift over the minute.

**Pass:** mean offset is stable and correctable to within ±30 ms, jitter (σ)
under 15 ms. Record the numbers — they are the baseline the T08 hardware gate is
measured against.

**Also record:** the exact permission prompt text and flow, whether SysEx is
requested, and what happens when the piano is powered off and on mid-session
(does the port disappear, reappear, change id?). That behaviour drives the
disconnect handling in T08.

---

## Done

- [ ] `docs/spike-results.md` exists with a section per spike: numbers, verdict,
      and the recommendation
- [ ] Each of D-002, O-1, O-2, D-005 is either confirmed, has a written
      replacement recommendation, or is recorded as BLOCKED with the default
      that T02/T05/T08 will proceed on
- [ ] Every "Also record" item above is answered
- [ ] `src/testing/denseFixture.ts` committed and deterministic
- [ ] All other spike code under `spikes/`, none in `src/`
- [ ] Any spike that failed its box is reported as blocked, not worked around
